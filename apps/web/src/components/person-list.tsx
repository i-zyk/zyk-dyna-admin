"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@zyk-dyna-admin/api/routers/index";
import { Button, buttonVariants } from "@zyk-dyna-admin/ui/components/button";
import {
	Empty,
	EmptyContent,
	EmptyHeader,
	EmptyTitle,
} from "@zyk-dyna-admin/ui/components/empty";
import { Input } from "@zyk-dyna-admin/ui/components/input";
import { Label } from "@zyk-dyna-admin/ui/components/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@zyk-dyna-admin/ui/components/select";
import { Skeleton } from "@zyk-dyna-admin/ui/components/skeleton";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@zyk-dyna-admin/ui/components/table";
import { Plus } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";

import { getPersonLoadErrorMessage } from "@/lib/person-errors";
import {
	displayPersonValue,
	formatPersonDateTime,
	getTotalPages,
} from "@/lib/person-format";
import {
	PERSON_KEYWORD_MAX_LENGTH,
	PERSON_LIST_PAGE_SIZE,
	PERSON_STATUS_LABELS,
	PERSON_STATUS_OPTIONS,
	type PersonStatusValue,
} from "@/lib/person-validation";
import { getTrpcErrorCode } from "@/lib/trpc-errors";
import { useTRPC } from "@/utils/trpc";

import PersonDeleteDialog from "./person-delete-dialog";

export type PersonListItem =
	inferRouterOutputs<AppRouter>["person"]["list"]["items"][number];

/** 状态筛选「全部」的取值（不传 status 给接口） */
const ALL_STATUS = "ALL";

type StatusFilter = typeof ALL_STATUS | PersonStatusValue;

const STATUS_FILTER_OPTIONS: readonly { label: string; value: StatusFilter }[] =
	[{ label: "全部", value: ALL_STATUS }, ...PERSON_STATUS_OPTIONS];

const KEYWORD_INPUT_ID = "person-keyword";
const STATUS_FILTER_ID = "person-status-filter";

const FIRST_PAGE = 1;

/** 加载中骨架屏的行数 */
const SKELETON_ROW_KEYS = ["row-1", "row-2", "row-3", "row-4", "row-5"];

const isStatusFilter = (value: unknown): value is StatusFilter =>
	STATUS_FILTER_OPTIONS.some((option) => option.value === value);

const newPersonLinkClassName = buttonVariants();

/** 「新增人员」入口（页面右上角和空状态共用） */
function NewPersonLink() {
	return (
		<Link className={newPersonLinkClassName} href="/persons/new">
			<Plus aria-hidden="true" />
			新增人员
		</Link>
	);
}

/** 列表区域的提示（空状态 / 无结果 / 加载失败） */
function PersonListNotice({
	children,
	message,
	role,
}: {
	children?: ReactNode;
	message: string;
	role?: "alert";
}) {
	return (
		<Empty className="border">
			<EmptyHeader>
				<EmptyTitle role={role}>{message}</EmptyTitle>
			</EmptyHeader>
			{children ? (
				<EmptyContent className="flex-row flex-wrap justify-center gap-2">
					{children}
				</EmptyContent>
			) : null}
		</Empty>
	);
}

function PersonListSkeleton() {
	return (
		<div
			aria-busy="true"
			aria-label="正在加载"
			className="space-y-2 border p-2"
			role="status"
		>
			{SKELETON_ROW_KEYS.map((key) => (
				<Skeleton className="h-8 w-full" key={key} />
			))}
		</div>
	);
}

function PersonTable({ items }: { items: readonly PersonListItem[] }) {
	return (
		<div className="min-w-0 border">
			<Table>
				<TableHeader>
					<TableRow>
						<TableHead>工号</TableHead>
						<TableHead>姓名</TableHead>
						<TableHead>部门</TableHead>
						<TableHead>职位</TableHead>
						<TableHead>手机号</TableHead>
						<TableHead>状态</TableHead>
						<TableHead>更新时间</TableHead>
						<TableHead>操作</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{items.map((person) => (
						<TableRow data-person-id={person.id} key={person.id}>
							<TableCell>{person.employeeNo}</TableCell>
							<TableCell>{person.name}</TableCell>
							<TableCell>{displayPersonValue(person.department)}</TableCell>
							<TableCell>{displayPersonValue(person.position)}</TableCell>
							<TableCell>{displayPersonValue(person.phone)}</TableCell>
							<TableCell>{PERSON_STATUS_LABELS[person.status]}</TableCell>
							<TableCell>{formatPersonDateTime(person.updatedAt)}</TableCell>
							<TableCell>
								<div className="flex items-center gap-1">
									<Link
										className={buttonVariants({
											size: "sm",
											variant: "outline",
										})}
										href={`/persons/${person.id}/edit`}
									>
										编辑
										<span className="sr-only">
											{`${person.name}（${person.employeeNo}）`}
										</span>
									</Link>
									<PersonDeleteDialog person={person} />
								</div>
							</TableCell>
						</TableRow>
					))}
				</TableBody>
			</Table>
		</div>
	);
}

/**
 * 人员列表：搜索（姓名或工号）、状态筛选、分页表格；
 * 翻页时保留上一页数据，页码越界（如当前页被删空）时自动回退到最后一页
 */
