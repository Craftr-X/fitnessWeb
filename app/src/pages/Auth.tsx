import { useState } from 'react'
import { Dumbbell, Loader2 } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'

/** 登录 / 注册页（邮箱 + 密码） */
export default function Auth() {
  const { signIn, signUp, signOut } = useAuth()
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState<{ type: 'error' | 'info'; text: string } | null>(null)

  if (!supabase) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle>缺少 Supabase 配置</CardTitle>
            <CardDescription>
              请复制 <code>.env.example</code> 为 <code>.env.local</code>，填入
              VITE_SUPABASE_URL 和 VITE_SUPABASE_ANON_KEY 后重启开发服务器。
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setMessage(null)
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setMessage({ type: 'error', text: '请输入有效的邮箱地址' })
      return
    }
    if (password.length < 6) {
      setMessage({ type: 'error', text: '密码至少 6 位' })
      return
    }
    setSubmitting(true)
    if (mode === 'register') {
      const err = await signUp(email, password)
      if (!err) await signOut() // 注册成功会自带会话，先登出，让用户显式登录
      setSubmitting(false)
      // 无论是否需要邮箱确认，注册后都回到登录页
      setMode('login')
      setPassword('')
      setMessage({
        type: err ? 'error' : 'info',
        text: err ?? '注册成功！请使用邮箱和密码登录。',
      })
      return
    }
    const err = await signIn(email, password)
    setSubmitting(false)
    if (err) setMessage({ type: 'error', text: err })
    // 登录成功时 onAuthStateChange 会自动切换到主界面
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-primary/5 via-background to-background p-4">
      <Card className="w-full max-w-sm rounded-2xl shadow-lg">
        <CardHeader className="items-center text-center">
          <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-500 to-emerald-500 text-white shadow-md shadow-teal-500/30">
            <Dumbbell className="h-6 w-6" />
          </div>
          <CardTitle className="text-xl">FitUp 健身计划</CardTitle>
          <CardDescription>登录后你的训练数据将安全地保存在云端</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={mode} onValueChange={(v) => { setMode(v as 'login' | 'register'); setMessage(null) }}>
            <TabsList className="mb-4 grid w-full grid-cols-2">
              <TabsTrigger value="login">登录</TabsTrigger>
              <TabsTrigger value="register">注册</TabsTrigger>
            </TabsList>
          </Tabs>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="auth-email">邮箱</Label>
              <Input
                id="auth-email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="auth-password">密码</Label>
              <Input
                id="auth-password"
                type="password"
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                placeholder="至少 6 位"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            {message && (
              <p className={`text-sm ${message.type === 'error' ? 'text-red-500' : 'text-emerald-600 dark:text-emerald-400'}`}>
                {message.text}
              </p>
            )}
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
              {mode === 'login' ? '登录' : '注册'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
