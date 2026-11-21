# 教学示范视频 · Supabase Storage 镜像 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把现有 MuscleWiki 示范视频迁到公开 Supabase Storage，前端改打自有 URL，并产出缺示范/仅图无视频清单。

**Architecture:** 纯函数构造 Storage URL；`mw()` 只产出自有视频源 + 现有 fed 图降级。本地 `mirror-demos.mjs` 用 service role 下载/压缩/上传。缺口分类纯函数生成 `docs/demo-video-gaps.md`。

**Tech Stack:** Vite/React、Supabase Storage、Node ESM 脚本、可选 ffmpeg、Vitest

**Spec:** `docs/superpowers/specs/2026-11-18-demo-supabase-storage-design.md`

## Global Constraints

- Bucket 名固定：`exercise-demos`；对象路径：`videos/{mwKey}.mp4`
- 前端只用已有 `VITE_SUPABASE_URL`；上传只用本机 `SUPABASE_SERVICE_ROLE_KEY`（禁止进 git / 前端）
- 本轮不抓国外新站；不改 planEngine 动作池
- 保留 PR #59 超时/分时加载；保留 `BANNED_MW_VIDEO_KEYS`
- 视频文件不进仓库；`app/scripts/.demo-cache/` 必须 gitignore
- Commit 前缀：`feat:` / `fix:` / `test:` / `docs:` / `chore:`

## File map

| 路径 | 职责 |
|---|---|
| `app/src/lib/demoUrls.ts` | 纯函数：`demoStorageBase` / `demoVideoUrl` / `mwSourceUrl` |
| `app/src/lib/demos.ts` | `mw()` 改用自有 URL；导出 key 收集 |
| `app/src/lib/demoGaps.ts` | 缺口分类：`classifyDemoGaps` |
| `app/src/test/demoUrls.test.ts` | URL 构造单测 |
| `app/src/test/demoGaps.test.ts` | 缺口分类单测 |
| `app/supabase/storage-exercise-demos.sql` | 建 bucket + 公开读策略 |
| `app/scripts/mirror-demos.mjs` | 下载 / 压缩 / 上传 |
| `app/scripts/generate-demo-gaps.mjs` | 写 `docs/demo-video-gaps.md` |
| `docs/demo-video-gaps.md` | 缺口清单（生成物） |
| `.gitignore` | 忽略 `.demo-cache` |
| `docs/superpowers/specs/2026-11-18-demo-supabase-storage-design.md` | 状态改为已批准 / 实施中 |

---

### Task 1: URL 纯函数 + 单测

**Files:**
- Create: `app/src/lib/demoUrls.ts`
- Create: `app/src/test/demoUrls.test.ts`
- Modify: `app/src/lib/demos.ts`（`mw` / `collectDemoVideoUrls` 改走新函数）

**Interfaces:**
- Produces:
  - `MW_MEDIA_BASE = 'https://media.musclewiki.com/media/uploads/videos/branded'`
  - `demoStorageBase(supabaseUrl: string | undefined): string | undefined`
  - `demoVideoUrl(key: string, supabaseUrl: string | undefined): string` — 有 supabaseUrl 时返回 Storage URL，否则返回 MuscleWiki URL
  - `collectDemoVideoKeys(): string[]` — 从 DEMOS 收集去重 key（在 demos.ts）

- [x] **Step 1: 写失败单测** `app/src/test/demoUrls.test.ts`

```ts
import { describe, expect, it } from 'vitest'
import { demoStorageBase, demoVideoUrl, MW_MEDIA_BASE } from '@/lib/demoUrls'

describe('demoVideoUrl', () => {
  it('有 supabaseUrl 时指向 public storage videos 路径', () => {
    const url = demoVideoUrl('male-Bodyweight-push-up-front', 'https://abc.supabase.co')
    expect(url).toBe(
      'https://abc.supabase.co/storage/v1/object/public/exercise-demos/videos/male-Bodyweight-push-up-front.mp4',
    )
  })

  it('无 supabaseUrl 时回退 MuscleWiki', () => {
    expect(demoVideoUrl('male-Bodyweight-push-up-front', undefined)).toBe(
      `${MW_MEDIA_BASE}/male-Bodyweight-push-up-front.mp4`,
    )
  })

  it('demoStorageBase 去掉尾斜杠再拼', () => {
    expect(demoStorageBase('https://abc.supabase.co/')).toBe(
      'https://abc.supabase.co/storage/v1/object/public/exercise-demos/videos',
    )
  })
})
```

