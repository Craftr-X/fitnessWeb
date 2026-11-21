# FitUp 后续开发任务技术方案

> 编写时间：2026-11-06
> 适用对象：执行本次任务的工程师 / AI Agent
> 前置状态：`main` = `df6832f`，单测 246 个全绿，线上已部署（GitHub Pages + Supabase）

---

## 0. 给执行者：先读这一节

### 0.1 环境与命令

```bash
cd app
npm ci              # 严格按 lockfile 安装（CI 也用 npm ci）
npm run dev         # http://localhost:3000
npm run lint
npm run test        # 246 个单测（vitest + jsdom）
npm run build       # tsc -b && vite build
```

**注意**：`npm run dev` / `test` / `build` 都会拉起 esbuild 子进程。若在受限沙箱里执行报 `spawn EPERM`，属于环境限制而非代码问题，需用有网络与子进程权限的环境执行。

### 0.2 代码地图

| 路径 | 作用 |
|---|---|
| `app/src/pages/Home.tsx` | 登录后主容器：页头菜单、英雄卡、3 个 Tab、两个弹层（反馈/营养）、跨周续期 |
| `app/src/pages/Onboarding.tsx` | 2 步引导，产出 `Profile` + 第 1 周计划 |
| `app/src/sections/Overview.tsx` | 「今日」Tab：身体数据 / 今日任务 / 第 N 周进度 / 关键提醒 四张卡 |
| `app/src/sections/WeeklyPlan.tsx` | 「计划」Tab：本周调整卡、7 张日卡（可折叠）、记组弹窗、换动作弹窗 |
| `app/src/sections/BodyData.tsx` | 「数据」Tab：训练日历、记录表单、趋势图、历史表 |
| `app/src/sections/Feedback.tsx` | 每周反馈表单 + 下周计划预览（弹层内容） |
| `app/src/lib/store.ts` | `useCloudStorage`（云端单一数据源）、各类纯函数、`CloudState` 类型 |
| `app/src/lib/sync.ts` | `loadUserData` / `saveUserData` / `readLegacyData` |
| `app/src/lib/planEngine.ts` | 规则引擎：`buildWeekPlanFromProfile` / `buildNextWeekPlan` / `computeProgression` |
| `app/src/lib/planDiff.ts` | 计划差异（组数/次数区间/动作替换）+ 概括文案 |
| `app/src/lib/account.ts` | 导出 JSON、清除本地、删除云端行 |
| `app/src/components/TodayHero.tsx` | 英雄卡（完整 / 紧凑两态） |
| `app/src/components/FeedbackDialog.tsx` | 「意见反馈」弹窗（当前只有二维码 + 邮箱） |
| `app/src/components/TransformationDialog.tsx` | 「我的蜕变」报告 + 海报下载 |

### 0.3 数据模型速查（`app/src/types/index.ts`）

```ts
CloudState = { profile, weekPlan, checks, weights, feedbacks, setLogs, activity }

profile:  { name, heightCm, onboarded?, gender?, age?, weightKg?, weightGoal?,
            experience?, trainDaysPerWeek?, equipment?, sport?, sportHours?, injuries? }
weekPlan: { week: number, startDate: 'yyyy-MM-dd'（周一）, days: DayPlan[], adjustmentNote }
DayPlan:  { day: '周一'…'周日', focus, type: 'strength'|'sport'|'rest'|'recovery',
            exercises: { name, sets: '3 组 × 8-12 次', note?, loadType? }[], tip? }

checks:   { [`${week}:${dayIndex}:${exerciseIndex}`]: true }
weights:  { date: 'yyyy-MM-dd', time?: 'HH:mm', weight: number, bodyFat?: number|null }[]
feedbacks:{ week, date, completion: 0-100, difficulty: 1-5, soreness: string[],
            sleep, diet, note }[]
setLogs:  { [动作名]: { date, week, sets: { weightKg: number|null, reps: number|null }[] }[] }
activity: { 'yyyy-MM-dd': 当日打卡动作数 }   // 训练日历数据源
```

### 0.4 三条硬约束（破坏了会出事）

