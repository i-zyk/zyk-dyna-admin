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
	getSignInErrorMessage,
	SIGN_IN_FALLBACK_MESSAGE,
} from "@/lib/auth-errors";
import { isEmailIdentifier, signInSchema } from "@/lib/auth-validation";

import { FieldMessages, getFieldA11yProps, toMessages } from "./field-messages";
import Loader from "./loader";

const SIGN_IN_ERROR_ID = "sign-in-error";

/** 按登录标识调用对应的 Better Auth 登录接口：包含 `@` 按邮箱，否则按用户名 */
function signInWithIdentifier(identifier: string, password: string) {
	return isEmailIdentifier(identifier)
		? authClient.signIn.email({ email: identifier, password })
		: authClient.signIn.username({ password, username: identifier });
}

export default function SignInForm({
	onSwitchToSignUp,
}: {
	onSwitchToSignUp: () => void;
}) {
	const router = useRouter();
	const { isPending } = authClient.useSession();
	// 登录失败的统一提示，显示在提交按钮上方；不区分是账号还是密码出错
	const [submitError, setSubmitError] = useState<string | undefined>();
	// 登录成功后到页面跳转完成前，按钮保持禁用，避免重复提交
	const [isRedirecting, setIsRedirecting] = useState(false);

	const form = useForm({
		defaultValues: {
			identifier: "",
			password: "",
		},
		onSubmit: async ({ value }) => {
			// 字段级校验已经拦住空值，这里再按整体 schema 解析一次，拿到 trim 后的 identifier
			const parsed = signInSchema.safeParse(value);
			if (!parsed.success) {
				return;
			}
			const { identifier, password } = parsed.data;
			setSubmitError(undefined);
			try {
				const { error } = await signInWithIdentifier(identifier, password);
				if (error) {
					setSubmitError(getSignInErrorMessage(error));
					return;
				}
			} catch {
				setSubmitError(SIGN_IN_FALLBACK_MESSAGE);
				return;
			}
			setIsRedirecting(true);
			toast.success("登录成功");
			router.push("/dashboard");
		},
	});

	if (isPending) {
		return <Loader />;
	}

	return (
		<div className="mx-auto mt-10 w-full max-w-md p-6">
			<h1 className="mb-6 text-center font-bold text-3xl">登录</h1>

			<form
				className="space-y-4"
				noValidate
				onSubmit={(e) => {
					e.preventDefault();
					e.stopPropagation();
					form.handleSubmit();
				}}
			>
				<form.Field
					name="identifier"
					validators={{ onChange: signInSchema.shape.identifier }}
				>
					{(field) => {
						const messages = toMessages(field.state.meta.errors);
						return (
							<div className="space-y-2">
								<Label htmlFor={field.name}>用户名或邮箱</Label>
								<Input
									autoCapitalize="none"
									autoComplete="username"
									id={field.name}
									name={field.name}
									onBlur={field.handleBlur}
									onChange={(e) => {
										setSubmitError(undefined);
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

				<form.Field
					name="password"
					validators={{ onChange: signInSchema.shape.password }}
				>
					{(field) => {
						const messages = toMessages(field.state.meta.errors);
						return (
							<div className="space-y-2">
								<Label htmlFor={field.name}>密码</Label>
								<Input
									autoComplete="current-password"
									id={field.name}
									name={field.name}
									onBlur={field.handleBlur}
									onChange={(e) => {
										setSubmitError(undefined);
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

				{submitError ? (
					<p
						className="text-destructive text-sm"
						id={SIGN_IN_ERROR_ID}
						role="alert"
					>
						{submitError}
					</p>
				) : null}

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
								aria-describedby={submitError ? SIGN_IN_ERROR_ID : undefined}
								className="w-full"
								disabled={!canSubmit || isBusy}
								type="submit"
							>
								{isBusy ? (
									<>
										<Loader2 aria-hidden="true" className="animate-spin" />
										登录中…
									</>
								) : (
									"登录"
								)}
							</Button>
						);
					}}
				</form.Subscribe>
			</form>

			<div className="mt-4 text-center">
				<Button onClick={onSwitchToSignUp} type="button" variant="link">
					还没有账号？去注册
				</Button>
			</div>
		</div>
	);
}