- [x] **Step 2: 跑测确认失败**

Run: `cd app && npx vitest run src/test/demoUrls.test.ts`  
Expected: FAIL（模块不存在）

- [x] **Step 3: 实现 `demoUrls.ts`**

```ts
export const MW_MEDIA_BASE = 'https://media.musclewiki.com/media/uploads/videos/branded'
export const DEMO_BUCKET = 'exercise-demos'

export function demoStorageBase(supabaseUrl: string | undefined): string | undefined {
  if (!supabaseUrl) return undefined
  const root = supabaseUrl.replace(/\/$/, '')
  return `${root}/storage/v1/object/public/${DEMO_BUCKET}/videos`
}

export function demoVideoUrl(key: string, supabaseUrl: string | undefined): string {
  const base = demoStorageBase(supabaseUrl)
  if (base) return `${base}/${key}.mp4`
  return `${MW_MEDIA_BASE}/${key}.mp4`
}
```

- [x] **Step 4: 改 `demos.ts` 的 `mw`**

```ts
import { demoVideoUrl } from '@/lib/demoUrls'

function mw(...keys: string[]): DemoSource[] {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined
  return keys.map((key) => ({ type: 'video' as const, url: demoVideoUrl(key, supabaseUrl) }))
}

/** 收集示范库视频 key（文件名无扩展名），供镜像脚本 / gaps 使用 */
export function collectDemoVideoKeys(): string[] {
  const keys = new Set<string>()
  for (const demo of Object.values(DEMOS)) {
    for (const source of [...demo.front, ...demo.side]) {
      if (source.type !== 'video') continue
      const m = source.url.match(/\/([^/]+)\.mp4(?:\?.*)?$/)
      if (m) keys.add(m[1])
    }
  }
  return [...keys]
}
```

同步更新 `collectDemoVideoUrls` 仍返回完整 URL 列表；`demoMedia.test.ts` 里 banned 断言继续用 `endsWith(`/${key}.mp4`)`（对 Storage 与 MW 都成立）。

- [x] **Step 5: 跑测通过**

Run: `cd app && npx vitest run src/test/demoUrls.test.ts src/test/demoMedia.test.tsx`  
Expected: PASS

- [x] **Step 6: Commit**

```bash
git add app/src/lib/demoUrls.ts app/src/lib/demos.ts app/src/test/demoUrls.test.ts
git commit -m "feat(demo): 示范视频 URL 改走 Supabase Storage 基址"
```

---

### Task 2: 缺口分类纯函数 + 文档生成

**Files:**
- Create: `app/src/lib/demoGaps.ts`
- Create: `app/src/test/demoGaps.test.ts`
- Create: `app/scripts/generate-demo-gaps.mjs`
- Create: `docs/demo-video-gaps.md`

**Interfaces:**
- Consumes: `getDemo` from demos；动作名列表由调用方传入
- Produces:
  - `export type DemoGapKind = 'missing_demo' | 'image_only'`
  - `export interface DemoGap { name: string; kind: DemoGapKind }`
  - `classifyDemoGaps(names: string[], getDemoFn, isAllowedMissing): DemoGap[]`
  - `formatDemoGapsMarkdown(gaps: DemoGap[], generatedAt: string): string`

- [x] **Step 1: 写失败单测**

