import { Client } from "pg";

import { assertTestDatabaseUrl, resolveTestDatabaseUrl } from "./database-url";

export async function withTestDatabase<T>(
	run: (client: Client) => Promise<T>
): Promise<T> {
	const connectionString = resolveTestDatabaseUrl();
	assertTestDatabaseUrl(connectionString);
	const client = new Client({ connectionString });
	await client.connect();
	try {
		return await run(client);
	} finally {
		await client.end();
	}
}

/** 清空 public schema 下除迁移记录外的所有表。 */
export function resetTestDatabase(): Promise<void> {
	return withTestDatabase(async (client) => {
		const { rows } = await client.query<{ tablename: string }>(
			"SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'"
		);
		if (rows.length === 0) {
			return;
		}
		const tables = rows
			.map(({ tablename }) => `public.${client.escapeIdentifier(tablename)}`)
			.join(", ");
		await client.query(`TRUNCATE TABLE ${tables} RESTART IDENTITY CASCADE`);
	});
}
