import { execFileSync } from "node:child_process";
import { access, copyFile, cp, mkdir, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const serverDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const bundleDir = join(serverDir, "dist/lambda");
const archivePath = join(serverDir, "dist/server-lambda.zip");
const varlockDir = resolve(dirname(require.resolve("varlock/auto-load")), "..");

await access(join(bundleDir, "index.mjs"));
await copyFile(join(serverDir, ".env.schema"), join(bundleDir, ".env.schema"));
await writeFile(
	join(bundleDir, "package.json"),
	`${JSON.stringify({ private: true, type: "module" }, null, 2)}\n`
);

// Only copy published runtime files. Local .env files and resolved secrets stay out.
const varlockTarget = join(bundleDir, "node_modules/varlock");
await mkdir(varlockTarget, { recursive: true });
await Promise.all(
	["bin", "dist", "package.json", "BUNDLED_ICONS_LICENSES.md"].map((name) =>
		cp(join(varlockDir, name), join(varlockTarget, name), {
			filter: (source) => !source.endsWith(".map"),
			recursive: true,
		})
	)
);

// auto-load discovers this local CLI and invokes it with the current Node runtime.
const binDir = join(bundleDir, "node_modules/.bin");
await mkdir(binDir, { recursive: true });
await writeFile(
	join(binDir, "varlock"),
	'#!/bin/sh\nexec node "$(dirname "$0")/../varlock/bin/cli.js" "$@"\n',
	{ mode: 0o755 }
);

await rm(archivePath, { force: true });
execFileSync("zip", ["-q", "-r", archivePath, "."], {
	cwd: bundleDir,
	stdio: "inherit",
});
process.stdout.write(
	`Lambda deployment package: ${archivePath}\nHandler: index.handler\n`
);
