import { TRPCError } from "@trpc/server";
import type { Prisma } from "@zyk-dyna-admin/db";

import { protectedProcedure, router } from "../index";
import {
	personIdInputSchema,
	personInputSchema,
	personListInputSchema,
	personUpdateInputSchema,
} from "../lib/person-input";
import {
	isPrismaErrorCode,
	PRISMA_RECORD_NOT_FOUND,
	PRISMA_UNIQUE_CONSTRAINT_FAILED,
} from "../lib/prisma-errors";
import { escapeLikePattern } from "../lib/prisma-like";

const PERSON_NOT_FOUND_MESSAGE = "Person not found";

/** Generic messages only: never echo Prisma's or the database's raw error. */
const notFoundError = (cause?: unknown): TRPCError =>
	new TRPCError({
		cause,
		code: "NOT_FOUND",
		message: PERSON_NOT_FOUND_MESSAGE,
	});

const toTrpcError = (error: unknown, fallbackMessage: string): TRPCError => {
	if (error instanceof TRPCError) {
		return error;
	}
	if (isPrismaErrorCode(error, PRISMA_UNIQUE_CONSTRAINT_FAILED)) {
		return new TRPCError({
			cause: error,
			code: "CONFLICT",
			message: "Employee number already exists",
		});
	}
	if (isPrismaErrorCode(error, PRISMA_RECORD_NOT_FOUND)) {
		return notFoundError(error);
	}
	return new TRPCError({
		cause: error,
		code: "INTERNAL_SERVER_ERROR",
		message: fallbackMessage,
	});
};

/** Runs a database call, mapping any failure to a sanitized `TRPCError`. */
const withDbErrors = async <T>(
	run: () => Promise<T>,
	fallbackMessage: string
): Promise<T> => {
	try {
		return await run();
	} catch (error) {
		throw toTrpcError(error, fallbackMessage);
	}
};

const buildListWhere = (
	keyword: string | undefined,
	status: Prisma.PersonWhereInput["status"]
): Prisma.PersonWhereInput => {
	const where: Prisma.PersonWhereInput = {};
	if (status) {
		where.status = status;
	}
	if (keyword) {
		const contains = escapeLikePattern(keyword);
		where.OR = [
			{ name: { contains, mode: "insensitive" } },
			{ employeeNo: { contains, mode: "insensitive" } },
		];
	}
	return where;
};

export const personRouter = router({
	create: protectedProcedure
		.input(personInputSchema)
		.mutation(({ ctx, input }) =>
			withDbErrors(
				() => ctx.db.person.create({ data: input }),
				"Failed to create person"
			)
		),

	delete: protectedProcedure
		.input(personIdInputSchema)
		.mutation(({ ctx, input }) =>
			withDbErrors(
				() =>
					ctx.db.person.delete({
						select: { id: true },
						where: { id: input.id },
					}),
				"Failed to delete person"
			)
		),

	getById: protectedProcedure
		.input(personIdInputSchema)
		.query(({ ctx, input }) =>
			withDbErrors(async () => {
				const person = await ctx.db.person.findUnique({
					where: { id: input.id },
				});
				if (!person) {
					throw notFoundError();
				}
				return person;
			}, "Failed to load person")
		),

	list: protectedProcedure
		.input(personListInputSchema)
		.query(({ ctx, input }) => {
			const { keyword, page, pageSize, status } = input;
			const where = buildListWhere(keyword, status);
			return withDbErrors(async () => {
				const [items, total] = await Promise.all([
					ctx.db.person.findMany({
						orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
						skip: (page - 1) * pageSize,
						take: pageSize,
						where,
					}),
					ctx.db.person.count({ where }),
				]);
				return { items, page, pageSize, total };
			}, "Failed to load persons");
		}),

	/** Replaces every editable field of the person. */
	update: protectedProcedure
		.input(personUpdateInputSchema)
		.mutation(({ ctx, input }) => {
			const { id, ...data } = input;
			return withDbErrors(
				() => ctx.db.person.update({ data, where: { id } }),
				"Failed to update person"
			);
		}),
});
