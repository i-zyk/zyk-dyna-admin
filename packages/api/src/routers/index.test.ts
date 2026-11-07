import type { Database } from "@zyk-dyna-admin/db";
import { describe, expect, it } from "vitest";

import { appRouter } from "./index";

const createCaller = () =>
	appRouter.createCaller({ db: {} as Database, session: null });

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