1. **`loadUserData` 语义不能改**：返回 `null` = 确认没有数据；**抛错** = 读取失败。
   调用方（`useCloudStorage`）拿到 `null` 会写一份默认文档，若读失败也返回 `null`，一次网络抖动就会**用默认值覆盖云端真实数据**。
   不要改回 `maybeSingle()`（它在 0 行时返回 `PGRST116` 错误，会把新用户误判成"加载失败"），当前用 `.limit(1)`。
2. **`loadError` 期间禁止回写**：`store.ts` 的持久化 effect 和 `flush()` 都有 `if (loadError) return` 守卫，不要删掉。
3. **Tailwind 是 3.x**：不要写 v4 语法（`size-(--x)`、`[--cell-size:--spacing(8)]`、`origin-(--radix-…)`）。
   这类类名在 v3 下**静默失效**，曾导致训练日历塌成 131px、日期数字重叠。任意值请用 `[var(--x)]` 形式。

### 0.5 测试与 CI 约定

- 测试放 `app/src/test/`，命名 `*.test.ts(x)`；纯函数优先单测，交互用 `@testing-library/react`。
- jsdom 已补 `matchMedia` / `ResizeObserver` stub（`src/test/setup.ts`），Radix 组件可直接渲染。
- `vitest.config.ts` 用 `mergeConfig(viteConfig, ...)` 合并 `vite.config.ts`，因此 **`vite.config.ts` 必须保持对象式导出**，不能改成回调。
- CI（`.github/workflows/ci.yml`）：`npm ci → lint → test → build`；push 到 `main` 才部署 Pages。
- 每个 PR 必须三步全绿：`npm run lint` / `npm run test` / `npm run build`。

---

## 1. 任务总览

| 编号 | 任务 | 优先级 | 预估 | 依赖 | 建议 PR |
|---|---|---|---|---|---|
| T1 | 今日页「本周 vs 上周」对比 | P1 | 0.5d | 无 | 单独 PR |
| T2 | 「我的蜕变」入口按数据量收起 | P1 | 0.3d | 无 | 可并入 T1 |
| T3 | 「意见反馈」改成可填写的表单 | P2 | 1d | 无 | 单独 PR |
| T4 | 账号设置弹层（删除账号移入 + 输入邮箱确认） | P2 | 0.5d | T5 的导出按钮同放此处 | 单独 PR |
| T5 | CSV 导出（体重 / 训练记录 / 打卡） | P2 | 1d | 无 | 单独 PR |
| T6 | Playwright 冒烟（4 条关键路径） | P3 | 1d | 需要 mock server | 单独 PR，且**不要**阻塞其他 PR |
| T7 | 离线/弱网缓存 | P4 | — | — | **本轮不做**，只保留评估结论（见 §3.7） |

**执行顺序建议**：T1 + T2（一个小 PR）→ T5 → T4（导出按钮与设置弹层一起）→ T3 → T6。
每个任务独立 commit，PR 标题用 `feat:` / `fix:` / `chore:` 前缀。

---

## 2. 逐任务方案

### T1 · 今日页「本周 vs 上周」对比

#### 背景
用户填完反馈后能看到「下周会怎么变」（已上线），但看不到**自己本周相对上周的进展**。
「第 N 周进度」卡目前只有一句 `上周反馈：完成度 75%，难度 3/5`，信息密度低且无法横向比较。

#### 目标
在「今日」Tab 的「第 N 周进度」卡内，把那句话替换成三行对比：**完成度 / 训练天数 / 体重**。
本周值与上周值并列，体重按目标着色（增肌涨为好、减脂降为好）。

#### 改动点

1. **新增** `app/src/lib/weekCompare.ts`（纯函数，无 React 依赖）

```ts
import type { ActivityMap, CheckMap, WeekFeedback, WeekPlan, WeightEntry } from '@/types'

export interface WeekStat { current: number | null; previous: number | null }
export interface WeekComparison {
  /** 上一周是否存在可比数据（第 1 周恒为 false） */
  hasPrevious: boolean
  completion: WeekStat     // 0-100，当前周实时算；上周取 feedbacks[week-1].completion
  trainedDays: WeekStat    // 单位：天
  weight: WeekStat         // kg，取"本周最后一次" vs "本周开始前最后一次"
}

export function compareWeeks(input: {
  weekPlan: WeekPlan
  checks: CheckMap
  feedbacks: WeekFeedback[]
  weights: WeightEntry[]
  activity: ActivityMap
}): WeekComparison
```

