import { PrismaPg } from "@prisma/adapter-pg";

import {
	PersonStatus as GeneratedPersonStatus,
	Prisma as GeneratedPrisma,
	PrismaClient,
} from "../prisma/generated/client";
import type { DatabaseConfig } from "./config";
import { createPoolConfig } from "./pool-config";

export function createPrismaClient(env: DatabaseConfig) {
	const adapter = new PrismaPg(createPoolConfig(env));
	return new PrismaClient({ adapter });
}

export type Database = ReturnType<typeof createPrismaClient>;

// Prisma 命名空间只导出类型（如 Prisma.PersonWhereInput）；运行时需要的值单独声明导出，避免 noBarrelFile
export type { Person, Prisma } from "../prisma/generated/client";

export const PersonStatus = GeneratedPersonStatus;
export type PersonStatus = GeneratedPersonStatus;

/** 用于识别 P2002（唯一约束冲突）、P2025（记录不存在）等已知错误 */
export const { PrismaClientKnownRequestError } = GeneratedPrisma;
export type PrismaClientKnownRequestError =
	GeneratedPrisma.PrismaClientKnownRequestError;
