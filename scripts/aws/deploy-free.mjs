import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createIamMigrationUrl } from "./connection-url.mjs";

const require = createRequire(
	new URL("../../packages/db/package.json", import.meta.url)
);
// biome-ignore lint/correctness/noUndeclaredDependencies: the database package owns the PostgreSQL driver.
const { Client } = require("pg");
const region = process.env.AWS_REGION ?? "us-east-2";
const clusterId = "zyk-dyna-admin-free";
const roleName = "zyk-dyna-admin-free-lambda";
const functionName = "zyk-dyna-admin";
const database = "zyk_dyna_admin";
const appUser = "zyk_app";
const bootstrap = process.argv.includes("--bootstrap");
const webOrigin = process.env.NEXT_PUBLIC_SERVER_URL;
const upstream = process.env.API_UPSTREAM_URL;
if (!(webOrigin && upstream)) {
	throw new Error("Set NEXT_PUBLIC_SERVER_URL and API_UPSTREAM_URL");
}
const aws = (args, awsRegion = region) => {
	const output = execFileSync(
		"aws",
		[...args, "--region", awsRegion, "--output", "json", "--no-cli-pager"],
		{ encoding: "utf8", maxBuffer: 10 * 1024 * 1024 }
	);
	return output.trim() ? JSON.parse(output) : null;
};
const account = aws(["sts", "get-caller-identity"]).Account;
const plan = aws(["freetier", "get-account-plan-state"], "us-east-1");
if (plan.accountPlanType !== "FREE") {
	throw new Error("This deployment is restricted to the FREE account plan");
}
let cluster;
try {
	[cluster] = aws([
		"rds",
		"describe-db-clusters",
		"--db-cluster-identifier",
		clusterId,
	]).DBClusters;
} catch (error) {
	if (!(bootstrap && String(error.stderr).includes("DBClusterNotFound"))) {
		throw error;
	}
	aws([
		"rds",
		"create-db-cluster",
		"--db-cluster-identifier",
		clusterId,
		"--engine",
		"aurora-postgresql",
		"--with-express-configuration",
		"--master-username",
		"zyk_admin",
		"--deletion-protection",
		"--serverless-v2-scaling-configuration",
		"MinCapacity=0,MaxCapacity=1,SecondsUntilAutoPause=300",
		"--tags",
		"Key=Project,Value=zyk-dyna-admin",
	]);
}
aws([
	"rds",
	"wait",
	"db-cluster-available",
	"--db-cluster-identifier",
	clusterId,
]);
[cluster] = aws([
	"rds",
	"describe-db-clusters",
	"--db-cluster-identifier",
	clusterId,
]).DBClusters;
if (
	!(
		cluster.InternetAccessGatewayEnabled &&
		cluster.IAMDatabaseAuthenticationEnabled
	)
) {
	throw new Error(
		"Expected an Aurora Express cluster with IAM internet access"
	);
}
const directory = mkdtempSync(join(tmpdir(), "zyk-free-deploy-"));
const jsonFile = (name, data) => {
	const path = join(directory, name);
	writeFileSync(path, JSON.stringify(data), { mode: 0o600 });
	return `file://${path}`;
};
const token = (user) =>
	execFileSync(
		"aws",
		[
			"rds",
			"generate-db-auth-token",
			"--hostname",
			cluster.Endpoint,
			"--port",
			"5432",
			"--username",
			user,
			"--region",
			region,
		],
		{ encoding: "utf8" }
	).trim();
const client = (name) =>
	new Client({
		connectionTimeoutMillis: 30_000,
		database: name,
		host: cluster.Endpoint,
		password: async () => token(cluster.MasterUsername),
		port: 5432,
		ssl: { rejectUnauthorized: true },
		user: cluster.MasterUsername,
	});
