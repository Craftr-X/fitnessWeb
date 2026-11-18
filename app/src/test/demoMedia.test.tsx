import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import ExerciseDemoButton, {
  DEMO_SIDE_DEFER_MS,
  DEMO_SOURCE_TIMEOUT_MS,
} from '@/components/ExerciseDemoButton'
import { BANNED_MW_VIDEO_KEYS, collectDemoVideoUrls, type DemoInfo } from '@/lib/demos'

const DEMO: DemoInfo = {
  level: '初级',
  front: [
    { type: 'video', url: 'https://example.com/hang.mp4' },
    { type: 'img', url: 'https://example.com/front.jpg' },
  ],
  side: [{ type: 'img', url: 'https://example.com/side.jpg' }],
  steps: ['双手撑地，缓慢下放'],
}

describe('示范视频 URL 健康（静态）', () => {
  it('示范库不含已确认 404 的 MuscleWiki key', () => {
    const urls = collectDemoVideoUrls()
    const hits = BANNED_MW_VIDEO_KEYS.filter((key) =>
      urls.some((url) => url.endsWith(`/${key}.mp4`)),
    )
    expect(hits).toEqual([])
  })

  it('至少收集到若干 MuscleWiki 视频 URL', () => {
    expect(collectDemoVideoUrls().length).toBeGreaterThan(20)
  })
})

describe('动作示范加载策略', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  it('打开弹层后侧面延迟加载，超时前只有正面 video', () => {
    const { container } = render(<ExerciseDemoButton exerciseName="俯卧撑" demo={DEMO} />)
    fireEvent.click(container.querySelector('button')!)

    expect(document.querySelectorAll('video')).toHaveLength(1)
    expect(document.querySelector('video')?.getAttribute('src')).toBe('https://example.com/hang.mp4')
    expect(screen.queryByAltText('俯卧撑 侧面示范')).toBeNull()

    act(() => {
      vi.advanceTimersByTime(DEMO_SIDE_DEFER_MS)
    })

    expect(screen.getByAltText('俯卧撑 侧面示范')).toBeInTheDocument()
  })

  it('正面源超时后自动切到备用图', () => {
    const { container } = render(<ExerciseDemoButton exerciseName="俯卧撑" demo={DEMO} />)
    fireEvent.click(container.querySelector('button')!)

    expect(document.querySelector('video')).not.toBeNull()

    act(() => {
      vi.advanceTimersByTime(DEMO_SOURCE_TIMEOUT_MS)
    })

    expect(document.querySelector('video')).toBeNull()
    expect(screen.getByAltText('俯卧撑 正面示范')).toHaveAttribute('src', 'https://example.com/front.jpg')
  })
})
