import { TRPCError } from "@trpc/server";
import { and, count, eq, gt, inArray } from "drizzle-orm";
import { z } from "zod";

import { db, dbPool } from "../../../db";
import {
  joinRequestSchema,
  sourceSchema,
  spaceSchema,
  transactionSchema,
  userSchema,
  userSpaceSchema,
} from "../../../db/schema";
import {
  redisKeys,
  redisTtl,
  safeDel,
  safeDelByKeys,
  safeGetJson,
  safeSetJson,
} from "../../../lib/cache/redis";
import { createNotification } from "../../notifications/create";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "../trpc";

const pageInput = z.object({
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(50).default(12),
  search: z.string().trim().max(80).optional(),
  filter: z
    .enum(["all", "default", "shared", "owned", "member"])
    .default("all"),
  sort: z.enum(["recent", "name", "created"]).default("recent"),
});

const spaceIdInput = z.object({
  id: z.string().uuid(),
});

const createSpaceInput = z.object({
  name: z.string().trim().min(1).max(80),
  setAsDefault: z.boolean().default(false),
});

const updateSpaceInput = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(80),
});

const inviteCodeInput = z.object({
  code: z.string().trim().min(14).max(14),
});

const joinRequestListParams = z.object({
  spaceId: z.string().uuid().optional(),
  status: z
    .enum(["pending", "accepted", "rejected", "canceled", "all"])
    .default("pending"),
});

const joinRequestListInput = joinRequestListParams.optional();

const joinRequestIdInput = z.object({
  id: z.string().uuid(),
});

type SpaceListItem = {
  id: string;
  name: string;
  ownerId: string;
  role: "owner" | "member";
  isDefault: boolean;
  memberCount: number;
  sourceCount: number;
  transactionCount: number;
  createdAt: Date | null;
  updatedAt: Date | null;
};

type InvitePreview = {
  spaceId: string;
  spaceName: string;
  memberCount: number;
  expiresAt: Date;
};

