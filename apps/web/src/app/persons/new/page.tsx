import { redirect } from "next/navigation";

import PersonCreate from "@/components/person-create";
import { getServerSessionUser } from "@/lib/server-session";

export default async function NewPersonPage() {
	const user = await getServerSessionUser();

	// redirect 通过抛出异常实现跳转，必须放在 try / catch 之外（getServerSessionUser 内部已捕获异常）
	if (!user) {
		redirect("/login");
	}

	return (
		<main className="mx-auto w-full min-w-0 max-w-2xl space-y-6 px-4 py-6">
			<h1 className="font-semibold text-lg">新增人员</h1>
			<PersonCreate />
		</main>
	);
}
