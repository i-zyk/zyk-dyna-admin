import { describe, expect, it } from "vitest";

import {
	formatJoinedDate,
	normalizeBlogUrl,
} from "@/lib/github-profile-format";

describe("formatJoinedDate", () => {
	it("把 ISO 时间格式化为 UTC 日期", () => {
		expect(formatJoinedDate("2011-09-03T15:26:22Z")).toBe("2011-09-03");
	});

	it("按 UTC 取日期，不受时区偏移影响", () => {
		expect(formatJoinedDate("2011-09-03T23:30:00-02:00")).toBe("2011-09-04");
	});

	it.each(["", "not-a-date"])("无法解析的 %j 返回 null", (input) => {
		expect(formatJoinedDate(input)).toBeNull();
	});
});

describe("normalizeBlogUrl", () => {
	it.each([
		["", null],
		["   ", null],
		["example.com", "https://example.com/"],
		["https://a.dev", "https://a.dev/"],
		["http://a.dev/blog", "http://a.dev/blog"],
		["  example.com/path  ", "https://example.com/path"],
		["localhost:8080", "https://localhost:8080/"],
		["//example.com", "https://example.com/"],
	])("%j 转为 %j", (input, expected) => {
		expect(normalizeBlogUrl(input)).toBe(expected);
	});

	it.each([
		"javascript:alert(1)",
		"JavaScript:alert(1)",
		"data:text/html,<script>alert(1)</script>",
		"mailto:a@example.com",
		"ftp://example.com",
	])("不安全或非 http(s) 协议 %j 返回 null", (input) => {
		expect(normalizeBlogUrl(input)).toBeNull();
	});
});
