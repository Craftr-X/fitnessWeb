import { useCallback, useEffect, useRef, useState } from 'react'
import { addDays, differenceInCalendarWeeks, format, startOfWeek } from 'date-fns'
import type { CheckMap, DayPlan, Exercise, ExerciseLogMap, ExerciseLogRecord, LoadType, Profile, WeekFeedback, WeekPlan, WeightEntry } from '@/types'
import type { WeightGoal } from '@/types'
import { loadUserData, readLegacyData, saveUserData } from '@/lib/sync'

export const LS_KEYS = {
  profile: 'fitup:profile',
  weekPlan: 'fitup:weekPlan',
  checks: 'fitup:checks',
  weights: 'fitup:weights',
  feedback: 'fitup:feedback',
  setLogs: 'fitup:setLogs',
}

/** 登录用户的本地缓存 key（整文档，按用户隔离） */
export const cloudCacheKey = (userId: string) => `fitup:u:${userId}`

/** 未同步标记 key：本地有改动但尚未确认写入云端时置位（值为 '1'） */
export const cloudDirtyKey = (userId: string) => `fitup:u:${userId}:dirty`

export function isCloudDirty(userId: string): boolean {
  try {
    return localStorage.getItem(cloudDirtyKey(userId)) === '1'
  } catch {
    return false
  }
}

export function markCloudDirty(userId: string): void {
  try {
    localStorage.setItem(cloudDirtyKey(userId), '1')
  } catch {
    /* ignore */
  }
}

export function clearCloudDirty(userId: string): void {
  try {
    localStorage.removeItem(cloudDirtyKey(userId))
  } catch {
    /* ignore */
  }
}

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
        { name: '俯卧撑（跪姿可退阶）', sets: `${addSet ? 4 : 3} 组 × ${r(8)}-${r(12)} 次`, note: '胸触地、核心收紧', loadType: 'bodyweight' },
        { name: '上斜俯卧撑 / 哑铃上斜卧推', sets: `3 组 × ${r(10)} 次`, note: '手撑床沿/凳子练上胸', loadType: 'weighted' },
        { name: '哑铃飞鸟（或毛巾飞鸟）', sets: `3 组 × ${r(12)} 次`, note: '感受胸部挤压', loadType: 'weighted' },
        { name: '凳上臂屈伸', sets: `3 组 × ${r(10)} 次`, note: '练三头，瘦手臂先练它', loadType: 'bodyweight' },
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
        { name: '单臂哑铃划船', sets: `${addSet ? 4 : 3} 组 × 每侧 ${r(10)} 次`, note: '可用装满水的水瓶替代', loadType: 'weighted' },
        { name: '俯身哑铃划船', sets: `3 组 × ${r(12)} 次`, loadType: 'weighted' },
        { name: '俯身反向飞鸟（练后束+上背）', sets: `3 组 × ${r(12)} 次`, note: '改善圆肩体态', loadType: 'weighted' },
        { name: '哑铃弯举', sets: `3 组 × ${r(12)} 次`, loadType: 'weighted' },
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
        { name: '哑铃肩上推举', sets: `${addSet ? 4 : 3} 组 × ${r(10)} 次`, note: '可坐椅子上做', loadType: 'weighted' },
        { name: '哑铃侧平举', sets: `3 组 × ${r(15)} 次`, note: '小重量、慢速、到肩高', loadType: 'weighted' },
        { name: '俯身侧平举（后束）', sets: `3 组 × ${r(12)} 次`, loadType: 'weighted' },
        { name: '平板支撑', sets: `3 组 × ${45 + extra * 5} 秒`, loadType: 'timed' },
        { name: '卷腹', sets: `3 组 × ${r(15)} 次`, loadType: 'bodyweight' },
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
/* 训记式重量记录：解析计划组数、按动作名存取历史记录                  */
/* ------------------------------------------------------------------ */

/** 每个动作名最多保留的历史记录条数（防止云端文档无限增长） */
export const EXERCISE_LOG_CAP = 30

export interface SetTarget {
  /** 计划组数 */
  count: number
  /** 计划每组目标描述，如 "8-12 次"、"45 秒"、"每侧 10 次" */
  repsHint: string
}

