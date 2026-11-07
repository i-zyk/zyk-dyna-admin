import type { Database } from "@zyk-dyna-admin/db";
import { describe, expect, it } from "vitest";

import type { GithubClient } from "../lib/github";

import { appRouter } from "./index";

const fakeGithub: GithubClient = {
	getUser: () => Promise.reject(new Error("not used in these tests")),
};

const createCaller = () =>
	appRouter.createCaller({
		db: {} as Database,
		github: fakeGithub,
		session: null,
	});

describe("appRouter", () => {
	it("healthCheck 返回 OK", async () => {
		await expect(createCaller().healthCheck()).resolves.toBe("OK");
	});

	it("未登录访问 privateData 返回 UNAUTHORIZED", async () => {
		await expect(createCaller().privateData()).rejects.toMatchObject({
			code: "UNAUTHORIZED",
		});
	});
});
