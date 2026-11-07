import path from "node:path";

import { defineConfig, env } from "prisma/config";
import "varlock/auto-load";

export default defineConfig({
	datasource: {
		url: env("DATABASE_URL"),
	},
	migrations: {
		path: path.join("prisma", "migrations"),
	},
	schema: path.join("prisma", "schema"),
});
