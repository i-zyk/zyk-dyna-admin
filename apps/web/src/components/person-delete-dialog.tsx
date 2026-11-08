"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
} from "@zyk-dyna-admin/ui/components/alert-dialog";
import { Button } from "@zyk-dyna-admin/ui/components/button";
import { useState } from "react";
import { toast } from "sonner";

import {
	getPersonDeleteErrorMessage,
	isPersonNotFound,
} from "@/lib/person-errors";
import { getTrpcErrorCode } from "@/lib/trpc-errors";
import { useTRPC } from "@/utils/trpc";

export interface PersonDeleteTarget {
	employeeNo: string;
	id: string;
	name: string;
}

/**
 * 列表每行的「删除」按钮 + 二次确认对话框：
 * 取消 / Esc 不删除；确认后调 `person.delete`，请求中禁用按钮且不能关闭对话框；
 * 成功提示「已删除」，人员已被删除时提示不存在，两种情况都关闭对话框并让列表失效
 * （当前页被删空由列表的页码越界回退处理）；其他错误提示删除失败，对话框保留以便重试
 */
export default function PersonDeleteDialog({
	person,
}: {
	person: PersonDeleteTarget;
}) {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const [open, setOpen] = useState(false);
	const deleteMutation = useMutation(trpc.person.delete.mutationOptions());
	const isDeleting = deleteMutation.isPending;
	const label = `${person.name}（${person.employeeNo}）`;

	const handleConfirm = async () => {
		if (isDeleting) {
			return;
		}
		try {
			await deleteMutation.mutateAsync({ id: person.id });
		} catch (error) {
			const code = getTrpcErrorCode(error);
			toast.error(getPersonDeleteErrorMessage(code));
			if (isPersonNotFound(code)) {
				setOpen(false);
				await queryClient.invalidateQueries(trpc.person.list.pathFilter());
			}
			return;
		}
		setOpen(false);
		toast.success("已删除");
		await queryClient.invalidateQueries(trpc.person.list.pathFilter());
	};

	return (
		<AlertDialog
			onOpenChange={(nextOpen) => {
				// 删除请求进行中不允许关闭（Esc / 取消），避免用户以为已取消
				if (!nextOpen && isDeleting) {
					return;
				}
				setOpen(nextOpen);
			}}
			open={open}
		>
			<AlertDialogTrigger
				render={<Button size="sm" type="button" variant="destructive" />}
			>
				删除
				<span className="sr-only">{label}</span>
			</AlertDialogTrigger>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>删除人员</AlertDialogTitle>
					<AlertDialogDescription>
						{`确定删除人员「${label}」吗？删除后无法恢复。`}
					</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel disabled={isDeleting}>取消</AlertDialogCancel>
					<AlertDialogAction
						className="data-disabled:pointer-events-none data-disabled:opacity-50"
						disabled={isDeleting}
						// 请求中禁用后焦点仍留在按钮上，不会跑出对话框
						focusableWhenDisabled
						onClick={() => {
							handleConfirm();
						}}
						type="button"
						variant="destructive"
					>
						{isDeleting ? "删除中…" : "确定删除"}
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}
