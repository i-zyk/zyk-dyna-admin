import { redirect } from "next/navigation";

import { getServerSessionUser } from "@/lib/server-session";

import Dashboard from "./dashboard";

export default async function DashboardPage() {
	const user = await getServerSessionUser();

	if (!user) {
		redirect("/login");
	}

	return (
		<main className="mx-auto w-full min-w-0 max-w-2xl space-y-6 px-4 py-6">
			<div className="space-y-1">
				<h1 className="font-semibold text-lg">Dashboard</h1>
				<p className="text-muted-foreground text-sm">Welcome {user.name}</p>
			</div>
			<Dashboard />
		</main>
	);
}
