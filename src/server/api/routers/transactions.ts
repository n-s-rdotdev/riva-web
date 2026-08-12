import { TRPCError } from "@trpc/server";
import { and, count, eq, inArray } from "drizzle-orm";
import { z } from "zod";

import { db, dbPool } from "../../../db";
import {
  labelSchema,
  sourceSchema,
  sourceTypeSchema,
  spaceSchema,
  transactionLabelTableSchema,
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
import { createNotification } from "../../notifications/create";
import { createTRPCRouter, protectedProcedure } from "../trpc";

const transactionType = z.enum(["debit", "credit"]);
const transactionSort = z.enum(["recent", "date", "amount"]);

const transactionFiltersInput = z.object({
  search: z.string().trim().max(120).optional(),
  spaceId: z.string().uuid().optional(),
  sourceId: z.string().uuid().optional(),
  type: transactionType.optional(),
  isAnExpense: z.boolean().optional(),
  labelIds: z.array(z.string().uuid()).max(12).default([]),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  sort: transactionSort.default("recent"),
});

const pageInput = transactionFiltersInput.extend({
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(50).default(20),
});

const transactionIdInput = z.object({
  id: z.string().uuid(),
});

const transactionMutationInput = z.object({
  description: z.string().trim().min(1).max(180),
  amount: z.number().positive().max(1_000_000_000),
  type: transactionType,
  date: z.string(),
  isAnExpense: z.boolean().default(false),
  sourceId: z.string().uuid(),
  spaceId: z.string().uuid(),
  labelIds: z.array(z.string().uuid()).max(12).default([]),
});

type TransactionLabel = {
  id: string;
  name: string;
};

type TransactionItem = {
  id: string;
  description: string;
  amount: number;
  type: "debit" | "credit";
  date: Date;
  isAnExpense: boolean;
  userId: string;
  sourceId: string;
  sourceName: string;
  sourceTypeId: string;
  sourceTypeName: string;
  spaceId: string;
  spaceName: string;
  labels: TransactionLabel[];
  createdAt: Date | null;
  updatedAt: Date | null;
};

export const transactionsRouter = createTRPCRouter({
  list: protectedProcedure
    .input(pageInput.optional())
    .query(async ({ ctx, input }) => {
      const params = input ?? pageInput.parse({});
      const cacheKey = redisKeys.transactionsList(ctx.user.id, cacheParams(params));
      const cached = await safeGetJson<Awaited<ReturnType<typeof listTransactions>>>(
        cacheKey,
      );

      if (cached) {
        return cached;
      }

      const result = await listTransactions(ctx.user.id, params);
      await safeSetJson(cacheKey, result, redisTtl.short);

      return result;
    }),

  getById: protectedProcedure
    .input(transactionIdInput)
    .query(async ({ ctx, input }) => {
      const transaction = await getTransactionForUser(input.id, ctx.user.id);

      if (!transaction) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Transaction was not found.",
        });
      }

      return transaction;
    }),

  create: protectedProcedure
    .input(transactionMutationInput)
    .mutation(async ({ ctx, input }) => {
      const date = parseMutationDate(input.date);
      const labelIds = uniqueIds(input.labelIds);

      await requireSpaceAccess(input.spaceId, ctx.user.id);
      await requireSourceForSpace(input.sourceId, input.spaceId, ctx.user.id);
      await requireLabels(labelIds, ctx.user.id);

      const result = await dbPool.transaction(async (tx) => {
        const [transaction] = await tx
          .insert(transactionSchema)
          .values({
            description: input.description,
            amount: input.amount,
            type: input.type,
            date,
            isAnExpense: input.isAnExpense,
            sourceId: input.sourceId,
            spaceId: input.spaceId,
            userId: ctx.user.id,
          })
          .returning({ id: transactionSchema.id });

        if (labelIds.length > 0) {
          await tx.insert(transactionLabelTableSchema).values(
            labelIds.map((labelId) => ({
              transactionId: transaction.id,
              labelId,
            })),
          );
        }

        return transaction;
      });

      await invalidateTransactionCaches(ctx.user.id, result.id, {
        sourceIds: [input.sourceId],
        spaceIds: [input.spaceId],
      });

      // First-transaction milestone. No financial content is included.
      const [transactionCount] = await db
        .select({ value: count() })
        .from(transactionSchema)
        .where(eq(transactionSchema.userId, ctx.user.id));

      if (transactionCount?.value === 1) {
        await createNotification({
          userId: ctx.user.id,
          type: "transaction_milestone",
          title: "First transaction logged",
          body: "Nice start. Keep logging to see your dashboard come to life.",
        });
      }

      return getTransactionForUser(result.id, ctx.user.id);
    }),

  update: protectedProcedure
    .input(transactionIdInput.extend(transactionMutationInput.shape))
    .mutation(async ({ ctx, input }) => {
      const previous = await requireTransaction(input.id, ctx.user.id);
      const date = parseMutationDate(input.date);
      const labelIds = uniqueIds(input.labelIds);

      await requireSpaceAccess(input.spaceId, ctx.user.id);
      await requireSourceForSpace(input.sourceId, input.spaceId, ctx.user.id);
      await requireLabels(labelIds, ctx.user.id);

      await dbPool.transaction(async (tx) => {
        await tx
          .update(transactionSchema)
          .set({
            description: input.description,
            amount: input.amount,
            type: input.type,
            date,
            isAnExpense: input.isAnExpense,
            sourceId: input.sourceId,
            spaceId: input.spaceId,
            updatedAt: new Date(),
          })
          .where(eq(transactionSchema.id, input.id));

        await tx
          .delete(transactionLabelTableSchema)
          .where(eq(transactionLabelTableSchema.transactionId, input.id));

        if (labelIds.length > 0) {
          await tx.insert(transactionLabelTableSchema).values(
            labelIds.map((labelId) => ({
              transactionId: input.id,
              labelId,
            })),
          );
        }
      });

      await invalidateTransactionCaches(ctx.user.id, input.id, {
        sourceIds: [previous.sourceId, input.sourceId],
        spaceIds: [previous.spaceId, input.spaceId],
      });

      return getTransactionForUser(input.id, ctx.user.id);
    }),

  remove: protectedProcedure
    .input(transactionIdInput)
    .mutation(async ({ ctx, input }) => {
      const transaction = await requireTransaction(input.id, ctx.user.id);

      await dbPool.transaction(async (tx) => {
        await tx
          .delete(transactionLabelTableSchema)
          .where(eq(transactionLabelTableSchema.transactionId, input.id));
        await tx.delete(transactionSchema).where(eq(transactionSchema.id, input.id));
      });

      await invalidateTransactionCaches(ctx.user.id, input.id, {
        sourceIds: [transaction.sourceId],
        spaceIds: [transaction.spaceId],
      });

      return { success: true };
    }),

  summary: protectedProcedure
    .input(transactionFiltersInput.optional())
    .query(async ({ ctx, input }) => {
      const params = input ?? transactionFiltersInput.parse({});
      const cacheKey = redisKeys.transactionsSummary(ctx.user.id, cacheParams(params));
      const cached = await safeGetJson<Awaited<ReturnType<typeof summarizeTransactions>>>(
        cacheKey,
      );

      if (cached) {
        return cached;
      }

      const result = await summarizeTransactions(ctx.user.id, params);
      await safeSetJson(cacheKey, result, redisTtl.short);

      return result;
    }),
});

