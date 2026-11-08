import { redirect } from "next/navigation";

import PersonList from "@/components/person-list";
import { getServerSessionUser } from "@/lib/server-session";

export default async function PersonsPage() {
	const user = await getServerSessionUser();

	// redirect 通过抛出异常实现跳转，必须放在 try / catch 之外（getServerSessionUser 内部已捕获异常）
	if (!user) {
		redirect("/login");
	}

	return (
		<main className="mx-auto w-full min-w-0 max-w-5xl space-y-6 px-4 py-6">
			<h1 className="font-semibold text-lg">人员管理</h1>
			<PersonList />
		</main>
	);
}
