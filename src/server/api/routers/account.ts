import { and, eq } from "drizzle-orm";
import { z } from "zod";

import {
  sessionSchema,
  sourceSchema,
  userSchema,
  userSpaceSchema,
} from "../../../db/schema";
import { db } from "../../../db";
import { redisKeys, safeDel } from "../../../lib/cache/redis";
import { createTRPCRouter, protectedProcedure } from "../trpc";

export const accountRouter = createTRPCRouter({
  me: protectedProcedure.query(async ({ ctx }) => {
    const [user] = await db
      .select({
        name: userSchema.name,
        email: userSchema.email,
        image: userSchema.image,
        onboarded: userSchema.onboarded,
        lastLoginMethod: userSchema.lastLoginMethod,
        banned: userSchema.banned,
        accountStatus: userSchema.accountStatus,
      })
      .from(userSchema)
      .where(eq(userSchema.id, ctx.user.id))
      .limit(1);

    const [defaultSpace] = await db
      .select({ id: userSpaceSchema.spaceId })
      .from(userSpaceSchema)
      .where(
        and(
          eq(userSpaceSchema.userId, ctx.user.id),
          eq(userSpaceSchema.isDefault, true),
        ),
      )
      .limit(1);

    const [defaultSource] = await db
      .select({ id: sourceSchema.id })
      .from(sourceSchema)
      .where(
        and(
          eq(sourceSchema.userId, ctx.user.id),
          eq(sourceSchema.isDefault, true),
        ),
      )
      .limit(1);

    const accountState =
      user?.accountStatus === "deactivated"
        ? "deactivated"
        : user?.banned
          ? "banned"
          : "active";

    return {
      id: ctx.user.id,
      name: user?.name ?? ctx.user.name,
      email: user?.email ?? null,
      image: user?.image ?? ctx.user.image ?? null,
      onboardingStatus: user?.onboarded ? "complete" : "pending",
      lastLoginMethod: user?.lastLoginMethod ?? null,
      accountState,
      defaultSpaceId: defaultSpace?.id ?? null,
      defaultSourceId: defaultSource?.id ?? null,
      session: {
        createdAt: ctx.session.session.createdAt,
        updatedAt: ctx.session.session.updatedAt,
        expiresAt: ctx.session.session.expiresAt,
        userAgent: ctx.session.session.userAgent ?? null,
      },
    };
  }),

  updateProfile: protectedProcedure
    .input(z.object({ name: z.string().trim().min(1).max(80) }))
    .mutation(async ({ ctx, input }) => {
      const [user] = await db
        .update(userSchema)
        .set({ name: input.name, updatedAt: new Date() })
        .where(eq(userSchema.id, ctx.user.id))
        .returning({ id: userSchema.id, name: userSchema.name });

      await safeDel(redisKeys.accountMe(ctx.user.id));

      return user;
    }),

  deactivateSelf: protectedProcedure.mutation(async ({ ctx }) => {
    // Mark deactivated through an explicit Riva state (not a Better Auth ban).
    // Domain/financial records are preserved; only product access is blocked.
    await db
      .update(userSchema)
      .set({ accountStatus: "deactivated", deactivatedAt: new Date() })
      .where(eq(userSchema.id, ctx.user.id));

    // Sign out all active sessions for this user.
    await db.delete(sessionSchema).where(eq(sessionSchema.userId, ctx.user.id));

    await invalidateAccountCaches(ctx.user.id);

    return { success: true };
  }),
});

async function invalidateAccountCaches(userId: string) {
  await Promise.all([
    safeDel(redisKeys.accountMe(userId)),
    safeDel(redisKeys.notificationsUnread(userId)),
    safeDel(redisKeys.spacesDefault(userId)),
    safeDel(redisKeys.spacesList(userId, "default")),
    safeDel(redisKeys.sourceTypesList(userId)),
    safeDel(redisKeys.sourcesList(userId, "default")),
    safeDel(redisKeys.labelsList(userId)),
    safeDel(redisKeys.transactionsList(userId, "default")),
    safeDel(redisKeys.transactionsSummary(userId, "default")),
  ]);
}