```ts
import { describe, expect, it } from 'vitest'
import { classifyDemoGaps, formatDemoGapsMarkdown } from '@/lib/demoGaps'
import type { DemoInfo } from '@/lib/demos'

const demos: Record<string, DemoInfo> = {
  俯卧撑: {
    level: '初级',
    front: [{ type: 'video', url: 'https://x/a.mp4' }],
    side: [{ type: 'img', url: 'https://x/a.jpg' }],
    steps: ['a'],
  },
  腿举: {
    level: '中级',
    front: [{ type: 'img', url: 'https://x/b.jpg' }],
    side: [{ type: 'img', url: 'https://x/b2.jpg' }],
    steps: ['b'],
  },
}

function getDemo(name: string) {
  return Object.entries(demos).find(([k]) => name.startsWith(k))?.[1]
}

describe('classifyDemoGaps', () => {
  it('区分无示范与仅图', () => {
    const gaps = classifyDemoGaps(
      ['俯卧撑', '腿举', '未知动作', '散步 20 分钟'],
      getDemo,
      (n) => n.includes('散步'),
    )
    expect(gaps).toEqual([
      { name: '腿举', kind: 'image_only' },
      { name: '未知动作', kind: 'missing_demo' },
    ])
  })
})

describe('formatDemoGapsMarkdown', () => {
  it('含两类标题', () => {
    const md = formatDemoGapsMarkdown(
      [
        { name: '腿举', kind: 'image_only' },
        { name: '未知动作', kind: 'missing_demo' },
      ],
      '2026-11-18',
    )
    expect(md).toContain('## 完全无示范')
    expect(md).toContain('## 仅有图无视频')
    expect(md).toContain('- 腿举')
    expect(md).toContain('- 未知动作')
  })
})
```

- [x] **Step 2: 跑测确认失败**

Run: `cd app && npx vitest run src/test/demoGaps.test.ts`  
Expected: FAIL

- [x] **Step 3: 实现 `demoGaps.ts`**

```ts
import type { DemoInfo } from '@/lib/demos'

export type DemoGapKind = 'missing_demo' | 'image_only'
export interface DemoGap {
  name: string
  kind: DemoGapKind
}

export function classifyDemoGaps(
  names: string[],
  getDemoFn: (name: string) => DemoInfo | undefined,
  isAllowedMissing: (name: string) => boolean,
): DemoGap[] {
  const out: DemoGap[] = []
  const seen = new Set<string>()
  for (const name of [...names].sort()) {
    if (isAllowedMissing(name) || seen.has(name)) continue
    seen.add(name)
    const demo = getDemoFn(name)
    if (!demo) {
      out.push({ name, kind: 'missing_demo' })
      continue
    }
    const hasVideo = [...demo.front, ...demo.side].some((s) => s.type === 'video')
    if (!hasVideo) out.push({ name, kind: 'image_only' })
  }
  return out
}

export function formatDemoGapsMarkdown(gaps: DemoGap[], generatedAt: string): string {
  const missing = gaps.filter((g) => g.kind === 'missing_demo')
  const imageOnly = gaps.filter((g) => g.kind === 'image_only')
  const lines = [
    '# 教学示范视频缺口清单',
    '',
    `> 生成日期：${generatedAt}。由 \`app/scripts/generate-demo-gaps.mjs\` 生成，勿手改分类结果。`,
    '',
    '补片流程：压缩上传到 `exercise-demos/videos/{key}.mp4` → 在 `demos.ts` 的对应动作加 `mw(\'key\')` → 重跑本脚本。',
    '',
    '## 完全无示范',
    '',
    ...(missing.length ? missing.map((g) => `- ${g.name}`) : ['- （无）']),
    '',
    '## 仅有图无视频',
    '',
    ...(imageOnly.length ? imageOnly.map((g) => `- ${g.name}`) : ['- （无）']),
    '',
  ]
  return lines.join('\n')
}
```

- [x] **Step 4: 实现生成脚本** `app/scripts/generate-demo-gaps.mjs`

脚本职责：用 `npx tsx` 加载 `planEngine` 的 POOL + INJURY_SUBSTITUTES 动作名 + `demos` 的 getDemo；白名单与 `demos.coverage.test.ts` 的 `ALLOW_MISSING` 对齐；写 `docs/demo-video-gaps.md`。

因 `import.meta.env` 在 tsx 下可能缺省，脚本启动前设置：

```js
process.env.VITE_SUPABASE_URL ??= 'https://placeholder.supabase.co'
process.env.VITE_SUPABASE_ANON_KEY ??= 'placeholder'
```

并用 `tsx` 的 register，或把分类逻辑用纯 node 调编译产物。推荐：脚本 `spawnSync`：

```bash
cd app && npx tsx scripts/generate-demo-gaps.ts
```

把逻辑放在 `app/scripts/generate-demo-gaps.ts`（tsx 可直接 import `@/lib/...` 需加 path；更简单：相对路径 `../src/lib/demoGaps.ts`）。

最小可跑版本（`app/scripts/generate-demo-gaps.ts`）：

```ts
import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { POOL, INJURY_SUBSTITUTES } from '../src/lib/planEngine.ts'
import { getDemo } from '../src/lib/demos.ts'
import { classifyDemoGaps, formatDemoGapsMarkdown } from '../src/lib/demoGaps.ts'

