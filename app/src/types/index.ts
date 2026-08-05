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
  time?: string // HH:mm，同一天可记录多次（如早/晚各一次），缺省视为较早记录
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

// —— onboarding 收集的画像枚举（v2 新增，全部可选以兼容老数据）——
export type Gender = 'male' | 'female'
/** 体重目标：增肌 / 减脂 / 塑形（减脂+增肌）/ 保持 */
export type WeightGoal = 'gain' | 'lose' | 'recomp' | 'maintain'
/** 可用器械：无器械 / 哑铃（含弹力带）/ 健身房 */
export type Equipment = 'none' | 'dumbbell' | 'gym'
/** 训练经验：新手 / 进阶 */
export type Experience = 'beginner' | 'intermediate'
/** 专项运动偏好 */
export type Sport = 'badminton' | 'running' | 'cycling' | 'none'

export interface Profile {
  name: string
  heightCm: number
  /** 已完成 onboarding；区分新老用户、判断是否进入引导 */
  onboarded?: boolean
  gender?: Gender
  age?: number
  weightKg?: number
  weightGoal?: WeightGoal
  experience?: Experience
  /** 每周训练天数 3-6 */
  trainDaysPerWeek?: number
  equipment?: Equipment
  sport?: Sport
  sportHours?: number
  /** 伤病 / 不适部位备注（多选） */
  injuries?: string[]
}

export type CheckMap = Record<string, boolean>
