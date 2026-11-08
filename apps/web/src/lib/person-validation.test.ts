import {
	personInputSchema,
	EMPLOYEE_NO_PATTERN as SERVER_EMPLOYEE_NO_PATTERN,
	PERSON_DEPARTMENT_MAX_LENGTH as SERVER_PERSON_DEPARTMENT_MAX_LENGTH,
	PERSON_EMAIL_MAX_LENGTH as SERVER_PERSON_EMAIL_MAX_LENGTH,
	PERSON_KEYWORD_MAX_LENGTH as SERVER_PERSON_KEYWORD_MAX_LENGTH,
	PERSON_LIST_DEFAULT_PAGE_SIZE as SERVER_PERSON_LIST_DEFAULT_PAGE_SIZE,
	PERSON_NAME_MAX_LENGTH as SERVER_PERSON_NAME_MAX_LENGTH,
	PERSON_POSITION_MAX_LENGTH as SERVER_PERSON_POSITION_MAX_LENGTH,
	PERSON_REMARK_MAX_LENGTH as SERVER_PERSON_REMARK_MAX_LENGTH,
	PERSON_STATUSES as SERVER_PERSON_STATUSES,
	PHONE_PATTERN as SERVER_PHONE_PATTERN,
} from "@zyk-dyna-admin/api/lib/person-input";
import { describe, expect, it } from "vitest";

import {
	DEFAULT_PERSON_STATUS,
	EMPLOYEE_NO_PATTERN,
	EMPTY_PERSON_FORM_VALUES,
	PERSON_DEPARTMENT_MAX_LENGTH,
	PERSON_EMAIL_MAX_LENGTH,
	PERSON_KEYWORD_MAX_LENGTH,
	PERSON_LIST_PAGE_SIZE,
	PERSON_NAME_MAX_LENGTH,
	PERSON_POSITION_MAX_LENGTH,
	PERSON_REMARK_MAX_LENGTH,
	PERSON_STATUS_OPTIONS,
	PERSON_STATUSES,
	PERSON_VALIDATION_MESSAGES,
	type PersonFormValues,
	PHONE_PATTERN,
	personDepartmentSchema,
	personEmailSchema,
	personEmployeeNoSchema,
	personFormSchema,
	personNameSchema,
	personPhoneSchema,
	personPositionSchema,
	personRemarkSchema,
	personStatusSchema,
	toPersonFormValues,
	toPersonInput,
} from "@/lib/person-validation";

const messages = PERSON_VALIDATION_MESSAGES;

const VALID_FORM_VALUES: PersonFormValues = {
	...EMPTY_PERSON_FORM_VALUES,
	employeeNo: "A001",
	name: "张三",
};

const formValues = (
	overrides: Partial<PersonFormValues>
): PersonFormValues => ({
	...VALID_FORM_VALUES,
	...overrides,
});

/** 取第一条错误文案；校验通过时返回 undefined */
const firstError = (
	schema: {
		safeParse: (value: unknown) => {
			error?: { issues: { message: string }[] };
		};
	},
	value: unknown
): string | undefined => schema.safeParse(value).error?.issues[0]?.message;

/**
 * 与 packages/api 的 person-input.test.ts（任务 7.1）同一组用例。
 * 表单输入框只产生字符串，所以选填字段的 `null` / `undefined` 用例在前端对应为空串，
 * 由 toPersonInput() 统一转成 null。
 */