export const spacesRouter = createTRPCRouter({
  list: protectedProcedure
    .input(pageInput.optional())
    .query(async ({ ctx, input }) => {
      const params = input ?? pageInput.parse({});
      const cacheKey = redisKeys.spacesList(ctx.user.id, cacheParams(params));
      const cached = await safeGetJson<Awaited<ReturnType<typeof listSpaces>>>(
        cacheKey,
      );

      if (cached) {
        return cached;
      }

      const result = await listSpaces(ctx.user.id, params);
      await safeSetJson(cacheKey, result, redisTtl.short);

      return result;
    }),

  getById: protectedProcedure
    .input(spaceIdInput)
    .query(async ({ ctx, input }) => {
      const membership = await getMembership(input.id, ctx.user.id);

      if (!membership) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Space was not found.",
        });
      }

      const cacheKey = redisKeys.spacesDetail(input.id);
      const cached = await safeGetJson<SpaceListItem>(cacheKey);

      if (cached) {
        return {
          ...cached,
          canManage: cached.role === "owner",
        };
      }

      const space = await hydrateSpaceRow({
        id: membership.id,
        name: membership.name,
        ownerId: membership.ownerId,
        isDefault: membership.isDefault,
        createdAt: membership.createdAt,
        updatedAt: membership.updatedAt,
        userId: ctx.user.id,
      });

      await safeSetJson(cacheKey, space, redisTtl.medium);

      return {
        ...space,
        canManage: space.role === "owner",
      };
    }),

  create: protectedProcedure
    .input(createSpaceInput)
    .mutation(async ({ ctx, input }) => {
      const existingMemberships = await db
        .select({ spaceId: userSpaceSchema.spaceId })
        .from(userSpaceSchema)
        .where(eq(userSpaceSchema.userId, ctx.user.id));
      const shouldSetDefault =
        input.setAsDefault || existingMemberships.length === 0;

      const result = await dbPool.transaction(async (tx) => {
        if (shouldSetDefault) {
          await tx
            .update(userSpaceSchema)
            .set({ isDefault: false, updatedAt: new Date() })
            .where(eq(userSpaceSchema.userId, ctx.user.id));
        }

        const [space] = await tx
          .insert(spaceSchema)
          .values({
            name: input.name,
            ownerId: ctx.user.id,
          })
          .returning({
            id: spaceSchema.id,
            name: spaceSchema.name,
            ownerId: spaceSchema.ownerId,
            createdAt: spaceSchema.createdAt,
            updatedAt: spaceSchema.updatedAt,
          });

        await tx.insert(userSpaceSchema).values({
          spaceId: space.id,
          userId: ctx.user.id,
          isDefault: shouldSetDefault,
        });

        return {
          ...space,
          isDefault: shouldSetDefault,
        };
      });

      await invalidateSpaceCaches(ctx.user.id, result.id);

      return {
        ...result,
        role: "owner" as const,
        memberCount: 1,
        sourceCount: 0,
        transactionCount: 0,
      };
    }),

  update: protectedProcedure
    .input(updateSpaceInput)
    .mutation(async ({ ctx, input }) => {
      const membership = await getMembership(input.id, ctx.user.id);

      if (!membership) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Space was not found.",
        });
      }

      if (membership.ownerId !== ctx.user.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only the space owner can rename this space.",
        });
      }

      const [space] = await db
        .update(spaceSchema)
        .set({ name: input.name, updatedAt: new Date() })
        .where(eq(spaceSchema.id, input.id))
        .returning({
          id: spaceSchema.id,
          name: spaceSchema.name,
          ownerId: spaceSchema.ownerId,
          createdAt: spaceSchema.createdAt,
          updatedAt: spaceSchema.updatedAt,
        });

      await invalidateSpaceCaches(ctx.user.id, input.id);

      return {
        ...space,
        role: "owner" as const,
        isDefault: membership.isDefault,
      };
    }),

  remove: protectedProcedure
    .input(spaceIdInput)
    .mutation(async ({ ctx, input }) => {
      const membership = await getMembership(input.id, ctx.user.id);

      if (!membership) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Space was not found.",
        });
      }

      const accessibleSpaces = await db
        .select({ spaceId: userSpaceSchema.spaceId })
        .from(userSpaceSchema)
        .where(eq(userSpaceSchema.userId, ctx.user.id));

      if (accessibleSpaces.length <= 1) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Create another space before removing this one.",
        });
      }

      if (membership.ownerId === ctx.user.id) {
        const transactionCount = await getTransactionCount(input.id);

        if (transactionCount > 0) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "Spaces with transactions cannot be deleted yet.",
          });
        }

        await dbPool.transaction(async (tx) => {
          await tx
            .delete(joinRequestSchema)
            .where(eq(joinRequestSchema.spaceId, input.id));
          await tx
            .delete(userSpaceSchema)
            .where(eq(userSpaceSchema.spaceId, input.id));
          await tx.delete(spaceSchema).where(eq(spaceSchema.id, input.id));
        });
      } else {
        await db
          .delete(userSpaceSchema)
          .where(
            and(
              eq(userSpaceSchema.spaceId, input.id),
              eq(userSpaceSchema.userId, ctx.user.id),
            ),
          );
      }

      if (membership.isDefault) {
        await setFirstAvailableDefault(ctx.user.id, input.id);
      }

      await invalidateSpaceCaches(ctx.user.id, input.id);

      return { success: true };
    }),

  setDefault: protectedProcedure
    .input(spaceIdInput)
    .mutation(async ({ ctx, input }) => {
      const membership = await getMembership(input.id, ctx.user.id);

      if (!membership) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Space was not found.",
        });
      }

      await dbPool.transaction(async (tx) => {
        await tx
          .update(userSpaceSchema)
          .set({ isDefault: false, updatedAt: new Date() })
          .where(eq(userSpaceSchema.userId, ctx.user.id));
        await tx
          .update(userSpaceSchema)
          .set({ isDefault: true, updatedAt: new Date() })
          .where(
            and(
              eq(userSpaceSchema.userId, ctx.user.id),
              eq(userSpaceSchema.spaceId, input.id),
            ),
          );
      });

      await invalidateSpaceCaches(ctx.user.id, input.id);

      return { success: true, defaultSpaceId: input.id };
    }),

  createInviteCode: protectedProcedure
    .input(spaceIdInput)
    .mutation(async ({ ctx, input }) => {
      const space = await requireSpaceOwner(input.id, ctx.user.id);
      const inviteCode = await generateUniqueInviteCode();
      const inviteCodeExpiresAt = new Date(Date.now() + redisTtl.day * 1000);

      await db
        .update(spaceSchema)
        .set({
          inviteCode,
          inviteCodeExpiresAt,
          updatedAt: new Date(),
        })
        .where(eq(spaceSchema.id, input.id));

      if (space.inviteCode) {
        await safeDel(redisKeys.spacesInvite(space.inviteCode));
      }

      const preview = await buildInvitePreview(inviteCode);
      if (preview) {
        await cacheInvitePreview(inviteCode, preview);
      }
      await invalidateSpaceCaches(ctx.user.id, input.id);

      return {
        spaceId: input.id,
        inviteCode,
        inviteCodeExpiresAt,
      };
    }),

  getInvitePreview: publicProcedure
    .input(inviteCodeInput)
    .query(async ({ input }) => {
      const code = normalizeInviteCode(input.code);
      const cacheKey = redisKeys.spacesInvite(code);
      const cached = await safeGetJson<InvitePreview>(cacheKey);

      if (cached && new Date(cached.expiresAt) > new Date()) {
        return cached;
      }

      const preview = await buildInvitePreview(code);

      if (!preview) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Invite code is invalid or expired.",
        });
      }

      await cacheInvitePreview(code, preview);

      return preview;
    }),

  requestJoin: protectedProcedure
    .input(inviteCodeInput)
    .mutation(async ({ ctx, input }) => {
      const code = normalizeInviteCode(input.code);
      const invite = await getValidInviteByCode(code);

      if (!invite) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Invite code is invalid or expired.",
        });
      }

      const [membership] = await db
        .select({ spaceId: userSpaceSchema.spaceId })
        .from(userSpaceSchema)
        .where(
          and(
            eq(userSpaceSchema.spaceId, invite.spaceId),
            eq(userSpaceSchema.userId, ctx.user.id),
          ),
        )
        .limit(1);

      if (membership) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "You are already a member of this space.",
        });
      }

      const [pending] = await db
        .select({ id: joinRequestSchema.id })
        .from(joinRequestSchema)
        .where(
          and(
            eq(joinRequestSchema.spaceId, invite.spaceId),
            eq(joinRequestSchema.userId, ctx.user.id),
            eq(joinRequestSchema.status, "pending"),
          ),
        )
        .limit(1);

      if (pending) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "You already have a pending request for this space.",
        });
      }

      const [request] = await db
        .insert(joinRequestSchema)
        .values({
          spaceId: invite.spaceId,
          userId: ctx.user.id,
          status: "pending",
        })
        .returning({
          id: joinRequestSchema.id,
          spaceId: joinRequestSchema.spaceId,
          status: joinRequestSchema.status,
          createdAt: joinRequestSchema.createdAt,
          updatedAt: joinRequestSchema.updatedAt,
        });

      await invalidateJoinRequestCaches({
        ownerId: invite.ownerId,
        requesterId: ctx.user.id,
      });

      const spaceName = await getSpaceName(invite.spaceId);
      await createNotification({
        userId: invite.ownerId,
        type: "space_join_requested",
        title: "New join request",
        body: spaceName
          ? `${ctx.user.name} asked to join "${spaceName}".`
          : `${ctx.user.name} asked to join your space.`,
        data: { spaceId: invite.spaceId },
      });

      return request;
    }),

  listIncomingJoinRequests: protectedProcedure
    .input(joinRequestListInput)
    .query(async ({ ctx, input }) => {
      const params = input ?? { status: "pending" as const };
      const cacheKey = redisKeys.joinRequestsIncoming(
        ctx.user.id,
        requestCacheParams(params),
      );
      const cached = await safeGetJson<
        Awaited<ReturnType<typeof listIncomingJoinRequests>>
      >(cacheKey);

      if (cached) {
        return cached;
      }

      const result = await listIncomingJoinRequests(ctx.user.id, params);
      await safeSetJson(cacheKey, result, redisTtl.short * 2);

      return result;
    }),

  listOutgoingJoinRequests: protectedProcedure
    .input(joinRequestListInput)
    .query(async ({ ctx, input }) => {
      const params = input ?? { status: "pending" as const };
      const cacheKey = redisKeys.joinRequestsOutgoing(
        ctx.user.id,
        requestCacheParams(params),
      );
      const cached = await safeGetJson<
        Awaited<ReturnType<typeof listOutgoingJoinRequests>>
      >(cacheKey);

      if (cached) {
        return cached;
      }

      const result = await listOutgoingJoinRequests(ctx.user.id, params);
      await safeSetJson(cacheKey, result, redisTtl.short * 2);

      return result;
    }),

  acceptJoinRequest: protectedProcedure
    .input(joinRequestIdInput)
    .mutation(async ({ ctx, input }) => {
      const request = await requireIncomingJoinRequest(input.id, ctx.user.id);

      if (request.status !== "pending") {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Only pending requests can be accepted.",
        });
      }

      await dbPool.transaction(async (tx) => {
        await tx
          .update(joinRequestSchema)
          .set({ status: "accepted", updatedAt: new Date() })
          .where(eq(joinRequestSchema.id, input.id));
        await tx
          .insert(userSpaceSchema)
          .values({
            spaceId: request.spaceId,
            userId: request.userId,
            isDefault: false,
          })
          .onConflictDoNothing();
      });

      await invalidateJoinRequestCaches({
        ownerId: ctx.user.id,
        requesterId: request.userId,
      });
      await invalidateSpaceCaches(ctx.user.id, request.spaceId);
      await invalidateSpaceCaches(request.userId, request.spaceId);

      const spaceName = await getSpaceName(request.spaceId);
      await createNotification({
        userId: request.userId,
        type: "space_join_accepted",
        title: "Join request accepted",
        body: spaceName
          ? `You're now a member of "${spaceName}".`
          : "Your request to join a space was accepted.",
        data: { spaceId: request.spaceId },
      });

      return { success: true };
    }),

  rejectJoinRequest: protectedProcedure
    .input(joinRequestIdInput)
    .mutation(async ({ ctx, input }) => {
      const request = await requireIncomingJoinRequest(input.id, ctx.user.id);

      if (request.status !== "pending") {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Only pending requests can be rejected.",
        });
      }

      await db
        .update(joinRequestSchema)
        .set({ status: "rejected", updatedAt: new Date() })
        .where(eq(joinRequestSchema.id, input.id));

      await invalidateJoinRequestCaches({
        ownerId: ctx.user.id,
        requesterId: request.userId,
      });

      const spaceName = await getSpaceName(request.spaceId);
      await createNotification({
        userId: request.userId,
        type: "space_join_rejected",
        title: "Join request declined",
        body: spaceName
          ? `Your request to join "${spaceName}" wasn't approved.`
          : "Your request to join a space wasn't approved.",
        data: { spaceId: request.spaceId },
      });

      return { success: true };
    }),

  cancelJoinRequest: protectedProcedure
    .input(joinRequestIdInput)
    .mutation(async ({ ctx, input }) => {
      const request = await requireOutgoingJoinRequest(input.id, ctx.user.id);

      if (request.status !== "pending") {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Only pending requests can be canceled.",
        });
      }

      await db
        .update(joinRequestSchema)
        .set({ status: "canceled", updatedAt: new Date() })
        .where(eq(joinRequestSchema.id, input.id));

      await invalidateJoinRequestCaches({
        ownerId: request.ownerId,
        requesterId: ctx.user.id,
      });

      return { success: true };
    }),
});

