# 2026-08-05 工作记录：Onboarding 引导 + 个性化计划规则引擎

本次会话围绕一个核心需求展开：**新用户邮箱验证码登录成功后，引导输入个人情况，然后制订本周计划**。
工作分为「代码审查 → 修复问题 → 提交验证 → 推送上线」四个阶段。

---

## 一、需求与背景

- 登录方式：邮箱验证码 OTP（passwordless，已上线）
- 新需求：新用户首次登录后进入 onboarding 引导，采集画像 → 生成个性化一周计划
- 老用户兼容：不强制走引导，可在概览页手动「重新定制计划」
- 硬性约束：**不同用户数据必须隔离**（Supabase RLS + 按 userId 本地缓存）

---

## 二、代码审查结论

对 git 待提交代码做了完整审查，结论：

| 维度 | 评价 |
|---|---|
| 需求实现 | ✅ 流程完整，但存在 1 个影响正确性的 bug |
| 用户数据隔离 | ✅ 达标（RLS + 按 userId 隔离） |
| 代码质量 | ⚠️ 整体良好，4 处需修 |

### 发现的 4 个问题

| 优先级 | 问题 | 位置 |
|---|---|---|
| 🔴 P0 | onboarding 填的体重没写入 `weights`，导致首页 BMI/热量仍按 50.5kg 占位值展示 | `Onboarding.tsx` finish() |
| 🟡 P1 | onboarding 步骤分组与标题不符——「目标」步塞了训练经验/频率/器械 | `Onboarding.tsx` |
| 🟡 P2 | `currentMonday` 在 planEngine 和 store 重复定义 | `planEngine.ts:25` |
| 🟡 P3 | 手腕伤病过滤是死代码（`lower === ''` 恒为 false） | `planEngine.ts:353` |

### 数据隔离验证（已达标）

- `schema.sql`：RLS 策略 `auth.uid() = user_id`（FOR ALL）
- `sync.ts`：查询/upsert 均带 `user_id`
- `store.ts`：本地缓存按 `fitup:u:${userId}` 隔离
- 登出前 `flush()` 防丢数据

---

## 三、修复实施（4 项全部完成）

### P0：onboarding 体重同步到 weights
- `Home.tsx` 新增 `syncWeightFromProfile`，在 `handleOnboard` / `handleRebuild` 调用
- 当 `weights` 只有默认占位 entry（length<=1）时，用当天日期写入真实体重
- 已有真实历史记录的老用户不动

### P1：Onboarding 步骤归位
- 把「训练经验」「每周能练几天」「可用器械」从 `goal` 步移到 `training` 步
- `goal` 步只保留「主要目标」，与进度条标题语义一致

### P2：消除 currentMonday 重复
- `planEngine.ts` 删除本地定义，改为 `import { currentMonday } from '@/lib/store'` + `export`
- 踩坑记录：纯 `export ... from` 不会把符号引入当前模块作用域，导致内部调用报 `Cannot find name`；改为 import + export 两步修正

### P3：删除手腕伤病死代码
- 删除 `shouldFilterByInjury` 里永不触发的手腕分支及未使用的 `lower` 变量
- onboarding 的「手腕」选项保留作记录用途

---

## 四、验证

由于 OTP 是真实 Supabase 邮件验证码（无法在自动化中接收），P0 改用**单元测试**验证：

- 把 `syncWeightFromProfile` 核心逻辑抽成 `store.ts` 的纯函数 `mergeOnboardingWeight(prev, weightKg, today)`
- `Home.tsx` 改为调用该函数
- 新增 6 个单测覆盖全部分支
- **单测捕获并修复了一个真实缺陷**：原 `slice(1)` 会丢掉占位 entry，改为 `[entry, ...prev]` 前插

最终验证全绿：
- `tsc` 类型检查 ✅
- `vitest` 98 tests passed ✅（planEngine 49 + store 45 + utils 4）
- `eslint` 无 error ✅

---

## 五、提交记录（3 个 commit，均已上 origin/main）

```
b78de06 test: 抽 mergeOnboardingWeight 纯函数并补单测，锁定 onboarding 体重同步
0bebc14 chore: gitignore 排除 .zcode 工作区元数据
9f0b3f3 feat: 新用户 onboarding 引导 + 个性化计划规则引擎
```

合并方式：feat 分支快进合并到 main（线性历史），直接推送 origin/main（项目当前 private，未走 PR）。

---

## 六、本次新增/变更的文件

**新增**：
- `app/src/lib/planEngine.ts` — 个性化计划规则引擎（纯函数 + 模块化）
- `app/src/pages/Onboarding.tsx` — 3 步引导向导
- `app/src/test/planEngine.test.ts` — 规则引擎单测（49 个）

**修改**：
- `app/src/lib/store.ts` — 新增 `mergeOnboardingWeight` 纯函数
- `app/src/pages/Home.tsx` — onboarding 编排 + 体重同步 + 老用户兼容
- `app/src/sections/Nutrition.tsx` — 按 weightGoal 区分热量盈余/缺口
- `app/src/sections/Overview.tsx` — 新增「重新定制计划」入口
- `app/src/sections/WeeklyPlan.tsx` — 走规则引擎 + 未知 type 兜底防崩
- `app/src/types/index.ts` — 新增 onboarding 画像枚举与 Profile 字段
- `app/src/test/store.test.ts` — 新增 mergeOnboardingWeight 单测（6 个）
- `.gitignore` — 排除 `.zcode/`

---

## 七、规则引擎设计要点（planEngine.ts）

- `buildWeekPlanFromProfile(profile, week, difficulty)` 主入口
- 按画像差异化生成：肌群分配（splitMuscleGroups）、渐进超负荷（computeProgression）、目标调节（tuneByGoal）、伤病过滤（filterByInjury）
- `day.type` 只用 WeeklyPlan.tsx 已支持的 4 种（strength/sport/rest/recovery），避免渲染崩
- 新手保护：组数封顶 3，避免一开始就上量太大
- 空画像兜底：缺失字段用安全默认值，不抛错

---

## 八、后续待办（backlog）

以下在审查时识别，本次未做，按优先级排列：

1. **onboarding 流程逻辑补单测** — `Home.tsx` 的 `needsOnboarding` / `hasUsageTrace` 判定是纯逻辑分支，值得锁定行为
2. **老字段 `badmintonHours` 与新 `sport`/`sportHours` 语义重叠** — v1 遗留，当前兼容逻辑能跑，可择机废弃
3. **goal 步内容偏单薄** — P1 修复后只剩「主要目标」一项，UX 上可考虑重新划分步骤边界
4. **项目改 public 时的前置工作** — 安全复查（已确认历史无真实密钥）、补 README/LICENSE、恢复 PR 流程、检查 Supabase OTP 白名单配置

---

## 九、关键决策记录

| 决策点 | 选择 | 原因 |
|---|---|---|
| 新用户初始体重如何落 weights | 覆盖默认 entry 为当天 | 语义清晰，是用户首次体重记录 |
| 手腕伤病死代码处理 | 删除 | 手腕承重动作多，过滤易致空池；选项保留作记录 |
| P0 验证方式 | 抽纯函数 + 单测 | OTP 邮件无法自动化接收，纯函数测试更可靠 |
| 提交方式 | 快进合并直推 main | 项目 private，用户授权不走 PR |
