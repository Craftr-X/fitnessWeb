/** 动作负荷类型：负重（记重量+次数）/ 自重（只记次数）/ 时间（只记秒数） */
export type LoadType = 'weighted' | 'bodyweight' | 'timed'

export interface Exercise {
  name: string
  sets: string
  note?: string
  /** 负荷类型；缺省时由 inferLoadType 按名称/组次描述推断（兼容旧云端数据） */
  loadType?: LoadType
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

/** 一组的实际完成记录（训记式重量记录） */
export interface WorkoutSet {
  /** 实际使用重量 kg；null = 自重 / 未填 */
  weightKg: number | null
  /** 实际完成次数（时间类动作存秒数）；null = 未填 */
  reps: number | null
}

/** 某动作某一天的完整训练记录 */
export interface ExerciseLogRecord {
  date: string // YYYY-MM-DD
  week: number
  sets: WorkoutSet[]
}

/** 按动作名索引的历史记录，records 按日期升序，只保留最近若干条 */
export type ExerciseLogMap = Record<string, ExerciseLogRecord[]>

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

/* ------------------------------------------------------------------ */
/* 身材照片记录（历年体态对比）                                        */
/* ------------------------------------------------------------------ */

/** 拍摄角度：正面 / 侧面 / 背面 */
export type PhotoView = 'front' | 'side' | 'back'

/**
 * 一张身材照片的元数据。图片二进制存 Supabase Storage（私有 bucket + RLS），
 * 对象 key = `${userId}/${id}.jpg`；这里只存索引信息，随 user_data jsonb 同步。
 */
export interface PhotoEntry {
  id: string // crypto.randomUUID()，兼作 Storage 文件名
  date: string // YYYY-MM-DD 拍摄日期
  view: PhotoView // 正/侧/背
  note?: string
  createdAt: string // ISO，入库时间
}
