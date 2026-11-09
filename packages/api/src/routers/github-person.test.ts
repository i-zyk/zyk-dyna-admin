import type { Session } from "@zyk-dyna-admin/auth";
import {
	type Database,
	PrismaClientKnownRequestError,
} from "@zyk-dyna-admin/db";
import { describe, expect, it, vi } from "vitest";

import { GithubApiError, type GithubUserProfile } from "../lib/github";
import { appRouter } from "./index";

const profile: GithubUserProfile = {
	avatarUrl: "https://avatars.githubusercontent.com/u/1",
	bio: null,
	blog: null,
	company: null,
	createdAt: "2011-01-01T00:00:00Z",
	followers: 2,
	following: 1,
	githubId: "1",
	htmlUrl: "https://github.com/octocat",
	location: null,
	login: "octocat",
	name: "Octocat",
	publicRepos: 3,
};

function setup(session: Session | null = { session: {}, user: {} } as Session) {
	const githubPerson = {
		count: vi.fn().mockResolvedValue(1),
		create: vi.fn().mockResolvedValue({ id: "saved", ...profile }),
		delete: vi.fn().mockResolvedValue({ id: "saved" }),
		findMany: vi.fn().mockResolvedValue([]),
		findUnique: vi.fn().mockResolvedValue(null),
		update: vi.fn().mockResolvedValue({ id: "saved" }),
	};
	const getUser = vi.fn().mockResolvedValue(profile);
	const caller = appRouter.createCaller({
		db: { githubPerson } as unknown as Database,
		github: { getUser },
		session,
	}).githubPerson;
	return { caller, getUser, githubPerson };
}

describe("GitHub directory", () => {
	it("blocks every operation before touching external services when logged out", async () => {
		const { caller, getUser, githubPerson } = setup(null);
		await Promise.all(
			[
				caller.add({ username: "octocat" }),
				caller.list({}),
				caller.getById({ id: "saved" }),
				caller.update({ displayName: "", id: "saved", note: "" }),
				caller.delete({ id: "saved" }),
			].map((operation) =>
				expect(operation).rejects.toMatchObject({ code: "UNAUTHORIZED" })
			)
		);
		expect(getUser).not.toHaveBeenCalled();
		expect(githubPerson.create).not.toHaveBeenCalled();
		expect(githubPerson.findMany).not.toHaveBeenCalled();
		expect(githubPerson.update).not.toHaveBeenCalled();
		expect(githubPerson.delete).not.toHaveBeenCalled();
	});

	it("saves an authoritative GitHub snapshot and parses the upstream date", async () => {
		const { caller, getUser, githubPerson } = setup();
		await caller.add({ username: " octocat " });
		expect(getUser).toHaveBeenCalledWith("octocat");
		const { createdAt, ...data } = profile;
		expect(githubPerson.create).toHaveBeenCalledWith({
			data: { ...data, githubCreatedAt: new Date(createdAt) },
		});
	});

	it("rejects duplicate GitHub identities without leaking database details", async () => {
		const { caller, githubPerson } = setup();
		githubPerson.create.mockRejectedValue(
			new PrismaClientKnownRequestError("private DB detail", {
				clientVersion: "test",
				code: "P2002",
			})
		);
		await expect(caller.add({ username: "octocat" })).rejects.toMatchObject({
			code: "CONFLICT",
			message: "该 GitHub 用户已经添加",
		});
	});

	it("does not write if GitHub is rate limited", async () => {
		const { caller, getUser, githubPerson } = setup();
		getUser.mockRejectedValue(
			new GithubApiError("private upstream detail", { kind: "rate_limited" })
		);
		await expect(caller.add({ username: "octocat" })).rejects.toMatchObject({
			code: "TOO_MANY_REQUESTS",
		});
		expect(githubPerson.create).not.toHaveBeenCalled();
	});

	it("normalizes editable notes and never permits changing the GitHub identity", async () => {
		const { caller, githubPerson } = setup();
		await caller.update({ displayName: " Octo ", id: "saved", note: "  " });
		expect(githubPerson.update).toHaveBeenCalledWith({
			data: { displayName: "Octo", note: null },
			where: { id: "saved" },
		});
		await expect(
			caller.update({ displayName: "a".repeat(101), id: "saved", note: "" })
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
	});

	it("returns not found for a removed record", async () => {
		const { caller, githubPerson } = setup();
		await expect(caller.getById({ id: "missing" })).rejects.toMatchObject({
			code: "NOT_FOUND",
		});
		githubPerson.delete.mockRejectedValue(
			new PrismaClientKnownRequestError("private DB detail", {
				clientVersion: "test",
				code: "P2025",
			})
		);
		await expect(caller.delete({ id: "missing" })).rejects.toMatchObject({
			code: "NOT_FOUND",
		});
	});

	it("escapes search wildcards and bounds pagination", async () => {
		const { caller, githubPerson } = setup();
		await caller.list({ keyword: " a_b% ", page: 2, pageSize: 10 });
		expect(githubPerson.findMany.mock.calls[0]?.[0]).toMatchObject({
			skip: 10,
			take: 10,
			where: {
				OR: [
					{ login: { contains: "a\\_b\\%", mode: "insensitive" } },
					{ name: { contains: "a\\_b\\%", mode: "insensitive" } },
					{ displayName: { contains: "a\\_b\\%", mode: "insensitive" } },
				],
			},
		});
		await expect(caller.list({ pageSize: 51 })).rejects.toMatchObject({
			code: "BAD_REQUEST",
		});
	});
});
