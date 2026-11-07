import { expect, type Page, test } from "@playwright/test";

import { resetTestDatabase } from "./support/database";
import {
	getScrollWidth,
	NARROW_VIEWPORT,
	pressUntilFocused,
	tabUntilFocused,
} from "./support/page-helpers";
import { SERVER_URL, WEB_URL } from "./support/urls";

const SIGN_UP_PATH = "/api/auth/sign-up/email";
const SIGN_IN_EMAIL_PATH = "/api/auth/sign-in/email";
const SIGN_IN_USERNAME_PATH = "/api/auth/sign-in/username";
const SIGN_IN_PATHS: ReadonlySet<string> = new Set([
	SIGN_IN_EMAIL_PATH,
	SIGN_IN_USERNAME_PATH,
]);
const PASSWORD = "E2e-Sign-In-Secret-4q9z";
const USERNAME = "Tom";
const EMAIL = "tom@example.com";
const INVALID_CREDENTIALS_MESSAGE = "账号或密码错误";
const DASHBOARD_URL = /\/dashboard$/;
const LOGIN_URL = /\/login$/;
/** sonner 提示默认 4 秒后关闭，留出余量 */
const TOAST_CLOSE_TIMEOUT_MS = 10_000;

function getSignInForm(page: Page) {
	return {
		heading: page.getByRole("heading", { name: "登录" }),
		identifier: page.getByLabel("用户名或邮箱", { exact: true }),
		password: page.getByLabel("密码", { exact: true }),
		submit: page.getByRole("button", { exact: true, name: "登录" }),
	};
}

async function openSignIn(page: Page) {
	await page.goto("/login");
	const form = getSignInForm(page);
	await expect(form.heading).toBeVisible();
	return form;
}

async function signIn(
	page: Page,
	identifier: string,
	password: string
): Promise<void> {
	const form = await openSignIn(page);
	await form.identifier.fill(identifier);
	await form.password.fill(password);
	await form.submit.click();
}

/**
 * 记录页面发出的登录请求（邮箱或用户名登录）的路径，
 * 用来断言调用了哪个登录接口，以及空字段时没有请求发出
 */
function trackSignInRequests(page: Page): string[] {
	const requests: string[] = [];
	page.on("request", (request) => {
		const { pathname } = new URL(request.url());
		if (request.method() === "POST" && SIGN_IN_PATHS.has(pathname)) {
			requests.push(pathname);
		}
	});
	return requests;
}

test.beforeEach(async ({ request }) => {
	await resetTestDatabase();
	// 绕过页面直接调用注册接口，准备用户 Tom / tom@example.com
	const response = await request.post(`${SERVER_URL}${SIGN_UP_PATH}`, {
		data: {
			email: EMAIL,
			name: USERNAME,
			password: PASSWORD,
			username: USERNAME,
		},
		headers: { origin: WEB_URL },
	});
	expect(response.ok()).toBe(true);
});

const successCases = [
	{
		expectedPath: SIGN_IN_USERNAME_PATH,
		identifier: "TOM",
		title: "用户名大小写不同",
	},
	{
		expectedPath: SIGN_IN_EMAIL_PATH,
		identifier: "TOM@EXAMPLE.COM",
		title: "邮箱大小写不同",
	},
] as const;

for (const { expectedPath, identifier, title } of successCases) {
	test(`${title}（${identifier}）+ 正确密码登录成功并进入 /dashboard`, async ({
		page,
	}) => {
		const requests = trackSignInRequests(page);
		await signIn(page, identifier, PASSWORD);

		await expect(page).toHaveURL(DASHBOARD_URL);
		await expect(page.getByText(`Welcome ${USERNAME}`)).toBeVisible();
		// 包含 @ 按邮箱登录，否则按用户名登录
		expect(requests).toEqual([expectedPath]);
	});
}

const failureCases = [
	{
		expectedPath: SIGN_IN_USERNAME_PATH,
		identifier: USERNAME,
		password: `${PASSWORD}x`,
		title: "密码错误",
	},
	{
		expectedPath: SIGN_IN_USERNAME_PATH,
		identifier: "nobody",
		password: PASSWORD,
		title: "用户名不存在",
	},
	{
		expectedPath: SIGN_IN_EMAIL_PATH,
		identifier: "nobody@example.com",
		password: PASSWORD,
		title: "邮箱不存在",
	},
	{
		expectedPath: SIGN_IN_USERNAME_PATH,
		identifier: "ab",
		password: PASSWORD,
		title: "用户名不足 3 位（ab）",
	},
] as const;

for (const { expectedPath, identifier, password, title } of failureCases) {
	test(`${title}时统一提示「${INVALID_CREDENTIALS_MESSAGE}」`, async ({
		page,
	}) => {
		const requests = trackSignInRequests(page);
		await signIn(page, identifier, password);

		const submitError = page.locator("#sign-in-error");
		await expect(submitError).toHaveText(INVALID_CREDENTIALS_MESSAGE);
		await expect(submitError).toHaveAttribute("role", "alert");
		expect(requests).toEqual([expectedPath]);
		await expect(page).toHaveURL(LOGIN_URL);

		// 修改任一输入框后清除提示（填入与当前不同的值，确保触发输入变化）
		await getSignInForm(page).password.fill(`${password}-changed`);
		await expect(submitError).toHaveCount(0);
	});
}

