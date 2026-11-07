import { describe, expect, it } from "vitest";

import { getSignUpError, SIGN_UP_FALLBACK_MESSAGE } from "@/lib/auth-errors";
import { AUTH_VALIDATION_MESSAGES } from "@/lib/auth-validation";

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
