# FitUp T9 趋势图按天聚合技术方案

> 状态:**已定稿**(2026-11-14,PM)· 来源:T8 方案 §2.6 低优先可选项,本次独立实施
> 流水线:产品/PM=主会话;研发=独立子代理;测试=另一子代理(与研发不同代理);审阅=code-review 双轴
> 分支:`feat/chart-day-aggregation` · commit 前缀 `feat:`

## 1. 背景与目标

- **现状**:`BodyData.tsx:138-149` 的 `chartData` 把每条 `WeightEntry` 画成图上一个点,同一天早晚各记一条时出现两个点、X 轴标签带时刻(`M/d HH:mm`),线条呈锯齿,趋势可读性差。
- **目标**:趋势图**一天一个点**——同一天多条按 `date+time` 升序取**最后一条**;X 轴标签只保留 `M/d`;历史表格(最近 15 条)仍列全部记录,信息不丢。
- **前提说明**:同天多记的真实频率在代码侧无法统计(数据在用户 localStorage / 云端),按 2026-11-14 产品评审结论「成本极低、值得做」直接实施。

## 2. 改动点

1. **新增** `app/src/lib/weightChart.ts`(纯函数,无 React 依赖,仿 `weekCompare.ts` 模式):
   - `dailyChartData(weights, range): { date: string; 体重: number; 体脂?: number }[]`
   - 语义:先按 range 窗口过滤(7/30 天 cutoff,`all` 不过滤,与现状一致),再按天聚合——按 `keyOf`(date+time)升序遍历,同一天**后者覆盖前者**;输出按日期升序。
   - X 轴标签生成移入该函数(只 `M/d`,不再拼 time)。
2. `BodyData.tsx` 的 `chartData` 改为调用该函数,删除内联聚合与标签拼接逻辑。
3. 空态文案「至少记录 2 天数据后…」(`:311-313`)语义在聚合后更准确(同天 2 条不再触发画图),**保持不动**。

## 3. 明确不做

- 不改 `weights` 写入路径、`store.ts` / `sync.ts`、任何 localStorage key
- 不改历史表格行为(仍显示最近 15 条 + 总数)
- 不改图表样式 / 颜色 / Y 轴域,只改数据点数量与 X 轴标签
- 不新增 Tab / 页面 / 路由

## 4. 验收标准

### 单测(测试代理补齐)

- 纯函数 `weightChart.test.ts`:
  1. 同天两条(08:00 / 20:00)→ 输出 1 个点,取 20:00 那条的体重/体脂
  2. 同天一条带 time、一条不带 → 不带的可排序在前,取后者
  3. 不同天两条 → 2 个点,按日期升序
  4. `range='7'` 只含窗口内的天;窗口边界当天的最后一条仍在
  5. `bodyFat` 为 null 的记录不产生体脂字段(与现状 `?? undefined` 一致)
  6. 空数组 → 空输出
- 组件 `bodyData.chart.test.tsx`(或并入 `uiPolish.test.tsx`,以现有 mock 模式省力为准):
  - 构造同天两条记录 → 图表数据源只剩 1 个点,历史表格仍渲染 2 行

### 全量门禁

- `npm run lint` 0 error;`npm run test` 全绿(单测总数在 339 基础上增加,具体数字以实跑为准);`npm run build` 通过
- `npm run test:e2e` `@smoke` 连跑 3 次全绿;`npm run test:visual` 不回归、无 `No tests found`
- 数据页截图 390 / 1440 × 深浅色留档 `docs/e2e-screenshots/2026-11-14-t9/`(沿用 `visual-ui-polish.spec.ts` 的数据 Tab 取景)

### 文档(合并前完成)

- `README.md` 更新日志追加 `### 2026-11-14 · 趋势图按天聚合(T9)`;单测数变化同步四处口径(badge / 技术栈表 / 常用命令 / 总览速览)
- 本文件状态改「已实施」并回填 PR 号与验收结果(§5)

## 5. 验收回填(实施后由 PM 填写)

- PR:待回填
- 单测数:待回填
- 各门禁实跑结果:待回填
