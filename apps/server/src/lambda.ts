import { handle, type LambdaContext, type LambdaEvent } from "hono/aws-lambda";

import app from "./app";
import { ENV } from "./env.server";
import { db } from "./services";

const handleRequest = handle(app);

export async function handler(event: LambdaEvent, context?: LambdaContext) {
	if (context) {
		// Do not let other background work delay the HTTP response.
		context.callbackWaitsForEmptyEventLoop = false;
	}
	try {
		return await handleRequest(event, context);
	} finally {
		if (ENV.DATABASE_AUTH_MODE === "iam") {
			// Frozen Lambda timers cannot close idle sockets; release them so Express can pause.
			await db.$disconnect();
		}
	}
}
