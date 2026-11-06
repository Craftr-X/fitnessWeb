import { format } from 'date-fns'
import { ArrowRight, Flame } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useCountUp } from '@/hooks/useCountUp'
import type { DayPlan, WeekPlan } from '@/types'

interface Props {
  weekPlan: WeekPlan
  todayPlan: DayPlan
  todayIdx: number
  /** 每天是否已打卡（打卡点用） */
  dayChecked: boolean[]
  daysTrained: number
  done: number
  total: number
  latestWeight: number | null
  /** 计划进行到第几周（"已坚持周数"，与头部「第 N 周」口径一致；之前用的是反馈条数，会出现 0 与 16 并存的矛盾） */
  weeksPersisted: number
  /** 紧凑模式：计划/数据页用，压成一行，把首屏留给正文 */
  compact?: boolean
  onStart: () => void
}

function greeting(): string {
  const h = new Date().getHours()
  if (h < 6) return '夜深了'
  if (h < 12) return '早上好'
  if (h < 18) return '下午好'
  return '晚上好'
}

const tipOf = (day: DayPlan) =>
  day.type === 'rest'
    ? '休息日也要记得拉伸和好好吃饭 💪'
    : day.type === 'sport'
      ? '羽毛球日！尽情挥洒汗水，注意补水 🏸'
      : '练前别忘了 5 分钟热身，动作质量优先 🔥'

/**
 * 今日作战卡。
 * 默认（今日 Tab）是完整版：问候 / 今天练什么 / 打卡点 / 进度环 / 当前体重 / 坚持周数。
 * compact（计划、数据 Tab）压成一行——首屏高度从 ~322px 降到 ~64px，
 * 正文不再被这张卡挤出第一屏。
 */
export default function TodayHero({
  weekPlan,
  todayPlan,
  todayIdx,
  dayChecked,
  daysTrained,
  done,
  total,
  latestWeight,
  weeksPersisted,
  compact,
  onStart,
}: Props) {
  const weekPct = total === 0 ? 0 : Math.round((done / total) * 100)
  const animatedPct = useCountUp(weekPct)
  const isRest = todayPlan.type === 'rest'

  if (compact) {
    return (
      <div className="relative mb-4 overflow-hidden rounded-2xl bg-gradient-to-r from-teal-600 to-emerald-500 px-4 py-3 text-white shadow-md shadow-teal-500/20">
        <div className="relative flex items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/15 text-sm font-bold">
            {todayPlan.day.replace('周', '')}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">今天：{todayPlan.focus}</p>
            <p className="truncate text-xs text-white/75">
              本周 {done}/{total} 项 · {weekPct}%
            </p>
          </div>
          {!isRest && (
            <button
              type="button"
              onClick={onStart}
              className="shrink-0 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-teal-700 shadow-sm transition-transform hover:scale-[1.03]"
            >
              去训练
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="relative mb-6 overflow-hidden rounded-2xl bg-gradient-to-br from-teal-600 via-teal-500 to-emerald-500 p-5 text-white shadow-lg shadow-teal-500/25 sm:p-6">
      {/* 卡内装饰：细网格 + 光斑 */}
      <div
        className="pointer-events-none absolute inset-0 opacity-35"
        style={{
          backgroundImage:
            'linear-gradient(to right, rgb(255 255 255 / 0.09) 1px, transparent 1px), linear-gradient(to bottom, rgb(255 255 255 / 0.09) 1px, transparent 1px)',
          backgroundSize: '28px 28px',
        }}
        aria-hidden
      />
      <div className="pointer-events-none absolute -right-10 -top-16 h-48 w-48 rounded-full bg-white/15 blur-2xl" aria-hidden />
      <div className="pointer-events-none absolute -bottom-16 right-28 h-40 w-40 rounded-full bg-emerald-300/25 blur-2xl" aria-hidden />

      <div className="relative flex flex-wrap items-center gap-5">
        <div className="min-w-56 flex-1">
          <p className="text-sm text-white/80">
            {greeting()}！{format(new Date(), 'M月d日')}
          </p>
          <h2 className="mt-0.5 text-xl font-bold">
            今天：{todayPlan.day} · {todayPlan.focus}
          </h2>
          <p className="mt-1 text-sm text-white/80">{tipOf(todayPlan)}</p>

          {/* 本周打卡点：亮=当天有打卡，光环=今天 */}
          <div className="mt-3 flex items-center gap-1.5">
            {weekPlan.days.map((d, di) => (
              <span
                key={di}
                title={d.day}
                className={`h-2.5 w-2.5 rounded-full transition-colors ${
                  dayChecked[di] ? 'bg-white shadow-sm shadow-white/60' : 'bg-white/25'
                } ${di === todayIdx ? 'ring-2 ring-white/80 ring-offset-2 ring-offset-teal-500' : ''}`}
              />
            ))}
            <span className="ml-2 text-xs text-white/75">本周已练 {daysTrained} 天</span>
          </div>

          <Button
            onClick={onStart}
            className="mt-4 bg-white font-semibold text-teal-700 shadow-md transition-transform hover:scale-[1.03] hover:bg-teal-50"
          >
            {isRest ? '查看本周计划' : '开始今日训练'}
            <ArrowRight className="ml-1 h-4 w-4" />
          </Button>
        </div>

        <div className="flex items-center gap-6 pr-1">
          {/* 本周完成度进度环 */}
          <div className="relative h-20 w-20" title={`已打卡 ${done} / ${total} 项`}>
            <svg viewBox="0 0 80 80" className="h-20 w-20 -rotate-90">
              <circle cx="40" cy="40" r="34" fill="none" stroke="rgba(255,255,255,0.22)" strokeWidth="7" />
              <circle
                cx="40"
                cy="40"
                r="34"
                fill="none"
                stroke="#fff"
                strokeWidth="7"
                strokeLinecap="round"
                strokeDasharray={2 * Math.PI * 34}
                strokeDashoffset={2 * Math.PI * 34 * (1 - animatedPct / 100)}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-lg font-bold leading-none">{Math.round(animatedPct)}%</span>
              <span className="mt-0.5 text-[10px] text-white/75">本周进度</span>
            </div>
          </div>

          <div className="space-y-3">
            {latestWeight && (
              <div className="text-center">
                <div className="text-2xl font-bold tabular-nums">{latestWeight.toFixed(2)}</div>
                <div className="text-xs text-white/75">当前体重 kg</div>
              </div>
            )}
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 text-2xl font-bold tabular-nums">
                <Flame className="h-5 w-5" />
                {weeksPersisted}
              </div>
              <div className="text-xs text-white/75">已坚持周数</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
