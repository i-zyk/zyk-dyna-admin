import { headers } from "next/headers";

import { authClient } from "@/lib/auth-client";

/**
 * 在 Server Component 里读取当前登录用户：转发请求头（带上 cookie）调用 `authClient.getSession`。
 * 未登录、HTTP 错误响应，以及连接被拒、DNS 失败等网络异常都按未登录处理，返回 null。
 *
 * 调用方用返回值判断后再 `redirect("/login")`：`redirect` 靠抛异常跳转，必须放在 try / catch 之外。
 */
export async function getServerSessionUser() {
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
