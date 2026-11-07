import {
	githubUsernameSchema,
	GITHUB_USERNAME_PATTERN as SERVER_GITHUB_USERNAME_PATTERN,
} from "@zyk-dyna-admin/api/lib/github-username";
import { describe, expect, it } from "vitest";

import {
	GITHUB_USERNAME_PATTERN,
	parseGithubUsernameInput,
} from "@/lib/github-username";

const GITHUB_USERNAME_MAX_LENGTH = 39;

const EMPTY_INPUTS = ["", " ", "   ", "\t\n"] as const;

const INVALID_INPUTS = [
	"-abc",
	"abc-",
	"a--b",
	"a".repeat(GITHUB_USERNAME_MAX_LENGTH + 1),
	"a_b",
	"中文",
	"a b",
] as const;

const VALID_INPUTS = [
	["Torvalds", "torvalds"],
	[" Torvalds ", "torvalds"],
	["torvalds", "torvalds"],
	["a", "a"],
	["a-b", "a-b"],
	["A1-b2-C3", "a1-b2-c3"],
	[
		"a".repeat(GITHUB_USERNAME_MAX_LENGTH),
		"a".repeat(GITHUB_USERNAME_MAX_LENGTH),
	],
] as const;

describe("parseGithubUsernameInput", () => {
	it.each(EMPTY_INPUTS)("空串和空白 %j 返回 empty", (input) => {
		expect(parseGithubUsernameInput(input)).toEqual({ status: "empty" });
	});

	it.each(INVALID_INPUTS)("不合法的 %j 返回 invalid", (input) => {
		expect(parseGithubUsernameInput(input)).toEqual({ status: "invalid" });
	});

	it.each(VALID_INPUTS)("合法的 %j trim 并转小写为 %j", (input, username) => {
		expect(parseGithubUsernameInput(input)).toEqual({
			status: "valid",
			username,
		});
	});
});

describe("前后端 GitHub 用户名规则一致", () => {
	it("正则的 source 和 flags 相同", () => {
		expect(GITHUB_USERNAME_PATTERN.source).toBe(
			SERVER_GITHUB_USERNAME_PATTERN.source
		);
		expect(GITHUB_USERNAME_PATTERN.flags).toBe(
			SERVER_GITHUB_USERNAME_PATTERN.flags
		);
	});

	const sharedCases = [
		...EMPTY_INPUTS,
		...INVALID_INPUTS,
		...VALID_INPUTS.map(([input]) => input),
	];

	it.each(sharedCases)("%j 在前端和服务端的校验结果相同", (input) => {
		const acceptedByWeb = parseGithubUsernameInput(input).status === "valid";
		const acceptedByServer = githubUsernameSchema.safeParse(input).success;
		expect(acceptedByWeb).toBe(acceptedByServer);
	});
});
