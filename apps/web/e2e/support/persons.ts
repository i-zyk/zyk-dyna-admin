import { randomUUID } from "node:crypto";

import { withTestDatabase } from "./database";

export type PersonStatus = "ACTIVE" | "INACTIVE";

/** 预置人员的入参：只有姓名和工号必填，其余字段缺省时按下面的规则补齐 */
export interface PersonSeed {
	/** 缺省为 `createdAt` = `updatedAt` */
	createdAt?: Date;
	department?: string | null;
	email?: string | null;
	/** 直接写库，不经过服务端归一化，需要大写时请自行传大写 */
	employeeNo: string;
	/** 缺省自动生成，库里没有默认值 */
	id?: string;
	name: string;
	phone?: string | null;
	position?: string | null;
	remark?: string | null;
	/** 缺省为 `ACTIVE` */
	status?: PersonStatus;
	/** 缺省按入参顺序递减（第 1 条最新），列表按更新时间倒序时顺序与入参一致 */
	updatedAt?: Date;
}

/** 实际写入数据库的人员 */
export interface SeededPerson {
	createdAt: Date;
	department: string | null;
	email: string | null;
	employeeNo: string;
	id: string;
	name: string;
	phone: string | null;
	position: string | null;
	remark: string | null;
	status: PersonStatus;
	updatedAt: Date;
}

/** 缺省更新时间相邻两条之间的间隔，保证排序稳定 */
const DEFAULT_UPDATED_AT_STEP_MS = 1000;

/** INSERT 的列顺序，每行参数按这个顺序排列 */
const PERSON_COLUMNS = [
	"id",
	"name",
	"employeeNo",
	"phone",
	"email",
	"department",
	"position",
	"status",
	"remark",
	"createdAt",
	"updatedAt",
] as const;

const PERSON_SELECT_COLUMNS = `"id", "name", "employeeNo", "phone", "email", "department", "position", "status", "remark",
	"createdAt" AT TIME ZONE 'UTC' AS "createdAt", "updatedAt" AT TIME ZONE 'UTC' AS "updatedAt"`;

/**
 * Prisma 把 DateTime 按 UTC 存进 `timestamp(3)`（不带时区）列。
 * 用 ISO 字符串转 `timestamptz` 再换算到 UTC，避免 pg 按本机时区写入造成时间偏移。
 */
const UTC_TIMESTAMP_PARAM = (index: number): string =>
	`($${index}::timestamptz AT TIME ZONE 'UTC')`;

const toParamPlaceholder = (
	column: (typeof PERSON_COLUMNS)[number],
	index: number
): string => {
	if (column === "status") {
		return `$${index}::"PersonStatus"`;
	}
	if (column === "createdAt" || column === "updatedAt") {
		return UTC_TIMESTAMP_PARAM(index);
	}
	return `$${index}`;
};

function toSeededPerson(
	seed: PersonSeed,
	index: number,
	now: number
): SeededPerson {
	const updatedAt =
		seed.updatedAt ?? new Date(now - index * DEFAULT_UPDATED_AT_STEP_MS);
	return {
		createdAt: seed.createdAt ?? updatedAt,
		department: seed.department ?? null,
		email: seed.email ?? null,
		employeeNo: seed.employeeNo,
		id: seed.id ?? `e2e-${randomUUID()}`,
		name: seed.name,
		phone: seed.phone ?? null,
		position: seed.position ?? null,
		remark: seed.remark ?? null,
		status: seed.status ?? "ACTIVE",
		updatedAt,
	};
}

function toParamValue(
	person: SeededPerson,
	column: (typeof PERSON_COLUMNS)[number]
): string | null {
	const value = person[column];
	return value instanceof Date ? value.toISOString() : value;
}

/** 只清空 `person` 表，不影响用户、会话等其他表 */
export function resetPersons(): Promise<void> {
	return withTestDatabase(async (client) => {
		await client.query('TRUNCATE TABLE public."person"');
	});
}

/**
 * 用 `pg` 直接批量插入人员（自带 `id`、`updatedAt`），返回实际写入的数据。
 * 可指定较早的 `updatedAt` 来验证编辑后更新时间变化，或批量造数据验证翻页。
 */
export async function seedPersons(
	seeds: readonly PersonSeed[]
): Promise<SeededPerson[]> {
	const now = Date.now();
	const persons = seeds.map((seed, index) => toSeededPerson(seed, index, now));
	if (persons.length === 0) {
		return persons;
	}
	const values: (string | null)[] = [];
	const rows = persons.map((person) => {
		const placeholders = PERSON_COLUMNS.map((column) => {
			values.push(toParamValue(person, column));
			return toParamPlaceholder(column, values.length);
		});
		return `(${placeholders.join(", ")})`;
	});
	const columns = PERSON_COLUMNS.map((column) => `"${column}"`).join(", ");
	await withTestDatabase(async (client) => {
		await client.query(
			`INSERT INTO public."person" (${columns}) VALUES ${rows.join(", ")}`,
			values
		);
	});
	return persons;
}

/**
 * 生成 `count` 条预置人员：姓名「人员01」…、工号「E001」…（序号补零，保证字典序与序号一致），
 * 更新时间缺省按序号递减（第 1 条最新）。`overrides` 可按序号覆盖任意字段。
 */
export function buildPersonSeeds(
	count: number,
	overrides?: (index: number) => Partial<PersonSeed>
): PersonSeed[] {
	const width = Math.max(String(count).length, 2);
	return Array.from({ length: count }, (_, index) => {
		const serial = String(index + 1).padStart(width, "0");
		return {
			employeeNo: `E${serial.padStart(3, "0")}`,
			name: `人员${serial}`,
			...overrides?.(index),
		};
	});
}

/** 按工号查人员（工号按库里存的原样比较），不存在时返回 `null` */
export function findPersonByEmployeeNo(
	employeeNo: string
): Promise<SeededPerson | null> {
	return withTestDatabase(async (client) => {
		const { rows } = await client.query<SeededPerson>(
			`SELECT ${PERSON_SELECT_COLUMNS} FROM public."person" WHERE "employeeNo" = $1`,
			[employeeNo]
		);
		return rows[0] ?? null;
	});
}

/** 当前 `person` 表的行数 */
export function countPersons(): Promise<number> {
	return withTestDatabase(async (client) => {
		const { rows } = await client.query<{ count: string }>(
			'SELECT COUNT(*) AS count FROM public."person"'
		);
		return Number(rows[0]?.count ?? 0);
	});
}

/** 在库里直接删除人员，模拟「页面打开后被别人删除」 */
export function deletePersonById(id: string): Promise<void> {
	return withTestDatabase(async (client) => {
		await client.query('DELETE FROM public."person" WHERE "id" = $1', [id]);
	});
}
