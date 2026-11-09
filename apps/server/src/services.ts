import { createGithubClient } from "@zyk-dyna-admin/api/lib/github";
import { createAuth } from "@zyk-dyna-admin/auth";
import { createPrismaClient } from "@zyk-dyna-admin/db";
import { createDatabasePassword } from "./database-auth";
import { ENV } from "./env.server";

export const db = createPrismaClient({
	DATABASE_URL: ENV.DATABASE_URL,
	password:
		ENV.DATABASE_AUTH_MODE === "iam"
			? createDatabasePassword(ENV.DATABASE_URL, ENV.DATABASE_AWS_REGION)
			: undefined,
});
export const auth = createAuth(ENV, db);
export const github = createGithubClient(ENV);
