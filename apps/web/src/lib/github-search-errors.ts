import { GITHUB_USERNAME_INVALID_MESSAGE } from "./github-username";

export const GITHUB_USER_NOT_FOUND_MESSAGE = "未找到该 GitHub 用户";
export const GITHUB_RATE_LIMITED_MESSAGE = "请求过于频繁，请稍后再试";
export const GITHUB_SEARCH_FALLBACK_MESSAGE = "查询失败，请稍后再试";

/** 服务端 `github.getUser` 的 TRPCError code 与页面内中文提示的对应关系 */
const GITHUB_SEARCH_MESSAGE_BY_CODE: ReadonlyMap<string, string> = new Map([
	["BAD_REQUEST", GITHUB_USERNAME_INVALID_MESSAGE],
	["NOT_FOUND", GITHUB_USER_NOT_FOUND_MESSAGE],
	["TOO_MANY_REQUESTS", GITHUB_RATE_LIMITED_MESSAGE],
]);

/**
 * 把 `github.getUser` 的错误码转成中文提示；
 * 没有错误码（网络错误）或其他错误码（如 INTERNAL_SERVER_ERROR）统一为「查询失败，请稍后再试」。
 */
export function getGithubSearchErrorMessage(code: string | undefined): string {
	if (code === undefined) {
		return GITHUB_SEARCH_FALLBACK_MESSAGE;
	}
	return (
		GITHUB_SEARCH_MESSAGE_BY_CODE.get(code) ?? GITHUB_SEARCH_FALLBACK_MESSAGE
	);
}
