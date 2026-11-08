import type { TRPCError } from "@trpc/server";
import type { Session } from "@zyk-dyna-admin/auth";
import {
	type Database,
	type Person,
	PrismaClientKnownRequestError,
} from "@zyk-dyna-admin/db";
import { describe, expect, it } from "vitest";

import type { GithubClient } from "../lib/github";
import {
	PRISMA_RECORD_NOT_FOUND,
	PRISMA_UNIQUE_CONSTRAINT_FAILED,
} from "../lib/prisma-errors";

import { appRouter } from "./index";

type PersonMethod =
	| "count"
	| "create"
	| "delete"
	| "findMany"
	| "findUnique"
	| "update";

interface PersonCall {
	args: unknown;
	method: PersonMethod;
}

type FakePersonHandlers = Partial<
	Record<PersonMethod, (args: unknown) => Promise<unknown>>
>;

/** Only the presence of a session matters to `protectedProcedure`. */
const fakeSession = { session: {}, user: {} } as Session;

const fakeGithub: GithubClient = {
	getUser: () => Promise.reject(new Error("not used in these tests")),
};

const RAW_DB_MESSAGE =
	'duplicate key value violates unique constraint "person_employeeNo_key" secret-detail';

const samplePerson: Person = {
	createdAt: new Date("2026-01-01T00:00:00.000Z"),
	department: null,
	email: null,
	employeeNo: "A001",
	id: "person-1",
	name: "张三",
	phone: null,
	position: null,
	remark: null,
	status: "ACTIVE",
	updatedAt: new Date("2026-01-02T00:00:00.000Z"),
};

const validInput = {
	department: "",
	email: " Tom@Example.COM ",
	employeeNo: " a-001 ",
	name: " 张三 ",
	phone: "13812345678",
	position: "  ",
	remark: null,
	status: "ACTIVE" as const,
};

const normalizedInput = {
	department: null,
	email: "tom@example.com",
	employeeNo: "A-001",
	name: "张三",
	phone: "13812345678",
	position: null,
	remark: null,
	status: "ACTIVE",
};

const prismaError = (code: string): PrismaClientKnownRequestError =>
	new PrismaClientKnownRequestError(RAW_DB_MESSAGE, {
		clientVersion: "test",
		code,
	});

/**
 * A fake `db.person` that records every call. Methods without a handler
 * resolve to sensible defaults so tests only override what they assert on.
 */
const createFakeDb = (handlers: FakePersonHandlers = {}) => {
	const calls: PersonCall[] = [];
	const defaults: Record<PersonMethod, (args: unknown) => Promise<unknown>> = {
		count: () => Promise.resolve(0),
		create: () => Promise.resolve(samplePerson),
		delete: () => Promise.resolve({ id: samplePerson.id }),
		findMany: () => Promise.resolve([]),
		findUnique: () => Promise.resolve(samplePerson),
		update: () => Promise.resolve(samplePerson),
	};
	const method =
		(name: PersonMethod) =>
		(args: unknown): Promise<unknown> => {
			calls.push({ args, method: name });
			return (handlers[name] ?? defaults[name])(args);
		};
	const db = {
		person: {
			count: method("count"),
			create: method("create"),
			delete: method("delete"),
			findMany: method("findMany"),
			findUnique: method("findUnique"),
			update: method("update"),
		},
	} as unknown as Database;
	return { calls, db };
};

const createCaller = (db: Database, session: Session | null = fakeSession) =>
	appRouter.createCaller({ db, github: fakeGithub, session });

const catchTrpcError = async (
	promise: Promise<unknown>
): Promise<TRPCError> => {
	try {
		await promise;
	} catch (error) {
		return error as TRPCError;
	}
	throw new Error("Expected the call to throw a TRPCError");
};

