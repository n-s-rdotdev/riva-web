import { TRPCError } from "@trpc/server";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";

import { db } from "../../../db";
import {
  labelSchema,
  sourceSchema,
  sourceTypeSchema,
  spaceSchema,
  transactionLabelTableSchema,
  transactionSchema,
  userSpaceSchema,
} from "../../../db/schema";
import {
  redisKeys,
  redisTtl,
  safeGetJson,
  safeSetJson,
} from "../../../lib/cache/redis";
import { createTRPCRouter, protectedProcedure } from "../trpc";

const overviewInput = z.object({
  spaceId: z.string().uuid().optional(),
  preset: z.enum(["month", "30d", "year", "all"]).default("month"),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
});

type DashboardTransaction = {
  id: string;
  description: string;
  amount: number;
  type: "debit" | "credit";
  date: Date;
  sourceId: string;
  sourceName: string;
  spaceId: string;
  spaceName: string;
  isAnExpense: boolean;
};

export const dashboardRouter = createTRPCRouter({
  getOverview: protectedProcedure
    .input(overviewInput.optional())
    .query(async ({ ctx, input }) => {
      const params = input ?? overviewInput.parse({});
      const space = await resolveSpace(ctx.user.id, params.spaceId);

      if (!space) {
        return emptyOverview(params.preset);
      }

      const dateRange = resolveDateRange(params);
      const cacheKey = redisKeys.dashboardOverview(
        ctx.user.id,
        space.id,
        cacheParams({ ...params, ...dateRange }),
      );
      const cached = await safeGetJson<Awaited<ReturnType<typeof buildOverview>>>(
        cacheKey,
      );

      if (cached) {
        return cached;
      }

      const overview = await buildOverview(ctx.user.id, space, dateRange);
      await safeSetJson(cacheKey, overview, redisTtl.short);

      return overview;
    }),
});

async function buildOverview(
  userId: string,
  space: { id: string; name: string; isDefault: boolean },
  dateRange: ReturnType<typeof resolveDateRange>,
) {
  const allSpaceTransactions = await getSpaceTransactions(userId, space.id);
  const transactions = allSpaceTransactions.filter((transaction) => {
    if (dateRange.dateFrom && transaction.date < dateRange.dateFrom) return false;
    if (dateRange.dateTo && transaction.date > dateRange.dateTo) return false;
    return true;
  });
  const sourceBreakdown = await getSourceBreakdown(userId, space.id, transactions);
  const labelBreakdown = await getLabelBreakdown(transactions);
  const credits = roundMoney(
    transactions
      .filter((transaction) => transaction.type === "credit")
      .reduce((sum, transaction) => sum + transaction.amount, 0),
  );
  const debits = roundMoney(
    transactions
      .filter((transaction) => transaction.type === "debit")
      .reduce((sum, transaction) => sum + transaction.amount, 0),
  );

  return {
    space,
    dateRange: {
      preset: dateRange.preset,
      dateFrom: dateRange.dateFrom,
      dateTo: dateRange.dateTo,
      label: dateRange.label,
    },
    summary: {
      currentBalance: roundMoney(
        sourceBreakdown.reduce((sum, source) => sum + source.currentBalance, 0),
      ),
      credits,
      debits,
      net: roundMoney(credits - debits),
      transactionCount: transactions.length,
      sourceCount: sourceBreakdown.length,
      labelCount: labelBreakdown.length,
      hasTransactions: transactions.length > 0,
      hasSources: sourceBreakdown.length > 0,
    },
    recentTransactions: transactions
      .sort((a, b) => b.date.getTime() - a.date.getTime())
      .slice(0, 5),
    cashflowSeries: buildCashflowSeries(transactions, dateRange),
    sourceBreakdown,
    labelBreakdown,
    quickLinks: [
      { label: "Transactions", href: "/transactions" },
      { label: "Sources", href: "/sources" },
      { label: "Spaces", href: "/spaces" },
    ],
  };
}

async function resolveSpace(userId: string, requestedSpaceId?: string) {
  const rows = await db
    .select({
      id: spaceSchema.id,
      name: spaceSchema.name,
      isDefault: userSpaceSchema.isDefault,
    })
    .from(userSpaceSchema)
    .innerJoin(spaceSchema, eq(userSpaceSchema.spaceId, spaceSchema.id))
    .where(eq(userSpaceSchema.userId, userId));

  if (requestedSpaceId) {
    const requested = rows.find((row) => row.id === requestedSpaceId);

    if (!requested) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Space was not found.",
      });
    }

    return {
      ...requested,
      isDefault: requested.isDefault === true,
    };
  }

  const selected = rows.find((row) => row.isDefault) ?? rows[0];

  return selected
    ? {
        ...selected,
        isDefault: selected.isDefault === true,
      }
    : null;
}

