# UX 首周体验三连 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修掉周中注册首日空落感、过早的「完成本周」催促、计划页信息过载三处体验断点。

**Architecture:** 纯前端 UX。可测逻辑抽到 `store.ts`（下次训练日、默认展开日、是否展示周切换 CTA）；`TodayHero` / `WeeklyPlan` / `Home` 接线。不改 schema、不新增 localStorage key。

**Tech Stack:** React 19、Vitest、现有 Tailwind / shadcn。

---

### Task 1: 纯函数 + 单测

**Files:**
- Modify: `app/src/lib/store.ts`
- Modify: `app/src/test/store.test.ts`

- [x] `nextTrainDayIndex(days, fromIdx)`：从 fromIdx 起（含）找下一个 `strength|sport`，没有则向后找，整周没有返回 null
- [x] `defaultExpandedDayIndices(days, todayIdx)`：今天 +（若今天 rest 则）下次训练日
- [x] `shouldOfferWeekAdvance(completionPct)`：`pct >= 50` 才返回 true
- [x] 单测覆盖边界

### Task 2: 休息日首屏导向下次训练

**Files:**
- Modify: `app/src/components/TodayHero.tsx`
- Modify: `app/src/pages/Home.tsx`
- Modify: `app/src/sections/WeeklyPlan.tsx`
- Modify: `app/src/test/uiPolish.test.tsx`

- [x] TodayHero 休息日：文案提示下次训练；主 CTA「去练周X·焦点」
- [x] Home `onStart`：休息日时 focus 到下次训练日索引
- [x] WeeklyPlan：锚点按日；`focusToken` 展开并滚到目标日

### Task 3: 弱化周切换 CTA + 默认只展开今天

**Files:**
- Modify: `app/src/sections/WeeklyPlan.tsx`

- [x] 完成度 &lt; 50% 时，蓝卡只留调整说明，不放两大按钮；文末小字链接触发周切换（仍二次确认）
- [x] `expandedDays` 初始用 `defaultExpandedDayIndices`（全视口统一，不再桌面全展开）

### Task 4: 验证

- [x] `npm test && npm run lint && npm run build`
