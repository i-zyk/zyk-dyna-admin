import { expect, type Locator, type Page, test } from "@playwright/test";

import { resetTestDatabase } from "./support/database";
import {
	getScrollWidth,
	NARROW_VIEWPORT,
	pressUntilFocused,
	tabUntilFocused,
} from "./support/page-helpers";
import {
	buildPersonSeeds,
	countPersons,
	deletePersonById,
	findPersonByEmployeeNo,
	type PersonSeed,
	resetPersons,
	type SeededPerson,
	seedPersons,
} from "./support/persons";
import { SERVER_URL, WEB_URL } from "./support/urls";

const SIGN_UP_PATH = "/api/auth/sign-up/email";
const SIGN_IN_USERNAME_PATH = "/api/auth/sign-in/username";
const PASSWORD = "E2e-Persons-Secret-8v3n";
const USERNAME = "Tom";
const EMAIL = "tom@example.com";

const LOGIN_URL = /\/login$/;
const PERSONS_URL = /\/persons$/;
const NEW_PERSON_URL = /\/persons\/new$/;
const EDIT_PERSON_URL = /\/persons\/[^/]+\/edit$/;
/** 列表单元格里的更新时间格式 */
const DATE_TIME_TEXT = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/;
/** 页面上任何位置都不应出现的字面量 */
const NULLISH_TEXT = /\bnull\b|\bundefined\b/;
/** 「操作」列：编辑链接 + 删除按钮 */
const ACTIONS_CELL_TEXT = /^编辑.*删除/;
/** 表单提交按钮：空闲时为「保存」，提交中为「保存中…」 */
const SUBMIT_BUTTON_NAME = /^(保存|保存中…)$/;
/** 匹配 person.create 请求（httpBatchLink：/trpc/person.create?batch=1） */
const CREATE_REQUEST_URL = /\/trpc\/person\.create(\?|$)/;

/** 固定浏览器时区，让更新时间的显示与断言一致 */
const TIMEZONE = "Asia/Shanghai";
/** 预置的较早更新时间，在 Asia/Shanghai 显示为 2020-01-02 11:04 */
const OLD_UPDATED_AT = new Date("2020-01-02T03:04:05.000Z");
const OLD_UPDATED_AT_TEXT = "2020-01-02 11:04";

const NOT_FOUND_MESSAGE = "该人员不存在或已被删除";
const CONFLICT_MESSAGE = "工号已存在";
const EMPLOYEE_NO_INVALID_MESSAGE = "工号为 2–32 位字母、数字或连字符";

/** 列表每页条数 */
const PAGE_SIZE = 20;
/** 翻页用例预置的人数（2 页：20 + 3） */
const PAGED_PERSON_COUNT = 23;

test.use({ timezoneId: TIMEZONE });

const dateTimeFormat = new Intl.DateTimeFormat("sv-SE", {
	day: "2-digit",
	hour: "2-digit",
	hourCycle: "h23",
	minute: "2-digit",
	month: "2-digit",
	timeZone: TIMEZONE,
	year: "numeric",
});

/** 按页面所用时区格式化为 `YYYY-MM-DD HH:mm` */
function formatInTimezone(date: Date): string {
	return dateTimeFormat.format(date);
}

const ZHANG_SAN: PersonSeed = {
	department: "研发部",
	email: "zhangsan@example.com",
	employeeNo: "A001",
	name: "张三",
	phone: "13812345678",
	position: "工程师",
	remark: "第一位员工",
	status: "INACTIVE",
	updatedAt: OLD_UPDATED_AT,
};

const LI_SI: PersonSeed = {
	employeeNo: "B002",
	name: "李四",
};

function personLabel(person: { employeeNo: string; name: string }): string {
	return `${person.name}（${person.employeeNo}）`;
}

/** 列表里「编辑 / 删除」的可访问名称：动作 + 姓名（工号），中间可能没有空格 */
function actionName(action: "删除" | "编辑", label: string): RegExp {
	return new RegExp(`^${action}\\s*${label}$`);
}

async function signIn(page: Page): Promise<void> {
	// 直接调用登录接口拿到 cookie（page.request 与浏览器共享 cookie），不经过登录页和「登录成功」提示
	const response = await page.request.post(
		`${SERVER_URL}${SIGN_IN_USERNAME_PATH}`,
		{
			data: { password: PASSWORD, username: USERNAME },
			headers: { origin: WEB_URL },
		}
	);
	expect(response.ok()).toBe(true);
}

