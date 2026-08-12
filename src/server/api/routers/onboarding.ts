import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { db, dbPool } from "../../../db";
import {
  labelSchema,
  sourceSchema,
  sourceTypeSchema,
  spaceSchema,
  userSchema,
  userSpaceSchema,
} from "../../../db/schema";
import { redisKeys, safeDel } from "../../../lib/cache/redis";
import { createNotification } from "../../notifications/create";
import { createTRPCRouter, protectedProcedure } from "../trpc";

const defaultSourceTypeNames = [
  "Bank Account",
  "Credit Card",
  "Debit Card",
  "Cash",
  "UPI Wallet",
  "Digital Wallet",
  "Investment Account",
] as const;

const defaultLabelNames = [
  "Needs",
  "Wants",
  "Savings",
  "Investment",
  "Misc",
  "Food",
  "Rent",
  "Utilities",
  "Medical",
  "Entertainment",
] as const;

const onboardingCompleteInput = z.object({
  spaceName: z.string().trim().min(1).max(80),
  sourceName: z.string().trim().min(1).max(80),
  sourceTypeName: z.string().trim().min(1).max(80),
  sourceTypes: z.array(z.string().trim().min(1).max(80)).min(1).max(12),
  openingBalance: z.number().min(-1_000_000_000).max(1_000_000_000),
});

export const onboardingRouter = createTRPCRouter({
  getStatus: protectedProcedure.query(async ({ ctx }) => {
    const [user] = await db
      .select({ onboarded: userSchema.onboarded })
      .from(userSchema)
      .where(eq(userSchema.id, ctx.user.id))
      .limit(1);
    const setupState = await getSetupState(ctx.user.id);
    const isOnboarded = user?.onboarded === true;

    return {
      status: isOnboarded ? "complete" : "pending",
      isOnboarded,
      defaults: {
        sourceTypes: [...defaultSourceTypeNames],
        labels: [...defaultLabelNames],
      },
      ...setupState,
      missing: {
        space: !setupState.defaultSpaceId,
        source: !setupState.defaultSourceId,
        sourceTypes: setupState.sourceTypeCount === 0,
        labels: setupState.labelCount === 0,
      },
    };
  }),

  complete: protectedProcedure
    .input(onboardingCompleteInput)
    .mutation(async ({ ctx, input }) => {
      const [user] = await db
        .select({ onboarded: userSchema.onboarded })
        .from(userSchema)
        .where(eq(userSchema.id, ctx.user.id))
        .limit(1);

      if (user?.onboarded) {
        const setupState = await getSetupState(ctx.user.id);

        return {
          status: "complete" as const,
          completedNow: false,
          ...setupState,
        };
      }

      const sourceTypeNames = uniqueTrimmed([
        ...input.sourceTypes,
        input.sourceTypeName,
      ]);
      const selectedSourceTypeName =
        sourceTypeNames.find((name) => name === input.sourceTypeName.trim()) ??
        sourceTypeNames[0];

      const result = await dbPool.transaction(async (tx) => {
        const [space] = await tx
          .insert(spaceSchema)
          .values({
            name: input.spaceName,
            ownerId: ctx.user.id,
          })
          .returning({ id: spaceSchema.id });

        await tx.insert(userSpaceSchema).values({
          spaceId: space.id,
          userId: ctx.user.id,
          isDefault: true,
        });

        const sourceTypes = await tx
          .insert(sourceTypeSchema)
          .values(
            sourceTypeNames.map((name) => ({
              name,
              userId: ctx.user.id,
            })),
          )
          .returning({
            id: sourceTypeSchema.id,
            name: sourceTypeSchema.name,
          });

        const selectedSourceType =
          sourceTypes.find((type) => type.name === selectedSourceTypeName) ??
          sourceTypes[0];

        const [source] = await tx
          .insert(sourceSchema)
          .values({
            name: input.sourceName,
            typeId: selectedSourceType.id,
            balance: input.openingBalance,
            isDefault: true,
            userId: ctx.user.id,
            spaceId: space.id,
          })
          .returning({ id: sourceSchema.id });

        await tx.insert(labelSchema).values(
          defaultLabelNames.map((name) => ({
            name,
            userId: ctx.user.id,
          })),
        );

        await tx
          .update(userSchema)
          .set({
            onboarded: true,
            updatedAt: new Date(),
          })
          .where(eq(userSchema.id, ctx.user.id));

        return {
          defaultSpaceId: space.id,
          defaultSourceId: source.id,
        };
      });

      await safeDel(redisKeys.accountMe(ctx.user.id));

      await createNotification({
        userId: ctx.user.id,
        type: "welcome",
        title: "Welcome to Riva",
        body: "Your workspace is ready. Add a transaction to start tracking your money.",
      });

      return {
        status: "complete" as const,
        completedNow: true,
        ...result,
      };
    }),
});

async function getSetupState(userId: string) {
  const [defaultSpace] = await db
    .select({ id: userSpaceSchema.spaceId })
    .from(userSpaceSchema)
    .where(
      and(eq(userSpaceSchema.userId, userId), eq(userSpaceSchema.isDefault, true)),
    )
    .limit(1);

  const [defaultSource] = await db
    .select({ id: sourceSchema.id })
    .from(sourceSchema)
    .where(and(eq(sourceSchema.userId, userId), eq(sourceSchema.isDefault, true)))
    .limit(1);

  const sourceTypes = await db
    .select({ id: sourceTypeSchema.id })
    .from(sourceTypeSchema)
    .where(eq(sourceTypeSchema.userId, userId));

  const labels = await db
    .select({ id: labelSchema.id })
    .from(labelSchema)
    .where(eq(labelSchema.userId, userId));

  return {
    defaultSpaceId: defaultSpace?.id ?? null,
    defaultSourceId: defaultSource?.id ?? null,
    sourceTypeCount: sourceTypes.length,
    labelCount: labels.length,
  };
}

function uniqueTrimmed(values: string[]) {
  const names = values
    .map((value) => value.trim())
    .filter((value) => value.length > 0);

  return [...new Set(names)];
}
