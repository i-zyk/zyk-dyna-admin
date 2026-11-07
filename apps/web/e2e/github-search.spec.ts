import {
	expect,
	type Locator,
	type Page,
	type Route,
	test,
} from "@playwright/test";
import type { GithubUserProfile } from "@zyk-dyna-admin/api/lib/github";

import { resetTestDatabase } from "./support/database";
import {
	getScrollWidth,
	NARROW_VIEWPORT,
	tabUntilFocused,
} from "./support/page-helpers";
import { SERVER_URL, WEB_URL } from "./support/urls";

const SIGN_UP_PATH = "/api/auth/sign-up/email";
const PASSWORD = "E2e-Github-Search-Secret-7m2k";
const USERNAME = "Tom";
const EMAIL = "tom@example.com";
const DASHBOARD_URL = /\/dashboard$/;

/** 只拦截浏览器发给 server 的 `github.getUser` 请求（httpBatchLink：/trpc/github.getUser?batch=1&input=...） */
const GET_USER_URL = /\/trpc\/github\.getUser(\?|$)/;
/** 头像图片也在浏览器里拦截，返回本地生成的 1×1 PNG，不访问真实 GitHub */
const AVATAR_URL_PATTERN = "https://avatars.example.test/**";
const ONE_PIXEL_PNG = Buffer.from(
	"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
	"base64"
);
/** 页面上任何位置都不应出现的字面量 */
const NULLISH_TEXT = /\bnull\b|\bundefined\b/;

const INVALID_FORMAT_MESSAGE = "GitHub 用户名格式不正确";
const NOT_FOUND_MESSAGE = "未找到该 GitHub 用户";
const RATE_LIMITED_MESSAGE = "请求过于频繁，请稍后再试";
const FALLBACK_MESSAGE = "查询失败，请稍后再试";
/** 不应回显到页面上的服务端原始错误信息 */
const RAW_ERROR_MESSAGE = "raw upstream error from e2e mock";
/** 登录成功后的提示 toast，不属于查询错误，断言「没有全局错误 toast」时排除 */
const SIGN_IN_SUCCESS_TOAST = "登录成功";

const FORTY_CHAR_USERNAME = "a".repeat(40);

function makeProfile(
	login: string,
	overrides: Partial<GithubUserProfile> = {}
): GithubUserProfile {
	return {
		avatarUrl: `https://avatars.example.test/u/${login}.png`,
		bio: `${login} 的简介`,
		blog: "example.com",
		company: "Linux Foundation",
		createdAt: "2011-09-03T15:26:22Z",
		followers: 245_000,
		following: 0,
		htmlUrl: `https://github.com/${login}`,
		location: "Portland, OR",
		login,
		name: "Linus Torvalds",
		publicRepos: 9,
		...overrides,
	};
}

const TORVALDS = makeProfile("torvalds");
const OCTOCAT = makeProfile("octocat", { name: "The Octocat" });

type MockReply =
	| { kind: "profile"; profile: GithubUserProfile }
	| { code: string; httpStatus: number; jsonRpcCode: number; kind: "error" }
	| { kind: "network-error" };

const NOT_FOUND_REPLY: MockReply = {
	code: "NOT_FOUND",
	httpStatus: 404,
	jsonRpcCode: -32_004,
	kind: "error",
};

/** 按 tRPC 批量响应的格式回复一次 `github.getUser` 调用 */
async function fulfillGetUser(route: Route, reply: MockReply): Promise<void> {
	if (reply.kind === "network-error") {
		await route.abort("failed");
		return;
	}
	const corsHeaders = {
		"access-control-allow-credentials": "true",
		"access-control-allow-origin": WEB_URL,
	};
	if (reply.kind === "profile") {
		await route.fulfill({
			headers: corsHeaders,
			json: [{ result: { data: reply.profile } }],
			status: 200,
		});
		return;
	}
	await route.fulfill({
		headers: corsHeaders,
		json: [
			{
				error: {
					code: reply.jsonRpcCode,
					data: {
						code: reply.code,
						httpStatus: reply.httpStatus,
						path: "github.getUser",
					},
					message: RAW_ERROR_MESSAGE,
				},
			},
		],
		status: reply.httpStatus,
	});
}

