import { z } from "zod";

// Shared with apps/web/src/lib/person-validation.ts (the web app cannot import
// this package at runtime). Keep both copies in sync when changing a rule.
// This module must only depend on `zod` so web unit tests can import it
// without loading Prisma Client.

/** Employee number: 2–32 letters, digits or hyphens (stored upper-cased). */
export const EMPLOYEE_NO_PATTERN = /^[A-Za-z0-9-]{2,32}$/;

/** Mainland China mobile number: 11 digits, starting with 1 then 3–9. */
export const PHONE_PATTERN = /^1[3-9]\d{9}$/;

export const PERSON_NAME_MAX_LENGTH = 50;
/** RFC 5321 upper bound for an email address. */
export const PERSON_EMAIL_MAX_LENGTH = 254;
export const PERSON_DEPARTMENT_MAX_LENGTH = 50;
export const PERSON_POSITION_MAX_LENGTH = 50;
export const PERSON_REMARK_MAX_LENGTH = 500;

export const PERSON_KEYWORD_MAX_LENGTH = 100;
export const PERSON_ID_MAX_LENGTH = 64;
export const PERSON_LIST_DEFAULT_PAGE = 1;
export const PERSON_LIST_DEFAULT_PAGE_SIZE = 20;
export const PERSON_LIST_MAX_PAGE_SIZE = 100;

/** Mirrors Prisma's `PersonStatus` enum; aligned with it in the router. */
export const PERSON_STATUSES = ["ACTIVE", "INACTIVE"] as const;

export const personStatusSchema = z.enum(PERSON_STATUSES, {
	error: "Invalid status",
});

/** Trims an optional value; empty, `null` and `undefined` all become `null`. */
const toNullableTrimmed = (value: string | null | undefined): string | null => {
	const trimmed = value?.trim() ?? "";
	return trimmed === "" ? null : trimmed;
};

/**
 * Optional text field: accepts `string | null | undefined`, always outputs
 * `string | null` (never an empty string), then validates the trimmed value.
 */
const optionalText = <T extends z.ZodType<string | null, string | null>>(
	schema: T
) => z.string().nullish().transform(toNullableTrimmed).pipe(schema);

const nameSchema = z
	.string()
	.trim()
	.min(1, "Name is required")
	.max(PERSON_NAME_MAX_LENGTH, "Name is too long");

const employeeNoSchema = z
	.string()
	.trim()
	.regex(EMPLOYEE_NO_PATTERN, "Invalid employee number")
	.toUpperCase();

const phoneSchema = optionalText(
	z.string().regex(PHONE_PATTERN, "Invalid phone number").nullable()
);

const emailSchema = optionalText(
	z
		.email("Invalid email address")
		.max(PERSON_EMAIL_MAX_LENGTH, "Email is too long")
		.toLowerCase()
		.nullable()
);

const departmentSchema = optionalText(
	z
		.string()
		.max(PERSON_DEPARTMENT_MAX_LENGTH, "Department is too long")
		.nullable()
);

const positionSchema = optionalText(
	z.string().max(PERSON_POSITION_MAX_LENGTH, "Position is too long").nullable()
);

const remarkSchema = optionalText(
	z.string().max(PERSON_REMARK_MAX_LENGTH, "Remark is too long").nullable()
);

/** Create / update payload. The server only writes data parsed by this schema. */
export const personInputSchema = z.object({
	department: departmentSchema,
	email: emailSchema,
	employeeNo: employeeNoSchema,
	name: nameSchema,
	phone: phoneSchema,
	position: positionSchema,
	remark: remarkSchema,
	status: personStatusSchema,
});

export const personIdSchema = z
	.string()
	.trim()
	.min(1, "Id is required")
	.max(PERSON_ID_MAX_LENGTH, "Id is too long");

/** `{ id }` input for `getById` / `delete`. */
export const personIdInputSchema = z.object({ id: personIdSchema });

/** `{ id, ...personInput }` input for `update` (replaces every field). */
export const personUpdateInputSchema = personInputSchema.extend({
	id: personIdSchema,
});

export const personListInputSchema = z.object({
	/** Matches name or employee number; blank means no keyword filter. */
	keyword: z
		.string()
		.trim()
		.max(PERSON_KEYWORD_MAX_LENGTH, "Keyword is too long")
		.optional()
		.transform((value) => (value === "" ? undefined : value)),
	page: z
		.number()
		.int("Page must be an integer")
		.min(1, "Page must be at least 1")
		.default(PERSON_LIST_DEFAULT_PAGE),
	pageSize: z
		.number()
		.int("Page size must be an integer")
		.min(1, "Page size must be at least 1")
		.max(PERSON_LIST_MAX_PAGE_SIZE, "Page size is too large")
		.default(PERSON_LIST_DEFAULT_PAGE_SIZE),
	status: personStatusSchema.optional(),
});

export type PersonStatusValue = z.output<typeof personStatusSchema>;
export type PersonInput = z.output<typeof personInputSchema>;
export type PersonUpdateInput = z.output<typeof personUpdateInputSchema>;
export type PersonListInput = z.output<typeof personListInputSchema>;
