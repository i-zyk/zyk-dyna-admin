# 把 server 部署到现有 Lambda

以下步骤针对现有函数 `zyk-dyna-admin`、区域 `us-east-2`（美国俄亥俄），使用 Node.js 24 和 ZIP 部署。

## 1. 生成部署包

在仓库根目录执行：

```bash
pnpm install --frozen-lockfile
pnpm run build:lambda
pnpm --dir apps/server run test:lambda
```

`build:lambda` 先生成 Prisma Client，再把 Hono、认证、tRPC、数据库驱动和 Prisma 查询编译器打包，并复制 Varlock 的运行文件和 `.env.schema`。生成 Prisma Client 需要开发环境的 `DATABASE_URL` 通过配置校验，但不会连接或修改数据库。构建不会把变量值内联到 Lambda 包。

最终上传的文件是 **`apps/server/dist/server-lambda.zip`**。Handler 是 **`index.handler`**，不是 `src/index.ts`。

ZIP 根目录包含 `index.mjs`、相关 JS chunks、`.env.schema` 和 Varlock 运行文件。它不包含本地 `.env` 或生产密钥。包使用 JavaScript 和 WebAssembly，无需从 Mac 复制 Linux 原生数据库引擎；支持 Node.js 24 的 `x86_64` 和 `arm64` 架构。

需要系统提供 `zip` / `unzip` 命令（macOS 和常规 Linux 开发环境通常已有）。`test:lambda` 会在系统临时目录解压 ZIP，用独立子进程注入测试变量，验证基本 HTTP 行为及缺失密钥时的启动失败，不访问真实数据库。

普通 `pnpm --dir apps/server run build` 会清理 `dist/` 并生成本地 Node 服务产物；之后如需发布 Lambda，应重新运行 `build:lambda`。

## 2. 配置 Lambda 运行时并上传

在 AWS Lambda 控制台打开 `us-east-2` 下的 `zyk-dyna-admin`：

1. 在 **代码 → 运行时设置 → 编辑** 中选择 **Node.js 24.x**，Handler 填 **`index.handler`**。
2. 在代码源右上角的 **上传来源 / 更新** 菜单选择 **.zip 文件**，上传 `server-lambda.zip`，保存。
3. 在 **配置 → 常规配置 → 编辑** 中，可先设置内存 **512 MB**、超时 **20 秒**，之后按监控结果调整。

只上传 ZIP 不会给函数自动创建公开 HTTP 地址；下一步使用 API Gateway。

## 3. 创建 API Gateway HTTP API

在同一区域的 API Gateway 控制台：

1. 创建 **HTTP API**，集成类型选择 **Lambda**，关联 `zyk-dyna-admin`。
2. 配置 **`$default` 路由**指向该 Lambda，使根路径、`/api/auth/*`、`/trpc/*` 都能转发。
3. Lambda 代理集成的 payload format 选择 **2.0**。
4. 使用 **`$default` stage** 并启用自动部署。让控制台添加 API Gateway 调用该 Lambda 的权限。
5. 记录生成的 Invoke URL，例如 `https://API_ID.execute-api.us-east-2.amazonaws.com`。

当前认证由 Better Auth 和 tRPC 的登录校验完成，API Gateway 不额外配置 IAM 或 JWT authorizer。需要登录的接口仍由应用保护。

Hono 已处理 CORS，API Gateway 此处先不另设 CORS，避免两处配置不一致。

## 4. 在 Lambda 配置环境变量

在 **配置 → 环境变量 → 编辑** 中设置：

| 变量 | 值 |
| --- | --- |
| `NODE_ENV` | `production` |
| `BETTER_AUTH_URL` | Web 同源代理地址 `https://zyk-dyna-admin.izyk-me.workers.dev`，不附加 `/api/auth` |
| `CORS_ORIGIN` | `https://zyk-dyna-admin.izyk-me.workers.dev` |
| `BETTER_AUTH_SECRET` | 稳定的生产认证密钥，至少 32 个字符 |
| `DATABASE_URL` | Aurora PostgreSQL 连接串，含数据库名称和适当的 TLS 设置 |
| `GITHUB_TOKEN` | 可选；不配置则匿名访问 GitHub API |

可在本地用 `openssl rand -base64 32` 生成认证密钥，在控制台填写；不要提交到 Git 或每次部署重新生成。

当前 `.env.schema` 要求数据库地址和认证密钥都存在，缺少时函数会在初始化阶段失败。Aurora 尚未就绪时，不能据此认为登录或人员接口已经可用。

当前 Web 已实现同源代理，生产认证地址使用 Web origin。API Gateway 的实际地址放在 Web 的 `API_UPSTREAM_URL` 中。