function readRequestedUsername(url: string): string {
	const input = new URL(url).searchParams.get("input");
	const parsed: unknown = JSON.parse(input ?? "{}");
	const first =
		typeof parsed === "object" && parsed !== null && "0" in parsed
			? parsed[0]
			: undefined;
	if (
		typeof first === "object" &&
		first !== null &&
		"username" in first &&
		typeof first.username === "string"
	) {
		return first.username;
	}
	throw new Error(`无法从 github.getUser 请求中解析 username：${url}`);
}

/**
 * 用 page.route 模拟 `github.getUser`，避免依赖真实 GitHub 额度。
 * 返回按顺序记录的请求用户名，用来断言发了几次请求、请求参数是什么。
 */
async function mockGithubUser(
	page: Page,
	replies: Readonly<Record<string, MockReply>>
): Promise<string[]> {
	const requested: string[] = [];
	await page.route(AVATAR_URL_PATTERN, (route) =>
		route.fulfill({ body: ONE_PIXEL_PNG, contentType: "image/png" })
	);
	await page.route(GET_USER_URL, async (route) => {
		const username = readRequestedUsername(route.request().url());
		requested.push(username);
		await fulfillGetUser(route, replies[username] ?? NOT_FOUND_REPLY);
	});
	return requested;
}

async function signInAsTom(page: Page): Promise<void> {
	await page.goto("/login");
	await page.getByLabel("用户名或邮箱", { exact: true }).fill(USERNAME);
	await page.getByLabel("密码", { exact: true }).fill(PASSWORD);
	await page.getByRole("button", { exact: true, name: "登录" }).click();
	await expect(page).toHaveURL(DASHBOARD_URL);
}

function getSearch(page: Page) {
	const section = page.getByRole("region", { name: "GitHub 用户查询" });
	return {
		alert: section.getByRole("alert"),
		input: section.getByLabel("GitHub 用户名", { exact: true }),
		section,
		submit: section.getByRole("button", { exact: true, name: "搜索" }),
	};
}

type Search = ReturnType<typeof getSearch>;

function getCard(page: Page, login: string): Locator {
	return page.getByRole("region", { name: `${login} 的 GitHub 资料` });
}

async function searchByClick(search: Search, value: string): Promise<void> {
	await search.input.fill(value);
	await search.submit.click();
}

async function searchByEnter(search: Search, value: string): Promise<void> {
	await search.input.fill(value);
	await search.input.press("Enter");
}

test.beforeEach(async ({ page, request }) => {
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
	await signInAsTom(page);
});

test("空输入和只有空格时不发请求、不提示错误", async ({ page }) => {
	const requested = await mockGithubUser(page, {
		torvalds: { kind: "profile", profile: TORVALDS },
	});
	const search = getSearch(page);

	await search.submit.click();
	await searchByEnter(search, "   ");
	await expect(search.section.getByText(INVALID_FORMAT_MESSAGE)).toHaveCount(0);
	await expect(search.input).not.toHaveAttribute("aria-invalid", "true");
	await expect(search.alert).toHaveCount(0);

	// 之后再发一次合法搜索：请求列表里只有它，说明前面的空输入没有发出请求
	await searchByClick(search, "torvalds");
	await expect(getCard(page, "torvalds")).toBeVisible();
	expect(requested).toEqual(["torvalds"]);
});

for (const value of ["-abc", FORTY_CHAR_USERNAME, "a_b", "a--b"] as const) {
	test(`格式不合法（${value.length > 10 ? `${value.length} 位字符串` : value}）时提示「${INVALID_FORMAT_MESSAGE}」且不发请求`, async ({
		page,
	}) => {
		const requested = await mockGithubUser(page, {
			torvalds: { kind: "profile", profile: TORVALDS },
		});
		const search = getSearch(page);

		await searchByClick(search, value);
		await expect(
			search.section.getByText(INVALID_FORMAT_MESSAGE)
		).toBeVisible();
		await expect(search.input).toHaveAttribute("aria-invalid", "true");
		expect(requested).toEqual([]);

		// 改成合法用户名后正常搜索，格式错误消失；请求列表里只有这一次
		await searchByClick(search, "torvalds");
		await expect(getCard(page, "torvalds")).toBeVisible();
		await expect(search.section.getByText(INVALID_FORMAT_MESSAGE)).toHaveCount(
			0
		);
		expect(requested).toEqual(["torvalds"]);
	});
}

