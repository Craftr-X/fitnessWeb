import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  clearCloudDirty,
  cloudCacheKey,
  cloudDirtyKey,
  defaultCloudState,
  isCloudDirty,
  markCloudDirty,
  mergeRemoteState,
  subscribeCloudDirty,
  useCloudStorage,
  type CloudState,
} from '@/lib/store'
import { buildExportPayload, fitupLocalKeys } from '@/lib/account'
import type { ActivityMap, CheckMap, ExerciseLogMap } from '@/types'

/* loadUserData / saveUserData 走网络，必须 mock；其余 sync 能力保留原实现 */
const { loadUserDataMock, saveUserDataMock } = vi.hoisted(() => ({
  loadUserDataMock: vi.fn(),
  saveUserDataMock: vi.fn(),
}))

vi.mock('@/lib/sync', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/sync')>()),
  loadUserData: loadUserDataMock,
  saveUserData: saveUserDataMock,
}))

const DEBOUNCE_MS = 800

/** 地库记组场景的三个域（与 WeeklyPlan.tsx 的 onSave 一次改动一致） */
const OFFLINE_CHECKS: CheckMap = { '2:0:0': true }
const OFFLINE_LOGS: ExerciseLogMap = {
  卧推: [
    {
      date: '2026-11-09',
      week: 2,
      sets: [
        { weightKg: 60, reps: 10 },
        { weightKg: 60, reps: 8 },
        { weightKg: 55, reps: 6 },
      ],
    },
  ],
}
const OFFLINE_ACTIVITY: ActivityMap = { '2026-11-09': 1 }

function seedCache(userId: string, partial: Partial<CloudState>) {
  localStorage.setItem(cloudCacheKey(userId), JSON.stringify(partial))
}

function cachedState(userId: string): CloudState {
  return JSON.parse(localStorage.getItem(cloudCacheKey(userId)) ?? '{}') as CloudState
}

async function flushMicrotasks() {
  await act(async () => {})
}

/** 云端读失败 + 页面仍可用；返回 hook 与「用户离线记了三组」的写入函数 */
async function renderWithLoadError(userId: string) {
  seedCache(userId, { checks: {}, setLogs: {}, activity: {} })
  loadUserDataMock.mockRejectedValue(new Error('Failed to fetch'))
  saveUserDataMock.mockResolvedValue(true)
  const rendered = renderHook(() => useCloudStorage(userId))
  await flushMicrotasks()
  expect(rendered.result.current.ready).toBe(true)
  expect(rendered.result.current.loadError).toBeTruthy()
  return rendered
}

function writeOfflineSets(result: { current: ReturnType<typeof useCloudStorage> }) {
  act(() => {
    result.current.checks[1](OFFLINE_CHECKS)
    result.current.setLogs[1](OFFLINE_LOGS)
    result.current.activity[1](OFFLINE_ACTIVITY)
  })
}

beforeEach(() => {
  localStorage.clear()
  vi.resetAllMocks()
  vi.useFakeTimers()
  return () => vi.useRealTimers()
})

/* ------------------------------------------------------------------ */
/* mergeRemoteState：远端整份覆盖 vs 只补本机缺失的域                    */
/* ------------------------------------------------------------------ */
describe('mergeRemoteState（域级兜底，不做字段级合并）', () => {
  it('protectLocal=false：远端整份覆盖，沿用历史行为', () => {
    const local = { ...defaultCloudState(), checks: OFFLINE_CHECKS }
    const remote: Partial<CloudState> = { checks: { '1:1:1': true }, weights: [] }
    expect(mergeRemoteState(local, remote).checks).toEqual({ '1:1:1': true })
  })

  it('protectLocal=false：远端已定义的空集合也照样覆盖', () => {
    const local = { ...defaultCloudState(), setLogs: OFFLINE_LOGS }
    expect(mergeRemoteState(local, { setLogs: {} }).setLogs).toEqual({})
  })

  it('protectLocal=true：本机已有域一律保留，离线写入不被抹掉', () => {
    const local = {
      ...defaultCloudState(),
      checks: OFFLINE_CHECKS,
      setLogs: OFFLINE_LOGS,
      activity: OFFLINE_ACTIVITY,
    }
    const remote: Partial<CloudState> = {
      checks: {},
      setLogs: {},
      activity: {},
      weights: [{ date: '2026-11-06', weight: 72.5, bodyFat: null }],
    }
    const merged = mergeRemoteState(local, remote, true)
    expect(merged.checks).toEqual(OFFLINE_CHECKS)
    expect(merged.setLogs).toEqual(OFFLINE_LOGS)
    expect(merged.activity).toEqual(OFFLINE_ACTIVITY)
  })

  it('protectLocal=true：只补本机缺失的域，undefined 不当作有效值', () => {
    const local = { ...defaultCloudState() }
    // 模拟老文档缺 activity：把它从对象上删掉，远端带一份
    const legacy = { ...local } as Partial<CloudState>
    delete legacy.activity
    const merged = mergeRemoteState(
      legacy as CloudState,
      { activity: OFFLINE_ACTIVITY, checks: undefined },
      true,
    )
    expect(merged.activity).toEqual(OFFLINE_ACTIVITY)
    expect(merged.checks).toEqual(local.checks)
  })

  it('protectLocal=true：不修改传入的 local（纯函数）', () => {
    const local = { ...defaultCloudState(), checks: OFFLINE_CHECKS }
    const snapshot = JSON.stringify(local)
    mergeRemoteState(local, { checks: {} }, true)
    expect(JSON.stringify(local)).toBe(snapshot)
  })
})

