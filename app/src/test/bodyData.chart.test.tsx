import { describe, it, expect, vi } from 'vitest'
import type { ReactNode } from 'react'
import { render, screen } from '@testing-library/react'
import { format, subDays } from 'date-fns'
import BodyData from '@/sections/BodyData'
import type { WeightEntry } from '@/types'

/**
 * T9 组件级测试：趋势图按天聚合后，图表数据源一天一个点，
 * 而历史表格仍逐条列出全部记录（信息不丢）。
 * 见 docs/2026-11-14-t9-chart-day-aggregation-plan.md §4 组件用例。
 */

/** jsdom 里 ResponsiveContainer 测不到尺寸，recharts 不会真正出图；
 *  这里 mock 掉 recharts，只为截获 LineChart 收到的 data（即图表数据源） */
const captured = vi.hoisted(() => ({ chartData: null as Array<Record<string, unknown>> | null }))

vi.mock('recharts', () => ({
  CartesianGrid: () => null,
  Legend: () => null,
  Line: () => null,
  LineChart: (props: { data?: Array<Record<string, unknown>> }) => {
    captured.chartData = props.data ?? []
    return null
  },
  ResponsiveContainer: (props: { children?: ReactNode }) => props.children ?? null,
  Tooltip: () => null,
  XAxis: () => null,
  YAxis: () => null,
}))

/** 距今 n 天的 yyyy-MM-dd（默认 range='30'，窗口内任何日期都行） */
const day = (n: number) => format(subDays(new Date(), n), 'yyyy-MM-dd')

const renderBodyData = (weights: WeightEntry[]) =>
  render(
    <BodyData weights={weights} setWeights={() => {}} heightCm={178} activity={{}} feedbacks={[]} />,
  )

/** 历史记录表：页面上以「时间」列表头区分于训练日历的表格 */
const historyRows = (container: HTMLElement) => {
  const table = Array.from(container.querySelectorAll('table')).find((t) =>
    Array.from(t.querySelectorAll('th')).some((th) => th.textContent === '时间'),
  )
  expect(table, '历史记录表格应存在').toBeDefined()
  return table!.querySelectorAll('tbody tr')
}

describe('BodyData 趋势图按天聚合（T9）', () => {
  it('仅同天两条记录：聚合后只剩 1 天，不触发画图；历史表格仍 2 行', () => {
    const { container } = renderBodyData([
      { date: day(0), time: '08:00', weight: 72.0, bodyFat: 18.2 },
      { date: day(0), time: '20:00', weight: 73.5, bodyFat: 19.1 },
    ])

    // 同天 2 条聚合成 1 个点，不满「至少 2 天」的画图门槛 → 空态文案（而非两个点的锯齿线）
    expect(screen.getByText(/至少记录 2 天数据后/)).toBeInTheDocument()
    expect(captured.chartData).toBeNull() // LineChart 根本没收到数据

    // 历史表格不聚合，两条都在
    expect(historyRows(container)).toHaveLength(2)
    expect(screen.getByText('2 条')).toBeInTheDocument()
  })

  it('同天两条 + 前一天一条：图表数据源 2 个点，同天点取最后一条；表格 3 行', () => {
    const { container } = renderBodyData([
      { date: day(0), time: '08:00', weight: 72.0, bodyFat: 18.2 },
      { date: day(2), time: '09:00', weight: 71.5, bodyFat: 17.8 },
      { date: day(0), time: '20:00', weight: 73.5, bodyFat: 19.1 },
    ])

    // 3 条记录 → 图上只有 2 个点（前一天 1 个 + 当天聚合 1 个）
    expect(captured.chartData).not.toBeNull()
    expect(captured.chartData).toHaveLength(2)

    // 当天的点只剩 1 个，取 20:00 那条（体重/体脂均为后者）
    const todayLabel = format(new Date(`${day(0)}T00:00:00`), 'M/d')
    const todayPoints = captured.chartData!.filter((p) => p.date === todayLabel)
    expect(todayPoints).toHaveLength(1)
    expect(todayPoints[0]).toEqual({ date: todayLabel, 体重: 73.5, 体脂: 19.1 })

    // 历史表格不丢记录：3 行都在
    expect(historyRows(container)).toHaveLength(3)
    expect(screen.getByText('3 条')).toBeInTheDocument()
  })
})
