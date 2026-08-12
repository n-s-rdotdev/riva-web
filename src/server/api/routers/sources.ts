import { TRPCError } from "@trpc/server";
import { and, count, eq, sql } from "drizzle-orm";
import { z } from "zod";

import { db, dbPool } from "../../../db";
import {
  sourceSchema,
  sourceTypeSchema,
  spaceSchema,
  transactionSchema,
  userSpaceSchema,
} from "../../../db/schema";
import {
  redisKeys,
  redisTtl,
  safeDel,
  safeDelByKeys,
  safeGetJson,
  safeSetJson,
} from "../../../lib/cache/redis";
import { createTRPCRouter, protectedProcedure } from "../trpc";

const pageInput = z.object({
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(50).default(12),
  search: z.string().trim().max(80).optional(),
  typeId: z.string().uuid().optional(),
  spaceId: z.string().uuid().nullable().optional(),
  scope: z.enum(["all", "global", "space"]).default("all"),
  defaultOnly: z.boolean().default(false),
  sort: z.enum(["recent", "name", "balance"]).default("recent"),
});

const sourceIdInput = z.object({
  id: z.string().uuid(),
});

const sourceMutationInput = z.object({
  name: z.string().trim().min(1).max(80),
  typeId: z.string().uuid(),
  openingBalance: z.number().min(-1_000_000_000).max(1_000_000_000),
  spaceId: z.string().uuid().nullable().optional(),
  setAsDefault: z.boolean().default(false),
});

type SourceItem = {
  id: string;
  name: string;
  typeId: string;
  typeName: string;
  openingBalance: number;
  currentBalance: number;
  isDefault: boolean;
  userId: string;
  spaceId: string | null;
  spaceName: string | null;
  transactionCount: number;
  createdAt: Date | null;
  updatedAt: Date | null;
};

export const sourcesRouter = createTRPCRouter({
  list: protectedProcedure
    .input(pageInput.optional())
    .query(async ({ ctx, input }) => {
      const params = input ?? pageInput.parse({});
      const cacheKey = redisKeys.sourcesList(ctx.user.id, cacheParams(params));
      const cached = await safeGetJson<Awaited<ReturnType<typeof listSources>>>(
        cacheKey,
      );

      if (cached) {
        return cached;
      }

      const result = await listSources(ctx.user.id, params);
      await safeSetJson(cacheKey, result, redisTtl.short);

      return result;
    }),

  getById: protectedProcedure
    .input(sourceIdInput)
    .query(async ({ ctx, input }) => {
      const source = await getSourceForUser(input.id, ctx.user.id);

      if (!source) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Source was not found.",
        });
      }

      return source;
    }),

  create: protectedProcedure
    .input(sourceMutationInput)
    .mutation(async ({ ctx, input }) => {
      await requireSourceType(input.typeId, ctx.user.id);
      await requireSpaceAccess(input.spaceId ?? null, ctx.user.id);

      const shouldSetDefault = input.setAsDefault || (await sourceCount(ctx.user.id)) === 0;

      const source = await dbPool.transaction(async (tx) => {
        if (shouldSetDefault) {
          await tx
            .update(sourceSchema)
            .set({ isDefault: false, updatedAt: new Date() })
            .where(eq(sourceSchema.userId, ctx.user.id));
        }

        const [created] = await tx
          .insert(sourceSchema)
          .values({
            name: input.name,
            typeId: input.typeId,
            balance: input.openingBalance,
            isDefault: shouldSetDefault,
            userId: ctx.user.id,
            spaceId: input.spaceId ?? null,
          })
          .returning({ id: sourceSchema.id });

        return created;
      });

      await invalidateSourceCaches(ctx.user.id, source.id, [input.spaceId ?? null]);

      const hydrated = await getSourceForUser(source.id, ctx.user.id);
      return hydrated;
    }),

  update: protectedProcedure
    .input(sourceIdInput.extend(sourceMutationInput.omit({ setAsDefault: true }).shape))
    .mutation(async ({ ctx, input }) => {
      const previousSource = await requireSource(input.id, ctx.user.id);
      await requireSourceType(input.typeId, ctx.user.id);
      await requireSpaceAccess(input.spaceId ?? null, ctx.user.id);

      await db
        .update(sourceSchema)
        .set({
          name: input.name,
          typeId: input.typeId,
          balance: input.openingBalance,
          spaceId: input.spaceId ?? null,
          updatedAt: new Date(),
        })
        .where(eq(sourceSchema.id, input.id));

      await invalidateSourceCaches(ctx.user.id, input.id, [
        previousSource.spaceId,
        input.spaceId ?? null,
      ]);

      return getSourceForUser(input.id, ctx.user.id);
    }),

  remove: protectedProcedure
    .input(sourceIdInput)
    .mutation(async ({ ctx, input }) => {
      const source = await requireSource(input.id, ctx.user.id);
      const transactions = await getTransactionCount(input.id);

      if (transactions > 0) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Sources with transactions cannot be removed yet.",
        });
      }

      const totalSources = await sourceCount(ctx.user.id);

      if (totalSources <= 1) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Create another source before removing this one.",
        });
      }

      await db.delete(sourceSchema).where(eq(sourceSchema.id, input.id));

      if (source.isDefault) {
        await setFirstAvailableDefault(ctx.user.id, input.id);
      }

      await invalidateSourceCaches(ctx.user.id, input.id, [source.spaceId]);

      return { success: true };
    }),

  setDefault: protectedProcedure
    .input(sourceIdInput)
    .mutation(async ({ ctx, input }) => {
      await requireSource(input.id, ctx.user.id);
      const currentDefaults = await db
        .select({ id: sourceSchema.id })
        .from(sourceSchema)
        .where(and(eq(sourceSchema.userId, ctx.user.id), eq(sourceSchema.isDefault, true)));

      await dbPool.transaction(async (tx) => {
        await tx
          .update(sourceSchema)
          .set({ isDefault: false, updatedAt: new Date() })
          .where(eq(sourceSchema.userId, ctx.user.id));
        await tx
          .update(sourceSchema)
          .set({ isDefault: true, updatedAt: new Date() })
          .where(eq(sourceSchema.id, input.id));
      });

      await invalidateSourceCaches(ctx.user.id, input.id);
      await safeDelByKeys(
        currentDefaults
          .map((source) => source.id)
          .filter((sourceId) => sourceId !== input.id)
          .map(redisKeys.sourcesDetail),
      );

      return { success: true, defaultSourceId: input.id };
    }),
});

