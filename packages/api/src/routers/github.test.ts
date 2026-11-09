import type { TRPCError } from "@trpc/server";
import type { Session } from "@zyk-dyna-admin/auth";
import type { Database } from "@zyk-dyna-admin/db";
import { describe, expect, it } from "vitest";

import {
	GithubApiError,
	type GithubApiErrorKind,
	type GithubClient,
	type GithubUserProfile,
} from "../lib/github";

import { appRouter } from "./index";

const MAX_GITHUB_USERNAME_LENGTH = 39;

const torvaldsProfile: GithubUserProfile = {
	avatarUrl: "https://avatars.githubusercontent.com/u/1024025?v=4",
	bio: null,
	blog: null,
	company: "Linux Foundation",
	createdAt: "2011-09-03T15:26:22Z",
	followers: 200_000,
	following: 0,
	githubId: "1024025",
	htmlUrl: "https://github.com/torvalds",
	location: "Portland, OR",
	login: "torvalds",
	name: "Linus Torvalds",
	publicRepos: 7,
};

/** Only the presence of a session matters to `protectedProcedure`. */
const fakeSession = { session: {}, user: {} } as Session;

/** A fake GitHub client that records requested usernames. */
const createFakeGithub = (
	getUser: GithubClient["getUser"] = () => Promise.resolve(torvaldsProfile)
) => {
	const calls: string[] = [];
	const github: GithubClient = {
		getUser: (username) => {
			calls.push(username);
			return getUser(username);
		},
	};
	return { calls, github };
};

const createCaller = (github: GithubClient, session: Session | null) =>
	appRouter.createCaller({ db: {} as Database, github, session });

const catchTrpcError = async (
	promise: Promise<unknown>
): Promise<TRPCError> => {
	try {
		await promise;
	} catch (error) {
		return error as TRPCError;
	}
	throw new Error("Expected the call to throw a TRPCError");
};

describe("github.getUser", () => {
	it("未登录时抛 UNAUTHORIZED 且不调用 GitHub", async () => {
		const { calls, github } = createFakeGithub();

		await expect(
			createCaller(github, null).github.getUser({ username: "torvalds" })
		).rejects.toMatchObject({ code: "UNAUTHORIZED" });
		expect(calls).toEqual([]);
	});

	it.each([
		["-abc"],
		["abc-"],
		["a--b"],
		["a".repeat(MAX_GITHUB_USERNAME_LENGTH + 1)],
		["a_b"],
		[""],
	])(
		"用户名 %j 格式不合法时抛 BAD_REQUEST 且不调用 GitHub",
		async (username) => {
			const { calls, github } = createFakeGithub();

			await expect(
				createCaller(github, fakeSession).github.getUser({ username })
			).rejects.toMatchObject({ code: "BAD_REQUEST" });
			expect(calls).toEqual([]);
		}
	);

	it("合法用户名 trim 后透传给 GitHub 客户端并返回资料", async () => {
		const { calls, github } = createFakeGithub();

		await expect(
			createCaller(github, fakeSession).github.getUser({
				username: " torvalds ",
			})
		).resolves.toEqual(torvaldsProfile);
		expect(calls).toEqual(["torvalds"]);
	});

	it("39 位用户名合法", async () => {
		const { calls, github } = createFakeGithub();
		const username = "a".repeat(MAX_GITHUB_USERNAME_LENGTH);

		await createCaller(github, fakeSession).github.getUser({ username });
		expect(calls).toEqual([username]);
	});

	it.each<[GithubApiErrorKind, TRPCError["code"]]>([
		["not_found", "NOT_FOUND"],
		["rate_limited", "TOO_MANY_REQUESTS"],
		["upstream", "INTERNAL_SERVER_ERROR"],
	])(
		"GithubApiError %s 映射为 %s，且不回显原始错误信息",
		async (kind, code) => {
			const rawMessage = "raw GitHub response with secret-token";
			const { github } = createFakeGithub(() =>
				Promise.reject(new GithubApiError(rawMessage, { kind }))
			);

			const error = await catchTrpcError(
				createCaller(github, fakeSession).github.getUser({
					username: "torvalds",
				})
			);

			expect(error.code).toBe(code);
			expect(error.message).not.toContain(rawMessage);
		}
	);

	it("其他异常抛 INTERNAL_SERVER_ERROR", async () => {
		const { github } = createFakeGithub(() =>
			Promise.reject(new Error("unexpected"))
		);

		await expect(
			createCaller(github, fakeSession).github.getUser({
				username: "torvalds",
			})
		).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
	});
});
