/** 把 TanStack Form 的错误（字符串或 Standard Schema issue）统一成去重后的文案 */
export function toMessages(errors: readonly unknown[]): string[] {
	const messages = new Set<string>();
	for (const error of errors) {
		if (typeof error === "string") {
			messages.add(error);
		} else if (
			typeof error === "object" &&
			error !== null &&
			"message" in error &&
			typeof error.message === "string"
		) {
			messages.add(error.message);
		}
	}
	return [...messages];
}

function getErrorId(fieldName: string): string {
	return `${fieldName}-error`;
}

/** 字段下方的错误提示；没有错误时不渲染 */
export function FieldMessages({
	fieldName,
	messages,
}: {
	fieldName: string;
	messages: readonly string[];
}) {
	if (messages.length === 0) {
		return null;
	}
	return (
		<div className="space-y-1" id={getErrorId(fieldName)}>
			{messages.map((message) => (
				<p className="text-destructive text-xs" key={message}>
					{message}
				</p>
			))}
		</div>
	);
}

/** 根据字段的错误文案生成输入框的无障碍属性 */
export function getFieldA11yProps(
	fieldName: string,
	messages: readonly string[]
) {
	const hasError = messages.length > 0;
	return {
		"aria-describedby": hasError ? getErrorId(fieldName) : undefined,
		"aria-invalid": hasError || undefined,
	};
}
