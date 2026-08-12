import { relations } from "drizzle-orm";
import {
  boolean,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { userSchema } from "./auth-schema";

export const spaceSchema = pgTable("space", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  ownerId: text("owner_id")
    .references(() => userSchema.id)
    .notNull(),
  inviteCode: text("invite_code").unique(),
  inviteCodeExpiresAt: timestamp("invite_code_expires_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const joinRequestSchema = pgTable("join_request", {
  id: uuid("id").defaultRandom().primaryKey(),
  spaceId: uuid("space_id")
    .references(() => spaceSchema.id)
    .notNull(),
  userId: text("user_id")
    .references(() => userSchema.id)
    .notNull(),
  status: text("status", {
    enum: ["pending", "accepted", "rejected", "canceled"],
  }).default("pending"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const userSpaceSchema = pgTable(
  "user_space",
  {
    spaceId: uuid("space_id")
      .references(() => spaceSchema.id)
      .notNull(),
    userId: text("user_id")
      .references(() => userSchema.id)
      .notNull(),
    isDefault: boolean("is_default").default(false),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [primaryKey({ columns: [t.spaceId, t.userId] })],
);

export const spaceTableRelations = relations(spaceSchema, ({ many }) => ({
  joinRequests: many(joinRequestSchema),
  users: many(userSpaceSchema),
}));

export const joinRequestTableRelations = relations(
  joinRequestSchema,
  ({ one }) => ({
    space: one(spaceSchema, {
      fields: [joinRequestSchema.spaceId],
      references: [spaceSchema.id],
    }),
    user: one(userSchema, {
      fields: [joinRequestSchema.userId],
      references: [userSchema.id],
    }),
  }),
);

export const userSpaceTableRelations = relations(userSpaceSchema, ({ one }) => ({
  space: one(spaceSchema, {
    fields: [userSpaceSchema.spaceId],
    references: [spaceSchema.id],
  }),
  user: one(userSchema, {
    fields: [userSpaceSchema.userId],
    references: [userSchema.id],
  }),
}));