function getForm(page: Page) {
	return {
		cancel: page.getByRole("link", { exact: true, name: "取消" }),
		department: page.getByRole("textbox", { exact: true, name: "部门" }),
		email: page.getByRole("textbox", { exact: true, name: "邮箱" }),
		employeeNo: page.getByRole("textbox", { exact: true, name: "工号" }),
		name: page.getByRole("textbox", { exact: true, name: "姓名" }),
		phone: page.getByRole("textbox", { exact: true, name: "手机号" }),
		position: page.getByRole("textbox", { exact: true, name: "职位" }),
		remark: page.getByRole("textbox", { exact: true, name: "备注" }),
		status: page.getByRole("combobox", { exact: true, name: "状态" }),
		submit: page.getByRole("button", { name: SUBMIT_BUTTON_NAME }),
	};
}

type PersonFormLocators = ReturnType<typeof getForm>;

function getList(page: Page) {
	return {
		empty: page.getByText("暂无人员", { exact: true }),
		keyword: page.getByLabel("姓名或工号", { exact: true }),
		newPerson: page.getByRole("link", { name: "新增人员" }).first(),
		next: page.getByRole("button", { exact: true, name: "下一页" }),
		noResults: page.getByText("没有找到匹配的人员", { exact: true }),
		pagination: page.getByRole("navigation", { name: "分页" }),
		previous: page.getByRole("button", { exact: true, name: "上一页" }),
		rows: page.getByRole("table").locator("tbody").getByRole("row"),
		search: page.getByRole("button", { exact: true, name: "搜索" }),
		status: page.getByRole("combobox", { exact: true, name: "状态" }),
		tableContainer: page.locator('[data-slot="table-container"]'),
	};
}

type PersonListLocators = ReturnType<typeof getList>;

async function openList(page: Page): Promise<PersonListLocators> {
	await page.goto("/persons");
	await expect(page.getByRole("heading", { name: "人员管理" })).toBeVisible();
	return getList(page);
}

function rowOf(list: PersonListLocators, employeeNo: string): Locator {
	return list.rows.filter({
		has: list.rows.page().getByRole("cell", { exact: true, name: employeeNo }),
	});
}

/** 断言一行的工号、姓名、部门、职位、手机号、状态、更新时间 */
async function expectRowCells(
	row: Locator,
	cells: readonly (string | RegExp)[]
): Promise<void> {
	await expect(row.getByRole("cell")).toHaveText([...cells, ACTIONS_CELL_TEXT]);
}

async function expectPageInfo(
	list: PersonListLocators,
	text: string
): Promise<void> {
	await expect(list.pagination).toContainText(text);
}

/** 下拉框当前选中项的文字（不含右侧的展开图标） */
function selectedValue(trigger: Locator): Locator {
	return trigger.locator('[data-slot="select-value"]');
}

async function chooseStatus(
	page: Page,
	trigger: Locator,
	label: string
): Promise<void> {
	await trigger.click();
	await page.getByRole("option", { exact: true, name: label }).click();
	await expect(selectedValue(trigger)).toHaveText(label);
}

async function expectNoNullishText(page: Page): Promise<void> {
	await expect(page.locator("body")).not.toContainText(NULLISH_TEXT, {
		useInnerText: true,
	});
}

async function openEdit(
	page: Page,
	person: SeededPerson
): Promise<PersonFormLocators> {
	await page.goto(`/persons/${person.id}/edit`);
	const form = getForm(page);
	await expect(form.name).toHaveValue(person.name);
	return form;
}

function toast(page: Page, text: string): Locator {
	return page.locator("[data-sonner-toast]").filter({ hasText: text });
}

/** 记录页面发出的 person.create 请求数，用来断言校验不通过时没有发请求 */
function trackCreateRequests(page: Page): { count: number } {
	const counter = { count: 0 };
	page.on("request", (request) => {
		if (CREATE_REQUEST_URL.test(request.url())) {
			counter.count += 1;
		}
	});
	return counter;
}

test.beforeAll(async ({ playwright }) => {
	// 清空其他用例留下的数据（含 person 表），再通过注册接口准备用户 Tom / tom@example.com
	await resetTestDatabase();
	const request = await playwright.request.newContext();
	try {
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
	} finally {
		await request.dispose();
	}
});

test.beforeEach(async () => {
	await resetPersons();
});

