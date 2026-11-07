import { defineConfig } from "vitest/config";

export default defineConfig({
	resolve: {
		tsconfigPaths: true,
	},
	test: {
		environment: "node",
		include: ["src/**/*.test.ts"],
		passWithNoTests: true,
		// 让被测模块里的 `import { ENV } from "@/env"` 可用
		setupFiles: ["varlock/auto-load"],
	},
});
