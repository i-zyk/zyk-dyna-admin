import { readFile } from "node:fs/promises";

import {
	type APIRequestContext,
	expect,
	type Locator,
	type Page,
	test,
} from "@playwright/test";

import { resetTestDatabase, withTestDatabase } from "./support/database";
import { SERVER_LOG_FILE } from "./support/paths";
import { SERVER_URL, WEB_URL } from "./support/urls";

const SIGN_UP_PATH = "/api/auth/sign-up/email";
/** 所有用例共用的明文密码，最后检查 server 日志里不出现它 */
const PASSWORD = "E2e-Plain-Secret-7f3k";
const NARROW_VIEWPORT = { height: 812, width: 375 };
const MAX_TAB_PRESSES = 40;
const DASHBOARD_URL = /\/dashboard$/;
const LOGIN_URL = /\/login$/;

type SignUpField = "confirmPassword" | "email" | "password" | "username";
type SignUpValues = Record<SignUpField, string>;

function validValues(overrides: Partial<SignUpValues> = {}): SignUpValues {
	return {
		confirmPassword: PASSWORD,
		email: "tom@example.com",
		password: PASSWORD,
		username: "tom",
		...overrides,
	};
}

function getSignUpForm(page: Page) {
	return {
		confirmPassword: page.getByLabel("确认密码", { exact: true }),
		email: page.getByLabel("邮箱", { exact: true }),
		heading: page.getByRole("heading", { name: "创建账号" }),
		password: page.getByLabel("密码", { exact: true }),
		submit: page.getByRole("button", { exact: true, name: "注册" }),
		username: page.getByLabel("用户名", { exact: true }),
	};
}

function getFieldError(page: Page, field: SignUpField): Locator {
	return page.locator(`#${field}-error`);
}

async function openSignUp(page: Page) {
	await page.goto("/login");
	await page.getByRole("button", { name: "还没有账号？去注册" }).click();
	const form = getSignUpForm(page);
	await expect(form.heading).toBeVisible();
	return form;
}

async function fillSignUp(page: Page, values: SignUpValues): Promise<void> {
	const form = getSignUpForm(page);
	await form.username.fill(values.username);
	await form.email.fill(values.email);
	await form.password.fill(values.password);
	await form.confirmPassword.fill(values.confirmPassword);
}

/** 记录页面发出的注册请求，用来断言非法输入时没有请求发出 */
function trackSignUpRequests(page: Page): string[] {
	const requests: string[] = [];
	page.on("request", (request) => {
		const isSignUp =
			request.method() === "POST" &&
			new URL(request.url()).pathname === SIGN_UP_PATH;
		if (isSignUp) {
			requests.push(request.url());
		}
	});
	return requests;
}

/** 绕过页面直接调用注册接口，准备已存在的用户 */
async function signUpViaApi(
	request: APIRequestContext,
	values: Pick<SignUpValues, "email" | "username">
): Promise<void> {
	const response = await request.post(`${SERVER_URL}${SIGN_UP_PATH}`, {
		data: { ...values, name: values.username, password: PASSWORD },
		headers: { origin: WEB_URL },
	});
	expect(response.ok()).toBe(true);
}

/** 不断按 Tab，直到焦点落到目标元素上 */
async function tabUntilFocused(page: Page, target: Locator): Promise<void> {
	for (let presses = 0; presses < MAX_TAB_PRESSES; presses += 1) {
		// biome-ignore lint/performance/noAwaitInLoops: 每次按键都依赖上一次按键后的焦点位置，必须按顺序执行
		const isFocused = await target.evaluate(
			(element) => element === document.activeElement
		);
		if (isFocused) {
			return;
		}
		await page.keyboard.press("Tab");
	}
	await expect(target).toBeFocused();
}

async function getScrollWidth(page: Page): Promise<number> {
	return await page.evaluate(() => document.documentElement.scrollWidth);
}

test.beforeEach(async () => {
	await resetTestDatabase();
});

