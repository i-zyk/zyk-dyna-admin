import type { GithubUserProfile } from "@zyk-dyna-admin/api/lib/github";
import {
	Avatar,
	AvatarFallback,
	AvatarImage,
} from "@zyk-dyna-admin/ui/components/avatar";
import {
	Card,
	CardContent,
	CardHeader,
} from "@zyk-dyna-admin/ui/components/card";
import { Skeleton } from "@zyk-dyna-admin/ui/components/skeleton";
import type { LucideIcon } from "lucide-react";
import { Building2, CalendarDays, Link2, MapPin } from "lucide-react";
import type { ReactNode } from "react";

import {
	formatJoinedDate,
	normalizeBlogUrl,
} from "@/lib/github-profile-format";

/** 外链统一在新标签页打开，并切断 opener / referrer */
const EXTERNAL_LINK_PROPS = {
	rel: "noopener noreferrer",
	target: "_blank",
} as const;

const AVATAR_CLASS_NAME = "size-16";

/**
 * 卡片里的一行资料（图标 + 内容）。长文本用 `wrap-anywhere`（overflow-wrap: anywhere）：
 * 和 `break-words` 不同，它会降低元素的 min-content 宽度，
 * 父级是 grid / flex 自动列时，超长无空格文本（如长博客地址）也不会把页面撑出横向滚动。
 */
function ProfileDetail({
	children,
	icon: Icon,
	label,
}: {
	children: ReactNode;
	icon: LucideIcon;
	label: string;
}) {
	return (
		<li className="flex min-w-0 items-start gap-2">
			<Icon
				aria-hidden="true"
				className="mt-0.5 size-3.5 shrink-0 text-muted-foreground"
			/>
			<span className="sr-only">{label}：</span>
			<span className="wrap-anywhere min-w-0">{children}</span>
		</li>
	);
}

/** 博客 / 网站：地址可用时渲染成外链，否则只显示原文 */
function BlogDetail({ blog }: { blog: string }) {
	const href = normalizeBlogUrl(blog);
	return (
		<ProfileDetail icon={Link2} label="博客 / 网站">
			{href ? (
				<a
					className="underline-offset-4 hover:underline"
					href={href}
					{...EXTERNAL_LINK_PROPS}
				>
					{blog}
				</a>
			) : (
				blog
			)}
		</ProfileDetail>
	);
}

/** 仓库数、粉丝数、关注数 */
function ProfileStats({ profile }: { profile: GithubUserProfile }) {
	const stats = [
		{ label: "公开仓库", value: profile.publicRepos },
		{ label: "粉丝", value: profile.followers },
		{ label: "关注", value: profile.following },
	] as const;

	return (
		<dl className="grid grid-cols-3 gap-2 text-center">
			{stats.map((stat) => (
				<div className="min-w-0 bg-muted/50 px-2 py-2" key={stat.label}>
					<dt className="text-muted-foreground">{stat.label}</dt>
					<dd className="wrap-anywhere font-medium text-sm tabular-nums">
						{stat.value}
					</dd>
				</div>
			))}
		</dl>
	);
}

/** GitHub 用户资料卡片：空字段整行不渲染，昵称为空时显示用户名 */
export function GithubUserCard({ profile }: { profile: GithubUserProfile }) {
	const displayName = profile.name ?? profile.login;
	const joinedDate = formatJoinedDate(profile.createdAt);

	return (
		<Card aria-label={`${profile.login} 的 GitHub 资料`} role="region">
			<CardHeader className="flex min-w-0 items-center gap-3">
				<Avatar className={AVATAR_CLASS_NAME} size="lg">
					<AvatarImage
						alt={`${profile.login} 的头像`}
						src={profile.avatarUrl}
					/>
					<AvatarFallback className="text-lg uppercase">
						{profile.login.charAt(0)}
					</AvatarFallback>
				</Avatar>
				<div className="min-w-0 flex-1">
					<h3 className="wrap-anywhere font-medium text-base">{displayName}</h3>
					<a
						className="wrap-anywhere text-muted-foreground underline-offset-4 hover:underline"
						href={profile.htmlUrl}
						{...EXTERNAL_LINK_PROPS}
					>
						@{profile.login}
					</a>
				</div>
			</CardHeader>

			<CardContent className="min-w-0 space-y-3">
				{profile.bio ? (
					<p className="wrap-anywhere whitespace-pre-line text-sm">
						{profile.bio}
					</p>
				) : null}

				<ul className="space-y-1.5">
					{profile.company ? (
						<ProfileDetail icon={Building2} label="公司">
							{profile.company}
						</ProfileDetail>
					) : null}
					{profile.location ? (
						<ProfileDetail icon={MapPin} label="所在地">
							{profile.location}
						</ProfileDetail>
					) : null}
					{profile.blog ? <BlogDetail blog={profile.blog} /> : null}
					{joinedDate ? (
						<ProfileDetail icon={CalendarDays} label="注册时间">
							注册于 <time dateTime={joinedDate}>{joinedDate}</time>
						</ProfileDetail>
					) : null}
				</ul>

				<ProfileStats profile={profile} />
			</CardContent>
		</Card>
	);
}

/** 查询中的卡片骨架屏，布局与 GithubUserCard 一致 */
export function GithubUserCardSkeleton() {
	return (
		<Card aria-busy="true" aria-label="正在查询" role="status">
			<CardHeader className="flex items-center gap-3">
				<Skeleton className={`${AVATAR_CLASS_NAME} shrink-0 rounded-full`} />
				<div className="min-w-0 flex-1 space-y-2">
					<Skeleton className="h-4 w-1/2" />
					<Skeleton className="h-3 w-1/3" />
				</div>
			</CardHeader>
			<CardContent className="space-y-3">
				<Skeleton className="h-3 w-full" />
				<Skeleton className="h-3 w-2/3" />
				<div className="grid grid-cols-3 gap-2">
					<Skeleton className="h-10" />
					<Skeleton className="h-10" />
					<Skeleton className="h-10" />
				</div>
			</CardContent>
		</Card>
	);
}
