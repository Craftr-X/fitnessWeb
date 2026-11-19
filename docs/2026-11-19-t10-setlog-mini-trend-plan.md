# T10 · 记组弹窗迷你趋势 + PR 标记

**日期**：2026-11-19  
**状态**：待实施（方案已定稿：完整方案 A）  
**估时**：约 1d  
**前置**：T9 已完成；完整历史页（3b）仍为触发制，本任务不做

---

## 1. 目标

在**现有记组弹窗**内，把「上次重量」提示升级为：

1. 最近 **N=5** 次训练的**最大重量**迷你折线  
2. **个人纪录（PR）**标记（相对该动作历史最大重量）

**明确不做**

- 不开新 Tab / 新页面（完整历史页仍按触发条件另议）  
- 不改 `EXERCISE_LOG_CAP`、不改云端 schema / RLS  
- 不新增 localStorage key  
- 自重 / 时间类动作本轮**不画**次数趋势（无 `weightKg` 时迷你趋势区域不展示）  
- 不替换本周三格纪录卡（容量 / 重量 / 1RM）的既有逻辑

---

## 2. 现状

- 弹窗：`WeeklyPlan.tsx` → `ExerciseLogDialog`  
- 「上次」文案 + 预填：`lastRec` + `getLastLogBefore`  
- 本周纪录：`exerciseWeekStats(weekRecords)`（仅本周）  
- 数据：`setLogs[动作名]: ExerciseLogRecord[]`（按日期，cap 30）

---

## 3. 方案 A（定稿）

### 3.1 数据纯函数（新建 `app/src/lib/setLogTrend.ts`）

| 函数 | 行为 |
|---|---|
| `sessionMaxWeight(sets)` | 一组内最大 `weightKg`；全无则 `null` |
| `recentMaxWeightPoints(records, beforeDate, n=5)` | `date < beforeDate` 的记录从新到旧取，过滤无重量场次，最多 n 点，再按日期升序返回 `{ date, maxWeight }[]` |
| `allTimeMaxWeight(records)` | 全历史最大重量；无则 `0` |
| `isPrPoint(weight, allTimeMax)` | `weight > 0 && weight >= allTimeMax`（相等即持平 PR；用于标记末点/上次） |
| `isNewPr(prevAllTimeMax, newSessionMax)` | 保存后 `newSessionMax > prevAllTimeMax` |

### 3.2 UI

- 位置：替换/升级现有琥珀色「上次…已为你预填」条上方或合并为同一卡片：  
  - 左：约 120×36 迷你折线（**纯 SVG**，不引入 recharts，避免记组路径变重）  
  - 右：末点重量文案 + 若末点为历史最大则 `PR` badge  
- 点数：0 → 不渲染趋势块；1 → 单点 + 「仅 1 次记录」；≥2 → 折线  
- 预填逻辑不变  
- 保存成功且 `isNewPr`：用现有 `toast`（sonner）轻提示「新纪录 🎉」或「刷新个人最好重量」

### 3.3 边界

- 仅 `loadType === 'weighted'` 显示趋势  
- 历史点取自该动作全部 `setLogs`（含跨周，受 30 条 cap 自然限制）  
- PR 相对**全历史**最大重量，不是仅本周

---

## 4. 改动文件

| 文件 | 改动 |
|---|---|
| `app/src/lib/setLogTrend.ts` | 新建纯函数 |
| `app/src/test/setLogTrend.test.ts` | 单测 |
| `app/src/sections/WeeklyPlan.tsx` | 弹窗 UI + 保存时新纪录 toast |
| `app/src/test/weeklyPlan.setlog.test.tsx` | 补弹窗趋势 / PR 断言（能测 DOM 的部分） |
| `README.md` | 单测数四处口径（若用例数变） |
| `AGENTS.md` | backlog T10 标完成（合并后回填） |
| 本文件 | 合并后回填 PR 号与验收 |

---

## 5. 验收标准

1. 负重动作、≥2 次历史：打开记组弹窗可见迷你折线，末点数值正确  
2. 末点等于历史最大重量：可见 PR 标记  
3. 保存后重量创新高：toast 提示新纪录；未破纪录无误报  
4. 自重/时间类：无趋势块  
5. 无历史：不出现空白占位块  
6. `lint` / `test` / `build` 绿；`@smoke` 连跑 3 次（记组路径已有 e2e）  
7. 视觉：不强制全套 visual suite（非全站视觉改版）；若改动明显可补 390 记组弹窗截一张留档（可选）

---

## 6. 风险

| 风险 | 缓解 |
|---|---|
| 弹窗变挤 | 趋势条高度限制 ~40px，与「上次」合并 |
| recharts 体积 | 明确用 SVG，不 lazy 进 recharts |
| PR 误报 | 严格 `>` 判定新纪录；持平只标 PR 不 toast |

---

## 7. 实施顺序

1. TDD：`setLogTrend` 纯函数  
2. 弹窗接入 + toast  
3. 单测 / smoke  
4. README + AGENTS 回填 → PR → 合并
