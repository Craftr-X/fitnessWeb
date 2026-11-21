import { describe, expect, it } from 'vitest'
import type { ExerciseLogRecord, WorkoutSet } from '@/types'
import {
  allTimeMaxWeight,
  isNewPr,
  isPrPoint,
  recentMaxWeightPoints,
  sessionMaxWeight,
} from '@/lib/setLogTrend'

const rec = (date: string, sets: WorkoutSet[]): ExerciseLogRecord => ({
  date,
  week: 1,
  sets,
})

describe('sessionMaxWeight', () => {
  it('多组取最大 weightKg', () => {
    expect(
      sessionMaxWeight([
        { weightKg: 50, reps: 10 },
        { weightKg: 62.5, reps: 5 },
        { weightKg: 60, reps: 8 },
      ]),
    ).toBe(62.5)
  })

  it('全无有效重量则 null', () => {
    expect(sessionMaxWeight([{ weightKg: null, reps: 12 }])).toBeNull()
    expect(sessionMaxWeight([{ weightKg: 0, reps: 10 }])).toBeNull()
    expect(sessionMaxWeight([])).toBeNull()
  })
})

describe('recentMaxWeightPoints', () => {
  const records: ExerciseLogRecord[] = [
    rec('2026-01-01', [{ weightKg: 40, reps: 10 }]),
    rec('2026-01-05', [{ weightKg: null, reps: 15 }]),
    rec('2026-01-10', [{ weightKg: 50, reps: 8 }]),
    rec('2026-01-15', [{ weightKg: 55, reps: 6 }]),
    rec('2026-01-20', [{ weightKg: 52.5, reps: 5 }]),
    rec('2026-01-25', [{ weightKg: 60, reps: 3 }]),
  ]

  it('仅 date < beforeDate，按日期升序返回，最多 n 点', () => {
    const out = recentMaxWeightPoints(records, '2026-01-22', 3)
    expect(out).toEqual([
      { date: '2026-01-10', maxWeight: 50 },
      { date: '2026-01-15', maxWeight: 55 },
      { date: '2026-01-20', maxWeight: 52.5 },
    ])
  })

  it('从新到旧取点，跳过无重量场次', () => {
    const out = recentMaxWeightPoints(records, '2026-02-01', 5)
    expect(out.map((p) => p.date)).toEqual([
      '2026-01-01',
      '2026-01-10',
      '2026-01-15',
      '2026-01-20',
      '2026-01-25',
    ])
    expect(out[4].maxWeight).toBe(60)
  })

  it('beforeDate 之前无记录时返回空数组', () => {
    expect(recentMaxWeightPoints(records, '2026-01-01')).toEqual([])
  })
})

describe('allTimeMaxWeight', () => {
  it('全历史场次最大重量', () => {
    const records = [
      rec('2026-01-01', [{ weightKg: 80, reps: 5 }]),
      rec('2026-01-10', [{ weightKg: 100, reps: 3 }]),
      rec('2026-01-15', [{ weightKg: 90, reps: 4 }]),
    ]
    expect(allTimeMaxWeight(records)).toBe(100)
  })

  it('无有效重量记录时返回 0', () => {
    expect(allTimeMaxWeight([])).toBe(0)
    expect(allTimeMaxWeight([rec('2026-01-01', [{ weightKg: null, reps: 10 }])])).toBe(0)
  })
})

describe('isPrPoint', () => {
  it('weight > 0 且 weight >= allTimeMax 为 PR（含持平）', () => {
    expect(isPrPoint(100, 100)).toBe(true)
    expect(isPrPoint(100.5, 100)).toBe(true)
  })

  it('未破纪录或无效重量为 false', () => {
    expect(isPrPoint(99, 100)).toBe(false)
    expect(isPrPoint(0, 0)).toBe(false)
    expect(isPrPoint(-1, 0)).toBe(false)
  })
})

describe('isNewPr', () => {
  it('仅当 newSessionMax 严格大于 prevAllTimeMax', () => {
    expect(isNewPr(100, 100.5)).toBe(true)
    expect(isNewPr(100, 100)).toBe(false)
    expect(isNewPr(100, 99)).toBe(false)
  })
})