const SHARED_CASES: readonly [label: string, values: PersonFormValues][] = [
	["只填必填项", VALID_FORM_VALUES],
	[
		"全部字段",
		formValues({
			department: " 研发部 ",
			email: " Tom@Example.COM ",
			employeeNo: " a-001 ",
			name: "  李四  ",
			phone: " 13812345678 ",
			position: "工程师",
			remark: "备注",
			status: "INACTIVE",
		}),
	],
	["姓名为空串", formValues({ name: "" })],
	["姓名只有空格", formValues({ name: "   " })],
	[
		`姓名 ${PERSON_NAME_MAX_LENGTH + 1} 个字符`,
		formValues({ name: "a".repeat(PERSON_NAME_MAX_LENGTH + 1) }),
	],
	[
		`姓名 ${PERSON_NAME_MAX_LENGTH} 个字符（含首尾空格）`,
		formValues({ name: `  ${"名".repeat(PERSON_NAME_MAX_LENGTH)}  ` }),
	],
	["工号 a", formValues({ employeeNo: "a" })],
	["工号 33 位", formValues({ employeeNo: "A".repeat(33) })],
	["工号 32 位", formValues({ employeeNo: "A".repeat(32) })],
	["工号 A1", formValues({ employeeNo: "A1" })],
	["工号含空格", formValues({ employeeNo: "A 001" })],
	["工号含中文", formValues({ employeeNo: "工号1" })],
	["工号含下划线", formValues({ employeeNo: "A_001" })],
	["工号为空", formValues({ employeeNo: "" })],
	["工号小写带空格", formValues({ employeeNo: " a-001 " })],
	["手机号 10 位", formValues({ phone: "1381234567" })],
	["手机号第二位为 2", formValues({ phone: "12812345678" })],
	["手机号不以 1 开头", formValues({ phone: "23812345678" })],
	["手机号 12 位", formValues({ phone: "138123456789" })],
	["手机号合法", formValues({ phone: "13812345678" })],
	["邮箱 abc", formValues({ email: "abc" })],
	["邮箱 a@b", formValues({ email: "a@b" })],
	["邮箱大小写带空格", formValues({ email: " Tom@Example.COM " })],
	[
		`部门 ${PERSON_DEPARTMENT_MAX_LENGTH + 1} 个字符`,
		formValues({ department: "a".repeat(PERSON_DEPARTMENT_MAX_LENGTH + 1) }),
	],
	[
		`职位 ${PERSON_POSITION_MAX_LENGTH + 1} 个字符`,
		formValues({ position: "a".repeat(PERSON_POSITION_MAX_LENGTH + 1) }),
	],
	[
		`备注 ${PERSON_REMARK_MAX_LENGTH + 1} 个字符`,
		formValues({ remark: "a".repeat(PERSON_REMARK_MAX_LENGTH + 1) }),
	],
	[
		`备注 ${PERSON_REMARK_MAX_LENGTH} 个字符（含首尾空格）`,
		formValues({ remark: `  ${"a".repeat(PERSON_REMARK_MAX_LENGTH)}  ` }),
	],
	[
		"选填字段只有空格",
		formValues({
			department: "  ",
			email: "  ",
			phone: "  ",
			position: "  ",
			remark: "  ",
		}),
	],
];

