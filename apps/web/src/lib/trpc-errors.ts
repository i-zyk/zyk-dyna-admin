import { isTRPCClientError } from "@trpc/client";
import type { AppRouter } from "@zyk-dyna-admin/api/routers/index";

/**
 * 取出 tRPC 调用失败时服务端返回的错误码（如 `CONFLICT`、`NOT_FOUND`）。
 * 不是 tRPC 错误，或请求没有到达服务端（网络错误等）时返回 undefined。
 */
export function getTrpcErrorCode(error: unknown): string | undefined {
	return isTRPCClientError<AppRouter>(error) ? error.data?.code : undefined;
}
