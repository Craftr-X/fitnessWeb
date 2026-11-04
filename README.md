<div align="center">

<img src="app/public/favicon.svg" alt="FitUp Logo" width="96" height="96" />

# FitUp 健身计划

**你的私人 AI 健身教练 —— 个性化训练计划、每日打卡、身体数据追踪、每周反馈与营养建议**

[![License: Apache-2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)
[![CI](https://github.com/Craftr-X/fitnessWeb/actions/workflows/ci.yml/badge.svg)](https://github.com/Craftr-X/fitnessWeb/actions/workflows/ci.yml)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Vite](https://img.shields.io/badge/Vite-7-646CFF?logo=vite&logoColor=white)](https://vite.dev)
[![Supabase](https://img.shields.io/badge/Supabase-Backend-3FCF8E?logo=supabase&logoColor=white)](https://supabase.com)
[![Tests](https://img.shields.io/badge/Tests-231%20passed-brightgreen)](#-常用命令)

[功能特性](#-功能特性) · [在线预览](#-应用截图) · [快速开始](#-快速开始) · [部署](#-部署) · [项目结构](#-项目结构)

</div>

---

新用户通过**邮箱验证码**免密登录后，经引导流程采集身体画像（目标、器械、频率、专项运动、伤病等），计划引擎自动生成**匹配你的一周训练计划**，并随每周反馈持续进阶调整。

<div align="center">
  <img src="docs/promo/09-overview-desktop.png" alt="FitUp 总览页" width="900" />
</div>

## ✨ 功能特性

- 🔐 **邮箱验证码登录** — passwordless，无需记忆密码
- 🎯 **个性化计划引擎** — 按目标（增肌/减脂/塑形/保持）、器械、训练频率、专项运动、伤病生成差异化一周计划
- 📈 **渐进超负荷** — 计划随周数自动进阶，并根据上周反馈难度动态调节
- 🔁 **动作替换** — 某个动作不想练？一键换成同肌群、同器械、避开伤病的平替，组数次数按当周进度换算，替换后自动清理该动作打卡、保留历史重量记录
- ✅ **打卡 + 记组** — 逐动作勾选；也可以只记重量/次数，保存后自动打卡，省掉再点一次的重复操作
- ⚖️ **身体数据追踪** — 体重/体脂记录与趋势图
- 🔄 **每周反馈** — 完成度、难度、酸痛、睡眠、饮食，完成度默认取本周真实打卡率，反馈驱动下周调整
- ⏱️ **组间休息计时器** — 记完一组自动倒计时，切页不中断，结束三连音 + 手机振动
- 📅 **训练日历** — 打卡、称重、反馈按月回看（中文月历）
- 🍗 **营养建议** — 按体重目标计算热量盈余/缺口与蛋白质摄入，从今日页一键打开
- 🧭 **三个一级入口** — 今日 / 计划 / 数据，路由化（`#/today`、`#/plan`、`#/data`）：刷新保持、返回键在 Tab 间回退
- 🔒 **用户数据隔离** — Supabase RLS 行级安全，每个用户只能访问自己的数据
- 📤 **数据可携带 / 可删除** — 一键导出全部个人数据，自助删除账号（合规）
- ♻️ **跨周自动续期** — 进入新自然周自动生成新计划，多周未打开可一次性补齐
- 🌙 **现代前端体验** — 暗色模式、路由懒加载、移动端自适应；首屏 gzip ≈ 237KB

## 📸 应用截图

### 桌面端

<div align="center">
  <img src="docs/promo/10-plan-desktop.png" alt="每周计划" width="49%" />
  <img src="docs/promo/11-data-desktop.png" alt="数据记录" width="49%" />
  <img src="docs/promo/12-feedback-desktop.png" alt="每周反馈（弹层）" width="49%" />
  <img src="docs/promo/13-nutrition-desktop.png" alt="营养建议（弹层）" width="49%" />
</div>

### 移动端

<div align="center">
  <img src="docs/promo/04-overview-mobile.png" alt="今日" width="19%" />
  <img src="docs/promo/05-plan-mobile.png" alt="每周计划" width="19%" />
  <img src="docs/promo/06-data-mobile.png" alt="数据记录" width="19%" />
  <img src="docs/promo/07-feedback-mobile.png" alt="每周反馈（弹层）" width="19%" />
  <img src="docs/promo/08-nutrition-mobile.png" alt="营养建议（弹层）" width="19%" />
</div>

## 🛠 技术栈

| 类别 | 技术 |
|---|---|
| 框架 | React 19、React Router 7 |
| 构建 | Vite 7、TypeScript 5.9 |
| 样式 | Tailwind CSS 3、shadcn/ui（Radix UI） |
| 后端 | Supabase（Auth + Postgres + RLS） |
| 可视化 | Recharts（懒加载，只在数据页下载） |
| 测试 | Vitest + Testing Library（231 个单元测试） |
| CI/CD | GitHub Actions（lint + test + build → Pages 部署、Supabase 每日保活） |

## 🚀 快速开始

**前置要求**：Node.js 18+，一个 [Supabase](https://supabase.com) 项目。

```bash
# 1. 克隆仓库
git clone https://github.com/Craftr-X/fitnessWeb.git
cd fitnessWeb/app

# 2. 安装依赖
npm install

# 3. 配置环境变量（填入你的 Supabase 凭据）
cp .env.example .env.local

# 4. 启动开发服务器
npm run dev   # http://localhost:3000
```

Supabase 配置（建表 + RLS + Auth）详见 [`app/README.md`](app/README.md)，建表 SQL 在 [`app/supabase/schema.sql`](app/supabase/schema.sql)。

## 📋 常用命令

```bash
cd app
npm run dev        # 开发服务器
npm run build      # 类型检查 + 生产构建
npm run test       # 单元测试（231 个）
npm run lint       # ESLint
```

## 📦 部署

推送到 `main` 分支后，GitHub Actions 自动构建并部署到 GitHub Pages。完整部署步骤（含 Supabase SMTP / OTP 邮件配置）见 [`DEPLOY.example.md`](DEPLOY.example.md)。

线上后端为 Supabase 免费版，连续 7 天无 API 活动会被自动暂停（线上登录报 `Failed to fetch`）。仓库内置每日保活任务 [`keepalive.yml`](.github/workflows/keepalive.yml)，无需人工干预；若该任务报错，按日志提示到 Dashboard 手动 Resume 即可。

## 📂 项目结构

```
fitnessWeb/
├── app/                      # 前端应用
│   ├── src/
│   │   ├── lib/              # 核心逻辑（store 同步、planEngine 规则引擎、supabase）
│   │   ├── pages/            # 页面（Home、Auth、Onboarding）
│   │   ├── sections/         # 一级 Tab 区块（Overview、WeeklyPlan、BodyData 等）
│   │   ├── components/       # 业务组件（TodayHero、RestTimer、FeedbackDialog 等）
│   │   ├── components/ui/    # shadcn/ui 组件（按需保留，23 个）
│   │   ├── hooks/            # useAuth、useCountUp 等
│   │   └── types/            # TypeScript 类型定义
│   ├── supabase/schema.sql   # 建表 + RLS 策略
│   └── README.md             # 开发详细文档
├── docs/                     # 工作记录与推广截图
├── review-2026-11-03/        # 一次完整走查报告（含截图，可删除）
├── .github/workflows/        # CI（lint+test+build）+ CD（Pages 部署）+ Supabase 保活
└── DEPLOY.example.md         # 部署配置文档
```

## 🗒 更新日志

### 2026-11 · 一次完整走查后的重构

- **修复 6 个 P0**：训练日历塌陷成 131px / 月份英文（shadcn 组件用了 Tailwind v4 语法）、记组被预填的 0 阻断、蜕变弹窗超出视口、第 1 周「+0」文案、反馈完成度假默认值（导致 `<60%` 降阶规则永不触发）、「开始今日训练」不定位到今天
- **导航 5 → 3**：`今日 / 计划 / 数据`；每周反馈、营养建议降级为弹层，仍按需加载
- **英雄卡两态**：今日页完整版，计划/数据页压成一行 —— 移动端首屏占用 322px → 60px
- **计划页只展开今天**：日卡可折叠，移动端页高约 4300px → 1568px
- **Tab 路由化**：`#/today`、`#/plan`、`#/data`（HashRouter），刷新保持、返回键在 Tab 间回退
- **记组自动打卡**、**计时器振动**、**训练日历中文化 + 桌面两栏**
- **性能**：recharts 不再被首屏预加载、inspect 插件仅 dev 生效 —— 首屏 gzip **349KB → 237KB（−32%）**
- **清理**：删除 30 个没被引用的 shadcn 组件（−4199 行）与 20 个依赖；单测 225 → 231

## 🤝 参与贡献

欢迎提交 Issue 和 Pull Request！

1. Fork 本仓库
2. 创建特性分支：`git checkout -b feat/amazing-feature`
3. 提交改动：`git commit -m "feat: add amazing feature"`
4. 推送分支：`git push origin feat/amazing-feature`
5. 发起 Pull Request

提交前请确保 `npm run lint` 和 `npm run test` 全部通过。

## 📄 License

基于 [Apache License 2.0](LICENSE) 开源。

---

<div align="center">
  如果这个项目对你有帮助，欢迎 ⭐ Star 支持一下！
</div>
