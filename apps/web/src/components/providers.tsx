"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { Toaster } from "@zyk-dyna-admin/ui/components/sonner";
import { useState } from "react";

import { getQueryClient, makeTRPCClient, TRPCProvider } from "@/utils/trpc";

import { ThemeProvider } from "./theme-provider";

export default function Providers({ children }: { children: React.ReactNode }) {
	const queryClient = getQueryClient();
	const [trpcClient] = useState(makeTRPCClient);

	return (
		<ThemeProvider
			attribute="class"
			defaultTheme="system"
			disableTransitionOnChange
			enableSystem
		>
			<QueryClientProvider client={queryClient}>
				<TRPCProvider queryClient={queryClient} trpcClient={trpcClient}>
					{children}
				</TRPCProvider>
				<ReactQueryDevtools />
			</QueryClientProvider>
			<Toaster richColors />
		</ThemeProvider>
	);
}
