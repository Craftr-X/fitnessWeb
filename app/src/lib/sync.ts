import { supabase } from '@/lib/supabase'
import { cleanExerciseLogMap, LS_KEYS } from '@/lib/store'
import type { ActivityMap, CheckMap, ExerciseLogMap, Profile, WeekFeedback, WeekPlan, WeightEntry } from '@/types'

/** 一个用户的全部应用数据（整文档存储在 user_data.data jsonb 中） */
export interface UserData {
  profile?: Profile
  weekPlan?: WeekPlan
  checks?: CheckMap
  weights?: WeightEntry[]
  feedbacks?: WeekFeedback[]
  setLogs?: ExerciseLogMap
  /** 每日训练活跃度（训练日历数据源；老文档缺省，读侧用默认 {} 兜底） */
  activity?: ActivityMap
}

/** 单次读取的超时（毫秒）：线上遇到过请求挂住，页面永久停在「正在同步」 */
export const LOAD_TIMEOUT_MS = 8000

/** 给 thenable 套一层超时；超时后原请求即使迟到达也被忽略 */
function withTimeout<T>(thenable: PromiseLike<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`加载超时（${ms}ms）`)), ms)
    Promise.resolve(thenable).then(
      (v) => {
        clearTimeout(timer)
        resolve(v)
      },
      (e) => {
        clearTimeout(timer)
        reject(e)
      },
    )
  })
}

/**
 * 拉取远端数据。
 * - 返回 null = 确认没有这行数据（新用户）
 * - 抛错 = 读取失败（断网 / 超时 / RLS 拒绝）
 *
 * 这两者必须区分开：调用方拿到 null 会写入一份默认状态，如果"读取失败"也返回 null，
 * 一次网络抖动就会用默认值覆盖掉云端真实数据。
 */
export async function loadUserData(userId: string, timeoutMs: number = LOAD_TIMEOUT_MS): Promise<UserData | null> {
  if (!supabase) return null
  type Row = { data: UserData | null }
  const query = supabase
    .from('user_data')
    .select('data')
    .eq('user_id', userId)
    .maybeSingle() as unknown as PromiseLike<{ data: Row | null; error: { message: string } | null }>
  const { data, error } = await withTimeout(query, timeoutMs)
  if (error) throw new Error(error.message)
  const remote = (data?.data as UserData) ?? null
  if (remote?.setLogs) remote.setLogs = cleanExerciseLogMap(remote.setLogs)
  return remote
}

/** 整文档 upsert 到远端 */
export async function saveUserData(userId: string, data: UserData): Promise<boolean> {
  if (!supabase) return false
  const { error } = await supabase
    .from('user_data')
    .upsert({ user_id: userId, data, updated_at: new Date().toISOString() })
  if (error) {
    console.error('[FitUp] 同步到云端失败：', error.message)
    return false
  }
  return true
}

function readLegacy<T>(key: string): T | undefined {
  try {
    const raw = localStorage.getItem(key)
    return raw != null ? (JSON.parse(raw) as T) : undefined
  } catch {
    return undefined
  }
}

/**
 * 读取账号体系上线前的旧 localStorage 数据（无前缀的 fitup:* key）。
 * 有任何有效数据则返回组装好的 UserData，否则返回 null。不删除旧 key，留作兜底。
 */
export function readLegacyData(): UserData | null {
  // 只收集实际存在的 key：缺省的字段不能写成 undefined，
  // 否则展开合并时会把默认值覆盖成 undefined（如 profile 缺失导致运行时崩溃）
  const data: UserData = {}
  const profile = readLegacy<Profile>(LS_KEYS.profile)
  if (profile !== undefined) data.profile = profile
  const weekPlan = readLegacy<WeekPlan>(LS_KEYS.weekPlan)
  if (weekPlan !== undefined) data.weekPlan = weekPlan
  const checks = readLegacy<CheckMap>(LS_KEYS.checks)
  if (checks !== undefined) data.checks = checks
  const weights = readLegacy<WeightEntry[]>(LS_KEYS.weights)
  if (weights !== undefined) data.weights = weights
  const feedbacks = readLegacy<WeekFeedback[]>(LS_KEYS.feedback)
  if (feedbacks !== undefined) data.feedbacks = feedbacks
  const setLogs = readLegacy<ExerciseLogMap>(LS_KEYS.setLogs)
  if (setLogs !== undefined) data.setLogs = cleanExerciseLogMap(setLogs)
  return Object.values(data).some((v) => v !== undefined) ? data : null
}