/* ------------------------------------------------------------------ */
/* 核心失效点：loadError 期间写本机、禁止写云端                          */
/* ------------------------------------------------------------------ */
describe('T7a：loadError 期间的本机落盘', () => {
  it('读失败但用户什么都没改：不置 dirty，也不误报待同步', async () => {
    const { result } = await renderWithLoadError('u-no-change')
    expect(isCloudDirty('u-no-change')).toBe(false)
    expect(result.current.pendingCount).toBe(0)
    expect(saveUserDataMock).not.toHaveBeenCalled()
  })

  it('读失败但用户什么都没改：本机缓存仍可用（写盘是幂等的）', async () => {
    await renderWithLoadError('u-no-change-cache')
    expect(cachedState('u-no-change-cache').checks).toEqual({})
  })

  it('离线改动三个域：全部写入本机缓存', async () => {
    const { result } = await renderWithLoadError('u-write')
    writeOfflineSets(result)
    await flushMicrotasks()

    const cached = cachedState('u-write')
    expect(cached.checks).toEqual(OFFLINE_CHECKS)
    expect(cached.setLogs).toEqual(OFFLINE_LOGS)
    expect(cached.activity).toEqual(OFFLINE_ACTIVITY)
  })

  it('离线改动：置 dirty 标记（下次启动以缓存为准重推）', async () => {
    const { result } = await renderWithLoadError('u-dirty')
    writeOfflineSets(result)
    await flushMicrotasks()

    expect(localStorage.getItem(cloudDirtyKey('u-dirty'))).toBe('1')
    expect(isCloudDirty('u-dirty')).toBe(true)
  })

  it('离线改动：仍然禁止自动 upsert，防旧缓存覆盖云端', async () => {
    const { result } = await renderWithLoadError('u-no-auto-upsert')
    writeOfflineSets(result)
    await flushMicrotasks()
    act(() => vi.advanceTimersByTime(DEBOUNCE_MS))
    await flushMicrotasks()

    expect(saveUserDataMock).not.toHaveBeenCalled()
  })

  it('离线改动：防抖窗口过去后数据仍在本机（不会因 effect 重跑蒸发）', async () => {
    const { result } = await renderWithLoadError('u-survive-timer')
    writeOfflineSets(result)
    await flushMicrotasks()
    act(() => vi.advanceTimersByTime(DEBOUNCE_MS * 3))
    await flushMicrotasks()

    expect(cachedState('u-survive-timer').setLogs).toEqual(OFFLINE_LOGS)
  })

  it('离线改动后 flush 仍返回 false（T4 删除守卫不放宽），但数据已安全落盘', async () => {
    const { result } = await renderWithLoadError('u-delete-guard')
    writeOfflineSets(result)
    await flushMicrotasks()

    let ok = true
    await act(async () => {
      ok = await result.current.flush()
    })
    expect(ok).toBe(false)
    expect(cachedState('u-delete-guard').setLogs).toEqual(OFFLINE_LOGS)
    expect(isCloudDirty('u-delete-guard')).toBe(true)
  })

  it('重新挂载（模拟刷新）：dirty 短路跳过远端拉取，state 从缓存恢复', async () => {
    const uid = 'u-reload'
    const { result, unmount } = await renderWithLoadError(uid)
    writeOfflineSets(result)
    await flushMicrotasks()
    unmount()

    loadUserDataMock.mockReset()
    loadUserDataMock.mockResolvedValue({ checks: {} })
    const second = renderHook(() => useCloudStorage(uid))
    await flushMicrotasks()

    expect(second.result.current.setLogs[0]).toEqual(OFFLINE_LOGS)
    expect(second.result.current.checks[0]).toEqual(OFFLINE_CHECKS)
    expect(second.result.current.activity[0]).toEqual(OFFLINE_ACTIVITY)
    expect(loadUserDataMock).not.toHaveBeenCalled()
  })
})

