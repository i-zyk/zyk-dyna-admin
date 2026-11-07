import type { Session } from "@zyk-dyna-admin/auth";
import type { Database } from "@zyk-dyna-admin/db";

// biome-ignore lint/style/useConsistentTypeDefinitions: must stay a type alias; @hono/trpc-server requires Record<string, unknown>, which interfaces don't satisfy
export type Context = {
	session: Session | null;
	db: Database;
};
