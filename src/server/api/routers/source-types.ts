import { TRPCError } from "@trpc/server";
import { and, count, eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "../../../db";
import { sourceSchema, sourceTypeSchema } from "../../../db/schema";
import {
  redisKeys,
  redisTtl,
  safeDel,
  safeGetJson,
  safeSetJson,
} from "../../../lib/cache/redis";
import { createTRPCRouter, protectedProcedure } from "../trpc";

const sourceTypeIdInput = z.object({
  id: z.string().uuid(),
});

const sourceTypeMutationInput = z.object({
  name: z.string().trim().min(1).max(80),
});

export const sourceTypesRouter = createTRPCRouter({
  list: protectedProcedure.query(async ({ ctx }) => {
    const cacheKey = redisKeys.sourceTypesList(ctx.user.id);
    const cached = await safeGetJson<Awaited<ReturnType<typeof listSourceTypes>>>(
      cacheKey,
    );

    if (cached) {
      return cached;
    }

    const result = await listSourceTypes(ctx.user.id);
    await safeSetJson(cacheKey, result, redisTtl.medium);

    return result;
  }),

  create: protectedProcedure
    .input(sourceTypeMutationInput)
    .mutation(async ({ ctx, input }) => {
      const [sourceType] = await db
        .insert(sourceTypeSchema)
        .values({
          name: input.name,
          userId: ctx.user.id,
        })
        .returning({
          id: sourceTypeSchema.id,
          name: sourceTypeSchema.name,
          createdAt: sourceTypeSchema.createdAt,
          updatedAt: sourceTypeSchema.updatedAt,
        });

      await invalidateSourceTypeCaches(ctx.user.id);

      return sourceType;
    }),

  update: protectedProcedure
    .input(sourceTypeIdInput.extend(sourceTypeMutationInput.shape))
    .mutation(async ({ ctx, input }) => {
      await requireSourceTypeOwner(input.id, ctx.user.id);

      const [sourceType] = await db
        .update(sourceTypeSchema)
        .set({ name: input.name, updatedAt: new Date() })
        .where(eq(sourceTypeSchema.id, input.id))
        .returning({
          id: sourceTypeSchema.id,
          name: sourceTypeSchema.name,
          createdAt: sourceTypeSchema.createdAt,
          updatedAt: sourceTypeSchema.updatedAt,
        });

      await invalidateSourceTypeCaches(ctx.user.id);

      return sourceType;
    }),

  remove: protectedProcedure
    .input(sourceTypeIdInput)
    .mutation(async ({ ctx, input }) => {
      await requireSourceTypeOwner(input.id, ctx.user.id);

      const [usage] = await db
        .select({ count: count() })
        .from(sourceSchema)
        .where(eq(sourceSchema.typeId, input.id));

      if (Number(usage?.count ?? 0) > 0) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Source types in use cannot be removed.",
        });
      }

      await db.delete(sourceTypeSchema).where(eq(sourceTypeSchema.id, input.id));
      await invalidateSourceTypeCaches(ctx.user.id);

      return { success: true };
    }),
});

async function listSourceTypes(userId: string) {
  const rows = await db
    .select({
      id: sourceTypeSchema.id,
      name: sourceTypeSchema.name,
      createdAt: sourceTypeSchema.createdAt,
      updatedAt: sourceTypeSchema.updatedAt,
    })
    .from(sourceTypeSchema)
    .where(eq(sourceTypeSchema.userId, userId));

  return rows.sort((a, b) => a.name.localeCompare(b.name));
}

async function requireSourceTypeOwner(id: string, userId: string) {
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

async function invalidateSourceTypeCaches(userId: string) {
  await safeDel(redisKeys.sourceTypesList(userId));
  await safeDel(redisKeys.sourcesList(userId, "default"));
}
