import { defineConfig } from "vitest/config";

/** Opt-in smoke tests that call the real GitHub API; not part of `pnpm run test`. */
const SMOKE_TEST_TIMEOUT_MS = 20_000;

export default defineConfig({
	test: {
		environment: "node",
		include: ["src/**/*.smoke.ts"],
		testTimeout: SMOKE_TEST_TIMEOUT_MS,
	},
});