test("搜索 torvalds 显示头像、昵称、用户名、简介、公司、所在地、博客、仓库 / 粉丝 / 关注数和注册时间", async ({
	page,
}) => {
	const requested = await mockGithubUser(page, {
		torvalds: { kind: "profile", profile: TORVALDS },
	});
	const search = getSearch(page);

	await searchByClick(search, "torvalds");

	const card = getCard(page, "torvalds");
	await expect(card).toBeVisible();
	await expect(
		card.getByRole("img", { name: "torvalds 的头像" })
	).toBeVisible();
	await expect(
		card.getByRole("heading", { name: "Linus Torvalds" })
	).toBeVisible();
	await expect(card.getByText("torvalds 的简介")).toBeVisible();
	await expect(card.getByText("Linux Foundation")).toBeVisible();
	await expect(card.getByText("Portland, OR")).toBeVisible();
	await expect(card.getByText("注册于 2011-09-03")).toBeVisible();

	const stats = card.locator("dl");
	await expect(stats.locator("div").filter({ hasText: "公开仓库" })).toHaveText(
		"公开仓库9"
	);
	await expect(stats.locator("div").filter({ hasText: "粉丝" })).toHaveText(
		"粉丝245000"
	);
	await expect(stats.locator("div").filter({ hasText: "关注" })).toHaveText(
		"关注0"
	);

	// 用户名链接到 GitHub 主页，博客补全协议；所有外链都在新标签页打开并切断 opener / referrer
	const profileLink = card.getByRole("link", { name: "@torvalds" });
	await expect(profileLink).toHaveAttribute(
		"href",
		"https://github.com/torvalds"
	);
	const blogLink = card.getByRole("link", { name: "example.com" });
	await expect(blogLink).toHaveAttribute("href", "https://example.com/");
	const links = card.getByRole("link");
	await expect(links).toHaveCount(2);
	for (const link of await links.all()) {
		// biome-ignore lint/performance/noAwaitInLoops: 逐个断言外链属性，数量很少
		await expect(link).toHaveAttribute("target", "_blank");
		await expect(link).toHaveAttribute("rel", "noopener noreferrer");
	}

	await expect(page.locator("body")).not.toContainText(NULLISH_TEXT, {
		useInnerText: true,
	});
	expect(requested).toEqual(["torvalds"]);
});

test("昵称为空时显示用户名，缺少简介 / 公司 / 所在地 / 博客时对应行不存在，页面不含 null / undefined", async ({
	page,
}) => {
	const sparse = makeProfile("ghost-user", {
		bio: null,
		blog: null,
		company: null,
		location: null,
		name: null,
	});
	await mockGithubUser(page, {
		"ghost-user": { kind: "profile", profile: sparse },
	});
	const search = getSearch(page);

	await searchByClick(search, "ghost-user");

	const card = getCard(page, "ghost-user");
	await expect(card).toBeVisible();
	await expect(card.getByRole("heading", { name: "ghost-user" })).toBeVisible();
	await expect(card.getByText("的简介")).toHaveCount(0);
	for (const label of ["公司：", "所在地：", "博客 / 网站："]) {
		// biome-ignore lint/performance/noAwaitInLoops: 逐个断言资料行不存在，数量很少
		await expect(card.getByText(label)).toHaveCount(0);
	}
	// 只剩注册时间这一行
	await expect(card.getByRole("listitem")).toHaveCount(1);
	await expect(card.getByText("注册于 2011-09-03")).toBeVisible();
	// 只剩用户名这一个外链
	await expect(card.getByRole("link")).toHaveCount(1);

	await expect(page.locator("body")).not.toContainText(NULLISH_TEXT, {
		useInnerText: true,
	});
});

const errorCases = [
	{ message: NOT_FOUND_MESSAGE, reply: NOT_FOUND_REPLY, title: "404" },
	{
		message: RATE_LIMITED_MESSAGE,
		reply: {
			code: "TOO_MANY_REQUESTS",
			httpStatus: 429,
			jsonRpcCode: -32_029,
			kind: "error",
		},
		title: "429",
	},
	{
		message: FALLBACK_MESSAGE,
		reply: {
			code: "INTERNAL_SERVER_ERROR",
			httpStatus: 500,
			jsonRpcCode: -32_603,
			kind: "error",
		},
		title: "500",
	},
	{
		message: FALLBACK_MESSAGE,
		reply: { kind: "network-error" },
		title: "网络错误",
	},
] as const satisfies readonly {
	message: string;
	reply: MockReply;
	title: string;
}[];

