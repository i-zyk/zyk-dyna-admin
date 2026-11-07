import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { protectedProcedure, router } from "../index";
import { GithubApiError, type GithubApiErrorKind } from "../lib/github";
import { githubUsernameSchema } from "../lib/github-username";

type TrpcErrorCode = TRPCError["code"];

/** Generic messages only: never echo the token or GitHub's raw response. */
const TRPC_ERROR_BY_KIND: Record<
	GithubApiErrorKind,
	{ code: TrpcErrorCode; message: string }
> = {
	not_found: { code: "NOT_FOUND", message: "GitHub user not found" },
	rate_limited: {
		code: "TOO_MANY_REQUESTS",
		message: "GitHub API rate limit exceeded",
	},
	upstream: {
		code: "INTERNAL_SERVER_ERROR",
		message: "Failed to fetch GitHub user",
	},
};

const toTrpcError = (error: GithubApiError): TRPCError => {
	const { code, message } = TRPC_ERROR_BY_KIND[error.kind];
	return new TRPCError({ cause: error, code, message });
};

export const githubRouter = router({
	getUser: protectedProcedure
		.input(z.object({ username: githubUsernameSchema }))
		.query(async ({ ctx, input }) => {
			try {
				return await ctx.github.getUser(input.username);
			} catch (error) {
				if (error instanceof GithubApiError) {
					throw toTrpcError(error);
				}
				throw error;
			}
		}),
});