async function listSources(userId: string, params: z.infer<typeof pageInput>) {
  const rows = await db
    .select({
      id: sourceSchema.id,
      name: sourceSchema.name,
      typeId: sourceSchema.typeId,
      typeName: sourceTypeSchema.name,
      openingBalance: sourceSchema.balance,
      isDefault: sourceSchema.isDefault,
      userId: sourceSchema.userId,
      spaceId: sourceSchema.spaceId,
      spaceName: spaceSchema.name,
      createdAt: sourceSchema.createdAt,
      updatedAt: sourceSchema.updatedAt,
    })
    .from(sourceSchema)
    .innerJoin(sourceTypeSchema, eq(sourceSchema.typeId, sourceTypeSchema.id))
    .leftJoin(spaceSchema, eq(sourceSchema.spaceId, spaceSchema.id))
    .where(eq(sourceSchema.userId, userId));

  const hydrated = await Promise.all(rows.map(hydrateSourceRow));
  const search = params.search?.toLowerCase() ?? "";
  const filtered = hydrated
    .filter((source) => {
      if (!search) return true;
      return (
        source.name.toLowerCase().includes(search) ||
        source.typeName.toLowerCase().includes(search)
      );
    })
    .filter((source) => {
      if (params.typeId && source.typeId !== params.typeId) return false;
      if (params.defaultOnly && !source.isDefault) return false;
      if (params.scope === "global" && source.spaceId !== null) return false;
      if (params.scope === "space" && source.spaceId === null) return false;
      if (params.spaceId !== undefined && source.spaceId !== params.spaceId) {
        return false;
      }
      return true;
    })
    .sort((a, b) => compareSources(a, b, params.sort));

  const total = filtered.length;
  const pageCount = Math.max(1, Math.ceil(total / params.pageSize));
  const page = Math.min(params.page, pageCount);
  const start = (page - 1) * params.pageSize;
  const items = filtered.slice(start, start + params.pageSize);

  return {
    items,
    page,
    pageSize: params.pageSize,
    total,
    pageCount,
    summary: {
      totalSources: hydrated.length,
      defaultSource: hydrated.find((source) => source.isDefault)?.name ?? null,
      totalOpeningBalance: roundMoney(
        hydrated.reduce((sum, source) => sum + source.openingBalance, 0),
      ),
      totalCurrentBalance: roundMoney(
        hydrated.reduce((sum, source) => sum + source.currentBalance, 0),
      ),
      globalSources: hydrated.filter((source) => source.spaceId === null).length,
      spaceLinkedSources: hydrated.filter((source) => source.spaceId !== null).length,
      sourceTypeCount: new Set(hydrated.map((source) => source.typeId)).size,
    },
  };
}

async function getSourceForUser(id: string, userId: string) {
  const cacheKey = redisKeys.sourcesDetail(id);
  const cached = await safeGetJson<SourceItem>(cacheKey);

  if (cached && cached.userId === userId) {
    return cached;
  }

  const [source] = await db
    .select({
      id: sourceSchema.id,
      name: sourceSchema.name,
      typeId: sourceSchema.typeId,
      typeName: sourceTypeSchema.name,
      openingBalance: sourceSchema.balance,
      isDefault: sourceSchema.isDefault,
      userId: sourceSchema.userId,
      spaceId: sourceSchema.spaceId,
      spaceName: spaceSchema.name,
      createdAt: sourceSchema.createdAt,
      updatedAt: sourceSchema.updatedAt,
    })
    .from(sourceSchema)
    .innerJoin(sourceTypeSchema, eq(sourceSchema.typeId, sourceTypeSchema.id))
    .leftJoin(spaceSchema, eq(sourceSchema.spaceId, spaceSchema.id))
    .where(and(eq(sourceSchema.id, id), eq(sourceSchema.userId, userId)))
    .limit(1);

  if (!source) {
    return null;
  }

  const hydrated = await hydrateSourceRow(source);
  await safeSetJson(cacheKey, hydrated, redisTtl.medium);

  return hydrated;
}

