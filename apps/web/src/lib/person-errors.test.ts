import { describe, expect, it } from "vitest";

import {
	getPersonDeleteErrorMessage,
	getPersonLoadErrorMessage,
	getPersonSaveError,
	isPersonNotFound,
	PERSON_DELETE_FALLBACK_MESSAGE,
	PERSON_EMPLOYEE_NO_CONFLICT_MESSAGE,
	PERSON_LOAD_FALLBACK_MESSAGE,
	PERSON_NOT_FOUND_MESSAGE,
	PERSON_SAVE_FALLBACK_MESSAGE,
} from "@/lib/person-errors";

/** 提示全部为中文：不夹带错误码、Prisma 或数据库的英文原始信息 */
const RAW_ERROR_HINT = /[A-Za-z]/;

const OTHER_CODES = [
	"INTERNAL_SERVER_ERROR",
	"BAD_REQUEST",
	"UNAUTHORIZED",
	undefined,
] as const;

describe("文案", () => {
	it("与需求一致", () => {
		expect(PERSON_EMPLOYEE_NO_CONFLICT_MESSAGE).toBe("工号已存在");
		expect(PERSON_NOT_FOUND_MESSAGE).toBe("该人员不存在或已被删除");
		expect(PERSON_SAVE_FALLBACK_MESSAGE).toBe("保存失败，请稍后再试");
		expect(PERSON_DELETE_FALLBACK_MESSAGE).toBe("删除失败，请稍后再试");
		expect(PERSON_LOAD_FALLBACK_MESSAGE).toBe("加载失败，请稍后再试");
	});

	it("不包含错误码或数据库原始信息", () => {
		for (const message of [
			PERSON_EMPLOYEE_NO_CONFLICT_MESSAGE,
			PERSON_NOT_FOUND_MESSAGE,
			PERSON_SAVE_FALLBACK_MESSAGE,
			PERSON_DELETE_FALLBACK_MESSAGE,
			PERSON_LOAD_FALLBACK_MESSAGE,
		]) {
			expect(message).not.toMatch(RAW_ERROR_HINT);
		}
	});
});

describe("getPersonSaveError", () => {
	it("CONFLICT → 工号字段下方显示「工号已存在」", () => {
		expect(getPersonSaveError("CONFLICT")).toEqual({
			message: "工号已存在",
			type: "employeeNoConflict",
		});
	});

	it("NOT_FOUND → 切换为「该人员不存在或已被删除」", () => {
		expect(getPersonSaveError("NOT_FOUND")).toEqual({
			message: "该人员不存在或已被删除",
			type: "notFound",
		});
	});

	it.each(OTHER_CODES)("%s → toast「保存失败，请稍后再试」", (code) => {
		expect(getPersonSaveError(code)).toEqual({
			message: "保存失败，请稍后再试",
			type: "unknown",
		});
	});
});

describe("getPersonDeleteErrorMessage", () => {
	it("NOT_FOUND → 该人员不存在或已被删除", () => {
		expect(getPersonDeleteErrorMessage("NOT_FOUND")).toBe(
			"该人员不存在或已被删除"
		);
	});

	it.each(["CONFLICT", ...OTHER_CODES])("%s → 删除失败，请稍后再试", (code) => {
		expect(getPersonDeleteErrorMessage(code)).toBe("删除失败，请稍后再试");
	});
});

describe("getPersonLoadErrorMessage", () => {
	it("NOT_FOUND → 该人员不存在或已被删除", () => {
		expect(getPersonLoadErrorMessage("NOT_FOUND")).toBe(
			"该人员不存在或已被删除"
		);
	});

	it.each(OTHER_CODES)("%s → 加载失败，请稍后再试", (code) => {
		expect(getPersonLoadErrorMessage(code)).toBe("加载失败，请稍后再试");
	});
});

describe("isPersonNotFound", () => {
	it("只有 NOT_FOUND 返回 true", () => {
		expect(isPersonNotFound("NOT_FOUND")).toBe(true);
		for (const code of ["CONFLICT", ...OTHER_CODES]) {
			expect(isPersonNotFound(code)).toBe(false);
		}
	});
});
