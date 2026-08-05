# FitUp 健身计划

> 个人健身追踪应用：个性化训练计划、打卡、体重/体脂记录、每周反馈、营养建议。
> 新用户邮箱验证码登录后，通过引导采集画像，自动生成匹配的一周训练计划。

[![License: Apache-2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)

## ✨ 功能

- **邮箱验证码登录**（passwordless，无需密码）
- **个性化计划引擎** — 按目标（增肌/减脂/塑形/保持）、器械、训练频率、专项运动、伤病生成差异化一周计划
- **渐进超负荷** — 计划随周数自动进阶，并根据上周反馈难度动态调节
- **每日打卡** — 训练动作逐项勾选，完成动画激励
- **身体数据追踪** — 体重/体脂记录与趋势图
- **每周反馈** — 完成度、难度、酸痛、睡眠、饮食，反馈驱动下周调整
- **营养建议** — 按体重目标计算热量盈余/缺口与蛋白质摄入
- **用户数据隔离** — Supabase RLS 行级安全，每个用户只能访问自己的数据
- **跨周自动续期** — 进入新自然周自动生成新计划，多周未打开可一次性补齐
- **暗色模式 / 路由懒加载** 等现代前端体验

## 🛠 技术栈

| 类别 | 技术 |
|---|---|
| 框架 | React 19、React Router 7 |
| 构建 | Vite 7、TypeScript 5.9 |
| 样式 | Tailwind CSS 3、shadcn/ui（Radix UI） |
| 后端 | Supabase（Auth + Postgres + RLS） |
| 表单 | React Hook Form、Zod |
| 可视化 | Recharts |
| 测试 | Vitest（114 个单元测试） |
| 部署 | GitHub Pages（GitHub Actions） |

## 🚀 快速开始

```bash
cd app
npm install
cp .env.example .env.local   # 填入你的 Supabase 凭据
npm run dev                   # http://localhost:3000
```

Supabase 配置（建表 + RLS + Auth）详见 [`app/README.md`](app/README.md)。

## 📋 常用命令

```bash
cd app
npm run dev        # 开发服务器
npm run build      # 类型检查 + 生产构建
npm run test       # 单元测试
npm run lint       # ESLint
```

## 📦 部署

推送到 `main` 自动部署到 GitHub Pages。完整部署步骤（含 Supabase SMTP / OTP 配置）见 [`DEPLOY.example.md`](DEPLOY.example.md)。

## 📂 项目结构

```
fitnessWeb/
├── app/                    # 前端应用
│   ├── src/
│   │   ├── lib/            # 核心逻辑（store 同步、planEngine 规则引擎、supabase）
│   │   ├── pages/          # 页面（Home、Auth、Onboarding）
│   │   ├── sections/       # 首页 tab 区块（Overview、WeeklyPlan、Nutrition 等）
│   │   ├── components/ui/  # shadcn/ui 组件
│   │   ├── hooks/          # useAuth 等
│   │   └── types/          # TypeScript 类型定义
│   ├── supabase/schema.sql # 建表 + RLS 策略
│   └── README.md           # 开发详细文档
├── docs/                   # 工作记录
├── .github/workflows/      # CI（lint+test+build）+ CD（Pages 部署）
└── DEPLOY.example.md       # 部署配置文档
```

## 📄 License

[Apache License 2.0](LICENSE)
