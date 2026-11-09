import { defineConfig } from "tsdown";

export default defineConfig({
	clean: true,
	deps: {
		// Varlock starts a separate CLI process and must keep its published layout.
		alwaysBundle: [/^(?!varlock(?:\/|$))/],
	},
	entry: { index: "./src/lambda.ts" },
	format: "esm",
	outDir: "./dist/lambda",
	platform: "node",
	shims: true,
	target: "node24",
});
