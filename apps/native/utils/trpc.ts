import { QueryClient } from "@tanstack/react-query";
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import { createTRPCOptionsProxy } from "@trpc/tanstack-react-query";
import type { AppRouter } from "@zyk-dyna-admin/api/routers/index";
import { Platform } from "react-native";

import { authClient } from "@/lib/auth-client";

import { ENV } from "../src/env";

export const queryClient = new QueryClient();

const trpcClient = createTRPCClient<AppRouter>({
	links: [
		httpBatchLink({
			fetch: (url, options) =>
				fetch(url, {
					...options,
					// Better Auth Expo forwards the session cookie manually on native.
					credentials: Platform.OS === "web" ? "include" : "omit",
				}),
			async headers() {
				if (Platform.OS === "web") {
					return {};
				}
				const headers = new Map<string, string>();
				const cookies = await authClient.getCookie();
				if (cookies) {
					headers.set("Cookie", cookies);
				}
				return Object.fromEntries(headers);
			},
			url: `${ENV.EXPO_PUBLIC_SERVER_URL}/trpc`,
		}),
	],
});

export const trpc = createTRPCOptionsProxy<AppRouter>({
	client: trpcClient,
	queryClient,
});
