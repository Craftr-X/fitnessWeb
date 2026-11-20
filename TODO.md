# 待办 / 下一步

> 新会话接续：先读 `README.md`「更新日志」，再读本文件。方案细节在 `docs/2026-11-*.md` 与 `AGENTS.md`，这里不重复。
> 核对日期：2026-11-20。`main` = `origin/main` = `386cf0a`（PR #64）。

---

## 当前状态

- **主线已清空**。T1–T10 与教学视频 Storage 都已合入，方案文档已回填。最近一次 `main` push CI 成功。
- 无 open PR、无 open issue、无 stash。本地与远程都只剩 `main`。
- 单测 **370** 例 / **31** 个文件。
- **没有必须现在做的开发任务。** 下面两项是触发制，条件未满足前不开工。

| 已完成 | PR |
|---|---|
| T1+T2 本周对比 / 蜕变入口 | [#50](https://github.com/Craftr-X/fitnessWeb/pull/50) |
| T5 CSV 导出 | [#51](https://github.com/Craftr-X/fitnessWeb/pull/51) |
| T4 账号设置 | [#52](https://github.com/Craftr-X/fitnessWeb/pull/52) |
| T3 反馈表单 | [#53](https://github.com/Craftr-X/fitnessWeb/pull/53) |
| T6 Playwright | [#54](https://github.com/Craftr-X/fitnessWeb/pull/54) |
| T7a 离线写入 | [#55](https://github.com/Craftr-X/fitnessWeb/pull/55) |
| T8 界面打磨 | [#56](https://github.com/Craftr-X/fitnessWeb/pull/56) |
| T9 趋势图按天聚合 | [#58](https://github.com/Craftr-X/fitnessWeb/pull/58) |
| 教学视频 Storage / 清洗 / 补缺口 | [#61](https://github.com/Craftr-X/fitnessWeb/pull/61) [#62](https://github.com/Craftr-X/fitnessWeb/pull/62) [#63](https://github.com/Craftr-X/fitnessWeb/pull/63) |
| T10 记组迷你趋势 + PR | [#64](https://github.com/Craftr-X/fitnessWeb/pull/64) |

2026-11-20 删除已合入的 `docs/demo-supabase-storage-spec`（本地 + `origin`）。PR #60 当时是关闭未合并，其提交已随 #61 进入 `main`。

---

## 触发前不做

与 `AGENTS.md` backlog 一致（2026-11-14 路线评审）：

1. **完整历史页**（原 3b）：任一用户任一动作的 `setLogs` 逼近 `EXERCISE_LOG_CAP = 30`，或训练日历跨度 ≥ 8 周。此前「等 4 周再评」已作废。
2. **PWA / Service Worker 应用壳离线**：移动端占比明显上升，或用户主动问能否装到手机。这不是永久否决，未触发就不做。

---

## 低优先 · 未排期

`assembleWeek` 在 `trainDaysPerWeek = 6` 且填了专项运动时，周六被运动日占用，被挤掉的肌群会回退到周日，牺牲「周日复盘休息日」。

现状：`app/src/lib/planEngine.ts` 约 575–598 行已有兜底——优先找周一到周六的空 `rest` 槽，全满才回退周日，不会丢肌群。这是设计权衡，不是数据错误。

可选改法：有专项运动时把训练日上限限制为 5，或让分组预留运动日槽。动手前先补用例锁住现有行为。

---

## 已决定不做

- **GitHub issue #17**（身材照片对比 + 全维度体测 + AI 健康分析 + 激励报告）：2026-11-11 判定不符合实际。实现 PR #30 / #31 / #32 已于 2026-08-11 关闭且未合入。
- **T7b**：按域分表 / 版本号 / 字段级合并。要动 schema 与 RLS，漏一张表就会跨用户泄露。多设备仍是整文档 last-write-wins。
- **生产构建 e2e**（2026-11-10）：不新增 `build + vite preview`。现有 dev server e2e 保持不动。
- **巨型文件拆分**（`WeeklyPlan.tsx` / `Home.tsx`）：纯内部重构，用户看不见。
- **浏览器对比度数值实测**：T8 只做了类名收敛、源码回归和截图目视，没有跑对比度工具。
- **删未引用 ui 组件**：不成立，现有组件都在用。
- **`DEFAULT_PROFILE.heightCm`**：活字段（BMI、页头、CSV、蜕变报告），不是死代码。
- **T10 明确不含**：新历史页、改 `EXERCISE_LOG_CAP`、改 schema / RLS、新增 localStorage key、自重/时间类次数趋势、替换本周三格纪录卡。

---

## 工作区里不要入库的本地文件

`.superpowers/` 是过程笔记，`docs/code-map/` 是未跟踪的架构 HTML。都不是产品待办，默认不提交。
