# 需求总览

> 需求来源：[docs/需求.md](../docs/需求.md)　技术参考：[AGENTS.md](../AGENTS.md)　生成日期：2026-11-06
>
> 一个需求的 tasks.md 全部完成后，把下表中该需求的状态改为 `- [✅]`

| 序号 | 需求 | 依赖 | 状态 |
|------|------|------|------|
| R01 | [用户名 + 邮箱注册](01-username-sign-up/requirements.md) | 无 | - [✅] |
| R02 | [用户名或邮箱登录 / 退出登录](02-sign-in-sign-out/requirements.md) | R01 | - [✅] |
| R03 | [GitHub 用户查询](03-github-user-search/requirements.md) | R01、R02 | - [ ] |

## 建议开发顺序

1. R01 用户名 + 邮箱注册（含测试基础设施搭建、username 插件与数据库迁移）
2. R02 用户名或邮箱登录 / 退出登录
3. R03 GitHub 用户查询

## 全局非功能需求落点

| 要求（docs/需求.md 第 5 节） | 落在 |
| --- | --- |
| 密码由 Better Auth 哈希存储，不明文记录或打印 | R01-AC8 |
| 亮色 / 暗色主题、375px 无横向滚动 | R01-AC10、R02-AC9、R03-AC15 |
| 输入框有 `<label>`、键盘可完成注册 / 登录 / 搜索 | R01-AC9、R02-AC9、R03-AC1 |
| 通过 `pnpm run check` 和 `pnpm run check-types` | R01-AC11、R02-AC10、R03-AC16 |
