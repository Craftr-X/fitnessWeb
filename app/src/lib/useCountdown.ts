import { useCallback, useEffect, useRef, useState } from 'react'

/** 秒数 → m:ss（75 → "1:15"，601 → "10:01"） */
export function formatSeconds(total: number): string {
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

export interface Countdown {
  /** 剩余整秒数 */
  remaining: number
  running: boolean
  /** 开始/重置倒计时（重复调用即重置）；非正数忽略 */
  start: (seconds: number) => void
  /** 手动停止并清零 */
  stop: () => void
}

/**
 * 倒计时（组间休息用）。
 * 以 Date.now() 目标时刻为基准、每 250ms 重算剩余，而非每秒减一——
 * 浏览器后台节流或锁屏后回来能立即校正到正确剩余时间，不会累计漂移。
 * finish 回调经 ref 转发，调用方无需保证其引用稳定。
 */
export function useCountdown(onFinish?: () => void): Countdown {
  const [remaining, setRemaining] = useState(0)
  const [running, setRunning] = useState(false)
  const endAtRef = useRef(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const onFinishRef = useRef(onFinish)
  useEffect(() => {
    onFinishRef.current = onFinish
  })

  const clearTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }

  const stop = useCallback(() => {
    clearTimer()
    endAtRef.current = 0
    setRemaining(0)
    setRunning(false)
  }, [])

  const start = useCallback((seconds: number) => {
    if (!Number.isFinite(seconds) || seconds <= 0) return
    clearTimer()
    endAtRef.current = Date.now() + seconds * 1000
    setRemaining(seconds)
    setRunning(true)
    timerRef.current = setInterval(() => {
      const left = Math.ceil((endAtRef.current - Date.now()) / 1000)
      if (left <= 0) {
        clearTimer()
        endAtRef.current = 0
        setRemaining(0)
        setRunning(false)
        onFinishRef.current?.()
      } else {
        setRemaining(left)
      }
    }, 250)
  }, [])

  // 卸载时清理定时器，防止泄漏
  useEffect(() => clearTimer, [])

  return { remaining, running, start, stop }
}
