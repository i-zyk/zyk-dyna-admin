import { describe, expect, it } from "vitest";

import {
	displayPersonValue,
	EMPTY_PERSON_VALUE,
	formatPersonDateTime,
	getTotalPages,
} from "@/lib/person-format";

const DATE_TIME_PATTERN = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/;

describe("formatPersonDateTime", () => {
	// 用本地时间构造，结果与运行环境的时区无关
	const localDate = new Date(2026, 0, 5, 8, 7, 59);

	it("Date 按本地时区输出 YYYY-MM-DD HH:mm（补零、不含秒）", () => {
		expect(formatPersonDateTime(localDate)).toBe("2026-01-05 08:07");
	});

	it("ISO 字符串（接口返回的格式）与对应的 Date 输出一致", () => {
		expect(formatPersonDateTime(localDate.toISOString())).toBe(
			"2026-01-05 08:07"
		);
	});

	it("两位数的月、日、时、分不额外补零", () => {
		expect(formatPersonDateTime(new Date(2026, 10, 28, 23, 59))).toBe(
			"2026-11-28 23:59"
		);
	});

	it("输出格式固定为 YYYY-MM-DD HH:mm", () => {
		expect(formatPersonDateTime("2026-11-08T03:43:46.123Z")).toMatch(
			DATE_TIME_PATTERN
		);
	});

	it.each([
		["null", null],
		["undefined", undefined],
		["空串", ""],
		["无法解析的字符串", "not-a-date"],
		["Invalid Date", new Date(Number.NaN)],
	])("%s 返回 -", (_label, value) => {
		expect(formatPersonDateTime(value)).toBe("-");
	});
});

describe("displayPersonValue", () => {
	it.each([
		["null", null],
		["undefined", undefined],
		["空串", ""],
		["只有空白", "  "],
	])("%s 显示为 -", (_label, value) => {
		expect(displayPersonValue(value)).toBe("-");
	});

	it("有值时原样显示", () => {
		expect(displayPersonValue("研发部")).toBe("研发部");
		expect(displayPersonValue("0")).toBe("0");
	});

	it("占位符为 -", () => {
		expect(EMPTY_PERSON_VALUE).toBe("-");
	});
});

describe("getTotalPages", () => {
	it.each([
		[0, 20, 1],
		[1, 20, 1],
		[20, 20, 1],
		[21, 20, 2],
		[40, 20, 2],
		[41, 20, 3],
		[100, 100, 1],
	])("getTotalPages(%i, %i) = %i", (total, pageSize, pages) => {
		expect(getTotalPages(total, pageSize)).toBe(pages);
	});

	it.each([
		[20, 0],
		[20, -1],
		[-5, 20],
	])("total=%i、pageSize=%i 不合法时按 1 页处理", (total, pageSize) => {
		expect(getTotalPages(total, pageSize)).toBe(1);
	});
});
