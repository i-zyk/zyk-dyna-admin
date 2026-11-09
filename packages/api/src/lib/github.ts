import { z } from "zod";

const GITHUB_API_BASE_URL = "https://api.github.com";
const GITHUB_API_VERSION = "2022-11-28";
const GITHUB_USER_AGENT = "zyk-dyna-admin";
const GITHUB_REQUEST_TIMEOUT_MS = 10_000;

const HTTP_STATUS_FORBIDDEN = 403;
const HTTP_STATUS_NOT_FOUND = 404;
const HTTP_STATUS_TOO_MANY_REQUESTS = 429;

export interface GithubConfig {
	GITHUB_TOKEN?: string;
}

export interface GithubUserProfile {
	avatarUrl: string;
	bio: string | null;
	blog: string | null;
	company: string | null;
	createdAt: string;
	followers: number;
	following: number;
	githubId: string;
	htmlUrl: string;
	location: string | null;
	login: string;
	name: string | null;
	publicRepos: number;
}

export type GithubApiErrorKind = "not_found" | "rate_limited" | "upstream";

export class GithubApiError extends Error {
	readonly kind: GithubApiErrorKind;

	constructor(
		message: string,
		options: ErrorOptions & { kind: GithubApiErrorKind }
	) {
		super(message, { cause: options.cause });
		this.name = "GithubApiError";
		this.kind = options.kind;
	}
}

export type FetchLike = (input: string, init: RequestInit) => Promise<Response>;

export interface GithubClient {
	getUser: (username: string) => Promise<GithubUserProfile>;
}

/** Only the fields we display; anything else GitHub returns is dropped. */
const githubUserResponseSchema = z.object({
	avatar_url: z.string(),
	bio: z.string().nullish(),
	blog: z.string().nullish(),
	company: z.string().nullish(),
	created_at: z.string(),
	followers: z.number(),
	following: z.number(),
	html_url: z.string(),
	id: z.number().int().positive(),
	location: z.string().nullish(),
	login: z.string(),
	name: z.string().nullish(),
	public_repos: z.number(),
});

type GithubUserResponse = z.infer<typeof githubUserResponseSchema>;

/** GitHub uses `""` (and sometimes `null`) for unset text fields; normalize both to `null`. */
const emptyToNull = (value: string | null | undefined): string | null =>
	value?.trim() ? value : null;

const toProfile = (user: GithubUserResponse): GithubUserProfile => ({
	avatarUrl: user.avatar_url,
	bio: emptyToNull(user.bio),
	blog: emptyToNull(user.blog),
	company: emptyToNull(user.company),
	createdAt: user.created_at,
	followers: user.followers,
	following: user.following,
	githubId: String(user.id),
	htmlUrl: user.html_url,
	location: emptyToNull(user.location),
	login: user.login,
	name: emptyToNull(user.name),
	publicRepos: user.public_repos,
});

const buildHeaders = (token: string | undefined): Record<string, string> => {
	const headers: Record<string, string> = {
		Accept: "application/vnd.github+json",
		"User-Agent": GITHUB_USER_AGENT,
		"X-GitHub-Api-Version": GITHUB_API_VERSION,
	};
	if (token) {
		headers.Authorization = `Bearer ${token}`;
	}
	return headers;
};

const errorForStatus = (status: number): GithubApiError => {
	if (status === HTTP_STATUS_NOT_FOUND) {
		return new GithubApiError("GitHub user not found", { kind: "not_found" });
	}
	if (
		status === HTTP_STATUS_FORBIDDEN ||
		status === HTTP_STATUS_TOO_MANY_REQUESTS
	) {
		return new GithubApiError("GitHub API rate limit exceeded", {
			kind: "rate_limited",
		});
	}
	return new GithubApiError(`GitHub API responded with status ${status}`, {
		kind: "upstream",
	});
};

const readJson = async (response: Response): Promise<unknown> => {
	try {
		return await response.json();
	} catch (error) {
		throw new GithubApiError("GitHub API returned invalid JSON", {
			cause: error,
			kind: "upstream",
		});
	}
};

export const createGithubClient = (
	config: GithubConfig,
	fetchImpl: FetchLike = fetch
): GithubClient => {
	const headers = buildHeaders(config.GITHUB_TOKEN);

	const getUser = async (username: string): Promise<GithubUserProfile> => {
		const url = `${GITHUB_API_BASE_URL}/users/${encodeURIComponent(username)}`;

		let response: Response;
		try {
			response = await fetchImpl(url, {
				headers,
				method: "GET",
				signal: AbortSignal.timeout(GITHUB_REQUEST_TIMEOUT_MS),
			});
		} catch (error) {
			// Network failure or timeout; the message never includes the token
			throw new GithubApiError("GitHub API request failed", {
				cause: error,
				kind: "upstream",
			});
		}

		if (!response.ok) {
			throw errorForStatus(response.status);
		}

		const parsed = githubUserResponseSchema.safeParse(await readJson(response));
		if (!parsed.success) {
			throw new GithubApiError("GitHub API returned an unexpected response", {
				cause: parsed.error,
				kind: "upstream",
			});
		}
		return toProfile(parsed.data);
	};

	return { getUser };
};
