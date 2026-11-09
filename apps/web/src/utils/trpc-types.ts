import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@zyk-dyna-admin/api/routers/index";

export type RouterOutputs = inferRouterOutputs<AppRouter>;
