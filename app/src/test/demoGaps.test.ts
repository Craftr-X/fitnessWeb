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