import { useCallback, useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

export interface AuthState {
  user: User | null
  /** 首次会话恢复完成前为 true */
  loading: boolean
  /** 发送验证码到邮箱；返回 null 表示成功，返回字符串表示错误文案 */
  sendOtp: (email: string) => Promise<string | null>
  /** 校验 6 位验证码；返回 null 表示成功且已登录，返回字符串表示错误文案 */
  verifyOtp: (email: string, token: string) => Promise<string | null>
  signOut: () => Promise<void>
}

/** Supabase Auth 会话状态 Hook（邮箱验证码 OTP 登录） */
export function useAuth(): AuthState {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(!!supabase)

  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null)
      setLoading(false)
    })
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })
    return () => subscription.unsubscribe()
  }, [])

  const sendOtp = useCallback(
    async (email: string): Promise<string | null> => {
      if (!supabase) return 'Supabase 未配置'
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: true },
      })
      return error ? error.message : null
    },
    [],
  )

  const verifyOtp = useCallback(
    async (email: string, token: string): Promise<string | null> => {
      if (!supabase) return 'Supabase 未配置'
      const { error } = await supabase.auth.verifyOtp({
        email,
        token,
        type: 'email',
      })
      return error ? error.message : null
    },
    [],
  )

  const signOut = useCallback(async () => {
    if (supabase) await supabase.auth.signOut()
  }, [])

  return { user, loading, sendOtp, verifyOtp, signOut }
}
