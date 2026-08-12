import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CloudState } from '@/lib/store'
import {
  clearCloudDirty,
  cloudCacheKey,
  cloudDirtyKey,
  isCloudDirty,
  markCloudDirty,
  useCloudStorage,
} from '@/lib/store'

/* loadUserData / saveUserData 走网络，必须 mock；readLegacyData 只读 localStorage，保留原实现 */
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

function seedCache(userId: string, partial: Partial<CloudState>) {
  localStorage.setItem(cloudCacheKey(userId), JSON.stringify(partial))
}

/** 让加载 effect 的 promise 链跑完（fake timers 不影响微任务） */
async function flushMicrotasks() {
  await act(async () => {})
}

beforeEach(() => {
  localStorage.clear()
  vi.resetAllMocks()
  vi.useFakeTimers()
  return () => vi.useRealTimers()
})

/* ------------------------------------------------------------------ */
/* 未同步标记 helpers                                                  */
/* ------------------------------------------------------------------ */
describe('cloud dirty 标记', () => {
  it('默认未置位；mark 后置位；clear 后复位', () => {
    expect(isCloudDirty('u1')).toBe(false)
    markCloudDirty('u1')
    expect(isCloudDirty('u1')).toBe(true)
    expect(localStorage.getItem(cloudDirtyKey('u1'))).toBe('1')
    clearCloudDirty('u1')
    expect(isCloudDirty('u1')).toBe(false)
  })

  it('按用户隔离', () => {
    markCloudDirty('u1')
    expect(isCloudDirty('u2')).toBe(false)
  })
})

