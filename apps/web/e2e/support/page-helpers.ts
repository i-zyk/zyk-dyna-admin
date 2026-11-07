import { expect, type Locator, type Page } from "@playwright/test";

/** 检查横向滚动用的窄屏视口（375px 宽） */
export const NARROW_VIEWPORT = { height: 812, width: 375 } as const;

const MAX_KEY_PRESSES = 40;

/** 不断按指定按键（如 Tab、ArrowDown），直到焦点落到目标元素上 */
export async function pressUntilFocused(
	page: Page,
	target: Locator,
	key: string
): Promise<void> {
	for (let presses = 0; presses < MAX_KEY_PRESSES; presses += 1) {
		// biome-ignore lint/performance/noAwaitInLoops: 每次按键都依赖上一次按键后的焦点位置，必须按顺序执行
		const isFocused = await target.evaluate(
			(element) => element === document.activeElement
		);
		if (isFocused) {
			return;
		}
		await page.keyboard.press(key);
	}
	await expect(target).toBeFocused();
}

/** 不断按 Tab，直到焦点落到目标元素上 */
export async function tabUntilFocused(
	page: Page,
	target: Locator
): Promise<void> {
	await pressUntilFocused(page, target, "Tab");
}

/** 页面根元素的 scrollWidth，大于视口宽度说明出现了横向滚动 */
export async function getScrollWidth(page: Page): Promise<number> {
	return await page.evaluate(() => document.documentElement.scrollWidth);
}