test("字段为空时提示原因且无法提交", async ({ page }) => {
	const requests = trackSignInRequests(page);
	const form = await openSignIn(page);

	// 两个字段都为空时提交
	await form.submit.click();
	await expect(page.locator("#identifier-error")).toHaveText(
		"请输入用户名或邮箱"
	);
	await expect(page.locator("#password-error")).toHaveText("请输入密码");
	await expect(form.identifier).toHaveAttribute("aria-invalid", "true");
	await expect(form.password).toHaveAttribute("aria-invalid", "true");
	await expect(form.submit).toBeDisabled();

	// 只填密码、用户名或邮箱只有空格时仍无法提交
	await form.identifier.fill("   ");
	await form.password.fill(PASSWORD);
	await expect(page.locator("#identifier-error")).toHaveText(
		"请输入用户名或邮箱"
	);
	await expect(page.locator("#password-error")).toHaveCount(0);
	await expect(form.submit).toBeDisabled();
	await form.password.press("Enter");

	// 只填用户名、密码为空时仍无法提交
	await form.identifier.fill(USERNAME);
	await form.password.fill("");
	await expect(page.locator("#password-error")).toHaveText("请输入密码");
	await expect(form.submit).toBeDisabled();
	await form.password.press("Enter");

	await expect(page).toHaveURL(LOGIN_URL);
	expect(requests).toHaveLength(0);

	// 补全后正常提交：只应有这一次登录请求，证明之前没有发出过请求
	await form.password.fill(PASSWORD);
	await form.submit.click();
	await expect(page).toHaveURL(DASHBOARD_URL);
	expect(requests).toHaveLength(1);
});

test("登录请求进行中时按钮显示加载并禁用，不能重复提交", async ({ page }) => {
	const requests = trackSignInRequests(page);
	// 先挂起登录请求，等断言完加载状态再放行
	let releaseSignIn: () => void = () => undefined;
	const signInReleased = new Promise<void>((resolve) => {
		releaseSignIn = resolve;
	});
	await page.route(`${SERVER_URL}${SIGN_IN_USERNAME_PATH}`, async (route) => {
		await signInReleased;
		await route.continue();
	});

	const form = await openSignIn(page);
	await form.identifier.fill(USERNAME);
	await form.password.fill(PASSWORD);
	await form.submit.click();

	const busyButton = page.getByRole("button", { name: "登录中…" });
	await expect(busyButton).toBeDisabled();
	await expect(busyButton).toHaveAttribute("aria-busy", "true");
	await expect.poll(() => requests.length).toBe(1);

	// 加载中再次点击和回车都不应发出第二次请求
	await busyButton.click({ force: true });
	await form.password.press("Enter");
	expect(requests).toHaveLength(1);

	releaseSignIn();
	await expect(page).toHaveURL(DASHBOARD_URL);
	expect(requests).toHaveLength(1);
});

/** 通过登录表单用用户名登录并等待进入 /dashboard */
async function signInAsTom(page: Page): Promise<void> {
	await signIn(page, USERNAME, PASSWORD);
	await expect(page).toHaveURL(DASHBOARD_URL);
}

function getUserMenuTrigger(page: Page) {
	return page.getByRole("button", { name: `用户菜单：${USERNAME}` });
}

test("已登录访问 /login 被重定向到 /dashboard", async ({ page }) => {
	await signInAsTom(page);

	await page.goto("/login");
	await expect(page).toHaveURL(DASHBOARD_URL);
	await expect(page.getByText(`Welcome ${USERNAME}`)).toBeVisible();
});

test("用户菜单显示用户名和邮箱，退出登录后回到 /login 且无法再访问 /dashboard", async ({
	page,
}) => {
	await signInAsTom(page);

	const trigger = getUserMenuTrigger(page);
	await expect(trigger).toHaveText(USERNAME);
	await trigger.click();

	const menu = page.getByRole("menu");
	await expect(menu).toBeVisible();
	await expect(menu.getByText(USERNAME, { exact: true })).toBeVisible();
	await expect(menu.getByText(EMAIL, { exact: true })).toBeVisible();

	await menu.getByRole("menuitem", { name: "退出登录" }).click();
	await expect(page).toHaveURL(LOGIN_URL);
	await expect(getSignInForm(page).heading).toBeVisible();
	await expect(
		page.getByRole("link", { exact: true, name: "登录" })
	).toBeVisible();

	// 退出后再次访问 /dashboard，由服务端校验登录态并重定向到 /login
	await page.goto("/dashboard");
	await expect(page).toHaveURL(LOGIN_URL);
	await expect(getSignInForm(page).heading).toBeVisible();
});

test("未登录直接访问 /dashboard 被重定向到 /login", async ({ page }) => {
	await page.goto("/dashboard");

	await expect(page).toHaveURL(LOGIN_URL);
	await expect(getSignInForm(page).heading).toBeVisible();
});

