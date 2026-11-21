import { describe, it, expect } from 'vitest'
import { format, subDays } from 'date-fns'
import { dailyChartData } from '@/lib/weightChart'
import type { WeightEntry } from '@/types'

/**
 * T9 趋势图按天聚合纯函数（weightChart.ts）的单元测试，
 * 断言清单见 docs/2026-11-14-t9-chart-day-aggregation-plan.md §4。
 * 窗口用例的日期一律以当前真实时间构造（仿 weekCompare.test.ts），任何日期运行都成立。
 */

/** 距今 n 天的 yyyy-MM-dd */
const day = (n: number) => format(subDays(new Date(), n), 'yyyy-MM-dd')

const entry = (
  date: string,
  time: string | undefined,
  weight: number,
  bodyFat?: number | null,
): WeightEntry => ({ date, time, weight, bodyFat })

/** 与实现同源的 X 轴标签：仅 M/d，不拼时间 */
const label = (date: string) => format(new Date(`${date}T00:00:00`), 'M/d')

describe('dailyChartData 同天聚合', () => {
  it('同天两条（08:00 / 20:00）只出 1 个点，取 20:00 那条的体重与体脂', () => {
    const out = dailyChartData(
      [entry(day(0), '08:00', 72.0, 18.2), entry(day(0), '20:00', 73.5, 19.1)],
      'all',
    )
    expect(out).toHaveLength(1)
    expect(out[0]).toEqual({ date: label(day(0)), 体重: 73.5, 体脂: 19.1 })
  })

  it('同天一条带 time、一条不带：不带的排序在前，取后者（带 time 那条）', () => {
    // 故意乱序传入，验证与输入顺序无关、只看 keyOf 排序
    const out = dailyChartData(
      [entry(day(0), '20:00', 74.2, 20.0), entry(day(0), undefined, 71.1, 17.0)],
      'all',
    )
    expect(out).toHaveLength(1)
    expect(out[0]).toEqual({ date: label(day(0)), 体重: 74.2, 体脂: 20.0 })
  })

  it('不同天两条：2 个点，按日期升序排列，标签只含 M/d', () => {
    const out = dailyChartData(
      [entry(day(1), '09:00', 72.4, 18.0), entry(day(3), '21:30', 71.9)],
      'all',
    )
    expect(out).toHaveLength(2)
    expect(out.map((p) => p.体重)).toEqual([71.9, 72.4])
    expect(out.map((p) => p.date)).toEqual([label(day(3)), label(day(1))])
    // X 轴标签不再携带时刻（旧实现是 "M/d HH:mm"）
    for (const p of out) expect(p.date).not.toMatch(/\d{1,2}:\d{2}/)
  })

  it("range='7' 只保留窗口内的天，边界当天（距今整 7 天）的最后一条仍在", () => {
    const out = dailyChartData(
      [
        entry(day(8), '08:00', 70.0), // 窗口外：早于 cutoff，整条丢弃
        entry(day(7), '08:00', 71.0), // 窗口边界当天，早的一条
        entry(day(7), '22:00', 71.4), // 窗口边界当天，晚的一条 → 应保留这条
        entry(day(2), undefined, 72.8),
      ],
      '7',
    )
    expect(out).toHaveLength(2)
    expect(out[0]).toEqual({ date: label(day(7)), 体重: 71.4 }) // 边界当天取最后一条
    expect(out[1]).toEqual({ date: label(day(2)), 体重: 72.8 })
  })

  it('bodyFat 为 null 的记录不产生体脂字段（undefined，不画该线的点）', () => {
    const out = dailyChartData([entry(day(0), '08:00', 72.0, null)], 'all')
    expect(out).toHaveLength(1)
    expect(out[0].体脂).toBeUndefined()
    // recharts / 组件判空口径（体脂线 hide、connectNulls）用的就是 != null
    expect(out[0].体脂 != null).toBe(false)
    // 同天前一条有体脂、后一条 null：后者整体覆盖，体脂同样不保留
    const mixed = dailyChartData(
      [entry(day(0), '08:00', 72.0, 18.5), entry(day(0), '20:00', 73.0, null)],
      'all',
    )
    expect(mixed).toHaveLength(1)
    expect(mixed[0]).toEqual({ date: label(day(0)), 体重: 73.0, 体脂: undefined })
  })

  it('空数组 → 空输出', () => {
    expect(dailyChartData([], 'all')).toEqual([])
    expect(dailyChartData([], '7')).toEqual([])
  })
})