计算规则（务必按此实现，便于测试）：

- `currentMonday = weekPlan.startDate`；`prevStart = subDays(currentMonday, 7)`，`prevEnd = subDays(currentMonday, 1)`
- `trainedDays.current` = 当前周 `checks` 中出现的不同 `dayIndex` 个数（key 形如 `${week}:${di}:${ei}`，只统计 `week === weekPlan.week`）
- `trainedDays.previous` = `prevStart..prevEnd` 区间内 `activity[date] > 0` 的天数
- `completion.current` = `已打卡项 / 总项数 × 100`（四舍五入，总数为 0 时给 `null`）
- `completion.previous` = `feedbacks.find(f => f.week === weekPlan.week - 1)?.completion ?? null`
- `weight.current` = `weights` 中日期 `<= 今天` 的最后一条
- `weight.previous` = `weights` 中日期 `< currentMonday` 的最后一条
- `hasPrevious` = `weekPlan.week > 1 && (completion.previous != null || trainedDays.previous > 0 || weight.previous != null)`

2. **修改** `app/src/sections/Overview.tsx`
   - 在 `第 {weekPlan.week} 周进度` 卡片里，删除 `<p>上周反馈：完成度 …</p>` 那段
   - 换成三行对比（建议用 `grid grid-cols-[1fr_auto_auto]` 或两列小卡）：

```
完成度      42%    ←  75%
训练天数    3 天   ←  4 天
体重        72.4   →  72.0  (+0.4)
```

   - 本周值加粗、上周值 `text-muted-foreground`；体重涨跌用 `weightDeltaTone(goal, delta)` 复用现有着色逻辑（import 自 `@/lib/store`）
   - `hasPrevious === false` 时显示「上周还没有可比数据」而不是一排 `—`
   - 保留卡片底部原有的「填写本周反馈」按钮

#### 验收标准
- 第 1 周：三行都显示 `—`，并有「上周还没有可比数据」提示，不报错
- 第 2 周且有上周反馈：完成度显示本周实时值与上周填写值的对比
- 上周没有训练记录（`activity` 为空）但当前周有：训练天数显示 `3 天 vs 0 天`（0 是真实值，不要显示 `—`）
- 深浅色主题下颜色可读

#### 测试要求
`app/src/test/weekCompare.test.ts` 至少覆盖：
1. 第 1 周 → `hasPrevious=false`，各字段符合预期
2. 有上周反馈 → `completion.previous` 正确
3. 上周无 activity、本周有打卡 → `trainedDays = { current: 3, previous: 0 }`
4. 体重只有一条且在本周内 → `weight.previous = null`
5. 周的边界：`prevEnd` 是上周日（`currentMonday - 1`），不要把本周一算进上周

#### 风险 / 注意
- 日期一律用 `date-fns`（`subDays` / `format(date,'yyyy-MM-dd')`），注意本地时区：`startDate` 是纯日期字符串，比较时直接用字符串比大小即可，避免 `new Date()` 解析差异
- `activity` 是后来才上线的字段，老数据没有 → 上周训练天数为 0 属于正常，不要当异常处理

---

### T2 · 「我的蜕变」入口按数据量收起

#### 背景
数据不足 4 周时，海报内容基本是空的（「已坚持 0 周」+ 一排 `—`），点进去反而扣分。

#### 目标
数据不足时不显示入口；数据够了恢复显示。不删功能、不改海报实现。

#### 改动点
- `app/src/sections/Overview.tsx`：「目标与关键提醒」卡底部那个「我的蜕变」按钮加显示条件：

```ts
// 至少 4 周计划、且至少有 2 条体重记录，海报才有内容可讲
const canShowTransformation = weekPlan.week >= 4 && weights.length >= 2
```

- 备选（更严格）：再叠加 `computeTransformation(...).hasData`，但**不要**引入额外重算开销，`weekPlan.week >= 4 && weights.length >= 2` 已足够。
- `app/src/components/TransformationDialog.tsx` 的 `hasData === false` 空态文案改为：
  「再记录 1-2 周体重和训练，这里会出现你的阶段报告。」

#### 验收标准
- 第 1 周（新用户）：今日页看不到「我的蜕变」按钮，页面无布局空洞（卡片底部只剩「重新定制我的计划」）
- 手动把 `weekPlan.week` 改成 4（或在测试里构造）后：按钮出现，点开正常

