import { useRef, useState } from 'react'
import { format } from 'date-fns'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ArrowRightCircle, BedDouble, CalendarClock, Copy, Dumbbell, History, Info, Leaf, Plus, Trash2, Trophy } from 'lucide-react'
import { toast } from 'sonner'
import { copyWeekPlan, currentMonday, exerciseWeekStats, getLastLogBefore, getLogForDate, inferLoadType, parseSetTarget, upsertExerciseLog } from '@/lib/store'
import type { SetTarget } from '@/lib/store'
import { buildNextWeekPlan } from '@/lib/planEngine'
import { burstAt, celebrateDayDone, celebrateWeekDone } from '@/lib/celebrate'
import { getDemo } from '@/lib/demos'
import ExerciseDemoButton from '@/components/ExerciseDemoButton'
import type { CheckMap, ExerciseLogMap, ExerciseLogRecord, LoadType, Profile, WeekFeedback, WeekPlan, WorkoutSet } from '@/types'

interface Props {
  weekPlan: WeekPlan
  setWeekPlan: (v: WeekPlan | ((p: WeekPlan) => WeekPlan)) => void
  checks: CheckMap
  setChecks: (v: CheckMap | ((p: CheckMap) => CheckMap)) => void
  setLogs: ExerciseLogMap
  setSetLogs: (v: ExerciseLogMap | ((p: ExerciseLogMap) => ExerciseLogMap)) => void
  feedbacks: WeekFeedback[]
  onGoFeedback: () => void
  /** 当前用户画像，用于已 onboarded 用户生成下周时走规则引擎 */
  profile?: Profile
}

/**
 * 把一条记录压缩成摘要：负重 "12.5kg×10 · 3组"，自重 "10 次 · 3组"，时间类 "45 秒 · 3组"。
 * 自重/时间类忽略记录里的 weightKg——动作类型调整前可能按负重录过，展示以当前类型为准。
 */
function summarizeSets(sets: WorkoutSet[], loadType: LoadType = 'weighted'): string {
  const first = sets[0]
  if (!first) return ''
  const r = first.reps != null ? `${first.reps}` : '?'
  const head =
    loadType === 'weighted'
      ? `${first.weightKg != null ? `${first.weightKg}kg` : '自重'}×${r}`
      : `${r} ${loadType === 'timed' ? '秒' : '次'}`
  return `${head} · ${sets.length}组`
}

/** 训练容量 = Σ 重量 × 次数（自重/未填的组不计入） */
function totalVolume(sets: WorkoutSet[]): number {
  return sets.reduce((sum, s) => sum + (s.weightKg ?? 0) * (s.reps ?? 0), 0)
}

const WEEKDAY_LABEL = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

/** "2026-08-10" → "8/10 周一"（日期非法时原样返回） */
function logDateLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  if (Number.isNaN(d.getTime())) return dateStr
  return `${d.getMonth() + 1}/${d.getDate()} ${WEEKDAY_LABEL[d.getDay()]}`
}

interface ExerciseLogDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  exerciseName: string
  target: SetTarget
  /** 负荷类型：决定弹窗形态（负重=重量+次数；自重=只记次数；时间=只记秒数） */
  loadType: LoadType
  /** 今天的记录（可能还没填） */
  todayRec: ExerciseLogRecord | undefined
  /** 上一次练这个动作的记录，用于预填和"上次"提示 */
  lastRec: ExerciseLogRecord | undefined
  /** 本周全部记录（含今天），用于顶部的容量/重量/1RM 纪录 */
  weekRecords: ExerciseLogRecord[]
  /** 本周（>= 周一）其他日期的记录，倒序展示 */
  weekHistory: ExerciseLogRecord[]
  todayStr: string
  /** 校验通过后提交本次编辑（X / 遮罩关闭不会触发） */
  onSave: (sets: WorkoutSet[]) => void
}