export default function PersonList() {
	const trpc = useTRPC();
	// 输入框里的内容，提交搜索后才写入 keyword
	const [keywordInput, setKeywordInput] = useState("");
	const [keyword, setKeyword] = useState("");
	const [status, setStatus] = useState<StatusFilter>(ALL_STATUS);
	const [page, setPage] = useState(FIRST_PAGE);

	const listQuery = useQuery(
		trpc.person.list.queryOptions(
			{
				keyword: keyword === "" ? undefined : keyword,
				page,
				pageSize: PERSON_LIST_PAGE_SIZE,
				status: status === ALL_STATUS ? undefined : status,
			},
			{
				meta: { skipGlobalErrorToast: true },
				placeholderData: keepPreviousData,
			}
		)
	);

	const { data, isPlaceholderData } = listQuery;
	const total = data?.total ?? 0;
	// 页码文字跟随表格里实际显示的数据（翻页请求返回前仍显示上一页的页码）
	const displayedPage = data?.page ?? page;
	const totalPages = getTotalPages(total, PERSON_LIST_PAGE_SIZE);
	// 页码超出范围（当前页被删空、别人删除了数据）：服务端返回空 items 和真实 total，回退到最后一页
	const isPageOutOfRange =
		!isPlaceholderData &&
		data !== undefined &&
		data.items.length === 0 &&
		data.total > 0 &&
		page > FIRST_PAGE;

	useEffect(() => {
		if (isPageOutOfRange) {
			setPage(totalPages);
		}
	}, [isPageOutOfRange, totalPages]);

	const isFiltered = keyword !== "" || status !== ALL_STATUS;
	// 翻页 / 筛选的新数据还没返回（显示的是上一次的数据）时禁用翻页按钮
	const isChangingPage = isPlaceholderData;

	const errorMessage = listQuery.isError
		? getPersonLoadErrorMessage(getTrpcErrorCode(listQuery.error))
		: "";
	const retryButton = (
		<Button
			disabled={listQuery.isFetching}
			onClick={() => {
				listQuery.refetch();
			}}
			type="button"
		>
			重试
		</Button>
	);
	// 已有（上一次的）数据但最近一次请求失败（如删除后刷新失败）：保留旧数据，同时提示错误并提供重试
	const isStaleWithError =
		listQuery.isError && data !== undefined && !isPageOutOfRange;

	const renderContent = () => {
		if (data && !isPageOutOfRange) {
			if (data.items.length === 0) {
				return isFiltered ? (
					<PersonListNotice message="没有找到匹配的人员" />
				) : (
					<PersonListNotice message="暂无人员">
						<NewPersonLink />
					</PersonListNotice>
				);
			}
			return <PersonTable items={data.items} />;
		}
		if (listQuery.isError) {
			return (
				<PersonListNotice message={errorMessage} role="alert">
					{retryButton}
				</PersonListNotice>
			);
		}
		return <PersonListSkeleton />;
	};

	const hasRows = data !== undefined && data.items.length > 0;

	return (
		<div className="min-w-0 space-y-4">
			<div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
				<div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-end">
					<form
						className="flex min-w-0 flex-col gap-2"
						noValidate
						onSubmit={(e) => {
							e.preventDefault();
							e.stopPropagation();
							setKeyword(keywordInput.trim());
							setPage(FIRST_PAGE);
						}}
					>
						<Label htmlFor={KEYWORD_INPUT_ID}>姓名或工号</Label>
						<div className="flex min-w-0 gap-2">
							<Input
								autoComplete="off"
								className="min-w-0 sm:w-56"
								id={KEYWORD_INPUT_ID}
								maxLength={PERSON_KEYWORD_MAX_LENGTH}
								name="keyword"
								onChange={(e) => setKeywordInput(e.target.value)}
								placeholder="输入姓名或工号的一部分"
								type="search"
								value={keywordInput}
							/>
							<Button type="submit" variant="outline">
								搜索
							</Button>
						</div>
					</form>

					<div className="flex min-w-0 flex-col gap-2">
						<Label htmlFor={STATUS_FILTER_ID}>状态</Label>
						<Select
							items={STATUS_FILTER_OPTIONS}
							name="status"
							onValueChange={(value) => {
								if (isStatusFilter(value)) {
									setStatus(value);
									setPage(FIRST_PAGE);
								}
							}}
							value={status}
						>
							<SelectTrigger className="w-full sm:w-28" id={STATUS_FILTER_ID}>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{STATUS_FILTER_OPTIONS.map(({ label, value }) => (
									<SelectItem key={value} value={value}>
										{label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
				</div>

				<div className="flex">
					<NewPersonLink />
				</div>
			</div>

			{isStaleWithError ? (
				<div className="flex flex-wrap items-center justify-between gap-2 border border-destructive/50 p-2">
					<p className="text-destructive text-xs" role="alert">
						{errorMessage}
					</p>
					{retryButton}
				</div>
			) : null}

			{renderContent()}

			{hasRows && !isPageOutOfRange ? (
				<nav
					aria-label="分页"
					className="flex flex-wrap items-center justify-between gap-2"
				>
					<p aria-live="polite" className="text-muted-foreground text-xs">
						{`第 ${displayedPage} / ${totalPages} 页，共 ${total} 条`}
					</p>
					<div className="flex gap-2">
						<Button
							className="data-disabled:pointer-events-none data-disabled:opacity-50"
							disabled={isChangingPage || page <= FIRST_PAGE}
							focusableWhenDisabled
							onClick={() =>
								setPage((current) => Math.max(FIRST_PAGE, current - 1))
							}
							type="button"
							variant="outline"
						>
							上一页
						</Button>
						<Button
							className="data-disabled:pointer-events-none data-disabled:opacity-50"
							disabled={isChangingPage || page >= totalPages}
							focusableWhenDisabled
							onClick={() =>
								setPage((current) => Math.min(totalPages, current + 1))
							}
							type="button"
							variant="outline"
						>
							下一页
						</Button>
					</div>
				</nav>
			) : null}
		</div>
	);
}
