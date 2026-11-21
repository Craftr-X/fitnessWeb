import { format, subDays } from 'date-fns'
import type { ActivityMap, CheckMap, WeekFeedback, WeekPlan, WeightEntry } from '@/types'

/** 某指标的本周值与上周值；null 表示没有可显示的数据 */
export interface WeekStat {
  current: number | null
  previous: number | null
}

export interface WeekComparison {
  /** 上一周是否存在可比数据（第 1 周恒为 false） */
  hasPrevious: boolean
  /** 完成度 %：本周实时算；上周取 feedbacks[week-1].completion */
  completion: WeekStat
  /** 训练天数：本周按打卡的不同日统计；上周按 activity 统计 */
  trainedDays: WeekStat
  /** 体重 kg：本周最后一次 vs 本周开始前最后一次 */
  weight: WeekStat
}

/**
 * 「今日」页「第 N 周进度」卡的本周 vs 上周对比（纯函数）。
 *
 * 日期全部走 yyyy-MM-dd 字符串比较（startDate 是纯日期，直接 new Date(str)
 * 会有时区偏移风险）；只有「上周区间」的起止点用 date-fns 换算。
 */
export function compareWeeks(input: {
  weekPlan: WeekPlan
  checks: CheckMap
  feedbacks: WeekFeedback[]
  weights: WeightEntry[]
  activity: ActivityMap
}): WeekComparison {
  const { weekPlan, checks, feedbacks, weights, activity } = input

  const currentMonday = weekPlan.startDate
  const prevStart = format(subDays(new Date(`${currentMonday}T00:00:00`), 7), 'yyyy-MM-dd')
  const prevEnd = format(subDays(new Date(`${currentMonday}T00:00:00`), 1), 'yyyy-MM-dd')

  // 本周完成度：已打卡项 / 总项数（沿用 Overview 的 key 规则 `${week}:${dayIndex}:${exerciseIndex}`）
  let done = 0
  let total = 0
  const trainedDayIdx = new Set<number>()
  weekPlan.days.forEach((day, di) => {
    day.exercises.forEach((_, ei) => {
      total += 1
      if (checks[`${weekPlan.week}:${di}:${ei}`]) {
        done += 1
        trainedDayIdx.add(di)
      }
    })
  })
  const completionCurrent = total === 0 ? null : Math.round((done / total) * 100)
  const trainedDaysCurrent = trainedDayIdx.size

  // 上周训练天数：activity 是后来才上线的字段，老数据没有 → 0 属于正常
  let trainedDaysPrevious = 0
  for (const [date, count] of Object.entries(activity)) {
    if (count > 0 && date >= prevStart && date <= prevEnd) trainedDaysPrevious += 1
  }

  const completionPrevious =
    feedbacks.find((f) => f.week === weekPlan.week - 1)?.completion ?? null

  // 体重：weights 按日期升序，取区间内最后一条；"今天" 以本地日期字符串比较
  const today = format(new Date(), 'yyyy-MM-dd')
  const lastWithin = (predicate: (date: string) => boolean): WeightEntry | null => {
    let found: WeightEntry | null = null
    for (const w of weights) if (predicate(w.date)) found = w
    return found
  }
  const weightCurrent = lastWithin((d) => d <= today)?.weight ?? null
  const weightPrevious = lastWithin((d) => d < currentMonday)?.weight ?? null

  const hasPrevious =
    weekPlan.week > 1 &&
    (completionPrevious != null || trainedDaysPrevious > 0 || weightPrevious != null)

  return {
    hasPrevious,
    completion: { current: completionCurrent, previous: completionPrevious },
    trainedDays: { current: trainedDaysCurrent, previous: trainedDaysPrevious },
    weight: { current: weightCurrent, previous: weightPrevious },
  }
}
