import { useForm } from "@tanstack/react-form";
import { skipToken, useQuery } from "@tanstack/react-query";
import { Button } from "@zyk-dyna-admin/ui/components/button";
import { Input } from "@zyk-dyna-admin/ui/components/input";
import { Label } from "@zyk-dyna-admin/ui/components/label";
import { Loader2 } from "lucide-react";
import { useState } from "react";

import { getGithubSearchErrorMessage } from "@/lib/github-search-errors";
import {
	GITHUB_USERNAME_INVALID_MESSAGE,
	parseGithubUsernameInput,
} from "@/lib/github-username";
import { useTRPC } from "@/utils/trpc";
import { AddGithubPerson } from "./add-github-person";
import { FieldMessages, getFieldA11yProps, toMessages } from "./field-messages";
import { GithubUserCard, GithubUserCardSkeleton } from "./github-user-card";

const MS_PER_MINUTE = 60_000;
/** 同一用户名 5 分钟内重复搜索直接命中 TanStack Query 缓存 */
const GITHUB_USER_STALE_TIME_MS = 5 * MS_PER_MINUTE;

/** 提交时校验：只拦格式不合法的输入；空输入不提示错误，由 onSubmit 直接忽略 */
function validateUsernameOnSubmit({ value }: { value: string }) {
	return parseGithubUsernameInput(value).status === "invalid"
		? GITHUB_USERNAME_INVALID_MESSAGE
		: undefined;
}

/** GitHub 用户搜索：表单校验 → 后端 `github.getUser` 代理查询 → 加载 / 错误 / 结果 */
export default function GithubUserSearch() {
	const trpc = useTRPC();
	// 校验通过后 trim + 小写的用户名，作为查询参数和缓存键；null 表示还没有可查询的用户名
	const [username, setUsername] = useState<string | null>(null);

	const userQuery = useQuery(
		trpc.github.getUser.queryOptions(
			username === null ? skipToken : { username },
			{
				meta: { skipGlobalErrorToast: true },
				retry: false,
				staleTime: GITHUB_USER_STALE_TIME_MS,
			}
		)
	);
	const { isFetching } = userQuery;

	const form = useForm({
		defaultValues: { username: "" },
		onSubmit: async ({ value }) => {
			const parsed = parseGithubUsernameInput(value.username);
			// 空输入（或只有空格）直接忽略，不发请求、不提示
			if (parsed.status !== "valid" || isFetching) {
				return;
			}
			// 同一用户名 setUsername 不会触发请求，需要手动 refetch：
			// 错误结果不缓存（上次失败要重新请求）；成功结果超过 staleTime 也要重新请求，
			// 否则 staleTime 只把数据标记为过期，页面会一直显示旧资料。5 分钟内仍直接命中缓存
			const isSameUsername = parsed.username === username;
			const isCacheExpired =
				Date.now() - userQuery.dataUpdatedAt >= GITHUB_USER_STALE_TIME_MS;
			if (isSameUsername && (userQuery.isError || isCacheExpired)) {
				await userQuery.refetch();
				return;
			}
			setUsername(parsed.username);
		},
		// 格式不合法时清掉上一次的结果，只保留格式错误提示
		onSubmitInvalid: () => {
			setUsername(null);
		},
	});

	const queryErrorMessage =
		!isFetching && userQuery.isError
			? getGithubSearchErrorMessage(userQuery.error.data?.code)
			: undefined;
	// 只在查询成功时显示卡片：刷新失败时 TanStack Query 仍保留上一次的 data，
	// 不能把旧资料和错误提示同时展示
	const profile =
		!isFetching && userQuery.isSuccess ? userQuery.data : undefined;

	return (
		<section aria-labelledby="github-user-search-title" className="space-y-4">
			<h2 className="font-medium text-sm" id="github-user-search-title">
				GitHub 用户查询
			</h2>

			<form
				className="flex flex-col gap-2 sm:flex-row sm:items-start"
				noValidate
				onSubmit={(e) => {
					e.preventDefault();
					e.stopPropagation();
					form.handleSubmit();
				}}
			>
				<form.Field
					name="username"
					validators={{ onSubmit: validateUsernameOnSubmit }}
				>
					{(field) => {
						const messages = toMessages(field.state.meta.errors);
						return (
							<div className="min-w-0 flex-1 space-y-2">
								<Label htmlFor={field.name}>GitHub 用户名</Label>
								<Input
									autoCapitalize="none"
									autoComplete="off"
									id={field.name}
									name={field.name}
									onBlur={field.handleBlur}
									onChange={(e) => field.handleChange(e.target.value)}
									placeholder="例如 torvalds"
									spellCheck={false}
									value={field.state.value}
									{...getFieldA11yProps(field.name, messages)}
								/>
								<FieldMessages fieldName={field.name} messages={messages} />
							</div>
						);
					}}
				</form.Field>

				<Button
					aria-busy={isFetching || undefined}
					className="sm:mt-5"
					disabled={isFetching}
					type="submit"
				>
					{isFetching ? (
						<>
							<Loader2 aria-hidden="true" className="animate-spin" />
							搜索中…
						</>
					) : (
						"搜索"
					)}
				</Button>
			</form>

			{isFetching ? <GithubUserCardSkeleton /> : null}

			{queryErrorMessage ? (
				<p className="text-destructive text-sm" role="alert">
					{queryErrorMessage}
				</p>
			) : null}

			{profile ? (
				<>
					<GithubUserCard profile={profile} />
					<AddGithubPerson key={profile.githubId} username={profile.login} />
				</>
			) : null}
		</section>
	);
}
