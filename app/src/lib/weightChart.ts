import { format, subDays } from 'date-fns'
import type { WeightEntry } from '@/types'

/** 趋势图的单个数据点：date 为 X 轴标签（仅 M/d），体脂缺失时不画该线 */
export interface WeightChartPoint {
  date: string
  体重: number
  体脂?: number
}

/** 同一天可有多条记录（早晚），以 日期+时间 作为唯一键；缺省 time 视为较早记录 */
const keyOf = (e: WeightEntry) => `${e.date}T${e.time ?? ''}`

/**
 * 趋势图数据（纯函数）：先按 range 窗口过滤，再按天聚合——一天一个点。
 *
 * 同一天多条按 keyOf（date+time）升序遍历，后者覆盖前者，即取当天最后一条；
 * 输出按日期升序，X 轴标签只保留 M/d（不再拼时间）。
 * 日期走 yyyy-MM-dd 字符串比较，与 BodyData 现状一致。
 */
export function dailyChartData(weights: WeightEntry[], range: '7' | '30' | 'all'): WeightChartPoint[] {
  const cutoff =
    range === 'all' ? null : format(subDays(new Date(), range === '7' ? 7 : 30), 'yyyy-MM-dd')

  const byDay = new Map<string, WeightChartPoint>()
  for (const e of [...weights].sort((a, b) => keyOf(a).localeCompare(keyOf(b)))) {
    if (cutoff && e.date < cutoff) continue
    byDay.set(e.date, {
      date: format(new Date(`${e.date}T00:00:00`), 'M/d'),
      体重: e.weight,
      体脂: e.bodyFat ?? undefined,
    })
  }
  return [...byDay.values()]
}
