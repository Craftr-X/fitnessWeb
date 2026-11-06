import { useState } from 'react'
import { format } from 'date-fns'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { ArrowRightCircle, ClipboardCopy, MessageSquareHeart, Send } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { buildNextWeekPlan, buildWeekPlanFromProfile } from '@/lib/planEngine'
import { describeChange, diffWeekPlans, groupChangesByDay, summarizePlanDiff } from '@/lib/planDiff'
import type { PlanDiff } from '@/lib/planDiff'
import type { Profile, WeekFeedback, WeekPlan } from '@/types'

interface Props {
  feedbacks: WeekFeedback[]
  setFeedbacks: (v: WeekFeedback[] | ((p: WeekFeedback[]) => WeekFeedback[])) => void
  weekPlan: WeekPlan
  setWeekPlan: (v: WeekPlan | ((p: WeekPlan) => WeekPlan)) => void
  /** 当前用户画像，生成下周计划时走规则引擎 */
  profile: Profile
  /** 本周真实打卡完成度（0-100）：用于把「计划完成度」默认值填成真值 */
  weekProgressPct?: number
  /** 生成下周计划后切到计划 Tab */
  onGoPlan: () => void
}

const SORENESS_OPTIONS = ['胸', '背', '肩', '手臂', '腿', '全身轻微', '无明显酸痛']
const DIFFICULTY_LABELS = ['', '很轻松', '较轻松', '刚刚好', '偏累', '非常吃力']

