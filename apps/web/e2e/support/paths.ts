import path from "node:path";

// biome-ignore lint/correctness/noGlobalDirnameFilename: apps/web is not "type": "module", so Playwright loads these TS files as CommonJS and import.meta is unavailable
export const WEB_DIR = path.resolve(__dirname, "../..");
export const SERVER_DIR = path.resolve(WEB_DIR, "../server");
export const DB_PACKAGE_DIR = path.resolve(WEB_DIR, "../../packages/db");
