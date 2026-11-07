// 与服务端 packages/api/src/lib/github-username.ts 保持一致。
// 前端不能在运行时导入 @zyk-dyna-admin/api，修改服务端规则时需要同步修改这里。

/**
 * GitHub 用户名规则：1–39 位，只含字母、数字和中间的单个连字符，
 * 不能以 `-` 开头或结尾，不能包含连续的 `--`。
 */
export const GITHUB_USERNAME_PATTERN =
	/^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/i;

export const GITHUB_USERNAME_INVALID_MESSAGE = "GitHub 用户名格式不正确";

export type GithubUsernameInput =
	| { status: "empty" }
	| { status: "invalid" }
	| { status: "valid"; username: string };

/**
 * 解析搜索框输入：trim 后为空返回 empty，不符合规则返回 invalid，
 * 否则返回小写用户名（作为查询参数和缓存键，大小写不同视为同一用户）。
 */
export function parseGithubUsernameInput(input: string): GithubUsernameInput {
	const trimmed = input.trim();
	if (trimmed === "") {
		return { status: "empty" };
	}
	if (!GITHUB_USERNAME_PATTERN.test(trimmed)) {
		return { status: "invalid" };
	}
	return { status: "valid", username: trimmed.toLowerCase() };
}
