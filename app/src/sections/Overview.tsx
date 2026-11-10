import { useMemo, useState } from 'react'
import { format } from 'date-fns'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import {
  Activity,
  CalendarCheck,
  ChevronDown,
  Flame,
  MessageSquareHeart,
  Moon,
  Scale,
  Sparkles,
  Target,
  TrendingUp,
  Trophy,
  Utensils,
} from 'lucide-react'
import { bmi, bmiLabel, proteinRange, weightDeltaTone, WEIGHT_GOAL_LABEL } from '@/lib/store'
import { compareWeeks } from '@/lib/weekCompare'
import { useCountUp } from '@/hooks/useCountUp'
import Onboarding from '@/pages/Onboarding'
import TransformationDialog from '@/components/TransformationDialog'
import type { ActivityMap, CheckMap, ExerciseLogMap, Profile, WeekFeedback, WeekPlan, WeightEntry } from '@/types'

interface Props {
  profile: Profile
  setProfile: (v: Profile | ((p: Profile) => Profile)) => void
  weekPlan: WeekPlan
  weights: WeightEntry[]
  checks: CheckMap
  feedbacks: WeekFeedback[]
  setLogs: ExerciseLogMap
  /** 每日训练活跃度（上周训练天数的数据源） */
  activity: ActivityMap
  /** 老用户重新定制计划完成回调 */
  onRebuild?: (profile: Profile, weekPlan: WeekPlan) => void
  /** 打开「每周反馈」弹层（原独立 Tab，已降级） */
  onOpenFeedback?: () => void
  /** 打开「营养建议」弹层（原独立 Tab，已降级） */
  onOpenNutrition?: () => void
}

const DAY_TYPE_STYLE: Record<string, string> = {
  strength: 'bg-orange-500/15 text-orange-700 border-orange-200 dark:text-orange-300 dark:border-orange-500/30',
  sport: 'bg-emerald-500/15 text-emerald-700 border-emerald-200 dark:text-emerald-300 dark:border-emerald-500/30',
  recovery: 'bg-sky-500/15 text-sky-700 border-sky-200 dark:text-sky-300 dark:border-sky-500/30',
  rest: 'bg-slate-500/10 text-slate-600 border-slate-200 dark:text-slate-300 dark:border-slate-500/30',
}

/** 对比行：左标签、右「本周值 ← 上周值」 */
function CompareRow({
  label,
  current,
  previous,
}: {
  label: string
  current: string
  previous: string
}) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="flex items-baseline gap-2 tabular-nums">
        <span className="font-semibold">{current}</span>
        <span className="w-24 text-right text-muted-foreground">← {previous}</span>
      </span>
    </div>
  )
}

