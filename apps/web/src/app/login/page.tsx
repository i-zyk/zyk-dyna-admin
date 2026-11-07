import { headers } from "next/headers";
import { redirect } from "next/navigation";

import AuthPanel from "@/components/auth-panel";
import { authClient } from "@/lib/auth-client";

// 取 session 失败时按未登录处理，仍然显示登录表单。
// 不传 throw 只能兜住 HTTP 错误响应；连接被拒、DNS 失败等网络异常仍会 reject，需要另外捕获。
async function getSignedInUser() {
	const requestHeaders = await headers();
	try {
		const { data: session } = await authClient.getSession({
			fetchOptions: {
				headers: requestHeaders,
			},
		});
		return session?.user ?? null;
	} catch {
		return null;
	}
}

export default async function LoginPage() {
	const user = await getSignedInUser();

	// redirect 通过抛出异常实现跳转，必须放在 try / catch 之外
	if (user) {
		redirect("/dashboard");
	}

	return <AuthPanel />;
}
