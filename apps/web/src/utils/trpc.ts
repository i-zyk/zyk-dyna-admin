import {
	environmentManager,
	QueryCache,
	QueryClient,
} from "@tanstack/react-query";
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import { createTRPCContext } from "@trpc/tanstack-react-query";
import type { AppRouter } from "@zyk-dyna-admin/api/routers/index";
import { toast } from "sonner";

import { ENV } from "@/env";

const TRAILING_SLASH = /\/$/;

export const { TRPCProvider, useTRPC, useTRPCClient } =
	createTRPCContext<AppRouter>();

function makeQueryClient() {
	return new QueryClient({
		queryCache: new QueryCache({
			onError: (error, query) => {
				toast.error(error.message, {
					action: {
						label: "retry",
						onClick: () => {
							query.invalidate();
						},
					},
				});
			},
		}),
	});
}

let browserQueryClient: QueryClient | undefined;

export function getQueryClient() {
	if (environmentManager.isServer()) {
		return makeQueryClient();
	}

	browserQueryClient ??= makeQueryClient();
	return browserQueryClient;
}

export function makeTRPCClient() {
	return createTRPCClient<AppRouter>({
		links: [
			httpBatchLink({
				fetch: (url, options) =>
					fetch(url, {
						...options,
						credentials: "include",
					}),
				url: `${ENV.NEXT_PUBLIC_SERVER_URL.replace(TRAILING_SLASH, "")}/trpc`,
			}),
		],
	});
}