## 5. 连接 Aurora 所在 VPC

在 Lambda 的 **配置 → VPC** 中选择 Aurora 所在 VPC，以及应用私有子网。执行角色需要创建 VPC 网络接口所需权限；控制台通常会提示添加相应权限。

- Aurora 安全组允许 Lambda 安全组访问 PostgreSQL 端口（通常为 5432）。
- Lambda 安全组允许所需出站连接。
- Lambda 私有子网需要经公有子网的 NAT Gateway，再经 IGW 访问 GitHub；连接到公有子网本身不会给 Lambda 分配公网 IP。
- Aurora 使用有效的 TLS 证书校验。Node.js 24 的 ZIP 运行时可按 AWS 文档使用 `NODE_EXTRA_CA_CERTS=/var/runtime/ca-cert.pem` 加载额外 AWS CA，或提供对应的 RDS CA bundle。

Aurora 的表由 VPC 内的 CodeBuild 运行 `pnpm --dir packages/db run db:migrate:deploy` 创建；日常管理使用 SSM 跳板机隧道。不要把迁移放进请求 handler；也不要使用生产数据库运行 E2E 的清表准备逻辑。完整自动部署见 [production-deployment.md](production-deployment.md)。

## 6. 验证接口

在 Lambda 的 **测试** 页创建测试事件，将 [`apps/server/events/http-api-health.json`](../apps/server/events/http-api-health.json) 的内容完整粘贴进去。运行后应看到：

```json
{
  "statusCode": 200,
  "body": "OK"
}
```

响应还会带其他头和字段。控制台默认的 `{ "key1": "value1" }` 事件不符合 HTTP API payload 格式，请勿用它测试这个 HTTP handler。

然后通过浏览器或终端访问 API Gateway：

```bash
curl https://API_ID.execute-api.us-east-2.amazonaws.com/
curl https://API_ID.execute-api.us-east-2.amazonaws.com/trpc/healthCheck
```

根路径预期返回 `OK`，tRPC 健康检查预期返回包含 `result.data: "OK"` 的 JSON。这两个检查都不证明数据库已连通；完成迁移后，还需要实际注册 / 登录并访问人员接口。

如果返回 500 / 502，在 Lambda 的 **监控 → 查看 CloudWatch 日志** 中定位初始化或请求错误。常见情况：

| 现象 | 检查 |
| --- | --- |
| 找不到 handler / module | Handler 是否为 `index.handler`，ZIP 根目录是否直接包含 `index.mjs` |
| Varlock 配置校验失败 | Lambda 环境变量、`.env.schema` 和 ZIP 内 Varlock 文件是否完整 |
| 根路径正常，登录或人员操作失败 | 数据库网络、TLS、连接凭据、表迁移情况 |
| GitHub 查询超时 | 私有子网的 NAT / IGW 路由和出站规则 |
| 本地 Lambda 测试正常，公网访问失败 | API Gateway 路由、stage 和调用权限 |

## 7. 连接 Cloudflare Web

把 GitHub Repository variable `NEXT_PUBLIC_SERVER_URL` 配成 Web 的 HTTPS 地址，`API_UPSTREAM_URL` 配成 API Gateway 的 HTTPS 基础地址，重新运行 Web 发布工作流。

浏览器通过 Web 的 `/api/auth/*` 和 `/trpc/*` 请求后端，Cookie 保存在 Web origin；Server Component 转发 Cookie 到物理后端校验。发布后验证登录、刷新受保护页面和人员操作，不要把根路径健康检查等同于数据库与登录验收通过。

## 后续更新代码

每次修改后重新构建、测试并上传 ZIP。若已安装 AWS CLI 并配置部署权限，可以使用：

```bash
aws lambda update-function-code \
  --region us-east-2 \
  --function-name zyk-dyna-admin \
  --zip-file fileb://apps/server/dist/server-lambda.zip
```

这条命令会更新真实 AWS 函数；本次仓库实现和本地验证不会自动执行它。后续可单独配置 GitHub Actions 的 AWS OIDC 部署工作流。

## 参考

- [AWS Node.js ZIP 部署](https://docs.aws.amazon.com/lambda/latest/dg/nodejs-package.html)
- [API Gateway HTTP API Lambda 集成](https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api-develop-integrations-lambda.html)
- [Lambda VPC 出网](https://docs.aws.amazon.com/lambda/latest/dg/configuration-vpc-internet.html)
- [Node.js CA 证书加载](https://docs.aws.amazon.com/lambda/latest/dg/lambda-nodejs.html#nodejs-certificates)
