import { db } from "../../db";
import { notificationSchema, type NotificationType } from "../../db/schema";
import { redisKeys, safeDel } from "../../lib/cache/redis";

type CreateNotificationInput = {
  userId: string;
  type: NotificationType;
  title: string;
  body?: string | null;
  // Safe structured display fields only (e.g. spaceId). Never financial content.
  data?: Record<string, string> | null;
};

/**
 * Creates a durable in-app notification for a user and invalidates their
 * unread-count cache. Intended to be called by product mutations AFTER their
 * core transaction succeeds. Failures are swallowed so notification problems
 * never block the parent operation.
 */
export async function createNotification(input: CreateNotificationInput) {
  try {
    await db.insert(notificationSchema).values({
      userId: input.userId,
      type: input.type,
      title: input.title,
      body: input.body ?? null,
      data: input.data ?? null,
    });

    await safeDel(redisKeys.notificationsUnread(input.userId));

    return true;
  } catch (error) {
    console.error("[notifications] create failed", {
      userId: input.userId,
      type: input.type,
      error,
    });

    return false;
  }
}
