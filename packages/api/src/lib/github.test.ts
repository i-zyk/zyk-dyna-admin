import { afterEach, describe, expect, it, vi } from "vitest";

import {
	createGithubClient,
	type FetchLike,
	GithubApiError,
	type GithubApiErrorKind,
} from "./github";

const GITHUB_REQUEST_TIMEOUT_MS = 10_000;

const torvaldsResponse = {
	avatar_url: "https://avatars.githubusercontent.com/u/1024025?v=4",
	bio: null,
	blog: "",
	company: "Linux Foundation",
	created_at: "2011-09-03T15:26:22Z",
	email: null,
	followers: 200_000,
	following: 0,
	html_url: "https://github.com/torvalds",
	id: 1_024_025,
	location: "Portland, OR",
	login: "torvalds",
	name: "Linus Torvalds",
	node_id: "MDQ6VXNlcjEwMjQwMjU=",
	public_repos: 7,
	site_admin: false,
	type: "User",
};

const jsonResponse = (body: unknown, status = 200): Response =>
	new Response(JSON.stringify(body), {
		headers: { "Content-Type": "application/json" },
		status,
	});

interface FetchCall {
	init: RequestInit;
	input: string;
}

/** A fake fetch that records every call and answers with the given handler. */
const createFakeFetch = (handler: (init: RequestInit) => Promise<Response>) => {
	const calls: FetchCall[] = [];
	const fetchImpl: FetchLike = (input, init) => {
		calls.push({ init, input });
		return handler(init);
	};
	return { calls, fetchImpl };
};

const respondWith = (body: unknown, status = 200) =>
	createFakeFetch(() => Promise.resolve(jsonResponse(body, status)));

const headersOf = (call: FetchCall | undefined): Record<string, string> =>
	Object.fromEntries(new Headers(call?.init.headers).entries());

const expectGithubError = async (
	promise: Promise<unknown>,
	kind: GithubApiErrorKind
) => {
	const error = await promise.then(
		() => null,
		(reason: unknown) => reason
	);
	expect(error).toBeInstanceOf(GithubApiError);
	expect(error).toMatchObject({ kind });
};

afterEach(() => {
	vi.restoreAllMocks();
});

