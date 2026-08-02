export interface Exercise {
  name: string
  sets: string
  note?: string
}

export interface DayPlan {
  day: string // 周一 ~ 周日
  focus: string
  type: 'strength' | 'sport' | 'rest' | 'recovery'
  exercises: Exercise[]
  tip?: string
}

export interface WeekPlan {
  week: number
  startDate: string // ISO date of 周一
  days: DayPlan[]
  adjustmentNote: string // 本周计划相对上周的调整说明
}

export interface WeightEntry {
  date: string // YYYY-MM-DD
  weight: number
  bodyFat?: number | null
}

export interface WeekFeedback {
  week: number
  date: string
  completion: number // 0-100
  difficulty: number // 1-5
  soreness: string[]
  sleep: string
  diet: string
  note: string
}

export interface Profile {
  name: string
  heightCm: number
  badmintonHours: number
  goal: string
}

export type CheckMap = Record<string, boolean>