#### 测试要求
组件测试：`app/src/test/overview.transformation.test.tsx`，渲染 `Overview` 两种 props，断言按钮存在/不存在。
（注意 `Overview` 依赖 `progress`、`dialog` 等组件，参考 `feedback.preview.test.tsx` 的写法。）

---

### T3 · 「意见反馈」改成可填写的表单

#### 背景
现在的弹窗只有微信群二维码 + 邮箱地址，**没有输入框**。而它还挂在登录页「收不到验证码？点这里反馈」这个位置——手机端扫自己屏幕不成立。

#### 目标
弹窗主区变成一个可写的反馈表单，提交后走邮件（不引入后端）。二维码降级为「可选」的折叠区。

#### 改动点
`app/src/components/FeedbackDialog.tsx`（保持现有 `trigger` / `open` 双模式 API 不变）

1. 新增内部状态：`text`（≤500 字）、`contact`（可选，≤60 字）、`copied`（复制反馈）
2. 主区结构：
   - `Textarea`：label「遇到的问题 / 想要的功能」，placeholder 给出模板：
     `例：iOS Safari 上训练日历的数字重叠；希望支持导出 CSV`
   - `Input`：label「联系方式（可选）」，placeholder `邮箱 / 微信，方便我回复你`
   - 字数计数：`{text.length}/500`
   - 主按钮「发送反馈」：`text.trim().length >= 5` 才可点
   - 次按钮「复制反馈内容」：`navigator.clipboard.writeText(...)`，成功后 toast「已复制，可以粘贴到微信/邮件」
3. 提交行为（**不新增后端**）：

```ts
const subject = encodeURIComponent('FitUp 反馈')
const body = encodeURIComponent(
  [text.trim(), contact.trim() ? `\n\n联系方式：${contact.trim()}` : '', `\n\n—— 来自 ${location.host}`].join('')
)
const url = `mailto:${FEEDBACK_EMAIL}?subject=${subject}&body=${body}`
window.open(url, '_blank')          // 用 window.open 而不是 location.href，便于测试断言
```

   提交后 toast：「已打开邮件客户端，发送即可收到」。若 3 秒内没有任何交互，不额外降级（保持简单）。
4. 二维码区域折叠：`<details>` 或 `Collapsible`，标题「也可以加入内测群（扫码）」，展开后才显示图片与说明。

#### 验收标准
- 空输入或 <5 字时「发送反馈」禁用
- 输入后点击会调用 `window.open`，URL 里包含 `mailto:`、编码后的正文与联系方式
- 复制按钮写入剪贴板并 toast
- 登录页与首页页头两处入口都能正常打开（受控 / 非受控两种模式）
- 弹窗在 390px 宽度下不溢出，键盘弹起时输入框可见（`max-h-[90dvh] overflow-y-auto`）

#### 测试要求
`app/src/test/feedbackDialog.test.tsx`：
1. 初始「发送反馈」disabled
2. 输入 4 字仍 disabled，输入 5 字后 enabled
3. 点击后 `window.open` 被调用一次，参数以 `mailto:` 开头并包含 `encodeURIComponent` 后的文本
4. 复制按钮调用 `navigator.clipboard.writeText`

#### 风险
- `navigator.clipboard` 在非 HTTPS 或旧浏览器不可用 → 用 `try/catch` 降级为选中文本 + 提示
- 不要在这个弹窗里做网络请求（无后端，避免引入新的失败态）

---

### T4 · 账号设置弹层（删除账号移入 + 输入邮箱确认）

#### 背景
页头菜单里「删除账号」和「退出登录」都是红色、只隔一条分割线，误触成本太高；导出也在同一个菜单里，层级混乱。

#### 目标
新增「设置」弹层，收纳账号信息、数据导出、危险操作；菜单只保留「意见反馈 / 设置 / 退出登录」。

#### 改动点

1. **新增** `app/src/components/SettingsDialog.tsx`

```ts
interface Props {
  open: boolean
  onOpenChange: (v: boolean) => void
  email?: string
  onExportJson: () => void     // 复用 Home 现有 handleExport
  onExportCsv: () => void      // T5 提供；若 T5 未做，先不传该 prop
  onDeleteAccount: () => Promise<void>   // 复用 Home 现有 handleDeleteAccount
}
```