/**
 * 解析 Exercise.sets 描述中的组数目标。
 * "3 组 × 8-12 次" → { count: 3, repsHint: "8-12 次" }；
 * "5 分钟"、"3 小时" 这类纯时长描述 → null（该动作不适合按组记重量）。
 */
export function parseSetTarget(sets: string): SetTarget | null {
  const m = sets.match(/(\d+)\s*组\s*[×xX*]?\s*(.*)/)
  if (!m) return null
  const count = parseInt(m[1], 10)
  if (!Number.isFinite(count) || count <= 0) return null
  return { count, repsHint: m[2].trim() }
}

/** 名称中含这些关键词的动作按负重处理（用于旧数据缺 loadType 时的兜底推断） */
const WEIGHTED_KEYWORDS =
  /(哑铃|杠铃|绳索|蝴蝶机|高位下拉|腿举|牧师椅|飞鸟|划船|卧推|推举|弯举|硬拉|负重|俄罗斯转体)/

/**
 * 推断动作负荷类型（结构化字段 loadType 优先）：
 * - sets 描述含"秒" → timed（平板支撑等）
 * - 名称含负重关键词 → weighted；明显的自重例外（毛巾/装水水瓶/引体/悬垂举腿等）→ bodyweight
 * - 其余 → bodyweight（保守：宁可少记重量，不强迫自重动作填重量）
 */
export function inferLoadType(ex: Exercise): LoadType {
  if (ex.loadType) return ex.loadType
  if (ex.sets.includes('秒')) return 'timed'
  // 明显的自重例外优先于关键词：毛巾/水瓶开头、引体、悬垂举腿
  //（"哑铃飞鸟（或毛巾飞鸟）"开头是哑铃，不受影响）
  if (/^(毛巾)/.test(ex.name) || /(水瓶|引体向上|悬垂举腿)/.test(ex.name)) return 'bodyweight'
  if (WEIGHTED_KEYWORDS.test(ex.name)) return 'weighted'
  return 'bodyweight'
}

/**
 * 写入某动作某一天的记录：同一天覆盖，否则按日期升序插入，超出上限裁掉最旧的。
 * 传入 weekStart（本周一 yyyy-MM-dd）时，丢弃早于本周的记录——产品决策：
 * 重量记录暂时只保留当前周数据。
 */
export function upsertExerciseLog(
  map: ExerciseLogMap,
  name: string,
  record: ExerciseLogRecord,
  weekStart?: string,
): ExerciseLogMap {
  const list = map[name] ?? []
  const idx = list.findIndex((r) => r.date === record.date)
  let next =
    idx >= 0
      ? list.map((r, i) => (i === idx ? record : r))
      : [...list, record].sort((a, b) => (a.date < b.date ? -1 : 1))
  if (weekStart) next = next.filter((r) => r.date >= weekStart)
  return { ...map, [name]: next.slice(-EXERCISE_LOG_CAP) }
}

/** 取某动作某一天的记录（没有则 undefined） */
export function getLogForDate(
  map: ExerciseLogMap,
  name: string,
  date: string,
): ExerciseLogRecord | undefined {
  return map[name]?.find((r) => r.date === date)
}

/** 取某动作在指定日期之前最近一次的训练记录（用于"上次重量"预填） */
export function getLastLogBefore(
  map: ExerciseLogMap,
  name: string,
  date: string,
): ExerciseLogRecord | undefined {
  const list = map[name]
  if (!list) return undefined
  for (let i = list.length - 1; i >= 0; i--) {
    if (list[i].date < date) return list[i]
  }
  return undefined
}

export interface ExerciseWeekStats {
  /** 单次训练最大容量 kg（Σ 重量×次数；无重量记录为 0） */
  maxVolume: number
  /** 单组最大重量 kg */
  maxWeight: number
  /** 最佳 1RM 预测 kg（Epley 公式：重量 × (1 + 次数/30)，需重量和次数都填） */
  best1RM: number
  /** 总次数（自重/时间类动作的统计维度；timed 动作即总秒数） */
  totalReps: number
  /** 单组最多次数（timed 动作即单组最长秒数） */
  maxReps: number
}

/**
 * 汇总一组训练记录的纪录数据（对齐训记"图表"页：容量 / 重量 / 1RM + 自重次数维度）。
 * 通常传入本周记录；空数组返回全 0。
 */
