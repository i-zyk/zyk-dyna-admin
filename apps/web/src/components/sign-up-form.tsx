import { useForm } from "@tanstack/react-form";
import { Button } from "@zyk-dyna-admin/ui/components/button";
import { Input } from "@zyk-dyna-admin/ui/components/input";
import { Label } from "@zyk-dyna-admin/ui/components/label";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { authClient } from "@/lib/auth-client";
import {
	getSignUpError,
	SIGN_UP_FALLBACK_MESSAGE,
	type SignUpErrorField,
} from "@/lib/auth-errors";
import {
	AUTH_VALIDATION_MESSAGES,
	emailSchema,
	passwordSchema,
	signUpSchema,
	usernameSchema,
} from "@/lib/auth-validation";

import Loader from "./loader";

type ServerErrors = Partial<Record<SignUpErrorField, string>>;

/** 把 TanStack Form 的错误（字符串或 Standard Schema issue）统一成去重后的文案 */
function toMessages(errors: readonly unknown[]): string[] {
	const messages = new Set<string>();
	for (const error of errors) {
		if (typeof error === "string") {
			messages.add(error);
		} else if (
			typeof error === "object" &&
			error !== null &&
			"message" in error &&
			typeof error.message === "string"
		) {
			messages.add(error.message);
		}
	}
	return [...messages];
}

function getErrorId(fieldName: string): string {
	return `${fieldName}-error`;
}

/** 字段下方的错误提示；没有错误时不渲染 */
function FieldMessages({
	fieldName,
	messages,
}: {
	fieldName: string;
	messages: readonly string[];
}) {
	if (messages.length === 0) {
		return null;
	}
	return (
		<div className="space-y-1" id={getErrorId(fieldName)}>
			{messages.map((message) => (
				<p className="text-destructive text-xs" key={message}>
					{message}
				</p>
			))}
		</div>
	);
}

/** 把前端校验错误和服务端返回的字段错误合并，生成输入框的无障碍属性 */
function getFieldA11yProps(fieldName: string, messages: readonly string[]) {
	const hasError = messages.length > 0;
	return {
		"aria-describedby": hasError ? getErrorId(fieldName) : undefined,
		"aria-invalid": hasError || undefined,
	};
}