test.describe("未登录", () => {
	for (const path of ["/persons", "/persons/new", "/persons/xxx/edit"]) {
		test(`访问 ${path} 被重定向到 /login`, async ({ page }) => {
			await page.goto(path);
			await expect(page).toHaveURL(LOGIN_URL);
			await expect(page.getByRole("heading", { name: "登录" })).toBeVisible();
		});
	}

	test("直接请求 person 的 5 个接口都返回 401 UNAUTHORIZED，且不改动数据", async ({
		request,
	}) => {
		const [person] = await seedPersons([ZHANG_SAN]);
		const input = (value: unknown) => encodeURIComponent(JSON.stringify(value));
		const headers = { origin: WEB_URL };
		const responses = [
			await request.get(
				`${SERVER_URL}/trpc/person.list?input=${input({ page: 1, pageSize: PAGE_SIZE })}`,
				{ headers }
			),
			await request.get(
				`${SERVER_URL}/trpc/person.getById?input=${input({ id: person?.id })}`,
				{ headers }
			),
			await request.post(`${SERVER_URL}/trpc/person.create`, {
				data: { employeeNo: "C003", name: "王五", status: "ACTIVE" },
				headers,
			}),
			await request.post(`${SERVER_URL}/trpc/person.update`, {
				data: {
					employeeNo: "A001",
					id: person?.id,
					name: "改名",
					status: "ACTIVE",
				},
				headers,
			}),
			await request.post(`${SERVER_URL}/trpc/person.delete`, {
				data: { id: person?.id },
				headers,
			}),
		];
		for (const response of responses) {
			expect(response.status()).toBe(401);
			// biome-ignore lint/performance/noAwaitInLoops: 逐个读取响应体，数量很少
			const body: unknown = await response.json();
			expect(body).toMatchObject({ error: { data: { code: "UNAUTHORIZED" } } });
		}
		expect(await countPersons()).toBe(1);
		expect(await findPersonByEmployeeNo("A001")).toMatchObject({
			name: "张三",
		});
	});
});

