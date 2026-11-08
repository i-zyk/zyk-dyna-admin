"use client";

import { useForm } from "@tanstack/react-form";
import type { PersonInput } from "@zyk-dyna-admin/api/lib/person-input";
import { Button, buttonVariants } from "@zyk-dyna-admin/ui/components/button";
import { Input } from "@zyk-dyna-admin/ui/components/input";
import { Label } from "@zyk-dyna-admin/ui/components/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@zyk-dyna-admin/ui/components/select";
import { Textarea } from "@zyk-dyna-admin/ui/components/textarea";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { useState } from "react";

import {
	PERSON_STATUS_OPTIONS,
	type PersonFormValues,
	personDepartmentSchema,
	personEmailSchema,
	personEmployeeNoSchema,
	personFormSchema,
	personNameSchema,
	personPhoneSchema,
	personPositionSchema,
	personRemarkSchema,
	personStatusSchema,
	toPersonInput,
} from "@/lib/person-validation";

import { FieldMessages, getFieldA11yProps, toMessages } from "./field-messages";

/**
 * 父组件提交后的结果：
 * - `saved`：保存成功，父组件负责提示和跳转，按钮保持禁用直到跳转完成
 * - `employeeNoConflict`：工号已存在，错误显示在工号字段下方
 * - `failed`：其他错误，父组件已自行提示（toast 或切换为不存在提示），按钮恢复可用
 */
export type PersonFormSubmitResult =
	| { status: "saved" }
	| { message: string; status: "employeeNoConflict" }
	| { status: "failed" };

/** 字段外层：标签 + 输入控件 + 字段下方的错误 */
function PersonFieldShell({
	children,
	className,
	fieldName,
	label,
	messages,
	required = false,
}: {
	children: ReactNode;
	className?: string;
	fieldName: string;
	label: string;
	messages: readonly string[];
	required?: boolean;
}) {
	return (
		<div className={["min-w-0 space-y-2", className].filter(Boolean).join(" ")}>
			<Label htmlFor={fieldName}>
				{label}
				{required ? (
					<span aria-hidden="true" className="text-destructive">
						*
					</span>
				) : null}
			</Label>
			{children}
			<FieldMessages fieldName={fieldName} messages={messages} />
		</div>
	);
}