describe("createGithubClient().getUser", () => {
	it("200 时只返回 GithubUserProfile 字段，丢弃多余字段，空字符串转 null", async () => {
		const { calls, fetchImpl } = respondWith(torvaldsResponse);

		const profile = await createGithubClient({}, fetchImpl).getUser("torvalds");

		expect(profile).toStrictEqual({
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
		});
		expect(calls).toHaveLength(1);
		expect(calls[0]?.input).toBe("https://api.github.com/users/torvalds");
		expect(calls[0]?.init.method).toBe("GET");
	});

	it("name、bio、company、location 为空字符串或缺失时都转 null", async () => {
		const { fetchImpl } = respondWith({
			...torvaldsResponse,
			bio: "   ",
			company: "",
			location: undefined,
			name: "",
		});

		const profile = await createGithubClient({}, fetchImpl).getUser("torvalds");

		expect(profile).toMatchObject({
			bio: null,
			company: null,
			location: null,
			name: null,
		});
	});

	it("请求头带 Accept、User-Agent 和 API 版本", async () => {
		const { calls, fetchImpl } = respondWith(torvaldsResponse);

		await createGithubClient({}, fetchImpl).getUser("torvalds");

		expect(headersOf(calls[0])).toMatchObject({
			accept: "application/vnd.github+json",
			"user-agent": "zyk-dyna-admin",
			"x-github-api-version": "2022-11-28",
		});
	});

	it("未配置 Token 时没有 Authorization 头", async () => {
		const { calls, fetchImpl } = respondWith(torvaldsResponse);

		await createGithubClient({}, fetchImpl).getUser("torvalds");

		expect(headersOf(calls[0])).not.toHaveProperty("authorization");
	});

	it("GITHUB_TOKEN 为空字符串时也不带 Authorization 头", async () => {
		const { calls, fetchImpl } = respondWith(torvaldsResponse);

		await createGithubClient({ GITHUB_TOKEN: "" }, fetchImpl).getUser(
			"torvalds"
		);

		expect(headersOf(calls[0])).not.toHaveProperty("authorization");
	});

	it("配置 Token 后 Authorization 为 Bearer <token>", async () => {
		const { calls, fetchImpl } = respondWith(torvaldsResponse);

		await createGithubClient(
			{ GITHUB_TOKEN: "ghp_test123" },
			fetchImpl
		).getUser("torvalds");

		expect(headersOf(calls[0])).toMatchObject({
			authorization: "Bearer ghp_test123",
		});
	});

	it("404 → not_found", async () => {
		const { fetchImpl } = respondWith({ message: "Not Found" }, 404);

		await expectGithubError(
			createGithubClient({}, fetchImpl).getUser("nobody"),
			"not_found"
		);
	});

	it.each([403, 429])("%i → rate_limited", async (status) => {
		const { fetchImpl } = respondWith(
			{ message: "API rate limit exceeded" },
			status
		);

		await expectGithubError(
			createGithubClient({}, fetchImpl).getUser("torvalds"),
			"rate_limited"
		);
	});

	it.each([500, 502, 401])("%i → upstream", async (status) => {
		const { fetchImpl } = respondWith({ message: "Server Error" }, status);

		await expectGithubError(
			createGithubClient({}, fetchImpl).getUser("torvalds"),
			"upstream"
		);
	});

	it("网络异常 → upstream", async () => {
		const { fetchImpl } = createFakeFetch(() =>
			Promise.reject(new TypeError("fetch failed"))
		);

		await expectGithubError(
			createGithubClient({}, fetchImpl).getUser("torvalds"),
			"upstream"
		);
	});

	it("请求设置 10 秒超时，超时 → upstream", async () => {
		const timeoutSpy = vi
			.spyOn(AbortSignal, "timeout")
			.mockImplementation(() =>
				AbortSignal.abort(
					new DOMException("The operation timed out.", "TimeoutError")
				)
			);
		// Behaves like real fetch: rejects with the signal's reason once aborted
		const { calls, fetchImpl } = createFakeFetch((init) =>
			init.signal?.aborted
				? Promise.reject(init.signal.reason)
				: Promise.resolve(jsonResponse(torvaldsResponse))
		);

		await expectGithubError(
			createGithubClient({}, fetchImpl).getUser("torvalds"),
			"upstream"
		);
		expect(timeoutSpy).toHaveBeenCalledWith(GITHUB_REQUEST_TIMEOUT_MS);
		expect(calls[0]?.init.signal).toBeInstanceOf(AbortSignal);
	});

	it("响应结构不对 → upstream", async () => {
		const { fetchImpl } = respondWith({ login: "torvalds" });

		await expectGithubError(
			createGithubClient({}, fetchImpl).getUser("torvalds"),
			"upstream"
		);
	});

	it("响应不是 JSON → upstream", async () => {
		const { fetchImpl } = createFakeFetch(() =>
			Promise.resolve(new Response("<html>oops</html>", { status: 200 }))
		);

		await expectGithubError(
			createGithubClient({}, fetchImpl).getUser("torvalds"),
			"upstream"
		);
	});

	it("错误信息不包含 Token", async () => {
		const token = "ghp_secret_value";
		const { fetchImpl } = createFakeFetch(() =>
			Promise.reject(new TypeError("fetch failed"))
		);

		const error = await createGithubClient({ GITHUB_TOKEN: token }, fetchImpl)
			.getUser("torvalds")
			.catch((reason: unknown) => reason);

		expect(error).toBeInstanceOf(GithubApiError);
		expect(error instanceof GithubApiError && error.message).not.toContain(
			token
		);
	});
});
