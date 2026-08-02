import { useMemo } from 'react'
import { format } from 'date-fns'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Input } from '@/components/ui/input'
import {
  Activity,
  CalendarCheck,
  Flame,
  Moon,
  Scale,
  Target,
  TrendingUp,
} from 'lucide-react'
import { bmi, bmiLabel, proteinRange } from '@/lib/store'
import type { CheckMap, Profile, WeekFeedback, WeekPlan, WeightEntry } from '@/types'

interface Props {
  profile: Profile
  setProfile: (v: Profile | ((p: Profile) => Profile)) => void
  weekPlan: WeekPlan
  weights: WeightEntry[]
  checks: CheckMap
  feedbacks: WeekFeedback[]
}

const DAY_TYPE_STYLE: Record<string, string> = {
  strength: 'bg-orange-500/15 text-orange-700 border-orange-200 dark:text-orange-300 dark:border-orange-500/30',
  sport: 'bg-emerald-500/15 text-emerald-700 border-emerald-200 dark:text-emerald-300 dark:border-emerald-500/30',
  recovery: 'bg-sky-500/15 text-sky-700 border-sky-200 dark:text-sky-300 dark:border-sky-500/30',
  rest: 'bg-slate-500/10 text-slate-600 border-slate-200 dark:text-slate-300 dark:border-slate-500/30',
}

export default function Overview({
  profile,
  setProfile,
  weekPlan,
  weights,
  checks,
  feedbacks,
}: Props) {
  const latest = weights[weights.length - 1]
  const weight = latest?.weight ?? 50.5
  const bmiValue = bmi(weight, profile.heightCm)
  const [pMin, pMax] = proteinRange(weight)

  const todayIdx = (new Date().getDay() + 6) % 7
  const todayPlan = weekPlan.days[todayIdx]

  const { done, total } = useMemo(() => {
    let d = 0
    let t = 0
    weekPlan.days.forEach((day, di) => {
      day.exercises.forEach((_, ei) => {
        t += 1
        if (checks[`${weekPlan.week}:${di}:${ei}`]) d += 1
      })
    })
    return { done: d, total: t }
  }, [weekPlan, checks])
  const weekPct = total === 0 ? 0 : Math.round((done / total) * 100)

  const first = weights[0]
  const weightDelta = first && latest ? latest.weight - first.weight : 0
  const lastFeedback = feedbacks[0]

  const cardCls = 'rounded-2xl shadow-sm transition-shadow hover:shadow-md'

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {/* 身体数据卡片 */}
      <Card className={cardCls}>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-orange-500/15">
              <Scale className="h-4 w-4 text-orange-500" />
            </span>
            身体数据
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="rounded-xl bg-gradient-to-b from-orange-500/10 to-transparent p-3">
              <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">{weight.toFixed(1)}</div>
              <div className="text-xs text-muted-foreground">体重 kg</div>
            </div>
            <div className="rounded-xl bg-gradient-to-b from-sky-500/10 to-transparent p-3">
              <div className="text-2xl font-bold text-sky-600 dark:text-sky-400">
                {latest?.bodyFat ? latest.bodyFat.toFixed(1) : '—'}
              </div>
              <div className="text-xs text-muted-foreground">体脂 %</div>
            </div>
            <div className="rounded-xl bg-gradient-to-b from-emerald-500/10 to-transparent p-3">
              <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{bmiValue.toFixed(1)}</div>
              <div className="text-xs text-muted-foreground">BMI（{bmiLabel(bmiValue)}）</div>
            </div>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">身高</span>
            <span className="flex items-center gap-2">
              <Input
                type="number"
                className="h-7 w-20 text-right"
                value={profile.heightCm}
                onChange={(e) =>
                  setProfile((p) => ({ ...p, heightCm: Number(e.target.value) || p.heightCm }))
                }
              />
              cm
            </span>
          </div>
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <TrendingUp className="h-4 w-4" />
            自开始记录以来体重{' '}
            <span className={weightDelta >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}>
              {weightDelta >= 0 ? '+' : ''}
              {weightDelta.toFixed(1)} kg
            </span>
            （增肌期希望缓慢上涨）
          </div>
        </CardContent>
      </Card>

      {/* 今日任务 */}
      <Card className={`${cardCls} border-orange-200 bg-gradient-to-b from-orange-50 to-white dark:border-orange-500/30 dark:from-orange-500/10 dark:to-card`}>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-orange-500/15">
              <Flame className="h-4 w-4 text-orange-500" />
            </span>
            今日任务
            <Badge variant="outline" className={DAY_TYPE_STYLE[todayPlan.type]}>{todayPlan.day}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-2 font-medium">{todayPlan.focus}</p>
          <ul className="space-y-1 text-sm text-muted-foreground">
            {todayPlan.exercises.slice(0, 4).map((ex, i) => (
              <li key={i} className="flex justify-between gap-2">
                <span className="truncate">{ex.name}</span>
                <span className="shrink-0">{ex.sets}</span>
              </li>
            ))}
            {todayPlan.exercises.length > 4 && (
              <li className="text-xs">…共 {todayPlan.exercises.length} 项，详见「每周计划」</li>
            )}
          </ul>
        </CardContent>
      </Card>

      {/* 本周进度 */}
      <Card className={cardCls}>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/15">
              <CalendarCheck className="h-4 w-4 text-emerald-500" />
            </span>
            第 {weekPlan.week} 周进度
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-end justify-between">
            <span className="bg-gradient-to-r from-emerald-500 to-teal-500 bg-clip-text text-3xl font-bold text-transparent">
              {weekPct}%
            </span>
            <span className="text-sm text-muted-foreground">
              已打卡 {done} / {total} 项
            </span>
          </div>
          <Progress value={weekPct} />
          <p className="text-sm text-muted-foreground">
            {lastFeedback
              ? `上周反馈：完成度 ${lastFeedback.completion}%，难度 ${lastFeedback.difficulty}/5`
              : '本周还没有反馈记录，周日记得填写「每周反馈」。'}
          </p>
        </CardContent>
      </Card>

      {/* 目标与关键提醒 */}
      <Card className={cardCls}>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-sky-500/15">
              <Target className="h-4 w-4 text-sky-500" />
            </span>
            目标与关键提醒
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm">
            <li className="flex gap-2">
              <Activity className="mt-0.5 h-4 w-4 shrink-0 text-orange-500" />
              主攻上身增肌：周一胸+三头、周三背+二头、周五肩+核心，周六羽毛球保持体能。
            </li>
            <li className="flex gap-2">
              <Flame className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
              每天蛋白质 {pMin}–{pMax} g（约 {Math.round(weight * 1.6 / 30)} 个鸡蛋 + 一份鸡胸/鱼肉），
              热量略有盈余，体重才会往上涨。
            </li>
            <li className="flex gap-2">
              <Moon className="mt-0.5 h-4 w-4 shrink-0 text-indigo-400" />
              睡够 7-9 小时，肌肉在睡眠中生长；同一肌群至少间隔 48 小时再练。
            </li>
            <li className="flex gap-2">
              <CalendarCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
              每周日用电子秤空腹称重并填反馈，计划会随你的反馈逐周进阶。
              最近一次记录：{latest ? format(new Date(latest.date + 'T00:00:00'), 'M月d日') : '—'}
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