async function listTransactions(userId: string, params: z.infer<typeof pageInput>) {
  const filtered = await filteredTransactions(userId, params);
  const total = filtered.length;
  const pageCount = Math.max(1, Math.ceil(total / params.pageSize));
  const page = Math.min(params.page, pageCount);
  const start = (page - 1) * params.pageSize;

  return {
    items: filtered.slice(start, start + params.pageSize),
    page,
    pageSize: params.pageSize,
    total,
    pageCount,
    summary: summarizeItems(filtered),
  };
}

async function summarizeTransactions(
  userId: string,
  params: z.infer<typeof transactionFiltersInput>,
) {
  const filtered = await filteredTransactions(userId, params);

  return summarizeItems(filtered);
}

async function filteredTransactions(
  userId: string,
  params: z.infer<typeof transactionFiltersInput>,
) {
  const rows = await baseTransactionRows(userId);
  const labelsByTransaction = await getLabelsByTransaction(rows.map((row) => row.id));
  const from = params.dateFrom ? parseFilterDate(params.dateFrom, "start") : null;
  const to = params.dateTo ? parseFilterDate(params.dateTo, "end") : null;
  const search = params.search?.toLowerCase() ?? "";
  const labelIds = uniqueIds(params.labelIds ?? []);

  return rows
    .map((row) => hydrateTransactionRow(row, labelsByTransaction.get(row.id) ?? []))
    .filter((transaction) => {
      if (search && !transaction.description.toLowerCase().includes(search)) {
        return false;
      }
      if (params.spaceId && transaction.spaceId !== params.spaceId) return false;
      if (params.sourceId && transaction.sourceId !== params.sourceId) return false;
      if (params.type && transaction.type !== params.type) return false;
      if (
        params.isAnExpense !== undefined &&
        transaction.isAnExpense !== params.isAnExpense
      ) {
        return false;
      }
      if (from && transaction.date < from) return false;
      if (to && transaction.date > to) return false;
      if (
        labelIds.length > 0 &&
        !labelIds.every((labelId) =>
          transaction.labels.some((label) => label.id === labelId),
        )
      ) {
        return false;
      }

      return true;
    })
    .sort((a, b) => compareTransactions(a, b, params.sort));
}

