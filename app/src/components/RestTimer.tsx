import { forwardRef, useImperativeHandle } from 'react'
import { Timer, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { formatSeconds, useCountdown } from '@/lib/useCountdown'

/** 默认休息时长：计划 tip 建议组间休息 60-90 秒，取中值 */
const DEFAULT_REST_SECONDS = 75
/** 快捷预设（秒） */
const REST_PRESETS = [60, 75, 90, 120]

/** 休息结束三连音提示（WebAudio 合成，零资源文件）；环境不支持时静默降级为 toast */
function playFinishBeep(): void {
  try {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return
    const ctx = new Ctor()
    const t0 = ctx.currentTime
    ;[880, 1108.7, 1318.5].forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = freq
      osc.connect(gain)
      gain.connect(ctx.destination)
      const start = t0 + i * 0.18
      gain.gain.setValueAtTime(0.0001, start)
      gain.gain.exponentialRampToValueAtTime(0.25, start + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.16)
      osc.start(start)
      osc.stop(start + 0.18)
    })
    setTimeout(() => void ctx.close().catch(() => {}), 1200)
  } catch {
    /* 无声环境下只弹 toast */
  }
}

export interface RestTimerHandle {
  /** 开始/重置休息倒计时，缺省用默认时长 */
  start: (seconds?: number) => void
}

/**
 * 组间休息计时器：底部居中悬浮 pill，训练场景随手可关。
 * 挂载在 Home 层（而非 WeeklyPlan 内）——Radix Tabs 切走会卸载子树，
 * 挂在 Home 才能保证切 tab 查数据时计时不中断。
 */
export const RestTimer = forwardRef<RestTimerHandle>(function RestTimer(_props, ref) {
  const countdown = useCountdown(() => {
    playFinishBeep()
    toast.success('休息结束，开练！💪')
  })
  const { remaining, running, start, stop } = countdown

  useImperativeHandle(
    ref,
    () => ({
      start: (seconds?: number) => start(seconds ?? DEFAULT_REST_SECONDS),
    }),
    [start],
  )

  if (!running) return null

  return (
    <div
      className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2"
      role="timer"
      aria-label={`组间休息剩余 ${formatSeconds(remaining)}`}
    >
      <div className="flex items-center gap-2 rounded-full border border-teal-300/40 bg-slate-900/90 py-1.5 pl-4 pr-1.5 text-white shadow-xl shadow-teal-950/40 backdrop-blur dark:border-teal-400/30">
        <Timer className="h-4 w-4 shrink-0 animate-pulse text-teal-300" />
        <span className="min-w-10 text-center text-lg font-bold tabular-nums">
          {formatSeconds(remaining)}
        </span>
        <div className="ml-1 flex items-center gap-1">
          {REST_PRESETS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => start(s)}
              className={`rounded-full px-1.5 py-0.5 text-[11px] tabular-nums transition-colors ${
                // 当前剩余恰好等于某预设时高亮（刚点过它）
                remaining === s
                  ? 'bg-teal-400/30 text-teal-100'
                  : 'text-white/60 hover:bg-white/10 hover:text-white'
              }`}
            >
              {s}s
            </button>
          ))}
        </div>
        <Button
          size="icon"
          variant="ghost"
          aria-label="取消休息计时"
          className="h-7 w-7 rounded-full text-white/70 hover:bg-white/10 hover:text-white"
          onClick={stop}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  )
})