export function exerciseWeekStats(records: ExerciseLogRecord[]): ExerciseWeekStats {
  let maxVolume = 0
  let maxWeight = 0
  let best1RM = 0
  let totalReps = 0
  let maxReps = 0
  for (const rec of records) {
    let volume = 0
    for (const s of rec.sets) {
      const w = s.weightKg ?? 0
      const r = s.reps ?? 0
      volume += w * r
      totalReps += r
      if (r > maxReps) maxReps = r
      if (w > maxWeight) maxWeight = w
      if (s.weightKg != null && s.reps != null && s.reps > 0) {
        const e1rm = s.weightKg * (1 + s.reps / 30)
        if (e1rm > best1RM) best1RM = e1rm
      }
    }
    if (volume > maxVolume) maxVolume = volume
  }
  // 1RM 保留 1 位小数（Epley 会产出长小数）；容量/重量本身来自用户输入，原样返回
  return { maxVolume, maxWeight, best1RM: Math.round(best1RM * 10) / 10, totalReps, maxReps }
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
  setLogs: ExerciseLogMap
}

export type Setter<T> = (v: T | ((p: T) => T)) => void

export interface CloudStore {
  profile: [Profile, Setter<Profile>]
  weekPlan: [WeekPlan, Setter<WeekPlan>]
  checks: [CheckMap, Setter<CheckMap>]
  weights: [WeightEntry[], Setter<WeightEntry[]>]
  feedbacks: [WeekFeedback[], Setter<WeekFeedback[]>]
  setLogs: [ExerciseLogMap, Setter<ExerciseLogMap>]
  /** 远端数据加载（或迁移）完成前为 false，界面应显示加载态 */
  ready: boolean
  /** 本次登录触发了旧本地数据迁移 */
  migrated: boolean
  /** 立即把最新状态写入云端（退出登录前调用，避免防抖窗口丢数据） */
  flush: () => Promise<void>
}

function defaultCloudState(): CloudState {
  return {
    // 浅拷贝：避免每个默认实例共享同一个模块级对象引用，
    // 防止某处误做 profile.xxx = y 时污染全局默认值
    profile: { ...DEFAULT_PROFILE },
    weekPlan: buildWeekPlan(1),
    checks: {},
    weights: [{ date: format(new Date(), 'yyyy-MM-dd'), weight: 50.5, bodyFat: null }],
    feedbacks: [],
    setLogs: {},
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
 *
 * 防丢数据：变更在防抖窗口内（或断网/保存失败时）只落了本地缓存，若下次启动
 * 直接让远端覆盖，这部分改动就丢了。因此每次变更先置「未同步标记」，保存成功
 * 才清除；启动时检测到标记就以本地缓存为准、跳过远端拉取，由持久化 effect 重推。
 * 注意整文档 last-write-wins：本机有未同步改动时，重推会覆盖期间其他设备的写入。
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
      // 本地有未确认同步的改动：缓存比远端新，跳过拉取（否则远端旧数据会覆盖
      // 新改动）。state 已由 useState 初始化读自缓存，直接 ready，交给下面的
      // 持久化 effect 重推并清标记。缓存缺失（如被单独清除）时退回正常路径。
      if (isCloudDirty(userId) && readCache(userId)) {
        if (!cancelled) setReady(true)
        return
      }
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
    // 先置未同步标记，保存成功后才清除：标记存在即代表"缓存里有云端还没有的数据"
    markCloudDirty(userId)
    const snapshot = state
    const timer = setTimeout(() => {
      void saveUserData(userId, snapshot).then((ok) => {
        // 保存期间又有了新变更（stateRef 已指向更新的状态）时不能清标记：
        // 新一轮防抖保存会负责清，或由下次启动重推
        if (ok && stateRef.current === snapshot) clearCloudDirty(userId)
      })
    }, 800)
    return () => clearTimeout(timer)
  }, [state, ready, userId])

  const flush = useCallback(async () => {
    const snapshot = stateRef.current
    const ok = await saveUserData(userId, snapshot)
    if (ok && stateRef.current === snapshot) clearCloudDirty(userId)
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
    setLogs: [state.setLogs, makeSetter('setLogs')],
    ready,
    migrated,
    flush,
  }
}
