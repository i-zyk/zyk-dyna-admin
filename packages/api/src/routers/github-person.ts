import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { protectedProcedure, router } from "../index";
import { GithubApiError } from "../lib/github";
import { githubUsernameSchema } from "../lib/github-username";
import { isPrismaErrorCode } from "../lib/prisma-errors";
import { escapeLikePattern } from "../lib/prisma-like";

const idInput = z.object({ id: z.string().min(1) });
const editableText = (length: number) =>
	z
		.string()
		.trim()
		.max(length)
		.transform((value) => value || null);

async function execute<T>(run: () => Promise<T>): Promise<T> {
	try {
		return await run();
	} catch (error) {
		if (error instanceof TRPCError) {
			throw error;
		}
		let code: TRPCError["code"] = "INTERNAL_SERVER_ERROR";
		let message = "操作失败，请稍后重试";
		if (isPrismaErrorCode(error, "P2002")) {
			code = "CONFLICT";
			message = "该 GitHub 用户已经添加";
		}
		if (isPrismaErrorCode(error, "P2025")) {
			code = "NOT_FOUND";
			message = "该人员不存在";
		}
		if (error instanceof GithubApiError) {
			code = "BAD_GATEWAY";
			if (error.kind === "not_found") {
				code = "NOT_FOUND";
			}
			if (error.kind === "rate_limited") {
				code = "TOO_MANY_REQUESTS";
			}
			message = "无法获取 GitHub 用户资料，请稍后重试";
		}
		// biome-ignore lint/style/useErrorCause: TRPCError receives cause inside its first options argument.
		throw new TRPCError({ cause: error, code, message });
	}
}

export const githubPersonRouter = router({
	add: protectedProcedure
		.input(z.object({ username: githubUsernameSchema }))
		.mutation(({ ctx, input }) =>
			execute(async () => {
				const { createdAt, ...data } = await ctx.github.getUser(input.username);
				return ctx.db.githubPerson.create({
					data: { ...data, githubCreatedAt: new Date(createdAt) },
				});
			})
		),
	delete: protectedProcedure.input(idInput).mutation(({ ctx, input }) =>
		execute(() =>
			ctx.db.githubPerson.delete({
				select: { id: true },
				where: { id: input.id },
			})
		)
	),
	getById: protectedProcedure.input(idInput).query(({ ctx, input }) =>
		execute(async () => {
			const person = await ctx.db.githubPerson.findUnique({
				where: { id: input.id },
			});
			if (!person) {
				throw new TRPCError({ code: "NOT_FOUND", message: "该人员不存在" });
			}
			return person;
		})
	),
	list: protectedProcedure
		.input(
			z.object({
				keyword: z.string().trim().max(100).default(""),
				page: z.number().int().min(1).default(1),
				pageSize: z.number().int().min(1).max(50).default(20),
			})
		)
		.query(({ ctx, input }) =>
			execute(async () => {
				const contains = escapeLikePattern(input.keyword);
				const where = input.keyword
					? {
							OR: [
								{ login: { contains, mode: "insensitive" as const } },
								{ name: { contains, mode: "insensitive" as const } },
								{ displayName: { contains, mode: "insensitive" as const } },
							],
						}
					: {};
				const [items, total] = await Promise.all([
					ctx.db.githubPerson.findMany({
						orderBy: [{ createdAt: "desc" }, { id: "desc" }],
						skip: (input.page - 1) * input.pageSize,
						take: input.pageSize,
						where,
					}),
					ctx.db.githubPerson.count({ where }),
				]);
				return { items, page: input.page, pageSize: input.pageSize, total };
			})
		),
	update: protectedProcedure
		.input(
			idInput.extend({
				displayName: editableText(100),
				note: editableText(500),
			})
		)
		.mutation(({ ctx, input }) =>
			execute(() => {
				const { id, ...data } = input;
				return ctx.db.githubPerson.update({ data, where: { id } });
			})
		),
});
