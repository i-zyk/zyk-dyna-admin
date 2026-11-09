import "server-only";
import { ENV } from "@/env";
import { forwardApiRequest } from "./api-proxy";

export function proxyHandler(request: Request) {
	return forwardApiRequest(
		request,
		ENV.API_UPSTREAM_URL ?? ENV.NEXT_PUBLIC_SERVER_URL
	);
}