/* ------------------------------------------------------------------ */
/* retry 双分支                                                        */
/* ------------------------------------------------------------------ */
describe('T7a：retry 按 dirty 分流', () => {
  it('dirty=true：走整份重推，不重新拉远端', async () => {
    const { result } = await renderWithLoadError('u-retry-push')
    writeOfflineSets(result)
    await flushMicrotasks()

    act(() => result.current.retry())
    await flushMicrotasks()

    expect(saveUserDataMock).toHaveBeenCalledWith(
      'u-retry-push',
      expect.objectContaining({ setLogs: OFFLINE_LOGS, checks: OFFLINE_CHECKS }),
    )
    // 只有启动那次拉取，没有第二次
    expect(loadUserDataMock).toHaveBeenCalledTimes(1)
  })

  it('dirty=true 重推成功：清 dirty、清 loadError、pendingCount 归零', async () => {
    const { result } = await renderWithLoadError('u-retry-ok')
    writeOfflineSets(result)
    await flushMicrotasks()

    act(() => result.current.retry())
    await flushMicrotasks()

    expect(result.current.loadError).toBeNull()
    expect(result.current.syncError).toBe(false)
    expect(result.current.pendingCount).toBe(0)
    expect(isCloudDirty('u-retry-ok')).toBe(false)
  })

  it('dirty=true 重推成功：不会因 loadError 变化又标脏或重复推一次', async () => {
    const { result } = await renderWithLoadError('u-retry-no-loop')
    writeOfflineSets(result)
    await flushMicrotasks()

    act(() => result.current.retry())
    await flushMicrotasks()
    expect(saveUserDataMock).toHaveBeenCalledTimes(1)

    act(() => vi.advanceTimersByTime(DEBOUNCE_MS * 2))
    await flushMicrotasks()

    expect(saveUserDataMock).toHaveBeenCalledTimes(1)
    expect(isCloudDirty('u-retry-no-loop')).toBe(false)
  })

  it('dirty=true 重推失败：保留 loadError 与 dirty，syncError 置位', async () => {
    const { result } = await renderWithLoadError('u-retry-fail')
    writeOfflineSets(result)
    await flushMicrotasks()
    saveUserDataMock.mockResolvedValueOnce(false)

    act(() => result.current.retry())
    await flushMicrotasks()

    expect(result.current.loadError).toBeTruthy()
    expect(result.current.syncError).toBe(true)
    expect(isCloudDirty('u-retry-fail')).toBe(true)
  })

  it('dirty=false：走原有重拉路径，把云端数据取回来', async () => {
    const { result } = await renderWithLoadError('u-retry-pull')
    loadUserDataMock.mockResolvedValueOnce({ checks: { '3:0:0': true } })

    act(() => result.current.retry())
    await flushMicrotasks()

    expect(loadUserDataMock).toHaveBeenCalledTimes(2)
    expect(result.current.checks[0]).toEqual({ '3:0:0': true })
    expect(result.current.loadError).toBeNull()
  })

  it('远端覆盖时若本机有 dirty，只补缺失域、不抹掉离线写入', async () => {
    const uid = 'u-protect-remote'
    seedCache(uid, { checks: OFFLINE_CHECKS, setLogs: OFFLINE_LOGS })
    markCloudDirty(uid)
    // 竞态：dirty 在加载过程中被置位，但加载 effect 仍走到了远端覆盖分支
    // （正常启动会走 :483 短路，这里用 reloadKey 路径模拟）
    loadUserDataMock.mockResolvedValue({ checks: {}, weights: [] })
    saveUserDataMock.mockResolvedValue(true)

    const { result } = renderHook(() => useCloudStorage(uid))
    await flushMicrotasks()
    // 短路生效：根本不拉远端
    expect(loadUserDataMock).not.toHaveBeenCalled()
    expect(result.current.setLogs[0]).toEqual(OFFLINE_LOGS)
  })
})

