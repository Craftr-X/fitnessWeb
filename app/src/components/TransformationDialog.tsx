import { useMemo, useRef, useState } from 'react'
import { format } from 'date-fns'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Download, Sparkles, Flame, TrendingDown, TrendingUp } from 'lucide-react'
import { computeTransformation, describeTransformation } from '@/lib/transformation'
import type { ExerciseLogMap, Profile, WeekFeedback, WeekPlan, WeightEntry } from '@/types'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  weights: WeightEntry[]
  feedbacks: WeekFeedback[]
  setLogs: ExerciseLogMap
  profile: Profile
  weekPlan: WeekPlan
}

const fmtSigned = (n: number | null, digits = 1, unit = '') =>
  n == null ? '—' : `${n > 0 ? '+' : ''}${n.toFixed(digits)}${unit}`

/** 体重变化是否契合目标（决定海报/报告里箭头与配色） */
function weightGood(goal: Profile['weightGoal'], delta: number | null): boolean | null {
  if (delta == null || !goal) return null
  if (goal === 'lose') return delta < 0
  if (goal === 'gain') return delta > 0
  return null
}

/* ----------------------------- 海报（固定视觉，导出 PNG）----------------------------- */
function Poster({
  stats,
  copy,
  profile,
  innerRef,
}: {
  stats: ReturnType<typeof computeTransformation>
  copy: ReturnType<typeof describeTransformation>
  profile: Profile
  innerRef: React.RefObject<HTMLDivElement | null>
}) {
  const wg = weightGood(profile.weightGoal, stats.weightDelta)
  return (
    <div
      ref={innerRef}
      className="overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-orange-950 p-6 text-white shadow-xl"
      style={{ aspectRatio: '4 / 5' }}
    >
      <div className="flex h-full flex-col">
        {/* 品牌头 */}
        <div className="flex items-center justify-between text-xs font-semibold tracking-wide text-orange-300">
          <span className="text-base font-bold">FitUp</span>
          <span>健身计划</span>
        </div>

        {/* 主标题 */}
        <div className="mt-6 flex flex-1 flex-col justify-center">
          <p className="text-sm text-white/70">我的蜕变</p>
          <h2 className="mt-1 text-3xl font-black leading-tight">{copy.headline}</h2>
          {copy.verdict && <p className="mt-2 text-sm text-orange-200">{copy.verdict}</p>}

          {/* 关键数据 */}
          <div className="mt-5 grid grid-cols-3 gap-2">
            <PosterStat icon={<Flame className="h-3.5 w-3.5" />} label="坚持" value={`${stats.weeksPersisted} 周`} />
            <PosterStat
              icon={stats.weightDelta != null && stats.weightDelta < 0 ? <TrendingDown className="h-3.5 w-3.5" /> : <TrendingUp className="h-3.5 w-3.5" />}
              label="体重"
              value={fmtSigned(stats.weightDelta, 2, ' kg')}
              accent={wg === false ? 'text-red-300' : wg === true ? 'text-emerald-300' : ''}
            />
            <PosterStat
              icon={<Sparkles className="h-3.5 w-3.5" />}
              label="体脂"
              value={fmtSigned(stats.bodyFatDelta, 1, '%')}
              accent={stats.bodyFatDelta != null && stats.bodyFatDelta < 0 ? 'text-emerald-300' : ''}
            />
          </div>
          {stats.avgCompletion != null && (
            <p className="mt-3 text-center text-xs text-white/60">平均完成度 {stats.avgCompletion}%</p>
          )}
        </div>

        {/* 页脚 */}
        <div className="flex items-center justify-between text-[10px] text-white/40">
          <span>{format(new Date(), 'yyyy.MM.dd')}</span>
          <span>坚持记录，本身就是蜕变</span>
        </div>
      </div>
    </div>
  )
}

function PosterStat({
  icon,
  label,
  value,
  accent = '',
}: {
  icon: React.ReactNode
  label: string
  value: string
  accent?: string
}) {
  return (
    <div className="rounded-lg bg-white/10 p-2 text-center">
      <div className="flex items-center justify-center text-orange-300">{icon}</div>
      <div className={`mt-0.5 text-sm font-bold ${accent}`}>{value}</div>
      <div className="text-[10px] text-white/50">{label}</div>
    </div>
  )
}

