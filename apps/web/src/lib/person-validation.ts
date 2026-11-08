import type { PersonInput } from "@zyk-dyna-admin/api/lib/person-input";
import { z } from "zod";

// 与服务端 packages/api/src/lib/person-input.ts 保持同一组正则和长度常量。
// 前端不能在运行时导入 @zyk-dyna-admin/api，修改服务端规则时需要同步修改这里。

/** 工号：2–32 位字母、数字或连字符（存储时转大写） */
export const EMPLOYEE_NO_PATTERN = /^[A-Za-z0-9-]{2,32}$/;

/** 手机号：11 位数字，`1` 开头且第二位为 3–9 */
export const PHONE_PATTERN = /^1[3-9]\d{9}$/;

export const PERSON_NAME_MAX_LENGTH = 50;
/** RFC 5321 规定的邮箱地址长度上限 */
export const PERSON_EMAIL_MAX_LENGTH = 254;
export const PERSON_DEPARTMENT_MAX_LENGTH = 50;
export const PERSON_POSITION_MAX_LENGTH = 50;
export const PERSON_REMARK_MAX_LENGTH = 500;

/** 列表每页条数（服务端 pageSize 上限为 100） */
export const PERSON_LIST_PAGE_SIZE = 20;

/** 与 Prisma 的 `PersonStatus` 枚举一致 */
export const PERSON_STATUSES = ["ACTIVE", "INACTIVE"] as const;

export type PersonStatusValue = (typeof PERSON_STATUSES)[number];

export const PERSON_STATUS_LABELS: Readonly<Record<PersonStatusValue, string>> =
	{
		ACTIVE: "在职",
		INACTIVE: "离职",
	};

/** 表单和筛选用的状态选项（顺序即显示顺序） */
export const PERSON_STATUS_OPTIONS = PERSON_STATUSES.map((value) => ({
	label: PERSON_STATUS_LABELS[value],
	value,
}));

export const DEFAULT_PERSON_STATUS: PersonStatusValue = "ACTIVE";

export const PERSON_VALIDATION_MESSAGES = {
	departmentTooLong: `部门不能超过 ${PERSON_DEPARTMENT_MAX_LENGTH} 个字符`,
	emailInvalid: "邮箱格式不正确",
	emailTooLong: `邮箱不能超过 ${PERSON_EMAIL_MAX_LENGTH} 个字符`,
	employeeNoInvalid: "工号为 2–32 位字母、数字或连字符",
	employeeNoRequired: "请输入工号",
	nameRequired: "请输入姓名",
	nameTooLong: `姓名不能超过 ${PERSON_NAME_MAX_LENGTH} 个字符`,
	phoneInvalid: "请输入正确的 11 位手机号",
	positionTooLong: `职位不能超过 ${PERSON_POSITION_MAX_LENGTH} 个字符`,
	remarkTooLong: `备注不能超过 ${PERSON_REMARK_MAX_LENGTH} 个字符`,
	statusRequired: "请选择状态",
} as const;

const messages = PERSON_VALIDATION_MESSAGES;

/** 去掉首尾空格；结果为空串时返回 null */
const toNullableTrimmed = (value: string | null | undefined): string | null => {
	const trimmed = value?.trim() ?? "";
	return trimmed === "" ? null : trimmed;
};

/** 选填文本：先 trim，空值视为未填（解析结果为 null），有值时再按 schema 校验 */
const optionalText = <T extends z.ZodType<string | null, string | null>>(
	schema: T
) => z.string().transform(toNullableTrimmed).pipe(schema);

export const personNameSchema = z
	.string()
	.trim()
	.min(1, { abort: true, error: messages.nameRequired })
	.max(PERSON_NAME_MAX_LENGTH, { error: messages.nameTooLong });

export const personEmployeeNoSchema = z
	.string()
	.trim()
	.min(1, { abort: true, error: messages.employeeNoRequired })
	.regex(EMPLOYEE_NO_PATTERN, { error: messages.employeeNoInvalid })
	.toUpperCase();

export const personPhoneSchema = optionalText(
	z.string().regex(PHONE_PATTERN, { error: messages.phoneInvalid }).nullable()
);

export const personEmailSchema = optionalText(
	z
		.email({ error: messages.emailInvalid })
		.max(PERSON_EMAIL_MAX_LENGTH, { error: messages.emailTooLong })
		.toLowerCase()
		.nullable()
);

export const personDepartmentSchema = optionalText(
	z
		.string()
		.max(PERSON_DEPARTMENT_MAX_LENGTH, { error: messages.departmentTooLong })
		.nullable()
);

export const personPositionSchema = optionalText(
	z
		.string()
		.max(PERSON_POSITION_MAX_LENGTH, { error: messages.positionTooLong })
		.nullable()
);

export const personRemarkSchema = optionalText(
	z
		.string()
		.max(PERSON_REMARK_MAX_LENGTH, { error: messages.remarkTooLong })
		.nullable()
);

export const personStatusSchema = z.enum(PERSON_STATUSES, {
	error: messages.statusRequired,
});

/** 表单整体校验：解析结果已归一化（trim、工号大写、邮箱小写、选填空值为 null） */
export const personFormSchema = z.object({
	department: personDepartmentSchema,
	email: personEmailSchema,
	employeeNo: personEmployeeNoSchema,
	name: personNameSchema,
	phone: personPhoneSchema,
	position: personPositionSchema,
	remark: personRemarkSchema,
	status: personStatusSchema,
});

/** 表单字段值：输入框都是字符串，状态是枚举值 */
export interface PersonFormValues {
	department: string;
	email: string;
	employeeNo: string;
	name: string;
	phone: string;
	position: string;
	remark: string;
	status: PersonStatusValue;
}

/** 新增表单的初始值：状态默认「在职」 */
export const EMPTY_PERSON_FORM_VALUES: Readonly<PersonFormValues> = {
	department: "",
	email: "",
	employeeNo: "",
	name: "",
	phone: "",
	position: "",
	remark: "",
	status: DEFAULT_PERSON_STATUS,
};

/** 编辑表单回填用的人员数据（选填字段可能为 null） */
export interface PersonFormSource {
	department: string | null;
	email: string | null;
	employeeNo: string;
	name: string;
	phone: string | null;
	position: string | null;
	remark: string | null;
	status: PersonStatusValue;
}

/** 把人员数据转成表单字段值：null 回填为空串，避免输入框里出现 null */
export function toPersonFormValues(person: PersonFormSource): PersonFormValues {
	return {
		department: person.department ?? "",
		email: person.email ?? "",
		employeeNo: person.employeeNo,
		name: person.name,
		phone: person.phone ?? "",
		position: person.position ?? "",
		remark: person.remark ?? "",
		status: person.status,
	};
}

/**
 * 提交前把表单值转成接口入参：trim、工号转大写、邮箱转小写、选填字段空值转 null。
 * 只做归一化不做校验（校验由字段 schema / personFormSchema 负责），服务端还会再归一化和校验一次。
 */
export function toPersonInput(values: PersonFormValues): PersonInput {
	return {
		department: toNullableTrimmed(values.department),
		email: toNullableTrimmed(values.email)?.toLowerCase() ?? null,
		employeeNo: values.employeeNo.trim().toUpperCase(),
		name: values.name.trim(),
		phone: toNullableTrimmed(values.phone),
		position: toNullableTrimmed(values.position),
		remark: toNullableTrimmed(values.remark),
		status: values.status,
	};
}
