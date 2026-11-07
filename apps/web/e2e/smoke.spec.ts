import { expect, test } from "@playwright/test";

import { withTestDatabase } from "./support/database";
import { TEST_DATABASE_NAME } from "./support/database-url";

test("首页能连上 API 服务", async ({ page }) => {
	await page.goto("/");
	await expect(page.getByText("Connected", { exact: true })).toBeVisible();
});

test("测试代码连接的是测试库", async () => {
	const databaseName = await withTestDatabase(async (client) => {
		const { rows } = await client.query<{ name: string }>(
			"SELECT current_database() AS name"
		);
		return rows[0]?.name;
	});
	expect(databaseName).toBe(TEST_DATABASE_NAME);
});