describe("person 路由：访问控制与入参校验", () => {
	const procedures: [string, (db: Database) => Promise<unknown>][] = [
		["list", (db) => createCaller(db, null).person.list({})],
		["getById", (db) => createCaller(db, null).person.getById({ id: "x" })],
		["create", (db) => createCaller(db, null).person.create(validInput)],
		[
			"update",
			(db) => createCaller(db, null).person.update({ ...validInput, id: "x" }),
		],
		["delete", (db) => createCaller(db, null).person.delete({ id: "x" })],
	];

	it.each(procedures)(
		"未登录调用 %s 抛 UNAUTHORIZED 且不访问数据库",
		async (_name, call) => {
			const { calls, db } = createFakeDb();

			await expect(call(db)).rejects.toMatchObject({ code: "UNAUTHORIZED" });
			expect(calls).toEqual([]);
		}
	);

	const invalidCalls: [string, (db: Database) => Promise<unknown>][] = [
		[
			"create 姓名为空",
			(db) => createCaller(db).person.create({ ...validInput, name: "  " }),
		],
		[
			"create 工号含中文",
			(db) =>
				createCaller(db).person.create({ ...validInput, employeeNo: "工号1" }),
		],
		[
			"create 手机号 10 位",
			(db) =>
				createCaller(db).person.create({ ...validInput, phone: "1381234567" }),
		],
		[
			"update 邮箱 a@b",
			(db) =>
				createCaller(db).person.update({
					...validInput,
					email: "a@b",
					id: "x",
				}),
		],
		[
			"update 缺少 id",
			(db) => createCaller(db).person.update({ ...validInput, id: " " }),
		],
		["getById 空 id", (db) => createCaller(db).person.getById({ id: "" })],
		["delete 空 id", (db) => createCaller(db).person.delete({ id: "  " })],
		["list page 为 0", (db) => createCaller(db).person.list({ page: 0 })],
		[
			"list pageSize 为 101",
			(db) => createCaller(db).person.list({ pageSize: 101 }),
		],
		[
			"list 非法状态",
			(db) =>
				createCaller(db).person.list({
					status: "UNKNOWN" as unknown as "ACTIVE",
				}),
		],
	];

	it.each(invalidCalls)(
		"%s 时抛 BAD_REQUEST 且不访问数据库",
		async (_name, call) => {
			const { calls, db } = createFakeDb();

			await expect(call(db)).rejects.toMatchObject({ code: "BAD_REQUEST" });
			expect(calls).toEqual([]);
		}
	);
});

describe("person.create", () => {
	it("传给 Prisma 的数据已归一化，并返回新建的人员", async () => {
		const { calls, db } = createFakeDb();

		await expect(createCaller(db).person.create(validInput)).resolves.toEqual(
			samplePerson
		);
		expect(calls).toEqual([
			{ args: { data: normalizedInput }, method: "create" },
		]);
	});

	it("P2002 映射为 CONFLICT，且不回显数据库原始信息", async () => {
		const { db } = createFakeDb({
			create: () =>
				Promise.reject(prismaError(PRISMA_UNIQUE_CONSTRAINT_FAILED)),
		});

		const error = await catchTrpcError(
			createCaller(db).person.create(validInput)
		);

		expect(error.code).toBe("CONFLICT");
		expect(error.message).not.toContain(RAW_DB_MESSAGE);
	});

	it.each([
		["其他 Prisma 错误", () => prismaError("P1001")],
		["普通异常", () => new Error(RAW_DB_MESSAGE)],
	])(
		"%s 映射为 INTERNAL_SERVER_ERROR，且不回显原始信息",
		async (_name, makeError) => {
			const { db } = createFakeDb({
				create: () => Promise.reject(makeError()),
			});

			const error = await catchTrpcError(
				createCaller(db).person.create(validInput)
			);

			expect(error.code).toBe("INTERNAL_SERVER_ERROR");
			expect(error.message).not.toContain(RAW_DB_MESSAGE);
			expect(error.message).not.toContain("secret-detail");
		}
	);
});

describe("person.update", () => {
	it("按 id 整体替换，传给 Prisma 的数据已归一化", async () => {
		const { calls, db } = createFakeDb();

		await createCaller(db).person.update({ ...validInput, id: " person-1 " });

		expect(calls).toEqual([
			{
				args: { data: normalizedInput, where: { id: "person-1" } },
				method: "update",
			},
		]);
	});

	it.each<[string, string, TRPCError["code"]]>([
		["P2002", PRISMA_UNIQUE_CONSTRAINT_FAILED, "CONFLICT"],
		["P2025", PRISMA_RECORD_NOT_FOUND, "NOT_FOUND"],
	])("%s 映射为 %s，且不回显数据库原始信息", async (_name, code, trpcCode) => {
		const { db } = createFakeDb({
			update: () => Promise.reject(prismaError(code)),
		});

		const error = await catchTrpcError(
			createCaller(db).person.update({ ...validInput, id: "person-1" })
		);

		expect(error.code).toBe(trpcCode);
		expect(error.message).not.toContain(RAW_DB_MESSAGE);
	});

	it("其他错误映射为 INTERNAL_SERVER_ERROR，且不回显原始信息", async () => {
		const { db } = createFakeDb({
			update: () => Promise.reject(new Error(RAW_DB_MESSAGE)),
		});

		const error = await catchTrpcError(
			createCaller(db).person.update({ ...validInput, id: "person-1" })
		);

		expect(error.code).toBe("INTERNAL_SERVER_ERROR");
		expect(error.message).not.toContain(RAW_DB_MESSAGE);
	});
});

