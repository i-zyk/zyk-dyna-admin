const TRAILING_SLASH = /\/$/;
const HOP_HEADERS = [
	"host",
	"connection",
	"content-length",
	"transfer-encoding",
	"keep-alive",
	"upgrade",
];

export async function forwardApiRequest(request: Request, upstream: string) {
	const incoming = new URL(request.url);
	const target = new URL(upstream);
	if (target.origin === incoming.origin) {
		return Response.json(
			{ error: "API upstream is not configured" },
			{ status: 503 }
		);
	}
	target.pathname = `${target.pathname.replace(TRAILING_SLASH, "")}${incoming.pathname}`;
	target.search = incoming.search;
	const headers = new Headers(request.headers);
	for (const name of HOP_HEADERS) {
		headers.delete(name);
	}
	for (const name of [...headers.keys()]) {
		if (name.startsWith("x-forwarded-") || name === "forwarded") {
			headers.delete(name);
		}
	}
	try {
		const response = await fetch(target, {
			body:
				request.method === "GET" || request.method === "HEAD"
					? undefined
					: await request.arrayBuffer(),
			cache: "no-store",
			headers,
			method: request.method,
			redirect: "manual",
			signal: AbortSignal.timeout(25_000),
		});
		const resultHeaders = new Headers(response.headers);
		for (const name of HOP_HEADERS) {
			resultHeaders.delete(name);
		}
		resultHeaders.delete("set-cookie");
		for (const cookie of response.headers.getSetCookie()) {
			resultHeaders.append("set-cookie", cookie);
		}
		resultHeaders.set("cache-control", "private, no-store");
		return new Response(response.body, {
			headers: resultHeaders,
			status: response.status,
		});
	} catch {
		return Response.json(
			{ error: "API temporarily unavailable" },
			{ headers: { "cache-control": "no-store" }, status: 502 }
		);
	}
}
