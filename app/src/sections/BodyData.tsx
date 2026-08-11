import { useMemo, useState } from 'react'
import { format, subDays } from 'date-fns'
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { LineChart as LineChartIcon, Plus, Trash2, ChevronDown } from 'lucide-react'
import { bmi, waistHipRatio } from '@/lib/store'
import type { BodyEntry } from '@/types'

/* ------------------------------------------------------------------ */
/* 扩展指标元数据：录入表单 / 图表 / 摘要 / 历史表共用                  */
/* ------------------------------------------------------------------ */

type ExtraKey =
  | 'waist'
  | 'hip'
  | 'chest'
  | 'thigh'
  | 'calf'
  | 'neck'
  | 'muscleMass'
  | 'visceralFat'
  | 'bmr'
  | 'restingHr'

interface FieldDef {
  key: ExtraKey
  label: string
  unit: string
}

/** 围度（cm）—— 图表配色，与下方 GIRTH_FIELDS 顺序一致 */
const GIRTH_LINES: { key: string; color: string }[] = [
  { key: '腰围', color: '#10b981' },
  { key: '臀围', color: '#8b5cf6' },
  { key: '胸围', color: '#f59e0b' },
  { key: '大腿围', color: '#f43f5e' },
  { key: '小腿围', color: '#06b6d4' },
  { key: '颈围', color: '#6366f1' },
]

const GIRTH_FIELDS: FieldDef[] = [
  { key: 'waist', label: '腰围', unit: 'cm' },
  { key: 'hip', label: '臀围', unit: 'cm' },
  { key: 'chest', label: '胸围', unit: 'cm' },
  { key: 'thigh', label: '大腿围', unit: 'cm' },
  { key: 'calf', label: '小腿围', unit: 'cm' },
  { key: 'neck', label: '颈围', unit: 'cm' },
]

const COMP_FIELDS: FieldDef[] = [
  { key: 'muscleMass', label: '骨骼肌量', unit: 'kg' },
  { key: 'visceralFat', label: '内脏脂肪', unit: '级' },
  { key: 'bmr', label: '基础代谢', unit: 'kcal' },
]

const HR_FIELDS: FieldDef[] = [{ key: 'restingHr', label: '静息心率', unit: 'bpm' }]
const ALL_EXTRA_FIELDS: FieldDef[] = [...GIRTH_FIELDS, ...COMP_FIELDS, ...HR_FIELDS]

type MetricView = 'basic' | 'girth' | 'comp'

interface Props {
  weights: BodyEntry[]
  setWeights: (v: BodyEntry[] | ((p: BodyEntry[]) => BodyEntry[])) => void
  heightCm: number
}

/** 把字符串解析为数字；空 / 非法时返回 null */
function parseNum(s: string | undefined): number | null {
  if (s == null) return null
  const t = s.trim()
  if (t === '') return null
  const n = parseFloat(t)
  return isNaN(n) ? null : n
}

/** 数字格式化；null/undefined 显示 — */
function fmt(n: number | null | undefined, digits = 1): string {
  return n == null ? '—' : n.toFixed(digits)
}

/** 读 BodyEntry 上任意数值字段，非 number 一律归 null */
function num(e: BodyEntry | undefined, field: keyof BodyEntry): number | null {
  const v = e?.[field]
  return typeof v === 'number' ? v : null
}

