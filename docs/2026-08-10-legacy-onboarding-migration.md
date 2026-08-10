# 2026-08-10 老用户软迁移：onboarding 成为生成计划的唯一入口

## 一、背景

计划体系有两代：`store.buildWeekPlan`（硬编码的老模板，含原作者个人信息：周六羽毛球、
默认身高 163cm、占位体重 50.5kg）和 `planEngine.buildWeekPlanFromProfile`（按 onboarding
画像生成的规则引擎）。此前老用户（账号体系上线前已有数据、未 onboarded）会被
`shouldBackfillOnboarded` 静默补标志后直接进主界面，永远停留在老模板上。

## 二、方案：软迁移，不清云端数据

让老用户走一遍 onboarding 完成迁移，**不碰 Supabase 里的历史数据**：

- `needsOnboarding` 简化为 `ready && !onboarded`，与是否有使用痕迹无关；
  删除 `shouldBackfillOnboarded` 及 Home 里的静默补标志逻辑
- 老用户（`hasUsageTrace`）走引导时通过 Onboarding 已有的 `existing` prop 预填画像，
  最新真实体重取自 `weights` 末条（占位 entry 不算）
- 完成时（`handleOnboard` / `handleRebuild`）：写入画像 + 引擎生成的第 1 周计划，
  **清空 checks**（旧打卡 key `周:日:动作` 会错配到新计划；历史完成度已快照在
  `feedbacks.completion`，体重历史原样保留）
- 周数从第 1 周重新开始：进阶曲线与新计划难度匹配，延续旧周数会过度进阶
- `DEFAULT_PROFILE.heightCm` 163 → 170（中性默认值，去个人化）

顺手修了一个既有 bug：`handleRebuild`（总览页"重新定制"）此前不清 checks，
同样存在幻影打卡错配。

## 三、安全性依据（改动前核实）

- 历史周 checks 无任何 UI 读取：Home/Overview/WeeklyPlan 都只读当前周
- Feedback 完成度是提交时快照进 `WeekFeedback.completion` 的滑块值，不从 checks 反算
- 清空 checks 唯一影响是 `hasUsageTrace` 的判定输入，迁移完成后该判定不再参与路由

## 四、后续（第二步，尚未做）

老模板已是事实死代码，待迁移在线上生效后删除：
`store.buildWeekPlan` / `store.copyWeekPlan`（WeeklyPlan 换用
`planEngine.copyWeekPlanFromProfile`）/ `buildNextWeekPlan` 回退分支，
以及 50.5kg 占位体重改空数组 + 各区块空态处理。

## 五、改动与测试

- `app/src/lib/store.ts`、`app/src/pages/Home.tsx`（Onboarding.tsx 零改动，`existing` 现成）
- `app/src/test/store.test.ts`：路由测试按新语义重写，锁定"老用户也进引导"
- 验证：`npm run test`（179 通过）/ `lint` / `build` 全绿
