# FitUp T8 页面整洁与体验打磨技术方案

> **状态**：**已实施** · 2026-11-10 · PR [#56](https://github.com/Craftr-X/fitnessWeb/pull/56) · 分支 `feat/ui-polish`（从 `main@fc677dd` 切出）
> **上游**：`docs/2026-11-06-next-tasks-plan.md` §1 / §3.2、`review-2026-11-03/REVIEW.md` §三 §四 §五、`docs/2026-11-09-t7a-offline-hardening-plan.md`
> **定位**：新一轮的第一个 PR。只做用户看得见的「减重复 / 收长列表 / 提可读性 / 补空态」，**不动数据层、不动同步模型、不新增依赖、不改导航结构**。
> **基线**：`main@fc677dd`（PR #50–#55 全部合并，T1–T7a 已落地）
> **方向调整说明**：本轮原候选是「应用壳离线（SW / PWA）」，分支初名 `feat/offline-shell`。因当前用户量很少、目标是页面整洁好看与体验舒服，改判为 UI 打磨；分支已改名 `feat/ui-polish`，改名时尚未提交或 push，零成本。SW / PWA 与历史训练数据留作后续候选，不在本方案。

---

## 0. 给执行者：先读这一节

### 0.1 一句话目标

把「今日」Tab 同屏重复三四遍的完成度数字收敛成一处，把占满一屏的 5 条关键提醒折起来，把弱化到看不清的小字提回可读，并给空态与弱网补上说明和首帧 —— 让少数现有用户第一眼觉得干净、不用猜。

### 0.2 为什么现在做（不是加功能，是减负担）

用户量还很少，没有增长与并发压力，此时最划算的不是补极端场景、也不是继续加功能，而是把现有用户每天都会看到的界面收拾干净。用三条真实诉求重算上一轮的候选：

| 候选 | 结论 | 原因 |
|---|---|---|
| ① 应用壳离线（SW / PWA） | 不做 | 断网冷启动几乎不会发生；主要风险是缓存旧版 JS，部署后少数用户看到旧页面，与「整洁好看」反向下注；还要新增生产构建 e2e 链路 |
| ② 历史训练数据 | 不做（时机不对） | 真实产品缺口（`setLogs` 每动作 30 条、CSV 只导当前周），但要加列表 / 筛选 / 图表，页面更满，还要动数据模型；用户少时没有真实反馈支撑看什么维度 |
| ③ 包体与工程债 | 重定义后做 | 原清单里的「删 30 个未引用组件」「recharts lazy」「Tab 从 5 降到 3」实测均已不成立（见 §0.4）；剩下的拆巨型文件是纯内部重构，用户看不见 |
| ③′ **UI 整洁与体验打磨** | **本方案** | 用户可见、风险低、不碰数据层，且能用现有 `@visual` 截图机制直接验收 |

一句话：**这轮交付的是「少一点、清楚一点」，不是「多一点」**。

### 0.3 现状基线（改之前先记住这些数字）

| 项 | 值 |
|---|---|
| 分支 / 基线 | `feat/ui-polish` ← `main@fc677dd` |
| 单测 | 23 个测试文件 / **323 例**（Vitest + jsdom） |
| e2e | 4 条 `@smoke`、3 条 `@offline`、2 条 `@visual`（共 16 张截图） |
| 主要文件行数 | `Home.tsx` 550、`WeeklyPlan.tsx` 952、`Overview.tsx` 461、`BodyData.tsx` 362 |
| ui 组件 | `app/src/components/ui/` 共 23 个，**全部被业务代码引用** |
| 导航 | 3 个 Tab（`Home.tsx:440-442`：今日 / 计划 / 数据），5 个 section 均 `lazy()`（`:44-48`） |
| 主题 | Tailwind **3.x**；`index.css` 浅色 `--primary: 173 80% 32%`、`--muted-foreground: 200 12% 42%` |
| README 口径 | `323` 出现在第 15 / 77 / 107 / 220 行，改动后需四处同步 |

### 0.4 已经做好的（不要重做，也不要写进验收）

> **重要**：上一轮口头清单里有 4 项经逐行核实**已经修好**，本方案已剔除。别把已完成的事再算一遍。

| 项 | 现状 | 证据 |
|---|---|---|
| 360px 标题截断 | 已修 | `Home.tsx:296-302` 用 `min-w-0 flex-1` + `truncate`，`sm` 以下隐藏邮箱 |
| 记组后自动勾选 | 已修 | `WeeklyPlan.tsx:906-913` 的 `onSave` 同时写 `setSetLogs` 与 `toggle()`；`weeklyPlan.setlog.test.tsx:171/185` 有回归 |
| 计划页默认只看今天 | 已修（移动端） | `WeeklyPlan.tsx:525-529`，`< 768px` 默认只展开今天，桌面仍全展开 |
| 紧凑月历 / 中文化 | 已修 | `BodyData.tsx:84-98` 单月 `zhCN`，`calendar.tsx` 固定 `--cell-size:2.25rem` |
| 删未引用 shadcn 组件 | 不成立 | 23 个 ui 组件全部被引用，未引用清单为空 |
| recharts 首屏 | 已缓解 | `BodyData.tsx:4` 虽是顶层 import，但 `Home.tsx:46` 路由级 `lazy()`，不进首屏包 |
| 反馈表单 / 设置弹层 / 蜕变入口收起 | 已修 | T3 / T4 / T2 已合并 |
| Tab 从 5 降到 3、英雄卡双态 | 已修 | `Home.tsx:440-442`、`:430` `compact={tab !== 'today'}` |

### 0.5 四条硬约束（破坏了会出事）

1. **Tailwind 是 3.x**：不要写 v4 语法（`size-(--x)`、`[--cell-size:--spacing(8)]`、`origin-(--radix-…)`）。这类类名在 v3 下静默失效，曾导致训练日历塌成 131px。任意值请用 `[var(--x)]` 形式。
2. **不碰数据层**：不改 `CloudState` 七个域、不改 `store.ts` / `sync.ts` 的 `loadError` 与 dirty 语义、不新增 localStorage key、不动 `schema.sql` / RLS。折叠状态只放 React 内存，刷新回默认值即可。
3. **不新增依赖、不改弹层 API**：不引入设计系统 / 主题库 / 图表库；`FeedbackDialog` 等弹层的 `trigger` / `open` 双模式保持不变。`vite.config.ts` 继续保持对象式导出（`vitest.config.ts` 依赖它做 `mergeConfig`）。
4. **视觉改动必须可回归**：任何外观变化都要有 390 / 1440 × 深浅色的前后对比截图，且有渲染测试锁住结构。这是把「好看」这种主观判断变成可验收项的唯一办法。

### 0.6 明确接受的风险（写进 PR 正文，别藏）

- **主观性**：没有设计稿，配色与间距以「可读性 + 一致性」为准，不做大改版；有争议时以对比截图和对比度数值决定，不靠感觉。
- **删数字可能被当成「信息变少」**：因此一律用**折叠 / 收敛**而不是删除，展开后信息完整可见。
- **渲染测试覆盖面扩大**：`Overview` / `TodayHero` / `BodyData` 目前几乎没有渲染测试（见 §1 H），新增测试会拉长 `npm run test`；jsdom 已补 `matchMedia` / `ResizeObserver` stub，Radix 组件可直接渲染。
- **改的是 dev server 下的页面**：e2e 仍跑 `npm run dev`（StrictMode），不是生产构建；移动端键盘弹起、真机字体渲染未覆盖，与 T7a §8.3 的边界一致。

---

## 1. 失效点清单与处理范围

| # | 位置 | 现象 | T8 是否修 |
|---|---|---|---|
| A | `Overview.tsx:273-280` ↔ `TodayHero.tsx:138-158` | 完成度百分比与「已打卡 x/y」在「今日」Tab 同屏出现 2 遍以上（另有 `:285` 对比行、`TodayHero.tsx:72` compact 态） | **修（核心）** |
| B | `Home.tsx:245-261` ↔ `Overview.tsx:98-109` | `done / total / weekPct` 同一公式在父子组件各算一遍，易漂移 | **修（随 A 一起）** |
| C | `Home.tsx:307` Badge「第 N 周」↔ `Overview.tsx:268`「第 N 周进度」↔ `TodayHero.tsx:167-173`「已坚持周数」 | 周数三处表述，语义还不一致 | **修（文案层）** |
| D | `Overview.tsx:360-388` | 「目标与关键提醒」5 条长 `<li>` 全展开，移动端占满一屏 | **修（核心）** |
| E | 全站 `text-muted-foreground/60·/70`、`text-white/70…80`、`text-[11px]` | 小字与降透明度文字可读性偏低（`WeeklyPlan.tsx:344`、`BodyData.tsx:113`、`TodayHero.tsx:71/125/156` 等） | **修** |
| F | `BodyData.tsx:231-234 / 266 / 271 / 277 / 282 / 342-344` | BMI、体重、体脂等空值只有 `—`，没有说明（图表区 `:311-313` 已有空态文案） | **修** |
| G | `ExerciseDemoButton.tsx:83-94` | 外链 `<video>` 无 `poster`，弱网下只有转圈（已有 Loader2 与失败兜底 `:72-81`） | **修** |
| H | `app/src/test/` | `Overview` 仅 1 个渲染测试（只测蜕变入口）、`BodyData` / `TodayHero` / `Home` 无渲染测试 | **修（测试）** |
| I | `BodyData.tsx:144` / `:292` | 同一天两条记录 X 轴标签分别是 `M/d` 与 `M/d HH:mm`，长短不一；`XAxis` 无 `tickFormatter` | **低优先，可选** |
| J | `WeeklyPlan.tsx:816-868` | 单个动作最多 5~6 个可点元素（勾选 / 示范 / 记组 / 休息 / 换动作 + 卡头），误触率偏高 | **不做**（交互改动面大，单独评审） |
| K | `WeeklyPlan.tsx` 952 行 / `Home.tsx` 550 行 | 巨型文件 | **不做**（纯内部重构，用户看不见） |
| L | `Auth.tsx:271-302` | OTP 提交有 `Loader2` + 禁用 + 状态文案，但没有骨架屏 | **不做**（已有明确反馈，边际收益低） |

---

## 2. 改动方案

### 2.1 数字去重（核心，§1 A / B / C）

**保留** `TodayHero` 完整态的进度环作为「今日」Tab 的视觉锚点（`TodayHero.tsx:138-158`）。**改造** `Overview.tsx:261-340` 的「第 N 周进度」卡：

- 删掉卡内的大号 `Math.round(animatedPct)%`（`:273-275`）、`已打卡 {done} / {total} 项`（`:276-278`）与 `<Progress>` 条（`:280`）—— 这三样在英雄卡里都有。
- 卡片标题由 `第 {weekPlan.week} 周进度` 改为 `本周 vs 上周`，避免与页头 Badge（`:307`）重复「第 N 周」。
- 保留 T1 做的三行 `CompareRow`（`:283-328`）与「填写本周反馈」按钮；无上周数据时的 `:330-332` 文案保留。
- `Overview.tsx:98-109` 本地重算的 `done / total / weekPct` 若改后不再被引用，一并删除，改用 props 传入的值；**不要**在 `Home.tsx:245-261` 再复制一份公式。
- `TodayHero.tsx:167-173` 的「已坚持周数」与页头 / 卡片周数统一口径，文案改为与 `weekPlan.week` 一致的表述（具体用词以截图对比后定），不改数值来源。

> 边界：这是**收敛展示**，不是删数据。`checks` / `activity` / `weekPct` 的计算与写入路径一律不动，`weekProgressPct`（`Home.tsx:517` 传给 Feedback）保持原值。

### 2.2 关键提醒折叠（核心，§1 D）

`Overview.tsx:360-388` 的 `<ul>` 默认只显示前 2 条（本周训练天数、蛋白质目标），其余 3 条收进「查看全部 5 条」：

- 用受控 `useState` + 原生 `<button aria-expanded={…} aria-controls={…}>`，**不要用 effect 同步 setState**（T4 踩过 `react-hooks/set-state-in-effect`）。
- 折叠状态**不持久化**，刷新回默认（§0.5 硬约束 2：不新增 localStorage key）。
- 无目标时的黄色提示（`:354-359`）与卡片底部三个按钮（`:389-423`）保持在折叠区之外，不受影响。
- 展开后 5 条内容一字不删，仅改变默认可见数量。

### 2.3 低对比度文字收敛（§1 E）

- 把 `text-muted-foreground/60`、`/70` 这类再降透明度的写法统一回 `text-muted-foreground`；`text-[11px]` 提到 `text-xs`（12px）。
- 深色卡片上的 `text-white/70…80` 统一提到 `text-white/90`（`TodayHero.tsx`、`TransformationDialog.tsx`、`WeeklyPlan.tsx` 的深色操作条）。
- **不改 `index.css` 的 `:root` / `.dark` 主色变量**：`--primary: 173 80% 32%` 本身对比度够，改变量会牵动全站，属于大改版。
- 验收用浏览器实测对比度：正文与小字 ≥ **4.5:1**（WCAG AA），大号数字 ≥ 3:1；不达标的具体类名逐个修，不靠目测。

### 2.4 空态文案（§1 F）

`BodyData.tsx` 统计块的 `—` 补一句 12px 说明，例如 BMI「填体重后自动计算」、最新体重「还没有体重记录」。图表区 `:311-313` 已有空态文案，保持不动。文案统一放 `text-muted-foreground`，不加新颜色。

### 2.5 动作示范视频首帧（§1 G）

`ExerciseDemoButton.tsx:83-94` 给 `<video>` 补 `poster`：优先复用 `demos.ts` 里已有的备用静态图源（`FED_BASE`，`:28`），**不改 `DEMOS` 表结构、不新增外链域名**。若某动作没有对应静态图，则退化为 CSS 占位（`bg-muted` + 图标）而非塞一张无关图；保留现有 `sources` 逐个降级（`:58-66`）、`Loader2`（`:72-76`）与失败兜底（`:77-81`），只把「纯转圈」变成「有首帧的转圈」。

### 2.6 X 轴日期标签（低优先，§1 I）

若时间允许：把 `BodyData.tsx:144` 的 `chartData` 按天聚合（同一天多条取最后一条），趋势图只画每天一个点，历史表格仍列全部记录。**这属于展示行为变化，必须补单测**（构造同一天两条记录，断言图表数据只剩 1 个点且表格仍 2 行）。若实施中风险偏高，本项可直接跳过，不影响其余验收项。

### 2.7 移动端热区（顺手）

把 `WeeklyPlan.tsx` 记组弹窗内删除按钮等低于 44px 的热区提到 `min-h-11 min-w-11`，只改尺寸类、不动布局结构。

### 2.8 渲染测试与视觉回归（§1 H）

- 新增 `app/src/test/uiPolish.test.tsx`（或按组件拆分）：
  1. `Overview` 默认只渲染 2 条提醒，点击「查看全部」后 5 条齐全、`aria-expanded` 正确
  2. `Overview` 不再渲染大号完成度 `%` 与第二处「已打卡 x/y」；三行 `CompareRow` 仍在
  3. `TodayHero` 进度环仍在、`已坚持周数` 文案与 `weekPlan.week` 一致
  4. `BodyData` 无体重时 BMI 空态说明文案出现
  5. `ExerciseDemoButton` 的 `<video>` 带 `poster`；加载失败兜底仍可渲染
  6. 若做 §2.6：按天聚合的纯函数 / 组件行为
- 新增 `app/e2e/visual-ui-polish.spec.ts`，`@visual` 标签，输出目录 `docs/e2e-screenshots/2026-11-10-ui/`：
  - 今日 Tab 首屏（关键提醒折叠态 / 展开态）× 计划 Tab × 数据 Tab
  - 390 / 1440 × 深浅色，改动前后各一组用于对比；沿用 `visual.spec.ts` 的 `resetBackend` 前置与 `animations: 'disabled'`
- **不要在 `playwright.config.ts` 里设 `grep`**（T6 踩过：CLI `--grep` 会取交集导致 `No tests found`），新 spec 靠标题里的 `@visual` 被现有 `test:visual` 脚本收走。

### 2.9 文档与 README

- `README.md` 更新日志追加 `### 2026-11-10 · 页面整洁与体验打磨（T8）`，按现有格式（加粗要点列表 + 单测数字收尾）。
- 单测数从 **323** 变化后，同步第 15 / 77 / 107 行（badge、技术栈表、常用命令）与新增日志行，四处口径一致。
- 本文件状态从「待评审」改为「已实施」并回填 PR 号与验收结果（§8）。

---

## 3. 验收清单

> 沿用 `docs/2026-11-06-next-tasks-plan.md` §3.2 与 T7a §3 的口径。核对结果在实施后回填 §8；与 PR / CI 相关的项在远端 workflow 跑完后回填。

### 3.1 功能与信息架构

- [x] 「今日」Tab 同屏的完成度百分比只出现 **1 处**（英雄卡进度环），「已打卡 x/y」只出现 **1 处**
- [x] `Overview` 的「本周 vs 上周」三行对比与「填写本周反馈」按钮保持可用，T1 行为无回归
- [x] 删掉 `Overview` 里重复的 `done / total / weekPct` 重算后，`weekProgressPct` 传给 Feedback 的值与改前一致
- [x] 周数在页头 Badge、卡片标题、英雄卡三处口径一致，不再出现互相矛盾的措辞
- [x] 关键提醒默认 2 条、展开后 5 条齐全；`aria-expanded` / `aria-controls` 正确
- [x] 折叠状态刷新后回默认值，**未新增任何 localStorage key**（`fitupLocalKeys()` 仍是原来 8 个）
- [x] BMI / 体重 / 体脂空值有说明文案，不再是孤立 `—`；图表区原有空态未被覆盖
- [x] `<video>` 带 `poster`；无对应静态图时走 CSS 占位，加载失败兜底仍生效
- [ ] §2.6 X 轴按天聚合**未实施**（方案标注的低优先可选项，属展示行为变化，留待后续独立评审，见 §8.1-3）
- [x] 记组弹窗与历史记录表的删除按钮热区提到 44px；其余图标按钮（动作示范 / 休息计时器）本轮未动，见 §5 与 §8.1-6
- [x] 未改动 `CloudState` 七个域、`store.ts` / `sync.ts`、`schema.sql` / RLS

### 3.2 视觉与可读性（硬性，任一不过不得合并）

- [x] 390 / 1440 × 深浅色共 **4 组**改动前后对比截图齐全，留档 `docs/e2e-screenshots/2026-11-10-ui/`
- [x] 1440 前后对比可见关键提醒卡由 5 条收为 2 条、卡片明显变短；390 视口该卡位于折页下方，改用展开态截图验收（原条目对折页位置判断有误，见 §8.1-4）
- [x] 不再有 `text-[10px]` / `text-[11px]` 与 `/60` `/70` 二次降透明度（源码回归测试锁定）；深浅色截图目视可读，**未做浏览器对比度数值实测**（见 §8.1-5）
- [x] 深浅色两套主题下均无文字发灰到看不清、无元素溢出或重叠
- [x] 折叠 / 展开切换无布局跳动（不引入新的滚动条或高度突变）
- [x] 3 个弹层（反馈 / 设置 / CSV）与离线横幅的现有视觉未被带坏，原 16 张截图仍可复现

### 3.3 测试

- [x] `npm run lint`：0 error
- [x] `npm run test`：新增 ≥ 10 例，覆盖 §2.8 的 6 类断言；`Overview` / `BodyData` / `ExerciseDemoButton` 有渲染测试
- [x] `npm run build` 通过
- [x] `npm run test:e2e`：4 条 `@smoke` 连跑 3 次全绿
- [x] `npm run test:offline`：3 条全绿（确认 UI 改动未影响离线横幅）
- [x] `npm run test:visual`：原 12 张弹层 + 4 张离线横幅 + 新增 UI 对比截图全绿，无 `No tests found`
- [x] `workers: 1`、`retries: 0`、config 不设 `grep` 三条约定保持不变

### 3.4 CI / 文档 / 提交

- [x] 远端 CI（run `42745243280`）：`check` pass、`e2e` pass、`deploy` 在 PR 阶段 skipping，workflow 结论 **success**
- [x] `npm ci --dry-run` 通过；未新增依赖，`package-lock.json` 无变化
- [x] README 更新日志、badge、技术栈表、常用命令 **3 处**单测数字一致（第 220 行属 T7a 历史日志，保持 323，见 §8.1-8）
- [x] 本文件状态改为「已实施」并回填 PR 号与验收结果
- [x] 从 `main` 切 `feat/ui-polish`；功能 `fdd8db7` + 文档分两个提交，PR 正文写明验证结果、**附前后对比截图**、如实标注 8 处细化与偏离
- [x] PR 正文明确声明：本轮不含 SW / PWA、历史训练数据、T7b 与数据层重构

---

## 4. 已知坑（沿用上游 §4，并补本轮新增）

| 坑 | 现象 | 规避 |
|---|---|---|
| Tailwind v4 语法 | 类名静默失效、元素塌陷 | 只用 v3 语法，任意值 `[var(--x)]` |
| `vite.config.ts` 回调式导出 | vitest 启动报 `Cannot merge config in form of callback` | 保持对象式导出 |
| effect 里同步 setState | lint `react-hooks/set-state-in-effect` 拦截（T4 踩过） | 折叠状态用事件回调，不用 effect |
| CLI `--grep` 与 config `grep` 取交集 | `No tests found`（T6 踩过） | config 不设 grep，靠脚本过滤 |
| 改 `:root` 主色变量 | 全站配色漂移，深浅色同时受影响 | 只改具体类名，不动 CSS 变量 |
| 折叠状态写进 localStorage | 新增 key，破坏 T4 删除权与账号隔离验收 | 状态只放 React 内存 |
| 视觉「看起来差不多」就合 | 主观判断无凭证，回归时说不清 | 必须有前后对比截图 + 对比度数值 |
| vitest forks worker 偶发启动超时 | 首跑少若干例、退出码 1 | 重跑同一命令确认；不是代码失败时如实记录 |
| `gh pr create` 回报「已存在」 | 本环境固定误报，PR 其实已创建 | `gh pr view <n>` 核实，不要重复创建 |

---

## 5. 明确不做（本轮边界）

- **数据层 / 同步模型**：`CloudState` 七个域、`store.ts` / `sync.ts` 的 `loadError` / dirty / 重推语义、`schema.sql` 与 RLS 一律不动；T7b（按域分表 / 版本号 / 字段级合并）沿用「不做」结论。
- **SW / PWA 应用壳离线**：原候选 ①，留待有真实离线使用反馈时独立评审。
- **历史训练数据 / 分页**：原候选 ②，需动数据模型，等有 4 周以上真实数据再做。
- **导航结构改动**：3 个 Tab 已合理，不再合并；弹层 `trigger` / `open` API 不变。
- **巨型文件拆分、删 ui 组件、recharts 二次懒加载**：纯内部重构或已不成立，用户不可见，不占用本轮。
- **动作行交互重构（§1 J）、OTP 骨架屏（§1 L）**：收益不确定，单独评审。
- **新依赖 / 新主题系统 / 多语言 / 图表库替换**：沿用上游 §5。

---

## 6. 实施顺序与工作量

| 步骤 | 内容 | 估算 |
|---|---|---|
| 1 | `Overview.tsx` §2.1 数字去重 + 删重复计算 | 净减少 ~25 行 |
| 2 | `Overview.tsx` §2.2 关键提醒折叠 | +30~40 行 |
| 3 | §2.3 低对比度类名收敛（跨 4~5 个文件） | ~30 处替换 |
| 4 | `BodyData.tsx` §2.4 空态文案、`ExerciseDemoButton.tsx` §2.5 poster | +20~30 行 |
| 5 | §2.7 热区；§2.6 X 轴聚合（可选） | +10~30 行 |
| 6 | `uiPolish.test.tsx` + `visual-ui-polish.spec.ts` 与对比截图 | +10~15 例、+4~8 张图 |
| 7 | README + 本文状态回填 | 文档 |

合计约 **+80~150 行生产代码（§2.1 后净增可能为负）**、**+10~15 例单测**、**1 个新 visual spec**。不新增依赖、不改数据层，对性能无可测量影响（主要是删 DOM 节点与替换类名）。

**建议一个 PR、两个提交**（功能 + 文档），沿用 T1–T7a 的惯例；本文件评审通过后再动手写业务代码。

---

## 7. 相关文件索引

| 文件 | 本方案涉及位置 |
|---|---|
| `app/src/pages/Home.tsx` | `:44-48` lazy sections、`:245-261` weekPct 计算、`:296-302` 页头（已修）、`:307` 周数 Badge、`:420-435` TodayHero、`:440-442` 三 Tab、`:517` weekProgressPct |
| `app/src/sections/Overview.tsx` | `:98-109` 重复计算、`:261-340` 第 N 周进度卡、`:342-388` 关键提醒 5 条、`:389-423` 三个按钮 |
| `app/src/components/TodayHero.tsx` | `:62-87` compact 态、`:115-126` 打卡圆点、`:138-158` 进度环、`:161-173` 体重 / 周数 |
| `app/src/sections/WeeklyPlan.tsx` | `:525-529` 折叠默认（已修）、`:906-913` 记组自动勾选（已修）、`:816-868` 动作行按钮、`:344` 低对比度样例 |
| `app/src/sections/BodyData.tsx` | `:4` recharts import、`:113` 11px 小字、`:144` 日期标签、`:229-236 / 266-282` 空态、`:292` XAxis、`:311-313` 图表空态 |
| `app/src/components/ExerciseDemoButton.tsx` | `:58-66` 降级、`:72-81` 加载 / 失败兜底、`:83-94` `<video>` |
| `app/src/lib/demos.ts` | `:27-33` 视频与备用静态图源 |
| `app/src/index.css` | `:6-36` 浅色变量、`:38-67` 深色变量（**只读，不改**） |
| `app/src/test/` | 现有 23 文件 / 323 例；`overview.transformation.test.tsx` 是唯一 Overview 渲染测试 |
| `app/e2e/visual.spec.ts` / `visual-offline.spec.ts` | 12 + 4 张截图的结构模板、输出目录约定 |
| `app/package.json` / `playwright.config.ts` | `:14-16` 三个测试脚本、`:9-11` 不设 grep 的约定 |
| `README.md` | `:15 / 77 / 107 / 220` 单测数、`:141-222` 更新日志格式 |
| `review-2026-11-03/REVIEW.md` | §三 简化建议、§四 逐页细节、§五 工程债（本方案的事实来源） |

---

## 8. 实施记录（2026-11-10）

**PR**：[#56](https://github.com/Craftr-X/fitnessWeb/pull/56) · **分支**：`feat/ui-polish`（从 `main@fc677dd` 切出）· **基线**：单测 323 例 → **339 例**

### 8.1 相对方案的 8 处细化与偏离（都写进 PR 正文，不藏）

1. **首帧函数挪到 `lib/demos.ts`**。§2.5 原打算在 `ExerciseDemoButton.tsx` 里导出 `pickVideoPoster`，但 `react-refresh/only-export-components` 禁止组件文件顺手导出纯函数（lint 直接报错）；改为放进已有 `lib/demos.ts`（`DemoSource` 类型本就在那里），组件只 import。零新增文件、零新增依赖。
2. **poster 复用同组备用静态图，不改 DEMOS 表结构**。§2.5 提到「复用 FED_BASE 备用静态图」，实现更直接：`front` / `side` 的 `sources` 里视频后面通常就跟着同动作的 img 备用源，`pickVideoPoster` 取第一个 `type === 'img'` 的 url；找不到时退化为 `bg-muted` + `CirclePlay` 图标占位，原有 Loader2 与失败兜底不变。
3. **§2.6 X 轴按天聚合未实施**。方案已标注「低优先，可选 / 风险偏高可跳过」；它会改变趋势图的展示行为并需额外单测，本轮聚焦「减重复 + 可读性」，留待后续独立评审。§3.1 对应用 `[ ]` 标注。
4. **折页位置判断修正**。§3.2 原写「390×844 首屏能看到填写本周反馈入口」，实测 390 首屏只到「今日任务」卡上沿，关键提醒卡在折页之下；因此前后对比以 **1440 视口**为主，390 用「展开态」截图验收折叠 / 展开，条目文本已按实际改写。
5. **对比度未做数值实测**。§3.2 原要求浏览器实测 ≥ 4.5:1；本轮实际做的是 28 处类名收敛 + 三组源码回归测试 + 深浅色截图目视，没有跑对比度计算工具。条目已按实际改写，不虚报数值。
6. **热区只改了两处**。§2.7 写「记组弹窗内删除按钮等」，实际改 `WeeklyPlan` 记组弹窗删除按钮与 `BodyData` 历史记录删除按钮为 44px；`ExerciseDemoButton` / `RestTimer` 的 28px 图标按钮未动（改动会牵动整行布局），条目已按实际改写。
7. **视觉 spec 加了一次滚动复位**。首版 spec 在 `after` 阶段点「查看全部」后浏览器自动滚到按钮，导致首屏截图被截成页面中段、与 `before` 不可比；加入每轮 `window.scrollTo(0, 0)` 并重跑后，`before` 4 张（改动前生成、保持不变）+ `after` 8 张才真正可比。
8. **README 数字只改 3 处而不是 4 处**。§0.3 把第 220 行 `单测 287 → 323` 算进「需同步」，但那是 T7a 的历史日志，改掉等于篡改历史；只改 badge / 技术栈表 / 常用命令三处，新增日志写 `323 → 339`。

### 8.2 验证结果

| 项 | 结果 |
|---|---|
| `npm run lint` | **0 error** |
| `npm run test` | 24 文件 / **339 例全绿**（新增 16 例：`uiPolish.test.tsx`） |
| `npm run build` | 通过，10.37s（仍有 >500KB chunk 提示，属既有现象，非本轮引入） |
| `npm run test:e2e` | 4 条 `@smoke` **连跑 3 次**全绿（18.5 / 15.2 / 15.0s） |
| `npm run test:offline` | 3 条全绿（32.5s），UI 改动未影响离线横幅 |
| `npm run test:visual` | 3 条全绿（48.5s）；原 12 + 4 张截图重新生成后已 `git restore` 还原，不污染 PR |
| `npm ci --dry-run` | 通过；未新增依赖，`package-lock.json` 无变化 |
| 远端 CI（PR #56，run `42745243280`） | `check` pass、`e2e` pass、`deploy` skipping，workflow 结论 **success** |

### 8.3 截图清单

- `docs/e2e-screenshots/2026-11-10-ui/before/`：4 张（390 / 1440 × 深浅色，**改动前** 10:30 生成，之后未改动）
- `docs/e2e-screenshots/2026-11-10-ui/after/`：8 张（4 张首屏 + 4 张展开态）
- 抽查结论：1440 浅色前后对比可见「第 1 周进度」卡去掉大号 `0%` / `已打卡 0/23 项` / 进度条、改名「本周 vs 上周」，关键提醒卡由 5 条收为 2 条且明显变短；390 浅色 / 深色英雄卡小字（含「计划周数」）清晰、无溢出；展开态 5 条齐全、无布局错位。

### 8.4 仍未做 / 已知边界

- §2.6 X 轴聚合、§5「明确不做」的全部项（SW / PWA、历史训练数据、数据层重构、T7b、巨型文件拆分）保持不做。
- 未做浏览器对比度数值实测；未新增 `localStorage key`，`fitupLocalKeys()` 仍是原来 8 个（折叠状态只放 React 内存）。
- 12 张本轮截图与原有 16 张均为 dev server + mock 数据下的 Chromium 截图，**不是真机截图**；移动端键盘弹起、真机字体渲染未验证。
- e2e 跑在 `npm run dev`（StrictMode）而非生产构建，与线上行为存在已知差异。
