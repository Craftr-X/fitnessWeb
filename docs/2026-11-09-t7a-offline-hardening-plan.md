# FitUp T7a 离线 / 弱网加固技术方案

> **状态**：**已实施** · 2026-11-10 · PR [#55](https://github.com/Craftr-X/fitnessWeb/pull/55)
> **上游**：`docs/2026-11-06-next-tasks-plan.md` §1 的 T7、§3.2 自检清单、§5 明确不做
> **定位**：T7 的第一阶段。只修「离线期间写入会丢」与「文案与行为不符」，**不改同步模型、不引入离线写队列、不动数据库表结构**。
> **基线**：`main@8762db1`（PR #50–#54 全部合并后的状态）

---

## 0. 给执行者：先读这一节

### 0.1 一句话目标

把 `app/src/lib/store.ts:521` 那句 `if (loadError) return` 拆成两件事：**「不许写云端」保留，「不许写本机」取消**。让云端读取失败期间的打卡 / 记组 / 体重 / 反馈至少落在本机缓存，刷新不丢，并在联网后按现有 dirty 语义重推。

### 0.2 为什么值得做（问题不是体验，是数据正确性）

复现场景（2026-11-09 周一，第 2 周，地库弱网）：

1. `loadUserData` 8 秒超时 → `loadError = "加载超时（8000ms）"`、`ready = true`，页面显示黄色横幅「云端数据没加载出来…」。
2. 用户在计划页记卧推 3 组，`WeeklyPlan.tsx:906-912` 的 `onSave` 一次改三个域：`setLogs["卧推"]`、`checks["2:0:0"] = true`、`activity["2026-11-09"] = 1`。UI 显示「本次：60kg×10」、勾选成功、日历点亮。
3. `store.ts:517` 的持久化 effect 触发，`store.ts:521` 在 `localStorage.setItem` **之前**就 return → 缓存不写、`dirty` 不置、800ms 的 `saveUserData` 根本没排上。
4. 刷新 → `useState` 从旧缓存重建 → 三条数据全没了；点横幅「重试」也一样（`store.ts:501` 用远端整份覆盖）。
5. 此时常驻 toast 仍写着「同步失败，数据已暂存本地，网络恢复后会自动重试」（`Home.tsx:130`）——**文案担保的东西一个字节都没落盘**，而且全仓没有 `online` 事件监听、没有定时器、没有自动重试循环。

### 0.3 现状基线（改之前先记住这些数字）

| 项 | 值 |
|---|---|
| 核心模块 | `store.ts` 591 行、`sync.ts` 107、`account.ts` 118、`useAuth.ts` 66、`Home.tsx` 529 |
| 测试 | 20 个单测文件 / **287 例**；5 个 e2e spec（4 条 `@smoke` + 1 条 `@visual`） |
| 构建产物 | `app/dist` 2.0M；单份引导后的 mock state 6.3KB |
| 数据库 | 单表 `user_data` + 单条 RLS（`for all using (auth.uid() = user_id)`） |
| 本机 key | `fitupLocalKeys()` 共 8 个：2 个 `fitup:u:*` + 6 个旧版 `fitup:*` |
| 数据上限 | `setLogs` 每动作 30 条（`EXERCISE_LOG_CAP`）；`weights` / `activity` 无上限 |

### 0.4 已有能力（不要重做）

`useCloudStorage` 已是一套半成品离线方案：首帧同步读缓存（`store.ts:464`）、8 秒读超时与 `loadError` 兜底（`sync.ts:18`、`store.ts:494`）、读失败不写默认值以防覆盖云端（`store.ts:491`）、dirty 标记让下次启动跳过远端拉取并重推（`store.ts:483`）、退出前 `flush()` 补写（`store.ts:552`）。T7a 是**接上断掉的最后一截**，不是从零建离线系统。

### 0.5 三条硬约束（破坏了会出事）

1. **保持「读失败期间禁止自动 upsert 云端」**。删掉 `if (loadError) return` 是最容易犯的错——它会让旧缓存覆盖云端真实数据，是方案 §4 记录过的历史事故。正确做法是只把**本机写盘**移到判断之前。
2. **不新增任何 localStorage key**。T7a 复用现有 `cloudCacheKey` / `cloudDirtyKey` 即可表达「待同步」，不需要写队列。这样 `fitupLocalKeys()`（`account.ts:63`）和 T4 刚修的删除守卫都不用动。一旦未来引入队列（T7b），**任何新 key 必须并入 `fitupLocalKeys()`**，否则删号后队列重放会把体重 / 体脂重新写回云端，违反 `docs/2026-10-18-account-data-rights.md` 的删除权。
3. **`retry()` 必须和 `store.ts:521` 一起改**。只修 521，点「重试」时 `store.ts:501` 的整份覆盖仍会冲掉离线期间的写入，等于只修了一半。

### 0.6 明确接受的风险（写进 PR 正文，别藏）

T7a **不改变整文档 last-write-wins 语义**（`sync.ts:65-75` 一次 upsert 整份 jsonb）。多设备并发时，离线一方重推仍可能覆盖另一设备的写入。本阶段只保证「单设备离线写入不丢」，把冲突解决留给 T7b。这是刻意的取舍，不是遗漏。

---

## 1. 失效点清单与处理范围

| # | 位置 | 现象 | T7a 是否修 |
|---|---|---|---|
| A | `store.ts:521` | `loadError` 期间连 localStorage 都不写，刷新即丢 | **修（核心）** |
| B | `store.ts:501` / `546-550` | `retry()` 用远端整份覆盖，冲掉离线期间改动 | **修（核心）** |
| C | `Home.tsx:130` / `389` / `175` | 「已暂存本地」「网络恢复后会自动重试」「下次登录会自动重试」与实际行为不符 | **修（核心）** |
| D | `sync.ts:65-75` | `saveUserData` 无超时；迁移分支 `store.ts:507` 的 `await` 挂住 → 永久 splash | **修** |
| E | 全仓无 `navigator.onLine` / online 事件 / 重试循环 | 网络恢复后不会自动重放 | **修（轻量）** |
| F | `useAuth.ts:23-26` | `getSession().then` 无 `.catch`，Promise reject → 永久「正在恢复登录状态…」 | **修** |
| G | 无 SW / PWA / manifest、无缓存头 | 冷启动断网时应用壳无可靠离线来源 | **阶段二，独立 PR** |
| H | `mock-supabase.mjs` 只返回成功 | 弱网路径零自动化覆盖 | **修（测试）** |
| I | 整文档 last-write-wins、无版本号 / 冲突解决 | 多设备互相覆盖 | **不修（T7b）** |
| J | `weights` / `activity` 无上限，长期膨胀 | 整份序列化开销增长 | **不修**（当前量级非瓶颈） |

---

## 2. 改动方案

### 2.1 核心：拆分本机持久化与云端回写（`store.ts:517-544`）

把 effect 重排成三段，**顺序不能变**：

```ts
useEffect(() => {
  if (!ready) return
  // ① 无论 loadError，先把最新状态落本机并置脏标记
  try {
    localStorage.setItem(cloudCacheKey(userId), JSON.stringify(state))
  } catch { /* ignore */ }
  markCloudDirty(userId)

  // ② 云端读取失败时禁止自动 upsert：本机缓存可能是旧的，推上去会覆盖云端
  if (loadError) return

  // ③ 原有 800ms 防抖 + snapshot 竞态保护，逻辑不动
  const snapshot = state
  const timer = setTimeout(() => { /* ...原样... */ }, 800)
  return () => clearTimeout(timer)
}, [state, ready, userId, loadError])
```

注意 ① 在 `loadError` 期间每次 state 变更都会写盘并置 dirty；这是期望行为——`dirty` 的定义本来就是「缓存里有云端还没有的数据」（`store.ts:527` 注释）。

### 2.2 `retry()` 改为「有 dirty 时重推，无 dirty 时重拉」（`store.ts:546-550`）

现状无条件 `setReady(false)` + `reloadKey+1`，重拉成功后 `store.ts:501` 整份覆盖。改为：

- **`isCloudDirty(userId)` 为 true**：不重新拉远端。改为尝试一次 `saveUserData(userId, stateRef.current)`；成功则 `clearCloudDirty`、`setLoadError(null)`、`setSyncError(false)`，横幅消失；失败则保持 `loadError` 与「待同步」提示。理由：dirty 即「本机比云端新」，与 `store.ts:483` 的启动短路语义一致。
  - **与 §2.1 的边界**：这是用户显式点「重试」触发的写入，不属于 §2.1 拦下的「自动 upsert」；但整份推上去会覆盖云端在此期间的其他写入，属于 §0.6 明确接受的风险。横幅需写明「本机改动将覆盖云端版本」，**不额外加确认弹层**（避免把 T4 刚收拾掉的多重确认又请回来）。
  - 重推成功后清 `loadError` 的含义是「本机整份已上云、本机即最新」，**并不代表重新拉取过远端**，代码注释里要写清，别让后来者误以为远端状态已被确认。
- **dirty 为 false**：走原有重拉路径。
- 两种情况都要给 toast 或横幅反馈，不能静默。

同时把 `store.ts:500-501` 的远端覆盖加一条守卫：`isCloudDirty(userId)` 为 true 时不做整份覆盖，只合并远端**本机缺失的域**（`Object.keys` 级别即可，不做字段级合并），避免把离线期间的新数据抹掉。

> 实现取舍：这里**不要**做字段级合并。T7a 只要求「离线改动不被整份覆盖」，域级兜底足够；字段级合并属于 T7b，做了反而引入静默错误。

### 2.3 写请求超时（`sync.ts`）

`withTimeout()`（`sync.ts:21-35`）目前只服务 `loadUserData`。把它抽成模块级通用函数，给 `saveUserData` 套一层（建议 `SAVE_TIMEOUT_MS = 8000`，与读超时一致），超时返回 `false` 而不是抛错，保持现有调用方的 boolean 语义。`store.ts:507` 迁移分支的 `await saveUserData` 因此不再可能永久挂住。

> `withTimeout` 只是忽略迟到结果，**不取消底层请求**（`sync.ts:20` 注释已说明）。T7a 不引入 `AbortController`，避免扩大改动面。

可选：`deleteCloudRow`（`account.ts:79-87`）同样加超时，防止删除流程卡死。

### 2.4 在线状态与文案（`Home.tsx`）

- 新增 `online` 事件监听（放在 `Home.tsx`，不要塞进 `store.ts` 的 effect）：网络恢复时，若 `loadError` 且 dirty，触发 §2.2 的重推分支；成功后清除 `syncError`。
- 把三处不实文案改成**可验证的状态**：
  - `Home.tsx:130` toast：「同步失败，数据已暂存本地，网络恢复后会自动重试」→ 改成明确区分「本机已保存 / 尚未上云」的表述。
  - `Home.tsx:389` 横幅：补一行待同步条数，例如「本机有 N 项改动尚未同步到云端」；条数从 store 暴露的 `pendingCount` 取，不要写死。
  - `Home.tsx:175` 退出提示：「部分数据未能同步，下次登录会自动重试」在 `loadError` 期间同样要保证 dirty 已置位——§2.1 之后这句话才成立。
- 新增 `pendingCount` 到 `useCloudStorage` 返回值（dirty 为 true 时返回待同步域数或固定为 1，不要求精确统计，但必须与 dirty 同步变化）。

### 2.5 会话兜底（`useAuth.ts:23-26`）

给 `getSession().then(...)` 补 `.catch(() => { setUser(null); setLoading(false) })`，并在 `finally` 里保证 `setLoading(false)` 只执行一次。避免 Promise reject 时永久停在 `App.tsx:20` 的 splash。

### 2.6 删除权与账号隔离（验收项，通常无需改代码）

T7a 不新增 key，因此 `fitupLocalKeys()` / `clearLocalData()` / `deleteAccount()`（`account.ts:105-118`）**保持不变**。但必须补一条 e2e：删号后重新登录，云端 `user_data` 仍为空、本机 `fitup:u:*` 已清空，确认没有任何残留路径能把数据重放回来。

`deleteAccount` 里 `flush()` 返回 false 即中止的守卫（T4 修复）继续有效：`loadError` 期间 `flush()` 仍返回 false，删号被拦，语义正确，**不要为了 T7a 放宽它**。

### 2.7 e2e 故障注入（`app/e2e/`）

`mock-supabase.mjs` 现有控制端点是 `/__health`、`/__state`、`/__reset`（`:145-157`），所有业务响应立即成功。新增：

- `POST /__fault`，body 形如 `{ "mode": "offline" | "slow" | "error", "ms": 9000 }`，存在模块级 `fault` 变量；`POST /__fault` 带 `{ "mode": "none" }` 恢复。
- `__reset` 时一并清空 `fault`，避免用例间串状态（现有 `workers: 1` 串行，必须保持）。
- 在 `/rest/v1/user_data` 的 GET / POST 分支前插入故障检查：`offline` → `res.destroy()`（模拟 `Failed to fetch`）；`slow` → `await sleep(ms)` 后正常响应；`error` → `sendJson(res, 503, {...})`。
- 注意 `:130-141` 的 CORS 回显预检头逻辑不要动（T6 踩过硬编码白名单漏头的坑）。

新增 `app/e2e/offline-write.spec.ts`，用 `@offline` tag：

1. `__fault = { mode: "offline" }` → 登录引导 → 断网状态下记组 + 打卡 → 断言 UI 出现「本机有改动尚未同步」。
2. 读取 `localStorage['fitup:u:{uid}']` 与 `fitup:u:{uid}:dirty`，断言含 `setLogs` / `checks["2:0:0"]` / `activity["2026-11-09"]`，且 dirty 为 `"1"`。
3. `page.reload()` → 断言三项数据仍在（**这是本方案的核心回归断言**）。
4. `__fault = { mode: "none" }` → 触发 `online` / 点「重试」→ 轮询 `__state` 确认云端已更新，断言横幅消失。
5. 另加一条：删号后重新登录，断言云端仍为空、本机无残留。

`package.json` 加 `test:offline`（`playwright test --grep @offline`），或把 `test:e2e` 的过滤改成 `--grep "@smoke|@offline"`。**注意**：`playwright.config.ts` 里**不要**设 `grep`——CLI 的 `--grep` 会与 config 取交集，T6 已因此报过 "No tests found"。

### 2.8 应用壳离线（阶段二，独立评审）

若要解决失效点 G，单独一个 PR：新增极简 Service Worker，只预缓存 `app/dist` 中带 content-hash 的 HTML / JS / CSS，不碰数据层、`supabase` 请求一律 `network-only`。必须在 PR 正文写明两个风险：首访会预取懒加载 chunk（`BodyData` 约 451KB）；Pages 部署 + `vite.config.ts` 的 `base: './'` 下作用域与版本迁移配错会缓存旧版 JS，出现「部署了但用户还是旧页面」。**本方案默认不实施**，仅列为可选项。

### 2.9 文档与 README

- `README.md` 更新日志补一条「2026-11-09 · 离线写入加固（T7a）」，写明「云端读失败期间的改动现在落本机、刷新不丢、联网后重推」，并注明**仍未解决多设备冲突**。
- 单测数变化则同步 badge、技术栈表、常用命令三处（当前 287）。
- 常用命令补 `test:offline`。
- 本文件状态从「待评审」改为「已实施」，并回填 PR 号。

---

## 3. 验收清单

> 沿用 `docs/2026-11-06-next-tasks-plan.md` §3.2 的口径。核对结果见 §8 实施记录；
> §3.4 中与 PR / CI 相关的项在 PR 创建并跑完远端 workflow 后回填。

### 3.1 功能（核心）

- [x] `loadError` 期间每次 state 变更都写入 `cloudCacheKey` 并置 `cloudDirtyKey`
- [x] `loadError` 期间**没有**任何自动 `saveUserData` 调用（防覆盖语义不破）
- [x] 断网记组 → 刷新 → `setLogs` / `checks` / `activity` 三项仍在（e2e 覆盖）
- [x] 点「重试」不再冲掉离线期间改动；dirty 为 true 时走重推、false 时走重拉
- [x] 网络恢复后自动重推成功，dirty 清除、`syncError` 清除、横幅消失
- [x] `saveUserData` 超时返回 `false`；模拟挂起时不会永久停在 `AppSplash`
- [x] `getSession()` reject 时不会永久停在「正在恢复登录状态…」
- [x] 三处文案与实际行为一致；横幅的待同步条数随 dirty 变化

### 3.2 安全与数据权利（硬性，任一不过不得合并）

- [x] **未新增任何 localStorage key**；`fitupLocalKeys()` 仍是原来 8 个（单测锁定）
- [x] `deleteAccount` 的 `flush()` 守卫未被放宽；`loadError` 期间删号仍被中止
- [x] 删号后本机 `fitup:u:*` 已清空、云端行已删除、**无重放复活**（验收方式有一处调整，见 §8）
- [x] 切换账号（不同 `userId`）后，A 的待同步状态不会出现在 B 的界面 / 请求里
- [x] 导出 JSON 仍为七个域，未因改造丢失字段

### 3.3 测试

- [x] `npm run lint`：0 error
- [x] `npm run test`：23 文件 / **323 例全绿**；新增 **36 例**（≥20），覆盖写盘、dirty、retry 双分支、写超时、`getSession` reject、pendingCount、删除权回归
- [x] `npm run test:e2e`：4 条 `@smoke` **连跑 3 次**全绿（22.0 / 18.9 / 15.9s）
- [x] `npm run test:offline`：3 条全绿（35.6s / 复跑 32.7s），含「断网写入 → 刷新仍在」与「删号后不复活」
- [x] `npm run test:visual`：原 12 张弹层截图仍可生成，横幅 UI 改动另补 4 张（共 16 张）
- [x] 用例里用 `__reset` 清 `fault`，`workers: 1` 与 `retries: 0` 保持不变

### 3.4 CI / 文档 / 提交

- [x] `ci.yml` 的 `e2e` job 能跑新增的 `@offline` 用例：PR #55 的 Linux CI `e2e` **pass 1m20s**、`check` pass 1m1s、`deploy` skipping，workflow 结论 `success`
- [x] `npm ci --dry-run` 通过；只加 script、`package-lock.json` 无变化
- [x] README 更新日志、badge、技术栈表、常用命令四处口径一致（287 → 323）
- [x] 本文件状态改为「已实施」并回填 PR **#55**
- [x] 从 `main` 切 `feat/offline-hardening`；功能 `2f3a353` + 文档 `bd68406` 两个提交（PR 号回填另加一个纯文档提交）；PR 正文写明验证结果、**明确列出未解决的多设备冲突（T7b）**、不虚报真机截图

---

## 4. 已知坑（沿用上游 §4，并补本轮新增）

| 坑 | 现象 | 规避 |
|---|---|---|
| 直接删 `if (loadError) return` | 旧缓存覆盖云端真实数据 | 只把本机写盘移到判断之前，自动 upsert 仍被拦 |
| `retry()` 整份覆盖 | 离线改动被冲掉 | dirty 时重推、无 dirty 时才重拉 |
| effect 里同步 setState | lint `react-hooks/set-state-in-effect` 拦截（T4 踩过） | 状态重置放事件回调，不放 effect |
| CLI `--grep` 与 config `grep` 取交集 | `No tests found`（T6 踩过） | config 不设 grep，各 npm script 自带过滤 |
| Playwright webServer 用 `url` | Vite 对不带 `Accept` 的探针返回 404，就绪超时 | 继续用 `port: 3100` 做 TCP 就绪检查 |
| `page.reload()` 后 `page.goBack()` | Chromium 清空回退历史，返回 `null` | 不依赖 goBack；用原生 `history.back()` 循环 |
| vitest forks worker 偶发启动超时 | 首跑少若干例、退出码 1 | 重跑同一命令确认；不是代码失败时如实记录 |
| `gh pr create` 回报「已存在」 | 本环境固定误报，PR 其实已创建 | `gh pr view <n>` 核实 commit / 文件，不要重复创建 |
| SW 预缓存整个 dist | 首访预取懒加载 chunk、可能缓存旧版 JS | 阶段二独立 PR，只缓存带 hash 的构建产物 |

---

## 5. 明确不做（T7b 边界）

- **按域分表 / 版本号 / 字段级合并 / 冲突解决**：`docs/2026-11-06-next-tasks-plan.md:491` 已判定「整文档 last-write-wins + 离线写队列会互相冲突，需先重构同步模型（按域分表或版本号），成本远大于收益」。本方案不触碰。
- **离线写操作队列 + `clientId/seq` 幂等重放**：只有出现明确的多设备并发需求才做；提前引入会把「可见的丢」变成「静默的错」，并迫使 `schema.sql` / RLS / 数据迁移一起改。
- **数据库表结构、RLS 策略变更**：现有一张 `user_data` 表 + 一条策略，多表意味着多份策略，漏写一张即跨用户健康数据泄露。
- **Service Worker / PWA**：列为 §2.8 阶段二，默认不在本 PR。
- **训练数据分页 / 历史周查询、多语言、图表库替换**：沿用上游 §5。

---

## 6. 实施顺序与工作量

| 步骤 | 内容 | 估算 |
|---|---|---|
| 1 | `store.ts` §2.1 + §2.2（核心两处） | +40~60 行 |
| 2 | `sync.ts` 写超时、`useAuth.ts` catch | +15~25 行 |
| 3 | `Home.tsx` online 监听 + 三处文案 + `pendingCount` | +50~80 行 |
| 4 | `mock-supabase.mjs` `/__fault` + `offline-write.spec.ts` + script | +60~90 行 |
| 5 | 单测补充（store / sync / useAuth / account 回归） | +20~30 例 |
| 6 | README + 本文状态回填 | 文档 |

合计约 **+150~250 行生产代码**、**+20~30 例单测**、**+2~3 条 e2e**；对性能的影响是每次 state 变更多一次同步 `JSON.stringify`（当前单份 state 约 6.3KB），量级可忽略。

**建议一个 PR、两个提交**（功能 + 文档），沿用本轮 T1–T6 的惯例；§2.8 的 SW 若做，另开独立 PR。

---

## 7. 相关文件索引

| 文件 | 本方案涉及位置 |
|---|---|
| `app/src/lib/store.ts` | `:464` 缓存首帧读、`:483` dirty 短路、`:500-501` 远端覆盖、`:507` 迁移写、`:517-544` 持久化 effect、`:546-550` retry、`:552-564` flush |
| `app/src/lib/sync.ts` | `:18` 读超时常量、`:21-35` withTimeout、`:48-62` loadUserData、`:65-75` saveUserData |
| `app/src/lib/account.ts` | `:63-65` fitupLocalKeys、`:68-76` clearLocalData、`:105-118` deleteAccount |
| `app/src/hooks/useAuth.ts` | `:21-34` session 恢复 |
| `app/src/pages/Home.tsx` | `:128-137` syncError toast、`:171-178` 退出、`:386-396` loadError 横幅 |
| `app/src/sections/WeeklyPlan.tsx` | `:906-912` 记组 + 自动打卡（e2e 要复现的路径） |
| `app/e2e/mock-supabase.mjs` | `:145-157` 控制端点、`:191-218` user_data、`:130-141` CORS |
| `app/playwright.config.ts` | `:9-10` grep 注释、`:13-17` workers/retries、`:25-44` webServer |
| `.github/workflows/ci.yml` | `:76-96` e2e job |
| `docs/2026-10-18-account-data-rights.md` | 删除权边界，§3.2 硬性验收项的依据 |
| `docs/2026-11-06-next-tasks-plan.md` | `:91` T7 定级、`:461` 弱网自检项、`:491` 不做结论 |

---

## 8. 实施记录（2026-11-10）

**PR**：[#55](https://github.com/Craftr-X/fitnessWeb/pull/55)（OPEN、MERGEABLE、未合并）· **分支**：`feat/offline-hardening`（从 `main@8762db1` 切出）· **基线**：单测 287 例 → 323 例

### 8.1 相对方案的 5 处细化（都写进 PR 正文，不藏）

1. **置脏条件加了一层判断**。§2.1 的伪代码是「无论 `loadError`，先写盘并置脏」。实现改为用 `syncedStateRef` 比对 state 引用：只有真的产生了新改动、或启动前已带 dirty 标记时才置脏。原因：`ready` 从 false→true 也会触发一次持久化 effect，无条件置脏会把「云端读失败但用户什么都没改」误报成「有待同步改动」；更严重的是下次启动会命中 `store.ts:483` 的 dirty 短路，把**可能比云端旧**的缓存整份推上去，正好绕开 §0.5 硬约束 1 想防的历史事故。同时给 ③ 加了「无改动且无 dirty 就不推」的 guard，避免重推成功后 `loadError` 变 null 触发 effect 重跑时重复标脏 / 重复 upsert。
2. **`pendingCount` 用 `useSyncExternalStore` 派生**。dirty 在 localStorage，React 本来感知不到；没有在 effect 里同步 setState（§4 的 lint 坑），而是给 `markCloudDirty` / `clearCloudDirty` 加模块级订阅通知，hook 订阅后派生 `pendingCount`。**没有新增任何 localStorage key**，只有内存里的监听器集合。
3. **`online` 判据与横幅显示条件都放宽了**。方案 §2.4 写「网络恢复时，若 `loadError` 且 dirty，触发重推」；但刷新后 dirty 短路会直接 `setReady(true)` 且 `loadError=null`，此时既没有横幅、也没有「重试」按钮，只判 `loadError` 会让离线改动永远等不到重推。实现改为 `loadError || syncError || pendingCount > 0` 触发，横幅显示条件改为 `loadError || (pendingCount > 0 && syncError)`，并按 `loadError` 分两种文案。这是本轮唯一一处比方案多做的 UI 逻辑。
4. **「删号后云端仍为空」的验收方式调整**。方案 §3.2 这条按字面不可能成立：重新登录后新用户走迁移分支（`store.ts:507` 的 `await saveUserData`）会自动建一份默认文档，云端必然有行。实际断言改为：删号当下云端行已删除、本机 `fitup:u:*` 全清空；重新登录后云端 `setLogs` / `checks` / `activity` 均为空 —— 这才是「无重放复活」的本意。
5. **横幅 UI 改动补了视觉留档**。新增 `app/e2e/visual-offline.spec.ts` 生成 390/1440 × 深浅色共 4 张，留档 `docs/e2e-screenshots/2026-11-10/`（原 12 张弹层截图仍在 11-09 目录、可复现）。为防故障注入串状态，`app/e2e/visual.spec.ts` 加了 `resetBackend` 前置，新 spec 的 `afterEach` 恢复 fault。

### 8.2 验证结果

| 项 | 结果 |
|---|---|
| `npm run lint` | 0 error |
| `npm run test` | 23 文件 / **323 例全绿**（新增 36 例：`offlineHardening` 26 + `syncTimeout` 6 + `useAuth` 4） |
| `npm run build` | 通过，13.52s / 3473 modules |
| `npm run test:e2e` | 4 条 `@smoke` **连跑 3 次**全绿（22.0 / 18.9 / 15.9s） |
| `npm run test:offline` | 3 条全绿（35.6s；复跑 32.7s） |
| `npm run test:visual` | 2 条全绿，16 张截图；已抽查 390 深色 / 1440 浅色横幅，深浅色生效、文案完整、无溢出 |
| `npm ci --dry-run` | 通过；只加 npm script，`package-lock.json` 无变化 |
| 远端 CI（PR #55） | `check` pass 1m1s、`e2e` **pass 1m20s**（含 `@offline` 三条）、`deploy` skipping；workflow 结论 `success` |

> 首跑 `npm run test` 出现过一次 vitest forks worker 启动超时（`utils.test.ts` 未启动，少 4 例、退出码 1），重跑同一命令 23 文件 323 例全绿；与 #52 / #54 同类偶发资源问题，非代码失败。

### 8.3 仍未做 / 已知边界

- §2.8 的 Service Worker / PWA **未实施**，阶段二独立评审。
- T7b 全部不做：按域分表 / 版本号 / 字段级合并 / 离线写队列 / RLS 变更。
- **整文档 last-write-wins 未改变**：多设备并发时，离线一方重推仍可能覆盖另一设备的写入。
- 16 张截图是 dev server + mock 数据下的浏览器截图，**不是真机截图**；移动端键盘弹起、邮件客户端唤起未真机验证。
- e2e 跑在 `npm run dev`（StrictMode）而非生产构建，与线上行为存在已知差异。
