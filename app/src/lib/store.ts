import { useCallback, useEffect, useRef, useState } from 'react'
import { differenceInCalendarWeeks, format, startOfWeek } from 'date-fns'
import type { CheckMap, Exercise, ExerciseLogMap, ExerciseLogRecord, LoadType, Profile, WeekFeedback, WeekPlan, WeightEntry, WorkoutSet } from '@/types'
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
  heightCm: 170,
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
 * 把 onboarding 采集的体重合并进 weights 数组（纯函数，便于单测）。
 *
 * - weightKg 无效（<=0）：原样返回，不写入
 * - 已有真实历史记录（length>=1）：不动，由用户在 BodyData 页自行记录
 * - 空（length===0）：直接插入当天 entry
 *
 * 这样首页 BMI / 热量 / 蛋白质（均读 weights 末项）能立即基于真实体重展示。
 */
export function mergeOnboardingWeight(
  prev: WeightEntry[],
  weightKg: number,
  today: string,
): WeightEntry[] {
  if (weightKg <= 0) return prev
  if (prev.length >= 1) return prev
  return [{ date: today, weight: weightKg, bodyFat: null }]
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
 * 剔除空组：次数为 0/未填、或重量恰为 0 的组视为无效。
 * 历史脏数据（校验上线前的本地测试数据、其他设备写入等）可能带这种组，
 * 会让摘要的「N组」计数与容量对不上。注意 {weightKg: null, reps: 10} 是合法的
 * 自重组——自重动作重量就是 null，只有 weightKg === 0 才算脏。
 */
export function pruneEmptySets(sets: WorkoutSet[]): WorkoutSet[] {
  return sets.filter((s) => (s.reps ?? 0) > 0 && s.weightKg !== 0)
}

/**
 * 清洗整份动作记录：剔空组、剔除清洗后一整条都空的记录、不留空键。
 * 数据没变化时原样返回（引用不变，不触发多余的重渲染和云端同步）。
 * 在读取（缓存/远端/旧版迁移）与写入（upsertExerciseLog）两侧都过一道，
 * 保证落库与展示的数据始终干净；已污染的云端数据会在下次保存时被自愈。
 */
export function cleanExerciseLogMap(map: ExerciseLogMap): ExerciseLogMap {
  let changed = false
  const out: ExerciseLogMap = {}
  for (const [name, list] of Object.entries(map)) {
    const cleaned = list
      .map((r) => {
        const sets = pruneEmptySets(r.sets)
        if (sets.length === r.sets.length) return r
        changed = true
        return { ...r, sets }
      })
      .filter((r) => r.sets.length > 0)
    if (cleaned.length !== list.length) changed = true
    if (cleaned.length > 0) out[name] = cleaned
  }
  return changed ? out : map
}

/**
 * 写入某动作某一天的记录：同一天覆盖，否则按日期升序插入，超出上限裁掉最旧的。
 * 传入 weekStart（本周一 yyyy-MM-dd）时，丢弃早于本周的记录——产品决策：
 * 重量记录暂时只保留当前周数据。空组在写入前剔除；整条皆空视为无效写入。
 */
export function upsertExerciseLog(
  map: ExerciseLogMap,
  name: string,
  record: ExerciseLogRecord,
  weekStart?: string,
): ExerciseLogMap {
  const sets = pruneEmptySets(record.sets)
  if (sets.length === 0) return map
  const clean = sets.length === record.sets.length ? record : { ...record, sets }
  const list = map[name] ?? []
  const idx = list.findIndex((r) => r.date === clean.date)
  let next =
    idx >= 0
      ? list.map((r, i) => (i === idx ? clean : r))
      : [...list, clean].sort((a, b) => (a.date < b.date ? -1 : 1))
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

/**
 * 删除某动作某一天的记录（用于"清除本次记录"重置当天重量/次数）。
 * 删完后该动作没有其他记录时连键一起移除，不留下空数组；没删到东西时原样返回。
 */
export function removeExerciseLog(map: ExerciseLogMap, name: string, date: string): ExerciseLogMap {
  const list = map[name]
  if (!list) return map
  const next = list.filter((r) => r.date !== date)
  if (next.length === list.length) return map
  const out = { ...map }
  if (next.length === 0) delete out[name]
  else out[name] = next
  return out
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
/* 新老用户判定：决定首页是否走 onboarding 引导、老用户迁移时是否预填   */
/* ------------------------------------------------------------------ */

export interface UsageTrace {
  checks: CheckMap
  feedbacks: WeekFeedback[]
  weights: WeightEntry[]
  weekPlan: WeekPlan
}

/**
 * 是否有使用痕迹：任一维度非初始默认值即算。
 * 用于区分"真·新用户"和"账号体系上线前已有数据的老用户"——
 * 老用户走 onboarding 软迁移时按已有画像预填。
 * weights.length>1：仅 onboarding 写入的 1 条不算痕迹，至少 2 条才算。
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
 * 是否需要走 onboarding 引导：数据就绪 + 未 onboarded。
 * 老用户（有使用痕迹）同样要走——onboarding 是生成计划的唯一入口，
 * 完成即把老模板计划软迁移为规则引擎计划（历史体重/反馈保留，旧打卡清空）。
 */
export function needsOnboarding(state: { ready: boolean; onboarded: boolean | undefined }): boolean {
  return state.ready && !state.onboarded
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

/**
 * 按体重目标判定体重变化方向是否符合预期（Overview delta 着色用）。
 * - 增肌：上涨为 good，下降为 bad
 * - 减脂：下降为 good，上涨为 bad
 * - 塑形/保持：方向中性（关注体脂/围度而非体重绝对值），返回 neutral
 * |delta|<0.01kg（浮点噪声）一律视为 neutral。
 */
export function weightDeltaTone(
  goal: WeightGoal | undefined,
  delta: number,
): 'good' | 'bad' | 'neutral' {
  if (Math.abs(delta) < 0.01) return 'neutral'
  switch (goal) {
    case 'gain':
      return delta > 0 ? 'good' : 'bad'
    case 'lose':
      return delta < 0 ? 'good' : 'bad'
    case 'recomp':
    case 'maintain':
      return 'neutral'
    default:
      return delta > 0 ? 'good' : 'bad'
  }
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
  /** 最近一次防抖同步是否失败（断网/超时等）。数据已暂存本地，下次启动会自动重推 */
  syncError: boolean
  /** 立即把最新状态写入云端（退出登录前调用，避免防抖窗口丢数据）。返回是否成功 */
  flush: () => Promise<boolean>
}

function defaultCloudState(): CloudState {
  return {
    // 浅拷贝：避免每个默认实例共享同一个模块级对象引用，
    // 防止某处误做 profile.xxx = y 时污染全局默认值
    profile: { ...DEFAULT_PROFILE },
    // 占位空计划：未 onboarding 的用户在 AppSplash 短暂看到此默认值，
    // onboarding 完成后由规则引擎写入真实计划（buildWeekPlanFromProfile）
    weekPlan: {
      week: 1,
      startDate: currentMonday(),
      days: Array.from({ length: 7 }, (_, i) => ({
        day: ['周一', '周二', '周三', '周四', '周五', '周六', '周日'][i],
        focus: '休息',
        type: 'rest' as const,
        exercises: [],
      })),
      adjustmentNote: '完成引导后生成你的专属计划。',
    },
    checks: {},
    weights: [],
    feedbacks: [],
    setLogs: {},
  }
}

function readCache(userId: string): CloudState | null {
  try {
    const raw = localStorage.getItem(cloudCacheKey(userId))
    if (raw == null) return null
    const data = JSON.parse(raw) as Partial<CloudState>
    const merged = { ...defaultCloudState(), ...data }
    merged.setLogs = cleanExerciseLogMap(merged.setLogs)
    return merged
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
  const [syncError, setSyncError] = useState(false)
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
        if (ok && stateRef.current === snapshot) {
          clearCloudDirty(userId)
          setSyncError(false)
        } else if (!ok) {
          setSyncError(true)
        }
        // ok=true 但 stateRef!==snapshot：新一轮防抖会负责，保持当前 syncError
      })
    }, 800)
    return () => clearTimeout(timer)
  }, [state, ready, userId])

  const flush = useCallback(async () => {
    const snapshot = stateRef.current
    const ok = await saveUserData(userId, snapshot)
    if (ok && stateRef.current === snapshot) {
      clearCloudDirty(userId)
      setSyncError(false)
    } else if (!ok) {
      setSyncError(true)
    }
    return ok
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
    syncError,
    flush,
  }
}