const invalidCases: {
	field: SignUpField;
	message: string;
	overrides: Partial<SignUpValues>;
	title: string;
}[] = [
	{
		field: "username",
		message: "用户名只能包含字母、数字、下划线和点",
		overrides: { username: "a b" },
		title: "用户名不合法",
	},
	{
		field: "email",
		message: "邮箱格式不正确",
		overrides: { email: "a@b" },
		title: "邮箱不合法",
	},
	{
		field: "confirmPassword",
		message: "两次输入的密码不一致",
		overrides: { confirmPassword: `${PASSWORD}x` },
		title: "两次密码不一致",
	},
];

for (const { field, message, overrides, title } of invalidCases) {
	test(`${title}时显示原因，提交按钮禁用且不发注册请求`, async ({ page }) => {
		const requests = trackSignUpRequests(page);
		const form = await openSignUp(page);
		await fillSignUp(page, validValues(overrides));

		await expect(getFieldError(page, field)).toHaveText(message);
		await expect(form[field]).toHaveAttribute("aria-invalid", "true");
		await expect(form.submit).toBeDisabled();

		// 绕过禁用的按钮直接触发表单提交，表单校验仍应拦住请求
		await page.locator("form").evaluate((element) => {
			if (element instanceof HTMLFormElement) {
				element.requestSubmit();
			}
		});
		await expect(getFieldError(page, field)).toHaveText(message);

		// 改正后正常提交：此时只应有这一次注册请求，证明之前没有发出过请求
		await form[field].fill(validValues()[field]);
		await expect(getFieldError(page, field)).toHaveCount(0);
		await form.submit.click();
		await expect(page).toHaveURL(DASHBOARD_URL);
		expect(requests).toHaveLength(1);
	});
}

test("用户名只是大小写不同也提示「用户名已存在」", async ({
	page,
	request,
}) => {
	await signUpViaApi(request, { email: "tom@example.com", username: "tom" });

	const form = await openSignUp(page);
	await fillSignUp(
		page,
		validValues({ email: "another-tom@example.com", username: "Tom" })
	);
	await form.submit.click();

	await expect(getFieldError(page, "username")).toHaveText("用户名已存在");
	await expect(form.username).toHaveAttribute("aria-invalid", "true");
	await expect(page).toHaveURL(LOGIN_URL);
});

test("邮箱只是大小写不同也提示「邮箱已被注册」", async ({ page, request }) => {
	await signUpViaApi(request, {
		email: "alice@example.com",
		username: "alice",
	});

	const form = await openSignUp(page);
	await fillSignUp(
		page,
		validValues({ email: "ALICE@EXAMPLE.COM", username: "bob" })
	);
	await form.submit.click();

	await expect(getFieldError(page, "email")).toHaveText("邮箱已被注册");
	await expect(form.email).toHaveAttribute("aria-invalid", "true");
	await expect(page).toHaveURL(LOGIN_URL);
});

test("注册成功后进入 /dashboard，刷新后仍保持登录", async ({ page }) => {
	const form = await openSignUp(page);
	await fillSignUp(page, validValues());
	await form.submit.click();

	await expect(page).toHaveURL(DASHBOARD_URL);
	await expect(page.getByText("Welcome tom")).toBeVisible();

	await page.reload();
	await expect(page).toHaveURL(DASHBOARD_URL);
	await expect(page.getByText("Welcome tom")).toBeVisible();
});

test("注册请求进行中时按钮显示加载并禁用，不能重复提交", async ({ page }) => {
	const requests = trackSignUpRequests(page);
	// 先挂起注册请求，等断言完加载状态再放行
	let releaseSignUp: () => void = () => undefined;
	const signUpReleased = new Promise<void>((resolve) => {
		releaseSignUp = resolve;
	});
	await page.route(`${SERVER_URL}${SIGN_UP_PATH}`, async (route) => {
		await signUpReleased;
		await route.continue();
	});

	const form = await openSignUp(page);
	await fillSignUp(page, validValues());
	await form.submit.click();

	const busyButton = page.getByRole("button", { name: "注册中…" });
	await expect(busyButton).toBeDisabled();
	await expect(busyButton).toHaveAttribute("aria-busy", "true");
	await expect.poll(() => requests.length).toBe(1);

	// 加载中再次点击和回车都不应发出第二次请求
	await busyButton.click({ force: true });
	await form.confirmPassword.press("Enter");
	expect(requests).toHaveLength(1);

	releaseSignUp();
	await expect(page).toHaveURL(DASHBOARD_URL);
	expect(requests).toHaveLength(1);
});

