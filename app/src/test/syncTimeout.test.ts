import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LOAD_TIMEOUT_MS, SAVE_TIMEOUT_MS, saveUserData } from '@/lib/sync'

/* saveUserData 走 Supabase REST，这里用可控的 thenable 替换，专测超时与失败语义 */
const { upsertMock } = vi.hoisted(() => ({ upsertMock: vi.fn() }))

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: () => ({ upsert: upsertMock }),
  },
}))

/** 立刻 resolve 出指定结果的 PostgREST thenable */
function resolved(result: { error: { message: string } | null }) {
  return { then: (onFulfilled: (v: typeof result) => void) => onFulfilled(result) }
}

/** 永不 settle 的 thenable：模拟请求挂起 */
function hanging() {
  return { then: () => {} }
}

beforeEach(() => {
  vi.useFakeTimers()
  upsertMock.mockReset()
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('saveUserData 写超时（T7a）', () => {
  it('读写超时都是 8000ms，口径一致', () => {
    expect(SAVE_TIMEOUT_MS).toBe(8000)
    expect(LOAD_TIMEOUT_MS).toBe(SAVE_TIMEOUT_MS)
  })

  it('请求挂起时超时返回 false，绝不抛错（迁移分支不会永久卡 splash）', async () => {
    upsertMock.mockReturnValue(hanging())
    const pending = saveUserData('u-timeout', {}, 10)
    await vi.advanceTimersByTimeAsync(20)
    await expect(pending).resolves.toBe(false)
  })

  it('底层 reject 时也返回 false，保持调用方的 boolean 语义', async () => {
    upsertMock.mockReturnValue({
      then: (_onFulfilled: unknown, onRejected: (e: Error) => void) => onRejected(new Error('network')),
    })
    await expect(saveUserData('u-reject', {})).resolves.toBe(false)
  })

  it('PostgREST 返回 error 对象时返回 false', async () => {
    upsertMock.mockReturnValue(resolved({ error: { message: 'RLS denied' } }))
    await expect(saveUserData('u-error', {})).resolves.toBe(false)
  })

  it('成功时返回 true，且把整份文档与 user_id 一起 upsert', async () => {
    upsertMock.mockReturnValue(resolved({ error: null }))
    const data = { checks: { '2:0:0': true } }
    await expect(saveUserData('u-ok', data)).resolves.toBe(true)
    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: 'u-ok', data }),
    )
  })

  it('超时后迟到的成功结果不会再改变返回值（withTimeout 忽略迟到结果）', async () => {
    let lateResolve: ((v: { error: null }) => void) | undefined
    upsertMock.mockReturnValue({
      then: (onFulfilled: (v: { error: null }) => void) => {
        lateResolve = onFulfilled
      },
    })
    const pending = saveUserData('u-late', {}, 10)
    await vi.advanceTimersByTimeAsync(20)
    await expect(pending).resolves.toBe(false)
    // 迟到的结果被调用也不应抛未处理异常
    expect(() => lateResolve?.({ error: null })).not.toThrow()
  })
})
