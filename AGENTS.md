# 项目概览：zyk-dyna-admin

由 [Better-T-Stack](https://better-t-stack.dev) v3.49.0 生成的全栈 TypeScript Monorepo（生成参数见 `bts.jsonc`）。一套后端同时服务 Web 管理端（Next.js）和移动端（Expo），通过 tRPC 实现端到端类型安全。

## 技术栈

| 层 | 技术 |
| --- | --- |
| Monorepo | pnpm workspaces（`pnpm@12`，`node-linker=isolated`）+ Turborepo，依赖版本统一放在 `pnpm-workspace.yaml` 的 `catalog:` |
| Web 前端 | Next.js 16（App Router、`typedRoutes`、React Compiler）+ React 19 + Tailwind CSS v4 + shadcn/ui（`base-lyra` 风格，基于 `@base-ui/react`） |
| 移动端 | Expo SDK 58 + React Native 0.88 + Expo Router（typed routes）+ HeroUI Native + Uniwind（Tailwind v4 for RN） |
| 文档站 | Fumadocs（Next.js 16 + MDX），提供 `llms.txt` / OG 图 / 搜索 |
| 后端 | Hono 4（Node 运行时，`@hono/node-server`），开发用 `tsx watch`，构建用 `tsdown` |
| API | tRPC v11 + `@trpc/tanstack-react-query` + TanStack Query v5 |
| 认证 | Better Auth 1.7（邮箱密码 + `@better-auth/expo` 插件） |
| 数据库 | PostgreSQL + Prisma 7（`prisma-client` generator、ESM 输出、`@prisma/adapter-pg` 驱动适配器） |
| 表单 / 校验 | TanStack Form + Zod 4 |
| 环境变量 | Varlock（每个应用一个 `.env.schema`，自动生成类型安全的 `src/env.ts`） |
| 代码质量 | Biome 2 + Ultracite（tab 缩进、双引号），TypeScript 6 strict |

## 目录结构

```
zyk-dyna-admin/
├── apps/
│   ├── web/                     # Web 管理端 Next.js，端口 3001
│   │   ├── src/app/             #   App Router：page.tsx / login/ / dashboard/（服务端校验 session，未登录 redirect）
│   │   ├── src/components/      #   header、providers（Theme + QueryClient + TRPCProvider + Toaster）、登录注册表单等
│   │   ├── src/lib/auth-client.ts   # better-auth/react 客户端
│   │   ├── src/utils/trpc.ts    #   tRPC 客户端 + QueryClient（全局错误 toast，credentials: include）
│   │   ├── src/env.ts           #   Varlock 自动生成，勿手改
│   │   ├── next.config.ts       #   varlockNextConfigPlugin 包裹
│   │   └── AGENTS.md            #   Next.js 自动生成的 agent 规则（新版 Next，写代码前查 node_modules/next/dist/docs）
│   ├── native/                  # 移动端 Expo（scheme: zyk-dyna-admin）
│   │   ├── app/                 #   Expo Router：_layout.tsx → (drawer)/(tabs)/、modal.tsx、+not-found.tsx
│   │   ├── components/          #   container、sign-in、sign-up、theme-toggle
│   │   ├── contexts/            #   app-theme-context
│   │   ├── lib/auth-client.ts   #   Better Auth + expoClient（SecureStore 存储 session）
│   │   ├── utils/trpc.ts        #   tRPC 客户端：原生端手动附带 Cookie 头，Web 端用 credentials
│   │   ├── src/env.ts           #   Varlock 自动生成
│   │   ├── metro.config.js      #   Varlock + Uniwind + Reanimated 组合配置
│   │   └── babel-plugins/       #   自定义 Hermes 兼容插件
│   ├── server/                  # 后端 Hono，端口 3000
│   │   └── src/
│   │       ├── index.ts         #   入口：logger、CORS、/api/auth/* → Better Auth、/trpc/* → appRouter
│   │       ├── services.ts      #   组装根：createPrismaClient(ENV) + createAuth(ENV, db)
│   │       ├── context.ts       #   tRPC context：从请求头取 session，注入 { db, session }
│   │       ├── env.server.ts    #   varlock/auto-load 后导出 ENV
│   │       └── env.ts           #   Varlock 自动生成
│   └── fumadocs/                # 文档站，端口 4000，内容在 content/docs/*.mdx
├── packages/
│   ├── api/                     # @zyk-dyna-admin/api：tRPC 业务层
│   │   └── src/
│   │       ├── index.ts         #   initTRPC、router、publicProcedure、protectedProcedure（无 session 抛 UNAUTHORIZED）
│   │       ├── context.ts       #   Context 类型 { session, db }
│   │       └── routers/index.ts #   appRouter（healthCheck、privateData），导出 AppRouter 类型
│   ├── auth/                    # @zyk-dyna-admin/auth：createAuth(env, db) 工厂 + Session 类型
│   ├── db/                      # @zyk-dyna-admin/db：Prisma
│   │   ├── prisma/schema/       #   多文件 schema：schema.prisma（generator/datasource）、auth.prisma（Better Auth 表）
│   │   ├── prisma/migrations/
│   │   ├── prisma/generated/    #   prisma generate 输出（已 gitignore）
│   │   ├── prisma.config.ts     #   Prisma 7 配置，DATABASE_URL 由 Varlock 加载
│   │   └── src/index.ts         #   createPrismaClient(env) 工厂 + Database 类型
│   ├── ui/                      # @zyk-dyna-admin/ui：共享 shadcn/ui 组件（仅 Web 使用）
│   │   └── src/{components,hooks,lib,styles/globals.css}
│   └── config/                  # @zyk-dyna-admin/config：tsconfig.base.json
├── .agents/skills/ ↔ .claude/skills/   # AI agent 技能（两份内容相同）
├── .mcp.json                    # MCP：better-t-stack、context7、shadcn、next-devtools、better-auth、expo
├── turbo.json                   # 任务管道与 globalEnv
├── biome.json                   # Biome/Ultracite 配置
└── bts.jsonc                    # Better-T-Stack 元数据（用于 `create-better-t-stack add`）
```

## 架构要点

### 依赖关系

```
apps/web ─────┐
apps/native ──┼──> @zyk-dyna-admin/api ──> @zyk-dyna-admin/auth ──> @zyk-dyna-admin/db
apps/server ──┘         (类型 AppRouter)          │                       │
      │                                          └───────────────────────┘
      └──> 直接依赖 auth、db（在 services.ts 中实例化）
apps/web ──> @zyk-dyna-admin/ui
```

- 前端只从 `@zyk-dyna-admin/api` 导入 **类型**（`AppRouter`），运行时通过 HTTP 调用后端。
- 内部包不构建，`exports` 直接指向 `src/*.ts` 源码；server 构建时 `tsdown` 用 `alwaysBundle` 把 `@zyk-dyna-admin/*` 打进产物。

### 依赖注入（工厂模式）

共享包 **不读取环境变量**，只暴露工厂函数和配置类型：

- `createPrismaClient(env: DatabaseConfig)` → `Database`
- `createAuth(env: AuthConfig, db: Database)` → Better Auth 实例

唯一的组装点是 `apps/server/src/services.ts`，由应用自己的 Varlock `ENV` 注入。新增共享服务时沿用这个模式。

### 请求链路

1. 客户端 → `NEXT_PUBLIC_SERVER_URL` / `EXPO_PUBLIC_SERVER_URL`（server :3000）
2. `/api/auth/*` → `auth.handler`（Better Auth 处理登录、注册、session）
3. `/trpc/*` → `@hono/trpc-server` → `createContext` 从 Cookie 解析 session → `appRouter`
4. 需要登录的接口用 `protectedProcedure`，`ctx.session` 为非空类型

### 认证与跨端

- Cookie 设置为 `sameSite: "none"`、`secure`、`httpOnly`，Web 端 fetch 时用 `credentials: "include"`。
- `trustedOrigins` 包含 `CORS_ORIGIN`、`zyk-dyna-admin://`、`exp://`、`http://localhost:8081`。
- 原生端：`expoClient` 把 session 存进 SecureStore，tRPC 请求通过 `authClient.getCookie()` 手动设置 `Cookie` 头。
- Web 的 `dashboard/page.tsx` 是 Server Component，用 `authClient.getSession` 并转发 `headers()` 来校验登录。

### 环境变量（Varlock）

- 每个应用一个 `.env.schema`（已提交），实际值放 `.env`（已 gitignore）。
- `packages/db/.env.schema` 通过 `@import` 复用 `apps/server` 的 `DATABASE_*`。
- `src/env.ts` 是 **自动生成** 的，修改 schema 后执行 `pnpm run env:generate`，不要手改。
- 应用代码用生成的 `ENV` 读取变量；server 入口须先 `import "./env.server"`（内含 `varlock/auto-load`）。
- 新增环境变量时同步更新 `turbo.json` 的 `globalEnv`。

## 常用命令

```bash
pnpm install                 # 安装依赖（postinstall 会生成 env.ts）
pnpm run dev                 # 启动全部：server :3000 / web :3001 / fumadocs :4000 / native (Expo)
pnpm run dev:web | dev:server | dev:native
pnpm run db:generate         # 生成 Prisma Client（修改 schema 后、type check / build 前必须执行）
pnpm run db:push             # 同步 schema 到数据库
pnpm run db:migrate          # prisma migrate dev
pnpm run db:studio
pnpm run auth:generate       # 根据 Better Auth 配置重新生成 packages/db/prisma/schema/auth.prisma
pnpm run check-types         # 全仓类型检查
pnpm run check | fix         # Ultracite 检查 / 自动修复
```

## 开发约定

- **新增 API**：在 `packages/api/src/routers/` 下建子 router，然后合并进 `appRouter`；需要登录的接口用 `protectedProcedure`，入参用 Zod 校验。
- **新增数据表**：在 `packages/db/prisma/schema/` 下新建 `.prisma` 文件（多文件 schema），然后执行 `db:generate`，再 `db:migrate`（或 `db:push`）。不要手改 `auth.prisma`，用 `auth:generate` 重新生成。
- **共享 UI 组件**：`npx shadcn@latest add <组件> -c packages/ui`，导入方式为 `@zyk-dyna-admin/ui/components/<name>`；只属于 Web 的业务组件放 `apps/web/src/components`。
- **移动端 UI** 使用 HeroUI Native + Uniwind className，不要用 `packages/ui`（它是 Web/DOM 专用）。
- **新增依赖**：多处共用的依赖加到 `pnpm-workspace.yaml` 的 `catalog:`，在 package.json 里写 `"catalog:"`。
- 不要手改的生成文件：`*/src/env.ts`、`packages/db/prisma/generated/`、`apps/native/uniwind-types.d.ts`、`next-env.d.ts`。这些文件和 `.agents/`、`.claude/`、`.codex/` 一起在 `biome.json` 里被排除在检查之外。
- **Lint 规则的取舍**（`biome.json`）：
  - `noJsxPropsBind` 关闭：Web 和移动端都开了 React Compiler，会自动记忆化内联函数。
  - `noUnnecessaryConditions`、`noParametersOnlyUsedInRecursion` 关闭：Biome 推断 TanStack Query 返回值和 `fetch` 时会误报，照提示改会删掉真实的加载判断。
  - `packages/ui` 是 shadcn 生成的代码，对它单独关闭了几条无障碍和导出规则，不手改，方便以后用 CLI 升级覆盖。
  - tRPC 的 `Context` 必须用 `type`，不能改成 `interface`：`@hono/trpc-server` 要求它能赋给 `Record<string, unknown>`。
  - Web 端读取环境变量统一用 `import { ENV } from "@/env"`（Varlock 在构建时内联公开变量），不要写 `process.env.X!`。

---

# Ultracite Code Standards

This project uses **Ultracite**, a zero-config preset that enforces strict code quality standards through automated formatting and linting.

## Quick Reference

- **Format code**: `pnpm exec ultracite fix`
- **Check for issues**: `pnpm exec ultracite check`
- **Diagnose setup**: `pnpm exec ultracite doctor`

Biome (the underlying engine) provides robust linting and formatting. Most issues are automatically fixable.

---

## Core Principles

Write code that is **accessible, performant, type-safe, and maintainable**. Focus on clarity and explicit intent over brevity.

### Type Safety & Explicitness

- Use explicit types for function parameters and return values when they enhance clarity
- Prefer `unknown` over `any` when the type is genuinely unknown
- Use const assertions (`as const`) for immutable values and literal types
- Leverage TypeScript's type narrowing instead of type assertions
- Use meaningful variable names instead of magic numbers - extract constants with descriptive names

### Modern JavaScript/TypeScript

- Use arrow functions for callbacks and short functions
- Prefer `for...of` loops over `.forEach()` and indexed `for` loops
- Use optional chaining (`?.`) and nullish coalescing (`??`) for safer property access
- Prefer template literals over string concatenation
- Use destructuring for object and array assignments
- Use `const` by default, `let` only when reassignment is needed, never `var`

### Async & Promises

- Always `await` promises in async functions - don't forget to use the return value
- Use `async/await` syntax instead of promise chains for better readability
- Handle errors appropriately in async code with try-catch blocks
- Don't use async functions as Promise executors

### React & JSX

- Use function components over class components
- Call hooks at the top level only, never conditionally
- Specify all dependencies in hook dependency arrays correctly
- Use the `key` prop for elements in iterables (prefer unique IDs over array indices)
- Nest children between opening and closing tags instead of passing as props
- Don't define components inside other components
- Use semantic HTML and ARIA attributes for accessibility:
  - Provide meaningful alt text for images
  - Use proper heading hierarchy
  - Add labels for form inputs
  - Include keyboard event handlers alongside mouse events
  - Use semantic elements (`<button>`, `<nav>`, etc.) instead of divs with roles

### Error Handling & Debugging

- Remove `console.log`, `debugger`, and `alert` statements from production code
- Throw `Error` objects with descriptive messages, not strings or other values
- Use `try-catch` blocks meaningfully - don't catch errors just to rethrow them
- Prefer early returns over nested conditionals for error cases

### Code Organization

- Keep functions focused and under reasonable cognitive complexity limits
- Extract complex conditions into well-named boolean variables
- Use early returns to reduce nesting
- Prefer simple conditionals over nested ternary operators
- Group related code together and separate concerns

### Security

- Add `rel="noopener"` when using `target="_blank"` on links
- Avoid `dangerouslySetInnerHTML` unless absolutely necessary
- Don't use `eval()` or assign directly to `document.cookie`
- Validate and sanitize user input

### Performance

- Avoid spread syntax in accumulators within loops
- Use top-level regex literals instead of creating them in loops
- Prefer specific imports over namespace imports
- Avoid barrel files (index files that re-export everything)
- Use proper image components (e.g., Next.js `<Image>`) over `<img>` tags

### Framework-Specific Guidance

**Next.js:**

- Use Next.js `<Image>` component for images
- Use `next/head` or App Router metadata API for head elements
- Use Server Components for async data fetching instead of async Client Components

**React 19+:**

- Use ref as a prop instead of `React.forwardRef`

**Solid/Svelte/Vue/Qwik:**

- Use `class` and `for` attributes (not `className` or `htmlFor`)

---

## Testing

- Write assertions inside `it()` or `test()` blocks
- Avoid done callbacks in async tests - use async/await instead
- Don't use `.only` or `.skip` in committed code
- Keep test suites reasonably flat - avoid excessive `describe` nesting

## When Biome Can't Help

Biome will catch most mechanical issues automatically. Focus your attention on:

1. **Business logic correctness** - Biome can't validate your algorithms
2. **Meaningful naming** - Use descriptive names for functions, variables, and types
3. **Architecture decisions** - Component structure, data flow, and API design
4. **Edge cases** - Handle boundary conditions and error states
5. **User experience** - Accessibility, performance, and usability considerations
6. **Documentation** - Add comments for complex logic, but prefer self-documenting code

---

Most formatting and common issues are automatically fixed by Biome. Run `pnpm exec ultracite fix` before committing to ensure compliance.
