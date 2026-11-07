import { execFileSync } from "node:child_process";

import { resetTestDatabase } from "./support/database";
import { resolveTestDatabaseUrl } from "./support/database-url";
import { DB_PACKAGE_DIR } from "./support/paths";

export default async function globalSetup(): Promise<void> {
	const databaseUrl = resolveTestDatabaseUrl();
	execFileSync("pnpm", ["run", "db:migrate:deploy"], {
		cwd: DB_PACKAGE_DIR,
		env: { ...process.env, DATABASE_URL: databaseUrl },
		stdio: ["ignore", "inherit", "inherit"],
	});
	await resetTestDatabase();
}
