# R02 用户名或邮箱登录 / 退出登录 - 任务清单

> 完成一项后把 `- [ ]` 改为 `- [✅]`

- [✅] 1. 补充登录校验与错误映射
  - 说明：在 `apps/web/src/lib/auth-validation.ts` 新增 `signInSchema`（`identifier`、`password` 必填，中文提示）和 `isEmailIdentifier()`；在 `apps/web/src/lib/auth-errors.ts` 新增 `getSignInErrorMessage()`（认证类错误 → 「账号或密码错误」，网络错误 / 5xx → 「登录失败，请稍后再试」）
  - 对应验收标准：R02-AC3、R02-AC4、R02-AC5
  - 测试：`pnpm --filter web run test`（vitest 73 个通过）、`pnpm --filter web run check-types`、`pnpm run check`、`pnpm --filter web run test:e2e`（Playwright 13 个通过），通过（第 1 轮）
- [✅] 2. 重写登录表单
  - 说明：`apps/web/src/components/sign-in-form.tsx` 字段改为「用户名或邮箱」和「密码」，每个字段有 `<Label htmlFor>`；提交前 trim `identifier`，按是否包含 `@` 调用 `signIn.email` 或 `signIn.username`；错误按映射显示；提交中按钮加载并禁用；成功后 `router.push("/dashboard")`
  - 对应验收标准：R02-AC1 ~ R02-AC5、R02-AC9
  - 测试：`pnpm --filter web run test`（vitest 73 个通过）、`pnpm --filter web run check-types`、`pnpm run check`、`pnpm --filter web run test:e2e`（Playwright 13 个通过），另用临时 Playwright 脚本实际打开 /login 验证（`TOM`、`  TOM@EXAMPLE.COM  ` 登录进入 /dashboard；错误密码 / 不存在用户名 / 不存在邮箱 / `ab` 均显示「账号或密码错误」；空字段不发登录请求，7 个通过，脚本已删除），通过（第 1 轮）
- [✅] 3. `/login` 已登录重定向
  - 说明：新建 `apps/web/src/components/auth-panel.tsx`（客户端，承载登录 / 注册切换）；`apps/web/src/app/login/page.tsx` 改为 Server Component，转发 `headers()` 调 `authClient.getSession`，有 session 时 `redirect("/dashboard")`
  - 对应验收标准：R02-AC6
  - 测试：`pnpm --filter web run test`（vitest 73 个通过）、`pnpm --filter web run check-types`、`pnpm run check`、`pnpm --filter web run test:e2e`（Playwright 13 个通过），另用临时 Playwright 用例实际打开 /login 验证（未登录显示登录表单且可切换到注册；注册登录后访问 /login 被重定向到 /dashboard；清掉 cookie 后 /login 正常显示登录表单，2 个通过，用例已删除），通过（第 1 轮）
- [✅] 4. 用户菜单与退出登录
  - 说明：`apps/web/src/components/user-menu.tsx` 显示用户名（`displayUsername ?? username ?? name`，已确认）和邮箱，提供「退出登录」，成功后 `router.push("/login")` + `router.refresh()`；未登录显示「登录」按钮；检查亮暗主题与 375px 宽度下顶部导航无横向滚动
  - 对应验收标准：R02-AC7、R02-AC8、R02-AC9
  - 测试：`pnpm --filter web run test`（vitest 73 个通过）、`pnpm --filter web run check-types`、`pnpm run check`、`pnpm --filter web run test:e2e`（Playwright 13 个通过），另用临时 Playwright 用例实际打开页面验证（未登录显示「登录」并可进入 /login；`Tom` 登录后菜单按钮显示 `Tom`、菜单内显示 `Tom` 和 `tom@example.com`；点击 / 键盘 Enter 选「退出登录」回到 /login，之后访问 /dashboard 与后退均停在 /login；退出接口 500 时提示「退出登录失败，请稍后再试」并保持登录；375px 亮 / 暗主题下 30 位用户名截断显示、菜单展开时 `scrollWidth <= 375`，6 个通过，用例已删除），通过（第 1 轮）
- [ ] 5. 编写测试
  - [✅] 5.1 单元测试：`isEmailIdentifier("a@b.co")` 为 true、`isEmailIdentifier("tom")` 为 false；`signInSchema` 空用户名 / 空密码报错；`getSignInErrorMessage` 对 `INVALID_EMAIL_OR_PASSWORD`、`INVALID_USERNAME_OR_PASSWORD`、`INVALID_EMAIL`、`USERNAME_TOO_SHORT`、status 401 / 422 都返回「账号或密码错误」，对 status 500 和网络错误返回「登录失败，请稍后再试」
    - 测试：`pnpm --filter web run test`（vitest 75 个通过）、`pnpm --filter web run check-types`、`pnpm run check`，通过（第 1 轮）
  - [✅] 5.2 E2E `apps/web/e2e/sign-in.spec.ts`（测试前通过注册接口准备用户 `Tom` / `tom@example.com`）：用 `TOM` + 密码登录成功进入 `/dashboard`；用 `TOM@EXAMPLE.COM` + 密码登录成功；错误密码、不存在的用户名、不存在的邮箱、`ab` 都显示同一句「账号或密码错误」；空字段时无法提交
    - 测试：`pnpm --filter web run test`（vitest 75 个通过）、`pnpm --filter web run check-types`、`pnpm run check`、`pnpm --filter web run test:e2e`（Playwright 20 个通过，其中 sign-in 7 个），通过（第 1 轮）
  - [✅] 5.3 E2E 跳转：已登录访问 `/login` 被重定向到 `/dashboard`；用户菜单显示 `Tom` 和 `tom@example.com`；点击「退出登录」回到 `/login`；之后访问 `/dashboard` 被重定向到 `/login`；未登录直接访问 `/dashboard` 被重定向到 `/login`
    - 测试：`pnpm --filter web run test`（vitest 75 个通过）、`pnpm --filter web run check-types`、`pnpm run check`、`pnpm --filter web run test:e2e`（Playwright 23 个通过，其中 sign-in 10 个，含 5.3 新增的 3 个跳转用例），通过（第 1 轮）
  - [ ] 5.4 E2E 可访问性与布局：只用键盘（Tab / Enter）完成登录，并通过键盘打开用户菜单完成退出；375px 视口下 `/login` 的 `scrollWidth <= 375`
  - 对应验收标准：R02-AC1 ~ R02-AC9
- [ ] 6. 运行 `pnpm run check` 与 `pnpm run check-types`，修复所有问题
  - 对应验收标准：R02-AC10
- [ ] 7. 自测并对照 requirements.md 逐条验收（含亮色 / 暗色主题手动检查）
  - 对应验收标准：R02-AC1 ~ R02-AC10
- CR（2026-11-06）：Codex 提出 1 条，采纳 1 条；不采纳：无
