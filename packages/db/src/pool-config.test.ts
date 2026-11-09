import { describe, expect, it, vi } from "vitest";

import { createPoolConfig } from "./pool-config";

describe("database authentication", () => {
	it("preserves password-based local connections", () => {
		const url = "postgresql://local:password@localhost:5432/development";
		expect(createPoolConfig({ DATABASE_URL: url }).connectionString).toBe(url);
	});

	it("uses a fresh token for each connection and enforces TLS verification", async () => {
		const password = vi
			.fn()
			.mockResolvedValueOnce("first-token")
			.mockResolvedValueOnce("refreshed-token");
		const options = createPoolConfig({
			DATABASE_URL: "postgresql://app_user@db.example:5432/app?sslmode=disable",
			password,
		});
		expect(options.connectionString).toBeUndefined();
		expect(options.ssl).toEqual({ rejectUnauthorized: true });
		expect(options.user).toBe("app_user");
		expect(options.host).toBe("db.example");
		expect(options.database).toBe("app");
		expect(typeof options.password).toBe("function");
		if (typeof options.password !== "function") {
			throw new Error("Expected a password provider");
		}
		expect(await options.password()).toBe("first-token");
		expect(await options.password()).toBe("refreshed-token");
	});

	it("rejects a static password that could accidentally replace the IAM token", () => {
		expect(() =>
			createPoolConfig({
				DATABASE_URL: "postgresql://app_user:stale@db.example/app",
				password: async () => "token",
			})
		).toThrow("must not contain a static password");
	});
});
