import { afterEach, describe, expect, it, vi } from "vitest";

import { forwardApiRequest } from "./api-proxy";

afterEach(() => vi.unstubAllGlobals());

describe("API proxy", () => {
	it("forwards the stage, query, body and login cookie without trusting forwarded headers", async () => {
		const upstream = vi.fn().mockResolvedValue(new Response("ok"));
		vi.stubGlobal("fetch", upstream);
		await forwardApiRequest(
			new Request("https://web.example/trpc/person.update?batch=1", {
				body: '{"id":"1"}',
				headers: {
					cookie: "session=secret",
					origin: "https://web.example",
					"x-forwarded-host": "attacker.example",
				},
				method: "POST",
			}),
			"https://api.example/prod/"
		);
		const [url, options] = upstream.mock.calls[0];
		expect(String(url)).toBe(
			"https://api.example/prod/trpc/person.update?batch=1"
		);
		expect(options.headers.get("cookie")).toBe("session=secret");
		expect(options.headers.get("origin")).toBe("https://web.example");
		expect(options.headers.has("x-forwarded-host")).toBe(false);
		expect(new TextDecoder().decode(options.body)).toBe('{"id":"1"}');
		expect(options.redirect).toBe("manual");
	});

	it("preserves separate cookies and prevents caching authenticated responses", async () => {
		const headers = new Headers();
		headers.append("set-cookie", "session=one; HttpOnly; Secure; Path=/");
		headers.append("set-cookie", "other=two; HttpOnly; Secure; Path=/");
		headers.set("cache-control", "public, max-age=3600");
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue(new Response("data", { headers }))
		);
		const response = await forwardApiRequest(
			new Request("https://web.example/api/auth/get-session"),
			"https://api.example"
		);
		expect(response.headers.getSetCookie()).toEqual(headers.getSetCookie());
		expect(response.headers.get("cache-control")).toBe("private, no-store");
		expect(await response.text()).toBe("data");
	});

	it("rejects a loop before making a request", async () => {
		const upstream = vi.fn();
		vi.stubGlobal("fetch", upstream);
		const response = await forwardApiRequest(
			new Request("https://web.example/trpc/test"),
			"https://web.example"
		);
		expect(response.status).toBe(503);
		expect(upstream).not.toHaveBeenCalled();
	});

	it("returns a generic error without leaking upstream credentials", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn().mockRejectedValue(new Error("secret connection data"))
		);
		const response = await forwardApiRequest(
			new Request("https://web.example/trpc/test"),
			"https://api.example"
		);
		expect(response.status).toBe(502);
		expect(await response.text()).not.toContain("secret");
	});
});
