/** LIKE metacharacters in PostgreSQL (backslash is the default escape character). */
const LIKE_SPECIAL_CHARACTERS = /[\\%_]/g;

/**
 * Escapes `%`, `_` and `\` so a keyword passed to Prisma's `contains` matches
 * literally. Prisma 7 (with `@prisma/adapter-pg`) does not escape them itself:
 * it builds `ILIKE ('%' || $1 || '%')` from the raw value.
 */
export const escapeLikePattern = (value: string): string =>
	value.replace(LIKE_SPECIAL_CHARACTERS, String.raw`\$&`);
