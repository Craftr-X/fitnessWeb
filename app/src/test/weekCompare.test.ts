import { describe, it, expect } from 'vitest'
import { addDays, format, startOfWeek, subDays } from 'date-fns'
import { compareWeeks } from '@/lib/weekCompare'
import type {
  ActivityMap,
  CheckMap,
  DayPlan,
  WeekFeedback,
  WeekPlan,
  WeightEntry,
} from '@/types'

/**
 * 「本周 vs 上周」对比纯函数。
 * 日期一律用当前真实时间的本周周一构造，保证用例在任何日期运行都成立。
 */
const monday = format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd')
const prevSunday = format(subDays(new Date(`${monday}T00:00:00`), 1), 'yyyy-MM-dd')
const today = format(new Date(), 'yyyy-MM-dd')

/** 3 个训练日 × 每日 2 个动作 = 6 项，其余休息 */
function makePlan(week: number, startDate: string): WeekPlan {
  const days: DayPlan[] = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'].map(
    (day, i) => ({
      day,
      focus: i < 3 ? `训练 ${i + 1}` : '休息',
      type: (i < 3 ? 'strength' : 'rest') as DayPlan['type'],
      exercises:
        i < 3
          ? [
              { name: '哑铃卧推', sets: '3 组 × 8-12 次' },
              { name: '哑铃划船', sets: '3 组 × 8-12 次' },
            ]
          : [],
    }),
  )
  return { week, startDate, days, adjustmentNote: '' }
}

function makeFeedback(week: number, completion: number): WeekFeedback {
  return {
    week,
    date: format(subDays(new Date(`${monday}T00:00:00`), 7), 'yyyy-MM-dd'),
    completion,
    difficulty: 3,
    soreness: [],
    sleep: 'good',
    diet: 'good',
    note: '',
  }
}

/** 周二/周三/周四各勾 1 项 → 完成度 3/6=50%，训练天数 3 */
const THREE_DAY_CHECKS: CheckMap = { '2:0:0': true, '2:1:0': true, '2:2:0': true }

function run(overrides?: {
  weekPlan?: WeekPlan
  checks?: CheckMap
  feedbacks?: WeekFeedback[]
  weights?: WeightEntry[]
  activity?: ActivityMap
}) {
  return compareWeeks({
    weekPlan: overrides?.weekPlan ?? makePlan(2, monday),
    checks: overrides?.checks ?? {},
    feedbacks: overrides?.feedbacks ?? [],
    weights: overrides?.weights ?? [],
    activity: overrides?.activity ?? {},
  })
}

describe('compareWeeks', () => {
  it('第 1 周：hasPrevious 恒为 false，各字段按实际数据返回', () => {
    const r = run({
      weekPlan: makePlan(1, monday),
      checks: { '1:0:0': true, '1:0:1': true },
      weights: [{ date: today, weight: 72.5 }],
    })
    expect(r.hasPrevious).toBe(false)
    expect(r.completion).toEqual({ current: 33, previous: null }) // 2/6 四舍五入
    expect(r.trainedDays).toEqual({ current: 1, previous: 0 })
    expect(r.weight).toEqual({ current: 72.5, previous: null })
  })

  it('有上周反馈：completion.previous 取 feedbacks[week-1].completion', () => {
    const r = run({ feedbacks: [makeFeedback(1, 75)], checks: THREE_DAY_CHECKS })
    expect(r.completion).toEqual({ current: 50, previous: 75 })
    expect(r.hasPrevious).toBe(true)
  })

  it('上周无 activity、本周有打卡：trainedDays = { current: 3, previous: 0 }（0 是真实值）', () => {
    const r = run({
      checks: THREE_DAY_CHECKS,
      activity: { [today]: 2 }, // 本周的 activity 也不该算进上周
    })
    expect(r.trainedDays).toEqual({ current: 3, previous: 0 })
  })

  it('体重只有一条且在本周内：weight.previous = null', () => {
    const r = run({
      feedbacks: [makeFeedback(1, 60)],
      weights: [{ date: today, weight: 70.2 }],
    })
    expect(r.weight).toEqual({ current: 70.2, previous: null })
    // 但上周有反馈，整体仍可比
    expect(r.hasPrevious).toBe(true)
  })

  it('周边界：上周日（周一-1）算上周，本周一不算', () => {
    const nextMonday = format(addDays(new Date(`${monday}T00:00:00`), 7), 'yyyy-MM-dd')
    const r = run({
      activity: { [prevSunday]: 3, [monday]: 5, [nextMonday]: 4 },
      weights: [
        { date: prevSunday, weight: 71.0 },
        { date: today, weight: 72.4 },
      ],
    })
    // 只有上周日计入上周
    expect(r.trainedDays.previous).toBe(1)
    // 上周体重取上周日那条，本周取今天这条；本周一（无记录）不会成为分界问题
    expect(r.weight).toEqual({ current: 72.4, previous: 71.0 })
  })
})
