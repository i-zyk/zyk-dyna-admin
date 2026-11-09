# Web 自动部署到 Cloudflare Workers

工作流：[`.github/workflows/deploy-web.yml`](../.github/workflows/deploy-web.yml)。

Web 使用现有 OpenNext 配置，部署到 `apps/web/wrangler.jsonc` 中名为 `zyk-dyna-admin` 的 Worker。不会创建或部署 AWS 后端，也不会修改生产数据库。

## 1. 配置 Cloudflare API Token

在 Cloudflare 的 **My Profile → API Tokens → Create Token** 中使用 **Edit Cloudflare Workers** 模板，限定到当前 Worker 所在账户。当前项目使用 `workers.dev` 地址，不需要额外授予自定义域名的 Zone 权限。

将 Token 保存在 GitHub 仓库 **Settings → Secrets and variables → Actions → Secrets**：

| Secret | 内容 |
| --- | --- |
| `CLOUDFLARE_API_TOKEN` | 上述 Cloudflare API Token |

Token 只用于配置检查和部署步骤，不写进代码或 Web 构建产物。

## 2. 配置 GitHub Variables

在同一页面的 **Variables** 中添加 Repository variables：

| Variable | 内容 |
| --- | --- |
| `CLOUDFLARE_ACCOUNT_ID` | 现有 Worker 所在的 Cloudflare Account ID |
| `NEXT_PUBLIC_SERVER_URL` | Web 同源地址：`https://zyk-dyna-admin.izyk-me.workers.dev` |
| `API_UPSTREAM_URL` | AWS API Gateway 的 HTTPS 基础地址：`https://jjdpgobje6.execute-api.us-east-2.amazonaws.com` |

Account ID 可在 Cloudflare 控制台的账户或 Worker 详情中找到，它不是 API Token，也不是 Zone ID。

两个地址都不附加 `/api/auth` 或 `/trpc`。若 API Gateway 使用命名 stage，需要在 `API_UPSTREAM_URL` 中包含该 stage 路径。工作流会拒绝缺失配置，以及无效的公开 Web 地址。

这个变量在构建时被 Varlock / Next.js 内联，修改 GitHub Variable 后需要重新运行工作流。只修改 Cloudflare 的运行时变量不会更新已有前端产物。

仓库已经实现 `/api/auth/*` 和 `/trpc/*` 同源代理，保留请求 Cookie、响应中的多个 `Set-Cookie`，并禁止缓存用户响应。Server Component 读取 session 时直接请求 `API_UPSTREAM_URL` 并转发 Cookie。两个地址不能相同，以免代理循环。

## 3. 触发部署

把工作流及代码合并到 `main` 后，以下变更会触发部署：

- `apps/web/**`、`packages/**`。
- 锁文件、workspace、根 package.json、检查和构建配置。
- 工作流本身，以及 Prisma 环境变量复用的 server schema。

也可以进入 **Actions → Deploy Web to Cloudflare → Run workflow**，选择 `main` 手动运行。手动选择其他分支会跳过部署，以免覆盖生产站点。

流水线依次执行：

1. 检查部署变量，安装 Node.js 24 和根 `packageManager` 指定的 pnpm。
2. 使用 `pnpm install --frozen-lockfile` 安装全部 workspace 依赖并生成环境变量类型。
3. 生成 Prisma Client。这里使用不连接数据库的 CI 占位 URL，无需生产数据库密码。
4. 检查 Web 和共享包的代码规范，执行 Web / API 单元测试。
5. 构建 OpenNext Worker，再检查 Web 及依赖包的 TypeScript 类型。
6. 使用 Cloudflare Token 发布已构建的 Worker。

同一时间只运行一个生产部署。工作流只读取 GitHub 仓库内容，不需要 GitHub 写权限。

发布成功后访问现有站点：<https://zyk-dyna-admin.izyk-me.workers.dev>。后续修改 Worker 名称时，需要同步检查其公开地址。

如果之前在 Cloudflare Workers Builds 中配置了 GitHub 自动发布，建议关闭同一分支的重复构建，统一由本工作流发布。

## 4. 本地构建、预览与部署

先在 `apps/web/.env` 中配置实际的 `NEXT_PUBLIC_SERVER_URL` 和 `API_UPSTREAM_URL`，然后从仓库根目录执行：

```bash
pnpm install --frozen-lockfile
pnpm run db:generate
pnpm --dir apps/web run build:cloudflare
pnpm --dir apps/web run preview:cloudflare
```

预览和部署都使用上一次 `build:cloudflare` 的产物。修改代码或构建环境变量后，必须重新构建。

本地发布时，先通过 `pnpm --dir apps/web exec wrangler login` 登录，然后运行：

```bash
pnpm --dir apps/web run deploy:cloudflare
```

## 5. 后端连接和登录验收

自动发布 Web 成功不代表后端和登录已经联通。后端还需要允许 Web 的准确 origin，并具备可用的数据库连接。

生产环境的 `BETTER_AUTH_URL`、`CORS_ORIGIN` 都设为 Web 的 HTTPS 地址。浏览器通过 Web 同源代理登录，Cookie 由浏览器自动保存，无需手动填写 Cookie。原生端仍由 Better Auth Expo 插件把 session 存入 SecureStore，并由 tRPC 附带 Cookie。

联调时验证：首页和登录页正常、登录请求成功、刷新受保护页面仍保持登录、人员接口可访问、退出后 session 失效。

## 参考

- [Cloudflare GitHub Actions](https://developers.cloudflare.com/workers/ci-cd/external-cicd/github-actions/)
- [OpenNext Cloudflare 配置](https://opennext.js.org/cloudflare/get-started)
- [Better Auth Cookie 与同源代理](https://better-auth.com/docs/concepts/cookies#using-a-reverse-proxy)
