"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@zyk-dyna-admin/ui/components/button";
import Link from "next/link";
import { toast } from "sonner";
import { useTRPC } from "@/utils/trpc";

export function AddGithubPerson({ username }: { username: string }) {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const add = useMutation(
		trpc.githubPerson.add.mutationOptions({
			onSuccess: async () => {
				await queryClient.invalidateQueries(
					trpc.githubPerson.list.pathFilter()
				);
				toast.success("已加入 GitHub 人员库");
			},
		})
	);
	let label = "加入人员库";
	if (add.isPending) {
		label = "正在保存…";
	} else if (add.isSuccess) {
		label = "已添加";
	}
	return (
		<div className="flex flex-wrap items-center gap-4">
			<Button
				disabled={add.isPending || add.isSuccess}
				onClick={() => add.mutate({ username })}
			>
				{label}
			</Button>
			<Link
				className="text-sm underline underline-offset-4"
				href="/github-people"
			>
				查看 GitHub 人员库
			</Link>
		</div>
	);
}
