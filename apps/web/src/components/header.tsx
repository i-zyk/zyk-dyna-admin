"use client";
import Link from "next/link";

import { ModeToggle } from "./mode-toggle";
import UserMenu from "./user-menu";

export default function Header() {
	const links = [
		{ label: "Home", to: "/" },
		{ label: "Dashboard", to: "/dashboard" },
		{ label: "人员管理", to: "/persons" },
	] as const;

	return (
		// min-w-0：不让导航栏的最小内容宽度撑宽根布局的 grid 列，窄屏下由用户菜单按钮截断名字
		<div className="min-w-0">
			<div className="flex flex-row items-center justify-between gap-2 px-2 py-1">
				{/* 链接不换行（否则中文链接在窄屏下会被挤成一字一行），窄屏收紧间距，由右侧用户菜单截断名字让出空间 */}
				<nav className="flex shrink-0 gap-3 whitespace-nowrap text-lg sm:gap-4">
					{links.map(({ to, label }) => (
						<Link href={to} key={to}>
							{label}
						</Link>
					))}
				</nav>
				<div className="flex min-w-0 items-center gap-2">
					<ModeToggle />
					<UserMenu />
				</div>
			</div>
			<hr />
		</div>
	);
}
