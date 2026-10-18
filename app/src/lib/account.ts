import { format } from 'date-fns'
import { supabase } from '@/lib/supabase'
import { cloudCacheKey, cloudDirtyKey, LS_KEYS, type CloudState } from '@/lib/store'

/**
 * 数据导出与账号删除（简版）。
 *
 * 删除边界：前端无法删除 auth.users 里的账号行（需要 service role），
 * 本模块只负责「用户数据」的彻底清除——云端 user_data 整行（RLS 限定只能删自己的）
 * + 本机全部 FitUp 缓存。auth.users 残留的邮箱行由站长按
 * docs/2026-10-18-account-data-rights.md 的 SQL 定期清理。
 */

/** 导出文件的文档结构（schemaVersion 便于未来格式演进） */
export interface ExportPayload {
  app: 'FitUp'
  schemaVersion: 1
  exportedAt: string
  email?: string
  profile: CloudState['profile']
  weekPlan: CloudState['weekPlan']
  checks: CloudState['checks']
  weights: CloudState['weights']
  feedbacks: CloudState['feedbacks']
  setLogs: CloudState['setLogs']
  activity: CloudState['activity']
}

/** 组装导出文档（纯函数；七个数据域全量带出，字段缺失时保持 undefined 以还原现状） */
export function buildExportPayload(email: string | undefined, state: CloudState): ExportPayload {
  return {
    app: 'FitUp',
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    ...(email ? { email } : {}),
    profile: state.profile,
    weekPlan: state.weekPlan,
    checks: state.checks,
    weights: state.weights,
    feedbacks: state.feedbacks,
    setLogs: state.setLogs,
    activity: state.activity,
  }
}

/** 导出文件名：FitUp-数据备份-20261018.json */
export function exportFileName(today: Date = new Date()): string {
  return `FitUp-数据备份-${format(today, 'yyyyMMdd')}.json`
}

/** 把导出文档下载为本地 JSON 文件 */
export function downloadExport(payload: ExportPayload): void {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = exportFileName()
  a.click()
  URL.revokeObjectURL(url)
}

/** 本机所有 FitUp 相关 key：登录缓存 + 未同步标记 + 账号体系上线前的旧版 key */
export function fitupLocalKeys(userId: string): string[] {
  return [cloudCacheKey(userId), cloudDirtyKey(userId), ...Object.values(LS_KEYS)]
}

/** 清空本机全部 FitUp 数据（登出缓存、未同步标记、旧版迁移源一并删除） */
export function clearLocalData(userId: string): void {
  for (const key of fitupLocalKeys(userId)) {
    try {
      localStorage.removeItem(key)
    } catch {
      /* ignore：隐私模式下个别 key 可能不可写，尽力清除 */
    }
  }
}

/** 删除云端 user_data 整行（RLS 保证只能删自己的行）。返回是否成功 */
export async function deleteCloudRow(userId: string): Promise<boolean> {
  if (!supabase) return false
  const { error } = await supabase.from('user_data').delete().eq('user_id', userId)
  if (error) {
    console.error('[FitUp] 删除云端数据失败：', error.message)
    return false
  }
  return true
}