for (const { message, reply, title } of errorCases) {
	test(`${title} 时显示「${message}」，页面不崩溃、不弹全局 toast`, async ({
		page,
	}) => {
		const requested = await mockGithubUser(page, {
			"no-such-user": reply,
			torvalds: { kind: "profile", profile: TORVALDS },
		});
		const search = getSearch(page);

		const errorToasts = page
			.locator("[data-sonner-toast]")
			.filter({ hasNotText: SIGN_IN_SUCCESS_TOAST });

		await searchByClick(search, "no-such-user");
		await expect(search.alert).toHaveText(message);
		await expect(errorToasts).toHaveCount(0);
		await expect(page.getByText(RAW_ERROR_MESSAGE)).toHaveCount(0);
		await expect(
			page.getByRole("heading", { name: "Dashboard" })
		).toBeVisible();
		await expect(page.locator("body")).not.toContainText(NULLISH_TEXT, {
			useInnerText: true,
		});
		// retry: false，失败只请求一次
		expect(requested).toEqual(["no-such-user"]);

		// 页面仍可继续使用：再搜一个存在的用户，错误提示消失并显示卡片
		await searchByClick(search, "torvalds");
		await expect(getCard(page, "torvalds")).toBeVisible();
		await expect(search.alert).toHaveCount(0);
		expect(requested).toEqual(["no-such-user", "torvalds"]);
		// 错误由页面内提示展示，全程没有弹出全局错误 toast（toast 4 秒才关闭，到这里仍会在页面上）
		await expect(errorToasts).toHaveCount(0);
	});
}

test("5 分钟内重复搜索同一用户名命中缓存：中间搜索其他用户、大小写不同都只请求一次", async ({
	page,
}) => {
	const requested = await mockGithubUser(page, {
		octocat: { kind: "profile", profile: OCTOCAT },
		sentinel: { kind: "profile", profile: makeProfile("sentinel") },
		torvalds: { kind: "profile", profile: TORVALDS },
	});
	const search = getSearch(page);

	// 输入 trim 后转小写作为查询参数和缓存键
	await searchByClick(search, " Torvalds ");
	await expect(getCard(page, "torvalds")).toBeVisible();
	await searchByClick(search, "torvalds");
	await expect(getCard(page, "torvalds")).toBeVisible();

	await searchByClick(search, "octocat");
	await expect(getCard(page, "octocat")).toBeVisible();

	await searchByClick(search, "TORVALDS");
	await expect(getCard(page, "torvalds")).toBeVisible();

	// 最后搜一个新用户：请求按顺序记录，sentinel 之前没有多出 torvalds 的请求，说明上面两次都命中了缓存
	await searchByClick(search, "sentinel");
	await expect(getCard(page, "sentinel")).toBeVisible();
	expect(requested).toEqual(["torvalds", "octocat", "sentinel"]);
});

test("只用键盘就能完成搜索：Tab 聚焦搜索框，输入后按回车", async ({ page }) => {
	const requested = await mockGithubUser(page, {
		torvalds: { kind: "profile", profile: TORVALDS },
	});
	const search = getSearch(page);

	await tabUntilFocused(page, search.input);
	await page.keyboard.type("torvalds");
	await page.keyboard.press("Enter");

	await expect(getCard(page, "torvalds")).toBeVisible();
	expect(requested).toEqual(["torvalds"]);
});

const LONG_BIO = `${"超长简介没有空格".repeat(20)} ${"a".repeat(300)}`;
const LONG_BLOG = `https://example.com/${"very-long-path-segment".repeat(15)}`;

for (const colorScheme of ["light", "dark"] as const) {
	test(`375px 宽、${colorScheme} 主题下长简介和长博客地址不出现横向滚动`, async ({
		page,
	}) => {
		await page.setViewportSize(NARROW_VIEWPORT);
		await page.emulateMedia({ colorScheme });
		const longLogin = `long-${"x".repeat(34)}`;
		await mockGithubUser(page, {
			[longLogin]: {
				kind: "profile",
				profile: makeProfile(longLogin, {
					bio: LONG_BIO,
					blog: LONG_BLOG,
					company: "C".repeat(200),
					location: "L".repeat(200),
					name: "N".repeat(200),
				}),
			},
		});
		const search = getSearch(page);
		await expect(page.locator("html")).toHaveClass(new RegExp(colorScheme));

		await searchByEnter(search, longLogin);
		const card = getCard(page, longLogin);
		await expect(card).toBeVisible();
		await expect(card.getByText(LONG_BLOG)).toBeVisible();
		expect(await getScrollWidth(page)).toBeLessThanOrEqual(
			NARROW_VIEWPORT.width
		);
	});
}
