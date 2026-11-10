import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuth } from '@/hooks/useAuth'

/* 会话恢复走 supabase.auth，这里只 mock 用到的两个方法 */
const { getSessionMock, onAuthStateChangeMock, authCallbackRef } = vi.hoisted(() => ({
  getSessionMock: vi.fn(),
  onAuthStateChangeMock: vi.fn(),
  authCallbackRef: { current: null as null | ((event: string, session: unknown) => void) },
}))

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: getSessionMock,
      onAuthStateChange: onAuthStateChangeMock,
      signInWithOtp: vi.fn(),
      verifyOtp: vi.fn(),
      signOut: vi.fn(),
    },
  },
}))

const fakeUser = { id: 'user-1', email: 'a@b.com' }

beforeEach(() => {
  vi.resetAllMocks()
  authCallbackRef.current = null
  onAuthStateChangeMock.mockImplementation((cb) => {
    authCallbackRef.current = cb
    return { data: { subscription: { unsubscribe: vi.fn() } } }
  })
})

describe('useAuth 会话恢复兜底（T7a）', () => {
  it('getSession() reject：loading 必须结束，不会永久停在「正在恢复登录状态…」', async () => {
    getSessionMock.mockRejectedValue(new Error('network down'))
    const { result } = renderHook(() => useAuth())

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.user).toBeNull()
  })

  it('getSession() 返回会话：user 正确、loading 结束', async () => {
    getSessionMock.mockResolvedValue({ data: { session: { user: fakeUser } } })
    const { result } = renderHook(() => useAuth())

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.user).toEqual(fakeUser)
  })

  it('getSession() 返回空会话：user 为 null、loading 结束', async () => {
    getSessionMock.mockResolvedValue({ data: { session: null } })
    const { result } = renderHook(() => useAuth())

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.user).toBeNull()
  })

  it('onAuthStateChange 仍能把后续登录状态同步进来', async () => {
    getSessionMock.mockResolvedValue({ data: { session: null } })
    const { result } = renderHook(() => useAuth())
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      authCallbackRef.current?.('SIGNED_IN', { user: fakeUser })
    })
    expect(result.current.user).toEqual(fakeUser)
    expect(result.current.loading).toBe(false)
  })
})
