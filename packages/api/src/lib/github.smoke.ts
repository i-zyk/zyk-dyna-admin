/**
 * Real GitHub smoke test (R03 task 7.5). It hits https://api.github.com, so it is
 * excluded from `pnpm run test` and only runs on demand:
 *
 *   pnpm --dir packages/api run test:smoke
 *
 * The client is created without a token on purpose, to prove anonymous calls work
 * when `GITHUB_TOKEN` is not configured. Anonymous calls share a 60 requests/hour
 * per-IP quota, so a `rate_limited` failure here means "try again later".
 */
import type { Session } from "@zyk-dyna-admin/auth";
import type { Database } from "@zyk-dyna-admin/db";
import { describe, expect, it } from "vitest";

import { appRouter } from "../routers/index";

import { createGithubClient } from "./github";

const HTTPS_URL_PATTERN = /^https:\/\//;
const ISO_DATE_TIME_PATTERN = /^\d{4}-\d{2}-\d{2}T/;

/** Only the presence of a session matters to `protectedProcedure`. */
const fakeSession = { session: {}, user: {} } as Session;

describe("real GitHub without GITHUB_TOKEN", () => {
	it("github.getUser finds torvalds", async () => {
		const github = createGithubClient({});
		const caller = appRouter.createCaller({
			db: {} as Database,
			github,
			session: fakeSession,
		});

		const profile = await caller.github.getUser({ username: "torvalds" });

		expect(profile.login.toLowerCase()).toBe("torvalds");
		expect(profile.htmlUrl).toBe("https://github.com/torvalds");
		expect(profile.avatarUrl).toMatch(HTTPS_URL_PATTERN);
		expect(profile.createdAt).toMatch(ISO_DATE_TIME_PATTERN);
		expect(profile.publicRepos).toBeGreaterThan(0);
		expect(profile.followers).toBeGreaterThan(0);
		expect(profile.following).toBeGreaterThanOrEqual(0);
		expect(Object.keys(profile).sort()).toEqual([
			"avatarUrl",
			"bio",
			"blog",
			"company",
			"createdAt",
			"followers",
			"following",
			"htmlUrl",
			"location",
			"login",
			"name",
			"publicRepos",
		]);
	});
});
