import { expo } from "@better-auth/expo";
import type { Database } from "@zyk-dyna-admin/db";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";

export interface AuthConfig {
	BETTER_AUTH_SECRET: string;
	BETTER_AUTH_URL: string;
	CORS_ORIGIN: string;
}

export function createAuth(
	env: AuthConfig,
	database: Database,
	desktopOrigins: readonly string[] = []
) {
	return betterAuth({
		advanced: {
			defaultCookieAttributes: {
				httpOnly: true,
				sameSite: "none",
				secure: true,
			},
		},
		baseURL: env.BETTER_AUTH_URL,
		database: prismaAdapter(database, {
			provider: "postgresql",
		}),
		emailAndPassword: { enabled: true },
		plugins: [expo()],
		secret: env.BETTER_AUTH_SECRET,
		trustedOrigins: [
			env.CORS_ORIGIN,
			...desktopOrigins,
			"zyk-dyna-admin://",
			"exp://",
			"http://localhost:8081",
		],
	});
}

export type Session = ReturnType<typeof createAuth>["$Infer"]["Session"];
