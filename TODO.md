# 待办 / 下一步

> 新会话接续方式：打开本文件即可。或对 ZCode 说「看下 TODO」/「继续 TODO 里的事」。

---

## 🔴 删老模板死代码（第二步清理）

- **适用起始**：2026-08-13（等老用户软迁移 PR #28 在线上跑 3 天确认无老用户被卡住后）
- **前置确认**：PR #28 已合并到 main，且线上未出现老用户迁移异常反馈
- **背景**：`docs/2026-08-10-legacy-onboarding-migration.md` 第四节。软迁移上线后，
  `store.buildWeekPlan` / `store.copyWeekPlan` 已成事实死代码（规则引擎 `planEngine.buildWeekPlanFromProfile` 成为唯一计划生成入口）。

### 清理清单

- [ ] `store.buildWeekPlan`、`store.copyWeekPlan` 删除（确认无引用后）
- [ ] `planEngine.buildNextWeekPlan` 的回退分支删除（不再回退到老模板）
- [ ] `WeeklyPlan.tsx` 的 `copyWeekPlan` 换用 `planEngine.copyWeekPlanFromProfile`
- [ ] `defaultCloudState` 的 50.5kg 占位体重 → 空数组 `[]`，各区块补空态处理
- [ ] `DEFAULT_PROFILE.heightCm` 等老模板残留个人化字段复核
- [ ] 跑 `test` / `lint` / `build` 确认全绿
- [ ] 更新本文件或新增设计文档记录清理结果

### 验证口径

- 删除前先全局 grep 引用：`grep -rn "buildWeekPlan\b\|copyWeekPlan\b" app/src --include="*.ts" --include="*.tsx"`
- 注意排除 `buildWeekPlanFromProfile` / `copyWeekPlanFromProfile`（规则引擎保留）
- 删除后测试套件应仍 179+ 通过

---

## 历史 / 已完成

- 2026-08-10 老用户软迁移（PR #28）：onboarding 成为生成计划的唯一入口
- 2026-08-10 cloudDirty 脏标记重推（已合并）：防抖窗口内的改动不再被远端旧数据覆盖