async function hydrateSourceRow(row: {
  id: string;
  name: string;
  typeId: string;
  typeName: string;
  openingBalance: number;
  isDefault: boolean;
  userId: string;
  spaceId: string | null;
  spaceName: string | null;
  createdAt: Date | null;
  updatedAt: Date | null;
}): Promise<SourceItem> {
  const [totals] = await db
    .select({
      creditTotal: sql<number>`coalesce(sum(case when ${transactionSchema.type} = 'credit' then ${transactionSchema.amount} else 0 end), 0)`,
      debitTotal: sql<number>`coalesce(sum(case when ${transactionSchema.type} = 'debit' then ${transactionSchema.amount} else 0 end), 0)`,
      transactionCount: count(),
    })
    .from(transactionSchema)
    .where(eq(transactionSchema.sourceId, row.id));
  const currentBalance =
    Number(row.openingBalance) +
    Number(totals?.creditTotal ?? 0) -
    Number(totals?.debitTotal ?? 0);

  return {
    ...row,
    openingBalance: Number(row.openingBalance),
    currentBalance: roundMoney(currentBalance),
    isDefault: row.isDefault === true,
    transactionCount: Number(totals?.transactionCount ?? 0),
  };
}

async function requireSource(id: string, userId: string) {
  const source = await getSourceForUser(id, userId);

  if (!source) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Source was not found.",
    });
  }

  return source;
}

async function requireSourceType(id: string, userId: string) {
  const [sourceType] = await db
    .select({ id: sourceTypeSchema.id })
    .from(sourceTypeSchema)
    .where(and(eq(sourceTypeSchema.id, id), eq(sourceTypeSchema.userId, userId)))
    .limit(1);

  if (!sourceType) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Source type was not found.",
    });
  }
}

async function requireSpaceAccess(spaceId: string | null, userId: string) {
  if (!spaceId) return;

  const [membership] = await db
    .select({ spaceId: userSpaceSchema.spaceId })
    .from(userSpaceSchema)
    .where(and(eq(userSpaceSchema.spaceId, spaceId), eq(userSpaceSchema.userId, userId)))
    .limit(1);

  if (!membership) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "You cannot link a source to that space.",
    });
  }
}

async function sourceCount(userId: string) {
  const [result] = await db
    .select({ count: count() })
    .from(sourceSchema)
    .where(eq(sourceSchema.userId, userId));

  return Number(result?.count ?? 0);
}

async function getTransactionCount(sourceId: string) {
  const [result] = await db
    .select({ count: count() })
    .from(transactionSchema)
    .where(eq(transactionSchema.sourceId, sourceId));

  return Number(result?.count ?? 0);
}

async function setFirstAvailableDefault(userId: string, excludedSourceId: string) {
  const [fallback] = await db
    .select({ id: sourceSchema.id })
    .from(sourceSchema)
    .where(eq(sourceSchema.userId, userId));

  if (!fallback || fallback.id === excludedSourceId) {
    return;
  }

  await db
    .update(sourceSchema)
    .set({ isDefault: true, updatedAt: new Date() })
    .where(eq(sourceSchema.id, fallback.id));
}

async function invalidateSourceCaches(
  userId: string,
  sourceId: string,
  spaceIds: Array<string | null> = [],
) {
  await safeDelByKeys([
    redisKeys.accountMe(userId),
    redisKeys.sourcesList(userId, "default"),
    redisKeys.sourcesDetail(sourceId),
    redisKeys.sourcesBalance(sourceId),
  ]);

  await safeDel(redisKeys.spacesList(userId, "default"));
  await Promise.all(
    [...new Set(spaceIds.filter((spaceId): spaceId is string => Boolean(spaceId)))]
      .flatMap((spaceId) => [
        safeDel(redisKeys.spacesDetail(spaceId)),
        safeDel(redisKeys.dashboardOverview(userId, spaceId, "default")),
      ]),
  );
}

function compareSources(
  a: SourceItem,
  b: SourceItem,
  sort: z.infer<typeof pageInput>["sort"],
) {
  if (sort === "name") return a.name.localeCompare(b.name);
  if (sort === "balance") return b.currentBalance - a.currentBalance;

  const aDate = a.updatedAt ?? a.createdAt;
  const bDate = b.updatedAt ?? b.createdAt;
  return (bDate?.getTime() ?? 0) - (aDate?.getTime() ?? 0);
}

function cacheParams(params: z.infer<typeof pageInput>) {
  if (
    params.page === 1 &&
    params.pageSize === 12 &&
    params.scope === "all" &&
    params.sort === "recent" &&
    !params.search &&
    !params.typeId &&
    params.spaceId === undefined &&
    !params.defaultOnly
  ) {
    return "default";
  }

  return encodeURIComponent(JSON.stringify(params));
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
