import { protectedProcedure, publicProcedure, router } from "../index";
import { githubRouter } from "./github";
import { githubPersonRouter } from "./github-person";
import { personRouter } from "./person";

export const appRouter = router({
	github: githubRouter,
	githubPerson: githubPersonRouter,
	healthCheck: publicProcedure.query(() => "OK"),
	person: personRouter,
	privateData: protectedProcedure.query(({ ctx }) => ({
		message: "This is private",
		user: ctx.session.user,
	})),
});
export type AppRouter = typeof appRouter;
