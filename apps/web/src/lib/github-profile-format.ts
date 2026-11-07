const ISO_DATE_LENGTH = "YYYY-MM-DD".length;
const DEFAULT_BLOG_PROTOCOL = "https://";
const ALLOWED_BLOG_PROTOCOLS = new Set(["http:", "https:"]);

/** 以 `scheme:` 开头（如 `https:`、`javascript:`） */
const URL_SCHEME_PATTERN = /^[a-z][a-z\d+.-]*:/i;
/** `host:port` 形式（如 `localhost:8080`），不是协议 */
const HOST_WITH_PORT_PATTERN = /^[^:/?#]+:\d+(?:[/?#]|$)/;
/** 协议相对地址（如 `//example.com`） */
const PROTOCOL_RELATIVE_PREFIX = "//";

/**
 * 把 GitHub 返回的 ISO 8601 时间格式化为 UTC 日期 `YYYY-MM-DD`；
 * 无法解析时返回 null（调用方不渲染该行）。
 */
export function formatJoinedDate(iso: string): string | null {
	const date = new Date(iso);
	if (Number.isNaN(date.getTime())) {
		return null;
	}
	return date.toISOString().slice(0, ISO_DATE_LENGTH);
}

/**
 * 把博客 / 网站地址转成可点击的链接：没有协议时补 `https://`，
 * 只接受 http / https；为空、其他协议（如 `javascript:`）或无法解析时返回 null，
 * 调用方只显示文本、不渲染成链接。
 */
export function normalizeBlogUrl(blog: string): string | null {
	const trimmed = blog.trim();
	if (trimmed === "") {
		return null;
	}

	let candidate = `${DEFAULT_BLOG_PROTOCOL}${trimmed}`;
	if (trimmed.startsWith(PROTOCOL_RELATIVE_PREFIX)) {
		candidate = `https:${trimmed}`;
	} else if (
		URL_SCHEME_PATTERN.test(trimmed) &&
		!HOST_WITH_PORT_PATTERN.test(trimmed)
	) {
		candidate = trimmed;
	}

	if (!URL.canParse(candidate)) {
		return null;
	}
	const url = new URL(candidate);
	if (!(ALLOWED_BLOG_PROTOCOLS.has(url.protocol) && url.hostname)) {
		return null;
	}
	return url.href;
}
