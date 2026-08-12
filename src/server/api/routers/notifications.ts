import { and, count, desc, eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "../../../db";
import { notificationSchema } from "../../../db/schema";
import {
  redisKeys,
  redisTtl,
  safeDel,
  safeGetJson,
  safeSetJson,
} from "../../../lib/cache/redis";
import { createTRPCRouter, protectedProcedure } from "../trpc";

const listInput = z.object({
  limit: z.number().int().min(1).max(50).default(20),
  cursor: z.string().uuid().optional(),
});

export const notificationsRouter = createTRPCRouter({
  list: protectedProcedure
    .input(listInput.optional())
    .query(async ({ ctx, input }) => {
      const limit = input?.limit ?? 20;

      // Reads come straight from Postgres (canonical); only the unread count
      // is cached, per the notifications storage plan.
      const rows = await db
        .select({
          id: notificationSchema.id,
          type: notificationSchema.type,
          title: notificationSchema.title,
          body: notificationSchema.body,
          read: notificationSchema.read,
          readAt: notificationSchema.readAt,
          data: notificationSchema.data,
          createdAt: notificationSchema.createdAt,
        })
        .from(notificationSchema)
        .where(eq(notificationSchema.userId, ctx.user.id))
        .orderBy(desc(notificationSchema.createdAt))
        .limit(limit + 1);

      let nextCursor: string | undefined;
      if (rows.length > limit) {
        const next = rows.pop();
        nextCursor = next?.id;
      }

      return { items: rows, nextCursor };
    }),

  unreadCount: protectedProcedure.query(async ({ ctx }) => {
    const cacheKey = redisKeys.notificationsUnread(ctx.user.id);
    const cached = await safeGetJson<number>(cacheKey);

    if (typeof cached === "number") {
      return { count: cached };
    }

    const [row] = await db
      .select({ value: count() })
      .from(notificationSchema)
      .where(
        and(
          eq(notificationSchema.userId, ctx.user.id),
          eq(notificationSchema.read, false),
        ),
      );

    const unread = row?.value ?? 0;
    await safeSetJson(cacheKey, unread, redisTtl.short);

    return { count: unread };
  }),

  markRead: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await db
        .update(notificationSchema)
        .set({ read: true, readAt: new Date() })
        .where(
          and(
            eq(notificationSchema.id, input.id),
            eq(notificationSchema.userId, ctx.user.id),
            eq(notificationSchema.read, false),
          ),
        );

      await safeDel(redisKeys.notificationsUnread(ctx.user.id));

      return { success: true };
    }),

  markAllRead: protectedProcedure.mutation(async ({ ctx }) => {
    await db
      .update(notificationSchema)
      .set({ read: true, readAt: new Date() })
      .where(
        and(
          eq(notificationSchema.userId, ctx.user.id),
          eq(notificationSchema.read, false),
        ),
      );

    await safeDel(redisKeys.notificationsUnread(ctx.user.id));

    return { success: true };
  }),
});
