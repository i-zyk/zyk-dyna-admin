import { describe, expect, it } from "vitest";

import {
	AUTH_VALIDATION_MESSAGES,
	emailSchema,
	isEmailIdentifier,
	PASSWORD_MAX_LENGTH,
	PASSWORD_MIN_LENGTH,
	passwordSchema,
	signInSchema,
	signUpSchema,
	USERNAME_MAX_LENGTH,
	usernameSchema,
} from "@/lib/auth-validation";

const VALID_PASSWORD = "password123";

const validSignUp = {
	confirmPassword: VALID_PASSWORD,
	email: "tom@example.com",
	password: VALID_PASSWORD,
	username: "tom",
};

function getMessages(result: {
	error?: { issues: readonly { message: string }[] };
}): string[] {
	return result.error?.issues.map(({ message }) => message) ?? [];
}

describe("usernameSchema", () => {
	it.each([
		["ab", AUTH_VALIDATION_MESSAGES.usernameLength],
		["a b", AUTH_VALIDATION_MESSAGES.usernameInvalid],
		["中文名", AUTH_VALIDATION_MESSAGES.usernameInvalid],
		[
			"a".repeat(USERNAME_MAX_LENGTH + 1),
			AUTH_VALIDATION_MESSAGES.usernameLength,
		],
		["", AUTH_VALIDATION_MESSAGES.usernameRequired],
	])("拒绝 %j，并提示「%s」", (value, message) => {
		const result = usernameSchema.safeParse(value);
		expect(result.success).toBe(false);
		expect(getMessages(result)).toContain(message);
	});

	it("为空时只提示「请输入用户名」", () => {
		expect(getMessages(usernameSchema.safeParse(""))).toEqual([
			AUTH_VALIDATION_MESSAGES.usernameRequired,
		]);
	});

	it.each(["abc", "Tom_1.x", "a".repeat(USERNAME_MAX_LENGTH)])(
		"接受 %j，且不改变大小写",
		(value) => {
			const result = usernameSchema.safeParse(value);
			expect(result.success).toBe(true);
			expect(result.data).toBe(value);
		}
	);
});

describe("emailSchema", () => {
	it.each(["abc", "a@b"])("拒绝 %j", (value) => {
		const result = emailSchema.safeParse(value);
		expect(result.success).toBe(false);
		expect(getMessages(result)).toEqual([
			AUTH_VALIDATION_MESSAGES.emailInvalid,
		]);
	});

	it("为空或只有空格时只提示「请输入邮箱」", () => {
		for (const value of ["", "   "]) {
			expect(getMessages(emailSchema.safeParse(value))).toEqual([
				AUTH_VALIDATION_MESSAGES.emailRequired,
			]);
		}
	});

	it("接受 a@b.co，并去掉首尾空格", () => {
		expect(emailSchema.safeParse("a@b.co")).toMatchObject({
			data: "a@b.co",
			success: true,
		});
		expect(emailSchema.safeParse("  a@b.co  ")).toMatchObject({
			data: "a@b.co",
			success: true,
		});
	});
});

describe("passwordSchema", () => {
	it.each([PASSWORD_MIN_LENGTH - 1, PASSWORD_MAX_LENGTH + 1])(
		"拒绝 %i 位密码",
		(length) => {
			const result = passwordSchema.safeParse("x".repeat(length));
			expect(result.success).toBe(false);
			expect(getMessages(result)).toEqual([
				AUTH_VALIDATION_MESSAGES.passwordLength,
			]);
		}
	);

	it.each([PASSWORD_MIN_LENGTH, PASSWORD_MAX_LENGTH])(
		"接受 %i 位密码",
		(length) => {
			expect(passwordSchema.safeParse("x".repeat(length)).success).toBe(true);
		}
	);

	it("为空时只提示「请输入密码」", () => {
		expect(getMessages(passwordSchema.safeParse(""))).toEqual([
			AUTH_VALIDATION_MESSAGES.passwordRequired,
		]);
	});
});