async function listSpaces(userId: string, params: z.infer<typeof pageInput>) {
  const rows = await db
    .select({
      id: spaceSchema.id,
      name: spaceSchema.name,
      ownerId: spaceSchema.ownerId,
      isDefault: userSpaceSchema.isDefault,
      createdAt: spaceSchema.createdAt,
      updatedAt: spaceSchema.updatedAt,
    })
    .from(userSpaceSchema)
    .innerJoin(spaceSchema, eq(userSpaceSchema.spaceId, spaceSchema.id))
    .where(eq(userSpaceSchema.userId, userId));

  const hydrated = await hydrateSpaceRows(
    rows.map((row) => ({
      ...row,
      userId,
      isDefault: row.isDefault === true,
    })),
  );

  const search = params.search?.toLowerCase() ?? "";
  const filtered = hydrated
    .filter((space) => {
      if (!search) return true;
      return space.name.toLowerCase().includes(search);
    })
    .filter((space) => {
      if (params.filter === "default") return space.isDefault;
      if (params.filter === "shared") return space.memberCount > 1;
      if (params.filter === "owned") return space.role === "owner";
      if (params.filter === "member") return space.role === "member";
      return true;
    })
    .sort((a, b) => compareSpaces(a, b, params.sort));

  const total = filtered.length;
  const pageCount = Math.max(1, Math.ceil(total / params.pageSize));
  const page = Math.min(params.page, pageCount);
  const start = (page - 1) * params.pageSize;
  const items = filtered.slice(start, start + params.pageSize);

  return {
    items,
    page,
    pageSize: params.pageSize,
    total,
    pageCount,
    summary: {
      totalSpaces: hydrated.length,
      defaultSpace: hydrated.find((space) => space.isDefault)?.name ?? null,
      ownedSpaces: hydrated.filter((space) => space.role === "owner").length,
      memberSpaces: hydrated.filter((space) => space.role === "member").length,
      sharedSpaces: hydrated.filter((space) => space.memberCount > 1).length,
    },
  };
}

