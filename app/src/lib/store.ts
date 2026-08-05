import { useCallback, useEffect, useRef, useState } from 'react'
import { addDays, differenceInCalendarWeeks, format, startOfWeek } from 'date-fns'
import type { CheckMap, DayPlan, Profile, WeekFeedback, WeekPlan, WeightEntry } from '@/types'
import type { WeightGoal } from '@/types'
import { loadUserData, readLegacyData, saveUserData } from '@/lib/sync'

export const LS_KEYS = {
  profile: 'fitup:profile',
  weekPlan: 'fitup:weekPlan',
  checks: 'fitup:checks',
  weights: 'fitup:weights',
  feedback: 'fitup:feedback',
}

/** 登录用户的本地缓存 key（整文档，按用户隔离） */
export const cloudCacheKey = (userId: string) => `fitup:u:${userId}`

/** 体重目标的中文展示（Home 头部 / Onboarding / planEngine 共享） */
export const WEIGHT_GOAL_LABEL: Record<WeightGoal, string> = {
  gain: '增肌',
  lose: '减脂',
  recomp: '塑形',
  maintain: '保持',
}

export const DEFAULT_PROFILE: Profile = {
  name: '我',
  heightCm: 163,
}

export function currentMonday(): string {
  return format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd')
}

/**
 * 计算两个周一日期字符串（yyyy-MM-dd）之间相隔的自然周数（向下取 0）。
 * 以周一为一周起点：to 早于 from 时返回 0，否则返回完整跨过的周数。
 * 用于跨周补齐——用户多周未打开 App 时，一次性推进到当前周。
 */
export function weeksBetween(from: string, to: string): number {
  const fromD = new Date(from + 'T00:00:00')
  const toD = new Date(to + 'T00:00:00')
  if (Number.isNaN(fromD.getTime()) || Number.isNaN(toD.getTime())) return 0
  return Math.max(
    0,
    differenceInCalendarWeeks(toD, fromD, { weekStartsOn: 1 }),
  )
}

/**
 * 根据周数生成一周计划。
 * 进阶策略（渐进超负荷）：随周数提升次数/组数上限；
 * difficulty 为上周反馈难度(1-5)，>=4 保持不加量，<=2 额外加一点。
 */
