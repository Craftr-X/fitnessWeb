import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

/**
 * Supabase 客户端。未配置环境变量时为 null，App 会提示配置而不是白屏。
 * anon key 放在前端是安全的——数据访问由 Postgres RLS 按用户隔离。
 */
export const supabase: SupabaseClient | null =
  url && anonKey ? createClient(url, anonKey) : null

if (!supabase) {
  console.warn(
    '[FitUp] 缺少 VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY，' +
      '请复制 .env.example 为 .env.local 并填入 Supabase 项目凭据。',
  )
}
