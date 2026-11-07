"use client";

import { Button, buttonVariants } from "@zyk-dyna-admin/ui/components/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@zyk-dyna-admin/ui/components/dropdown-menu";
import { Skeleton } from "@zyk-dyna-admin/ui/components/skeleton";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { authClient } from "@/lib/auth-client";

const SIGN_OUT_FAILED_MESSAGE = "退出登录失败，请稍后再试";

interface MenuUser {
	displayUsername?: string | null;
	name: string;
	username?: string | null;
}

/** 用户菜单显示的名字：优先 displayUsername，为空时回退到 username，再回退到 name */
function getDisplayName({ displayUsername, username, name }: MenuUser) {
	return displayUsername || username || name;
}

export default function UserMenu() {
	const router = useRouter();
	const { data: session, isPending } = authClient.useSession();

	if (isPending) {
		return <Skeleton className="h-8 w-24" />;
	}

	if (!session) {
		return (
			<Link className={buttonVariants({ variant: "outline" })} href="/login">
				登录
			</Link>
		);
	}

	const displayName = getDisplayName(session.user);

	const handleSignOut = async () => {
		try {
			const { error } = await authClient.signOut();
			if (error) {
				toast.error(SIGN_OUT_FAILED_MESSAGE);
				return;
			}
		} catch {
			toast.error(SIGN_OUT_FAILED_MESSAGE);
			return;
		}
		router.push("/login");
		// 清掉 App Router 缓存的已登录页面，后退或再次访问时由服务端重新校验登录态
		router.refresh();
	};

	return (
		<DropdownMenu>
			<DropdownMenuTrigger
				aria-label={`用户菜单：${displayName}`}
				render={
					<Button className="min-w-0 max-w-40 shrink" variant="outline" />
				}
			>
				<span className="truncate">{displayName}</span>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="max-w-64 bg-card">
				<DropdownMenuGroup>
					<DropdownMenuLabel>
						<span className="block truncate font-medium text-foreground">
							{displayName}
						</span>
						<span className="block truncate">{session.user.email}</span>
					</DropdownMenuLabel>
				</DropdownMenuGroup>
				<DropdownMenuSeparator />
				<DropdownMenuItem onClick={handleSignOut} variant="destructive">
					退出登录
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