const ALLOW_MISSING = ['散步', '充足睡眠', '填写本周反馈', '羽毛球训练', '跑步训练', '骑行训练', '可选']
const isAllowedMissing = (name: string) => ALLOW_MISSING.some((k) => name.includes(k))

const names = new Set<string>()
for (const group of Object.values(POOL)) for (const seed of group) names.add(seed.name)
for (const list of Object.values(INJURY_SUBSTITUTES)) for (const sub of list) names.add(sub.seed.name)

const gaps = classifyDemoGaps([...names], getDemo, isAllowedMissing)
const md = formatDemoGapsMarkdown(gaps, new Date().toISOString().slice(0, 10))
const out = resolve(import.meta.dirname, '../../../docs/demo-video-gaps.md')
writeFileSync(out, md, 'utf8')
console.log(`wrote ${out} (${gaps.length} gaps)`)
```

注意：`planEngine` 经 `store`/`sync` 拉 `supabase.ts` 时会读 `import.meta.env`。在脚本最顶：

```ts
// @ts-expect-error vite env shim for tsx
import.meta.env = import.meta.env ?? {}
import.meta.env.VITE_SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? 'https://placeholder.supabase.co'
import.meta.env.VITE_SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY ?? 'placeholder'
```

若 shim 不稳：改为脚本只扫 `DEMOS` keys 之外的 POOL 名，用正则从 `planEngine.ts` 抽 `name:`——优先修好 env shim。实测用 vitest 同款：在生成脚本前 `vi` 不可用；用动态 `createRequire` 改太重。  
**落地选择：** `generate-demo-gaps.ts` 不 import planEngine，改为复制 coverage 测试里的收集循环到一个 `app/src/lib/demoGapSources.ts`：

```ts
import { POOL, INJURY_SUBSTITUTES } from '@/lib/planEngine'
export function collectTeachableExerciseNames(): string[] { /* 同上 */ }
export const DEMO_GAP_ALLOW_MISSING = [ ... ]
```

并在 vitest 环境跑生成：`npx vitest run src/test/generateDemoGapsDoc.test.ts` 里 `writeFileSync`——或 npm script：`node --import tsx` + stub `app/src/lib/supabase.ts` 的 env。

**最终选定（减少踩坑）：** npm script：

```json
"gaps:demo": "vitest run src/test/writeDemoGapsDoc.test.ts"
```

测试文件调用 `classifyDemoGaps` + `writeFileSync` 写出文档（测试环境已有 vite env）。文档仍提交进 git。

- [x] **Step 5: 跑测 + 生成文档**

Run: `cd app && npx vitest run src/test/demoGaps.test.ts src/test/writeDemoGapsDoc.test.ts`  
Expected: PASS，且 `docs/demo-video-gaps.md` 生成

- [x] **Step 6: Commit**

```bash
git add app/src/lib/demoGaps.ts app/src/test/demoGaps.test.ts app/src/test/writeDemoGapsDoc.test.ts docs/demo-video-gaps.md
git commit -m "docs(demo): 生成教学示范缺口清单"
```

---

### Task 3: Storage SQL + gitignore + 镜像脚本

**Files:**
- Create: `app/supabase/storage-exercise-demos.sql`
- Create: `app/scripts/mirror-demos.mjs`
- Modify: `.gitignore`
- Modify: `app/package.json`（加 `mirror:demos` script）
- Modify: `DEPLOY.example.md` 或 `app/README.md` 增加「先 SQL → 再 mirror」三步说明（短段落）

**Interfaces:**
- Consumes: `collectDemoVideoKeys` 的输出；环境变量 `VITE_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`
- Produces: Storage 对象 `videos/{key}.mp4`

- [x] **Step 1: SQL 文件**

```sql
-- 在 Supabase SQL Editor 执行一次
insert into storage.buckets (id, name, public)
values ('exercise-demos', 'exercise-demos', true)
on conflict (id) do update set public = true;

