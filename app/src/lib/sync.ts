import { supabase } from '@/lib/supabase'
import { cleanExerciseLogMap, LS_KEYS } from '@/lib/store'
import type { CheckMap, ExerciseLogMap, PhotoEntry, Profile, WeekFeedback, WeekPlan, WeightEntry } from '@/types'

/** 一个用户的全部应用数据（整文档存储在 user_data.data jsonb 中） */
export interface UserData {
  profile?: Profile
  weekPlan?: WeekPlan
  checks?: CheckMap
  weights?: WeightEntry[]
  feedbacks?: WeekFeedback[]
  setLogs?: ExerciseLogMap
  photos?: PhotoEntry[]
}

/** 拉取远端数据；没有行或出错时返回 null */
export async function loadUserData(userId: string): Promise<UserData | null> {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('user_data')
    .select('data')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) {
    console.error('[FitUp] 加载云端数据失败：', error.message)
    return null
  }
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
