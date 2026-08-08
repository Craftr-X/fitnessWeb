import { useRef, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { ArrowRightCircle, BedDouble, CalendarClock, Copy, Dumbbell, Info, Leaf, Trophy } from 'lucide-react'
import { toast } from 'sonner'
import { copyWeekPlan, currentMonday } from '@/lib/store'
import { buildNextWeekPlan } from '@/lib/planEngine'
import { burstAt, celebrateDayDone, celebrateWeekDone } from '@/lib/celebrate'
import { getDemo } from '@/lib/demos'
import ExerciseDemoButton from '@/components/ExerciseDemoButton'
import type { CheckMap, Profile, WeekFeedback, WeekPlan } from '@/types'

interface Props {
  weekPlan: WeekPlan
  setWeekPlan: (v: WeekPlan | ((p: WeekPlan) => WeekPlan)) => void
  checks: CheckMap
  setChecks: (v: CheckMap | ((p: CheckMap) => CheckMap)) => void
  feedbacks: WeekFeedback[]
  onGoFeedback: () => void
  /** 当前用户画像，用于已 onboarded 用户生成下周时走规则引擎 */
  profile?: Profile
}

const DAY_STYLE: Record<
  string,
  { label: string; icon: typeof Dumbbell; header: string; badge: string; ring: string }
> = {
  strength: {
    label: '力量训练',
    icon: Dumbbell,
    header: 'from-orange-500/15 to-orange-400/5',
    badge: 'bg-orange-500/15 text-orange-700 border-orange-200 dark:text-orange-300 dark:border-orange-500/30',
    ring: 'ring-orange-400',
  },
  sport: {
    label: '运动',
    icon: Trophy,
    header: 'from-emerald-500/15 to-emerald-400/5',
    badge: 'bg-emerald-500/15 text-emerald-700 border-emerald-200 dark:text-emerald-300 dark:border-emerald-500/30',
    ring: 'ring-emerald-400',
  },
  recovery: {
    label: '主动恢复',
    icon: Leaf,
    header: 'from-sky-500/15 to-sky-400/5',
    badge: 'bg-sky-500/15 text-sky-700 border-sky-200 dark:text-sky-300 dark:border-sky-500/30',
    ring: 'ring-sky-400',
  },
  rest: {
    label: '休息',
    icon: BedDouble,
    header: 'from-slate-400/10 to-slate-300/5',
    badge: 'bg-slate-500/10 text-slate-600 border-slate-200 dark:text-slate-300 dark:border-slate-500/30',
    ring: 'ring-slate-300',
  },
}

// 防御性兜底：规则引擎若产出未知 type（未来扩展），用 rest 样式兜底而不是崩溃
const FALLBACK_STYLE = DAY_STYLE.rest

export default function WeeklyPlan({ weekPlan, setWeekPlan, checks, setChecks, feedbacks, onGoFeedback, profile }: Props) {
  const [confirming, setConfirming] = useState(false)
  const [confirmingCopy, setConfirmingCopy] = useState(false)
  const clickPos = useRef<{ x: number; y: number } | null>(null)

  const toggle = (di: number, ei: number) => {
    const key = `${weekPlan.week}:${di}:${ei}`
    const willCheck = !checks[key]
    setChecks((prev) => ({ ...prev, [key]: !prev[key] }))
    if (!willCheck) return
    const day = weekPlan.days[di]
    const dayAllDone = day.exercises.every((_, i) => i === ei || checks[`${weekPlan.week}:${di}:${i}`])
    if (dayAllDone) {
      celebrateDayDone()
      toast.success(`🎉 ${day.day}全部完成，干得漂亮！`)
    } else if (clickPos.current) {
      burstAt(clickPos.current.x, clickPos.current.y)
    }
  }

  const nextWeek = () => {
    if (!confirming) {
      setConfirming(true)
      return
    }
    const lastFb = feedbacks.find((f) => f.week === weekPlan.week)
    const next = buildNextWeekPlan(profile, weekPlan, lastFb)
    setWeekPlan(next)
    setConfirming(false)
    celebrateWeekDone()
    toast.success(`🚀 第 ${weekPlan.week} 周完成！新计划已生成，继续加油！`)
  }

  const copyLast = () => {
    if (!confirmingCopy) {
      setConfirmingCopy(true)
      return
    }
    setWeekPlan(copyWeekPlan(weekPlan))
    setConfirmingCopy(false)
    celebrateWeekDone()
    toast.success(`📋 已复制本周计划为第 ${weekPlan.week + 1} 周计划！`)
  }

  const todayIdx = (new Date().getDay() + 6) % 7
  // 周日且计划仍是本周时，提醒填反馈并生成下周计划（当天一直显示，不持久化）
  const showSundayReminder = new Date().getDay() === 0 && weekPlan.startDate === currentMonday()

  return (
    <div className="space-y-4">
      {showSundayReminder && (
        <Card className="overflow-hidden rounded-2xl border-0 bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg shadow-amber-500/20">
          <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
            <div className="flex flex-1 items-start gap-2 text-sm">
              <CalendarClock className="mt-0.5 h-4 w-4 shrink-0 opacity-80" />
              <span className="text-white/90">今天是周日，本周即将结束，记得填写每周反馈并生成下周计划。</span>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={onGoFeedback}
                variant="secondary"
                className="bg-white/15 text-white hover:bg-white/25 border border-white/30"
              >
                去填反馈
              </Button>
              <Button
                onClick={nextWeek}
                variant={confirming ? 'default' : 'secondary'}
                className={confirming ? 'bg-white text-orange-700 hover:bg-white/90' : 'bg-white/15 text-white hover:bg-white/25 border border-white/30'}
              >
                {confirming ? '再点一次确认' : '生成下周计划'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
      {/* 进阶说明 + 生成下周 */}
      <Card className="overflow-hidden rounded-2xl border-0 bg-gradient-to-r from-sky-500 to-indigo-500 text-white shadow-lg shadow-sky-500/20">
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
          <div className="flex flex-1 items-start gap-2 text-sm">
            <Info className="mt-0.5 h-4 w-4 shrink-0 opacity-80" />
            <span className="text-white/90">{weekPlan.adjustmentNote}</span>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              onClick={copyLast}
              variant={confirmingCopy ? 'default' : 'secondary'}
              className={confirmingCopy ? 'bg-white text-sky-700 hover:bg-white/90' : 'bg-white/15 text-white hover:bg-white/25 border border-white/30'}
            >
              <Copy className="mr-1 h-4 w-4" />
              {confirmingCopy ? '再点一次确认复制' : '复制上周计划'}
            </Button>
            <Button
              onClick={nextWeek}
              variant={confirming ? 'default' : 'secondary'}
              className={confirming ? 'bg-white text-sky-700 hover:bg-white/90' : 'bg-white/15 text-white hover:bg-white/25 border border-white/30'}
            >
              <ArrowRightCircle className="mr-1 h-4 w-4" />
              {confirming ? '再点一次确认进入下一周' : '完成本周，生成下周计划'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {weekPlan.days.map((day, di) => {
          const style = DAY_STYLE[day.type] ?? FALLBACK_STYLE
          const Icon = style.icon
          const doneCount = day.exercises.filter(
            (_, ei) => checks[`${weekPlan.week}:${di}:${ei}`],
          ).length
          const allDone = doneCount === day.exercises.length && day.exercises.length > 0
          const isToday = di === todayIdx
          return (
            <Card
              key={day.day}
              className={`overflow-hidden rounded-2xl py-0 shadow-sm transition-shadow hover:shadow-md ${
                isToday ? `ring-2 ${style.ring}` : ''
              }`}
            >
              {/* 头部色条 */}
              <div className={`flex items-center gap-2.5 bg-gradient-to-r px-4 py-3 ${style.header}`}>
                <div className={`flex h-8 w-8 items-center justify-center rounded-lg border ${style.badge}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className={`font-semibold ${isToday ? 'text-orange-600 dark:text-orange-400' : ''}`}>{day.day}</span>
                    {isToday && (
                      <Badge className="bg-orange-500 text-white hover:bg-orange-500">今天</Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">{day.focus}</p>
                </div>
                <Badge variant="outline" className={style.badge}>
                  {allDone ? '✓ 完成' : `${doneCount}/${day.exercises.length}`}
                </Badge>
              </div>

              <CardContent className="space-y-2 p-3">
                {day.exercises.map((ex, ei) => {
                  const checked = !!checks[`${weekPlan.week}:${di}:${ei}`]
                  const demo = getDemo(ex.name)
                  return (
                    <div
                      key={ei}
                      className={`flex items-center gap-2 rounded-xl border p-2 transition-colors ${
                        checked ? 'border-emerald-200 bg-emerald-50/60 dark:border-emerald-500/30 dark:bg-emerald-500/10' : 'hover:bg-muted/50'
                      }`}
                    >
                      <label
                        className="flex flex-1 cursor-pointer items-start gap-3"
                        onClickCapture={(e) => {
                          clickPos.current = { x: e.clientX, y: e.clientY }
                        }}
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={() => toggle(di, ei)}
                          className="mt-0.5"
                        />
                        <span className="flex-1">
                          <span className={`block text-sm ${checked ? 'text-muted-foreground line-through' : ''}`}>
                            {ex.name}
                          </span>
                          <span className="block text-xs text-muted-foreground">
                            {ex.sets}
                            {ex.note ? ` · ${ex.note}` : ''}
                          </span>
                        </span>
                      </label>
                      {demo && <ExerciseDemoButton exerciseName={ex.name} demo={demo} />}
                    </div>
                  )
                })}
                {day.tip && (
                  <p className="rounded-lg bg-muted/60 p-2 text-xs text-muted-foreground">💡 {day.tip}</p>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