describe("person.delete", () => {
	it("物理删除并返回 { id }", async () => {
		const { calls, db } = createFakeDb();

		await expect(
			createCaller(db).person.delete({ id: " person-1 " })
		).resolves.toEqual({ id: "person-1" });
		expect(calls).toEqual([
			{
				args: { select: { id: true }, where: { id: "person-1" } },
				method: "delete",
			},
		]);
	});

	it("P2025 映射为 NOT_FOUND，且不回显数据库原始信息", async () => {
		const { db } = createFakeDb({
			delete: () => Promise.reject(prismaError(PRISMA_RECORD_NOT_FOUND)),
		});

		const error = await catchTrpcError(
			createCaller(db).person.delete({ id: "person-1" })
		);

		expect(error.code).toBe("NOT_FOUND");
		expect(error.message).not.toContain(RAW_DB_MESSAGE);
	});

	it("其他错误映射为 INTERNAL_SERVER_ERROR，且不回显原始信息", async () => {
		const { db } = createFakeDb({
			delete: () => Promise.reject(new Error(RAW_DB_MESSAGE)),
		});

		const error = await catchTrpcError(
			createCaller(db).person.delete({ id: "person-1" })
		);

		expect(error.code).toBe("INTERNAL_SERVER_ERROR");
		expect(error.message).not.toContain(RAW_DB_MESSAGE);
	});
});

describe("person.getById", () => {
	it("按 id 查询并返回人员", async () => {
		const { calls, db } = createFakeDb();

		await expect(
			createCaller(db).person.getById({ id: "person-1" })
		).resolves.toEqual(samplePerson);
		expect(calls).toEqual([
			{ args: { where: { id: "person-1" } }, method: "findUnique" },
		]);
	});

	it("查不到时抛 NOT_FOUND", async () => {
		const { db } = createFakeDb({ findUnique: () => Promise.resolve(null) });

		await expect(
			createCaller(db).person.getById({ id: "missing" })
		).rejects.toMatchObject({ code: "NOT_FOUND" });
	});

	it("数据库异常映射为 INTERNAL_SERVER_ERROR，且不回显原始信息", async () => {
		const { db } = createFakeDb({
			findUnique: () => Promise.reject(new Error(RAW_DB_MESSAGE)),
		});

		const error = await catchTrpcError(
			createCaller(db).person.getById({ id: "person-1" })
		);

		expect(error.code).toBe("INTERNAL_SERVER_ERROR");
		expect(error.message).not.toContain(RAW_DB_MESSAGE);
	});
});

describe("person.list", () => {
	const expectedOrderBy = [{ updatedAt: "desc" }, { id: "desc" }];

	it("默认第 1 页、每页 20 条，无筛选条件，返回 { items, total, page, pageSize }", async () => {
		const { calls, db } = createFakeDb({
			count: () => Promise.resolve(1),
			findMany: () => Promise.resolve([samplePerson]),
		});

		await expect(createCaller(db).person.list({})).resolves.toEqual({
			items: [samplePerson],
			page: 1,
			pageSize: 20,
			total: 1,
		});
		expect(calls).toEqual([
			{
				args: { orderBy: expectedOrderBy, skip: 0, take: 20, where: {} },
				method: "findMany",
			},
			{ args: { where: {} }, method: "count" },
		]);
	});

	it("关键词按姓名或工号不区分大小写匹配，叠加状态筛选，并按页码计算 skip / take", async () => {
		const { calls, db } = createFakeDb({
			count: () => Promise.resolve(25),
		});

		await expect(
			createCaller(db).person.list({
				keyword: "  a00  ",
				page: 3,
				pageSize: 10,
				status: "INACTIVE",
			})
		).resolves.toEqual({ items: [], page: 3, pageSize: 10, total: 25 });

		const expectedWhere = {
			OR: [
				{ name: { contains: "a00", mode: "insensitive" } },
				{ employeeNo: { contains: "a00", mode: "insensitive" } },
			],
			status: "INACTIVE",
		};
		expect(calls).toEqual([
			{
				args: {
					orderBy: expectedOrderBy,
					skip: 20,
					take: 10,
					where: expectedWhere,
				},
				method: "findMany",
			},
			{ args: { where: expectedWhere }, method: "count" },
		]);
	});

	it("关键词中的 % 和 _ 被转义为字面量", async () => {
		const { calls, db } = createFakeDb();

		await createCaller(db).person.list({ keyword: "50%_off" });

		const contains = String.raw`50\%\_off`;
		expect(calls[0]?.args).toMatchObject({
			where: {
				OR: [
					{ name: { contains, mode: "insensitive" } },
					{ employeeNo: { contains, mode: "insensitive" } },
				],
			},
		});
	});

	it("只有空格的关键词视为无条件", async () => {
		const { calls, db } = createFakeDb();

		await createCaller(db).person.list({ keyword: "   " });

		expect(calls.map((call) => call.args)).toEqual([
			{ orderBy: expectedOrderBy, skip: 0, take: 20, where: {} },
			{ where: {} },
		]);
	});

	it("数据库异常映射为 INTERNAL_SERVER_ERROR，且不回显原始信息", async () => {
		const { db } = createFakeDb({
			count: () => Promise.reject(new Error(RAW_DB_MESSAGE)),
		});

		const error = await catchTrpcError(createCaller(db).person.list({}));

		expect(error.code).toBe("INTERNAL_SERVER_ERROR");
		expect(error.message).not.toContain(RAW_DB_MESSAGE);
	});
});