async function listIncomingJoinRequests(
  ownerId: string,
  params: z.infer<typeof joinRequestListParams>,
) {
  const ownedSpaces = await db
    .select({ id: spaceSchema.id })
    .from(spaceSchema)
    .where(eq(spaceSchema.ownerId, ownerId));
  const ownedSpaceIds = ownedSpaces.map((space) => space.id);

  if (ownedSpaceIds.length === 0) {
    return [];
  }

  if (params.spaceId) {
    await requireSpaceOwner(params.spaceId, ownerId);
  }

  const rows = await db
    .select({
      id: joinRequestSchema.id,
      spaceId: joinRequestSchema.spaceId,
      spaceName: spaceSchema.name,
      requesterId: joinRequestSchema.userId,
      requesterName: userSchema.name,
      status: joinRequestSchema.status,
      createdAt: joinRequestSchema.createdAt,
      updatedAt: joinRequestSchema.updatedAt,
    })
    .from(joinRequestSchema)
    .innerJoin(spaceSchema, eq(joinRequestSchema.spaceId, spaceSchema.id))
    .innerJoin(userSchema, eq(joinRequestSchema.userId, userSchema.id))
    .where(
      and(
        inArray(joinRequestSchema.spaceId, params.spaceId ? [params.spaceId] : ownedSpaceIds),
        params.status === "all"
          ? undefined
          : eq(joinRequestSchema.status, params.status),
      ),
    );

  return rows.sort(
    (a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0),
  );
}

