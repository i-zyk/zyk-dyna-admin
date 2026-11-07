"use client";
import Link from "next/link";

import { ModeToggle } from "./mode-toggle";
import UserMenu from "./user-menu";

export default function Header() {
	const links = [
		{ label: "Home", to: "/" },
		{ label: "Dashboard", to: "/dashboard" },
	] as const;

	return (
		// min-w-0：不让导航栏的最小内容宽度撑宽根布局的 grid 列，窄屏下由用户菜单按钮截断名字
		<div className="min-w-0">
			<div className="flex flex-row items-center justify-between gap-2 px-2 py-1">
				<nav className="flex gap-4 text-lg">
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