async function getSpaceTransactions(userId: string, spaceId: string) {
  const rows = await db
    .select({
      id: transactionSchema.id,
      description: transactionSchema.description,
      amount: transactionSchema.amount,
      type: transactionSchema.type,
      date: transactionSchema.date,
      sourceId: transactionSchema.sourceId,
      sourceName: sourceSchema.name,
      spaceId: transactionSchema.spaceId,
      spaceName: spaceSchema.name,
      isAnExpense: transactionSchema.isAnExpense,
    })
    .from(transactionSchema)
    .innerJoin(sourceSchema, eq(transactionSchema.sourceId, sourceSchema.id))
    .innerJoin(spaceSchema, eq(transactionSchema.spaceId, spaceSchema.id))
    .where(
      and(eq(transactionSchema.userId, userId), eq(transactionSchema.spaceId, spaceId)),
    );

  return rows.map((row) => ({
    ...row,
    amount: Number(row.amount),
    isAnExpense: row.isAnExpense === true,
  }));
}

async function getSourceBreakdown(
  userId: string,
  spaceId: string,
  transactions: DashboardTransaction[],
) {
  const transactionSourceIds = new Set(transactions.map((transaction) => transaction.sourceId));
  const rows = await db
    .select({
      id: sourceSchema.id,
      name: sourceSchema.name,
      openingBalance: sourceSchema.balance,
      spaceId: sourceSchema.spaceId,
      typeName: sourceTypeSchema.name,
    })
    .from(sourceSchema)
    .innerJoin(sourceTypeSchema, eq(sourceSchema.typeId, sourceTypeSchema.id))
    .where(eq(sourceSchema.userId, userId));
  const relevantSources = rows.filter(
    (source) => source.spaceId === spaceId || transactionSourceIds.has(source.id),
  );

  if (relevantSources.length === 0) {
    return [];
  }

  const allSourceTransactions = await db
    .select({
      sourceId: transactionSchema.sourceId,
      amount: transactionSchema.amount,
      type: transactionSchema.type,
    })
    .from(transactionSchema)
    .where(
      and(
        eq(transactionSchema.userId, userId),
        inArray(
          transactionSchema.sourceId,
          relevantSources.map((source) => source.id),
        ),
      ),
    );

  const balanceBySource = new Map<string, number>();
  for (const source of relevantSources) {
    balanceBySource.set(source.id, Number(source.openingBalance));
  }
  for (const transaction of allSourceTransactions) {
    const current = balanceBySource.get(transaction.sourceId) ?? 0;
    balanceBySource.set(
      transaction.sourceId,
      current +
        (transaction.type === "credit"
          ? Number(transaction.amount)
          : -Number(transaction.amount)),
    );
  }

  const totalAbs = relevantSources.reduce(
    (sum, source) => sum + Math.abs(balanceBySource.get(source.id) ?? 0),
    0,
  );

  return relevantSources
    .map((source) => {
      const currentBalance = roundMoney(balanceBySource.get(source.id) ?? 0);

      return {
        id: source.id,
        name: source.name,
        typeName: source.typeName,
        currentBalance,
        share: totalAbs > 0 ? Math.round((Math.abs(currentBalance) / totalAbs) * 100) : 0,
      };
    })
    .sort((a, b) => Math.abs(b.currentBalance) - Math.abs(a.currentBalance));
}

async function getLabelBreakdown(transactions: DashboardTransaction[]) {
  if (transactions.length === 0) {
    return [];
  }

  const transactionIds = transactions.map((transaction) => transaction.id);
  const amountByTransaction = new Map(
    transactions.map((transaction) => [
      transaction.id,
      transaction.type === "credit" ? transaction.amount : -transaction.amount,
    ]),
  );
  const labels = await db
    .select({
      transactionId: transactionLabelTableSchema.transactionId,
      id: labelSchema.id,
      name: labelSchema.name,
    })
    .from(transactionLabelTableSchema)
    .innerJoin(labelSchema, eq(transactionLabelTableSchema.labelId, labelSchema.id))
    .where(inArray(transactionLabelTableSchema.transactionId, transactionIds));
  const breakdown = new Map<string, { id: string; name: string; net: number; count: number }>();

  for (const label of labels) {
    const current = breakdown.get(label.id) ?? {
      id: label.id,
      name: label.name,
      net: 0,
      count: 0,
    };
    current.net += amountByTransaction.get(label.transactionId) ?? 0;
    current.count += 1;
    breakdown.set(label.id, current);
  }

  const totalAbs = [...breakdown.values()].reduce(
    (sum, label) => sum + Math.abs(label.net),
    0,
  );

  return [...breakdown.values()]
    .map((label) => ({
      ...label,
      net: roundMoney(label.net),
      share: totalAbs > 0 ? Math.round((Math.abs(label.net) / totalAbs) * 100) : 0,
    }))
    .sort((a, b) => Math.abs(b.net) - Math.abs(a.net))
    .slice(0, 8);
}