describe("signUpSchema", () => {
	it("合法输入通过，邮箱为 trim 后的值", () => {
		const result = signUpSchema.safeParse({
			...validSignUp,
			email: " tom@example.com ",
		});
		expect(result.success).toBe(true);
		expect(result.data?.email).toBe("tom@example.com");
	});

	it("确认密码与密码不一致时，错误落在 confirmPassword", () => {
		const result = signUpSchema.safeParse({
			...validSignUp,
			confirmPassword: `${VALID_PASSWORD}x`,
		});
		expect(result.success).toBe(false);
		expect(result.error?.issues).toEqual([
			expect.objectContaining({
				message: AUTH_VALIDATION_MESSAGES.confirmPasswordMismatch,
				path: ["confirmPassword"],
			}),
		]);
	});

	it("其他字段有错误时，仍会检查两次密码是否一致", () => {
		const result = signUpSchema.safeParse({
			...validSignUp,
			confirmPassword: `${VALID_PASSWORD}x`,
			username: "ab",
		});
		const confirmIssues = result.error?.issues.filter(
			({ path }) => path[0] === "confirmPassword"
		);
		expect(confirmIssues?.map(({ message }) => message)).toEqual([
			AUTH_VALIDATION_MESSAGES.confirmPasswordMismatch,
		]);
	});

	it("确认密码为空时只提示「请再次输入密码」", () => {
		const result = signUpSchema.safeParse({
			...validSignUp,
			confirmPassword: "",
		});
		expect(result.error?.issues).toEqual([
			expect.objectContaining({
				message: AUTH_VALIDATION_MESSAGES.confirmPasswordRequired,
				path: ["confirmPassword"],
			}),
		]);
	});
});

describe("isEmailIdentifier", () => {
	it.each(["a@b.co", "TOM@EXAMPLE.COM", "a@b", "@"])(
		"%j 包含 @ → 按邮箱登录",
		(value) => {
			expect(isEmailIdentifier(value)).toBe(true);
		}
	);

	it.each(["tom", "TOM", "ab", "tom.lee_1", ""])(
		"%j 不含 @ → 按用户名登录",
		(value) => {
			expect(isEmailIdentifier(value)).toBe(false);
		}
	);
});

describe("signInSchema", () => {
	it("提示文案与需求一致", () => {
		expect(AUTH_VALIDATION_MESSAGES.identifierRequired).toBe(
			"请输入用户名或邮箱"
		);
		expect(AUTH_VALIDATION_MESSAGES.passwordRequired).toBe("请输入密码");
	});

	it("用户名或邮箱为空时提示「请输入用户名或邮箱」", () => {
		const result = signInSchema.safeParse({
			identifier: "",
			password: VALID_PASSWORD,
		});
		expect(result.success).toBe(false);
		expect(result.error?.issues).toEqual([
			expect.objectContaining({
				message: AUTH_VALIDATION_MESSAGES.identifierRequired,
				path: ["identifier"],
			}),
		]);
	});

	it("用户名或邮箱只有空格时视为空", () => {
		const result = signInSchema.safeParse({
			identifier: "   ",
			password: VALID_PASSWORD,
		});
		expect(getMessages(result)).toEqual([
			AUTH_VALIDATION_MESSAGES.identifierRequired,
		]);
	});

	it("密码为空时提示「请输入密码」", () => {
		const result = signInSchema.safeParse({ identifier: "tom", password: "" });
		expect(result.success).toBe(false);
		expect(result.error?.issues).toEqual([
			expect.objectContaining({
				message: AUTH_VALIDATION_MESSAGES.passwordRequired,
				path: ["password"],
			}),
		]);
	});

	it("两项都为空时各自报错", () => {
		const result = signInSchema.safeParse({ identifier: "", password: "" });
		expect(getMessages(result)).toEqual([
			AUTH_VALIDATION_MESSAGES.identifierRequired,
			AUTH_VALIDATION_MESSAGES.passwordRequired,
		]);
	});

	it("登录不校验用户名格式和密码长度，避免泄露规则差异", () => {
		const result = signInSchema.safeParse({ identifier: "ab", password: "1" });
		expect(result.success).toBe(true);
	});

	it("identifier 解析为 trim 后的值，密码不 trim", () => {
		const result = signInSchema.safeParse({
			identifier: "  Tom@Example.com  ",
			password: " pass word ",
		});
		expect(result.data).toEqual({
			identifier: "Tom@Example.com",
			password: " pass word ",
		});
	});
});
