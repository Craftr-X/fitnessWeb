import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  classifyDemoGaps,
  collectTeachableExerciseNames,
  formatDemoGapsMarkdown,
  isDemoGapAllowedMissing,
} from '@/lib/demoGaps'
import { getDemo } from '@/lib/demos'

const docPath = resolve(import.meta.dirname, '../../../docs/demo-video-gaps.md')

/** `npm run gaps:demo` 会写入清单；默认 `npm test` 只断言分类与文档内容（忽略日期行）。 */
const shouldWriteDoc =
  process.env.GAPS_WRITE === '1' || process.env.npm_lifecycle_event === 'gaps:demo'

function stripGeneratedDateLine(md: string): string {
  return md.replace(/^> 生成日期：.*\n/m, '> 生成日期：<fixed>\n')
}

describe('writeDemoGapsDoc', () => {
  it('classifyDemoGaps + formatDemoGapsMarkdown 与 docs/demo-video-gaps.md 一致', () => {
    const names = collectTeachableExerciseNames()
    const gaps = classifyDemoGaps(names, getDemo, isDemoGapAllowedMissing)
    const generatedAt = new Date().toISOString().slice(0, 10)
    const md = formatDemoGapsMarkdown(gaps, generatedAt)

    expect(md).toContain('# 教学示范视频缺口清单')
    expect(md).toContain('## 完全无示范')
    expect(md).toContain('## 仅有图无视频')
    // 允许两类都为空（示范库补齐后的健康态）
    expect(Array.isArray(gaps)).toBe(true)

    if (shouldWriteDoc) {
      writeFileSync(docPath, md, 'utf8')
      return
    }

    const onDisk = readFileSync(docPath, 'utf8')
    expect(stripGeneratedDateLine(md)).toBe(stripGeneratedDateLine(onDisk))
  })
})