test("只用键盘（Tab / Enter）完成注册", async ({ page }) => {
	await page.goto("/login");
	const switchToSignUp = page.getByRole("button", {
		name: "还没有账号？去注册",
	});
	await expect(switchToSignUp).toBeVisible();
	await tabUntilFocused(page, switchToSignUp);
	await page.keyboard.press("Enter");

	const form = getSignUpForm(page);
	await expect(form.heading).toBeVisible();
	const values = validValues();

	await tabUntilFocused(page, form.username);
	await page.keyboard.type(values.username);
	await page.keyboard.press("Tab");
	await expect(form.email).toBeFocused();
	await page.keyboard.type(values.email);
	await page.keyboard.press("Tab");
	await expect(form.password).toBeFocused();
	await page.keyboard.type(values.password);
	await page.keyboard.press("Tab");
	await expect(form.confirmPassword).toBeFocused();
	await page.keyboard.type(values.confirmPassword);
	await page.keyboard.press("Enter");

	await expect(page).toHaveURL(DASHBOARD_URL);
});

for (const colorScheme of ["light", "dark"] as const) {
	test(`375px 宽、${colorScheme} 主题下 /login 没有横向滚动`, async ({
		page,
	}) => {
		await page.setViewportSize(NARROW_VIEWPORT);
		await page.emulateMedia({ colorScheme });

		await page.goto("/login");
		await expect(page.locator("html")).toHaveClass(new RegExp(colorScheme));
		expect(await getScrollWidth(page)).toBeLessThanOrEqual(
			NARROW_VIEWPORT.width
		);

		const form = await openSignUp(page);
		// 让最长的错误提示也显示出来，再检查宽度
		await fillSignUp(
			page,
			validValues({ confirmPassword: "x", username: "a b" })
		);
		await expect(getFieldError(page, "username")).toBeVisible();
		await expect(getFieldError(page, "confirmPassword")).toBeVisible();
		await expect(form.submit).toBeVisible();
		expect(await getScrollWidth(page)).toBeLessThanOrEqual(
			NARROW_VIEWPORT.width
		);
	});
}

test("注册后数据库按约定存储，密码只以哈希保存且不出现在 server 日志中", async ({
	page,
}) => {
	const email = "tom.lee@example.com";
	const form = await openSignUp(page);
	await fillSignUp(page, validValues({ email, username: "Tom.Lee" }));
	await form.submit.click();
	await expect(page).toHaveURL(DASHBOARD_URL);

	const rows = await withTestDatabase(async (client) => {
		const result = await client.query<{
			displayUsername: string | null;
			name: string;
			password: string | null;
			username: string | null;
		}>(
			`SELECT u.username, u."displayUsername", u.name, a.password
			FROM "user" u
			JOIN account a ON a."userId" = u.id AND a."providerId" = 'credential'
			WHERE u.email = $1`,
			[email]
		);
		return result.rows;
	});
	expect(rows).toHaveLength(1);
	const [row] = rows;
	expect(row).toMatchObject({
		displayUsername: "Tom.Lee",
		name: "Tom.Lee",
		username: "tom.lee",
	});
	expect(row?.password).toBeTruthy();
	expect(row?.password).not.toContain(PASSWORD);

	// 等到本次注册请求出现在 server 日志里，再检查整份日志（含本轮所有用例）没有明文密码
	await expect
		.poll(async () => await readFile(SERVER_LOG_FILE, "utf8"))
		.toContain(SIGN_UP_PATH);
	const serverLog = await readFile(SERVER_LOG_FILE, "utf8");
	expect(serverLog).not.toContain(PASSWORD);
});
