import { expect, test } from "@playwright/test";

import { resetTestDatabase, withTestDatabase } from "./support/database";
import { getScrollWidth, NARROW_VIEWPORT } from "./support/page-helpers";
import { WEB_URL } from "./support/urls";

const PASSWORD = "Directory-E2e-Password-2026";
const LOGIN_URL = /\/login$/;

test.beforeEach(async ({ context }) => {
	await resetTestDatabase();
	const response = await context.request.post(
		`${WEB_URL}/api/auth/sign-up/email`,
		{
			data: {
				email: "directory@example.com",
				name: "Directory",
				password: PASSWORD,
				username: "directory",
			},
			headers: { Origin: WEB_URL },
		}
	);
	expect(response.ok()).toBe(true);
	await withTestDatabase(async (db) => {
		await db.query(
			`INSERT INTO github_person (id, "githubId", login, "avatarUrl", name, "htmlUrl", "publicRepos", followers, following, "githubCreatedAt", "createdAt", "updatedAt") VALUES ($1, $2, $3, $4, $5, $6, 12, 200, 3, '2011-01-01', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
			[
				"directory-1",
				"1",
				"octocat",
				"https://avatars.example.test/avatar.png",
				"The Octocat",
				"https://github.com/octocat",
			]
		);
	});
});

test("requires login before showing the directory", async ({ browser }) => {
	const context = await browser.newContext();
	const page = await context.newPage();
	await page.goto(`${WEB_URL}/github-people`);
	await expect(page).toHaveURL(LOGIN_URL);
	await context.close();
});

test("same-origin Cookie authenticates server rendering and CRUD, including after reload", async ({
	page,
}) => {
	await page.route("https://avatars.example.test/**", (route) => route.abort());
	await page.goto("/github-people");
	await expect(
		page.getByRole("heading", { name: "The Octocat" })
	).toBeVisible();
	await page.getByText("修改展示资料", { exact: true }).click();
	await page.getByLabel("展示名称", { exact: true }).fill("团队开发者");
	await page
		.getByLabel("备注", { exact: true })
		.fill("Android 与 Web 共用的人员资料");
	await page.getByRole("button", { exact: true, name: "保存修改" }).click();
	await expect(page.getByRole("heading", { name: "团队开发者" })).toBeVisible();
	await page.reload();
	await expect(page.getByRole("heading", { name: "团队开发者" })).toBeVisible();
	await expect(
		page
			.getByRole("paragraph")
			.filter({ hasText: "Android 与 Web 共用的人员资料" })
	).toBeVisible();
	await page.setViewportSize(NARROW_VIEWPORT);
	expect(await getScrollWidth(page)).toBeLessThanOrEqual(NARROW_VIEWPORT.width);
	await page.getByRole("button", { exact: true, name: "移出人员库" }).click();
	await page.getByRole("button", { exact: true, name: "取消" }).click();
	await expect(page.getByRole("heading", { name: "团队开发者" })).toBeVisible();
	await page.getByRole("button", { exact: true, name: "移出人员库" }).click();
	await page.getByRole("button", { exact: true, name: "确认删除" }).click();
	await expect(
		page.getByRole("heading", { name: "人员库还是空的" })
	).toBeVisible();
	await withTestDatabase(async (db) => {
		const result = await db.query(
			"SELECT id FROM github_person WHERE id = $1",
			["directory-1"]
		);
		expect(result.rows).toHaveLength(0);
	});
});
