import { execFileSync } from "node:child_process";
import {
	existsSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

const region = process.env.AWS_REGION ?? "us-east-2";
const stack = process.env.AWS_STACK_NAME ?? "zyk-dyna-admin-production";
const upstream = process.env.API_UPSTREAM_URL;
const webOrigin = process.env.NEXT_PUBLIC_SERVER_URL;
if (!(upstream && webOrigin)) {
	throw new Error(
		"Set API_UPSTREAM_URL and NEXT_PUBLIC_SERVER_URL before deployment"
	);
}
const aws = (args) => {
	const output = execFileSync(
		"aws",
		[...args, "--region", region, "--output", "json", "--no-cli-pager"],
		{ encoding: "utf8", maxBuffer: 20 * 1024 * 1024 }
	);
	return output.trim() ? JSON.parse(output) : null;
};
const info = aws(["cloudformation", "describe-stacks", "--stack-name", stack]);
const outputs = Object.fromEntries(
	info.Stacks[0].Outputs.map(({ OutputKey, OutputValue }) => [
		OutputKey,
		OutputValue,
	])
);
const temporary = mkdtempSync(join(tmpdir(), "zyk-deploy-"));
try {
	const sourceZip = join(temporary, "source.zip");
	const files = execFileSync(
		"git",
		["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
		{ encoding: "utf8" }
	)
		.split("\0")
		.filter(Boolean)
		.filter(existsSync)
		.filter((name) => {
			const base = basename(name);
			return (
				!(
					name.startsWith(".agents/") ||
					name.startsWith(".claude/") ||
					name.startsWith(".codex/") ||
					(base.startsWith(".env") &&
						base !== ".env.schema" &&
						base !== ".env.example") ||
					base.endsWith(".pem") ||
					base.endsWith(".key") ||
					base.endsWith(".keystore")
				) && base !== ".dev.vars"
			);
		});
	execFileSync("zip", ["-q", sourceZip, "-@"], {
		input: `${files.join("\n")}\n`,
		stdio: ["pipe", "inherit", "inherit"],
	});
	const uploaded = aws([
		"s3api",
		"put-object",
		"--bucket",
		outputs.ArtifactsBucket,
		"--key",
		"source.zip",
		"--body",
		sourceZip,
	]);
	const started = aws([
		"codebuild",
		"start-build",
		"--project-name",
		outputs.MigrationProject,
		"--source-version",
		uploaded.VersionId,
	]);
	process.stdout.write(`Database migration build: ${started.build.id}\n`);
	let migrated = false;
	for (let attempt = 0; attempt < 120; attempt += 1) {
		const [build] = aws([
			"codebuild",
			"batch-get-builds",
			"--ids",
			started.build.id,
		]).builds;
		if (build.buildStatus === "SUCCEEDED") {
			migrated = true;
			break;
		}
		if (build.buildStatus !== "IN_PROGRESS") {
			throw new Error(
				`Database migration failed: ${build.buildStatus}. Check CodeBuild logs.`
			);
		}
		// biome-ignore lint/performance/noAwaitInLoops: polling must wait for the previous build status before checking again.
		await delay(10_000);
	}
	if (!migrated) {
		throw new Error("Database migration timed out; Lambda was not updated");
	}
	const app = JSON.parse(
		aws([
			"secretsmanager",
			"get-secret-value",
			"--secret-id",
			outputs.ApplicationSecretArn,
		]).SecretString
	);
	const auth = JSON.parse(
		aws([
			"secretsmanager",
			"get-secret-value",
			"--secret-id",
			outputs.AuthenticationSecretArn,
		]).SecretString
	);
	const url = new URL(
		`postgresql://${outputs.DatabaseHost}:5432/${outputs.DatabaseName}`
	);
	url.username = app.username;
	url.password = app.password;
	url.searchParams.set("sslmode", "verify-full");
	const previous = aws([
		"lambda",
		"get-function-configuration",
		"--function-name",
		"zyk-dyna-admin",
	]);
	const config = {
		Environment: {
			Variables: {
				...previous.Environment?.Variables,
				BETTER_AUTH_SECRET: auth.secret,
				BETTER_AUTH_URL: webOrigin,
				CORS_ORIGIN: webOrigin,
				DATABASE_URL: url.toString(),
				NODE_ENV: "production",
				NODE_EXTRA_CA_CERTS: "/var/runtime/ca-cert.pem",
			},
		},
		FunctionName: "zyk-dyna-admin",
		Handler: "index.handler",
		MemorySize: 512,
		Role: outputs.LambdaRoleArn,
		Runtime: "nodejs24.x",
		Timeout: 30,
		VpcConfig: {
			SecurityGroupIds: [outputs.LambdaSecurityGroup],
			SubnetIds: outputs.AppSubnets.split(","),
		},
	};
	const privateConfig = join(temporary, "lambda-config.json");
	writeFileSync(privateConfig, JSON.stringify(config), { mode: 0o600 });
	aws([
		"lambda",
		"update-function-configuration",
		"--cli-input-json",
		`file://${privateConfig}`,
	]);
	aws([
		"lambda",
		"wait",
		"function-updated-v2",
		"--function-name",
		"zyk-dyna-admin",
	]);
	const code = readFileSync("apps/server/dist/server-lambda.zip");
	const codeFile = join(temporary, "server-lambda.zip");
	writeFileSync(codeFile, code);
	aws([
		"lambda",
		"update-function-code",
		"--function-name",
		"zyk-dyna-admin",
		"--zip-file",
		`fileb://${codeFile}`,
	]);
	aws([
		"lambda",
		"wait",
		"function-updated-v2",
		"--function-name",
		"zyk-dyna-admin",
	]);
	aws([
		"lambda",
		"put-function-concurrency",
		"--function-name",
		"zyk-dyna-admin",
		"--reserved-concurrent-executions",
		"5",
	]);
	const response = await fetch(`${upstream}/`);
	if (!response.ok || (await response.text()) !== "OK") {
		throw new Error("Deployed API health check failed");
	}
	process.stdout.write(
		`Lambda deployed and health check passed: ${upstream}\n`
	);
} finally {
	rmSync(temporary, { force: true, recursive: true });
}
