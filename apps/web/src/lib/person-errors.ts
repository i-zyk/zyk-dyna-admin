export const PERSON_EMPLOYEE_NO_CONFLICT_MESSAGE = "工号已存在";
export const PERSON_NOT_FOUND_MESSAGE = "该人员不存在或已被删除";
export const PERSON_SAVE_FALLBACK_MESSAGE = "保存失败，请稍后再试";
export const PERSON_DELETE_FALLBACK_MESSAGE = "删除失败，请稍后再试";
export const PERSON_LOAD_FALLBACK_MESSAGE = "加载失败，请稍后再试";

const CONFLICT_CODE = "CONFLICT";
const NOT_FOUND_CODE = "NOT_FOUND";

/**
 * 保存（新增 / 编辑）失败的处理方式：
 * - `employeeNoConflict`：显示在工号字段下方
 * - `notFound`：编辑时人员已被删除，页面切换为不存在提示
 * - `unknown`：其他错误（包括没有错误码的网络错误），用 toast 提示
 */
export type PersonSaveError =
	| { message: string; type: "employeeNoConflict" }
	| { message: string; type: "notFound" }
	| { message: string; type: "unknown" };

/** 把 `person.create` / `person.update` 的 TRPCError code 转成中文提示 */
export function getPersonSaveError(code: string | undefined): PersonSaveError {
	if (code === CONFLICT_CODE) {
		return {
			message: PERSON_EMPLOYEE_NO_CONFLICT_MESSAGE,
			type: "employeeNoConflict",
		};
	}
	if (code === NOT_FOUND_CODE) {
		return { message: PERSON_NOT_FOUND_MESSAGE, type: "notFound" };
	}
	return { message: PERSON_SAVE_FALLBACK_MESSAGE, type: "unknown" };
}

/** `person.delete` 失败的提示：人员已被删除时提示不存在，其他情况提示删除失败 */
export function getPersonDeleteErrorMessage(code: string | undefined): string {
	return code === NOT_FOUND_CODE
		? PERSON_NOT_FOUND_MESSAGE
		: PERSON_DELETE_FALLBACK_MESSAGE;
}

/** `person.getById` / `person.list` 加载失败的提示：查不到时提示不存在，其他情况提示加载失败 */
export function getPersonLoadErrorMessage(code: string | undefined): string {
	return code === NOT_FOUND_CODE
		? PERSON_NOT_FOUND_MESSAGE
		: PERSON_LOAD_FALLBACK_MESSAGE;
}

/** 是否为「人员不存在或已被删除」 */
export function isPersonNotFound(code: string | undefined): boolean {
	return code === NOT_FOUND_CODE;
}
