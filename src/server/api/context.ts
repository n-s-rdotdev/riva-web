import { auth } from "@/lib/auth";
import type { TRPCContext } from "./trpc";

export async function createTRPCContext(opts: {
  headers: Headers;
}): Promise<TRPCContext> {
  const session = await auth.api.getSession({
    headers: opts.headers,
  });

  return {
    session,
    headers: opts.headers,
  } as TRPCContext;
}
