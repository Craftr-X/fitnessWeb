import { describe, it, expect } from 'vitest'
import { describeChange, diffWeekPlans, groupChangesByDay, summarizePlanDiff } from '@/lib/planDiff'
import type { DayPlan, WeekPlan } from '@/types'

const day = (name: string, focus: string, exercises: { name: string; sets: string }[][]): DayPlan => ({
  day: name,
  focus,
  type: 'strength',
  exercises: exercises.flat() as DayPlan['exercises'],
})

const plan = (week: number, days: DayPlan[]): WeekPlan => ({
  week,
  startDate: '2026-11-02',
  days,
  adjustmentNote: '测试',
})

/** 3 组 → 2 组 的降量计划 */
const BASE: WeekPlan = plan(2, [
  day('周一', '推（胸 / 肩 / 三头）', [
    [
      { name: '热身：开合跳', sets: '5 分钟' },
      { name: '哑铃卧推', sets: '3 组 × 8-12 次' },
      { name: '哑铃肩上推举', sets: '3 组 × 10-12 次' },
    ],
  ]),
  day('周三', '拉（背 / 二头）', [
    [
      { name: '单臂哑铃划船', sets: '3 组 × 10-12 次' },
      { name: '哑铃弯举', sets: '3 组 × 12-15 次' },
    ],
  ]),
])

const LOWERED: WeekPlan = plan(2, [
  day('周一', '推（胸 / 肩 / 三头）', [
    [
      { name: '热身：开合跳', sets: '5 分钟' },
      { name: '哑铃卧推', sets: '2 组 × 8-12 次' },
      { name: '哑铃肩上推举', sets: '2 组 × 10-12 次' },
    ],
  ]),
  day('周三', '拉（背 / 二头）', [
    [
      { name: '单臂哑铃划船', sets: '2 组 × 10-12 次' },
      { name: '哑铃弯举', sets: '2 组 × 12-15 次' },
    ],
  ]),
])

describe('diffWeekPlans', () => {
  it('计划完全一致时无变化', () => {
    const d = diffWeekPlans(BASE, BASE)
    expect(d.changes).toEqual([])
    expect(d.direction).toBe('none')
    expect(d.dayCount).toBe(0)
    expect(summarizePlanDiff(d)).toContain('没有额外调整')
  })

  it('全部减 1 组：识别为降量，能算出动作数与总组数变化', () => {
    const d = diffWeekPlans(BASE, LOWERED)
    expect(d.changes).toHaveLength(4)
    expect(d.direction).toBe('down')
    expect(d.dayCount).toBe(2)
    expect(d.totalSetsDelta).toBe(-4)
    expect(d.changes.every((c) => c.field === 'sets' && c.setsDelta === -1)).toBe(true)
    expect(summarizePlanDiff(d)).toBe('训练量下调：4 个动作各减 1 组')
  })

  it('只变了次数区间（组数不变）记为 reps 变化', () => {
    const next = plan(2, [
      day('周一', '推（胸 / 肩 / 三头）', [
        [
          { name: '热身：开合跳', sets: '5 分钟' },
          { name: '哑铃卧推', sets: '3 组 × 10-14 次' },
          { name: '哑铃肩上推举', sets: '3 组 × 10-12 次' },
        ],
      ]),
      BASE.days[1],
    ])
    const d = diffWeekPlans(BASE, next)
    expect(d.changes).toHaveLength(1)
    expect(d.changes[0].field).toBe('reps')
    expect(d.changes[0].setsDelta).toBeUndefined()
    expect(describeChange(d.changes[0])).toBe('3 组 × 8-12 次 → 3 组 × 10-14 次')
  })

  it('动作被替换时记 exercise 变化，且不影响组数合计', () => {
    const next = plan(2, [
      day('周一', '推（胸 / 肩 / 三头）', [
        [
          { name: '热身：开合跳', sets: '5 分钟' },
          { name: '哑铃飞鸟', sets: '3 组 × 8-12 次' },
          { name: '哑铃肩上推举', sets: '3 组 × 10-12 次' },
        ],
      ]),
      BASE.days[1],
    ])
    const d = diffWeekPlans(BASE, next)
    expect(d.changes).toHaveLength(1)
    expect(d.changes[0].field).toBe('exercise')
    expect(d.changes[0].from).toBe('哑铃卧推')
    expect(d.changes[0].to).toBe('哑铃飞鸟')
    expect(d.totalSetsDelta).toBe(0)
  })

  it('有增有减时标为 mixed', () => {
    const next = plan(2, [
      day('周一', '推（胸 / 肩 / 三头）', [
        [
          { name: '热身：开合跳', sets: '5 分钟' },
          { name: '哑铃卧推', sets: '4 组 × 8-12 次' },
          { name: '哑铃肩上推举', sets: '2 组 × 10-12 次' },
        ],
      ]),
      BASE.days[1],
    ])
    const d = diffWeekPlans(BASE, next)
    expect(d.direction).toBe('mixed')
    expect(d.totalSetsDelta).toBe(0)
    expect(summarizePlanDiff(d)).toContain('调整了 2 处')
  })

  it('按天分组，保持周一在前的顺序', () => {
    const d = diffWeekPlans(BASE, LOWERED)
    const groups = groupChangesByDay(d)
    expect(groups.map((g) => g.day)).toEqual(['周一', '周三'])
    expect(groups[0].changes).toHaveLength(2)
  })
})
