import { Redis } from "@upstash/redis";

import { env } from "../../env";

export const redisTtl = {
  short: 60,
  medium: 5 * 60,
  long: 60 * 60,
  day: 24 * 60 * 60,
} as const;

const keyPrefix = [
  "riva",
  process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "development",
].join(":");

export const redisKeys = {
  accountMe: (userId: string) => prefixedKey("account", "me", userId),
  notificationsUnread: (userId: string) =>
    prefixedKey("notifications", "unread", userId),
  featureFlag: (flag: string) => prefixedKey("feature", "flag", flag),
  rateLimit: (scope: string, id: string) => prefixedKey("rate", scope, id),
  spacesList: (userId: string, paramsKey: string) =>
    prefixedKey("spaces", "list", userId, paramsKey),
  spacesDetail: (spaceId: string) => prefixedKey("spaces", "detail", spaceId),
  spacesDefault: (userId: string) => prefixedKey("spaces", "default", userId),
  spacesInvite: (code: string) => prefixedKey("spaces", "invite", code),
  spacesMembership: (spaceId: string, userId: string) =>
    prefixedKey("spaces", "membership", spaceId, userId),
  joinRequestsIncoming: (userId: string, paramsKey: string) =>
    prefixedKey("joinRequests", "incoming", userId, paramsKey),
  joinRequestsOutgoing: (userId: string, paramsKey: string) =>
    prefixedKey("joinRequests", "outgoing", userId, paramsKey),
  sourceTypesList: (userId: string) => prefixedKey("sourceTypes", "list", userId),
  sourcesList: (userId: string, paramsKey: string) =>
    prefixedKey("sources", "list", userId, paramsKey),
  sourcesDetail: (sourceId: string) => prefixedKey("sources", "detail", sourceId),
  sourcesBalance: (sourceId: string) =>
    prefixedKey("sources", "balance", sourceId),
  labelsList: (userId: string) => prefixedKey("labels", "list", userId),
  transactionsList: (userId: string, paramsKey: string) =>
    prefixedKey("transactions", "list", userId, paramsKey),
  transactionsDetail: (transactionId: string) =>
    prefixedKey("transactions", "detail", transactionId),
  transactionsSummary: (userId: string, paramsKey: string) =>
    prefixedKey("transactions", "summary", userId, paramsKey),
  dashboardOverview: (userId: string, spaceId: string, paramsKey: string) =>
    prefixedKey("dashboard", "overview", userId, spaceId, paramsKey),
} as const;

export const redis = new Redis({
  url: env.UPSTASH_REDIS_REST_URL,
  token: env.UPSTASH_REDIS_REST_TOKEN,
});

export function prefixedKey(...parts: string[]) {
  return [keyPrefix, ...parts.map(sanitizeKeyPart)].join(":");
}

export async function safeGetJson<TValue>(
  key: string,
  fallback: TValue | null = null,
): Promise<TValue | null> {
  try {
    return await redis.get<TValue>(key);
  } catch (error) {
    logRedisFailure("get", key, error);
    return fallback;
  }
}

export async function safeSetJson(
  key: string,
  value: unknown,
  ttlSeconds?: number,
) {
  try {
    if (ttlSeconds) {
      await redis.set(key, value, { ex: ttlSeconds });
    } else {
      await redis.set(key, value);
    }

    return true;
  } catch (error) {
    logRedisFailure("set", key, error);
    return false;
  }
}

export async function safeDel(key: string) {
  try {
    await redis.del(key);
    return true;
  } catch (error) {
    logRedisFailure("del", key, error);
    return false;
  }
}

export async function safeDelByKeys(keys: string[]) {
  if (keys.length === 0) {
    return true;
  }

  try {
    await redis.del(...keys);
    return true;
  } catch (error) {
    console.error("[redis] del-many failed", {
      count: keys.length,
      error,
    });
    return false;
  }
}

function sanitizeKeyPart(part: string) {
  return part.trim().replace(/[^a-zA-Z0-9._-]/g, "_");
}

function logRedisFailure(operation: string, key: string, error: unknown) {
  console.error("[redis] operation failed", {
    operation,
    key,
    error,
  });
}