export default function Feedback({ feedbacks, setFeedbacks, weekPlan, setWeekPlan, profile, weekProgressPct, onGoPlan }: Props) {
  // 默认值是真实打卡完成度，而不是固定的 80%：
  // completion 会喂给规则引擎（<60% 触发下周降阶），假默认值会让降阶永远不触发
  const [completion, setCompletion] = useState(() => {
    if (weekProgressPct == null || !Number.isFinite(weekProgressPct)) return 80
    return Math.min(100, Math.max(0, Math.round(weekProgressPct)))
  })
  const [difficulty, setDifficulty] = useState(3)
  const [soreness, setSoreness] = useState<string[]>([])
  const [sleep, setSleep] = useState('7-8')
  const [diet, setDiet] = useState('基本达标')
  const [note, setNote] = useState('')
  const [saved, setSaved] = useState(false)
  const [copied, setCopied] = useState(false)
  // 保存后即时算出的"下周计划预览"：让用户看到反馈到底改了什么，而不是只给一句话
  const [preview, setPreview] = useState<{ diff: PlanDiff; next: WeekPlan } | null>(null)
  const [showDetail, setShowDetail] = useState(false)

  const toggleSoreness = (s: string) =>
    setSoreness((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]))

  const save = () => {
    const fb: WeekFeedback = {
      week: weekPlan.week,
      date: format(new Date(), 'yyyy-MM-dd'),
      completion,
      difficulty,
      soreness,
      sleep,
      diet,
      note,
    }
    setFeedbacks((prev) => [fb, ...prev.filter((f) => f.week !== weekPlan.week)])
    // 保存后立刻算出「不带反馈 vs 带反馈」的差异：用户最想知道的是"我的反馈到底改了什么"
    const nextWeek = weekPlan.week + 1
    const baseline = buildWeekPlanFromProfile(profile, nextWeek)
    const next = buildNextWeekPlan(profile, weekPlan, fb)
    setPreview({ diff: diffWeekPlans(baseline, next), next })
    setShowDetail(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  // 用刚算好的预览直接应用下周计划，并切到计划 Tab
  const applyPreview = () => {
    if (!preview) return
    const next = preview.next
    setWeekPlan(next)
    setPreview(null)
    toast.success(`🚀 第 ${next.week} 周计划已应用，继续加油！`)
    onGoPlan()
  }

  const buildSummary = (f: WeekFeedback) =>
    [
      `【第 ${f.week} 周健身反馈】`,
      `完成度：${f.completion}%`,
      `训练感受：${DIFFICULTY_LABELS[f.difficulty]}（${f.difficulty}/5）`,
      `酸痛部位：${f.soreness.length ? f.soreness.join('、') : '无'}`,
      `睡眠：${f.sleep} 小时/晚`,
      `饮食：${f.diet}`,
      f.note ? `备注：${f.note}` : '',
    ]
      .filter(Boolean)
      .join('\n')

  const copyLatest = () => {
    const target = feedbacks[0]
    if (!target) return
    navigator.clipboard.writeText(buildSummary(target)).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    })
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {/* 填写反馈 */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <MessageSquareHeart className="h-4 w-4 text-pink-500" /> 第 {weekPlan.week} 周反馈
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <Label>本周计划完成度</Label>
              <span className="font-medium">{completion}%</span>
            </div>
            <Slider value={[completion]} min={0} max={100} step={5} onValueChange={(v) => setCompletion(v[0])} />
            <p className="text-xs text-muted-foreground">
              {weekProgressPct == null
                ? '按你的实际完成情况调整，低于 60% 下周会自动降量'
                : `已按本周打卡自动填入（${Math.min(100, Math.max(0, Math.round(weekProgressPct)))}%），可手动调整；低于 60% 下周会自动降量`}
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <Label>整体训练感受</Label>
              <span className="font-medium">
                {DIFFICULTY_LABELS[difficulty]}（{difficulty}/5）
              </span>
            </div>
            <Slider value={[difficulty]} min={1} max={5} step={1} onValueChange={(v) => setDifficulty(v[0])} />
            <p className="text-xs text-muted-foreground">太轻松或太吃力都会影响下周计划的进阶幅度。</p>
          </div>

          <div className="space-y-2">
            <Label>酸痛部位（多选）</Label>
            <div className="flex flex-wrap gap-2">
              {SORENESS_OPTIONS.map((s) => (
                <label
                  key={s}
                  className={`flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1 text-sm ${
                    soreness.includes(s) ? 'border-pink-300 bg-pink-50 text-pink-700 dark:border-pink-500/30 dark:bg-pink-500/10 dark:text-pink-300' : 'text-muted-foreground'
                  }`}
                >
                  <Checkbox checked={soreness.includes(s)} onCheckedChange={() => toggleSoreness(s)} className="h-3.5 w-3.5" />
                  {s}
                </label>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>平均睡眠</Label>
              <Select value={sleep} onValueChange={setSleep}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="<6">少于 6 小时</SelectItem>
                  <SelectItem value="6-7">6-7 小时</SelectItem>
                  <SelectItem value="7-8">7-8 小时</SelectItem>
                  <SelectItem value=">8">8 小时以上</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>饮食 / 蛋白质摄入</Label>
              <Select value={diet} onValueChange={setDiet}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="完全达标">完全达标</SelectItem>
                  <SelectItem value="基本达标">基本达标</SelectItem>
                  <SelectItem value="经常不够">经常不够</SelectItem>
                  <SelectItem value="完全没注意">完全没注意</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1">
            <Label>其他想说的（动作感受、状态、问题…）</Label>
            <Textarea
              rows={3}
              placeholder="例：俯卧撑最后两组有点吃力；周三划船完第二天背很酸；想加强手臂…"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>

          <Button onClick={save} className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
            <Send className="mr-1 h-4 w-4" /> {saved ? '✓ 已保存' : '保存本周反馈'}
          </Button>

          {/* 保存后立刻展示「下周会怎么变」，并把应用计划放在同一处 */}
          {preview && (
            <div className="rounded-xl border border-emerald-300/70 bg-emerald-500/5 p-3">
              <p className="text-sm font-medium">第 {preview.next.week} 周计划已按本次反馈算好</p>
              <p className="mt-1 text-sm text-muted-foreground">{summarizePlanDiff(preview.diff)}</p>

              {preview.diff.changes.length > 0 && (
                <>
                  <button
                    type="button"
                    onClick={() => setShowDetail((v) => !v)}
                    className="mt-2 text-xs text-primary underline-offset-2 hover:underline"
                  >
                    {showDetail ? '收起明细' : `展开明细（${preview.diff.changes.length} 处）`}
                  </button>
                  {showDetail && (
                    <ul className="mt-2 space-y-2">
                      {groupChangesByDay(preview.diff).map((g) => (
                        <li key={g.dayIndex}>
                          <p className="text-xs font-medium text-muted-foreground">{g.day}</p>
                          <ul className="mt-0.5 space-y-0.5">
                            {g.changes.slice(0, 6).map((c, i) => (
                              <li key={`${c.name}-${i}`} className="flex items-baseline justify-between gap-3 text-xs">
                                <span className="truncate">{c.name}</span>
                                <span className="shrink-0 tabular-nums text-muted-foreground">{describeChange(c)}</span>
                              </li>
                            ))}
                            {g.changes.length > 6 && (
                              <li className="text-xs text-muted-foreground">…另有 {g.changes.length - 6} 处</li>
                            )}
                          </ul>
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}

              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <Button onClick={applyPreview} className="flex-1 bg-emerald-600 text-white hover:bg-emerald-600/90">
                  <ArrowRightCircle className="mr-1 h-4 w-4" /> 应用第 {preview.next.week} 周计划
                </Button>
                <Button variant="ghost" onClick={() => setPreview(null)} className="flex-1">
                  先不应用
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 历史 + 反馈摘要 */}
      <div className="space-y-4">
        <Card className="border-pink-200 bg-pink-50/40 dark:border-pink-500/30 dark:bg-pink-500/10">
          <CardContent className="space-y-3 pt-4 text-sm">
            <p>
              保存后会立刻算出下周计划的变化（哪些动作、组数怎么调），确认后一键应用；
              也可以复制摘要留档备查。
            </p>
            <Button variant="outline" onClick={copyLatest} disabled={feedbacks.length === 0}>
              <ClipboardCopy className="mr-1 h-4 w-4" />
              {copied ? '✓ 已复制' : '复制反馈摘要'}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">历史反馈 <Badge variant="secondary">{feedbacks.length}</Badge></CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {feedbacks.length === 0 && (
              <p className="py-6 text-center text-sm text-muted-foreground">还没有反馈记录，每周日训练结束后记得来填写。</p>
            )}
            {feedbacks.map((f) => (
              <div key={f.week} className="space-y-1 rounded-lg border p-3 text-sm">
                <div className="flex items-center gap-2">
                  <Badge className="bg-pink-100 text-pink-700 dark:bg-pink-500/15 dark:text-pink-300">第 {f.week} 周</Badge>
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(f.date + 'T00:00:00'), 'M月d日')}
                  </span>
                  <span className="ml-auto text-xs text-muted-foreground">
                    完成度 {f.completion}% · 难度 {f.difficulty}/5
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  酸痛：{f.soreness.join('、') || '无'} · 睡眠 {f.sleep}h · 饮食{f.diet}
                </p>
                {f.note && <p className="text-sm">“{f.note}”</p>}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
