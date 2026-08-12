import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { userSchema } from "./auth-schema";

export const notificationTypes = [
  "welcome",
  "space_join_requested",
  "space_join_accepted",
  "space_join_rejected",
  "transaction_milestone",
] as const;

export type NotificationType = (typeof notificationTypes)[number];

export const notificationSchema = pgTable(
  "notification",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => userSchema.id, { onDelete: "cascade" }),
    type: text("type", { enum: notificationTypes }).notNull(),
    title: text("title").notNull(),
    body: text("body"),
    read: boolean("read").notNull().default(false),
    readAt: timestamp("read_at"),
    // Safe structured display fields only (e.g. spaceId). Never financial content.
    data: jsonb("data").$type<Record<string, string> | null>(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("notification_userId_idx").on(table.userId),
    index("notification_userId_read_idx").on(table.userId, table.read),
  ],
);

export const notificationTableRelations = relations(
  notificationSchema,
  ({ one }) => ({
    user: one(userSchema, {
      fields: [notificationSchema.userId],
      references: [userSchema.id],
    }),
  }),
);
