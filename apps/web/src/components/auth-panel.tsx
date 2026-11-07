"use client";

import { useState } from "react";

import SignInForm from "@/components/sign-in-form";
import SignUpForm from "@/components/sign-up-form";

/** 登录 / 注册切换面板（客户端组件，由 /login 页在未登录时渲染） */
export default function AuthPanel() {
	const [showSignIn, setShowSignIn] = useState(true);

	return showSignIn ? (
		<SignInForm onSwitchToSignUp={() => setShowSignIn(false)} />
	) : (
		<SignUpForm onSwitchToSignIn={() => setShowSignIn(true)} />
	);
}