export function buildWeekPlan(week: number, difficulty?: number): WeekPlan {
  // 每 2 周一个台阶，最多 +4 次 / +1 组
  const step = Math.min(Math.floor((week - 1) / 2), 4)
  let extra = step
  let note = `第 ${week} 周：在前一阶段基础上动作次数 +${step}（渐进超负荷）。`
  if (difficulty !== undefined) {
    if (difficulty >= 4) {
      extra = Math.max(0, step - 1)
      note = `上周反馈偏难（${difficulty}/5），本周降低进阶幅度，先把动作做标准。`
    } else if (difficulty <= 2) {
      extra = step + 1
      note = `上周反馈较轻松（${difficulty}/5），本周适度加量，可以试试更重的哑铃。`
    } else {
      note = `上周难度适中（${difficulty}/5），本周按计划正常进阶（次数 +${step}）。`
    }
  }
  const r = (base: number) => base + extra // 次数进阶
  const addSet = week >= 5 && (difficulty === undefined || difficulty <= 3)

  const days: DayPlan[] = [
    {
      day: '周一',
      focus: '胸 + 三头肌',
      type: 'strength',
      tip: '增肌重点日。俯卧撑若太轻松，把脚垫高或背个小书包负重。',
      exercises: [
        { name: '热身：开合跳 + 肩胸动态拉伸', sets: '5 分钟' },
        { name: '俯卧撑（跪姿可退阶）', sets: `${addSet ? 4 : 3} 组 × ${r(8)}-${r(12)} 次`, note: '胸触地、核心收紧' },
        { name: '上斜俯卧撑 / 哑铃上斜卧推', sets: `3 组 × ${r(10)} 次`, note: '手撑床沿/凳子练上胸' },
        { name: '哑铃飞鸟（或毛巾飞鸟）', sets: `3 组 × ${r(12)} 次`, note: '感受胸部挤压' },
        { name: '凳上臂屈伸', sets: `3 组 × ${r(10)} 次`, note: '练三头，瘦手臂先练它' },
        { name: '胸部 + 三头静态拉伸', sets: '3 分钟' },
      ],
    },
    {
      day: '周二',
      focus: '休息 / 主动恢复',
      type: 'rest',
      tip: '肌肉在休息时生长。散步 20-30 分钟 + 全身拉伸即可。',
      exercises: [
        { name: '散步或轻松骑车', sets: '20-30 分钟' },
        { name: '全身拉伸（重点胸肩）', sets: '10 分钟' },
      ],
    },
    {
      day: '周三',
      focus: '背 + 二头肌',
      type: 'strength',
      tip: '背是上身视觉宽度的关键。没有单杠就用哑铃划船替代引体。',
      exercises: [
        { name: '热身：弹力带/毛巾绕肩 + 猫式伸展', sets: '5 分钟' },
        { name: '单臂哑铃划船', sets: `${addSet ? 4 : 3} 组 × 每侧 ${r(10)} 次`, note: '可用装满水的水瓶替代' },
        { name: '俯身哑铃划船', sets: `3 组 × ${r(12)} 次` },
        { name: '俯身反向飞鸟（练后束+上背）', sets: `3 组 × ${r(12)} 次`, note: '改善圆肩体态' },
        { name: '哑铃弯举', sets: `3 组 × ${r(12)} 次` },
        { name: '背部 + 二头静态拉伸', sets: '3 分钟' },
      ],
    },
    {
      day: '周四',
      focus: '休息 / 轻有氧（可选）',
      type: 'rest',
      tip: '为明天的肩部训练和周六羽毛球储备体力。',
      exercises: [{ name: '可选：快走 20 分钟', sets: '轻松配速' }],
    },
    {
      day: '周五',
      focus: '肩 + 核心',
      type: 'strength',
      tip: '宽肩能让上身立刻显壮。侧平举用小重量多次数效果最好。',
      exercises: [
        { name: '热身：肩部环绕 + 招财猫式', sets: '5 分钟' },
        { name: '哑铃肩上推举', sets: `${addSet ? 4 : 3} 组 × ${r(10)} 次`, note: '可坐椅子上做' },
        { name: '哑铃侧平举', sets: `3 组 × ${r(15)} 次`, note: '小重量、慢速、到肩高' },
        { name: '俯身侧平举（后束）', sets: `3 组 × ${r(12)} 次` },
        { name: '平板支撑', sets: `3 组 × ${45 + extra * 5} 秒` },
        { name: '卷腹', sets: `3 组 × ${r(15)} 次` },
        { name: '肩部拉伸', sets: '3 分钟' },
      ],
    },
    {
      day: '周六',
      focus: '羽毛球日（3 小时高强度）',
      type: 'sport',
      tip: '高强度羽毛球已充分锻炼下肢与心肺，所以平时不额外安排腿部大重量。注意补水和碳水。',
      exercises: [
        { name: '动态热身（重点踝关节、肩）', sets: '10 分钟' },
        { name: '羽毛球对抗', sets: '3 小时', note: '中途每 30-40 分钟补水' },
        { name: '赛后静态拉伸（小腿、肩、手腕）', sets: '10 分钟' },
      ],
    },
    {
      day: '周日',
      focus: '完全休息 + 本周复盘',
      type: 'rest',
      tip: '睡够 7-9 小时。记得称体重、填写本周反馈，然后生成下周计划。',
      exercises: [
        { name: '充足睡眠', sets: '7-9 小时' },
        { name: '填写本周反馈 & 生成下周计划', sets: '在"每周反馈"页完成' },
      ],
    },
  ]

  return { week, startDate: currentMonday(), days, adjustmentNote: note }
}