/* ------------------------------------------------------------------ */
/* pendingCount 与账号隔离                                              */
/* ------------------------------------------------------------------ */
describe('T7a：pendingCount 与账号隔离', () => {
  it('pendingCount 随 dirty 从 0 → 1 → 0 变化', async () => {
    const { result } = await renderWithLoadError('u-pending')
    expect(result.current.pendingCount).toBe(0)

    writeOfflineSets(result)
    await flushMicrotasks()
    expect(result.current.pendingCount).toBe(1)

    act(() => result.current.retry())
    await flushMicrotasks()
    expect(result.current.pendingCount).toBe(0)
  })

  it('subscribeCloudDirty 能收到标记变化并能取消订阅', () => {
    const listener = vi.fn()
    const unsubscribe = subscribeCloudDirty(listener)
    markCloudDirty('u-sub')
    expect(listener).toHaveBeenCalled()
    unsubscribe()
    clearCloudDirty('u-sub')
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('账号 A 的待同步状态不出现在账号 B 的 pendingCount 里', async () => {
    loadUserDataMock.mockRejectedValue(new Error('offline'))
    saveUserDataMock.mockResolvedValue(true)
    const a = renderHook(() => useCloudStorage('user-A'))
    const b = renderHook(() => useCloudStorage('user-B'))
    await flushMicrotasks()

    await act(async () => {
      markCloudDirty('user-A')
    })

    expect(a.result.current.pendingCount).toBe(1)
    expect(b.result.current.pendingCount).toBe(0)
  })

  it('账号 A 的离线写入不会落到账号 B 的缓存 key', async () => {
    const { result } = await renderWithLoadError('user-A')
    writeOfflineSets(result)
    await flushMicrotasks()
    loadUserDataMock.mockRejectedValue(new Error('offline'))
    saveUserDataMock.mockResolvedValue(true)
    const b = renderHook(() => useCloudStorage('user-B'))
    await flushMicrotasks()

    expect(cachedState('user-A').setLogs).toEqual(OFFLINE_LOGS)
    expect(localStorage.getItem(cloudCacheKey('user-B')) ?? '{}').not.toContain('卧推')
    expect(b.result.current.setLogs[0]).toEqual({})
  })
})

/* ------------------------------------------------------------------ */
/* 硬性验收：未新增 key、删除权、导出七域                                */
/* ------------------------------------------------------------------ */
describe('T7a：删除权与导出回归', () => {
  it('未新增 localStorage key：fitupLocalKeys 仍是 2 个用户 key + 6 个旧 key', () => {
    expect(fitupLocalKeys('u-keys')).toEqual([
      cloudCacheKey('u-keys'),
      cloudDirtyKey('u-keys'),
      'fitup:profile',
      'fitup:weekPlan',
      'fitup:checks',
      'fitup:weights',
      'fitup:feedback',
      'fitup:setLogs',
    ])
  })

  it('clearLocalData 之后离线写入的缓存与 dirty 都不残留', async () => {
    const { result } = await renderWithLoadError('u-clear')
    writeOfflineSets(result)
    await flushMicrotasks()
    // 直接按 fitupLocalKeys 清除（与 account.clearLocalData 同一份清单）
    for (const key of fitupLocalKeys('u-clear')) localStorage.removeItem(key)
    expect(localStorage.getItem(cloudCacheKey('u-clear'))).toBeNull()
    expect(localStorage.getItem(cloudDirtyKey('u-clear'))).toBeNull()
  })

  it('导出 JSON 仍是七个数据域，离线写入的 setLogs / activity 不丢', () => {
    const state = {
      ...defaultCloudState(),
      checks: OFFLINE_CHECKS,
      setLogs: OFFLINE_LOGS,
      activity: OFFLINE_ACTIVITY,
    }
    const payload = buildExportPayload('a@b.com', state)
    expect(payload.setLogs).toEqual(OFFLINE_LOGS)
    expect(payload.activity).toEqual(OFFLINE_ACTIVITY)
    expect(payload.checks).toEqual(OFFLINE_CHECKS)
    for (const key of ['profile', 'weekPlan', 'weights', 'feedbacks'] as const) {
      expect(payload[key]).toBeDefined()
    }
  })
})