describe("前后端规则一致", () => {
	it("正则的 source 和 flags 与服务端一致", () => {
		expect(EMPLOYEE_NO_PATTERN.source).toBe(SERVER_EMPLOYEE_NO_PATTERN.source);
		expect(EMPLOYEE_NO_PATTERN.flags).toBe(SERVER_EMPLOYEE_NO_PATTERN.flags);
		expect(PHONE_PATTERN.source).toBe(SERVER_PHONE_PATTERN.source);
		expect(PHONE_PATTERN.flags).toBe(SERVER_PHONE_PATTERN.flags);
	});

	it("长度常量、状态与列表参数与服务端一致", () => {
		expect({
			department: PERSON_DEPARTMENT_MAX_LENGTH,
			email: PERSON_EMAIL_MAX_LENGTH,
			keyword: PERSON_KEYWORD_MAX_LENGTH,
			name: PERSON_NAME_MAX_LENGTH,
			pageSize: PERSON_LIST_PAGE_SIZE,
			position: PERSON_POSITION_MAX_LENGTH,
			remark: PERSON_REMARK_MAX_LENGTH,
		}).toEqual({
			department: SERVER_PERSON_DEPARTMENT_MAX_LENGTH,
			email: SERVER_PERSON_EMAIL_MAX_LENGTH,
			keyword: SERVER_PERSON_KEYWORD_MAX_LENGTH,
			name: SERVER_PERSON_NAME_MAX_LENGTH,
			pageSize: SERVER_PERSON_LIST_DEFAULT_PAGE_SIZE,
			position: SERVER_PERSON_POSITION_MAX_LENGTH,
			remark: SERVER_PERSON_REMARK_MAX_LENGTH,
		});
		expect(PERSON_STATUSES).toEqual(SERVER_PERSON_STATUSES);
	});

	it.each(SHARED_CASES)(
		"%s：前端 personFormSchema 与服务端 personInputSchema 结果一致",
		(_label, values) => {
			const client = personFormSchema.safeParse(values);
			const server = personInputSchema.safeParse(values);

			expect(client.success).toBe(server.success);
			expect(client.data).toEqual(server.data);
		}
	);

	it.each(SHARED_CASES)(
		"%s：校验通过时 toPersonInput() 与两端解析结果一致",
		(_label, values) => {
			const client = personFormSchema.safeParse(values);
			if (!client.success) {
				return;
			}
			const input = toPersonInput(values);

			expect(input).toEqual(client.data);
			expect(personInputSchema.parse(input)).toEqual(input);
		}
	);

	it("前后端对同一组用例有通过也有拒绝（用例本身有效）", () => {
		const results = SHARED_CASES.map(
			([, values]) => personFormSchema.safeParse(values).success
		);

		expect(results).toContain(true);
		expect(results).toContain(false);
	});
});

describe("字段校验与中文文案", () => {
	describe("姓名", () => {
		it.each([
			["", messages.nameRequired],
			["   ", messages.nameRequired],
			["a".repeat(PERSON_NAME_MAX_LENGTH + 1), "姓名不能超过 50 个字符"],
		])("%j → %s", (value, message) => {
			expect(firstError(personNameSchema, value)).toBe(message);
		});

		it("最多 50 个字符，去掉首尾空格", () => {
			const name = "名".repeat(PERSON_NAME_MAX_LENGTH);

			expect(personNameSchema.parse(`  ${name}  `)).toBe(name);
		});

		it("文案", () => {
			expect(messages.nameRequired).toBe("请输入姓名");
		});
	});

	describe("工号", () => {
		it.each(["", "   "])("%j → 请输入工号", (value) => {
			expect(firstError(personEmployeeNoSchema, value)).toBe("请输入工号");
		});

		it.each(["a", "A".repeat(33), "A 001", "工号1", "A_001"])(
			"%j → 工号为 2–32 位字母、数字或连字符",
			(value) => {
				expect(firstError(personEmployeeNoSchema, value)).toBe(
					"工号为 2–32 位字母、数字或连字符"
				);
			}
		);

		it("trim 后转大写", () => {
			expect(personEmployeeNoSchema.parse(" a-001 ")).toBe("A-001");
		});
	});

	describe("手机号", () => {
		it.each(["1381234567", "12812345678", "23812345678", "138123456789"])(
			"%j → 请输入正确的 11 位手机号",
			(value) => {
				expect(firstError(personPhoneSchema, value)).toBe(
					"请输入正确的 11 位手机号"
				);
			}
		);

		it("合法手机号 trim 后通过", () => {
			expect(personPhoneSchema.parse(" 13812345678 ")).toBe("13812345678");
		});
	});

	describe("邮箱", () => {
		it.each(["abc", "a@b"])("%j → 邮箱格式不正确", (value) => {
			expect(firstError(personEmailSchema, value)).toBe("邮箱格式不正确");
		});

		it("trim 后转小写", () => {
			expect(personEmailSchema.parse(" Tom@Example.COM ")).toBe(
				"tom@example.com"
			);
		});
	});

	describe("部门 / 职位 / 备注长度", () => {
		it.each([
			[
				"部门",
				personDepartmentSchema,
				PERSON_DEPARTMENT_MAX_LENGTH,
				"部门不能超过 50 个字符",
			],
			[
				"职位",
				personPositionSchema,
				PERSON_POSITION_MAX_LENGTH,
				"职位不能超过 50 个字符",
			],
			[
				"备注",
				personRemarkSchema,
				PERSON_REMARK_MAX_LENGTH,
				"备注不能超过 500 个字符",
			],
		] as const)(
			"%s最多 %i 个字符，超出提示「%s」",
			(_label, schema, maxLength, message) => {
				expect(schema.parse("a".repeat(maxLength))).toBe("a".repeat(maxLength));
				expect(firstError(schema, "a".repeat(maxLength + 1))).toBe(message);
			}
		);
	});

	describe("选填字段", () => {
		it.each([
			["手机号", personPhoneSchema],
			["邮箱", personEmailSchema],
			["部门", personDepartmentSchema],
			["职位", personPositionSchema],
			["备注", personRemarkSchema],
		] as const)("%s 的空串和空白都解析为 null", (_label, schema) => {
			expect(schema.parse("")).toBeNull();
			expect(schema.parse("   ")).toBeNull();
		});
	});

	describe("状态", () => {
		it.each(["ACTIVE", "INACTIVE"])("接受 %s", (value) => {
			expect(personStatusSchema.parse(value)).toBe(value);
		});

		it.each([undefined, "", "active", "RETIRED"])(
			"%j → 请选择状态",
			(value) => {
				expect(firstError(personStatusSchema, value)).toBe("请选择状态");
			}
		);
	});
});

