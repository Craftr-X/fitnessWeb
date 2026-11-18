import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  classifyDemoGaps,
  collectTeachableExerciseNames,
  formatDemoGapsMarkdown,
  isDemoGapAllowedMissing,
} from '@/lib/demoGaps'
import { getDemo } from '@/lib/demos'

const docPath = resolve(import.meta.dirname, '../../../docs/demo-video-gaps.md')

describe('writeDemoGapsDoc', () => {
  it('writes docs/demo-video-gaps.md', () => {
    const names = collectTeachableExerciseNames()
    const gaps = classifyDemoGaps(names, getDemo, isDemoGapAllowedMissing)
    const generatedAt = new Date().toISOString().slice(0, 10)
    const md = formatDemoGapsMarkdown(gaps, generatedAt)
    writeFileSync(docPath, md, 'utf8')
    expect(md).toContain('# 教学示范视频缺口清单')
    expect(md).toContain('## 完全无示范')
    expect(md).toContain('## 仅有图无视频')
    expect(gaps.length).toBeGreaterThanOrEqual(0)
  })
})