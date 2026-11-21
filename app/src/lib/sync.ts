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

/** 单次写入的超时（毫秒）：防止迁移分支的 await saveUserData 挂住导致永久 splash */
export const SAVE_TIMEOUT_MS = 8000

/**
 * 给 thenable 套一层超时；超时后原请求即使迟到达也被忽略。
 * 注意：这里只是忽略结果，**不取消底层请求**（T7a 不引入 AbortController）。
 */
function withTimeout<T>(thenable: PromiseLike<T>, ms: number, label = '加载'): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label}超时（${ms}ms）`)), ms)
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
 *
 * 注意这里用 `limit(1)` 拿数组，而不是 `maybeSingle()`：后者在「0 行」时会返回
 * 一个 PGRST116 错误（不是 data:null/error:null），跟真正的读失败混在一起没法区分。
 */
export async function loadUserData(userId: string, timeoutMs: number = LOAD_TIMEOUT_MS): Promise<UserData | null> {
  if (!supabase) return null
  type Row = { data: UserData | null }
  const query = supabase
    .from('user_data')
    .select('data')
    .eq('user_id', userId)
    .limit(1) as unknown as PromiseLike<{ data: Row[] | null; error: { message: string } | null }>
  const { data, error } = await withTimeout(query, timeoutMs)
  if (error) throw new Error(error.message)
  const row = Array.isArray(data) ? data[0] : null
  const remote = (row?.data as UserData) ?? null
  if (remote?.setLogs) remote.setLogs = cleanExerciseLogMap(remote.setLogs)
  return remote
}

/**
 * 整文档 upsert 到远端。
 * 超时/异常一律返回 false（保持调用方的 boolean 语义），绝不抛错：
 * 加载阶段的迁移分支直接 await 这里，抛错会让页面永久停在 splash。
 */
export async function saveUserData(
  userId: string,
  data: UserData,
  timeoutMs: number = SAVE_TIMEOUT_MS,
): Promise<boolean> {
  if (!supabase) return false
  const query = supabase
    .from('user_data')
    .upsert({ user_id: userId, data, updated_at: new Date().toISOString() }) as unknown as PromiseLike<{
    error: { message: string } | null
  }>
  try {
    const { error } = await withTimeout(query, timeoutMs, '保存')
    if (error) {
      console.error('[FitUp] 同步到云端失败：', error.message)
      return false
    }
    return true
  } catch (e) {
    console.error('[FitUp] 同步到云端失败：', e instanceof Error ? e.message : String(e))
    return false
  }
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