/** 原样复制当前计划为下一周：不做进阶调整，startDate 取下一个周一 */
export function copyWeekPlan(plan: WeekPlan): WeekPlan {
  const nextMonday = format(startOfWeek(addDays(new Date(), 7), { weekStartsOn: 1 }), 'yyyy-MM-dd')
  return {
    week: plan.week + 1,
    startDate: nextMonday,
    days: plan.days.map((d) => ({ ...d, exercises: d.exercises.map((e) => ({ ...e })) })),
    adjustmentNote: '沿用上周计划，未做进阶调整。',
  }
}

/**
 * 把 onboarding 采集的体重合并进 weights 数组（纯函数，便于单测）。
 *
 * - weightKg 无效（<=0）：原样返回，不写入
 * - 已有真实历史记录（length>1）：不动，由用户在 BodyData 页自行记录
 * - 只有默认占位 entry（length<=1）：
 *   - 占位 entry 非当天 → 在头部插入当天记录（保留占位作历史首点）
 *   - 占位 entry 恰好是当天 → 直接覆盖
 *
 * 这样首页 BMI / 热量 / 蛋白质（均读 weights 末项）能立即基于真实体重展示，
 * 而不是 defaultCloudState 的 50.5kg 占位值。
 */
export function mergeOnboardingWeight(
  prev: WeightEntry[],
  weightKg: number,
  today: string,
): WeightEntry[] {
  if (weightKg <= 0) return prev
  if (prev.length > 1) return prev
  const entry: WeightEntry = { date: today, weight: weightKg, bodyFat: null }
  // 占位 entry 恰是当天 → 直接覆盖（新用户首次进入的常见路径）
  // 占位 entry 非当天（如隔几天才完成 onboarding）→ 前插当天记录，保留占位作历史首点
  return prev.length === 1 && prev[0].date === today ? [entry] : [entry, ...prev]
}

/* ------------------------------------------------------------------ */
/* 新老用户判定：决定首页走 onboarding 引导 / 静默补标志 / 直接进主界面 */
/* ------------------------------------------------------------------ */

export interface UsageTrace {
  checks: CheckMap
  feedbacks: WeekFeedback[]
  weights: WeightEntry[]
  weekPlan: WeekPlan
}

export interface OnboardingState {
  ready: boolean
  onboarded: boolean | undefined
  trace: UsageTrace
}

/**
 * 是否有使用痕迹：任一维度非初始默认值即算。
 * 用于区分"真·新用户"和"账号体系上线前已有数据的老用户"。
 * weights.length>1：默认占位 entry 不算痕迹，至少 2 条才算。
 */
export function hasUsageTrace(trace: UsageTrace): boolean {
  return (
    Object.keys(trace.checks).length > 0 ||
    trace.feedbacks.length > 0 ||
    trace.weights.length > 1 ||
    trace.weekPlan.week > 1
  )
}

/**
 * 是否需要走 onboarding 引导：数据就绪 + 未 onboarded + 无任何使用痕迹（真·新用户）。
 */
export function needsOnboarding(state: OnboardingState): boolean {
  return state.ready && !state.onboarded && !hasUsageTrace(state.trace)
}

/**
 * 是否需要静默补 onboarded 标志：数据就绪 + 未 onboarded + 有使用痕迹（老用户）。
 * 与 needsOnboarding 互斥（一个要 trace，一个不要）。
 */
export function shouldBackfillOnboarded(state: OnboardingState): boolean {
  return state.ready && !state.onboarded && hasUsageTrace(state.trace)
}

/** 计算 BMI */
export function bmi(weightKg: number, heightCm: number): number {
  const m = heightCm / 100
  return weightKg / (m * m)
}

export function bmiLabel(v: number): string {
  if (v < 18.5) return '偏瘦'
  if (v < 24) return '正常'
  if (v < 28) return '超重'
  return '肥胖'
}

/** 每日蛋白质建议（增肌 1.6-2.0 g/kg） */
export function proteinRange(weightKg: number): [number, number] {
  return [Math.round(weightKg * 1.6), Math.round(weightKg * 2.0)]
}

