import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { formatSeconds, useCountdown } from '@/lib/useCountdown'

/* ------------------------------------------------------------------ */
/* formatSeconds —— m:ss 展示                                          */
/* ------------------------------------------------------------------ */
describe('formatSeconds', () => {
  it.each([
    [0, '0:00'],
    [59, '0:59'],
    [75, '1:15'],
    [601, '10:01'],
  ])('%i 秒 → %s', (input, expected) => {
    expect(formatSeconds(input)).toBe(expected)
  })
})

/* ------------------------------------------------------------------ */
/* useCountdown —— 倒计时核心（组间休息）                               */
/* ------------------------------------------------------------------ */
describe('useCountdown', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('start 后按秒递减，running 为 true', () => {
    const { result } = renderHook(() => useCountdown())
    act(() => result.current.start(75))
    expect(result.current.remaining).toBe(75)
    expect(result.current.running).toBe(true)
    act(() => vi.advanceTimersByTime(1000))
    expect(result.current.remaining).toBe(74)
  })

  it('到 0 自动停止并触发 onFinish 恰好一次', () => {
    const finish = vi.fn()
    const { result } = renderHook(() => useCountdown(finish))
    act(() => result.current.start(2))
    act(() => vi.advanceTimersByTime(2100))
    expect(result.current.running).toBe(false)
    expect(result.current.remaining).toBe(0)
    expect(finish).toHaveBeenCalledTimes(1)
  })

  it('计时中重复 start = 重置为新时长（互斥，不叠加）', () => {
    const { result } = renderHook(() => useCountdown())
    act(() => result.current.start(90))
    act(() => vi.advanceTimersByTime(5000)) // 剩 85
    act(() => result.current.start(60)) // 重置为 60
    expect(result.current.remaining).toBe(60)
    act(() => vi.advanceTimersByTime(1000))
    expect(result.current.remaining).toBe(59)
  })

  it('stop 立即清零并停止', () => {
    const { result } = renderHook(() => useCountdown())
    act(() => result.current.start(30))
    act(() => result.current.stop())
    expect(result.current.running).toBe(false)
    expect(result.current.remaining).toBe(0)
    act(() => vi.advanceTimersByTime(5000))
    expect(result.current.remaining).toBe(0)
  })

  it('非正数 / 非法时长被忽略，不进入计时', () => {
    const { result } = renderHook(() => useCountdown())
    act(() => result.current.start(0))
    act(() => result.current.start(-5))
    act(() => result.current.start(Number.NaN))
    expect(result.current.running).toBe(false)
    expect(result.current.remaining).toBe(0)
  })

  it('后台时间跳跃后能校正到正确剩余（时间戳基准，不漂移）', () => {
    const { result } = renderHook(() => useCountdown())
    act(() => result.current.start(60))
    // 模拟浏览器后台节流：一次性跳过 30 秒
    act(() => vi.advanceTimersByTime(30_000))
    expect(result.current.remaining).toBe(30)
  })

  it('卸载时清理定时器不报错', () => {
    const { result, unmount } = renderHook(() => useCountdown())
    act(() => result.current.start(30))
    expect(() => unmount()).not.toThrow()
  })
})