/* ------------------------------------------------------------------ */
/* 核心回归：本地有未同步改动时，启动不得被远端旧数据覆盖               */
/* ------------------------------------------------------------------ */
describe('useCloudStorage 未同步重推', () => {
  it('脏标记 + 本地缓存存在：以本地为准、跳过远端拉取，防抖后重推并清标记', async () => {
    const uid = 'u-dirty'
    // 上次关闭前 800ms 内的打卡：只落了缓存，没来得及写云端
    seedCache(uid, { checks: { '1:0:0': true } })
    markCloudDirty(uid)
    // 远端还是旧数据（没有这次打卡）
    loadUserDataMock.mockResolvedValue({ checks: {} })
    saveUserDataMock.mockResolvedValue(true)

    const { result } = renderHook(() => useCloudStorage(uid))
    await flushMicrotasks()

    expect(result.current.ready).toBe(true)
    // 关键断言：本地未同步的打卡没有被远端旧数据冲掉
    expect(result.current.checks[0]).toEqual({ '1:0:0': true })
    expect(loadUserDataMock).not.toHaveBeenCalled()

    // 防抖到期后重推本地状态，成功后清标记
    act(() => vi.advanceTimersByTime(DEBOUNCE_MS))
    await flushMicrotasks()
    expect(saveUserDataMock).toHaveBeenCalledWith(
      uid,
      expect.objectContaining({ checks: { '1:0:0': true } }),
    )
    expect(isCloudDirty(uid)).toBe(false)
  })

  it('无脏标记：保持现有行为，远端数据覆盖本地缓存', async () => {
    const uid = 'u-clean'
    seedCache(uid, { checks: { '9:9:9': true } })
    loadUserDataMock.mockResolvedValue({ checks: { '1:1:1': true } })
    saveUserDataMock.mockResolvedValue(true)

    const { result } = renderHook(() => useCloudStorage(uid))
    await flushMicrotasks()

    expect(result.current.ready).toBe(true)
    expect(result.current.checks[0]).toEqual({ '1:1:1': true })
    expect(loadUserDataMock).toHaveBeenCalledWith(uid)
  })

  it('保存失败（断网/超时）：保留脏标记，下次启动重推', async () => {
    const uid = 'u-offline'
    loadUserDataMock.mockResolvedValue({ checks: {} })
    saveUserDataMock.mockResolvedValue(false)

    const { result } = renderHook(() => useCloudStorage(uid))
    await flushMicrotasks()
    expect(result.current.ready).toBe(true)

    act(() => vi.advanceTimersByTime(DEBOUNCE_MS))
    await flushMicrotasks()
    expect(saveUserDataMock).toHaveBeenCalled()
    expect(isCloudDirty(uid)).toBe(true)
  })

  it('保存期间又有新变更：旧保存不得清标记，最新保存成功才清', async () => {
    const uid = 'u-race'
    let resolveFirst: (ok: boolean) => void = () => {}
    saveUserDataMock
      .mockImplementationOnce(() => new Promise<boolean>((r) => { resolveFirst = r }))
      .mockResolvedValue(true)
    loadUserDataMock.mockResolvedValue({ checks: {} })

    const { result } = renderHook(() => useCloudStorage(uid))
    await flushMicrotasks()

    // 第一次防抖保存发出（在途）
    act(() => vi.advanceTimersByTime(DEBOUNCE_MS))
    expect(saveUserDataMock).toHaveBeenCalledTimes(1)

    // 保存在途期间用户又打了一个卡 → 新一轮防抖被调度
    act(() => {
      result.current.checks[1]({ '5:0:0': true })
    })

    // 旧保存完成：状态已过期，不得清标记
    await act(async () => {
      resolveFirst(true)
    })
    expect(isCloudDirty(uid)).toBe(true)

    // 新一轮保存成功：此刻它就是最新状态，清标记
    act(() => vi.advanceTimersByTime(DEBOUNCE_MS))
    await flushMicrotasks()
    expect(saveUserDataMock).toHaveBeenCalledTimes(2)
    expect(isCloudDirty(uid)).toBe(false)
  })

  it('flush 立即写入最新状态并清标记（退出登录路径）', async () => {
    const uid = 'u-flush'
    // 无远端数据 → 走迁移路径，加载阶段会先 save 一次
    loadUserDataMock.mockResolvedValue(null)
    saveUserDataMock.mockResolvedValue(true)

    const { result } = renderHook(() => useCloudStorage(uid))
    await flushMicrotasks()
    expect(result.current.ready).toBe(true)

    // 产生一个还在防抖窗口内的变更
    act(() => {
      result.current.checks[1]({ '6:0:0': true })
    })
    expect(isCloudDirty(uid)).toBe(true)

    // 不等防抖，直接 flush（模拟退出登录）
    await act(async () => {
      await result.current.flush()
    })
    expect(saveUserDataMock).toHaveBeenLastCalledWith(
      uid,
      expect.objectContaining({ checks: { '6:0:0': true } }),
    )
    expect(isCloudDirty(uid)).toBe(false)
  })

  it('防抖保存失败：syncError 置位；恢复成功后清除', async () => {
    const uid = 'u-sync-err'
    loadUserDataMock.mockResolvedValue({ checks: {} })
    saveUserDataMock
      .mockResolvedValueOnce(false) // 第一次防抖失败
      .mockResolvedValueOnce(true) // 第二次成功

    const { result } = renderHook(() => useCloudStorage(uid))
    await flushMicrotasks()
    expect(result.current.ready).toBe(true)

    // 第一次防抖保存失败 → syncError 置位
    act(() => vi.advanceTimersByTime(DEBOUNCE_MS))
    await flushMicrotasks()
    expect(result.current.syncError).toBe(true)

    // 触发新变更 → 新一轮防抖；保存成功后 syncError 清除
    act(() => {
      result.current.checks[1]({ '7:0:0': true })
    })
    act(() => vi.advanceTimersByTime(DEBOUNCE_MS))
    await flushMicrotasks()
    expect(result.current.syncError).toBe(false)
  })

  it('flush 失败：syncError 置位并返回 false', async () => {
    const uid = 'u-flush-err'
    loadUserDataMock.mockResolvedValue(null)
    saveUserDataMock.mockResolvedValue(true) // 加载阶段迁移 save

    const { result } = renderHook(() => useCloudStorage(uid))
    await flushMicrotasks()

    saveUserDataMock.mockResolvedValueOnce(false) // flush 失败
    let ok = true
    await act(async () => {
      ok = await result.current.flush()
    })
    expect(ok).toBe(false)
    expect(result.current.syncError).toBe(true)
  })
})