export default function BodyData({ weights, setWeights, heightCm }: Props) {
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [time, setTime] = useState(format(new Date(), 'HH:mm'))
  const [weight, setWeight] = useState('')
  const [bodyFat, setBodyFat] = useState('')
  const [range, setRange] = useState<'7' | '30' | 'all'>('30')
  const [metricView, setMetricView] = useState<MetricView>('basic')
  const [moreOpen, setMoreOpen] = useState(false)
  // 扩展指标录入态：key → 原始字符串（与 weight/bodyFat 同样用受控字符串输入）
  const [extra, setExtra] = useState<Partial<Record<ExtraKey, string>>>({})

  // 同一天可有多条记录（早晚），以 日期+时间 作为唯一键
  const keyOf = (e: BodyEntry) => `${e.date}T${e.time ?? ''}`

  const sorted = useMemo(
    () => [...weights].sort((a, b) => keyOf(a).localeCompare(keyOf(b))),
    [weights],
  )

  // 范围筛选后的记录（图表 / 摘要统一基于此）
  const inRange = useMemo(() => {
    const cutoff =
      range === 'all' ? null : format(subDays(new Date(), range === '7' ? 7 : 30), 'yyyy-MM-dd')
    return sorted.filter((e) => !cutoff || e.date >= cutoff)
  }, [sorted, range])

  const chartData = useMemo(
    () =>
      inRange.map((e) => ({
        date: format(new Date(e.date + 'T00:00:00'), 'M/d') + (e.time ? ` ${e.time}` : ''),
        体重: e.weight,
        体脂: e.bodyFat ?? undefined,
        腰围: e.waist ?? undefined,
        臀围: e.hip ?? undefined,
        胸围: e.chest ?? undefined,
        大腿围: e.thigh ?? undefined,
        小腿围: e.calf ?? undefined,
        颈围: e.neck ?? undefined,
        骨骼肌: e.muscleMass ?? undefined,
        内脏脂肪: e.visceralFat ?? undefined,
      })),
    [inRange],
  )

  const latest = sorted[sorted.length - 1]

  // 近 7 天对比基准：不早于 7 天前的最近一条
  const weekAgoEntry = useMemo(() => {
    const cutoff = format(subDays(new Date(), 7), 'yyyy-MM-dd')
    const past = sorted.filter((e) => e.date <= cutoff)
    return past[past.length - 1]
  }, [sorted])

  /** 某数值字段相对 7 天前的变化（基准缺失 / 同一天 / 非数值时返回 null） */
  const fieldDelta = (field: keyof BodyEntry): number | null => {
    if (!latest || !weekAgoEntry || latest.date === weekAgoEntry.date) return null
    const cur = num(latest, field)
    const prev = num(weekAgoEntry, field)
    if (cur == null || prev == null) return null
    return cur - prev
  }

  // 各视图是否有足够数据画图（该类指标 ≥2 个有效点）
  const viewHasData = useMemo(() => {
    let w = 0,
      bf = 0,
      g = 0,
      m = 0,
      vf = 0
    for (const e of inRange) {
      if (e.weight != null) w++
      if (e.bodyFat != null) bf++
      if (e.waist != null || e.hip != null || e.chest != null || e.thigh != null || e.calf != null || e.neck != null)
        g++
      if (e.muscleMass != null) m++
      if (e.visceralFat != null) vf++
    }
    if (metricView === 'basic') return w >= 2 || bf >= 2
    if (metricView === 'girth') return g >= 2
    return m >= 2 || vf >= 2
  }, [inRange, metricView])

  // 录入区实时计算的腰臀比（来自当前输入，非已保存数据）
  const inputWhr = waistHipRatio(parseNum(extra.waist), parseNum(extra.hip))

  const addEntry = () => {
    const w = parseFloat(weight)
    if (!date || isNaN(w) || w <= 0) return
    const bf = bodyFat.trim() === '' ? null : parseFloat(bodyFat)
    // 仅当扩展指标填了有效值才写入，保持记录精简（多数称重只记体重/体脂）
    const extraParsed: Partial<Record<ExtraKey, number>> = {}
    for (const f of ALL_EXTRA_FIELDS) {
      const v = parseNum(extra[f.key])
      if (v != null) extraParsed[f.key] = v
    }
    const entry: BodyEntry = {
      date,
      time: time || undefined,
      weight: Math.round(w * 100) / 100,
      bodyFat: bf === null || isNaN(bf as number) ? null : bf,
      ...extraParsed,
    }
    setWeights((prev) => {
      // 同一日期+时间覆盖，否则新增（同一天早晚可各记一条）
      const rest = prev.filter((e) => keyOf(e) !== keyOf(entry))
      return [...rest, entry].sort((a, b) => keyOf(a).localeCompare(keyOf(b)))
    })
    setWeight('')
    setBodyFat('')
    setExtra({})
  }

  const remove = (key: string) => setWeights((prev) => prev.filter((e) => keyOf(e) !== key))

  // —— 历史表列配置随视图切换 ——
  const weightDelta = fieldDelta('weight')
  const waistDelta = fieldDelta('waist')

  return (
    <div className="space-y-4">
      {/* 录入 */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Plus className="h-4 w-4 text-orange-500" /> 记录身体数据
            <span className="text-xs font-normal text-muted-foreground">
              同一天可记多次（如早/晚各一次），建议早晨空腹上秤数据最稳定
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label htmlFor="bd-date">日期</Label>
              <Input id="bd-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-40" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="bd-time">时间</Label>
              <Input id="bd-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} className="w-28" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="bd-weight">体重 (kg)</Label>
              <Input
                id="bd-weight"
                type="number"
                step="0.01"
                placeholder="50.55"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                className="w-28"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="bd-fat">体脂率 (%) 可选</Label>
              <Input
                id="bd-fat"
                type="number"
                step="0.1"
                placeholder="电子秤数据"
                value={bodyFat}
                onChange={(e) => setBodyFat(e.target.value)}
                className="w-28"
              />
            </div>
            <div className="space-y-1">
              <Label>BMI</Label>
              <div className="flex h-9 w-24 items-center justify-center rounded-md border bg-muted/60 text-sm font-semibold">
                {(() => {
                  const w = parseFloat(weight)
                  return !isNaN(w) && w > 0 ? bmi(w, heightCm).toFixed(1) : '—'
                })()}
              </div>
            </div>
            <div className="space-y-1">
              <Label>腰臀比</Label>
              <div className="flex h-9 w-24 items-center justify-center rounded-md border bg-muted/60 text-sm font-semibold">
                {inputWhr == null ? '—' : inputWhr.toFixed(2)}
              </div>
            </div>
            <Button onClick={addEntry} className="bg-primary text-primary-foreground hover:bg-primary/90">
              <Plus className="mr-1 h-4 w-4" /> 保存
            </Button>
          </div>

          {/* 扩展指标：围度 / 身体成分 / 静息心率，默认折叠 */}
          <Collapsible open={moreOpen} onOpenChange={setMoreOpen} className="mt-2">
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="text-xs text-muted-foreground">
                <ChevronDown
                  className={`mr-1 h-3.5 w-3.5 transition-transform ${moreOpen ? 'rotate-180' : ''}`}
                />
                更多身体数据（围度 / 身体成分 / 心率）
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-3 space-y-3">
              <div>
                <p className="mb-2 text-xs font-medium text-muted-foreground">围度 (cm)</p>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {GIRTH_FIELDS.map((f) => (
                    <div key={f.key} className="space-y-1">
                      <Label htmlFor={`bd-${f.key}`} className="text-xs">
                        {f.label}
                      </Label>
                      <Input
                        id={`bd-${f.key}`}
                        type="number"
                        step="0.1"
                        placeholder={f.unit}
                        value={extra[f.key] ?? ''}
                        onChange={(e) => setExtra((p) => ({ ...p, [f.key]: e.target.value }))}
                        className="w-full"
                      />
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-2 text-xs font-medium text-muted-foreground">身体成分（智能秤）</p>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {COMP_FIELDS.map((f) => (
                    <div key={f.key} className="space-y-1">
                      <Label htmlFor={`bd-${f.key}`} className="text-xs">
                        {f.label}
                      </Label>
                      <Input
                        id={`bd-${f.key}`}
                        type="number"
                        step="0.1"
                        placeholder={f.unit}
                        value={extra[f.key] ?? ''}
                        onChange={(e) => setExtra((p) => ({ ...p, [f.key]: e.target.value }))}
                        className="w-full"
                      />
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-2 text-xs font-medium text-muted-foreground">健康</p>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {HR_FIELDS.map((f) => (
                    <div key={f.key} className="space-y-1">
                      <Label htmlFor={`bd-${f.key}`} className="text-xs">
                        {f.label}
                      </Label>
                      <Input
                        id={`bd-${f.key}`}
                        type="number"
                        placeholder={f.unit}
                        value={extra[f.key] ?? ''}
                        onChange={(e) => setExtra((p) => ({ ...p, [f.key]: e.target.value }))}
                        className="w-full"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </CardContent>
      </Card>

      {/* 趋势 */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex flex-wrap items-center gap-2 text-base">
            <LineChartIcon className="h-4 w-4 text-sky-500" /> 趋势
            <span className="ml-auto flex flex-wrap gap-2">
              <Button size="sm" variant={metricView === 'basic' ? 'default' : 'outline'} onClick={() => setMetricView('basic')}>
                体重体脂
              </Button>
              <Button size="sm" variant={metricView === 'girth' ? 'default' : 'outline'} onClick={() => setMetricView('girth')}>
                围度
              </Button>
              <Button size="sm" variant={metricView === 'comp' ? 'default' : 'outline'} onClick={() => setMetricView('comp')}>
                身体成分
              </Button>
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* 时间范围 */}
          <div className="mb-4 flex justify-end gap-2">
            <Button size="sm" variant={range === '7' ? 'default' : 'outline'} onClick={() => setRange('7')}>
              近 7 天
            </Button>
            <Button size="sm" variant={range === '30' ? 'default' : 'outline'} onClick={() => setRange('30')}>
              近 30 天
            </Button>
            <Button size="sm" variant={range === 'all' ? 'default' : 'outline'} onClick={() => setRange('all')}>
              全部
            </Button>
          </div>

          {/* 统计摘要：随视图切换 */}
          {metricView === 'basic' && (
            <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-lg bg-muted/60 p-3 text-center">
                <div className="text-xl font-bold">{latest ? latest.weight.toFixed(2) : '—'} kg</div>
                <div className="text-xs text-muted-foreground">最新体重</div>
              </div>
              <div className="rounded-lg bg-muted/60 p-3 text-center">
                <div className="text-xl font-bold">{latest?.bodyFat ? `${latest.bodyFat.toFixed(1)}%` : '—'}</div>
                <div className="text-xs text-muted-foreground">最新体脂率</div>
              </div>
              <div className="rounded-lg bg-muted/60 p-3 text-center">
                <div
                  className={`text-xl font-bold ${
                    weightDelta == null ? '' : weightDelta >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'
                  }`}
                >
                  {weightDelta == null ? '—' : `${weightDelta >= 0 ? '+' : ''}${weightDelta.toFixed(2)} kg`}
                </div>
                <div className="text-xs text-muted-foreground">近 7 天变化</div>
              </div>
              <div className="rounded-lg bg-muted/60 p-3 text-center">
                <div className="text-xl font-bold">{latest ? bmi(latest.weight, heightCm).toFixed(1) : '—'}</div>
                <div className="text-xs text-muted-foreground">当前 BMI</div>
              </div>
            </div>
          )}

          {metricView === 'girth' && (
            <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-lg bg-muted/60 p-3 text-center">
                <div className="text-xl font-bold">{fmt(num(latest, 'waist'))}<span className="ml-0.5 text-xs font-normal text-muted-foreground">cm</span></div>
                <div className="text-xs text-muted-foreground">最新腰围</div>
              </div>
              <div className="rounded-lg bg-muted/60 p-3 text-center">
                <div className="text-xl font-bold">{fmt(num(latest, 'hip'))}<span className="ml-0.5 text-xs font-normal text-muted-foreground">cm</span></div>
                <div className="text-xs text-muted-foreground">最新臀围</div>
              </div>
              <div className="rounded-lg bg-muted/60 p-3 text-center">
                <div className="text-xl font-bold">{fmt(waistHipRatio(num(latest, 'waist'), num(latest, 'hip')), 2)}</div>
                <div className="text-xs text-muted-foreground">腰臀比</div>
              </div>
              <div className="rounded-lg bg-muted/60 p-3 text-center">
                <div
                  className={`text-xl font-bold ${
                    waistDelta == null ? '' : waistDelta >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'
                  }`}
                >
                  {waistDelta == null ? '—' : `${waistDelta >= 0 ? '+' : ''}${waistDelta.toFixed(1)} cm`}
                </div>
                <div className="text-xs text-muted-foreground">近 7 天腰围变化</div>
              </div>
            </div>
          )}

          {metricView === 'comp' && (
            <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-lg bg-muted/60 p-3 text-center">
                <div className="text-xl font-bold">{fmt(num(latest, 'muscleMass'))}<span className="ml-0.5 text-xs font-normal text-muted-foreground">kg</span></div>
                <div className="text-xs text-muted-foreground">骨骼肌量</div>
              </div>
              <div className="rounded-lg bg-muted/60 p-3 text-center">
                <div className="text-xl font-bold">{fmt(num(latest, 'visceralFat'), 0)}<span className="ml-0.5 text-xs font-normal text-muted-foreground">级</span></div>
                <div className="text-xs text-muted-foreground">内脏脂肪</div>
              </div>
              <div className="rounded-lg bg-muted/60 p-3 text-center">
                <div className="text-xl font-bold">{fmt(num(latest, 'bmr'), 0)}<span className="ml-0.5 text-xs font-normal text-muted-foreground">kcal</span></div>
                <div className="text-xs text-muted-foreground">基础代谢</div>
              </div>
              <div className="rounded-lg bg-muted/60 p-3 text-center">
                <div className="text-xl font-bold">{fmt(num(latest, 'restingHr'), 0)}<span className="ml-0.5 text-xs font-normal text-muted-foreground">bpm</span></div>
                <div className="text-xs text-muted-foreground">静息心率</div>
              </div>
            </div>
          )}

          {viewHasData ? (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" fontSize={12} tick={{ fill: 'hsl(var(--muted-foreground))' }} stroke="hsl(var(--border))" />
                  {metricView === 'basic' && (
                    <>
                      <YAxis yAxisId="w" domain={['dataMin - 1', 'dataMax + 1']} fontSize={12} tickFormatter={(v: number) => v.toFixed(1)} tick={{ fill: 'hsl(var(--muted-foreground))' }} stroke="hsl(var(--border))" />
                      <YAxis yAxisId="f" orientation="right" domain={['dataMin - 2', 'dataMax + 2']} fontSize={12} hide={!chartData.some((d) => d.体脂 != null)} tick={{ fill: 'hsl(var(--muted-foreground))' }} stroke="hsl(var(--border))" />
                    </>
                  )}
                  {metricView === 'girth' && (
                    <YAxis yAxisId="g" domain={['dataMin - 2', 'dataMax + 2']} fontSize={12} tickFormatter={(v: number) => v.toFixed(0)} tick={{ fill: 'hsl(var(--muted-foreground))' }} stroke="hsl(var(--border))" />
                  )}
                  {metricView === 'comp' && (
                    <>
                      <YAxis yAxisId="m" domain={['dataMin - 1', 'dataMax + 1']} fontSize={12} tickFormatter={(v: number) => v.toFixed(1)} tick={{ fill: 'hsl(var(--muted-foreground))' }} stroke="hsl(var(--border))" />
                      <YAxis yAxisId="v" orientation="right" domain={['dataMin - 1', 'dataMax + 1']} fontSize={12} hide={!chartData.some((d) => d.内脏脂肪 != null)} tick={{ fill: 'hsl(var(--muted-foreground))' }} stroke="hsl(var(--border))" />
                    </>
                  )}
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--popover))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: 'var(--radius)',
                      color: 'hsl(var(--popover-foreground))',
                    }}
                    labelStyle={{ color: 'hsl(var(--popover-foreground))' }}
                  />
                  <Legend />
                  {metricView === 'basic' && (
                    <>
                      <Line yAxisId="w" type="monotone" dataKey="体重" stroke="#f97316" strokeWidth={2} dot={{ r: 3 }} unit=" kg" />
                      <Line yAxisId="f" type="monotone" dataKey="体脂" stroke="#0ea5e9" strokeWidth={2} dot={{ r: 3 }} unit=" %" connectNulls />
                    </>
                  )}
                  {metricView === 'girth' &&
                    GIRTH_LINES.map((g) => (
                      <Line key={g.key} yAxisId="g" type="monotone" dataKey={g.key} stroke={g.color} strokeWidth={2} dot={{ r: 3 }} unit=" cm" connectNulls />
                    ))}
                  {metricView === 'comp' && (
                    <>
                      <Line yAxisId="m" type="monotone" dataKey="骨骼肌" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} unit=" kg" connectNulls />
                      <Line yAxisId="v" type="monotone" dataKey="内脏脂肪" stroke="#f43f5e" strokeWidth={2} dot={{ r: 3 }} unit=" 级" connectNulls />
                    </>
                  )}
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="py-10 text-center text-sm text-muted-foreground">
              {metricView === 'basic'
                ? '至少记录 2 天数据后，这里会显示体重 / 体脂趋势图。'
                : metricView === 'girth'
                  ? '在「更多身体数据」里记录围度，连续 2 次后这里会显示围度趋势。'
                  : '在「更多身体数据」里记录骨骼肌 / 内脏脂肪，连续 2 次后这里会显示趋势。'}
            </p>
          )}
          <p className="mt-2 text-xs text-muted-foreground">
            {metricView === 'basic'
              ? '增肌期理想节奏：体重每周上涨约 0.1-0.25 kg，体脂率尽量保持稳定。短期 1-2 天的波动大多是水分，不用焦虑。'
              : metricView === 'girth'
                ? '围度建议固定时间、固定测量部位（如晨起空腹）。腰臀比女性 < 0.85、男性 < 0.90 为健康区间。'
                : '骨骼肌量与内脏脂肪等级来自体脂秤，不同品牌存在偏差，重点看长期趋势而非绝对值。'}
          </p>
        </CardContent>
      </Card>

      {/* 历史记录 */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            历史记录 <Badge variant="secondary">{sorted.length} 条</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                {metricView === 'basic' && (
                  <TableRow>
                    <TableHead>日期</TableHead>
                    <TableHead>时间</TableHead>
                    <TableHead className="text-right">体重 (kg)</TableHead>
                    <TableHead className="text-right">体脂 (%)</TableHead>
                    <TableHead className="text-right">BMI</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                )}
                {metricView === 'girth' && (
                  <TableRow>
                    <TableHead>日期</TableHead>
                    <TableHead className="text-right">腰围</TableHead>
                    <TableHead className="text-right">臀围</TableHead>
                    <TableHead className="text-right">胸围</TableHead>
                    <TableHead className="text-right">大腿</TableHead>
                    <TableHead className="text-right">小腿</TableHead>
                    <TableHead className="text-right">颈</TableHead>
                    <TableHead className="text-right">腰臀比</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                )}
                {metricView === 'comp' && (
                  <TableRow>
                    <TableHead>日期</TableHead>
                    <TableHead className="text-right">骨骼肌 (kg)</TableHead>
                    <TableHead className="text-right">内脏脂肪 (级)</TableHead>
                    <TableHead className="text-right">基础代谢 (kcal)</TableHead>
                    <TableHead className="text-right">静息心率 (bpm)</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                )}
              </TableHeader>
              <TableBody>
                {[...sorted].reverse().slice(0, 15).map((e) => (
                  <TableRow key={keyOf(e)}>
                    <TableCell>{format(new Date(e.date + 'T00:00:00'), 'yyyy年M月d日')}</TableCell>
                    {metricView === 'basic' && (
                      <>
                        <TableCell>{e.time ?? '—'}</TableCell>
                        <TableCell className="text-right">{e.weight.toFixed(2)}</TableCell>
                        <TableCell className="text-right">{e.bodyFat != null ? e.bodyFat.toFixed(1) : '—'}</TableCell>
                        <TableCell className="text-right">{bmi(e.weight, heightCm).toFixed(1)}</TableCell>
                      </>
                    )}
                    {metricView === 'girth' && (
                      <>
                        <TableCell className="text-right">{fmt(e.waist)}</TableCell>
                        <TableCell className="text-right">{fmt(e.hip)}</TableCell>
                        <TableCell className="text-right">{fmt(e.chest)}</TableCell>
                        <TableCell className="text-right">{fmt(e.thigh)}</TableCell>
                        <TableCell className="text-right">{fmt(e.calf)}</TableCell>
                        <TableCell className="text-right">{fmt(e.neck)}</TableCell>
                        <TableCell className="text-right">{fmt(waistHipRatio(e.waist, e.hip), 2)}</TableCell>
                      </>
                    )}
                    {metricView === 'comp' && (
                      <>
                        <TableCell className="text-right">{fmt(e.muscleMass)}</TableCell>
                        <TableCell className="text-right">{fmt(e.visceralFat, 0)}</TableCell>
                        <TableCell className="text-right">{fmt(e.bmr, 0)}</TableCell>
                        <TableCell className="text-right">{fmt(e.restingHr, 0)}</TableCell>
                      </>
                    )}
                    <TableCell>
                      <Button size="icon" variant="ghost" onClick={() => remove(keyOf(e))}>
                        <Trash2 className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {sorted.length > 15 && (
            <p className="mt-2 text-center text-xs text-muted-foreground">仅显示最近 15 条，共 {sorted.length} 条</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
