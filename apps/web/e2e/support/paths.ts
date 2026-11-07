import path from "node:path";

// biome-ignore lint/correctness/noGlobalDirnameFilename: apps/web is not "type": "module", so Playwright loads these TS files as CommonJS and import.meta is unavailable
export const WEB_DIR = path.resolve(__dirname, "../..");
export const SERVER_DIR = path.resolve(WEB_DIR, "../server");
export const DB_PACKAGE_DIR = path.resolve(WEB_DIR, "../../packages/db");
/** E2E 期间 server 的 stdout / stderr 副本，用来检查日志里没有明文密码。test-results 在 webServer 启动前清空，已被 git 和 Biome 忽略。 */
export const SERVER_LOG_FILE = path.join(
	WEB_DIR,
	"test-results",
	"e2e-server.log"
);