test.describe("已登录", () => {
	test.beforeEach(async ({ page }) => {
		await signIn(page);
	});

	test("顶部导航「人员管理」进入 /persons，空库显示「暂无人员」和「新增人员」", async ({
		page,
	}) => {
		await page.goto("/dashboard");
		await page.getByRole("link", { exact: true, name: "人员管理" }).click();
		await expect(page).toHaveURL(PERSONS_URL);

		const list = getList(page);
		await expect(list.empty).toBeVisible();
		await expect(list.pagination).toHaveCount(0);
		await expect(list.rows).toHaveCount(0);

		// 空状态里的「新增人员」进入新增页
		const emptyState = page.locator('[data-slot="empty"]');
		await emptyState.getByRole("link", { name: "新增人员" }).click();
		await expect(page).toHaveURL(NEW_PERSON_URL);
		await expect(page.getByRole("heading", { name: "新增人员" })).toBeVisible();
	});

	test("只填姓名、工号保存成功：toast「已保存」，回到列表第一行，工号大写，选填显示 -", async ({
		page,
	}) => {
		await seedPersons([{ ...LI_SI, updatedAt: OLD_UPDATED_AT }]);
		const list = await openList(page);
		await list.newPerson.click();
		await expect(page).toHaveURL(NEW_PERSON_URL);

		const form = getForm(page);
		await expect(selectedValue(form.status)).toHaveText("在职");
		await form.name.fill(" 王五 ");
		await form.employeeNo.fill("c-003");
		await form.submit.click();

		await expect(toast(page, "已保存")).toBeVisible();
		await expect(page).toHaveURL(PERSONS_URL);
		await expect(list.rows).toHaveCount(2);
		await expect(page.getByRole("columnheader")).toHaveText([
			"工号",
			"姓名",
			"部门",
			"职位",
			"手机号",
			"状态",
			"更新时间",
			"操作",
		]);
		await expectRowCells(list.rows.first(), [
			"C-003",
			"王五",
			"-",
			"-",
			"-",
			"在职",
			DATE_TIME_TEXT,
		]);
		await expect(list.rows.nth(1)).toContainText("B002");
		await expectNoNullishText(page);

		// 库中工号为大写、选填为 null、状态默认在职
		expect(await findPersonByEmployeeNo("C-003")).toMatchObject({
			department: null,
			email: null,
			name: "王五",
			phone: null,
			position: null,
			remark: null,
			status: "ACTIVE",
		});
	});

	test("姓名为空 / 超长、工号含中文 / 空格、手机号 10 位、邮箱 a@b、部门 / 职位 / 备注超长时显示原因且无法提交", async ({
		page,
	}) => {
		const createRequests = trackCreateRequests(page);
		await page.goto("/persons/new");
		const form = getForm(page);

		// 空表单直接提交：必填项提示原因
		await form.submit.click();
		await expect(page.locator("#name-error")).toHaveText("请输入姓名");
		await expect(page.locator("#employeeNo-error")).toHaveText("请输入工号");

		const cases = [
			{
				field: form.name,
				id: "name",
				message: "请输入姓名",
				valid: "王五",
				value: "   ",
			},
			{
				field: form.name,
				id: "name",
				message: "姓名不能超过 50 个字符",
				valid: "王五",
				value: "王".repeat(51),
			},
			{
				field: form.employeeNo,
				id: "employeeNo",
				message: EMPLOYEE_NO_INVALID_MESSAGE,
				valid: "C003",
				value: "工号1",
			},
			{
				field: form.employeeNo,
				id: "employeeNo",
				message: EMPLOYEE_NO_INVALID_MESSAGE,
				valid: "C003",
				value: "A 001",
			},
			{
				field: form.phone,
				id: "phone",
				message: "请输入正确的 11 位手机号",
				valid: "",
				value: "1381234567",
			},
			{
				field: form.email,
				id: "email",
				message: "邮箱格式不正确",
				valid: "",
				value: "a@b",
			},
			{
				field: form.department,
				id: "department",
				message: "部门不能超过 50 个字符",
				valid: "",
				value: "部".repeat(51),
			},
			{
				field: form.position,
				id: "position",
				message: "职位不能超过 50 个字符",
				valid: "",
				value: "职".repeat(51),
			},
			{
				field: form.remark,
				id: "remark",
				message: "备注不能超过 500 个字符",
				valid: "",
				value: "备".repeat(501),
			},
		] as const;
		// 先把其余字段填成合法值，只让当前字段不合法
		await form.name.fill("王五");
		await form.employeeNo.fill("C003");
		for (const { field, id, message, valid, value } of cases) {
			// biome-ignore lint/performance/noAwaitInLoops: 每个用例都依赖上一个用例恢复后的表单状态
			await field.fill(value);
			await expect(page.locator(`#${id}-error`)).toHaveText(message);
			await expect(field).toHaveAttribute("aria-invalid", "true");
			await expect(field).toHaveAttribute("aria-describedby", `${id}-error`);
			await expect(form.submit).toBeDisabled();
			await field.press("Enter");
			// 恢复为合法值，错误消失
			await field.fill(valid);
			await expect(page.locator(`#${id}-error`)).toHaveCount(0);
		}

		await expect(page).toHaveURL(NEW_PERSON_URL);
		expect(createRequests.count).toBe(0);
		expect(await countPersons()).toBe(0);
	});

	test("保存请求进行中时按钮显示「保存中…」并禁用，重复点击 / 回车只发 1 次请求", async ({
		page,
	}) => {
		const createRequests = trackCreateRequests(page);
		// 先挂起 person.create，等断言完加载状态再放行
		let releaseCreate: () => void = () => undefined;
		const createReleased = new Promise<void>((resolve) => {
			releaseCreate = resolve;
		});
		await page.route(CREATE_REQUEST_URL, async (route) => {
			await createReleased;
			await route.continue();
		});

		await page.goto("/persons/new");
		const form = getForm(page);
		await form.name.fill("王五");
		await form.employeeNo.fill("C003");
		await form.submit.click();

		const busyButton = page.getByRole("button", {
			exact: true,
			name: "保存中…",
		});
		await expect(busyButton).toBeDisabled();
		await expect(busyButton).toHaveAttribute("aria-busy", "true");
		await expect.poll(() => createRequests.count).toBe(1);

		// 加载中再次点击和回车都不应发出第二次请求
		await busyButton.click({ force: true });
		await form.name.press("Enter");
		expect(createRequests.count).toBe(1);

		releaseCreate();
		await expect(toast(page, "已保存")).toBeVisible();
		await expect(page).toHaveURL(PERSONS_URL);
		expect(createRequests.count).toBe(1);
		expect(await countPersons()).toBe(1);
	});

	test("新增已存在工号的小写形式时，工号字段下提示「工号已存在」", async ({
		page,
	}) => {
		await seedPersons([ZHANG_SAN]);
		await page.goto("/persons/new");
		const form = getForm(page);
		await form.name.fill("张三二号");
		await form.employeeNo.fill("a001");
		await form.submit.click();

		await expect(page.locator("#employeeNo-error")).toHaveText(
			CONFLICT_MESSAGE
		);
		await expect(form.employeeNo).toHaveAttribute("aria-invalid", "true");
		await expect(page).toHaveURL(NEW_PERSON_URL);
		expect(await countPersons()).toBe(1);
		expect(await findPersonByEmployeeNo("A001")).toMatchObject({
			name: "张三",
		});
	});

	test("编辑时把工号改成别人的工号，工号字段下提示「工号已存在」", async ({
		page,
	}) => {
		const [, liSi] = await seedPersons([ZHANG_SAN, LI_SI]);
		if (!liSi) {
			throw new Error("预置李四失败");
		}
		const form = await openEdit(page, liSi);
		await form.employeeNo.fill("a001");
		await form.submit.click();

		await expect(page.locator("#employeeNo-error")).toHaveText(
			CONFLICT_MESSAGE
		);
		await expect(form.employeeNo).toHaveAttribute("aria-invalid", "true");
		await expect(page).toHaveURL(EDIT_PERSON_URL);
		expect(await findPersonByEmployeeNo("B002")).toMatchObject({
			id: liSi.id,
			name: "李四",
		});
		expect(await findPersonByEmployeeNo("A001")).toMatchObject({
			name: "张三",
		});
	});

	test("编辑页回填数据，修改保存后列表显示新数据，更新时间从预置的较早时间变为当前时间", async ({
		page,
	}) => {
		await seedPersons([ZHANG_SAN]);
		const list = await openList(page);
		const row = rowOf(list, "A001");
		await expectRowCells(row, [
			"A001",
			"张三",
			"研发部",
			"工程师",
			"13812345678",
			"离职",
			OLD_UPDATED_AT_TEXT,
		]);

		await row
			.getByRole("link", { name: actionName("编辑", personLabel(ZHANG_SAN)) })
			.click();
		await expect(page).toHaveURL(EDIT_PERSON_URL);
		const form = getForm(page);
		await expect(form.name).toHaveValue("张三");
		await expect(form.employeeNo).toHaveValue("A001");
		await expect(form.phone).toHaveValue("13812345678");
		await expect(form.email).toHaveValue("zhangsan@example.com");
		await expect(form.department).toHaveValue("研发部");
		await expect(form.position).toHaveValue("工程师");
		await expect(selectedValue(form.status)).toHaveText("离职");
		await expect(form.remark).toHaveValue("第一位员工");

		const savedAfter = Date.now();
		await form.name.fill(" 张三丰 ");
		await form.department.fill("");
		await form.position.fill("架构师");
		await chooseStatus(page, form.status, "在职");
		await form.submit.click();

		await expect(toast(page, "已保存")).toBeVisible();
		await expect(page).toHaveURL(PERSONS_URL);
		const saved = await findPersonByEmployeeNo("A001");
		expect(saved).toMatchObject({
			department: null,
			name: "张三丰",
			position: "架构师",
			status: "ACTIVE",
		});
		if (!saved) {
			throw new Error("编辑后的人员不存在");
		}
		// 允许测试进程与数据库之间少量时钟误差
		expect(saved.updatedAt.getTime()).toBeGreaterThan(savedAfter - 60_000);
		await expectRowCells(rowOf(list, "A001"), [
			"A001",
			"张三丰",
			"-",
			"架构师",
			"13812345678",
			"在职",
			formatInTimezone(saved.updatedAt),
		]);
		await expect(rowOf(list, "A001")).not.toContainText(OLD_UPDATED_AT_TEXT);
		await expectNoNullishText(page);
	});

	test("编辑页点击「取消」回到列表，不保存任何修改", async ({ page }) => {
		const [zhangSan] = await seedPersons([ZHANG_SAN]);
		if (!zhangSan) {
			throw new Error("预置张三失败");
		}
		const form = await openEdit(page, zhangSan);
		await form.name.fill("不应保存");
		await form.cancel.click();

		await expect(page).toHaveURL(PERSONS_URL);
		const list = getList(page);
		await expectRowCells(rowOf(list, "A001"), [
			"A001",
			"张三",
			"研发部",
			"工程师",
			"13812345678",
			"离职",
			OLD_UPDATED_AT_TEXT,
		]);
		expect(await findPersonByEmployeeNo("A001")).toMatchObject({
			name: "张三",
			updatedAt: OLD_UPDATED_AT,
		});
	});

	test("删除：确认对话框含「姓名（工号）」，取消 / Esc 不删，确认后 toast「已删除」并从列表消失", async ({
		page,
	}) => {
		await seedPersons([ZHANG_SAN, LI_SI]);
		const list = await openList(page);
		const deleteButton = page.getByRole("button", {
			name: actionName("删除", personLabel(ZHANG_SAN)),
		});
		const dialog = page.getByRole("alertdialog");

		await deleteButton.click();
		await expect(dialog).toContainText(
			"确定删除人员「张三（A001）」吗？删除后无法恢复。"
		);
		await dialog.getByRole("button", { exact: true, name: "取消" }).click();
		await expect(dialog).toHaveCount(0);

		await deleteButton.click();
		await expect(dialog).toBeVisible();
		await page.keyboard.press("Escape");
		await expect(dialog).toHaveCount(0);
		expect(await countPersons()).toBe(2);
		await expect(list.rows).toHaveCount(2);

		await deleteButton.click();
		await dialog.getByRole("button", { exact: true, name: "确定删除" }).click();
		await expect(toast(page, "已删除")).toBeVisible();
		await expect(dialog).toHaveCount(0);
		await expect(rowOf(list, "A001")).toHaveCount(0);
		await expect(list.rows).toHaveCount(1);
		await expectPageInfo(list, "第 1 / 1 页，共 1 条");

		await page.reload();
		await expect(rowOf(list, "B002")).toHaveCount(1);
		await expect(rowOf(list, "A001")).toHaveCount(0);
		expect(await findPersonByEmployeeNo("A001")).toBeNull();
	});

	test("第 2 页只有 1 条时删除后回到第 1 页", async ({ page }) => {
		await seedPersons(buildPersonSeeds(PAGE_SIZE + 1));
		const list = await openList(page);
		await expectPageInfo(list, "第 1 / 2 页，共 21 条");
		await list.next.click();
		await expectPageInfo(list, "第 2 / 2 页，共 21 条");
		await expect(list.rows).toHaveCount(1);

		await page
			.getByRole("button", { name: actionName("删除", "人员21（E021）") })
			.click();
		await page
			.getByRole("alertdialog")
			.getByRole("button", { exact: true, name: "确定删除" })
			.click();

		await expect(toast(page, "已删除")).toBeVisible();
		await expectPageInfo(list, "第 1 / 1 页，共 20 条");
		await expect(list.rows).toHaveCount(PAGE_SIZE);
		await expect(list.previous).toHaveAttribute("aria-disabled", "true");
		await expect(list.next).toHaveAttribute("aria-disabled", "true");
	});

	test("搜索 / 筛选 / 翻页：姓名片段、工号小写片段、状态「离职」、搜索后回到第 1 页、无结果提示", async ({
		page,
	}) => {
		const INACTIVE_INDEXES = new Set([2, 5]);
		await seedPersons(
			buildPersonSeeds(PAGED_PERSON_COUNT, (index) => ({
				...(index === 1 ? { department: "研发部", name: "李四光" } : {}),
				...(INACTIVE_INDEXES.has(index) ? { status: "INACTIVE" } : {}),
			}))
		);
		const list = await openList(page);

		// 翻页：首页「上一页」禁用，末页「下一页」禁用
		await expectPageInfo(list, "第 1 / 2 页，共 23 条");
		await expect(list.rows).toHaveCount(PAGE_SIZE);
		await expect(list.rows.first()).toContainText("E001");
		await expect(list.previous).toHaveAttribute("aria-disabled", "true");
		await list.next.click();
		await expectPageInfo(list, "第 2 / 2 页，共 23 条");
		await expect(list.rows).toHaveCount(PAGED_PERSON_COUNT - PAGE_SIZE);
		await expect(list.rows.first()).toContainText("E021");
		await expect(list.next).toHaveAttribute("aria-disabled", "true");
		await list.previous.click();
		await expectPageInfo(list, "第 1 / 2 页，共 23 条");
		await list.next.click();
		await expectPageInfo(list, "第 2 / 2 页，共 23 条");

		// 在第 2 页按姓名片段搜索（点击「搜索」），回到第 1 页
		await list.keyword.fill("四光");
		await list.search.click();
		await expectPageInfo(list, "第 1 / 1 页，共 1 条");
		await expectRowCells(list.rows.first(), [
			"E002",
			"李四光",
			"研发部",
			"-",
			"-",
			"在职",
			DATE_TIME_TEXT,
		]);

		// 工号小写片段（回车，前后空格被去掉），不区分大小写
		await list.keyword.fill(" e02 ");
		await list.keyword.press("Enter");
		await expectPageInfo(list, "第 1 / 1 页，共 4 条");
		await expect(list.rows.getByRole("cell").first()).toHaveText("E020");
		await expect(list.rows).toHaveCount(4);

		// 清空关键词，状态筛选「离职」只显示离职人员
		await list.keyword.fill("");
		await list.search.click();
		await expectPageInfo(list, "第 1 / 2 页，共 23 条");
		await list.next.click();
		await expectPageInfo(list, "第 2 / 2 页，共 23 条");
		await chooseStatus(page, list.status, "离职");
		await expectPageInfo(list, "第 1 / 1 页，共 2 条");
		await expect(list.rows).toHaveCount(INACTIVE_INDEXES.size);
		for (const row of await list.rows.all()) {
			// biome-ignore lint/performance/noAwaitInLoops: 逐行断言状态，数量很少
			await expect(row.getByRole("cell").nth(5)).toHaveText("离职");
		}
		await chooseStatus(page, list.status, "在职");
		await expectPageInfo(
			list,
			`第 1 / 2 页，共 ${PAGED_PERSON_COUNT - INACTIVE_INDEXES.size} 条`
		);

		// 有筛选条件但无结果
		await list.keyword.fill("不存在的人");
		await list.keyword.press("Enter");
		await expect(list.noResults).toBeVisible();
		await expect(list.pagination).toHaveCount(0);
		await expect(list.empty).toHaveCount(0);

		await chooseStatus(page, list.status, "全部");
		await list.keyword.fill("");
		await list.keyword.press("Enter");
		await expectPageInfo(list, "第 1 / 2 页，共 23 条");
	});

	test("打开已删除人员的编辑页显示「该人员不存在或已被删除」，「返回列表」回到 /persons", async ({
		page,
	}) => {
		const [zhangSan] = await seedPersons([ZHANG_SAN]);
		if (!zhangSan) {
			throw new Error("预置张三失败");
		}
		await deletePersonById(zhangSan.id);

		await page.goto(`/persons/${zhangSan.id}/edit`);
		await expect(page.getByRole("main").getByRole("alert")).toHaveText(
			NOT_FOUND_MESSAGE
		);
		await expect(getForm(page).name).toHaveCount(0);
		await page.getByRole("link", { exact: true, name: "返回列表" }).click();
		await expect(page).toHaveURL(PERSONS_URL);
		await expect(getList(page).empty).toBeVisible();
	});

	test("编辑页打开后人员被删除，再提交显示「该人员不存在或已被删除」", async ({
		page,
	}) => {
		const [zhangSan] = await seedPersons([ZHANG_SAN]);
		if (!zhangSan) {
			throw new Error("预置张三失败");
		}
		const form = await openEdit(page, zhangSan);
		await deletePersonById(zhangSan.id);
		await form.name.fill("张三丰");
		await form.submit.click();

		await expect(page.getByRole("main").getByRole("alert")).toHaveText(
			NOT_FOUND_MESSAGE
		);
		await expect(
			page.getByRole("link", { exact: true, name: "返回列表" })
		).toBeVisible();
		await expect(toast(page, "已保存")).toHaveCount(0);
		await expect(page).toHaveURL(EDIT_PERSON_URL);
		expect(await countPersons()).toBe(0);
	});

	test("列表打开后人员被删除，再确认删除时 toast「该人员不存在或已被删除」并刷新列表", async ({
		page,
	}) => {
		const [zhangSan] = await seedPersons([ZHANG_SAN, LI_SI]);
		if (!zhangSan) {
			throw new Error("预置张三失败");
		}
		const list = await openList(page);
		await expect(list.rows).toHaveCount(2);

		await page
			.getByRole("button", { name: actionName("删除", personLabel(ZHANG_SAN)) })
			.click();
		const dialog = page.getByRole("alertdialog");
		await expect(dialog).toBeVisible();
		await deletePersonById(zhangSan.id);
		await dialog.getByRole("button", { exact: true, name: "确定删除" }).click();

		await expect(toast(page, NOT_FOUND_MESSAGE)).toBeVisible();
		await expect(toast(page, "已删除")).toHaveCount(0);
		await expect(dialog).toHaveCount(0);
		await expect(list.rows).toHaveCount(1);
		await expect(rowOf(list, "B002")).toHaveCount(1);
		await expectPageInfo(list, "第 1 / 1 页，共 1 条");
	});

	test("只用键盘完成搜索、筛选、翻页和删除确认", async ({ page }) => {
		await seedPersons(
			buildPersonSeeds(PAGE_SIZE + 2, (index) =>
				index === 0 ? { status: "INACTIVE" } : {}
			)
		);
		const list = await openList(page);
		await expectPageInfo(list, "第 1 / 2 页，共 22 条");

		// 搜索：Tab 到搜索框，输入后回车
		await tabUntilFocused(page, list.keyword);
		await page.keyboard.type("人员");
		await page.keyboard.press("Enter");
		await expectPageInfo(list, "第 1 / 2 页，共 22 条");

		// 筛选：Tab 到状态下拉，打开后用方向键选「离职」
		await tabUntilFocused(page, list.status);
		await page.keyboard.press("Enter");
		const inactiveOption = page.getByRole("option", {
			exact: true,
			name: "离职",
		});
		await pressUntilFocused(page, inactiveOption, "ArrowDown");
		await page.keyboard.press("Enter");
		await expect(selectedValue(list.status)).toHaveText("离职");
		await expectPageInfo(list, "第 1 / 1 页，共 1 条");

		// 恢复「全部」
		await expect(list.status).toBeFocused();
		await page.keyboard.press("Enter");
		const allOption = page.getByRole("option", { exact: true, name: "全部" });
		await pressUntilFocused(page, allOption, "ArrowUp");
		await page.keyboard.press("Enter");
		await expect(selectedValue(list.status)).toHaveText("全部");
		await expectPageInfo(list, "第 1 / 2 页，共 22 条");

		// 翻页：表格每行有两个可聚焦元素，从状态下拉反向 Tab（经页面末尾）更快到达分页按钮
		await pressUntilFocused(page, list.next, "Shift+Tab");
		await page.keyboard.press("Enter");
		await expectPageInfo(list, "第 2 / 2 页，共 22 条");
		await expect(list.next).toBeFocused();
		await pressUntilFocused(page, list.previous, "Shift+Tab");
		await page.keyboard.press("Enter");
		await expectPageInfo(list, "第 1 / 2 页，共 22 条");
		await page.keyboard.press("Tab");
		await expect(list.next).toBeFocused();
		await page.keyboard.press("Enter");
		await expectPageInfo(list, "第 2 / 2 页，共 22 条");

		// 删除确认：Tab 到删除按钮，Enter 打开对话框，Tab 到「确定删除」后回车
		const deleteButton = page.getByRole("button", {
			name: actionName("删除", "人员22（E022）"),
		});
		await pressUntilFocused(page, deleteButton, "Shift+Tab");
		await page.keyboard.press("Enter");
		const dialog = page.getByRole("alertdialog");
		await expect(dialog).toBeVisible();
		const confirm = dialog.getByRole("button", {
			exact: true,
			name: "确定删除",
		});
		await tabUntilFocused(page, confirm);
		await page.keyboard.press("Enter");
		await expect(toast(page, "已删除")).toBeVisible();
		await expect(dialog).toHaveCount(0);
		await expectPageInfo(list, "第 2 / 2 页，共 21 条");
		expect(await findPersonByEmployeeNo("E022")).toBeNull();
	});

	test("只用键盘完成编辑和新增", async ({ page }) => {
		await seedPersons([ZHANG_SAN]);
		const list = await openList(page);

		// 编辑：Tab 到「编辑」链接回车，改姓名后回车提交
		const editLink = page.getByRole("link", {
			name: actionName("编辑", personLabel(ZHANG_SAN)),
		});
		await tabUntilFocused(page, editLink);
		await page.keyboard.press("Enter");
		await expect(page).toHaveURL(EDIT_PERSON_URL);
		const form = getForm(page);
		await expect(form.name).toHaveValue("张三");
		await tabUntilFocused(page, form.name);
		await page.keyboard.press("ControlOrMeta+a");
		await page.keyboard.type("张三丰");
		await page.keyboard.press("Enter");
		await expect(toast(page, "已保存")).toBeVisible();
		await expect(page).toHaveURL(PERSONS_URL);
		await expect(rowOf(list, "A001")).toContainText("张三丰");

		// 新增：重新打开列表（不带上一次的提示），Tab 到「新增人员」回车，填写必填项后 Tab 到「保存」回车
		await openList(page);
		await tabUntilFocused(page, list.newPerson);
		await page.keyboard.press("Enter");
		await expect(page).toHaveURL(NEW_PERSON_URL);
		await tabUntilFocused(page, form.name);
		await page.keyboard.type("王五");
		await page.keyboard.press("Tab");
		await expect(form.employeeNo).toBeFocused();
		await page.keyboard.type("c003");
		await tabUntilFocused(page, form.submit);
		await page.keyboard.press("Enter");
		await expect(toast(page, "已保存")).toBeVisible();
		await expect(page).toHaveURL(PERSONS_URL);
		await expect(list.rows.first()).toContainText("C003");
		expect(await findPersonByEmployeeNo("C003")).toMatchObject({
			name: "王五",
			status: "ACTIVE",
		});
	});

	for (const colorScheme of ["light", "dark"] as const) {
		test(`375px 宽、${colorScheme} 主题下 /persons 与 /persons/new 无横向滚动，表格在自身容器内横向滚动`, async ({
			page,
		}) => {
			await page.setViewportSize(NARROW_VIEWPORT);
			await page.emulateMedia({ colorScheme });
			await seedPersons([
				{
					department: "部".repeat(50),
					email: `${"e".repeat(40)}@example.com`,
					employeeNo: `L${"0".repeat(31)}`,
					name: "长".repeat(50),
					phone: "13812345678",
					position: "职".repeat(50),
				},
				ZHANG_SAN,
			]);

			const list = await openList(page);
			await expect(page.locator("html")).toHaveClass(new RegExp(colorScheme));
			await expect(list.rows).toHaveCount(2);
			expect(await getScrollWidth(page)).toBeLessThanOrEqual(
				NARROW_VIEWPORT.width
			);
			const container = list.tableContainer;
			await expect(container).toHaveCSS("overflow-x", "auto");
			const { clientWidth, scrollWidth } = await container.evaluate(
				(element) => ({
					clientWidth: element.clientWidth,
					scrollWidth: element.scrollWidth,
				})
			);
			expect(scrollWidth).toBeGreaterThan(clientWidth);

			await page.goto("/persons/new");
			const form = getForm(page);
			await expect(form.name).toBeVisible();
			// 显示字段错误后再检查一次
			await form.submit.click();
			await expect(page.locator("#name-error")).toBeVisible();
			expect(await getScrollWidth(page)).toBeLessThanOrEqual(
				NARROW_VIEWPORT.width
			);
		});
	}
});
