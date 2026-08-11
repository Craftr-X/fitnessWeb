# 待办 / 下一步

> 新会话接续方式：打开本文件即可。或对 ZCode 说「看下 TODO」/「继续 TODO 里的事」。

---

## 🔴 删老模板死代码（第二步清理）—— ✅ 已完成 2026-08-11

- **完成时间**：2026-08-11（应 [2026-08-11 代码审核] 要求提前动手）
- **背景**：`docs/2026-08-10-legacy-onboarding-migration.md` 第四节。软迁移上线后，
  `store.buildWeekPlan` / `store.copyWeekPlan` 已成事实死代码（规则引擎 `planEngine.buildWeekPlanFromProfile` 成为唯一计划生成入口）。

### 清理清单（全部完成）

- [x] `store.buildWeekPlan`、`store.copyWeekPlan` 删除（确认无引用后）
- [x] `planEngine.buildNextWeekPlan` 的回退分支删除（不再回退到老模板，profile 缺失按默认画像兜底）
- [x] `WeeklyPlan.tsx` 的 `copyWeekPlan` 换用 `planEngine.copyWeekPlanFromProfile`
- [x] `defaultCloudState` 的 50.5kg 占位体重 → 空数组 `[]`，`Overview` / `Nutrition` / `Home` 补空态处理
- [x] `mergeOnboardingWeight` 逻辑简化：空数组时插入当天 entry，已有记录不动
- [x] `store.test.ts` 删除 `buildWeekPlan` / `copyWeekPlan` 旧 describe 块（23 个用例）
- [x] `planEngine.test.ts` 的「未 onboarded 回退老模板」测试改为「profile 缺失按默认画像兜底」
- [x] `weeklyPlan.setlog.test.tsx` 改用固定 `TEST_PLAN` 字面量，不再依赖老模板
- [x] 跑 `test` / `lint` / `build` 确认全绿（171 tests / lint 0 errors / build ✓）

### 待办（未列入本次清理）

- [ ] `DEFAULT_PROFILE.heightCm` 等老模板残留个人化字段复核（独立任务，本次未做）
- [ ] assembleWeek 的 trainDays=6 + hasSport 场景（6 力量 + 1 运动 = 7 天，周日无空位）
  当前实现把第 6 个训练日挪到周日，会牺牲「周日复盘休息日」。后续可考虑限制 hasSport 时 trainDays 上限为 5，
  或调整 splitMuscleGroups 预留运动日 slot

---

## 历史 / 已完成

- 2026-08-10 老用户软迁移（PR #28）：onboarding 成为生成计划的唯一入口
- 2026-08-10 cloudDirty 脏标记重推（已合并）：防抖窗口内的改动不再被远端旧数据覆盖
