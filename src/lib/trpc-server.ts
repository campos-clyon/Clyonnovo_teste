import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { getCurrentUser } from "./auth";
import type { User } from "../../drizzle/schema";

export type TrpcContext = {
  user: User | null;
};

export async function createContext(): Promise<TrpcContext> {
  let user: User | null = null;
  try {
    user = await getCurrentUser();
  } catch {
    user = null;
  }
  return { user };
}

const UNAUTHED_ERR_MSG = "Please login (10001)";
const NOT_ADMIN_ERR_MSG = "You do not have required permission (10002)";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;

const requireUser = t.middleware(async ({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }
  return next({ ctx: { ...ctx, user: ctx.user } });
});

export const protectedProcedure = t.procedure.use(requireUser);

export const adminProcedure = t.procedure.use(
  t.middleware(async ({ ctx, next }) => {
    if (!ctx.user || ctx.user.role !== "admin") {
      throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }
    return next({ ctx: { ...ctx, user: ctx.user } });
  })
);
