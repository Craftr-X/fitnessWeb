import { useCallback, useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

export interface AuthState {
  user: User | null
  /** 首次会话恢复完成前为 true */
  loading: boolean
  signIn: (email: string, password: string) => Promise<string | null>
  /** 返回 null 表示成功且已登录；返回提示文案表示需要邮箱确认 */
  signUp: (email: string, password: string) => Promise<string | null>
  signOut: () => Promise<void>
}

async function errorMessage(p: Promise<{ error: { message: string } | null }>): Promise<string | null> {
  const { error } = await p
  return error ? error.message : null
}

/** Supabase Auth 会话状态 Hook */
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

  const signIn = useCallback(
    (email: string, password: string) =>
      supabase ? errorMessage(supabase.auth.signInWithPassword({ email, password })) : Promise.resolve('Supabase 未配置'),
    [],
  )

  const signUp = useCallback(
    async (email: string, password: string): Promise<string | null> => {
      if (!supabase) return 'Supabase 未配置'
      const { data, error } = await supabase.auth.signUp({ email, password })
      if (error) return error.message
      // 开启了邮箱确认时，注册成功但暂无 session
      if (!data.session) return '注册成功！请先到邮箱点击确认链接，再回来登录。'
      return null
    },
    [],
  )

  const signOut = useCallback(async () => {
    if (supabase) await supabase.auth.signOut()
  }, [])

  return { user, loading, signIn, signUp, signOut }
}
