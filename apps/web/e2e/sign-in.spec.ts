import { expect, type Page, test } from "@playwright/test";

import { resetTestDatabase } from "./support/database";
import { SERVER_URL, WEB_URL } from "./support/urls";

const SIGN_UP_PATH = "/api/auth/sign-up/email";
const SIGN_IN_PATHS: ReadonlySet<string> = new Set([
	"/api/auth/sign-in/email",
	"/api/auth/sign-in/username",
]);
const PASSWORD = "E2e-Sign-In-Secret-4q9z";
const USERNAME = "Tom";
const EMAIL = "tom@example.com";
const INVALID_CREDENTIALS_MESSAGE = "账号或密码错误";
const DASHBOARD_URL = /\/dashboard$/;
const LOGIN_URL = /\/login$/;

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

/** 记录页面发出的登录请求（邮箱或用户名登录），用来断言空字段时没有请求发出 */
function trackSignInRequests(page: Page): string[] {
	const requests: string[] = [];
	page.on("request", (request) => {
		const isSignIn =
			request.method() === "POST" &&
			SIGN_IN_PATHS.has(new URL(request.url()).pathname);
		if (isSignIn) {
			requests.push(request.url());
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
	{ identifier: "TOM", title: "用户名大小写不同" },
	{ identifier: "TOM@EXAMPLE.COM", title: "邮箱大小写不同" },
] as const;

for (const { identifier, title } of successCases) {
	test(`${title}（${identifier}）+ 正确密码登录成功并进入 /dashboard`, async ({
		page,
	}) => {
		await signIn(page, identifier, PASSWORD);

		await expect(page).toHaveURL(DASHBOARD_URL);
		await expect(page.getByText(`Welcome ${USERNAME}`)).toBeVisible();
	});
}

const failureCases = [
	{ identifier: USERNAME, password: `${PASSWORD}x`, title: "密码错误" },
	{ identifier: "nobody", password: PASSWORD, title: "用户名不存在" },
	{
		identifier: "nobody@example.com",
		password: PASSWORD,
		title: "邮箱不存在",
	},
	{ identifier: "ab", password: PASSWORD, title: "用户名不足 3 位（ab）" },
] as const;

for (const { identifier, password, title } of failureCases) {
	test(`${title}时统一提示「${INVALID_CREDENTIALS_MESSAGE}」`, async ({
		page,
	}) => {
		const requests = trackSignInRequests(page);
		await signIn(page, identifier, password);

		const submitError = page.locator("#sign-in-error");
		await expect(submitError).toHaveText(INVALID_CREDENTIALS_MESSAGE);
		await expect(submitError).toHaveAttribute("role", "alert");
		expect(requests).toHaveLength(1);
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
