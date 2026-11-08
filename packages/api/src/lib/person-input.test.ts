import { describe, expect, it } from "vitest";

import {
	PERSON_DEPARTMENT_MAX_LENGTH,
	PERSON_LIST_DEFAULT_PAGE,
	PERSON_LIST_DEFAULT_PAGE_SIZE,
	PERSON_LIST_MAX_PAGE_SIZE,
	PERSON_NAME_MAX_LENGTH,
	PERSON_POSITION_MAX_LENGTH,
	PERSON_REMARK_MAX_LENGTH,
	personInputSchema,
	personListInputSchema,
} from "./person-input";

const validInput = {
	department: null,
	email: null,
	employeeNo: "A001",
	name: "张三",
	phone: null,
	position: null,
	remark: null,
	status: "ACTIVE",
};

const parseInput = (overrides: Record<string, unknown>) =>
	personInputSchema.safeParse({ ...validInput, ...overrides });

const OPTIONAL_FIELDS = [
	"department",
	"email",
	"phone",
	"position",
	"remark",
] as const;

describe("personInputSchema", () => {
	it("accepts the minimal input and keeps it as is", () => {
		expect(personInputSchema.parse(validInput)).toEqual(validInput);
	});

	describe("name", () => {
		it.each([
			["empty", ""],
			["only spaces", "   "],
			[
				`${PERSON_NAME_MAX_LENGTH + 1} characters`,
				"a".repeat(PERSON_NAME_MAX_LENGTH + 1),
			],
		])("rejects a name that is %s", (_label, name) => {
			expect(parseInput({ name }).success).toBe(false);
		});

		it(`accepts ${PERSON_NAME_MAX_LENGTH} characters and trims surrounding spaces`, () => {
			const name = "名".repeat(PERSON_NAME_MAX_LENGTH);
			const result = parseInput({ name: `  ${name}  ` });

			expect(result.success).toBe(true);
			expect(result.data?.name).toBe(name);
		});

		it("rejects a missing name", () => {
			expect(parseInput({ name: undefined }).success).toBe(false);
		});
	});

	describe("employeeNo", () => {
		it.each([
			["a", "a"],
			["33 characters", "A".repeat(33)],
			["A 001", "A 001"],
			["工号1", "工号1"],
			["A_001", "A_001"],
			["empty", ""],
		])("rejects %s", (_label, employeeNo) => {
			expect(parseInput({ employeeNo }).success).toBe(false);
		});

		it("accepts 2 and 32 characters", () => {
			expect(parseInput({ employeeNo: "A1" }).success).toBe(true);
			expect(parseInput({ employeeNo: "A".repeat(32) }).success).toBe(true);
		});

		it("trims and upper-cases the employee number", () => {
			expect(parseInput({ employeeNo: " a-001 " }).data?.employeeNo).toBe(
				"A-001"
			);
		});
	});

	describe("phone", () => {
		it.each([
			["10 digits", "1381234567"],
			["second digit 2", "12812345678"],
			["not starting with 1", "23812345678"],
			["12 digits", "138123456789"],
		])("rejects %s", (_label, phone) => {
			expect(parseInput({ phone }).success).toBe(false);
		});

		it("accepts a valid mobile number and trims it", () => {
			expect(parseInput({ phone: "13812345678" }).data?.phone).toBe(
				"13812345678"
			);
			expect(parseInput({ phone: " 13812345678 " }).data?.phone).toBe(
				"13812345678"
			);
		});
	});

	describe("email", () => {
		it.each(["abc", "a@b"])("rejects %s", (email) => {
			expect(parseInput({ email }).success).toBe(false);
		});

		it("trims and lower-cases the email", () => {
			expect(parseInput({ email: " Tom@Example.COM " }).data?.email).toBe(
				"tom@example.com"
			);
		});
	});

	describe("text length limits", () => {
		it.each([
			["department", PERSON_DEPARTMENT_MAX_LENGTH],
			["position", PERSON_POSITION_MAX_LENGTH],
			["remark", PERSON_REMARK_MAX_LENGTH],
		])("limits %s to %i characters", (field, maxLength) => {
			expect(parseInput({ [field]: "a".repeat(maxLength) }).success).toBe(true);
			expect(parseInput({ [field]: "a".repeat(maxLength + 1) }).success).toBe(
				false
			);
		});

		it("measures the length after trimming", () => {
			const remark = "a".repeat(PERSON_REMARK_MAX_LENGTH);
			expect(parseInput({ remark: `  ${remark}  ` }).data?.remark).toBe(remark);
		});
	});

	describe("optional fields", () => {
		it.each(
			OPTIONAL_FIELDS.flatMap((field) =>
				["", "  ", null, undefined].map((value) => [field, value] as const)
			)
		)("normalizes %s %j to null", (field, value) => {
			const result = parseInput({ [field]: value });

			expect(result.success).toBe(true);
			expect(result.data?.[field]).toBeNull();
		});

		it("normalizes every omitted optional field to null", () => {
			expect(
				personInputSchema.parse({
					employeeNo: "A001",
					name: "张三",
					status: "INACTIVE",
				})
			).toEqual({ ...validInput, status: "INACTIVE" });
		});
	});

	describe("status", () => {
		it.each(["ACTIVE", "INACTIVE"])("accepts %s", (status) => {
			expect(parseInput({ status }).data?.status).toBe(status);
		});

		it.each([
			["missing", undefined],
			["lower case", "active"],
			["unknown", "RETIRED"],
			["empty", ""],
		])("rejects a %s status", (_label, status) => {
			expect(parseInput({ status }).success).toBe(false);
		});
	});
});

describe("personListInputSchema", () => {
	it("defaults page and pageSize", () => {
		expect(personListInputSchema.parse({})).toEqual({
			keyword: undefined,
			page: PERSON_LIST_DEFAULT_PAGE,
			pageSize: PERSON_LIST_DEFAULT_PAGE_SIZE,
			status: undefined,
		});
		expect(PERSON_LIST_DEFAULT_PAGE).toBe(1);
		expect(PERSON_LIST_DEFAULT_PAGE_SIZE).toBe(20);
	});

	it.each([0, -1, 1.5])("rejects page %d", (page) => {
		expect(personListInputSchema.safeParse({ page }).success).toBe(false);
	});

	it("accepts pageSize up to the maximum", () => {
		expect(
			personListInputSchema.parse({ pageSize: PERSON_LIST_MAX_PAGE_SIZE })
				.pageSize
		).toBe(100);
	});

	it.each([0, PERSON_LIST_MAX_PAGE_SIZE + 1])(
		"rejects pageSize %d",
		(pageSize) => {
			expect(personListInputSchema.safeParse({ pageSize }).success).toBe(false);
		}
	);

	it.each(["", "   "])("treats keyword %j as no filter", (keyword) => {
		expect(personListInputSchema.parse({ keyword }).keyword).toBeUndefined();
	});

	it("trims the keyword", () => {
		expect(personListInputSchema.parse({ keyword: "  a001 " }).keyword).toBe(
			"a001"
		);
	});

	it("accepts a status filter and rejects an unknown one", () => {
		expect(personListInputSchema.parse({ status: "INACTIVE" }).status).toBe(
			"INACTIVE"
		);
		expect(personListInputSchema.safeParse({ status: "ALL" }).success).toBe(
			false
		);
	});
});
