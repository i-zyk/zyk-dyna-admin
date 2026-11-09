"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	Avatar,
	AvatarFallback,
	AvatarImage,
} from "@zyk-dyna-admin/ui/components/avatar";
import { Button } from "@zyk-dyna-admin/ui/components/button";
import {
	Card,
	CardContent,
	CardHeader,
} from "@zyk-dyna-admin/ui/components/card";
import { Input } from "@zyk-dyna-admin/ui/components/input";
import { Label } from "@zyk-dyna-admin/ui/components/label";
import { Textarea } from "@zyk-dyna-admin/ui/components/textarea";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { useTRPC } from "@/utils/trpc";
import type { RouterOutputs } from "@/utils/trpc-types";

type Person = RouterOutputs["githubPerson"]["getById"];

function PersonCard({ person }: { person: Person }) {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const [confirmDelete, setConfirmDelete] = useState(false);
	const refresh = () =>
		queryClient.invalidateQueries(trpc.githubPerson.list.pathFilter());
	const update = useMutation(
		trpc.githubPerson.update.mutationOptions({
			onSuccess: async () => {
				await refresh();
				toast.success("资料已保存");
			},
		})
	);
	const remove = useMutation(
		trpc.githubPerson.delete.mutationOptions({
			onSuccess: async () => {
				await refresh();
				toast.success("已移出人员库");
			},
		})
	);
	return (
		<Card>
			<CardHeader className="flex items-center gap-3">
				<Avatar size="lg">
					<AvatarImage alt={`${person.login} 的头像`} src={person.avatarUrl} />
					<AvatarFallback>{person.login.charAt(0)}</AvatarFallback>
				</Avatar>
				<div className="min-w-0">
					<h2 className="wrap-anywhere font-semibold text-lg">
						{person.displayName ?? person.name ?? person.login}
					</h2>
					<a
						className="text-muted-foreground text-sm underline-offset-4 hover:underline"
						href={person.htmlUrl}
						rel="noopener noreferrer"
						target="_blank"
					>
						@{person.login} ↗
					</a>
				</div>
			</CardHeader>
			<CardContent className="space-y-4">
				{person.bio ? (
					<p className="wrap-anywhere text-sm">{person.bio}</p>
				) : null}
				<p className="text-muted-foreground text-sm">
					{[person.company, person.location].filter(Boolean).join(" · ")}
				</p>
				<dl className="grid grid-cols-3 gap-2 rounded-lg bg-muted/50 p-3 text-center text-sm">
					<div>
						<dt className="text-muted-foreground">仓库</dt>
						<dd>{person.publicRepos}</dd>
					</div>
					<div>
						<dt className="text-muted-foreground">粉丝</dt>
						<dd>{person.followers}</dd>
					</div>
					<div>
						<dt className="text-muted-foreground">关注</dt>
						<dd>{person.following}</dd>
					</div>
				</dl>
				{person.note ? (
					<p className="wrap-anywhere whitespace-pre-wrap rounded-lg border p-3 text-sm">
						{person.note}
					</p>
				) : null}
				<details>
					<summary className="cursor-pointer text-sm underline underline-offset-4">
						修改展示资料
					</summary>
					<form
						className="mt-3 space-y-3"
						onSubmit={(event) => {
							event.preventDefault();
							const data = new FormData(event.currentTarget);
							update.mutate({
								displayName: String(data.get("displayName") ?? ""),
								id: person.id,
								note: String(data.get("note") ?? ""),
							});
						}}
					>
						<Label htmlFor={`name-${person.id}`}>展示名称</Label>
						<Input
							defaultValue={person.displayName ?? ""}
							id={`name-${person.id}`}
							maxLength={100}
							name="displayName"
							placeholder={person.name ?? person.login}
						/>
						<Label htmlFor={`note-${person.id}`}>备注</Label>
						<Textarea
							defaultValue={person.note ?? ""}
							id={`note-${person.id}`}
							maxLength={500}
							name="note"
						/>
						<Button disabled={update.isPending} type="submit">
							{update.isPending ? "保存中…" : "保存修改"}
						</Button>
					</form>
				</details>
				{confirmDelete ? (
					<div className="space-y-2 rounded-lg border border-destructive/30 p-3">
						<p className="text-sm">确定移除 @{person.login} 吗？</p>
						<div className="flex gap-2">
							<Button
								disabled={remove.isPending}
								onClick={() => remove.mutate({ id: person.id })}
								variant="destructive"
							>
								{remove.isPending ? "删除中…" : "确认删除"}
							</Button>
							<Button
								disabled={remove.isPending}
								onClick={() => setConfirmDelete(false)}
								variant="outline"
							>
								取消
							</Button>
						</div>
					</div>
				) : (
					<Button onClick={() => setConfirmDelete(true)} variant="outline">
						移出人员库
					</Button>
				)}
			</CardContent>
		</Card>
	);
}

export function GithubPeople() {
	const trpc = useTRPC();
	const [search, setSearch] = useState("");
	const [keyword, setKeyword] = useState("");
	const [page, setPage] = useState(1);
	const query = useQuery(
		trpc.githubPerson.list.queryOptions(
			{ keyword, page, pageSize: 20 },
			{ meta: { skipGlobalErrorToast: true } }
		)
	);
	return (
		<div className="space-y-6">
			<form
				className="flex flex-wrap gap-2"
				onSubmit={(event) => {
					event.preventDefault();
					setKeyword(search.trim());
					setPage(1);
				}}
			>
				<Input
					aria-label="搜索已添加的 GitHub 人员"
					className="min-w-0 flex-1"
					maxLength={100}
					onChange={(event) => setSearch(event.target.value)}
					placeholder="搜索用户名或姓名"
					value={search}
				/>
				<Button type="submit">搜索</Button>
				<Link
					className="inline-flex items-center px-3 text-sm underline"
					href="/dashboard"
				>
					添加 GitHub 用户
				</Link>
			</form>
			{query.isPending ? <p role="status">正在加载人员库…</p> : null}
			{query.isError ? (
				<div className="space-y-3 rounded-xl border p-6" role="alert">
					<p>人员库加载失败，请检查网络后重试。</p>
					<Button onClick={() => query.refetch()}>重试</Button>
				</div>
			) : null}
			{query.isSuccess ? (
				<>
					<p className="text-muted-foreground text-sm">
						共 {query.data.total} 位开发者
					</p>
					{query.data.items.length ? (
						<div className="grid gap-4 md:grid-cols-2">
							{query.data.items.map((person) => (
								<PersonCard key={person.id} person={person} />
							))}
						</div>
					) : (
						<div className="rounded-xl border border-dashed p-12 text-center">
							<h2 className="font-medium">
								{keyword ? "没有匹配的人员" : "人员库还是空的"}
							</h2>
							<p className="mt-2 text-muted-foreground text-sm">
								在 Dashboard 搜索 GitHub 用户，然后点击“加入人员库”。
							</p>
						</div>
					)}
					<div className="flex items-center justify-between gap-3">
						<Button
							disabled={page === 1 || query.isFetching}
							onClick={() => setPage(page - 1)}
							variant="outline"
						>
							上一页
						</Button>
						<span className="text-sm">第 {page} 页</span>
						<Button
							disabled={page * 20 >= query.data.total || query.isFetching}
							onClick={() => setPage(page + 1)}
							variant="outline"
						>
							下一页
						</Button>
					</div>
				</>
			) : null}
		</div>
	);
}