try {
	if (bootstrap) {
		let exists = false;
		try {
			aws(["iam", "get-role", "--role-name", roleName]);
			exists = true;
		} catch (error) {
			if (!String(error.stderr).includes("NoSuchEntity")) {
				throw error;
			}
		}
		if (!exists) {
			aws([
				"iam",
				"create-role",
				"--role-name",
				roleName,
				"--assume-role-policy-document",
				jsonFile("trust.json", {
					Statement: [
						{
							Action: "sts:AssumeRole",
							Effect: "Allow",
							Principal: { Service: "lambda.amazonaws.com" },
						},
					],
					Version: "2012-10-17",
				}),
				"--tags",
				"Key=Project,Value=zyk-dyna-admin",
			]);
		}
		aws([
			"iam",
			"attach-role-policy",
			"--role-name",
			roleName,
			"--policy-arn",
			"arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole",
		]);
		aws([
			"iam",
			"put-role-policy",
			"--role-name",
			roleName,
			"--policy-name",
			"ConnectApplicationDatabase",
			"--policy-document",
			jsonFile("database-policy.json", {
				Statement: [
					{
						Action: "rds-db:connect",
						Effect: "Allow",
						Resource: `arn:aws:rds-db:${region}:${account}:dbuser:${cluster.DbClusterResourceId}/${appUser}`,
					},
				],
				Version: "2012-10-17",
			}),
		]);
	}
	const admin = client("postgres");
	try {
		await admin.connect();
		const result = await admin.query(
			"SELECT 1 FROM pg_database WHERE datname = $1",
			[database]
		);
		if (!result.rowCount) {
			await admin.query(`CREATE DATABASE ${database}`);
		}
	} finally {
		await admin.end();
	}
	const migrationUrl = createIamMigrationUrl(
		cluster.Endpoint,
		database,
		cluster.MasterUsername,
		token(cluster.MasterUsername)
	);
	execFileSync("pnpm", ["--dir", "packages/db", "run", "db:migrate:deploy"], {
		env: { ...process.env, DATABASE_URL: migrationUrl },
		stdio: "inherit",
	});
	const grants = client(database);
	try {
		await grants.connect();
		const exists = await grants.query(
			"SELECT 1 FROM pg_roles WHERE rolname = $1",
			[appUser]
		);
		if (!exists.rowCount) {
			await grants.query(`CREATE ROLE ${appUser} LOGIN`);
		}
		await grants.query(`GRANT rds_iam TO ${appUser}`);
		await grants.query(`GRANT CONNECT ON DATABASE ${database} TO ${appUser}`);
		await grants.query(`GRANT USAGE ON SCHEMA public TO ${appUser}`);
		const { rows } = await grants.query(
			"SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'"
		);
		const tables = rows
			.map(({ tablename }) => `"${tablename.replaceAll('"', '""')}"`)
			.join(", ");
		if (tables) {
			await grants.query(
				`GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE ${tables} TO ${appUser}`
			);
		}
		await grants.query(
			`GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ${appUser}`
		);
		await grants.query(
			`ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ${appUser}`
		);
		await grants.query(
			`ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO ${appUser}`
		);
	} finally {
		await grants.end();
	}
	process.stdout.write("Database migrations and application grants passed.\n");
	const current = aws([
		"lambda",
		"get-function-configuration",
		"--function-name",
		functionName,
	]);
	const { NODE_EXTRA_CA_CERTS: _oldCa, ...variables } =
		current.Environment?.Variables ?? {};
	Object.assign(variables, {
		BETTER_AUTH_SECRET:
			variables.BETTER_AUTH_SECRET || randomBytes(48).toString("base64"),
		BETTER_AUTH_URL: webOrigin,
		CORS_ORIGIN: webOrigin,
		DATABASE_AUTH_MODE: "iam",
		DATABASE_AWS_REGION: region,
		DATABASE_URL: `postgresql://${appUser}@${cluster.Endpoint}:5432/${database}`,
		NODE_ENV: "production",
	});
	aws([
		"lambda",
		"update-function-configuration",
		"--cli-input-json",
		jsonFile("lambda.json", {
			Environment: { Variables: variables },
			FunctionName: functionName,
			Handler: "index.handler",
			MemorySize: 512,
			Role: `arn:aws:iam::${account}:role/${roleName}`,
			Runtime: "nodejs24.x",
			Timeout: 30,
			VpcConfig: { SecurityGroupIds: [], SubnetIds: [] },
		}),
	]);
	aws([
		"lambda",
		"wait",
		"function-updated-v2",
		"--function-name",
		functionName,
	]);
	aws([
		"lambda",
		"update-function-code",
		"--function-name",
		functionName,
		"--zip-file",
		"fileb://apps/server/dist/server-lambda.zip",
	]);
	aws([
		"lambda",
		"wait",
		"function-updated-v2",
		"--function-name",
		functionName,
	]);
	const response = await fetch(`${upstream}/`);
	if (!response.ok || (await response.text()) !== "OK") {
		throw new Error("Lambda API health check failed");
	}
	process.stdout.write(`Free-plan Lambda deployed: ${upstream}\n`);
} finally {
	rmSync(directory, { force: true, recursive: true });
}
