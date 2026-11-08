/** 空值（null / undefined / 空串）在页面上显示的占位符 */
export const EMPTY_PERSON_VALUE = "-";

const TWO_DIGITS = 2;

const pad = (value: number): string => String(value).padStart(TWO_DIGITS, "0");

/**
 * 按浏览器本地时区把时间格式化为 `YYYY-MM-DD HH:mm`；
 * 为空或无法解析时返回 `-`。
 */
export function formatPersonDateTime(
	value: string | Date | null | undefined
): string {
	if (value === null || value === undefined || value === "") {
		return EMPTY_PERSON_VALUE;
	}
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) {
		return EMPTY_PERSON_VALUE;
	}
	const datePart = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
	const timePart = `${pad(date.getHours())}:${pad(date.getMinutes())}`;
	return `${datePart} ${timePart}`;
}

/** 选填字段的显示值：null / undefined / 空串（含只有空白）显示为 `-` */
export function displayPersonValue(value: string | null | undefined): string {
	if (value === null || value === undefined || value.trim() === "") {
		return EMPTY_PERSON_VALUE;
	}
	return value;
}

/** 总页数，至少为 1（没有数据时显示「第 1 / 1 页」）；pageSize 不是正数时按 1 页处理 */
export function getTotalPages(total: number, pageSize: number): number {
	if (!(pageSize > 0 && total > 0)) {
		return 1;
	}
	return Math.max(1, Math.ceil(total / pageSize));
}
