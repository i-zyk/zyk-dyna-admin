"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { PersonInput } from "@zyk-dyna-admin/api/lib/person-input";
import { Button, buttonVariants } from "@zyk-dyna-admin/ui/components/button";
import {
	Empty,
	EmptyContent,
	EmptyHeader,
	EmptyTitle,
} from "@zyk-dyna-admin/ui/components/empty";
import { Skeleton } from "@zyk-dyna-admin/ui/components/skeleton";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useState } from "react";
import { toast } from "sonner";

import {
	getPersonLoadErrorMessage,
	getPersonSaveError,
	isPersonNotFound,
	PERSON_NOT_FOUND_MESSAGE,
} from "@/lib/person-errors";
import { toPersonFormValues } from "@/lib/person-validation";
import { getTrpcErrorCode } from "@/lib/trpc-errors";
import { useTRPC } from "@/utils/trpc";

import PersonForm, { type PersonFormSubmitResult } from "./person-form";

/** 编辑表单的字段数（姓名、工号、手机号、邮箱、部门、职位、状态；备注单独占一行） */
const SKELETON_FIELD_KEYS = [
	"name",
	"employeeNo",
	"phone",
	"email",
	"department",
	"position",
	"status",
] as const;

/** `getById` 入参不合法（如超长的随意 id）时同样不可能查到人员，按不存在处理 */
const BAD_REQUEST_CODE = "BAD_REQUEST";

/** 加载中：和表单同样布局的骨架屏 */
function PersonFormSkeleton() {
	return (
		<div
			aria-busy="true"
			aria-label="正在加载"
			className="space-y-6"
			role="status"
		>
			<div className="grid gap-4 sm:grid-cols-2">
				{SKELETON_FIELD_KEYS.map((key) => (
					<div className="space-y-2" key={key}>
						<Skeleton className="h-4 w-16" />
						<Skeleton className="h-8 w-full" />
					</div>
				))}
				<div className="space-y-2 sm:col-span-2">
					<Skeleton className="h-4 w-16" />
					<Skeleton className="h-24 w-full" />
				</div>
			</div>
			<div className="flex gap-2">
				<Skeleton className="h-8 w-16" />
				<Skeleton className="h-8 w-16" />
			</div>
		</div>
	);
}

/** 页面内的提示（人员不存在 / 加载失败），附「返回列表」入口 */
function PersonEditNotice({
	children,
	message,
}: {
	children?: ReactNode;
	message: string;
}) {
	return (
		<Empty className="border">
			<EmptyHeader>
				<EmptyTitle role="alert">{message}</EmptyTitle>
			</EmptyHeader>
			<EmptyContent className="flex-row flex-wrap justify-center gap-2">
				{children}
				<Link
					className={buttonVariants({ variant: "outline" })}
					href="/persons"
				>
					返回列表
				</Link>
			</EmptyContent>
		</Empty>
	);
}

/**
 * 编辑人员：`person.getById` 回填表单；人员不存在（打开时或提交时）切换为不存在提示；
 * `person.update` 成功后让列表和该人员的查询失效、提示「已保存」并回到列表
 */
export default function PersonEdit({ id }: { id: string }) {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const router = useRouter();
	// 提交时服务端返回 NOT_FOUND（人员在打开编辑页后被删除）
	const [isDeletedOnSubmit, setIsDeletedOnSubmit] = useState(false);

	const personQuery = useQuery(
		trpc.person.getById.queryOptions(
			{ id },
			{ meta: { skipGlobalErrorToast: true }, retry: false }
		)
	);
	const updateMutation = useMutation(trpc.person.update.mutationOptions());

	const loadErrorCode = personQuery.isError
		? getTrpcErrorCode(personQuery.error)
		: undefined;
	const isNotFound =
		isDeletedOnSubmit ||
		isPersonNotFound(loadErrorCode) ||
		loadErrorCode === BAD_REQUEST_CODE;

	const handleSubmit = async (
		input: PersonInput
	): Promise<PersonFormSubmitResult> => {
		let updated: Awaited<ReturnType<typeof updateMutation.mutateAsync>>;
		try {
			updated = await updateMutation.mutateAsync({ ...input, id });
		} catch (error) {
			const saveError = getPersonSaveError(getTrpcErrorCode(error));
			if (saveError.type === "employeeNoConflict") {
				return { message: saveError.message, status: "employeeNoConflict" };
			}
			if (saveError.type === "notFound") {
				setIsDeletedOnSubmit(true);
				await queryClient.invalidateQueries(trpc.person.list.pathFilter());
				return { status: "failed" };
			}
			toast.error(saveError.message);
			return { status: "failed" };
		}
		// 即将离开编辑页：先取消该人员进行中的查询（避免保存前发出的请求返回后覆盖保存结果），
		// 再直接写入最新数据，并只标记过期、不在当前页重新请求
		await queryClient.cancelQueries(trpc.person.getById.queryFilter({ id }));
		queryClient.setQueryData(trpc.person.getById.queryKey({ id }), updated);
		await Promise.all([
			queryClient.invalidateQueries(trpc.person.list.pathFilter()),
			queryClient.invalidateQueries({
				...trpc.person.getById.queryFilter({ id }),
				refetchType: "none",
			}),
		]);
		toast.success("已保存");
		router.push("/persons");
		return { status: "saved" };
	};

	if (isNotFound) {
		return <PersonEditNotice message={PERSON_NOT_FOUND_MESSAGE} />;
	}

	// 后台重新请求失败但已有数据时，继续显示表单
	if (personQuery.data) {
		return (
			<PersonForm
				defaultValues={toPersonFormValues(personQuery.data)}
				onSubmit={handleSubmit}
			/>
		);
	}

	if (personQuery.isError) {
		return (
			<PersonEditNotice message={getPersonLoadErrorMessage(loadErrorCode)}>
				<Button
					disabled={personQuery.isFetching}
					onClick={() => {
						personQuery.refetch();
					}}
					type="button"
				>
					重试
				</Button>
			</PersonEditNotice>
		);
	}

	return <PersonFormSkeleton />;
}
