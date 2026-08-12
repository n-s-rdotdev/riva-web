import { relations } from "drizzle-orm";
import {
  boolean,
  doublePrecision,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { userSchema } from "./auth-schema";
import { sourceSchema } from "./source-schema";
import { spaceSchema } from "./space-schema";

export const transactionSchema = pgTable("transaction", {
  id: uuid("id").defaultRandom().primaryKey(),
  description: text("description").notNull(),
  amount: doublePrecision("amount").notNull(),
  type: text("type", { enum: ["debit", "credit"] }).notNull(),
  date: timestamp("date").notNull(),
  isAnExpense: boolean("is_an_expense").notNull().default(false),
  sourceId: uuid("source_id")
    .references(() => sourceSchema.id)
    .notNull(),
  userId: text("user_id")
    .references(() => userSchema.id)
    .notNull(),
  spaceId: uuid("space_id")
    .references(() => spaceSchema.id)
    .notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const labelSchema = pgTable("label", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  userId: text("user_id")
    .references(() => userSchema.id)
    .notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const transactionLabelTableSchema = pgTable(
  "transaction_label",
  {
    transactionId: uuid("transaction_id")
      .references(() => transactionSchema.id)
      .notNull(),
    labelId: uuid("label_id")
      .references(() => labelSchema.id)
      .notNull(),
  },
  (t) => [primaryKey({ columns: [t.transactionId, t.labelId] })],
);

export const transactionTableRelations = relations(
  transactionSchema,
  ({ one, many }) => ({
    user: one(userSchema, {
      fields: [transactionSchema.userId],
      references: [userSchema.id],
    }),
    source: one(sourceSchema, {
      fields: [transactionSchema.sourceId],
      references: [sourceSchema.id],
    }),
    space: one(spaceSchema, {
      fields: [transactionSchema.spaceId],
      references: [spaceSchema.id],
    }),
    labels: many(transactionLabelTableSchema),
  }),
);

export const labelTableRelations = relations(labelSchema, ({ one }) => ({
  user: one(userSchema, {
    fields: [labelSchema.userId],
    references: [userSchema.id],
  }),
}));

export const transactionLabelTableRelations = relations(
  transactionLabelTableSchema,
  ({ one }) => ({
    transaction: one(transactionSchema, {
      fields: [transactionLabelTableSchema.transactionId],
      references: [transactionSchema.id],
    }),
    label: one(labelSchema, {
      fields: [transactionLabelTableSchema.labelId],
      references: [labelSchema.id],
    }),
  }),
);