结构：
- **账号**：`email` 只读展示
- **数据**：两个按钮「导出 JSON（完整备份）」「导出 CSV（Excel 打开）」
- **危险区**（`border-destructive/40` 包裹 + 说明文字）：
  - 按钮「删除账号与全部数据」→ 进入第二步
  - 第二步：`Input` 要求**原样输入自己的邮箱**，输入匹配才启用「确认删除」
  - 点击后调用 `onDeleteAccount()`，期间按钮显示「正在删除…」并禁用

2. **修改** `app/src/pages/Home.tsx`
   - 菜单项：`意见反馈` / **`设置`** / `退出登录`（删除「删除账号」「导出我的数据」两项）
   - 新增 `settingsOpen` 状态，渲染 `<SettingsDialog ... />`
   - 删除逻辑保留在 Home（`handleDeleteAccount`、`deleting`），通过 props 传入；弹层内的"输入邮箱"校验在弹层内部完成，**只在校验通过后**才调用回调
   - 保留现有 `AlertDialog` 的强警告文案，可移入弹层作为一个确认步骤（二选一：输入邮箱确认 **或** AlertDialog 二次确认，避免三重确认；建议用输入邮箱这一种）

#### 验收标准
- 页头菜单只有 3 项，且「删除账号」不再出现在菜单里
- 设置弹层里：输入错误邮箱时确认按钮禁用；输入正确后才可点
- 删除流程走通（在本地 mock 环境验证，**不要**在真实账号上点）
- 退出登录仍走原来的二次确认

#### 测试要求
`app/src/test/settingsDialog.test.tsx`：
1. 输入不匹配 → 确认删除 disabled
2. 输入匹配（忽略首尾空格、大小写不敏感）→ enabled
3. 点击后 `onDeleteAccount` 被调用一次

#### 风险
- `handleDeleteAccount` 内部会 `flush()` 再删云端行；`loadError` 期间 `flush()` 返回 false，删除应**中止并提示**，不要在数据未同步时删。检查现有实现是否覆盖，没有则加一句守卫。

---

### T5 · CSV 导出（体重 / 训练记录 / 打卡）

#### 背景
现在只能导出整包 JSON，用 Excel 打不开，也没法直接给教练看。

#### 目标
新增三个 CSV：体重、训练记录、本周打卡。UTF-8 BOM + CRLF，Excel 双击可直接读。

#### 改动点

**新增** `app/src/lib/exportCsv.ts`（纯函数 + 下载）

```ts
export const CSV_BOM = '\uFEFF'

/** 单字段转义：含 , " \r \n 时用双引号包裹，内部 " 变 "" */
export function csvCell(v: string | number | null | undefined): string

/** 组装整表：表头 + 行，行尾 \r\n，前置 BOM */
export function toCsv(headers: string[], rows: (string | number | null)[][]): string

export function weightsCsv(weights: WeightEntry[], heightCm: number): string
export function trainingCsv(setLogs: ExerciseLogMap): string
export function checksCsv(weekPlan: WeekPlan, checks: CheckMap): string

export function downloadCsv(content: string, fileName: string): void
export function csvFileName(kind: '体重' | '训练记录' | '打卡', today?: Date): string
```

列定义：

| 文件 | 列 |
|---|---|
| 体重 | `日期, 时间, 体重(kg), 体脂(%), BMI` （BMI 用 `bmi(weight, heightCm)`，体脂为空则空字符串） |
| 训练记录 | `日期, 动作, 组序, 重量(kg), 次数`（`setLogs` 展开；重量为 `null` 的组写空） |
| 打卡 | `日期, 周几, 动作, 组次, 是否完成`（`checks` 的 key 解析成 `week:di:ei`，日期 = `startDate + di 天`；`组次` 取 `exercises[ei].sets`） |

**修改** `app/src/pages/Home.tsx` 与 `SettingsDialog`：把三个导出按钮接到 `downloadCsv(...)`。
（若 T4 未做，先在菜单里加一项「导出 CSV」，后续再收进设置。）

#### 验收标准
- 三个文件都能下载，文件名形如 `FitUp-体重-20261106.csv`
- Excel / Numbers 打开无乱码（BOM 生效），中文表头正常
- 空数据时只输出表头，文件不报错
- 含逗号或引号的备注字段被正确转义（可用动作名带 `（`、笔记带 `,` 的场景验证）

