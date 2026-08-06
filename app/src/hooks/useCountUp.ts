import { useEffect, useRef, useState } from 'react'

/**
 * 数字 count-up：target 变化时用 ease-out 缓动从当前值动画到新值。
 * 用于仪表盘数字（体重、完成度等），尊重系统减少动效偏好。
 */
export function useCountUp(target: number, duration = 700): number {
  const [display, setDisplay] = useState(target)
  const displayRef = useRef(target)

  useEffect(() => {
    const reduce =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const from = displayRef.current
    if (from === target) return
    if (reduce) {
      displayRef.current = target
      // 避免在 effect 内同步 setState（react-hooks/set-state-in-effect），走一帧 rAF 落地
      const raf = requestAnimationFrame(() => setDisplay(target))
      return () => cancelAnimationFrame(raf)
    }
    let raf = 0
    const start = performance.now()
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - t, 3)
      const v = from + (target - from) * eased
      displayRef.current = v
      setDisplay(v)
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, duration])

  return display
}
