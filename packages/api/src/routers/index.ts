import { protectedProcedure, publicProcedure, router } from "../index";
import { githubRouter } from "./github";

export const appRouter = router({
	github: githubRouter,
	healthCheck: publicProcedure.query(() => "OK"),
	privateData: protectedProcedure.query(({ ctx }) => ({
		message: "This is private",
		user: ctx.session.user,
	})),
});
export type AppRouter = typeof appRouter;
