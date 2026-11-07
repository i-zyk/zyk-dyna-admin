import path from "node:path";

import { defineConfig, devices } from "@playwright/test";

import { resolveTestDatabaseUrl } from "./e2e/support/database-url";
import { SERVER_DIR, SERVER_LOG_FILE, WEB_DIR } from "./e2e/support/paths";
import { SERVER_URL, WEB_URL } from "./e2e/support/urls";

const SERVER_START_TIMEOUT_MS = 60_000;
const WEB_START_TIMEOUT_MS = 180_000;

const testDatabaseUrl = resolveTestDatabaseUrl();

export default defineConfig({
	forbidOnly: Boolean(process.env.CI),
	fullyParallel: false,
	globalSetup: "./e2e/global-setup.ts",
	projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
	reporter: "list",
	testDir: "./e2e",
	testMatch: "**/*.spec.ts",
	use: {
		baseURL: WEB_URL,
		trace: "retain-on-failure",
	},
	webServer: [
		{
			// 输出同时写入 SERVER_LOG_FILE，供 E2E 检查日志中没有明文密码（webServer 命令由 sh 执行）
			command: `mkdir -p ${JSON.stringify(path.dirname(SERVER_LOG_FILE))} && pnpm exec tsx src/index.ts 2>&1 | tee ${JSON.stringify(SERVER_LOG_FILE)}`,
			cwd: SERVER_DIR,
			// 固定地址，避免 .env 或 CI 覆盖后 server 与 E2E 用的地址不一致
			env: {
				BETTER_AUTH_URL: SERVER_URL,
				CORS_ORIGIN: WEB_URL,
				DATABASE_URL: testDatabaseUrl,
			},
			// 不复用已在运行的服务，避免测试连到开发库
			reuseExistingServer: false,
			timeout: SERVER_START_TIMEOUT_MS,
			url: SERVER_URL,
		},
		{
			command: "pnpm run dev",
			cwd: WEB_DIR,
			// 让 Web 端请求固定发到上面连测试库的 server，而不是 .env 或 CI 里配置的地址
			env: { NEXT_PUBLIC_SERVER_URL: SERVER_URL },
			reuseExistingServer: false,
			timeout: WEB_START_TIMEOUT_MS,
			url: WEB_URL,
		},
	],
	workers: 1,
});
