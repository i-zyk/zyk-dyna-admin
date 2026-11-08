import { PrismaClientKnownRequestError } from "@zyk-dyna-admin/db";

/** Unique constraint failed (e.g. duplicate `employeeNo`). */
export const PRISMA_UNIQUE_CONSTRAINT_FAILED = "P2002";

/** The record required by `update` / `delete` does not exist. */
export const PRISMA_RECORD_NOT_FOUND = "P2025";

/**
 * Whether `error` is a Prisma known request error with the given code.
 * Only `code` is checked: with `@prisma/adapter-pg`, `meta.target` may be missing.
 */
export const isPrismaErrorCode = (
	error: unknown,
	code: string
): error is PrismaClientKnownRequestError =>
	error instanceof PrismaClientKnownRequestError && error.code === code;
