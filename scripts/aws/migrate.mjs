import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(
	new URL("../../packages/db/package.json", import.meta.url)
);
// biome-ignore lint/correctness/noUndeclaredDependencies: resolve the driver from the database package, which owns this dependency.
const { Client } = require("pg");
const admin = JSON.parse(process.env.DB_ADMIN_SECRET ?? "{}");
const app = JSON.parse(process.env.DB_APP_SECRET ?? "{}");
const identifierPattern = /^[a-z_][a-z0-9_]{0,62}$/;
const database = process.env.DB_NAME;
if (
	!(
		admin.username &&
		admin.password &&
		app.username &&
		app.password &&
		database &&
		process.env.DB_HOST
	)
) {
	throw new Error("Database migration configuration is incomplete");
}
if (
	!(identifierPattern.test(app.username) && identifierPattern.test(database))
) {
	throw new Error("Invalid database or application role name");
}
const url = new URL(`postgresql://${process.env.DB_HOST}:5432/${database}`);
url.username = admin.username;
url.password = admin.password;
url.searchParams.set("sslmode", "require");
url.searchParams.set("sslaccept", "strict");
url.searchParams.set("sslcert", "/tmp/rds-ca.pem");
const env = {
	...process.env,
	DATABASE_URL: url.toString(),
	NODE_EXTRA_CA_CERTS: "/tmp/rds-ca.pem",
};
execFileSync("pnpm", ["--dir", "packages/db", "run", "db:migrate:deploy"], {
	env,
	stdio: "inherit",
});

const client = new Client({
	database,
	host: process.env.DB_HOST,
	password: admin.password,
	port: 5432,
	ssl: {
		ca: readFileSync("/tmp/rds-ca.pem", "utf8"),
		rejectUnauthorized: true,
	},
	user: admin.username,
});
const quote = (value) => `"${value.replaceAll('"', '""')}"`;
try {
	await client.connect();
	const role = quote(app.username);
	const exists = await client.query(
		"SELECT 1 FROM pg_roles WHERE rolname = $1",
		[app.username]
	);
	if (!exists.rowCount) {
		await client.query(`CREATE ROLE ${role} LOGIN`);
	}
	await client.query(
		`ALTER ROLE ${role} PASSWORD '${app.password.replaceAll("'", "''")}'`
	);
	await client.query(`GRANT CONNECT ON DATABASE ${quote(database)} TO ${role}`);
	await client.query(`GRANT USAGE ON SCHEMA public TO ${role}`);
	const { rows } = await client.query(
		"SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'"
	);
	if (rows.length) {
		await client.query(
			`GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE ${rows.map(({ tablename }) => quote(tablename)).join(", ")} TO ${role}`
		);
	}
	await client.query(
		`GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ${role}`
	);
	await client.query(
		`ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ${role}`
	);
	await client.query(
		`ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO ${role}`
	);
	process.stdout.write(
		"Migrations and application database grants completed.\n"
	);
} finally {
	await client.end();
}
