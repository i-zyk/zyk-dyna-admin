import { z } from "zod";

/**
 * GitHub username rules: 1–39 characters, letters, digits or single hyphens,
 * not starting or ending with a hyphen and never containing `--`.
 */
export const GITHUB_USERNAME_PATTERN =
	/^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/i;

export const githubUsernameSchema = z
	.string()
	.trim()
	.regex(GITHUB_USERNAME_PATTERN, "Invalid GitHub username");
