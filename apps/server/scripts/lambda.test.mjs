import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { chmodSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const archivePath = resolve(
	dirname(fileURLToPath(import.meta.url)),
	"../dist/server-lambda.zip"
);
const runtimeEnv = {
	BETTER_AUTH_SECRET: randomBytes(32).toString("base64"),
	BETTER_AUTH_URL: "https://api.example.com",
	CORS_ORIGIN: "https://app.example.com",
	DATABASE_URL: "postgresql://ci:ci@127.0.0.1:1/ci",
	NODE_ENV: "production",
	PATH: process.env.PATH,
};

function runArchive(source, env = runtimeEnv) {
	const directory = mkdtempSync(join(tmpdir(), "server-lambda-test-"));
	try {
		execFileSync("unzip", ["-q", archivePath, "-d", directory]);
		chmodSync(directory, 0o555);
		return spawnSync(
			process.execPath,
			["--input-type=module", "--eval", source],
			{
				cwd: directory,
				encoding: "utf8",
				env,
				timeout: 20_000,
			}
		);
	} finally {
		chmodSync(directory, 0o700);
		rmSync(directory, { force: true, recursive: true });
	}
}

test("ZIP runs outside the workspace using only deployment environment variables", () => {
	const result = runArchive(`
		import assert from "node:assert/strict";
		import { existsSync, readdirSync } from "node:fs";
		import { handler } from "./index.mjs";

		const wasmFile = readdirSync(".").find((name) => name.startsWith("query_compiler_fast_bg.postgresql.wasm-base64-"));
		assert.ok(wasmFile, "Prisma query compiler must be included");
		const { wasm } = await import("./" + wasmFile);
		assert.ok(new WebAssembly.Module(Buffer.from(wasm, "base64")));

		function event(path, method = "GET", headers = {}) {
			return {
				version: "2.0",
				routeKey: "$default",
				rawPath: path,
				rawQueryString: "",
				headers: { host: "api.example.com", ...headers },
				requestContext: {
					domainName: "api.example.com",
					stage: "$default",
					http: { method, path, sourceIp: "127.0.0.1", protocol: "HTTP/1.1" },
				},
				isBase64Encoded: false,
			};
		}

		const context = { callbackWaitsForEmptyEventLoop: true };
		const root = await handler(event("/"), context);
		assert.equal(context.callbackWaitsForEmptyEventLoop, false);
		assert.equal(root.statusCode, 200);
		assert.equal(root.body, "OK");
		assert.equal(existsSync("src"), false, "Lambda must not generate source files at startup");

		const health = await handler(event("/trpc/healthCheck"));
		assert.equal(health.statusCode, 200);
		assert.equal(JSON.parse(health.body).result.data, "OK");

		const session = await handler(event("/api/auth/get-session"));
		assert.equal(session.statusCode, 200);
		assert.equal(JSON.parse(session.body), null);

		const privateData = await handler(event("/trpc/privateData"));
		assert.equal(privateData.statusCode, 401);

		const preflight = await handler(event("/trpc/healthCheck", "OPTIONS", {
			origin: "https://app.example.com",
			"access-control-request-method": "GET",
		}));
		assert.equal(preflight.statusCode, 204);
		assert.equal(preflight.headers["access-control-allow-origin"], "https://app.example.com");
		assert.equal(preflight.headers["access-control-allow-credentials"], "true");
	`);
	assert.equal(result.error, undefined);
	assert.equal(result.status, 0, result.stderr || result.stdout);
});

test("IAM mode initializes without a static database password", () => {
	const result = runArchive(
		`
		import assert from "node:assert/strict";
		import { handler } from "./index.mjs";
		const response = await handler({
			version: "2.0", routeKey: "$default", rawPath: "/", rawQueryString: "",
			headers: { host: "api.example.com" }, isBase64Encoded: false,
			requestContext: { domainName: "api.example.com", stage: "$default", http: { method: "GET", path: "/", sourceIp: "127.0.0.1", protocol: "HTTP/1.1" } }
		});
		assert.equal(response.statusCode, 200);
		assert.equal(response.body, "OK");
	`,
		{
			...runtimeEnv,
			DATABASE_AUTH_MODE: "iam",
			DATABASE_URL: "postgresql://app_user@db.example:5432/app",
		}
	);
	assert.equal(result.error, undefined);
	assert.equal(result.status, 0, result.stderr || result.stdout);
});

test("ZIP rejects a missing auth secret instead of loading a local .env", () => {
	const { BETTER_AUTH_SECRET: _secret, ...env } = runtimeEnv;
	const result = runArchive('await import("./index.mjs");', env);
	assert.equal(result.error, undefined);
	assert.notEqual(result.status, 0);
	assert.ok(`${result.stdout}${result.stderr}`.includes("BETTER_AUTH_SECRET"));
});
