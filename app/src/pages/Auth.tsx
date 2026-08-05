import { useEffect, useRef, useState } from 'react'
import { Dumbbell, Loader2, Mail } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'

/** 验证码重发倒计时（秒） */
const RESEND_COOLDOWN = 60
/** 验证码位数 */
const OTP_LENGTH = 6

type Step = 'email' | 'otp'

/**
 * 邮箱验证码登录（passwordless）。
 * 两步流程：① 输邮箱发送验证码 ② 填 6 位验证码登录。
 * 首次邮箱自动建号（shouldCreateUser: true），后续直接登录，用户无感知。
 */
export default function Auth() {
  const { sendOtp, verifyOtp } = useAuth()
  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')
  const [token, setToken] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [cooldown, setCooldown] = useState(0)
  const [message, setMessage] = useState<{ type: 'error' | 'info'; text: string } | null>(null)
  const cooldownTimer = useRef<ReturnType<typeof setInterval> | null>(null)

  // 60s 重发倒计时
  useEffect(() => {
    if (cooldown <= 0) {
      if (cooldownTimer.current) {
        clearInterval(cooldownTimer.current)
        cooldownTimer.current = null
      }
      return
    }
    cooldownTimer.current = setInterval(() => setCooldown((c) => c - 1), 1000)
    return () => {
      if (cooldownTimer.current) clearInterval(cooldownTimer.current)
    }
  }, [cooldown])

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

  const validEmail = (e: string) => /^\S+@\S+\.\S+$/.test(e)

  const handleSendOtp = async () => {
    setMessage(null)
    if (!validEmail(email)) {
      setMessage({ type: 'error', text: '请输入有效的邮箱地址' })
      return
    }
    setSubmitting(true)
    const err = await sendOtp(email)
    setSubmitting(false)
    if (err) {
      setMessage({ type: 'error', text: err })
      return
    }
    setStep('otp')
    setCooldown(RESEND_COOLDOWN)
    setMessage({ type: 'info', text: `验证码已发送到 ${email}，请查收（含垃圾邮件箱）` })
  }

  const handleResend = async () => {
    if (cooldown > 0) return
    setMessage(null)
    setSubmitting(true)
    const err = await sendOtp(email)
    setSubmitting(false)
    if (err) {
      setMessage({ type: 'error', text: err })
      return
    }
    setCooldown(RESEND_COOLDOWN)
    setMessage({ type: 'info', text: '已重新发送验证码' })
  }

  const handleVerify = async () => {
    setMessage(null)
    if (token.length !== OTP_LENGTH) {
      setMessage({ type: 'error', text: `请输入 ${OTP_LENGTH} 位验证码` })
      return
    }
    setSubmitting(true)
    const err = await verifyOtp(email, token)
    setSubmitting(false)
    if (err) {
      setMessage({ type: 'error', text: err })
      return
    }
    // 登录成功：onAuthStateChange 会自动切换到主界面，无需手动跳转
    setMessage({ type: 'info', text: '登录成功，正在进入…' })
  }

  const backToEmail = () => {
    setStep('email')
    setToken('')
    setMessage(null)
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-primary/5 via-background to-background p-4">
      <Card className="w-full max-w-sm rounded-2xl shadow-lg">
        <CardHeader className="items-center text-center">
          <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-500 to-emerald-500 text-white shadow-md shadow-teal-500/30">
            <Dumbbell className="h-6 w-6" />
          </div>
          <CardTitle className="text-xl">FitUp 健身计划</CardTitle>
          <CardDescription>
            {step === 'email' ? '用邮箱验证码登录，无需密码' : `验证码已发送至 ${email}`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {step === 'email' ? (
            <form
              onSubmit={(e) => {
                e.preventDefault()
                void handleSendOtp()
              }}
              className="space-y-4"
            >
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
              {message && (
                <p className={`text-sm ${message.type === 'error' ? 'text-red-500' : 'text-emerald-600 dark:text-emerald-400'}`}>
                  {message.text}
                </p>
              )}
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
                <Mail className="mr-1 h-4 w-4" />
                发送验证码
              </Button>
            </form>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>验证码</Label>
                <div className="flex justify-center">
                  <InputOTP
                    maxLength={OTP_LENGTH}
                    value={token}
                    onChange={setToken}
                    disabled={submitting}
                  >
                    <InputOTPGroup>
                      <InputOTPSlot index={0} />
                      <InputOTPSlot index={1} />
                      <InputOTPSlot index={2} />
                      <InputOTPSlot index={3} />
                      <InputOTPSlot index={4} />
                      <InputOTPSlot index={5} />
                    </InputOTPGroup>
                  </InputOTP>
                </div>
              </div>

              {message && (
                <p className={`text-center text-sm ${message.type === 'error' ? 'text-red-500' : 'text-emerald-600 dark:text-emerald-400'}`}>
                  {message.text}
                </p>
              )}

              <Button
                onClick={() => void handleVerify()}
                className="w-full"
                disabled={submitting || token.length !== OTP_LENGTH}
              >
                {submitting && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
                登录
              </Button>

              <div className="flex items-center justify-between text-sm">
                <Button variant="link" className="h-auto p-0 text-muted-foreground" onClick={backToEmail}>
                  ← 换个邮箱
                </Button>
                <Button
                  variant="link"
                  className="h-auto p-0"
                  disabled={cooldown > 0 || submitting}
                  onClick={() => void handleResend()}
                >
                  {cooldown > 0 ? `${cooldown}s 后可重发` : '重新发送'}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
