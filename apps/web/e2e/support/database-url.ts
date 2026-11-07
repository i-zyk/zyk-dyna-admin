import { execFileSync } from "node:child_process";

import { SERVER_DIR } from "./paths";

export const TEST_DATABASE_NAME = "zyk_dyna_admin_test";

const CACHE_KEY = "E2E_DATABASE_URL";

/** 只把连接串里的库名换成测试库，用户、密码、主机、参数原样保留。 */
export function toTestDatabaseUrl(databaseUrl: string): string {
	const url = new URL(databaseUrl);
	url.pathname = `/${TEST_DATABASE_NAME}`;
	return url.toString();
}

export function assertTestDatabaseUrl(databaseUrl: string): void {
	const { pathname } = new URL(databaseUrl);
	if (pathname !== `/${TEST_DATABASE_NAME}`) {
		throw new Error(
			`E2E 只能连接测试库 ${TEST_DATABASE_NAME}，当前连接串指向了其他库`
		);
	}
}

/**
 * 通过 varlock 解析 server 的 DATABASE_URL（进程环境变量优先于 .env），
 * 再换成测试库。结果只保存在内存和子进程环境变量里，不打印。
 */
export function resolveTestDatabaseUrl(): string {
	const cached = process.env[CACHE_KEY];
	if (cached) {
		assertTestDatabaseUrl(cached);
		return cached;
	}
	const databaseUrl = execFileSync(
		"pnpm",
		["exec", "varlock", "printenv", "DATABASE_URL"],
		{ cwd: SERVER_DIR, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }
	).trim();
	const testDatabaseUrl = toTestDatabaseUrl(databaseUrl);
	process.env[CACHE_KEY] = testDatabaseUrl;
	return testDatabaseUrl;
}
