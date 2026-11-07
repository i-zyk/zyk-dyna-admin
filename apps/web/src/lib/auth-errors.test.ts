import { describe, expect, it } from "vitest";

import {
	getSignInErrorMessage,
	getSignUpError,
	SIGN_IN_FALLBACK_MESSAGE,
	SIGN_IN_INVALID_CREDENTIALS_MESSAGE,
	SIGN_UP_FALLBACK_MESSAGE,
} from "@/lib/auth-errors";
import { AUTH_VALIDATION_MESSAGES } from "@/lib/auth-validation";

const ACCOUNT_EXISTENCE_HINT = /不存在|已注册|未注册/;

describe("getSignUpError", () => {
	it("USERNAME_IS_ALREADY_TAKEN → 用户名字段下方显示「用户名已存在」", () => {
		expect(getSignUpError("USERNAME_IS_ALREADY_TAKEN")).toEqual({
			field: "username",
			message: "用户名已存在",
		});
	});

	it.each(["USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL", "USER_ALREADY_EXISTS"])(
		"%s → 邮箱字段下方显示「邮箱已被注册」",
		(code) => {
			expect(getSignUpError(code)).toEqual({
				field: "email",
				message: "邮箱已被注册",
			});
		}
	);

	it.each([
		["USERNAME_TOO_SHORT", "username", AUTH_VALIDATION_MESSAGES.usernameLength],
		["USERNAME_TOO_LONG", "username", AUTH_VALIDATION_MESSAGES.usernameLength],
		["INVALID_USERNAME", "username", AUTH_VALIDATION_MESSAGES.usernameInvalid],
		["INVALID_EMAIL", "email", AUTH_VALIDATION_MESSAGES.emailInvalid],
		["PASSWORD_TOO_SHORT", "password", AUTH_VALIDATION_MESSAGES.passwordLength],
		["PASSWORD_TOO_LONG", "password", AUTH_VALIDATION_MESSAGES.passwordLength],
	])("%s → %s 字段下方显示格式提示", (code, field, message) => {
		expect(getSignUpError(code)).toEqual({ field, message });
	});

	it.each([
		"SOMETHING_UNEXPECTED",
		"toString",
		"__proto__",
		"",
		null,
		undefined,
	])("未知或缺失的错误码 %j → 通用文案，用 toast 提示", (code) => {
		expect(getSignUpError(code)).toEqual({
			field: undefined,
			message: SIGN_UP_FALLBACK_MESSAGE,
		});
	});
});

describe("getSignInErrorMessage", () => {
	it.each([
		{ code: "INVALID_EMAIL_OR_PASSWORD", status: 401 },
		{ code: "INVALID_USERNAME_OR_PASSWORD", status: 401 },
		{ code: "INVALID_EMAIL", status: 400 },
		{ code: "INVALID_USERNAME", status: 422 },
		{ code: "USERNAME_TOO_SHORT", status: 422 },
		{ code: "USERNAME_TOO_LONG", status: 422 },
		{ code: "INVALID_EMAIL_OR_PASSWORD" },
		{ code: "USERNAME_TOO_SHORT" },
		{ status: 400 },
		{ status: 401 },
		{ status: 422 },
		{ code: "SOMETHING_UNEXPECTED", status: 401 },
	])("认证类错误 %j → 「账号或密码错误」", (error) => {
		expect(getSignInErrorMessage(error)).toBe(
			SIGN_IN_INVALID_CREDENTIALS_MESSAGE
		);
	});

	it.each([
		{ status: 500 },
		{ status: 503 },
		{ code: "INTERNAL_SERVER_ERROR", status: 500 },
		{ code: "toString", status: 500 },
		{ status: 0 },
		{},
		null,
		undefined,
	])("网络错误或服务端错误 %j → 「登录失败，请稍后再试」", (error) => {
		expect(getSignInErrorMessage(error)).toBe(SIGN_IN_FALLBACK_MESSAGE);
	});

	it("文案与需求一致", () => {
		expect(SIGN_IN_INVALID_CREDENTIALS_MESSAGE).toBe("账号或密码错误");
		expect(SIGN_IN_FALLBACK_MESSAGE).toBe("登录失败，请稍后再试");
	});

	it("两种文案都不提及账号是否存在", () => {
		for (const message of [
			SIGN_IN_INVALID_CREDENTIALS_MESSAGE,
			SIGN_IN_FALLBACK_MESSAGE,
		]) {
			expect(message).not.toMatch(ACCOUNT_EXISTENCE_HINT);
		}
	});
});