async function getTransactionForUser(id: string, userId: string) {
  const cacheKey = redisKeys.transactionsDetail(id);
  const cached = await safeGetJson<TransactionItem>(cacheKey);

  if (cached && cached.userId === userId) {
    return cached;
  }

  const rows = await baseTransactionRows(userId, id);

  if (!rows[0]) {
    return null;
  }

  const labelsByTransaction = await getLabelsByTransaction([id]);
  const transaction = hydrateTransactionRow(
    rows[0],
    labelsByTransaction.get(id) ?? [],
  );
  await safeSetJson(cacheKey, transaction, redisTtl.medium);

  return transaction;
}

async function baseTransactionRows(userId: string, transactionId?: string) {
  const rows = await db
    .select({
      id: transactionSchema.id,
      description: transactionSchema.description,
      amount: transactionSchema.amount,
      type: transactionSchema.type,
      date: transactionSchema.date,
      isAnExpense: transactionSchema.isAnExpense,
      userId: transactionSchema.userId,
      sourceId: transactionSchema.sourceId,
      sourceName: sourceSchema.name,
      sourceTypeId: sourceTypeSchema.id,
      sourceTypeName: sourceTypeSchema.name,
      spaceId: transactionSchema.spaceId,
      spaceName: spaceSchema.name,
      createdAt: transactionSchema.createdAt,
      updatedAt: transactionSchema.updatedAt,
    })
    .from(transactionSchema)
    .innerJoin(sourceSchema, eq(transactionSchema.sourceId, sourceSchema.id))
    .innerJoin(sourceTypeSchema, eq(sourceSchema.typeId, sourceTypeSchema.id))
    .innerJoin(spaceSchema, eq(transactionSchema.spaceId, spaceSchema.id))
    .where(
      transactionId
        ? and(
            eq(transactionSchema.userId, userId),
            eq(transactionSchema.id, transactionId),
          )
        : eq(transactionSchema.userId, userId),
    );

  return rows;
}

async function getLabelsByTransaction(transactionIds: string[]) {
  const labelsByTransaction = new Map<string, TransactionLabel[]>();

  if (transactionIds.length === 0) {
    return labelsByTransaction;
  }

  const rows = await db
    .select({
      transactionId: transactionLabelTableSchema.transactionId,
      id: labelSchema.id,
      name: labelSchema.name,
    })
    .from(transactionLabelTableSchema)
    .innerJoin(labelSchema, eq(transactionLabelTableSchema.labelId, labelSchema.id))
    .where(inArray(transactionLabelTableSchema.transactionId, transactionIds));

  for (const row of rows) {
    const labels = labelsByTransaction.get(row.transactionId) ?? [];
    labels.push({ id: row.id, name: row.name });
    labelsByTransaction.set(row.transactionId, labels);
  }

  return labelsByTransaction;
}

function hydrateTransactionRow(
  row: Awaited<ReturnType<typeof baseTransactionRows>>[number],
  labels: TransactionLabel[],
): TransactionItem {
  return {
    ...row,
    amount: Number(row.amount),
    isAnExpense: row.isAnExpense === true,
    labels: labels.sort((a, b) => a.name.localeCompare(b.name)),
  };
}

async function requireTransaction(id: string, userId: string) {
  const transaction = await getTransactionForUser(id, userId);

  if (!transaction) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Transaction was not found.",
    });
  }

  return transaction;
}

async function requireSpaceAccess(spaceId: string, userId: string) {
  const [membership] = await db
    .select({ spaceId: userSpaceSchema.spaceId })
    .from(userSpaceSchema)
    .where(and(eq(userSpaceSchema.spaceId, spaceId), eq(userSpaceSchema.userId, userId)))
    .limit(1);

  if (!membership) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "You cannot record a transaction in that space.",
    });
  }
}

