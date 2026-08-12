import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { db, dbPool } from "../../../db";
import {
  labelSchema,
  transactionLabelTableSchema,
} from "../../../db/schema";
import {
  redisKeys,
  redisTtl,
  safeDel,
  safeGetJson,
  safeSetJson,
} from "../../../lib/cache/redis";
import { createTRPCRouter, protectedProcedure } from "../trpc";

const labelIdInput = z.object({
  id: z.string().uuid(),
});

const labelMutationInput = z.object({
  name: z.string().trim().min(1).max(60),
});

export const labelsRouter = createTRPCRouter({
  list: protectedProcedure.query(async ({ ctx }) => {
    const cacheKey = redisKeys.labelsList(ctx.user.id);
    const cached = await safeGetJson<Awaited<ReturnType<typeof listLabels>>>(
      cacheKey,
    );

    if (cached) {
      return cached;
    }

    const result = await listLabels(ctx.user.id);
    await safeSetJson(cacheKey, result, redisTtl.medium);

    return result;
  }),

  create: protectedProcedure
    .input(labelMutationInput)
    .mutation(async ({ ctx, input }) => {
      const [label] = await db
        .insert(labelSchema)
        .values({
          name: input.name,
          userId: ctx.user.id,
        })
        .returning({
          id: labelSchema.id,
          name: labelSchema.name,
          createdAt: labelSchema.createdAt,
          updatedAt: labelSchema.updatedAt,
        });

      await invalidateLabelCaches(ctx.user.id);

      return label;
    }),

  update: protectedProcedure
    .input(labelIdInput.extend(labelMutationInput.shape))
    .mutation(async ({ ctx, input }) => {
      await requireLabelOwner(input.id, ctx.user.id);

      const [label] = await db
        .update(labelSchema)
        .set({ name: input.name, updatedAt: new Date() })
        .where(eq(labelSchema.id, input.id))
        .returning({
          id: labelSchema.id,
          name: labelSchema.name,
          createdAt: labelSchema.createdAt,
          updatedAt: labelSchema.updatedAt,
        });

      await invalidateLabelCaches(ctx.user.id);

      return label;
    }),

  remove: protectedProcedure
    .input(labelIdInput)
    .mutation(async ({ ctx, input }) => {
      await requireLabelOwner(input.id, ctx.user.id);

      await dbPool.transaction(async (tx) => {
        await tx
          .delete(transactionLabelTableSchema)
          .where(eq(transactionLabelTableSchema.labelId, input.id));
        await tx.delete(labelSchema).where(eq(labelSchema.id, input.id));
      });

      await invalidateLabelCaches(ctx.user.id);

      return { success: true };
    }),
});

async function listLabels(userId: string) {
  const rows = await db
    .select({
      id: labelSchema.id,
      name: labelSchema.name,
      createdAt: labelSchema.createdAt,
      updatedAt: labelSchema.updatedAt,
    })
    .from(labelSchema)
    .where(eq(labelSchema.userId, userId));

  return rows.sort((a, b) => a.name.localeCompare(b.name));
}

async function requireLabelOwner(id: string, userId: string) {
  const [label] = await db
    .select({ id: labelSchema.id })
    .from(labelSchema)
    .where(and(eq(labelSchema.id, id), eq(labelSchema.userId, userId)))
    .limit(1);

  if (!label) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Label was not found.",
    });
  }
}

async function invalidateLabelCaches(userId: string) {
  await safeDel(redisKeys.labelsList(userId));
  await safeDel(redisKeys.transactionsList(userId, "default"));
  await safeDel(redisKeys.transactionsSummary(userId, "default"));
}
