import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";

export type TRPCContext = {
  session: {
    user: {
      id: string;
      name: string;
      image?: string | null;
      onboarded?: boolean;
      lastLoginMethod?: string | null;
      banned?: boolean | null;
      accountStatus?: "active" | "deactivated" | null;
    };
    session: {
      createdAt: Date;
      updatedAt: Date;
      expiresAt: Date;
      userAgent?: string | null;
    };
  } | null;
  headers: Headers;
};

const t = initTRPC.context<TRPCContext>().create({
  transformer: superjson,
});

export const createTRPCRouter = t.router;
export const createCallerFactory = t.createCallerFactory;
export const publicProcedure = t.procedure;

export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.session?.user) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Authentication is required.",
    });
  }

  if (ctx.session.user.accountStatus === "deactivated") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "This account has been deactivated.",
    });
  }

  return next({
    ctx: {
      session: ctx.session,
      user: ctx.session.user,
    },
  });
});

export type PaginatedResponse<TItem> = {
  items: TItem[];
  page: number;
  pageSize: number;
  total: number;
  pageCount: number;
};
