import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { test } from "node:test";

import { createIamMigrationUrl } from "./connection-url.mjs";

const require = createRequire(
	new URL("../../packages/db/package.json", import.meta.url)
);
// biome-ignore lint/correctness/noUndeclaredDependencies: the database package owns this driver.
const { Client } = require("pg");

test("an IAM token survives PostgreSQL URL decoding without changing its signature", async () => {
	const token =
		"db.example:5432/?Action=connect&DBUser=app&X-Amz-Credential=TEST%2F20261109%2Fus-east-2%2Frds-db%2Faws4_request&X-Amz-Security-Token=abc%2Bdef%3D";
	const url = createIamMigrationUrl("db.example", "app", "app", token);
	const client = new Client({ connectionString: url });
	assert.equal(client.connectionParameters.password, token);
	assert.equal(new URL(url).searchParams.get("sslmode"), "require");
	assert.equal(new URL(url).searchParams.get("sslaccept"), "strict");
	await client.end();
});
