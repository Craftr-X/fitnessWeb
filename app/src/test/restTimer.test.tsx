import { describe, it, expect, vi, afterEach } from 'vitest'
import { createRef } from 'react'
import { act, render } from '@testing-library/react'
import { RestTimer, type RestTimerHandle } from '@/components/RestTimer'

/**
 * 组间休息计时器：结束时除三连音外还要振动一次（静音场景下手机放口袋也能感知）。
 * 振动在 Android Chrome 生效，iOS Safari / 桌面没有实现，走可选链静默跳过。
 */
describe('组间休息计时器', () => {
  afterEach(() => {
    vi.useRealTimers()
    delete (navigator as Navigator & { vibrate?: unknown }).vibrate
  })

  it('倒计时结束触发一次振动', () => {
    vi.useFakeTimers()
    const vibrate = vi.fn()
    Object.defineProperty(navigator, 'vibrate', { value: vibrate, configurable: true })

    const ref = createRef<RestTimerHandle>()
    render(<RestTimer ref={ref} />)

    act(() => ref.current!.start(1))
    act(() => void vi.advanceTimersByTime(1200))

    expect(vibrate).toHaveBeenCalledTimes(1)
    expect(vibrate).toHaveBeenCalledWith([120, 80, 120])
  })

  it('环境不支持振动时不抛错（桌面 / iOS）', () => {
    vi.useFakeTimers()
    const ref = createRef<RestTimerHandle>()
    render(<RestTimer ref={ref} />)

    act(() => ref.current!.start(1))
    expect(() => act(() => void vi.advanceTimersByTime(1200))).not.toThrow()
  })
})