async function listOutgoingJoinRequests(
  userId: string,
  params: z.infer<typeof joinRequestListParams>,
) {
  const rows = await db
    .select({
      id: joinRequestSchema.id,
      spaceId: joinRequestSchema.spaceId,
      spaceName: spaceSchema.name,
      ownerId: spaceSchema.ownerId,
      status: joinRequestSchema.status,
      createdAt: joinRequestSchema.createdAt,
      updatedAt: joinRequestSchema.updatedAt,
    })
    .from(joinRequestSchema)
    .innerJoin(spaceSchema, eq(joinRequestSchema.spaceId, spaceSchema.id))
    .where(
      and(
        eq(joinRequestSchema.userId, userId),
        params.spaceId ? eq(joinRequestSchema.spaceId, params.spaceId) : undefined,
        params.status === "all"
          ? undefined
          : eq(joinRequestSchema.status, params.status),
      ),
    );

  return rows.sort(
    (a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0),
  );
}

async function requireSpaceOwner(spaceId: string, userId: string) {
  const [space] = await db
    .select({
      id: spaceSchema.id,
      name: spaceSchema.name,
      ownerId: spaceSchema.ownerId,
      inviteCode: spaceSchema.inviteCode,
      inviteCodeExpiresAt: spaceSchema.inviteCodeExpiresAt,
    })
    .from(spaceSchema)
    .where(and(eq(spaceSchema.id, spaceId), eq(spaceSchema.ownerId, userId)))
    .limit(1);

  if (!space) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Only the space owner can manage invites.",
    });
  }

  return space;
}

async function requireIncomingJoinRequest(id: string, ownerId: string) {
  const [request] = await db
    .select({
      id: joinRequestSchema.id,
      spaceId: joinRequestSchema.spaceId,
      userId: joinRequestSchema.userId,
      status: joinRequestSchema.status,
    })
    .from(joinRequestSchema)
    .innerJoin(spaceSchema, eq(joinRequestSchema.spaceId, spaceSchema.id))
    .where(and(eq(joinRequestSchema.id, id), eq(spaceSchema.ownerId, ownerId)))
    .limit(1);

  if (!request) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Join request was not found.",
    });
  }

  return request;
}

