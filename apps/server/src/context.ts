import type { Context as ApiContext } from "@zyk-dyna-admin/api/context";
import type { Context as HonoContext } from "hono";
import { auth, db, github } from "./services";

export interface CreateContextOptions {
	context: HonoContext;
}

export async function createContext({
	context,
}: CreateContextOptions): Promise<ApiContext> {
	const session = await auth.api.getSession({
		headers: context.req.raw.headers,
	});
	return {
		db,
		github,
		session,
	};
}

export type Context = Awaited<ReturnType<typeof createContext>>;