export default function Overview({
  profile,
  setProfile,
  weekPlan,
  weights,
  checks,
  feedbacks,
  setLogs,
  activity,
  onRebuild,
  onOpenFeedback,
  onOpenNutrition,
}: Props) {
  const [rebuilding, setRebuilding] = useState(false)
  const [showTransformation, setShowTransformation] = useState(false)
  // 关键提醒默认只显示前 2 条，展开后 5 条齐全；状态只放内存，不新增 localStorage key
  const [showAllTips, setShowAllTips] = useState(false)
  const latest = weights[weights.length - 1]
  const weight = latest?.weight ?? profile.weightKg ?? 0
  const bmiValue = bmi(weight, profile.heightCm)
  const [pMin, pMax] = proteinRange(weight)

  const todayIdx = (new Date().getDay() + 6) % 7
  const todayPlan = weekPlan.days[todayIdx]

  // 完成度 / 已打卡数统一由 TodayHero 的进度环呈现，这里不再重复计算与展示
  // 关键数字 count-up 动画
  const animatedWeight = useCountUp(weight)
  const animatedFat = useCountUp(latest?.bodyFat ?? 0)
  const animatedBmi = useCountUp(bmiValue)

  const first = weights[0]
  const weightDelta = first && latest ? latest.weight - first.weight : 0

  // 从当前计划动态提取本周训练摘要，避免硬编码"上身增肌+羽毛球"老模板文案
  const summary = useMemo(() => {
    const strengthDays = weekPlan.days.filter((d) => d.type === 'strength')
    const sportDays = weekPlan.days.filter((d) => d.type === 'sport')
    const groups = strengthDays.map((d) => d.focus).join('、')
    const trainCount = strengthDays.length + sportDays.length
    const sportDesc = sportDays.map((d) => d.focus).join('、')
    return { trainCount, groups, sportDesc, hasSport: sportDays.length > 0 }
  }, [weekPlan])

  // 目标导向的体重趋势提示（增肌希望缓慢上涨 / 减脂希望缓慢下降）
  const goal = profile.weightGoal
  const weightTrendTip =
    goal === 'lose'
      ? '减脂期体重应缓慢下降（每周 0.25-0.5 kg 为宜）'
      : goal === 'recomp'
        ? '塑形期体重基本持平，关注体脂与围度变化'
        : goal === 'maintain'
          ? '保持期体重稳定即可，重在规律训练'
          : '增肌期体重应缓慢上涨（每周 0.1-0.25 kg）'

  // 体重变化方向是否符合目标预期：决定 delta 数字的着色（增肌涨好 / 减脂降好 / 塑形保持中性）
  const deltaTone = weightDeltaTone(goal, weightDelta)

  // 本周 vs 上周：完成度 / 训练天数 / 体重（「第 N 周进度」卡数据源）
  const comparison = useMemo(
    () => compareWeeks({ weekPlan, checks, feedbacks, weights, activity }),
    [weekPlan, checks, feedbacks, weights, activity],
  )
  const weightCompare = comparison.weight
  const weightCompareDelta =
    weightCompare.current != null && weightCompare.previous != null
      ? weightCompare.current - weightCompare.previous
      : null
  const weightCompareTone =
    weightCompareDelta == null ? 'neutral' : weightDeltaTone(goal, weightCompareDelta)

  // 至少 4 周计划、且至少有 2 条体重记录，海报才有内容可讲
  const canShowTransformation = weekPlan.week >= 4 && weights.length >= 2

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
              <div className="text-2xl font-bold tabular-nums text-orange-600 dark:text-orange-400">
                {weight === 0 ? '—' : animatedWeight.toFixed(2)}
              </div>
              <div className="text-xs text-muted-foreground">体重 kg</div>
            </div>
            <div className="rounded-xl bg-gradient-to-b from-sky-500/10 to-transparent p-3">
              <div className="text-2xl font-bold tabular-nums text-sky-600 dark:text-sky-400">
                {latest?.bodyFat ? animatedFat.toFixed(1) : '—'}
              </div>
              <div className="text-xs text-muted-foreground">体脂 %</div>
            </div>
            <div className="rounded-xl bg-gradient-to-b from-emerald-500/10 to-transparent p-3">
              <div className="text-2xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                {weight === 0 ? '—' : animatedBmi.toFixed(1)}
              </div>
              <div className="text-xs text-muted-foreground">
                {weight === 0 ? '未记录体重' : `BMI（${bmiLabel(bmiValue)}）`}
              </div>
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
            {weights.length === 0 ? (
              '未记录体重'
            ) : (
              <>
                自开始记录以来体重{' '}
                <span className={
                  deltaTone === 'good'
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : deltaTone === 'bad'
                      ? 'text-red-500 dark:text-red-400'
                      : 'text-muted-foreground'
                }>
                  {weightDelta >= 0 ? '+' : ''}
                  {weightDelta.toFixed(2)} kg
                </span>
              </>
            )}
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

      {/* 本周 vs 上周：完成度 / 训练天数 / 体重（完成度总量由英雄卡进度环呈现，不重复） */}
      <Card className={cardCls}>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/15">
              <CalendarCheck className="h-4 w-4 text-emerald-500" />
            </span>
            本周 vs 上周
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5 rounded-lg bg-muted/40 px-3 py-2 text-sm">
            <CompareRow
              label="完成度"
              current={comparison.completion.current != null ? `${comparison.completion.current}%` : '—'}
              previous={
                comparison.hasPrevious && comparison.completion.previous != null
                  ? `${comparison.completion.previous}%`
                  : '—'
              }
            />
            <CompareRow
              label="训练天数"
              current={`${comparison.trainedDays.current} 天`}
              previous={comparison.hasPrevious ? `${comparison.trainedDays.previous} 天` : '—'}
            />
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-muted-foreground">体重</span>
              <span className="flex items-baseline gap-2 tabular-nums">
                <span className="font-semibold">
                  {weightCompare.current != null ? weightCompare.current.toFixed(1) : '—'}
                </span>
                <span className="flex w-24 items-baseline justify-end gap-1 text-muted-foreground">
                  ←{' '}
                  {comparison.hasPrevious && weightCompare.previous != null ? (
                    <>
                      {weightCompare.previous.toFixed(1)}
                      {weightCompareDelta != null && (
                        <span
                          className={
                            weightCompareTone === 'good'
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : weightCompareTone === 'bad'
                                ? 'text-red-500 dark:text-red-400'
                                : 'text-muted-foreground'
                          }
                        >
                          ({weightCompareDelta >= 0 ? '+' : ''}
                          {weightCompareDelta.toFixed(1)})
                        </span>
                      )}
                    </>
                  ) : (
                    '—'
                  )}
                </span>
              </span>
            </div>
          </div>
          {!comparison.hasPrevious && (
            <p className="text-xs text-muted-foreground">上周还没有可比数据。</p>
          )}
          {onOpenFeedback && (
            <Button variant="outline" size="sm" className="w-full" onClick={onOpenFeedback}>
              <MessageSquareHeart className="mr-1.5 h-4 w-4 text-pink-500" />
              填写本周反馈
            </Button>
          )}
        </CardContent>
      </Card>

      {/* 目标与关键提醒 */}
      <Card className={cardCls}>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-sky-500/15">
              <Target className="h-4 w-4 text-sky-500" />
            </span>
            {goal ? `${WEIGHT_GOAL_LABEL[goal]} · 关键提醒` : '目标与关键提醒'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* 老用户（账号体系上线前的数据）可能没有 weightGoal，这里明确提示而不是默默用通用建议 */}
          {!goal && (
            <p className="mb-3 rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
              还没设置训练目标（增肌 / 减脂 / 塑形 / 保持），下面用的是通用建议。点「重新定制我的计划」补上，
              蛋白质和热量建议会更贴合你。
            </p>
          )}
          {/* 默认只显示最相关的 2 条；展开后 5 条一字不少，避免移动端一屏被长文案占满 */}
          <ul id="key-tips" className="space-y-2 text-sm">
            <li className="flex gap-2">
              <Activity className="mt-0.5 h-4 w-4 shrink-0 text-orange-500" />
              <span>
                本周训练 <span className="font-medium">{summary.trainCount}</span> 天
                {summary.groups && <>：{summary.groups}</>}
                {summary.hasSport && <>；专项 {summary.sportDesc}</>}。
              </span>
            </li>
            <li className="flex gap-2">
              <Flame className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
              {weight === 0
                ? '请先记录体重，再计算每日蛋白质目标。'
                : <>每天蛋白质 {pMin}–{pMax} g（约 {Math.round(weight * 1.6 / 30)} 个鸡蛋 + 一份鸡胸/鱼肉）。</>}
            </li>
            {showAllTips && (
              <>
                <li className="flex gap-2">
                  <TrendingUp className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                  {weightTrendTip}。
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
              </>
            )}
          </ul>
          <button
            type="button"
            aria-expanded={showAllTips}
            aria-controls="key-tips"
            onClick={() => setShowAllTips((v) => !v)}
            className="mt-2 flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-primary"
          >
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showAllTips ? 'rotate-180' : ''}`} />
            {showAllTips ? '收起提醒' : '查看全部 5 条提醒'}
          </button>
          {onOpenNutrition && (
            <button
              type="button"
              onClick={onOpenNutrition}
              className="mt-3 flex w-full items-center justify-between rounded-lg border border-dashed px-3 py-2 text-xs text-muted-foreground transition-colors hover:border-sky-300 hover:text-sky-600 dark:hover:text-sky-400"
            >
              <span className="flex items-center gap-1.5">
                <Utensils className="h-3.5 w-3.5" />
                营养建议：热量 / 一日食谱 / 恢复
              </span>
              <span aria-hidden>›</span>
            </button>
          )}
          {onRebuild && (
            <Button
              variant="outline"
              size="sm"
              className="mt-3 w-full"
              onClick={() => setRebuilding(true)}
            >
              <Sparkles className="mr-1.5 h-4 w-4" />
              {profile.onboarded ? '重新定制我的计划' : '定制我的专属计划'}
            </Button>
          )}
          {canShowTransformation && (
            <Button
              variant="outline"
              size="sm"
              className="mt-2 w-full"
              onClick={() => setShowTransformation(true)}
            >
              <Trophy className="mr-1.5 h-4 w-4 text-orange-500" />
              我的蜕变
            </Button>
          )}
        </CardContent>
      </Card>

      {/* 重新定制：弹窗内嵌 Onboarding，右上角 X / 点击遮罩关闭，完成后回调 */}
      {onRebuild && (
        <Dialog open={rebuilding} onOpenChange={setRebuilding}>
          <DialogContent
            className="max-h-[90vh] gap-0 overflow-y-auto p-0 sm:max-w-lg"
            aria-describedby={undefined}
          >
            <DialogTitle className="sr-only">重新定制计划</DialogTitle>
            <Onboarding
              embedded
              existing={profile.onboarded ? profile : undefined}
              onComplete={(p, plan) => {
                onRebuild(p, plan)
                setRebuilding(false)
              }}
            />
          </DialogContent>
        </Dialog>
      )}

      {/* 我的蜕变：报告 + 可下载海报（数据不足时入口整体收起） */}
      {canShowTransformation && (
        <TransformationDialog
          open={showTransformation}
          onOpenChange={setShowTransformation}
          weights={weights}
          feedbacks={feedbacks}
          setLogs={setLogs}
          profile={profile}
          weekPlan={weekPlan}
        />
      )}
    </div>
  )
}
