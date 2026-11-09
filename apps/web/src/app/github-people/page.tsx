import { redirect } from "next/navigation";
import { GithubPeople } from "@/components/github-people";
import { getServerSessionUser } from "@/lib/server-session";

export default async function GithubPeoplePage() {
	if (!(await getServerSessionUser())) {
		redirect("/login");
	}
	return (
		<main className="mx-auto w-full max-w-5xl space-y-6 px-4 py-8">
			<div>
				<p className="mb-2 text-muted-foreground text-sm">GITHUB DIRECTORY</p>
				<h1 className="font-semibold text-3xl">GitHub 人员库</h1>
				<p className="mt-2 text-muted-foreground">
					收藏开发者资料，维护展示名称和备注，并同步展示到 Android。
				</p>
			</div>
			<GithubPeople />
		</main>
	);
}
