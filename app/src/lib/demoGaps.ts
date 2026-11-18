import type { DemoInfo } from '@/lib/demos'
import { POOL, INJURY_SUBSTITUTES } from '@/lib/planEngine'

export type DemoGapKind = 'missing_demo' | 'image_only'
export interface DemoGap {
  name: string
  kind: DemoGapKind
}

/** 与 demos.coverage.test.ts 的非教学动作白名单保持一致 */
export const DEMO_GAP_ALLOW_MISSING = [
  '散步',
  '充足睡眠',
  '填写本周反馈',
  '羽毛球训练',
  '跑步训练',
  '骑行训练',
  '可选',
]

export function isDemoGapAllowedMissing(name: string): boolean {
  return DEMO_GAP_ALLOW_MISSING.some((k) => name.includes(k))
}

/** 从 POOL 与伤病替代动作收集全部可教学动作名 */
export function collectTeachableExerciseNames(): string[] {
  const names = new Set<string>()
  for (const byEquipment of Object.values(POOL)) {
    for (const seeds of Object.values(byEquipment)) {
      for (const seed of seeds ?? []) {
        names.add(seed.name)
      }
    }
  }
  for (const sub of INJURY_SUBSTITUTES) {
    names.add(sub.seed.name)
  }
  return [...names]
}

export function classifyDemoGaps(
  names: string[],
  getDemoFn: (name: string) => DemoInfo | undefined,
  isAllowedMissing: (name: string) => boolean,
): DemoGap[] {
  const out: DemoGap[] = []
  const seen = new Set<string>()
  for (const name of [...names].sort((a, b) => a.localeCompare(b, 'zh'))) {
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
    `> 生成日期：${generatedAt}。再生成：\`cd app && npm run gaps:demo\`（或 \`vitest run src/test/writeDemoGapsDoc.test.ts\`）。勿手改分类结果。`,
    '',
    '补片流程：压缩上传到 `exercise-demos/videos/{key}.mp4` → 在 `demos.ts` 的对应动作加 `mw(\'key\')` → 重跑 `npm run gaps:demo`。',
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