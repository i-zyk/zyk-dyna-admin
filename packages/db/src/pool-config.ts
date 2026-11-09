import type { PoolConfig } from "pg";

import type { DatabaseConfig } from "./config";

const DATABASE_POOL_SIZE = 3;
const DATABASE_CONNECT_TIMEOUT_MS = 20_000;

export function createPoolConfig(config: DatabaseConfig): PoolConfig {
	const limits = {
		connectionTimeoutMillis: DATABASE_CONNECT_TIMEOUT_MS,
		idleTimeoutMillis: 10_000,
		max: DATABASE_POOL_SIZE,
	};
	if (!config.password) {
		return { ...limits, connectionString: config.DATABASE_URL };
	}
	const url = new URL(config.DATABASE_URL);
	if (url.password) {
		throw new Error("IAM database URLs must not contain a static password");
	}
	// Do not pass connectionString here: pg would overwrite the token provider.
	return {
		...limits,
		database: decodeURIComponent(url.pathname.slice(1)),
		host: url.hostname,
		password: config.password,
		port: Number(url.port || 5432),
		ssl: { rejectUnauthorized: true },
		user: decodeURIComponent(url.username),
	};
}