#### 测试要求
`app/src/test/exportCsv.test.ts`：
1. `csvCell` 对 `,`、`"`、换行、`null` 的处理
2. `toCsv` 输出以 BOM 开头、以 `\r\n` 结尾
3. `weightsCsv` 空数组 → 只有表头
4. `trainingCsv` 正确处理 `weightKg: null`（自重组）
5. `checksCsv` 把 key 还原成日期与动作名（构造一个 2 天 3 动作的 `weekPlan`）

#### 风险
- `setLogs` 只保留当前周（`EXERCISE_LOG_CAP` / 周过滤），导出的是"现有数据"，不是全历史 —— 在 UI 上标注「仅包含当前周训练记录」
- 日期格式化统一 `yyyy-MM-dd`，不要用 `toLocaleDateString()`

---

### T6 · Playwright 冒烟（4 条关键路径）

> **建议本轮最后做，且必须独立 PR**，不要和业务改动混在一起。

#### 背景
现有 246 个测试都跑在 jsdom：没有真实浏览器、真实网络、真实布局。最近三次事故（日历塌陷、`vite.config` 让 vitest 起不来、新用户被误判"加载失败"）全部是人工看页面才发现的。

#### 目标
4 条端到端用例在真实 Chromium 里跑通，接进 CI（PR 时执行，不阻塞 `main` 部署）。

#### 改动点

1. **把 mock 后端搬进仓库**：新增 `app/e2e/mock-supabase.mjs`
   - 复用本地跑通用过的那套（auth + `user_data`），**必须**保持：`GET /rest/v1/user_data` 在无数据时返回 `200 []`（配合 `.limit(1)`），而不是 406
   - 增加 `POST /__reset`：清空内存与 `data.json`，供每个用例前置清理
   - 端口 `54321`

2. **新增** `app/playwright.config.ts`

```ts
webServer: [
  { command: 'node e2e/mock-supabase.mjs', port: 54321, reuseExistingServer: !process.env.CI },
  {
    command: 'npm run dev -- --port 3100',
    port: 3100,
    env: { VITE_SUPABASE_URL: 'http://127.0.0.1:54321', VITE_SUPABASE_ANON_KEY: 'e2e-anon' },
    reuseExistingServer: !process.env.CI,
  },
]
```

3. **4 条用例**（`app/e2e/*.spec.ts`）

| 文件 | 路径 | 断言 |
|---|---|---|
| `login-onboarding.spec.ts` | 打开 → 输入邮箱 → 点「发送验证码」→ 输入任意 6 位码 → 走 2 步引导 → 生成计划 | 出现 3 个 Tab、头部显示「第 1 周」 |
| `plan-checkin.spec.ts` | 计划页 → 勾选第一个动作 → 打开记组弹窗 → 填 1 组重量/次数 → 完成 | 该行变「本次：xxkg×xx」、行内 checkbox 为 `aria-checked=true`、出现「休息」计时器 |
| `feedback-preview.spec.ts` | 今日页 →「填写本周反馈」→ 保存 → 断言预览文案 → 点「应用第 2 周计划」 | 出现 `/计划已按本次反馈算好/` 文案、应用后 URL 为 `#/plan` 且头部「第 2 周」 |
| `routing-refresh.spec.ts` | 切到「计划」→ 断言 `#/plan` → `page.reload()` → `goBack()` | 刷新后仍在计划页且仍在登录态；返回后回到上一个 Tab 且页面未卸载 |

4. **`package.json`** 增加脚本：`"test:e2e": "playwright test"`；依赖 `@playwright/test`（devDependencies）。

5. **CI**：`.github/workflows/ci.yml` 新增 job `e2e`（`needs: check`，仅 `pull_request` 触发）：

```yaml
- uses: actions/setup-node@v5
  with: { node-version: 22, cache: npm, cache-dependency-path: app/package-lock.json }
- run: npx playwright install --with-deps chromium
  working-directory: app
- run: npm run test:e2e
  working-directory: app
```

#### 验收标准
- 本地 `npm run test:e2e` 4 条全绿、连续跑 3 次不 flaky
- CI 上 `e2e` job 通过；故意把 `WeeklyPlan` 的日卡删掉，`plan-checkin` 应该红
- `check` job 时长不显著变化（e2e 独立 job）