create policy "exercise demos public read"
on storage.objects for select
to public
using (bucket_id = 'exercise-demos');
```

（若项目已有同名 policy，文档注明可 `drop policy if exists` 后重建。）

- [x] **Step 2: gitignore**

追加：

```
app/scripts/.demo-cache/
```

- [x] **Step 3: mirror 脚本核心行为**

`app/scripts/mirror-demos.mjs`：

1. 读 env：`VITE_SUPABASE_URL`（或 `SUPABASE_URL`）、`SUPABASE_SERVICE_ROLE_KEY`；缺 key 则 `console.error` 并 `process.exit(1)`（禁止静默用 anon 上传）
2. 用子进程 `npx vitest run` 不可取；改为解析：从 `demos.ts` 用正则抽 `mw('...')` 的 key，或读一份由 Task1 测试锁定的 `collectDemoVideoKeys` 通过临时导出 JSON：

更稳：脚本内正则扫 `app/src/lib/demos.ts`：

```js
const src = fs.readFileSync(new URL('../src/lib/demos.ts', import.meta.url), 'utf8')
const keys = new Set()
for (const m of src.matchAll(/mw\(([^)]*)\)/g)) {
  for (const k of m[1].matchAll(/'([^']+)'/g)) keys.add(k[1])
}
```

3. 对每个 key：`GET ${MW_MEDIA_BASE}/${key}.mp4` → `.demo-cache/raw/${key}.mp4`
4. 若 `ffmpeg` 在 PATH：`ffmpeg -y -i raw -vf scale=-2:'min(720,ih)' -c:v libx264 -preset fast -crf 28 -an compressed/${key}.mp4`；否则复制 raw 并 warn
5. `POST/PUT` 到  
   `${SUPABASE_URL}/storage/v1/object/exercise-demos/videos/${key}.mp4`  
   Header: `Authorization: Bearer ${SERVICE_ROLE}`，`Content-Type: video/mp4`，`x-upsert: true`
6. 汇总打印 ok/fail

- [x] **Step 4: package.json script**

```json
"mirror:demos": "node scripts/mirror-demos.mjs"
```

- [x] **Step 5: README 短说明**（`app/README.md` 末尾加一节）

顺序：① 执行 SQL ② 本机配置 `SUPABASE_SERVICE_ROLE_KEY` ③ `npm run mirror:demos` ④ 发版

- [x] **Step 6: Commit**

```bash
git add app/supabase/storage-exercise-demos.sql app/scripts/mirror-demos.mjs .gitignore app/package.json app/README.md
git commit -m "chore(demo): Supabase Storage bucket SQL 与镜像上传脚本"
```

---

### Task 4: 合入规格状态 + 全量验证 + PR

**Files:**
- Modify: `docs/superpowers/specs/2026-11-18-demo-supabase-storage-design.md`（状态 → 实施中/已实施）
- Modify: `docs/superpowers/plans/2026-11-18-demo-supabase-storage.md`（勾选完成项）

- [x] **Step 1: 全量验证**

```bash
cd app && npm run lint && npm test
```

Expected: lint 0 error；测试全绿（含新增用例）

- [x] **Step 2: 更新 spec 状态行为「已实施（代码侧）；上传需维护者本地执行 mirror」**

- [ ] **Step 3: 开 PR**（基于 `feat/demo-supabase-storage`）

标题：`feat(demo): 示范视频改走 Supabase Storage + 缺口清单`

Body 含：Summary / Test plan / 提醒维护者跑 SQL + `mirror:demos`

- [ ] **Step 4: （可选）本地有 service role 时跑 mirror 并手动点开示范验 Network**

---

## Spec coverage 自检

| Spec 要求 | Task |
|---|---|
| Storage URL 形态 | Task 1 |
| mw 仅自有 + img 降级 | Task 1 |
| 无 env 回退 MW | Task 1 |
| gaps 两类文档 | Task 2 |
| SQL 公开 bucket | Task 3 |
| mirror 下载/压缩/上传 | Task 3 |
| 密钥不进仓 / gitignore | Task 3 |
| 单测 + lint | Task 1–4 |
| 不抓外站新片 | 全任务遵守 |

## Placeholder scan

无 TBD；脚本 env shim 已给明确落地路径（vitest 写 gaps / 正则抽 keys）。
