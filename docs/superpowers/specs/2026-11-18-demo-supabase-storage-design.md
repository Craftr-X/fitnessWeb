# 教学示范视频 · Supabase Storage 镜像设计

**日期**：2026-11-18  
**状态**：待用户确认后进入实现计划  
**范围**：迁现有 MuscleWiki 视频到自有 Storage + 产出缺视频/缺示范清单  
**非目标**：本轮不批量抓取国外新站视频、不改计划引擎动作池

---

## 1. 背景与目标

教学示范目前直链 `media.musclewiki.com`，国内访问慢且部分路径曾 404。PR #59 已清洗失效 URL、加超时与分时加载。下一步把**已有可用视频**镜像到 **Supabase Storage**，站点优先播自有链接；并为后续从国外教程站补片准备**缺口清单**。

### 成功标准

1. 打开有视频的动作示范时，主请求落在 `{SUPABASE_URL}/storage/v1/object/public/exercise-demos/...`
2. 压缩后单文件目标 ≤500KB（有 ffmpeg 时）；无 ffmpeg 可原样上传并在脚本日志警告
3. 仓库内有一份可维护的缺口文档：完全无示范 / 仅有图无视频
4. 现有降级链保留：自有视频失败 → 仍可落到 free-exercise-db 静图（若该动作有）
5. 单测 + lint 绿；不引入密钥进仓库

---

## 2. 方案选择

采用 **公开 bucket + 稳定公开 URL（方案 A）**。

| 选项 | 结论 |
|---|---|
| A. 公开 bucket | **采用**：播放简单、可缓存、前端改动小 |
| B. 私有 + 签名 URL | 不做：弱网更慢、复杂度高 |
| C. 只备份不切流量 | 不做：解决不了慢加载 |

---

## 3. Storage 布局

- **Bucket 名**：`exercise-demos`
- **公开读**：匿名可读；**写入**仅 service role / 本地脚本用管理密钥（密钥不进 git、不进前端）
- **对象路径**：
  - `videos/{mwKey}.mp4` — 与现 MuscleWiki 文件名（无扩展名）对齐，便于映射
  - （可选后续）`posters/{mwKey}.jpg` — 本轮可不做，继续用现有 `pickVideoPoster` 备用图

**公开 URL 形态**：

```text
{VITE_SUPABASE_URL}/storage/v1/object/public/exercise-demos/videos/{mwKey}.mp4
```

---

## 4. 前端改动

### 4.1 URL 构造

- 在 `app/src/lib/demos.ts` 增加自有基址常量，例如：
  - `DEMO_STORAGE_BASE = `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/exercise-demos/videos``
  - 若 `VITE_SUPABASE_URL` 缺失：开发提示已有；示范视频回退到 MuscleWiki 原链（避免本地无 env 时全挂）
- `mw(...keys)` 改为产出**自有 URL 优先**；可选保留 MuscleWiki 作为视频候选第二位（本轮推荐：**仅自有 URL + 现有 img 降级**，避免又慢等外链 404；若自有未上传成功，组件 2s 超时后落到 fed 图）

### 4.2 组件

- `ExerciseDemoButton` 逻辑保持 PR #59 的超时 / 分时加载；无需为 Storage 单独改交互
- `BANNED_MW_VIDEO_KEYS` 继续约束「禁止再引入已确认坏 key」；镜像脚本只处理当前库里合法 key

### 4.3 环境变量

- 沿用已有 `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`（公开读 bucket 用 anon 即可读对象）
- **上传脚本**另需 `SUPABASE_SERVICE_ROLE_KEY`（仅本地 / CI secret，禁止进前端与 commit）

---

## 5. 镜像与上传脚本

路径建议：`app/scripts/mirror-demos.mjs`（或仓库根 `scripts/`，与现有 `app/` 习惯对齐选一）。

**流程**：

1. 从 `demos.ts` 导出或解析 `collectDemoVideoUrls()` / key 列表（优先跑编译后的逻辑，或维护一份由测试锁定的 key 列表生成步骤）
2. 对每个 key：若本地缓存不存在，从 MuscleWiki 下载到 `app/scripts/.demo-cache/`（gitignore）
3. 若检测到 `ffmpeg`：转码为 H.264、缩短码率、限制高度≤720，输出到 cache 的 `compressed/`
4. 使用 service role 上传到 `exercise-demos/videos/{key}.mp4`（upsert）
5. 打印汇总：成功 / 跳过 / 失败；失败不阻断已成功项的提交指引

**幂等**：重复跑只覆盖同名对象；不删 bucket 内未知文件（便于以后手动补的新片保留）。

---

## 6. SQL / 控制台一次性配置

新增 `app/supabase/storage-exercise-demos.sql`，内容包含：

- 创建 bucket `exercise-demos`（public）
- 策略：`anon` / `authenticated` 可 `SELECT`（读对象）
- **不**给 anon insert/update/delete

执行方式：维护者在 Supabase SQL Editor 跑一次；README / 方案文档写明步骤。上传仍用 service role API，不依赖前端写权限。

---

## 7. 缺口清单

新增 `docs/demo-video-gaps.md`（可由脚本或单测夹具生成，避免手写漂移）。

**分类**：

| 类别 | 定义 | 用途 |
|---|---|---|
| 完全无示范 | 教学动作能被计划/池子引用，但 `getDemo` 未命中（沿用 coverage 白名单豁免休息类） | 后续补整条 DemoInfo |
| 仅有图无视频 | 有 `getDemo`，但 front+side 无任何 `type:'video'` | 后续只补 mp4 即可 |

本轮**不**自动从外站下载补齐；清单供人工补片。补片流程（文档写清）：压缩上传 → 在 `DEMOS` 增加 `mw('key')` → 重跑 gaps 文档变短。

另：单测可断言「gaps 生成函数的输出与文档或快照一致」或至少「分类函数纯测」，防止分类规则回退。

---

## 8. 测试与验收

- 单测：`collectDemoVideoUrls` 指向 Storage 路径（mock `import.meta.env` 或抽纯函数 `demoVideoUrl(key, base)`）
- 单测：gaps 分类对固定 fixture 正确
- 保留 banned key 断言
- 手动：配置好 Storage 并上传后，DevTools Network 可见 supabase storage 域名
- lint / `npm test` 通过

---

## 9. 风险与边界

| 风险 | 缓解 |
|---|---|
| MuscleWiki / 外站版权 | 本轮仅镜像现已使用的品牌示范 URL；文档注明后续外站片源需自行确认授权 |
| service role 泄露 | 只进本机 env / GitHub Actions secret；脚本拒绝在无 key 时默默用 anon 上传 |
| 仓库体积 | 视频不进 git；仅 cache 本地且 gitignore |
| 未执行 SQL / 未上传就上线 | 前端超时后落到静图；文档把「先 SQL、再 mirror、再发版」写成顺序 |
| 大文件超 Storage 免费档 | 压缩目标 ≤500KB；10 人流量可忽略 |

---

## 10. 实施顺序（预览，细节见后续 plan）

1. SQL + 文档脚手架 + gitignore  
2. URL 构造改造 + 单测  
3. gaps 生成 + `docs/demo-video-gaps.md`  
4. mirror 脚本（下载/压缩/上传）  
5. 维护者本地跑通上传；手动验收  
6. PR

---

## 11. 规格自检

- [x] 无「TBD」占位影响实现
- [x] 与 PR #59 行为不冲突（超时/分时保留）
- [x] 范围不含外站抓取
- [x] 密钥不进仓库
- [x] 成功标准可验证