async function requireOutgoingJoinRequest(id: string, userId: string) {
  const [request] = await db
    .select({
      id: joinRequestSchema.id,
      spaceId: joinRequestSchema.spaceId,
      ownerId: spaceSchema.ownerId,
      status: joinRequestSchema.status,
    })
    .from(joinRequestSchema)
    .innerJoin(spaceSchema, eq(joinRequestSchema.spaceId, spaceSchema.id))
    .where(and(eq(joinRequestSchema.id, id), eq(joinRequestSchema.userId, userId)))
    .limit(1);

  if (!request) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Join request was not found.",
    });
  }

  return request;
}

async function getValidInviteByCode(code: string) {
  const [space] = await db
    .select({
      spaceId: spaceSchema.id,
      spaceName: spaceSchema.name,
      ownerId: spaceSchema.ownerId,
      expiresAt: spaceSchema.inviteCodeExpiresAt,
    })
    .from(spaceSchema)
    .where(
      and(
        eq(spaceSchema.inviteCode, code),
        gt(spaceSchema.inviteCodeExpiresAt, new Date()),
      ),
    )
    .limit(1);

  if (!space?.expiresAt) {
    return null;
  }

  return {
    ...space,
    expiresAt: space.expiresAt,
  };
}

async function buildInvitePreview(code: string): Promise<InvitePreview | null> {
  const invite = await getValidInviteByCode(code);

  if (!invite) {
    return null;
  }

  const [memberCountResult] = await db
    .select({ count: count() })
    .from(userSpaceSchema)
    .where(eq(userSpaceSchema.spaceId, invite.spaceId));

  return {
    spaceId: invite.spaceId,
    spaceName: invite.spaceName,
    memberCount: Number(memberCountResult?.count ?? 0),
    expiresAt: invite.expiresAt,
  };
}

async function cacheInvitePreview(code: string, preview: InvitePreview) {
  const ttlSeconds = Math.max(
    0,
    Math.min(redisTtl.day, Math.floor((new Date(preview.expiresAt).getTime() - Date.now()) / 1000)),
  );

  if (ttlSeconds <= 0) {
    return false;
  }

  return safeSetJson(redisKeys.spacesInvite(code), preview, ttlSeconds);
}

async function generateUniqueInviteCode() {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const code = generateInviteCode();
    const [existing] = await db
      .select({ id: spaceSchema.id })
      .from(spaceSchema)
      .where(eq(spaceSchema.inviteCode, code))
      .limit(1);

    if (!existing) {
      return code;
    }
  }

  throw new TRPCError({
    code: "CONFLICT",
    message: "Could not generate a unique invite code. Try again.",
  });
}

function generateInviteCode() {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const parts = Array.from({ length: 3 }, () =>
    Array.from({ length: 4 }, () =>
      alphabet[Math.floor(Math.random() * alphabet.length)],
    ).join(""),
  );

  return parts.join("-");
}

function normalizeInviteCode(code: string) {
  return code.trim().toUpperCase();
}

async function getMembership(spaceId: string, userId: string) {
  const cacheKey = redisKeys.spacesMembership(spaceId, userId);
  const cached = await safeGetJson<
    | {
        id: string;
        name: string;
        ownerId: string;
        isDefault: boolean;
        createdAt: Date | null;
        updatedAt: Date | null;
      }
    | null
  >(cacheKey);

  if (cached) {
    return cached;
  }

  const [membership] = await db
    .select({
      id: spaceSchema.id,
      name: spaceSchema.name,
      ownerId: spaceSchema.ownerId,
      isDefault: userSpaceSchema.isDefault,
      createdAt: spaceSchema.createdAt,
      updatedAt: spaceSchema.updatedAt,
    })
    .from(userSpaceSchema)
    .innerJoin(spaceSchema, eq(userSpaceSchema.spaceId, spaceSchema.id))
    .where(
      and(eq(userSpaceSchema.spaceId, spaceId), eq(userSpaceSchema.userId, userId)),
    )
    .limit(1);

  if (!membership) {
    return null;
  }

  const value = {
    ...membership,
    isDefault: membership.isDefault === true,
  };
  await safeSetJson(cacheKey, value, redisTtl.medium);

  return value;
}