/* ----------------------------- 报告弹窗 ----------------------------- */
export default function TransformationDialog({ open, onOpenChange, weights, feedbacks, setLogs, profile, weekPlan }: Props) {
  const posterRef = useRef<HTMLDivElement>(null)
  const [downloading, setDownloading] = useState(false)

  const stats = useMemo(
    () => computeTransformation({ weights, feedbacks, setLogs, profile, weekPlan }),
    [weights, feedbacks, setLogs, profile, weekPlan],
  )
  const copy = useMemo(() => describeTransformation(stats, profile), [stats, profile])

  const handleDownload = async () => {
    if (!posterRef.current) return
    setDownloading(true)
    try {
      const { toPng } = await import('html-to-image')
      const dataUrl = await toPng(posterRef.current, { pixelRatio: 3, cacheBust: true })
      const a = document.createElement('a')
      a.href = dataUrl
      a.download = `FitUp-蜕变-${format(new Date(), 'yyyyMMdd')}.png`
      a.click()
      toast.success('海报已下载')
    } catch {
      toast.error('海报生成失败，请重试')
    } finally {
      setDownloading(false)
    }
  }

  const wg = weightGood(profile.weightGoal, stats.weightDelta)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-orange-500" /> 我的蜕变
          </DialogTitle>
          <DialogDescription>基于你的训练与身体数据生成的阶段报告</DialogDescription>
        </DialogHeader>

        {!stats.hasData ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            多记录几天体重、训练和反馈，
            <br />
            就能看到你的专属蜕变报告。
          </p>
        ) : (
          <div className="space-y-4">
            {/* headline */}
            <div className="text-center">
              <p className="text-xl font-bold">{copy.headline}</p>
              {copy.verdict && <p className="mt-1 text-sm text-muted-foreground">{copy.verdict}</p>}
            </div>

            {/* 关键指标 */}
            <div className="grid grid-cols-2 gap-2">
              <MiniStat label="坚持周数" value={`${stats.weeksPersisted} 周`} />
              <MiniStat
                label="体重变化"
                value={fmtSigned(stats.weightDelta, 2, ' kg')}
                accent={wg === false ? 'text-red-500' : wg === true ? 'text-emerald-600 dark:text-emerald-400' : ''}
              />
              <MiniStat
                label="体脂变化"
                value={fmtSigned(stats.bodyFatDelta, 1, '%')}
                accent={stats.bodyFatDelta != null && stats.bodyFatDelta < 0 ? 'text-emerald-600 dark:text-emerald-400' : ''}
              />
              <MiniStat label="平均完成率" value={stats.avgCompletion != null ? `${stats.avgCompletion}%` : '—'} />
            </div>

            {/* 本周 PR */}
            {stats.weekPRs.length > 0 && (
              <div className="rounded-lg bg-muted/60 p-3 text-sm">
                <p className="mb-1 text-xs font-medium text-muted-foreground">本周力量纪录</p>
                {stats.weekPRs.map((p) => (
                  <p key={p.name} className="flex justify-between">
                    <span>{p.name}</span>
                    <span className="font-medium">{p.best1RM > 0 ? `${p.best1RM} kg · 1RM` : `${p.maxWeight} kg`}</span>
                  </p>
                ))}
              </div>
            )}

            {/* 鼓励要点 */}
            {copy.lines.length > 0 && (
              <ul className="space-y-1.5 text-sm">
                {copy.lines.map((l, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-orange-500">·</span>
                    <span>{l}</span>
                  </li>
                ))}
              </ul>
            )}

            {/* 海报预览 + 下载 */}
            <div className="space-y-2">
              <Poster stats={stats} copy={copy} profile={profile} innerRef={posterRef} />
              <Button
                onClick={handleDownload}
                disabled={downloading}
                className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
              >
                <Download className="mr-1 h-4 w-4" /> {downloading ? '生成中…' : '下载海报'}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

function MiniStat({ label, value, accent = '' }: { label: string; value: string; accent?: string }) {
  return (
    <div className="rounded-lg bg-muted/60 p-3 text-center">
      <div className={`text-lg font-bold ${accent}`}>{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  )
}
