import { beforeEach, describe, expect, it } from 'vitest'
import { buildExportPayload, clearLocalData, exportFileName, fitupLocalKeys } from '@/lib/account'
import { cloudCacheKey, cloudDirtyKey, defaultCloudState, LS_KEYS } from '@/lib/store'

/* ------------------------------------------------------------------ */
/* buildExportPayload —— 导出文档组装                                   */
/* ------------------------------------------------------------------ */
describe('buildExportPayload', () => {
  it('六个数据域全量带出，元信息完整', () => {
    const state = defaultCloudState()
    const payload = buildExportPayload('a@b.com', state)

    expect(payload.app).toBe('FitUp')
    expect(payload.schemaVersion).toBe(1)
    expect(payload.email).toBe('a@b.com')
    expect(payload.exportedAt).toBeTruthy()
    // 六个数据域一一对应，引用一致（导出不拷贝不清洗，所见即所得）
    expect(payload.profile).toBe(state.profile)
    expect(payload.weekPlan).toBe(state.weekPlan)
    expect(payload.checks).toBe(state.checks)
    expect(payload.weights).toBe(state.weights)
    expect(payload.feedbacks).toBe(state.feedbacks)
    expect(payload.setLogs).toBe(state.setLogs)
  })

  it('email 为空时不下发该字段（新注册未刷新会话的极端情况）', () => {
    const payload = buildExportPayload(undefined, defaultCloudState())
    expect('email' in payload).toBe(false)
  })
})

/* ------------------------------------------------------------------ */
/* exportFileName —— 导出文件名                                        */
/* ------------------------------------------------------------------ */
describe('exportFileName', () => {
  it('按 yyyyMMdd 生成中文文件名', () => {
    expect(exportFileName(new Date('2026-10-18T10:00:00'))).toBe('FitUp-数据备份-20261018.json')
  })
})

/* ------------------------------------------------------------------ */
/* clearLocalData —— 本机数据清除                                       */
/* ------------------------------------------------------------------ */
describe('clearLocalData', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('清除登录缓存、未同步标记和全部旧版 key，不动无关 key', () => {
    const userId = 'user-1'
    localStorage.setItem(cloudCacheKey(userId), '{"profile":{}}')
    localStorage.setItem(cloudDirtyKey(userId), '1')
    localStorage.setItem(LS_KEYS.weights, '[]')
    localStorage.setItem('unrelated', 'keep-me')

    clearLocalData(userId)

    for (const key of fitupLocalKeys(userId)) {
      expect(localStorage.getItem(key)).toBeNull()
    }
    expect(localStorage.getItem('unrelated')).toBe('keep-me')
  })

  it('只清除目标用户的缓存，其他用户的缓存不受影响', () => {
    localStorage.setItem(cloudCacheKey('user-1'), 'a')
    localStorage.setItem(cloudCacheKey('user-2'), 'b')

    clearLocalData('user-1')

    expect(localStorage.getItem(cloudCacheKey('user-1'))).toBeNull()
    expect(localStorage.getItem(cloudCacheKey('user-2'))).toBe('b')
  })
})
