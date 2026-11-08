import { TRPCClientError } from "@trpc/client";
import { describe, expect, it } from "vitest";

import { getTrpcErrorCode } from "./trpc-errors";

const CONFLICT_JSON_RPC_CODE = -32_009;
const CONFLICT_HTTP_STATUS = 409;

describe("getTrpcErrorCode", () => {
	it("返回服务端 TRPCError 的错误码", () => {
		const error = TRPCClientError.from({
			error: {
				code: CONFLICT_JSON_RPC_CODE,
				data: { code: "CONFLICT", httpStatus: CONFLICT_HTTP_STATUS },
				message: "Employee number already exists",
			},
		});
		expect(getTrpcErrorCode(error)).toBe("CONFLICT");
	});

	it("没有到达服务端的 tRPC 错误返回 undefined", () => {
		const error = TRPCClientError.from(new TypeError("Failed to fetch"));
		expect(getTrpcErrorCode(error)).toBeUndefined();
	});

	it("非 tRPC 错误返回 undefined", () => {
		expect(getTrpcErrorCode(new Error("boom"))).toBeUndefined();
		expect(getTrpcErrorCode("boom")).toBeUndefined();
		expect(getTrpcErrorCode(null)).toBeUndefined();
	});
});