async function hydrateSpaceRows(
  rows: Array<{
    id: string;
    name: string;
    ownerId: string;
    isDefault: boolean;
    createdAt: Date | null;
    updatedAt: Date | null;
    userId: string;
  }>,
) {
  return Promise.all(rows.map(hydrateSpaceRow));
}

async function hydrateSpaceRow(row: {
  id: string;
  name: string;
  ownerId: string;
  isDefault: boolean;
  createdAt: Date | null;
  updatedAt: Date | null;
  userId: string;
}): Promise<SpaceListItem> {
  const [memberCountResult] = await db
    .select({ count: count() })
    .from(userSpaceSchema)
    .where(eq(userSpaceSchema.spaceId, row.id));
  const [sourceCountResult] = await db
    .select({ count: count() })
    .from(sourceSchema)
    .where(eq(sourceSchema.spaceId, row.id));
  const transactionCount = await getTransactionCount(row.id);

  return {
    id: row.id,
    name: row.name,
    ownerId: row.ownerId,
    role: row.ownerId === row.userId ? "owner" : "member",
    isDefault: row.isDefault,
    memberCount: Number(memberCountResult?.count ?? 0),
    sourceCount: Number(sourceCountResult?.count ?? 0),
    transactionCount,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

async function getTransactionCount(spaceId: string) {
  const [result] = await db
    .select({ count: count() })
    .from(transactionSchema)
    .where(eq(transactionSchema.spaceId, spaceId));

  return Number(result?.count ?? 0);
}

async function getSpaceName(spaceId: string) {
  const [space] = await db
    .select({ name: spaceSchema.name })
    .from(spaceSchema)
    .where(eq(spaceSchema.id, spaceId))
    .limit(1);

  return space?.name ?? null;
}

async function setFirstAvailableDefault(userId: string, excludedSpaceId: string) {
  const [fallback] = await db
    .select({ spaceId: userSpaceSchema.spaceId })
    .from(userSpaceSchema)
    .where(eq(userSpaceSchema.userId, userId));

  if (!fallback || fallback.spaceId === excludedSpaceId) {
    return;
  }

  await db
    .update(userSpaceSchema)
    .set({ isDefault: true, updatedAt: new Date() })
    .where(
      and(
        eq(userSpaceSchema.userId, userId),
        eq(userSpaceSchema.spaceId, fallback.spaceId),
      ),
    );
}

async function invalidateSpaceCaches(userId: string, spaceId: string) {
  await safeDelByKeys([
    redisKeys.accountMe(userId),
    redisKeys.spacesDefault(userId),
    redisKeys.spacesList(userId, "default"),
    redisKeys.spacesDetail(spaceId),
    redisKeys.spacesMembership(spaceId, userId),
  ]);
  await safeDel(redisKeys.spacesList(userId, cacheParams(pageInput.parse({}))));
}

async function invalidateJoinRequestCaches({
  ownerId,
  requesterId,
}: {
  ownerId: string;
  requesterId: string;
}) {
  await safeDelByKeys([
    redisKeys.joinRequestsIncoming(ownerId, "default"),
    redisKeys.joinRequestsOutgoing(requesterId, "default"),
    redisKeys.joinRequestsIncoming(
      ownerId,
      requestCacheParams(joinRequestListParams.parse({})),
    ),
    redisKeys.joinRequestsOutgoing(
      requesterId,
      requestCacheParams(joinRequestListParams.parse({})),
    ),
  ]);
}

function compareSpaces(
  a: SpaceListItem,
  b: SpaceListItem,
  sort: z.infer<typeof pageInput>["sort"],
) {
  if (sort === "name") {
    return a.name.localeCompare(b.name);
  }

  const aDate = sort === "created" ? a.createdAt : a.updatedAt ?? a.createdAt;
  const bDate = sort === "created" ? b.createdAt : b.updatedAt ?? b.createdAt;

  return (bDate?.getTime() ?? 0) - (aDate?.getTime() ?? 0);
}

function cacheParams(params: z.infer<typeof pageInput>) {
  if (
    params.page === 1 &&
    params.pageSize === 12 &&
    params.filter === "all" &&
    params.sort === "recent" &&
    !params.search
  ) {
    return "default";
  }

  return encodeURIComponent(JSON.stringify(params));
}

function requestCacheParams(params: z.infer<typeof joinRequestListParams>) {
  if (params.status === "pending" && !params.spaceId) {
    return "default";
  }

  return encodeURIComponent(JSON.stringify(params));
}