describe("状态选项与默认值", () => {
	it("在职 / 离职，顺序固定", () => {
		expect(PERSON_STATUS_OPTIONS).toEqual([
			{ label: "在职", value: "ACTIVE" },
			{ label: "离职", value: "INACTIVE" },
		]);
	});

	it("新增表单默认在职、其他字段为空串", () => {
		expect(DEFAULT_PERSON_STATUS).toBe("ACTIVE");
		expect(EMPTY_PERSON_FORM_VALUES).toEqual({
			department: "",
			email: "",
			employeeNo: "",
			name: "",
			phone: "",
			position: "",
			remark: "",
			status: "ACTIVE",
		});
	});
});

describe("toPersonInput", () => {
	it("trim、工号转大写、邮箱转小写、选填空值转 null", () => {
		expect(
			toPersonInput(
				formValues({
					department: "  ",
					email: " Tom@Example.COM ",
					employeeNo: " a-001 ",
					name: " 张三 ",
					phone: "",
					position: " 工程师 ",
					remark: "",
					status: "INACTIVE",
				})
			)
		).toEqual({
			department: null,
			email: "tom@example.com",
			employeeNo: "A-001",
			name: "张三",
			phone: null,
			position: "工程师",
			remark: null,
			status: "INACTIVE",
		});
	});
});

describe("toPersonFormValues", () => {
	it("null 回填为空串，其余原样回填", () => {
		expect(
			toPersonFormValues({
				department: null,
				email: "tom@example.com",
				employeeNo: "A001",
				name: "张三",
				phone: null,
				position: "工程师",
				remark: null,
				status: "INACTIVE",
			})
		).toEqual({
			department: "",
			email: "tom@example.com",
			employeeNo: "A001",
			name: "张三",
			phone: "",
			position: "工程师",
			remark: "",
			status: "INACTIVE",
		});
	});

	it("回填后再转成入参与原数据一致", () => {
		const person = {
			department: "研发部",
			email: null,
			employeeNo: "B-002",
			name: "李四",
			phone: "13812345678",
			position: null,
			remark: "备注",
			status: "ACTIVE",
		} as const;

		expect(toPersonInput(toPersonFormValues(person))).toEqual(person);
	});
});
