import { handle, type LambdaContext, type LambdaEvent } from "hono/aws-lambda";

import app from "./app";

const handleRequest = handle(app);

export function handler(event: LambdaEvent, context?: LambdaContext) {
	if (context) {
		// Reuse pooled database connections without delaying the HTTP response.
		context.callbackWaitsForEmptyEventLoop = false;
	}
	return handleRequest(event, context);
}