/** 一个用户的全部应用状态（与远端 user_data.data 对应） */
export interface CloudState {
  profile: Profile
  weekPlan: WeekPlan
  checks: CheckMap
  weights: WeightEntry[]
  feedbacks: WeekFeedback[]
}

export type Setter<T> = (v: T | ((p: T) => T)) => void

export interface CloudStore {
  profile: [Profile, Setter<Profile>]
  weekPlan: [WeekPlan, Setter<WeekPlan>]
  checks: [CheckMap, Setter<CheckMap>]
  weights: [WeightEntry[], Setter<WeightEntry[]>]
  feedbacks: [WeekFeedback[], Setter<WeekFeedback[]>]
  /** 远端数据加载（或迁移）完成前为 false，界面应显示加载态 */
  ready: boolean
  /** 本次登录触发了旧本地数据迁移 */
  migrated: boolean
  /** 立即把最新状态写入云端（退出登录前调用，避免防抖窗口丢数据） */
  flush: () => Promise<void>
}

function defaultCloudState(): CloudState {
  return {
    profile: DEFAULT_PROFILE,
    weekPlan: buildWeekPlan(1),
    checks: {},
    weights: [{ date: format(new Date(), 'yyyy-MM-dd'), weight: 50.5, bodyFat: null }],
    feedbacks: [],
  }
}

function readCache(userId: string): CloudState | null {
  try {
    const raw = localStorage.getItem(cloudCacheKey(userId))
    if (raw == null) return null
    const data = JSON.parse(raw) as Partial<CloudState>
    return { ...defaultCloudState(), ...data }
  } catch {
    return null
  }
}

/**
 * 云端同步存储：登录用户的单一数据源。
 * 启动时先用本地缓存秒开，再拉远端覆盖；远端为空则自动迁移旧版本地数据。
 * 之后每次变更写缓存并防抖 800ms 同步到 Supabase。
 */
export function useCloudStorage(userId: string): CloudStore {
  const [state, setState] = useState<CloudState>(() => readCache(userId) ?? defaultCloudState())
  const [ready, setReady] = useState(false)
  const [migrated, setMigrated] = useState(false)
  const stateRef = useRef(state)
  useEffect(() => {
    stateRef.current = state
  }, [state])

  // 初次加载：远端优先；无远端数据时尝试迁移旧本地数据
  useEffect(() => {
    let cancelled = false
    void (async () => {
      const remote = await loadUserData(userId)
      if (cancelled) return
      if (remote && Object.values(remote).some((v) => v !== undefined)) {
        setState((prev) => ({ ...prev, ...remote }))
      } else {
        const legacy = readLegacyData()
        const next = { ...defaultCloudState(), ...readCache(userId), ...legacy }
        setState(next)
        if (legacy) setMigrated(true)
        await saveUserData(userId, next)
      }
      if (!cancelled) setReady(true)
    })()
    return () => {
      cancelled = true
    }
  }, [userId])

  // 变更持久化：本地缓存 + 防抖同步云端
  useEffect(() => {
    if (!ready) return
    try {
      localStorage.setItem(cloudCacheKey(userId), JSON.stringify(state))
    } catch {
      /* ignore */
    }
    const timer = setTimeout(() => {
      void saveUserData(userId, state)
    }, 800)
    return () => clearTimeout(timer)
  }, [state, ready, userId])

  const flush = useCallback(async () => {
    await saveUserData(userId, stateRef.current)
  }, [userId])

  const makeSetter = useCallback(
    <K extends keyof CloudState>(key: K): Setter<CloudState[K]> =>
      (v) =>
        setState((prev) => ({
          ...prev,
          [key]: typeof v === 'function' ? (v as (p: CloudState[K]) => CloudState[K])(prev[key]) : v,
        })),
    [],
  )

  return {
    profile: [state.profile, makeSetter('profile')],
    weekPlan: [state.weekPlan, makeSetter('weekPlan')],
    checks: [state.checks, makeSetter('checks')],
    weights: [state.weights, makeSetter('weights')],
    feedbacks: [state.feedbacks, makeSetter('feedbacks')],
    ready,
    migrated,
    flush,
  }
}
