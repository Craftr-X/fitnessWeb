# FitUp 健身计划

个人健身追踪应用：每周训练计划（渐进超负荷）、打卡、体重/体脂记录、每周反馈、营养建议。
基于 React 19 + Vite + TypeScript + Tailwind + shadcn/ui，账号与数据存储使用 Supabase。

## 本地开发

```bash
cd app
npm install
cp .env.example .env.local   # 填入你的 Supabase 凭据
npm run dev
```

## Supabase 配置（一次性）

1. 在 [supabase.com](https://supabase.com) 创建免费项目。
2. 在 **SQL Editor** 中执行 `supabase/schema.sql`（建表 + 行级安全策略）。
3. **Authentication → Providers** 确认 Email 已开启（默认开启；测试期可关闭 "Confirm email" 免去邮箱验证）。
4. 在 **Project Settings → API** 复制 Project URL 和 anon public key，填入 `.env.local`。

anon key 放在前端是安全的：数据隔离由 Postgres RLS 保证，每个登录用户只能读写自己的数据行。

## 部署（GitHub Pages）

推送到 `main` 分支自动构建部署（`.github/workflows/deploy.yml`）。
需要在仓库 **Settings → Secrets and variables → Actions** 配置：

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

## 常用命令

```bash
npm run dev      # 开发服务器（端口 3000）
npm run build    # 类型检查 + 生产构建
npm run lint     # ESLint
```