async function requireSourceForSpace(
  sourceId: string,
  spaceId: string,
  userId: string,
) {
  const [source] = await db
    .select({ id: sourceSchema.id, spaceId: sourceSchema.spaceId })
    .from(sourceSchema)
    .where(and(eq(sourceSchema.id, sourceId), eq(sourceSchema.userId, userId)))
    .limit(1);

  if (!source) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Source was not found.",
    });
  }

  if (source.spaceId && source.spaceId !== spaceId) {
    throw new TRPCError({
      code: "CONFLICT",
      message: "That source is linked to a different space.",
    });
  }
}

async function requireLabels(labelIds: string[], userId: string) {
  if (labelIds.length === 0) return;

  const rows = await db
    .select({ id: labelSchema.id })
    .from(labelSchema)
    .where(and(eq(labelSchema.userId, userId), inArray(labelSchema.id, labelIds)));

  if (rows.length !== labelIds.length) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "One or more labels are not available.",
    });
  }
}

async function invalidateTransactionCaches(
  userId: string,
  transactionId: string,
  affected: { sourceIds: string[]; spaceIds: string[] },
) {
  const sourceIds = uniqueIds(affected.sourceIds);
  const spaceIds = uniqueIds(affected.spaceIds);

  await safeDelByKeys([
    redisKeys.accountMe(userId),
    redisKeys.transactionsList(userId, "default"),
    redisKeys.transactionsDetail(transactionId),
    redisKeys.transactionsSummary(userId, "default"),
    redisKeys.sourcesList(userId, "default"),
    ...sourceIds.flatMap((sourceId) => [
      redisKeys.sourcesDetail(sourceId),
      redisKeys.sourcesBalance(sourceId),
    ]),
    ...spaceIds.map((spaceId) =>
      redisKeys.dashboardOverview(userId, spaceId, "default"),
    ),
  ]);

  for (const spaceId of spaceIds) {
    await safeDel(redisKeys.spacesDetail(spaceId));
  }
}

function summarizeItems(items: TransactionItem[]) {
  const creditItems = items.filter((item) => item.type === "credit");
  const debitItems = items.filter((item) => item.type === "debit");
  const credits = roundMoney(creditItems.reduce((sum, item) => sum + item.amount, 0));
  const debits = roundMoney(debitItems.reduce((sum, item) => sum + item.amount, 0));

  return {
    transactionCount: items.length,
    creditCount: creditItems.length,
    debitCount: debitItems.length,
    expenseCount: items.filter((item) => item.isAnExpense).length,
    credits,
    debits,
    net: roundMoney(credits - debits),
  };
}

function compareTransactions(
  a: TransactionItem,
  b: TransactionItem,
  sort: z.infer<typeof transactionSort>,
) {
  if (sort === "amount") return b.amount - a.amount;

  return b.date.getTime() - a.date.getTime();
}

function parseMutationDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Transaction date is invalid.",
    });
  }

  return date;
}

function parseFilterDate(value: string, boundary: "start" | "end") {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  if (boundary === "start") {
    date.setHours(0, 0, 0, 0);
  } else {
    date.setHours(23, 59, 59, 999);
  }

  return date;
}

function uniqueIds(ids: string[]) {
  return [...new Set(ids.filter(Boolean))];
}

function cacheParams(params: Record<string, unknown>) {
  const normalized: Record<string, unknown> & { labelIds: unknown[] } = {
    ...params,
    labelIds: Array.isArray(params.labelIds) ? [...params.labelIds].sort() : [],
  };

  if (
    normalized.page === undefined &&
    normalized.pageSize === undefined &&
    normalized.search === undefined &&
    normalized.spaceId === undefined &&
    normalized.sourceId === undefined &&
    normalized.type === undefined &&
    normalized.isAnExpense === undefined &&
    normalized.dateFrom === undefined &&
    normalized.dateTo === undefined &&
    normalized.sort === "recent" &&
    Array.isArray(normalized.labelIds) &&
    normalized.labelIds.length === 0
  ) {
    return "default";
  }

  if (
    normalized.page === 1 &&
    normalized.pageSize === 20 &&
    normalized.search === undefined &&
    normalized.spaceId === undefined &&
    normalized.sourceId === undefined &&
    normalized.type === undefined &&
    normalized.isAnExpense === undefined &&
    normalized.dateFrom === undefined &&
    normalized.dateTo === undefined &&
    normalized.sort === "recent" &&
    Array.isArray(normalized.labelIds) &&
    normalized.labelIds.length === 0
  ) {
    return "default";
  }

  return encodeURIComponent(JSON.stringify(normalized));
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
