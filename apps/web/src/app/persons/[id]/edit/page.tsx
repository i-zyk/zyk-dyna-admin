import { redirect } from "next/navigation";

import PersonEdit from "@/components/person-edit";
import { getServerSessionUser } from "@/lib/server-session";

interface EditPersonPageProps {
	params: Promise<{ id: string }>;
}

export default async function EditPersonPage({ params }: EditPersonPageProps) {
	const user = await getServerSessionUser();

	// redirect 通过抛出异常实现跳转，必须放在 try / catch 之外（getServerSessionUser 内部已捕获异常）
	if (!user) {
		redirect("/login");
	}

	// 人员是否存在由客户端的 person.getById 判断（NOT_FOUND 时显示不存在提示），这里只取出 id
	const { id } = await params;

	return (
		<main
			className="mx-auto w-full min-w-0 max-w-2xl space-y-6 px-4 py-6"
			data-person-id={id}
		>
			<h1 className="font-semibold text-lg">编辑人员</h1>
			<PersonEdit id={id} />
		</main>
	);
}