/** 人员表单（新增 / 编辑共用）：字段级实时校验，提交前整体校验并归一化后交给父组件保存 */
export default function PersonForm({
	defaultValues,
	onSubmit,
}: {
	defaultValues: PersonFormValues;
	onSubmit: (input: PersonInput) => Promise<PersonFormSubmitResult>;
}) {
	// 服务端返回的工号冲突，修改工号后清除
	const [employeeNoError, setEmployeeNoError] = useState<string | null>(null);
	// 保存成功后到页面跳转完成前，按钮保持禁用，避免重复提交
	const [isRedirecting, setIsRedirecting] = useState(false);

	const form = useForm({
		defaultValues,
		onSubmit: async ({ value }) => {
			// 字段级校验已经拦住非法输入，这里再按整体 schema 校验一次兜底
			if (!personFormSchema.safeParse(value).success) {
				return;
			}
			setEmployeeNoError(null);
			const result = await onSubmit(toPersonInput(value));
			if (result.status === "saved") {
				setIsRedirecting(true);
			} else if (result.status === "employeeNoConflict") {
				setEmployeeNoError(result.message);
			}
		},
	});

	return (
		<form
			className="space-y-6"
			noValidate
			onSubmit={(e) => {
				e.preventDefault();
				e.stopPropagation();
				form.handleSubmit();
			}}
		>
			<div className="grid gap-4 sm:grid-cols-2">
				<form.Field name="name" validators={{ onChange: personNameSchema }}>
					{(field) => {
						const messages = toMessages(field.state.meta.errors);
						return (
							<PersonFieldShell
								fieldName={field.name}
								label="姓名"
								messages={messages}
								required
							>
								<Input
									aria-required="true"
									autoComplete="off"
									id={field.name}
									name={field.name}
									onBlur={field.handleBlur}
									onChange={(e) => field.handleChange(e.target.value)}
									value={field.state.value}
									{...getFieldA11yProps(field.name, messages)}
								/>
							</PersonFieldShell>
						);
					}}
				</form.Field>

				<form.Field
					name="employeeNo"
					validators={{ onChange: personEmployeeNoSchema }}
				>
					{(field) => {
						const messages = toMessages([
							...field.state.meta.errors,
							employeeNoError,
						]);
						return (
							<PersonFieldShell
								fieldName={field.name}
								label="工号"
								messages={messages}
								required
							>
								<Input
									aria-required="true"
									autoCapitalize="characters"
									autoComplete="off"
									id={field.name}
									name={field.name}
									onBlur={field.handleBlur}
									onChange={(e) => {
										setEmployeeNoError(null);
										field.handleChange(e.target.value);
									}}
									spellCheck={false}
									value={field.state.value}
									{...getFieldA11yProps(field.name, messages)}
								/>
							</PersonFieldShell>
						);
					}}
				</form.Field>

				<form.Field name="phone" validators={{ onChange: personPhoneSchema }}>
					{(field) => {
						const messages = toMessages(field.state.meta.errors);
						return (
							<PersonFieldShell
								fieldName={field.name}
								label="手机号"
								messages={messages}
							>
								<Input
									autoComplete="off"
									id={field.name}
									inputMode="numeric"
									name={field.name}
									onBlur={field.handleBlur}
									onChange={(e) => field.handleChange(e.target.value)}
									type="tel"
									value={field.state.value}
									{...getFieldA11yProps(field.name, messages)}
								/>
							</PersonFieldShell>
						);
					}}
				</form.Field>

				<form.Field name="email" validators={{ onChange: personEmailSchema }}>
					{(field) => {
						const messages = toMessages(field.state.meta.errors);
						return (
							<PersonFieldShell
								fieldName={field.name}
								label="邮箱"
								messages={messages}
							>
								<Input
									autoCapitalize="none"
									autoComplete="off"
									id={field.name}
									name={field.name}
									onBlur={field.handleBlur}
									onChange={(e) => field.handleChange(e.target.value)}
									spellCheck={false}
									type="email"
									value={field.state.value}
									{...getFieldA11yProps(field.name, messages)}
								/>
							</PersonFieldShell>
						);
					}}
				</form.Field>

				<form.Field
					name="department"
					validators={{ onChange: personDepartmentSchema }}
				>
					{(field) => {
						const messages = toMessages(field.state.meta.errors);
						return (
							<PersonFieldShell
								fieldName={field.name}
								label="部门"
								messages={messages}
							>
								<Input
									autoComplete="off"
									id={field.name}
									name={field.name}
									onBlur={field.handleBlur}
									onChange={(e) => field.handleChange(e.target.value)}
									value={field.state.value}
									{...getFieldA11yProps(field.name, messages)}
								/>
							</PersonFieldShell>
						);
					}}
				</form.Field>

				<form.Field
					name="position"
					validators={{ onChange: personPositionSchema }}
				>
					{(field) => {
						const messages = toMessages(field.state.meta.errors);
						return (
							<PersonFieldShell
								fieldName={field.name}
								label="职位"
								messages={messages}
							>
								<Input
									autoComplete="off"
									id={field.name}
									name={field.name}
									onBlur={field.handleBlur}
									onChange={(e) => field.handleChange(e.target.value)}
									value={field.state.value}
									{...getFieldA11yProps(field.name, messages)}
								/>
							</PersonFieldShell>
						);
					}}
				</form.Field>

				<form.Field name="status" validators={{ onChange: personStatusSchema }}>
					{(field) => {
						const messages = toMessages(field.state.meta.errors);
						return (
							<PersonFieldShell
								fieldName={field.name}
								label="状态"
								messages={messages}
								required
							>
								<Select
									items={PERSON_STATUS_OPTIONS}
									name={field.name}
									onValueChange={(value) => {
										if (value !== null) {
											field.handleChange(value);
										}
									}}
									value={field.state.value}
								>
									<SelectTrigger
										className="w-full"
										id={field.name}
										onBlur={field.handleBlur}
										{...getFieldA11yProps(field.name, messages)}
									>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{PERSON_STATUS_OPTIONS.map(({ label, value }) => (
											<SelectItem key={value} value={value}>
												{label}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</PersonFieldShell>
						);
					}}
				</form.Field>

				<form.Field name="remark" validators={{ onChange: personRemarkSchema }}>
					{(field) => {
						const messages = toMessages(field.state.meta.errors);
						return (
							<PersonFieldShell
								className="sm:col-span-2"
								fieldName={field.name}
								label="备注"
								messages={messages}
							>
								<Textarea
									id={field.name}
									name={field.name}
									onBlur={field.handleBlur}
									onChange={(e) => field.handleChange(e.target.value)}
									rows={4}
									value={field.state.value}
									{...getFieldA11yProps(field.name, messages)}
								/>
							</PersonFieldShell>
						);
					}}
				</form.Field>
			</div>

			<div className="flex flex-wrap items-center gap-2">
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
								disabled={!canSubmit || isBusy}
								type="submit"
							>
								{isBusy ? (
									<>
										<Loader2 aria-hidden="true" className="animate-spin" />
										保存中…
									</>
								) : (
									"保存"
								)}
							</Button>
						);
					}}
				</form.Subscribe>
				<Link
					className={buttonVariants({ variant: "outline" })}
					href="/persons"
				>
					取消
				</Link>
			</div>
		</form>
	);
}