test("只用键盘（Tab / Enter）完成登录，并通过键盘打开用户菜单退出登录", async ({
	page,
}) => {
	const form = await openSignIn(page);

	await tabUntilFocused(page, form.identifier);
	await page.keyboard.type(USERNAME);
	await page.keyboard.press("Tab");
	await expect(form.password).toBeFocused();
	await page.keyboard.type(PASSWORD);
	await page.keyboard.press("Enter");
	await expect(page).toHaveURL(DASHBOARD_URL);
	await expect(page.getByText(`Welcome ${USERNAME}`)).toBeVisible();

	// 等「登录成功」提示关闭再按 Tab：提示可获得焦点，开发模式下 sonner 失焦时会把焦点还给
	// 页面底部的 React Query Devtools 按钮，提示还在时 Tab 会在两者之间循环，到不了顶部导航
	await expect(page.getByText("登录成功")).toBeHidden({
		timeout: TOAST_CLOSE_TIMEOUT_MS,
	});

	// 用 Tab 移到用户菜单按钮，Enter 打开菜单
	const trigger = getUserMenuTrigger(page);
	await tabUntilFocused(page, trigger);
	await page.keyboard.press("Enter");
	const menu = page.getByRole("menu");
	await expect(menu).toBeVisible();
	await expect(menu.getByText(EMAIL, { exact: true })).toBeVisible();

	// 用方向键把焦点移到「退出登录」，Enter 选中
	const signOutItem = menu.getByRole("menuitem", { name: "退出登录" });
	await pressUntilFocused(page, signOutItem, "ArrowDown");
	await expect(signOutItem).toBeFocused();
	await page.keyboard.press("Enter");

	await expect(page).toHaveURL(LOGIN_URL);
	await expect(getSignInForm(page).heading).toBeVisible();
	await page.goto("/dashboard");
	await expect(page).toHaveURL(LOGIN_URL);
});

for (const colorScheme of ["light", "dark"] as const) {
	test(`375px 宽、${colorScheme} 主题下 /login 登录表单没有横向滚动`, async ({
		page,
	}) => {
		await page.setViewportSize(NARROW_VIEWPORT);
		await page.emulateMedia({ colorScheme });

		const form = await openSignIn(page);
		await expect(page.locator("html")).toHaveClass(new RegExp(colorScheme));
		expect(await getScrollWidth(page)).toBeLessThanOrEqual(
			NARROW_VIEWPORT.width
		);

		// 字段错误显示出来后再检查一次
		await form.submit.click();
		await expect(page.locator("#identifier-error")).toBeVisible();
		await expect(page.locator("#password-error")).toBeVisible();
		expect(await getScrollWidth(page)).toBeLessThanOrEqual(
			NARROW_VIEWPORT.width
		);

		// 登录失败提示显示出来后再检查一次
		await form.identifier.fill("nobody");
		await form.password.fill(PASSWORD);
		await form.submit.click();
		await expect(page.locator("#sign-in-error")).toHaveText(
			INVALID_CREDENTIALS_MESSAGE
		);
		expect(await getScrollWidth(page)).toBeLessThanOrEqual(
			NARROW_VIEWPORT.width
		);
	});
}

/** 用来检查窄屏下顶部导航截断名字的超长用户名（30 位） */
const LONG_USERNAME = "Abcdefghij_Klmnopqrst_Uvwxyz12";
const LONG_EMAIL = "abcdefghij.klmnopqrst.uvwxyz12@example.com";

for (const colorScheme of ["light", "dark"] as const) {
	test(`375px 宽、${colorScheme} 主题下已登录的顶部导航与用户菜单没有横向滚动`, async ({
		page,
		request,
	}) => {
		const response = await request.post(`${SERVER_URL}${SIGN_UP_PATH}`, {
			data: {
				email: LONG_EMAIL,
				name: LONG_USERNAME,
				password: PASSWORD,
				username: LONG_USERNAME,
			},
			headers: { origin: WEB_URL },
		});
		expect(response.ok()).toBe(true);

		await page.setViewportSize(NARROW_VIEWPORT);
		await page.emulateMedia({ colorScheme });
		await signIn(page, LONG_USERNAME, PASSWORD);
		await expect(page).toHaveURL(DASHBOARD_URL);
		await expect(page.locator("html")).toHaveClass(new RegExp(colorScheme));

		const trigger = page.getByRole("button", {
			name: `用户菜单：${LONG_USERNAME}`,
		});
		await expect(trigger).toBeVisible();
		expect(await getScrollWidth(page)).toBeLessThanOrEqual(
			NARROW_VIEWPORT.width
		);

		// 展开用户菜单后再检查一次
		await trigger.click();
		const menu = page.getByRole("menu");
		await expect(menu).toBeVisible();
		await expect(menu.getByText(LONG_EMAIL, { exact: true })).toBeVisible();
		await expect(
			menu.getByRole("menuitem", { name: "退出登录" })
		).toBeVisible();
		expect(await getScrollWidth(page)).toBeLessThanOrEqual(
			NARROW_VIEWPORT.width
		);
	});
}