#### 风险
- flaky 是最大敌人：断言只用 `getByRole` / `getByText` 这类稳定选择器；等待用 `expect(...).toBeVisible()`，不要 `waitForTimeout`
- 不要用真实 Supabase：`webServer.env` 必须指向 54321 的 mock
- 首次安装 Chromium 约 100MB，CI 缓存可选（`~/.cache/ms-playwright`）

---

## 3. 交付流程与验收清单

### 3.1 分支与提交

```bash
git checkout main && git pull
git checkout -b feat/next-batch      # 或按任务拆：feat/week-compare / feat/csv-export ...
```

- 一个任务一个 commit，信息格式：`feat(今日页): 本周 vs 上周对比` / `feat(导出): CSV 三件套`
- PR 标题与正文写清：改了什么、为什么、验证方式（lint/test/build 结果 + 截图）
- **不要**在 `main` 上直接提交

### 3.2 每个 PR 的自检清单

- [ ] `npm run lint` 0 error
- [ ] `npm run test` 全绿，且新增用例覆盖新逻辑
- [ ] `npm run build` 通过
- [ ] 涉及 UI 的：390px 与 1440px 各截一张图，深浅色各看一次
- [ ] 涉及数据读写的：断网/慢网下行为可接受（不卡死、不覆盖云端）
- [ ] README 的「更新日志」补一条；若单测数变化，同步 badge 与「常用命令」里的数字
- [ ] 截图有变化时更新 `docs/promo/` 对应文件

### 3.3 本地起真实页面的方法（无后端也能测）

1. 写一个 mock server（可复用 T6 的 `app/e2e/mock-supabase.mjs`），监听 54321；
2. `VITE_SUPABASE_URL=http://127.0.0.1:54321 VITE_SUPABASE_ANON_KEY=any npm run dev`；
3. 打开页面，邮箱随便填，验证码随便填 6 位即可登录。


---

## 4. 已知坑（踩过的，别重复）

| 坑 | 现象 | 规避 |
|---|---|---|
| Tailwind v4 语法 | 类名静默失效，元素塌陷/尺寸为 0 | 只用 v3 语法，任意值用 `[var(--x)]` |
| `vite.config.ts` 回调式导出 | `vitest` 启动报 `Cannot merge config in form of callback` | 保持对象式导出，用 `process.env.NODE_ENV` 区分 dev |
| `maybeSingle()` 判空 | 0 行返回 `PGRST116` 错误，新用户被误判为"加载失败" | 用 `.limit(1)` + 数组判空 |
| 读失败写默认值 | 一次网络抖动覆盖云端真实数据 | `loadUserData` 失败必须抛错；`loadError` 期间禁止 `saveUserData` |
| Radix 组件在 jsdom 崩 | `ResizeObserver is not defined` | `src/test/setup.ts` 已补 stub |
| CI 用 `npm ci` | 改了 `package.json` 但没更新 lockfile → CI 失败 | 改依赖后本地跑一次 `npm install` 再提交 |
| `docs/` 目录写入 | 某些环境（如受限沙箱）写入被拒 | 需提权或在仓库根目录产出后再移动 |
| 时间/时区 | `startDate` 是纯日期字符串，`new Date(str)` 可能偏移 | 用 `date-fns` 且比较时直接用 `yyyy-MM-dd` 字符串 |

---

## 5. 明确不做（本轮边界）

- **T7 离线/弱网缓存**：整文档 last-write-wins + 离线写队列会互相冲突，需要先重构同步模型（按域分表或版本号），成本远大于收益，暂不做。
- 训练数据分页/历史周查询（`setLogs` 目前只留当前周，属于产品决策，不是 bug）。
- 多语言、暗色主题重构、图表库替换。
- 后端表结构变更（新增 `feedback` 表等）：如需，必须同步 `app/supabase/schema.sql` 与 RLS 策略，并单独评估。

---

## 6. 参考资料

- 走查报告（含问题截图与量化数据）：`review-2026-11-03/REVIEW.md`
- 部署与 Supabase 配置：`DEPLOY.example.md`、`app/supabase/schema.sql`
- 规则引擎与反馈调整逻辑：`app/src/lib/planEngine.ts`、`app/src/lib/planDiff.ts`
