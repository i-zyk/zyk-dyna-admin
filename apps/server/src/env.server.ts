import "varlock/auto-load";

// biome-ignore lint/performance/noBarrelFile: must load varlock before re-exporting the generated ENV
export { ENV } from "./env";
