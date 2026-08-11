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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { LineChart as LineChartIcon, Plus, Trash2 } from 'lucide-react'
import { bmi } from '@/lib/store'
import type { BodyEntry } from '@/types'

interface Props {
  weights: BodyEntry[]
  setWeights: (v: BodyEntry[] | ((p: BodyEntry[]) => BodyEntry[])) => void
  heightCm: number
}

export default function BodyData({ weights, setWeights, heightCm }: Props) {
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [time, setTime] = useState(format(new Date(), 'HH:mm'))
  const [weight, setWeight] = useState('')
  const [bodyFat, setBodyFat] = useState('')
  const [range, setRange] = useState<'7' | '30' | 'all'>('30')

  // 同一天可有多条记录（早晚），以 日期+时间 作为唯一键
  const keyOf = (e: BodyEntry) => `${e.date}T${e.time ?? ''}`

  const sorted = useMemo(
    () => [...weights].sort((a, b) => keyOf(a).localeCompare(keyOf(b))),
    [weights],
  )

  const chartData = useMemo(() => {
    const cutoff =
      range === 'all' ? null : format(subDays(new Date(), range === '7' ? 7 : 30), 'yyyy-MM-dd')
    return sorted
      .filter((e) => !cutoff || e.date >= cutoff)
      .map((e) => ({
        date: format(new Date(e.date + 'T00:00:00'), 'M/d') + (e.time ? ` ${e.time}` : ''),
        体重: e.weight,
        体脂: e.bodyFat ?? undefined,
      }))
  }, [sorted, range])

  const latest = sorted[sorted.length - 1]
  const weekAgo = useMemo(() => {
    const cutoff = format(subDays(new Date(), 7), 'yyyy-MM-dd')
    const past = sorted.filter((e) => e.date <= cutoff)
    return past[past.length - 1]
  }, [sorted])
  const weekDelta = latest && weekAgo && latest.date !== weekAgo.date ? latest.weight - weekAgo.weight : null

  const addEntry = () => {
    const w = parseFloat(weight)
    if (!date || isNaN(w) || w <= 0) return
    const bf = bodyFat.trim() === '' ? null : parseFloat(bodyFat)
    const entry: BodyEntry = {
      date,
      time: time || undefined,
      weight: Math.round(w * 100) / 100,
      bodyFat: bf === null || isNaN(bf as number) ? null : bf,
    }
    setWeights((prev) => {
      // 同一日期+时间覆盖，否则新增（同一天早晚可各记一条）
      const rest = prev.filter((e) => keyOf(e) !== keyOf(entry))
      return [...rest, entry].sort((a, b) => keyOf(a).localeCompare(keyOf(b)))
    })
    setWeight('')
    setBodyFat('')
  }

  const remove = (key: string) => setWeights((prev) => prev.filter((e) => keyOf(e) !== key))

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
            <Button onClick={addEntry} className="bg-primary text-primary-foreground hover:bg-primary/90">
              <Plus className="mr-1 h-4 w-4" /> 保存
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 趋势图 */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <LineChartIcon className="h-4 w-4 text-sky-500" /> 趋势
            <span className="ml-auto flex gap-2">
              <Button size="sm" variant={range === '7' ? 'default' : 'outline'} onClick={() => setRange('7')}>
                近 7 天
              </Button>
              <Button size="sm" variant={range === '30' ? 'default' : 'outline'} onClick={() => setRange('30')}>
                近 30 天
              </Button>
              <Button size="sm" variant={range === 'all' ? 'default' : 'outline'} onClick={() => setRange('all')}>
                全部
              </Button>
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* 统计摘要 */}
          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-lg bg-muted/60 p-3 text-center">
              <div className="text-xl font-bold">{latest ? latest.weight.toFixed(2) : '—'} kg</div>
              <div className="text-xs text-muted-foreground">最新体重</div>
            </div>
            <div className="rounded-lg bg-muted/60 p-3 text-center">
              <div className="text-xl font-bold">
                {latest?.bodyFat ? `${latest.bodyFat.toFixed(1)}%` : '—'}
              </div>
              <div className="text-xs text-muted-foreground">最新体脂率</div>
            </div>
            <div className="rounded-lg bg-muted/60 p-3 text-center">
              <div className={`text-xl font-bold ${weekDelta == null ? '' : weekDelta >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}>
                {weekDelta == null ? '—' : `${weekDelta >= 0 ? '+' : ''}${weekDelta.toFixed(2)} kg`}
              </div>
              <div className="text-xs text-muted-foreground">近 7 天变化</div>
            </div>
            <div className="rounded-lg bg-muted/60 p-3 text-center">
              <div className="text-xl font-bold">{latest ? bmi(latest.weight, heightCm).toFixed(1) : '—'}</div>
              <div className="text-xs text-muted-foreground">当前 BMI</div>
            </div>
          </div>

          {chartData.length >= 2 ? (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" fontSize={12} tick={{ fill: 'hsl(var(--muted-foreground))' }} stroke="hsl(var(--border))" />
                  <YAxis yAxisId="w" domain={['dataMin - 1', 'dataMax + 1']} fontSize={12} tickFormatter={(v: number) => v.toFixed(1)} tick={{ fill: 'hsl(var(--muted-foreground))' }} stroke="hsl(var(--border))" />
                  <YAxis yAxisId="f" orientation="right" domain={['dataMin - 2', 'dataMax + 2']} fontSize={12} hide={!chartData.some((d) => d.体脂 != null)} tick={{ fill: 'hsl(var(--muted-foreground))' }} stroke="hsl(var(--border))" />
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
                  <Line yAxisId="w" type="monotone" dataKey="体重" stroke="#f97316" strokeWidth={2} dot={{ r: 3 }} unit=" kg" />
                  <Line yAxisId="f" type="monotone" dataKey="体脂" stroke="#0ea5e9" strokeWidth={2} dot={{ r: 3 }} unit=" %" connectNulls />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="py-10 text-center text-sm text-muted-foreground">
              至少记录 2 天数据后，这里会显示体重 / 体脂趋势图。
            </p>
          )}
          <p className="mt-2 text-xs text-muted-foreground">
            增肌期理想节奏：体重每周上涨约 0.1-0.25 kg，体脂率尽量保持稳定。短期 1-2 天的波动大多是水分，不用焦虑。
          </p>
        </CardContent>
      </Card>

      {/* 历史记录 */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">历史记录 <Badge variant="secondary">{sorted.length} 条</Badge></CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>日期</TableHead>
                <TableHead>时间</TableHead>
                <TableHead className="text-right">体重 (kg)</TableHead>
                <TableHead className="text-right">体脂 (%)</TableHead>
                <TableHead className="text-right">BMI</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {[...sorted].reverse().slice(0, 15).map((e) => (
                <TableRow key={keyOf(e)}>
                  <TableCell>{format(new Date(e.date + 'T00:00:00'), 'yyyy年M月d日')}</TableCell>
                  <TableCell>{e.time ?? '—'}</TableCell>
                  <TableCell className="text-right">{e.weight.toFixed(2)}</TableCell>
                  <TableCell className="text-right">{e.bodyFat != null ? e.bodyFat.toFixed(1) : '—'}</TableCell>
                  <TableCell className="text-right">{bmi(e.weight, heightCm).toFixed(1)}</TableCell>
                  <TableCell>
                    <Button size="icon" variant="ghost" onClick={() => remove(keyOf(e))}>
                      <Trash2 className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {sorted.length > 15 && (
            <p className="mt-2 text-center text-xs text-muted-foreground">仅显示最近 15 条，共 {sorted.length} 条</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
