import { relations } from "drizzle-orm";
import {
  boolean,
  doublePrecision,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { userSchema } from "./auth-schema";
import { spaceSchema } from "./space-schema";

export const sourceSchema = pgTable("source", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  typeId: uuid("type_id")
    .references(() => sourceTypeSchema.id)
    .notNull(),
  balance: doublePrecision("balance").notNull(),
  isDefault: boolean("is_default").notNull().default(false),
  userId: text("user_id")
    .references(() => userSchema.id)
    .notNull(),
  spaceId: uuid("space_id").references(() => spaceSchema.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const sourceTypeSchema = pgTable("source_type", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id")
    .notNull()
    .references(() => userSchema.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const sourceTableRelations = relations(sourceSchema, ({ one }) => ({
  type: one(sourceTypeSchema, {
    fields: [sourceSchema.typeId],
    references: [sourceTypeSchema.id],
  }),
  space: one(spaceSchema, {
    fields: [sourceSchema.spaceId],
    references: [spaceSchema.id],
  }),
}));