/** 纪录带单项：彩色小标签 + 大数字 + 单位（对齐训记图表页的三栏纪录样式） */
function StatItem({ label, value, unit, color }: { label: string; value: number; unit: string; color: string }) {
  return (
    <div className="min-w-0">
      <p className={`text-[11px] font-medium ${color}`}>{label}</p>
      <p className="mt-0.5 text-xl font-bold leading-tight tracking-tight">
        {value > 0 ? value.toLocaleString() : '—'}
        <span className="ml-0.5 text-xs font-normal text-muted-foreground">{unit}</span>
      </p>
    </div>
  )
}

/**
 * 训记式重量记录弹窗：每行一组「重量 × 次数」，可加组 / 删组 / 改数。
 * 未开始填写时按计划组数渲染，并用上次记录预填重量和次数；
 * 底部列出本周历史记录，方便回看之前用的重量。
 *
 * 关键设计：弹窗内所有编辑只落在本地草稿（sets state），不直接写全局数据。
 * 只有点「完成」且校验通过才提交；X / 遮罩 / Esc 关闭 = 丢弃本次修改。
 * 避免"输入一半关掉却被静默保存"的脏数据问题。
 */
function ExerciseLogDialog({
  open,
  onOpenChange,
  exerciseName,
  target,
  loadType,
  todayRec,
  lastRec,
  weekRecords,
  weekHistory,
  todayStr,
  onSave,
}: ExerciseLogDialogProps) {
  const weighted = loadType === 'weighted'
  /** 次数列的单位与文案（时间类动作记秒数） */
  const repsUnit = loadType === 'timed' ? '秒' : '次'
  // 编辑草稿：弹窗打开期间的唯一真相，完成时才提交
  const [sets, setSets] = useState<WorkoutSet[]>(
    () => {
      // 非负重动作剥离历史记录里的 weightKg：动作类型调整前可能按负重录过，
      // 编辑/保存以当前类型为准，避免旧重量数据被再次写回
      const normalize = (s: WorkoutSet): WorkoutSet =>
        weighted ? { ...s } : { weightKg: null, reps: s.reps }
      if (todayRec) return todayRec.sets.map(normalize)
      return Array.from({ length: target.count }, (_, i) => {
        const ref = lastRec?.sets[i] ?? lastRec?.sets[lastRec.sets.length - 1]
        // 无上次记录时默认 0，由"完成"时的校验提示用户填写；
        // 自重/时间类动作重量固定 null（不展示重量列）
        return ref ? normalize(ref) : { weightKg: weighted ? 0 : null, reps: 0 }
      })
    },
  )
  // 输入框文本草稿：显示用户输入的原始文本（如 "12."），只把合法数字写入 sets，
  // 避免受控 number 输入把 "12.5" 的中间态吞成 "125"
  const [drafts, setDrafts] = useState<Record<string, string>>({})

  const updateSet = (i: number, patch: Partial<WorkoutSet>) => {
    setSets((prev) => prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)))
  }
  const addSet = () => {
    setDrafts({})
    setSets((prev) => {
      const last = prev[prev.length - 1]
      return [...prev, last ? { ...last } : { weightKg: weighted ? 0 : null, reps: 0 }]
    })
  }
  const removeSet = (i: number) => {
    if (sets.length <= 1) return
    setDrafts({})
    setSets((prev) => prev.filter((_, idx) => idx !== i))
  }
  const fieldValue = (i: number, field: 'w' | 'r', num: number | null) =>
    drafts[`${i}:${field}`] ?? (num == null ? '' : String(num))
  const onField = (i: number, field: 'w' | 'r', raw: string) => {
    setDrafts((d) => ({ ...d, [`${i}:${field}`]: raw }))
    if (raw === '') {
      updateSet(i, field === 'w' ? { weightKg: null } : { reps: null })
      return
    }
    const n = Number(raw)
    if (!Number.isFinite(n) || n < 0) return
    updateSet(i, field === 'w' ? { weightKg: n } : { reps: Math.round(n) })
  }

  // 容量实时跟随编辑草稿（未保存也能看到反馈）
  const volume = totalVolume(sets)
  const stats = exerciseWeekStats(weekRecords)

  // 完成前校验：任何一组为 0（或未填）都提示具体位置并留在弹窗；
  // 负重动作校验重量+次数，自重/时间类只校验次数/秒数。校验通过才提交草稿并关闭
  const handleDone = () => {
    const idx = sets.findIndex((s) => (weighted && !s.weightKg) || !s.reps)
    if (idx >= 0) {
      const s = sets[idx]
      const fields = weighted
        ? [!s.weightKg ? '重量' : '', !s.reps ? '次数' : ''].filter(Boolean).join('和')
        : repsUnit === '秒' ? '秒数' : '次数'
      toast.error(`第 ${idx + 1} 组的${fields}为 0，请填写实际数值后再完成`)
      return
    }
    onSave(sets)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] gap-0 overflow-y-auto p-0 sm:max-w-md">
        {/* 头部：动作名 + 当天日期 + 计划目标 */}
        <DialogHeader className="border-b bg-gradient-to-r from-orange-500/10 to-transparent px-5 py-4 text-left">
          <div className="flex items-center gap-2.5 pr-6">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-orange-500/15 text-orange-600 dark:text-orange-400">
              <Dumbbell className="h-4.5 w-4.5" />
            </span>
            <div className="min-w-0">
              <DialogTitle className="truncate text-base leading-tight">{exerciseName}</DialogTitle>
              <DialogDescription className="mt-0.5 text-xs">
                {logDateLabel(todayStr)} · 目标 {target.count} 组{target.repsHint ? ` × ${target.repsHint}` : ''}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 px-5 py-4">
          {/* 本周纪录：负重动作出 容量/重量/1RM，自重/时间类出 总量/单组最佳 */}
          {weekRecords.length > 0 && weighted && (
            <div className="grid grid-cols-3 gap-2 rounded-xl border bg-card px-4 py-3">
              <StatItem label="容量纪录" value={stats.maxVolume} unit="kg" color="text-rose-500 dark:text-rose-400" />
              <StatItem label="重量纪录" value={stats.maxWeight} unit="kg" color="text-emerald-600 dark:text-emerald-400" />
              <StatItem label="1RM 预测" value={stats.best1RM} unit="kg" color="text-sky-600 dark:text-sky-400" />
            </div>
          )}
          {weekRecords.length > 0 && !weighted && (
            <div className="grid grid-cols-2 gap-2 rounded-xl border bg-card px-4 py-3">
              <StatItem
                label={loadType === 'timed' ? '总时长' : '总次数'}
                value={stats.totalReps}
                unit={repsUnit === '秒' ? '秒' : '次'}
                color="text-emerald-600 dark:text-emerald-400"
              />
              <StatItem
                label={loadType === 'timed' ? '单组最长' : '单组最多'}
                value={stats.maxReps}
                unit={repsUnit === '秒' ? '秒' : '次'}
                color="text-sky-600 dark:text-sky-400"
              />
            </div>
          )}

          {/* 上次记录提示（训记式预填来源） */}
          {lastRec && !todayRec && (
            <p className="flex items-center gap-1.5 rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
              <History className="h-3.5 w-3.5 shrink-0" />
              上次（{logDateLabel(lastRec.date)}）：{summarizeSets(lastRec.sets, loadType)}，已为你预填
            </p>
          )}

          {/* 组编辑列表 */}
          <div>
            <div
              className={`mb-1.5 grid items-center gap-2 px-1 text-[11px] text-muted-foreground ${
                weighted ? 'grid-cols-[2rem_1fr_auto_1fr_2.5rem]' : 'grid-cols-[2rem_1fr_2.5rem]'
              }`}
            >
              <span>组</span>
              {weighted && (
                <>
                  <span>重量 kg</span>
                  <span />
                </>
              )}
              <span>{repsUnit === '秒' ? '秒数' : '次数'}</span>
              <span />
            </div>
            <div className="space-y-2">
              {sets.map((s, i) => (
                <div
                  key={i}
                  className={`grid items-center gap-2 rounded-xl border bg-card p-1.5 ${
                    weighted ? 'grid-cols-[2rem_1fr_auto_1fr_2.5rem]' : 'grid-cols-[2rem_1fr_2.5rem]'
                  }`}
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-500/10 text-xs font-semibold text-orange-600 dark:text-orange-400">
                    {i + 1}
                  </span>
                  {weighted && (
                    <>
                      <Input
                        type="number"
                        inputMode="decimal"
                        min={0}
                        step={0.5}
                        placeholder="0"
                        aria-label={`第 ${i + 1} 组重量（kg）`}
                        className="h-10 px-2 text-center text-base"
                        value={fieldValue(i, 'w', s.weightKg)}
                        onChange={(e) => onField(i, 'w', e.target.value)}
                      />
                      <span className="text-sm text-muted-foreground">×</span>
                    </>
                  )}
                  <Input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    step={1}
                    placeholder={target.repsHint || (repsUnit === '秒' ? '秒数' : '次数')}
                    aria-label={`第 ${i + 1} 组次数`}
                    className="h-10 px-2 text-center text-base"
                    value={fieldValue(i, 'r', s.reps)}
                    onChange={(e) => onField(i, 'r', e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => removeSet(i)}
                    disabled={sets.length <= 1}
                    aria-label={`删除第 ${i + 1} 组`}
                    className="flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground/60 transition-colors hover:bg-destructive/10 hover:text-destructive disabled:pointer-events-none disabled:opacity-30"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={addSet}
              className="mt-2 flex w-full items-center justify-center gap-1 rounded-xl border border-dashed border-orange-300 py-2.5 text-sm font-medium text-orange-600 transition-colors hover:bg-orange-500/10 dark:border-orange-500/40 dark:text-orange-400"
            >
              <Plus className="h-4 w-4" />
              加一组
            </button>
          </div>

          {/* 容量 + 完成 */}
          <div className="flex items-center justify-between rounded-xl bg-muted/60 px-3 py-2.5">
            <span className="text-xs text-muted-foreground">
              {weighted
                ? volume > 0
                  ? `本次容量 ${volume.toLocaleString()} kg`
                  : '填重量和次数后自动计算容量'
                : `本次共 ${sets.reduce((sum, s) => sum + (s.reps ?? 0), 0)} ${repsUnit === '秒' ? '秒' : '次'}`}
            </span>
            <Button size="sm" onClick={handleDone} className="bg-orange-500 text-white hover:bg-orange-600">
              完成
            </Button>
          </div>

          {/* 本周历史：回看之前用的重量 */}
          {weekHistory.length > 0 && (
            <div>
              <p className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <History className="h-3.5 w-3.5" />
                本周记录
              </p>
              <div className="divide-y rounded-xl border">
                {weekHistory.map((r) => (
                  <div key={r.date} className="flex items-center justify-between px-3 py-2 text-xs">
                    <span className="text-muted-foreground">{logDateLabel(r.date)}</span>
                    <span className="font-medium">{summarizeSets(r.sets, loadType)}</span>
                    {weighted && totalVolume(r.sets) > 0 && (
                      <span className="text-muted-foreground">{totalVolume(r.sets).toLocaleString()} kg</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
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

export default function WeeklyPlan({ weekPlan, setWeekPlan, checks, setChecks, setLogs, setSetLogs, feedbacks, onGoFeedback, profile }: Props) {
  const [confirming, setConfirming] = useState(false)
  const [confirmingCopy, setConfirmingCopy] = useState(false)
  // 重量记录弹窗当前编辑的动作位置（day index + exercise index），null = 关闭
  const [loggerPos, setLoggerPos] = useState<{ di: number; ei: number } | null>(null)
  const clickPos = useRef<{ x: number; y: number } | null>(null)
  const todayStr = format(new Date(), 'yyyy-MM-dd')

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
                  const target = parseSetTarget(ex.sets)
                  const todayRec = target ? getLogForDate(setLogs, ex.name, todayStr) : undefined
                  const lastRec = target ? getLastLogBefore(setLogs, ex.name, todayStr) : undefined
                  const loadType = target ? inferLoadType(ex) : null
                  // 入口文案按负荷类型区分：负重记重量，自重记次数，时间类记时长
                  const entryLabel = loadType === 'weighted' ? '记录重量' : loadType === 'timed' ? '记录时长' : '记录次数'
                  return (
                    <div
                      key={ei}
                      className={`rounded-xl border p-2 transition-colors ${
                        checked ? 'border-emerald-200 bg-emerald-50/60 dark:border-emerald-500/30 dark:bg-emerald-500/10' : 'hover:bg-muted/50'
                      }`}
                    >
                      <div className="flex items-center gap-2">
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
                      {target && (
                        <div className="mt-1.5 pl-8">
                          <button
                            type="button"
                            onClick={() => setLoggerPos({ di, ei })}
                            className={`flex w-full items-center gap-1.5 rounded-lg border px-2.5 py-2 text-xs font-medium transition-colors ${
                              todayRec
                                ? 'border-emerald-200 bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/15 dark:border-emerald-500/30 dark:text-emerald-300 dark:hover:bg-emerald-500/20'
                                : 'border-orange-200 bg-orange-500/5 text-orange-700 hover:bg-orange-500/15 dark:border-orange-500/30 dark:text-orange-300 dark:hover:bg-orange-500/20'
                            }`}
                          >
                            <Dumbbell className="h-3.5 w-3.5 shrink-0" />
                            {todayRec ? (
                              <>
                                <span className="truncate">本次：{summarizeSets(todayRec.sets, loadType ?? 'bodyweight')}</span>
                                <span className="ml-auto shrink-0 opacity-70">修改</span>
                              </>
                            ) : (
                              <>
                                <span>{entryLabel}</span>
                                {lastRec && (
                                  <span className="ml-auto flex shrink-0 items-center gap-1 font-normal opacity-70">
                                    <History className="h-3 w-3" />
                                    上次 {summarizeSets(lastRec.sets, loadType ?? 'bodyweight')}
                                  </span>
                                )}
                              </>
                            )}
                          </button>
                        </div>
                      )}
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

      {/* 重量记录弹窗：单实例渲染，避免每个动作各挂一个 Dialog */}
      {loggerPos &&
        (() => {
          const ex = weekPlan.days[loggerPos.di]?.exercises[loggerPos.ei]
          const target = ex ? parseSetTarget(ex.sets) : null
          if (!ex || !target) return null
          const records = setLogs[ex.name] ?? []
          return (
            <ExerciseLogDialog
              open
              onOpenChange={(o) => {
                if (!o) setLoggerPos(null)
              }}
              exerciseName={ex.name}
              target={target}
              loadType={inferLoadType(ex)}
              todayRec={getLogForDate(setLogs, ex.name, todayStr)}
              lastRec={getLastLogBefore(setLogs, ex.name, todayStr)}
              weekRecords={records.filter((r) => r.date >= weekPlan.startDate)}
              weekHistory={records
                .filter((r) => r.date >= weekPlan.startDate && r.date !== todayStr)
                .slice()
                .reverse()}
              todayStr={todayStr}
              onSave={(sets) =>
                setSetLogs((prev) =>
                  upsertExerciseLog(prev, ex.name, { date: todayStr, week: weekPlan.week, sets }, weekPlan.startDate),
                )
              }
            />
          )
        })()}
    </div>
  )
}
