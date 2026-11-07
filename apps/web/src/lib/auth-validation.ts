import { z } from "zod";

// 以下规则与服务端 Better Auth 默认配置保持一致（username 插件、emailAndPassword）。
// 前端不能在运行时导入 @zyk-dyna-admin/auth，修改服务端配置时需要同步修改这里。
export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 30;
export const USERNAME_PATTERN = /^[a-zA-Z0-9_.]+$/;
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;

export const AUTH_VALIDATION_MESSAGES = {
	confirmPasswordMismatch: "两次输入的密码不一致",
	confirmPasswordRequired: "请再次输入密码",
	emailInvalid: "邮箱格式不正确",
	emailRequired: "请输入邮箱",
	identifierRequired: "请输入用户名或邮箱",
	passwordLength: `密码需为 ${PASSWORD_MIN_LENGTH}–${PASSWORD_MAX_LENGTH} 位`,
	passwordRequired: "请输入密码",
	usernameInvalid: "用户名只能包含字母、数字、下划线和点",
	usernameLength: `用户名需为 ${USERNAME_MIN_LENGTH}–${USERNAME_MAX_LENGTH} 位`,
	usernameRequired: "请输入用户名",
} as const;

const messages = AUTH_VALIDATION_MESSAGES;

/** 用户名：不自动 trim，含空格直接报格式错误；为空时只提示「请输入用户名」 */
export const usernameSchema = z
	.string()
	.min(1, { abort: true, error: messages.usernameRequired })
	.min(USERNAME_MIN_LENGTH, { error: messages.usernameLength })
	.max(USERNAME_MAX_LENGTH, { error: messages.usernameLength })
	.regex(USERNAME_PATTERN, { error: messages.usernameInvalid });

/** 邮箱：先 trim 再校验，解析结果为 trim 后的值 */
export const emailSchema = z
	.string()
	.trim()
	.min(1, { abort: true, error: messages.emailRequired })
	.pipe(z.email({ error: messages.emailInvalid }));

export const passwordSchema = z
	.string()
	.min(1, { abort: true, error: messages.passwordRequired })
	.min(PASSWORD_MIN_LENGTH, { error: messages.passwordLength })
	.max(PASSWORD_MAX_LENGTH, { error: messages.passwordLength });

const passwordPairSchema = z.object({
	confirmPassword: z.string(),
	password: z.string(),
});

export const signUpSchema = z
	.object({
		confirmPassword: z
			.string()
			.min(1, { abort: true, error: messages.confirmPasswordRequired }),
		email: emailSchema,
		password: passwordSchema,
		username: usernameSchema,
	})
	.refine((data) => data.password === data.confirmPassword, {
		error: messages.confirmPasswordMismatch,
		path: ["confirmPassword"],
		// 其他字段有错误时也要检查两次密码是否一致；确认密码为空时只提示「请再次输入密码」
		when: (payload) => {
			const pair = passwordPairSchema.safeParse(payload.value);
			return pair.success && pair.data.confirmPassword.length > 0;
		},
	});

export type SignUpInput = z.input<typeof signUpSchema>;
export type SignUpValues = z.output<typeof signUpSchema>;

/**
 * 登录只做必填校验：不在登录时校验用户名格式或密码长度，避免通过提示差异泄露规则。
 * identifier 解析结果为 trim 后的值；密码不 trim。
 */
export const signInSchema = z.object({
	identifier: z.string().trim().min(1, { error: messages.identifierRequired }),
	password: z.string().min(1, { error: messages.passwordRequired }),
});

export type SignInInput = z.input<typeof signInSchema>;
export type SignInValues = z.output<typeof signInSchema>;

/** 登录标识包含 `@` 时按邮箱登录（signIn.email），否则按用户名登录（signIn.username） */
export function isEmailIdentifier(identifier: string): boolean {
	return identifier.includes("@");
}