export default function SignUpForm({
	onSwitchToSignIn,
}: {
	onSwitchToSignIn: () => void;
}) {
	const router = useRouter();
	const { isPending } = authClient.useSession();
	const [serverErrors, setServerErrors] = useState<ServerErrors>({});
	// 注册成功后到页面跳转完成前，按钮保持禁用，避免重复提交
	const [isRedirecting, setIsRedirecting] = useState(false);

	const clearServerError = (field: SignUpErrorField) => {
		setServerErrors((previous) => {
			if (!(field in previous)) {
				return previous;
			}
			const { [field]: _removed, ...rest } = previous;
			return rest;
		});
	};

	const form = useForm({
		defaultValues: {
			confirmPassword: "",
			email: "",
			password: "",
			username: "",
		},
		onSubmit: async ({ value }) => {
			// 字段级校验已经拦住非法输入，这里再按整体 schema 解析一次，拿到 trim 后的邮箱
			const parsed = signUpSchema.safeParse(value);
			if (!parsed.success) {
				return;
			}
			const { email, password, username } = parsed.data;
			setServerErrors({});
			try {
				const { error } = await authClient.signUp.email({
					email,
					name: username,
					password,
					username,
				});
				if (error) {
					const { field, message } = getSignUpError(error.code);
					if (field) {
						setServerErrors({ [field]: message });
					} else {
						toast.error(message);
					}
					return;
				}
			} catch {
				toast.error(SIGN_UP_FALLBACK_MESSAGE);
				return;
			}
			setIsRedirecting(true);
			toast.success("注册成功");
			router.push("/dashboard");
		},
	});

	if (isPending) {
		return <Loader />;
	}

	return (
		<div className="mx-auto mt-10 w-full max-w-md p-6">
			<h1 className="mb-6 text-center font-bold text-3xl">创建账号</h1>

			<form
				className="space-y-4"
				noValidate
				onSubmit={(e) => {
					e.preventDefault();
					e.stopPropagation();
					form.handleSubmit();
				}}
			>
				<form.Field name="username" validators={{ onChange: usernameSchema }}>
					{(field) => {
						const messages = toMessages([
							...field.state.meta.errors,
							serverErrors.username,
						]);
						return (
							<div className="space-y-2">
								<Label htmlFor={field.name}>用户名</Label>
								<Input
									autoCapitalize="none"
									autoComplete="username"
									id={field.name}
									name={field.name}
									onBlur={field.handleBlur}
									onChange={(e) => {
										clearServerError("username");
										field.handleChange(e.target.value);
									}}
									spellCheck={false}
									value={field.state.value}
									{...getFieldA11yProps(field.name, messages)}
								/>
								<FieldMessages fieldName={field.name} messages={messages} />
							</div>
						);
					}}
				</form.Field>

				<form.Field name="email" validators={{ onChange: emailSchema }}>
					{(field) => {
						const messages = toMessages([
							...field.state.meta.errors,
							serverErrors.email,
						]);
						return (
							<div className="space-y-2">
								<Label htmlFor={field.name}>邮箱</Label>
								<Input
									autoComplete="email"
									id={field.name}
									name={field.name}
									onBlur={field.handleBlur}
									onChange={(e) => {
										clearServerError("email");
										field.handleChange(e.target.value);
									}}
									type="email"
									value={field.state.value}
									{...getFieldA11yProps(field.name, messages)}
								/>
								<FieldMessages fieldName={field.name} messages={messages} />
							</div>
						);
					}}
				</form.Field>

				<form.Field name="password" validators={{ onChange: passwordSchema }}>
					{(field) => {
						const messages = toMessages([
							...field.state.meta.errors,
							serverErrors.password,
						]);
						return (
							<div className="space-y-2">
								<Label htmlFor={field.name}>密码</Label>
								<Input
									autoComplete="new-password"
									id={field.name}
									name={field.name}
									onBlur={field.handleBlur}
									onChange={(e) => {
										clearServerError("password");
										field.handleChange(e.target.value);
									}}
									type="password"
									value={field.state.value}
									{...getFieldA11yProps(field.name, messages)}
								/>
								<FieldMessages fieldName={field.name} messages={messages} />
							</div>
						);
					}}
				</form.Field>

				<form.Field
					name="confirmPassword"
					validators={{
						onChange: ({ fieldApi, value }) => {
							if (value.length === 0) {
								// 只因密码变化触发校验、用户还没碰过确认密码时，先不提示；提交时会把所有字段标记为 touched
								return fieldApi.state.meta.isTouched
									? AUTH_VALIDATION_MESSAGES.confirmPasswordRequired
									: undefined;
							}
							return value === fieldApi.form.getFieldValue("password")
								? undefined
								: AUTH_VALIDATION_MESSAGES.confirmPasswordMismatch;
						},
						onChangeListenTo: ["password"],
					}}
				>
					{(field) => {
						const messages = toMessages(field.state.meta.errors);
						return (
							<div className="space-y-2">
								<Label htmlFor={field.name}>确认密码</Label>
								<Input
									autoComplete="new-password"
									id={field.name}
									name={field.name}
									onBlur={field.handleBlur}
									onChange={(e) => field.handleChange(e.target.value)}
									type="password"
									value={field.state.value}
									{...getFieldA11yProps(field.name, messages)}
								/>
								<FieldMessages fieldName={field.name} messages={messages} />
							</div>
						);
					}}
				</form.Field>

				<form.Subscribe
					selector={(state) => ({
						canSubmit: state.canSubmit,
						isSubmitting: state.isSubmitting,
					})}
				>
					{({ canSubmit, isSubmitting }) => {
						const isBusy = isSubmitting || isRedirecting;
						return (
							<Button
								aria-busy={isBusy || undefined}
								className="w-full"
								disabled={!canSubmit || isBusy}
								type="submit"
							>
								{isBusy ? (
									<>
										<Loader2 aria-hidden="true" className="animate-spin" />
										注册中…
									</>
								) : (
									"注册"
								)}
							</Button>
						);
					}}
				</form.Subscribe>
			</form>

			<div className="mt-4 text-center">
				<Button onClick={onSwitchToSignIn} type="button" variant="link">
					已有账号？去登录
				</Button>
			</div>
		</div>
	);
}
