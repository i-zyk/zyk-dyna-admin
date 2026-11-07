import { AUTH_VALIDATION_MESSAGES } from "@/lib/auth-validation";

/** 服务端错误可以落到的注册表单字段 */
export type SignUpErrorField = "email" | "password" | "username";

export interface SignUpError {
	/** 显示在哪个字段下方；为 undefined 时用 toast 提示 */
	field: SignUpErrorField | undefined;
	message: string;
}

export const SIGN_UP_FALLBACK_MESSAGE = "注册失败，请稍后再试";

const SIGN_UP_ERRORS: Readonly<Record<string, SignUpError>> = {
	INVALID_EMAIL: {
		field: "email",
		message: AUTH_VALIDATION_MESSAGES.emailInvalid,
	},
	INVALID_USERNAME: {
		field: "username",
		message: AUTH_VALIDATION_MESSAGES.usernameInvalid,
	},
	PASSWORD_TOO_LONG: {
		field: "password",
		message: AUTH_VALIDATION_MESSAGES.passwordLength,
	},
	PASSWORD_TOO_SHORT: {
		field: "password",
		message: AUTH_VALIDATION_MESSAGES.passwordLength,
	},
	USER_ALREADY_EXISTS: { field: "email", message: "邮箱已被注册" },
	USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: {
		field: "email",
		message: "邮箱已被注册",
	},
	USERNAME_IS_ALREADY_TAKEN: { field: "username", message: "用户名已存在" },
	USERNAME_TOO_LONG: {
		field: "username",
		message: AUTH_VALIDATION_MESSAGES.usernameLength,
	},
	USERNAME_TOO_SHORT: {
		field: "username",
		message: AUTH_VALIDATION_MESSAGES.usernameLength,
	},
};

/**
 * 把 Better Auth 注册接口返回的错误码映射成中文提示。
 * 未知错误码、没有错误码（例如网络错误）时返回通用文案，field 为 undefined。
 */
export function getSignUpError(code: string | null | undefined): SignUpError {
	// 用 Object.hasOwn 避免 "toString" 之类的错误码命中原型链上的属性
	const known =
		code && Object.hasOwn(SIGN_UP_ERRORS, code)
			? SIGN_UP_ERRORS[code]
			: undefined;
	return known ?? { field: undefined, message: SIGN_UP_FALLBACK_MESSAGE };
}

export const SIGN_IN_INVALID_CREDENTIALS_MESSAGE = "账号或密码错误";
export const SIGN_IN_FALLBACK_MESSAGE = "登录失败，请稍后再试";

/** 登录接口返回这些错误码时，统一提示「账号或密码错误」，不透露具体是哪一项错 */
const SIGN_IN_CREDENTIAL_ERROR_CODES: ReadonlySet<string> = new Set([
	"INVALID_EMAIL",
	"INVALID_EMAIL_OR_PASSWORD",
	"INVALID_USERNAME",
	"INVALID_USERNAME_OR_PASSWORD",
	"USERNAME_TOO_LONG",
	"USERNAME_TOO_SHORT",
]);

/** 认证类错误对应的 HTTP 状态码：400 格式不合法、401 账号或密码错误、422 用户名长度 / 格式不合法 */
const SIGN_IN_CREDENTIAL_ERROR_STATUSES: ReadonlySet<number> = new Set([
	400, 401, 422,
]);

/** Better Auth 客户端返回的错误里登录映射用到的字段 */
export interface SignInErrorLike {
	code?: string | null;
	status?: number | null;
}

/**
 * 把登录失败映射成中文提示：认证类错误统一为「账号或密码错误」；
 * 网络错误（没有 error 对象）、5xx 和其他错误显示「登录失败，请稍后再试」。两种文案都不透露账号是否存在。
 */
export function getSignInErrorMessage(
	error: SignInErrorLike | null | undefined
): string {
	const isCredentialError =
		(typeof error?.code === "string" &&
			SIGN_IN_CREDENTIAL_ERROR_CODES.has(error.code)) ||
		(typeof error?.status === "number" &&
			SIGN_IN_CREDENTIAL_ERROR_STATUSES.has(error.status));
	return isCredentialError
		? SIGN_IN_INVALID_CREDENTIALS_MESSAGE
		: SIGN_IN_FALLBACK_MESSAGE;
}
