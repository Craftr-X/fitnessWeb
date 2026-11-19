import type { ExerciseLogRecord, WorkoutSet } from '@/types'

export interface MaxWeightPoint {
  date: string
  maxWeight: number
}

/** 单场训练内最大重量 kg；无有效重量则 null */
export function sessionMaxWeight(sets: WorkoutSet[]): number | null {
  let max: number | null = null
  for (const s of sets) {
    const w = s.weightKg
    if (w != null && w > 0 && (max === null || w > max)) max = w
  }
  return max
}

/** beforeDate 之前最近 n 次有重量场次的日最大重量点，按日期升序 */
export function recentMaxWeightPoints(
  records: ExerciseLogRecord[],
  beforeDate: string,
  n = 5,
): MaxWeightPoint[] {
  const points: MaxWeightPoint[] = []
  for (let i = records.length - 1; i >= 0 && points.length < n; i--) {
    const rec = records[i]
    if (rec.date >= beforeDate) continue
    const maxWeight = sessionMaxWeight(rec.sets)
    if (maxWeight == null) continue
    points.push({ date: rec.date, maxWeight })
  }
  points.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
  return points
}

/** 全历史最大重量；无有效记录则为 0 */
export function allTimeMaxWeight(records: ExerciseLogRecord[]): number {
  let max = 0
  for (const rec of records) {
    const w = sessionMaxWeight(rec.sets)
    if (w != null && w > max) max = w
  }
  return max
}

/** 该点是否为历史 PR（含持平） */
export function isPrPoint(weight: number, allTimeMax: number): boolean {
  return weight > 0 && weight >= allTimeMax
}

/** 保存后是否刷新全历史最好重量（严格破纪录） */
export function isNewPr(prevAllTimeMax: number, newSessionMax: number): boolean {
  return newSessionMax > prevAllTimeMax
}