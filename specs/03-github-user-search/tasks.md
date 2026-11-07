# R03 GitHub 用户查询 - 任务清单

> 完成一项后把 `- [ ]` 改为 `- [✅]`

- [ ] 1. 声明 `GITHUB_TOKEN` 环境变量
  - 说明：`apps/server/.env.schema` 增加 `# @optional` 的 `GITHUB_TOKEN=`（继承 `@defaultSensitive=true`，不写默认值）；执行 `pnpm run env:generate`；`turbo.json` 的 `globalEnv` 加入 `GITHUB_TOKEN`；确认不配置时 `pnpm run dev:server` 能正常启动
  - 对应验收标准：R03-AC14
- [ ] 2. GitHub 客户端工厂
  - [ ] 2.1 新建 `packages/api/src/lib/github-username.ts`：`GITHUB_USERNAME_PATTERN`、`githubUsernameSchema`
  - [ ] 2.2 新建 `packages/api/src/lib/github.ts`：`createGithubClient(config, fetchImpl)`，设置 `Accept`、`User-Agent`、可选 `Authorization: Bearer`、10 秒超时；用 Zod 解析响应并只挑出 `GithubUserProfile` 字段（空字符串转 `null`）；按状态码抛 `GithubApiError`
  - 对应验收标准：R03-AC10、R03-AC11、R03-AC13、R03-AC14
- [ ] 3. 注入 Context 并新增 tRPC 子路由
  - [ ] 3.1 `packages/api/src/context.ts` 的 `Context`（保持 `type`）增加 `github: GithubClient`；`apps/server/src/services.ts` 创建 `github`；`apps/server/src/context.ts` 注入
  - [ ] 3.2 新建 `packages/api/src/routers/github.ts`：`getUser` 用 `protectedProcedure` + `githubUsernameSchema`，把 `GithubApiError` 映射为 `NOT_FOUND` / `TOO_MANY_REQUESTS` / `INTERNAL_SERVER_ERROR`；在 `routers/index.ts` 合并为 `github`
  - 对应验收标准：R03-AC9、R03-AC10、R03-AC11、R03-AC13
- [ ] 4. 添加 Avatar 组件并支持跳过全局错误 toast
  - [ ] 4.1 执行 `npx shadcn@latest add avatar -c packages/ui`，核对没有新增 npm 依赖（有的话先暂停确认）
  - [ ] 4.2 `apps/web/src/utils/trpc.ts` 的 `QueryCache.onError` 在 `query.meta?.skipGlobalErrorToast` 为 true 时不弹 toast
  - 对应验收标准：R03-AC5、R03-AC9 ~ R03-AC11
- [ ] 5. 前端工具函数
  - 说明：新建 `apps/web/src/lib/github-username.ts`（与后端同一正则、`parseGithubUsernameInput()` 返回 空 / 不合法 / 小写用户名）和 `apps/web/src/lib/github-profile-format.ts`（`formatJoinedDate()`、`normalizeBlogUrl()`）
  - 对应验收标准：R03-AC2、R03-AC3、R03-AC7、R03-AC8、R03-AC12
- [ ] 6. 搜索组件与资料卡片
  - [ ] 6.1 新建 `apps/web/src/components/github-user-search.tsx`：带 `<Label>` 的搜索框 + 「搜索」按钮（`<form>` 提交，回车可用）；空输入忽略；格式不合法提示「GitHub 用户名格式不正确」；`useQuery(trpc.github.getUser.queryOptions(...))`，`enabled`、`staleTime: 5 分钟`、`retry: false`、`meta.skipGlobalErrorToast`；按 `error.data?.code` 显示中文错误；加载中显示骨架屏并禁用按钮
  - [ ] 6.2 新建 `apps/web/src/components/github-user-card.tsx`：`Card` + `Avatar`，昵称为空显示 `login`，空字段整行不渲染，`login` 链接到 `htmlUrl`、博客链接用 `normalizeBlogUrl`，外链统一 `target="_blank" rel="noopener noreferrer"`，注册时间用 `formatJoinedDate`；长文本 `break-words` 不撑出横向滚动；同文件导出骨架屏组件
  - [ ] 6.3 `apps/web/src/app/dashboard/page.tsx` / `dashboard.tsx` 保留服务端 session 校验，渲染 `GithubUserSearch`（替换 `privateData` 示例展示）
  - 对应验收标准：R03-AC1 ~ R03-AC12、R03-AC15
- [ ] 7. 编写测试
  - [ ] 7.1 `packages/api` 单元测试 `github.test.ts`（注入假 `fetch`）：200 时只返回 `GithubUserProfile` 字段（多余字段被丢弃，`blog: ""` 转 `null`）；404 → `not_found`；403、429 → `rate_limited`；500、网络异常、超时、响应结构不对 → `upstream`；未配置 Token 时没有 `Authorization` 头，配置后为 `Bearer <token>`；`Accept`、`User-Agent` 头正确
  - [ ] 7.2 `packages/api` 路由测试 `routers/github.test.ts`（`createCaller`，注入假 `GithubClient`）：`session: null` 时抛 `UNAUTHORIZED`；`-abc`、`abc-`、`a--b`、40 位字符串抛 `BAD_REQUEST`；`not_found` / `rate_limited` / `upstream` 分别映射为 `NOT_FOUND` / `TOO_MANY_REQUESTS` / `INTERNAL_SERVER_ERROR`
  - [ ] 7.3 `apps/web` 单元测试：`parseGithubUsernameInput` 对空串和空格返回空，对 `-abc`、40 位、`a_b` 返回不合法，对 `Torvalds` 返回 `torvalds`，前后端正则对同一组用例结果一致；`formatJoinedDate("2011-09-03T15:26:22Z")` 为 `2011-09-03`；`normalizeBlogUrl` 对 `""`、`example.com`、`https://a.dev`、`javascript:alert(1)` 的结果
  - [ ] 7.4 E2E `apps/web/e2e/github-search.spec.ts`（先登录；用 Playwright 拦截并计数 `/trpc/github.getUser` 请求，在 server 端用可控的假 GitHub 响应或 `page.route` 模拟 tRPC 响应，避免依赖真实 GitHub 额度）：空输入和 `-abc`、40 位字符串不发请求且显示格式错误；`torvalds` 显示头像、昵称、仓库数、粉丝数、关注数、注册时间；缺少 `bio` 等字段时对应行不存在且页面文本不含 `null` / `undefined`；外链带 `target="_blank"` 和 `rel="noopener noreferrer"`；404 / 429 / 500 分别显示对应文案且页面不崩溃；同一用户名 5 分钟内搜索两次（中间搜索另一个用户）只发出一次请求，先搜 `Torvalds` 再搜 `torvalds` 也只发出一次请求；回车可搜索；375px 视口下长简介不出现横向滚动
  - [ ] 7.5 真实 GitHub 冒烟（手动或标记为可选用例）：未配置 `GITHUB_TOKEN` 时搜索 `torvalds` 成功
  - 对应验收标准：R03-AC1 ~ R03-AC15
- [ ] 8. 运行 `pnpm run check` 与 `pnpm run check-types`，修复所有问题
  - 对应验收标准：R03-AC16
- [ ] 9. 自测并对照 requirements.md 逐条验收（含亮色 / 暗色主题手动检查）
  - 对应验收标准：R03-AC1 ~ R03-AC16