function buildCashflowSeries(
  transactions: DashboardTransaction[],
  dateRange: ReturnType<typeof resolveDateRange>,
) {
  const bucket = new Map<string, { date: string; credits: number; debits: number; net: number }>();

  for (const transaction of transactions) {
    const key = formatBucketDate(transaction.date, dateRange.preset === "year");
    const current = bucket.get(key) ?? { date: key, credits: 0, debits: 0, net: 0 };

    if (transaction.type === "credit") {
      current.credits += transaction.amount;
      current.net += transaction.amount;
    } else {
      current.debits += transaction.amount;
      current.net -= transaction.amount;
    }

    bucket.set(key, current);
  }

  return [...bucket.values()]
    .map((point) => ({
      ...point,
      credits: roundMoney(point.credits),
      debits: roundMoney(point.debits),
      net: roundMoney(point.net),
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

function resolveDateRange(params: z.infer<typeof overviewInput>) {
  const explicitFrom = params.dateFrom ? parseDate(params.dateFrom, "start") : null;
  const explicitTo = params.dateTo ? parseDate(params.dateTo, "end") : null;

  if (explicitFrom || explicitTo) {
    return {
      preset: params.preset,
      dateFrom: explicitFrom,
      dateTo: explicitTo,
      label: "Custom range",
    };
  }

  const now = new Date();

  if (params.preset === "all") {
    return {
      preset: params.preset,
      dateFrom: null,
      dateTo: null,
      label: "All time",
    };
  }

  if (params.preset === "30d") {
    const dateFrom = new Date(now);
    dateFrom.setDate(now.getDate() - 29);
    dateFrom.setHours(0, 0, 0, 0);

    return {
      preset: params.preset,
      dateFrom,
      dateTo: endOfDay(now),
      label: "Last 30 days",
    };
  }

  if (params.preset === "year") {
    return {
      preset: params.preset,
      dateFrom: new Date(now.getFullYear(), 0, 1),
      dateTo: endOfDay(now),
      label: String(now.getFullYear()),
    };
  }

  return {
    preset: params.preset,
    dateFrom: new Date(now.getFullYear(), now.getMonth(), 1),
    dateTo: endOfDay(now),
    label: new Intl.DateTimeFormat("en-US", {
      month: "long",
      year: "numeric",
    }).format(now),
  };
}

function emptyOverview(preset: z.infer<typeof overviewInput>["preset"]) {
  return {
    space: null,
    dateRange: {
      preset,
      dateFrom: null,
      dateTo: null,
      label: "No space",
    },
    summary: {
      currentBalance: 0,
      credits: 0,
      debits: 0,
      net: 0,
      transactionCount: 0,
      sourceCount: 0,
      labelCount: 0,
      hasTransactions: false,
      hasSources: false,
    },
    recentTransactions: [],
    cashflowSeries: [],
    sourceBreakdown: [],
    labelBreakdown: [],
    quickLinks: [
      { label: "Transactions", href: "/transactions" },
      { label: "Sources", href: "/sources" },
      { label: "Spaces", href: "/spaces" },
    ],
  };
}

function parseDate(value: string, boundary: "start" | "end") {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  if (boundary === "start") {
    date.setHours(0, 0, 0, 0);
  } else {
    date.setHours(23, 59, 59, 999);
  }

  return date;
}

function endOfDay(value: Date) {
  const date = new Date(value);
  date.setHours(23, 59, 59, 999);
  return date;
}

function formatBucketDate(date: Date, monthly: boolean) {
  if (monthly) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  }

  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function cacheParams(params: Record<string, unknown>) {
  if (
    params.preset === "month" &&
    !params.spaceId &&
    !params.dateFrom &&
    !params.dateTo
  ) {
    return "default";
  }

  return encodeURIComponent(JSON.stringify(params));
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
