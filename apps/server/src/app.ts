import { trpcServer } from "@hono/trpc-server";
import { appRouter } from "@zyk-dyna-admin/api/routers/index";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";

import { createContext } from "./context";
import { ENV } from "./env.server";
import { auth } from "./services";

const app = new Hono();

app.use(logger());
app.use(
	"/*",
	cors({
		allowHeaders: ["Content-Type", "Authorization"],
		allowMethods: ["GET", "POST", "OPTIONS"],
		credentials: true,
		origin: ENV.CORS_ORIGIN,
	})
);

app.on(["POST", "GET"], "/api/auth/*", async (c) => auth.handler(c.req.raw));

app.use(
	"/trpc/*",
	trpcServer({
		createContext: (_opts, context) => createContext({ context }),
		endpoint: "/trpc",
		router: appRouter,
	})
);

app.get("/", (c) => c.text("OK"));

export default app;
