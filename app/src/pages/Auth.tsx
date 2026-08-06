import { useEffect, useRef, useState } from 'react'
import { Dumbbell, Loader2, Mail, ShieldCheck, Sparkles, TrendingUp } from 'lucide-react'
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
/** 邮箱格式：local@domain.tld，禁止出现多个 @ 或空格 */
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

type Step = 'email' | 'otp'

/** 上升粒子（确定性伪随机，避免每次渲染位置抖动） */
const PARTICLES = Array.from({ length: 16 }, (_, i) => ({
  left: `${(i * 61 + 7) % 100}%`,
  size: 2 + ((i * 7) % 3),
  duration: 13 + ((i * 5) % 13),
  delay: -((i * 3.7) % 16),
}))

/** 登录页背景：深空网格 + 极光光斑 + 上升粒子 */
function Backdrop() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <div className="auth-grid absolute inset-0" />
      <div
        className="auth-aurora left-[-10%] top-[-15%] h-[420px] w-[420px] bg-teal-500/25"
        style={{ animation: 'aurora-1 14s ease-in-out infinite' }}
      />
      <div
        className="auth-aurora right-[-12%] top-[20%] h-[380px] w-[380px] bg-emerald-500/20"
        style={{ animation: 'aurora-2 18s ease-in-out infinite' }}
      />
      <div
        className="auth-aurora bottom-[-20%] left-[25%] h-[400px] w-[400px] bg-cyan-500/15"
        style={{ animation: 'aurora-3 16s ease-in-out infinite' }}
      />
      {PARTICLES.map((p, i) => (
        <span
          key={i}
          className="auth-particle"
          style={{
            left: p.left,
            width: p.size,
            height: p.size,
            animationDuration: `${p.duration}s`,
            animationDelay: `${p.delay}s`,
          }}
        />
      ))}
      {/* 顶部细光带，增加纵深 */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-teal-400/60 to-transparent" />
    </div>
  )
}

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
      <div className="dark relative flex min-h-screen items-center justify-center overflow-hidden bg-[#050b12] p-4 text-slate-100">
        <Backdrop />
        <div className="relative z-10 w-full max-w-sm rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
          <h2 className="text-lg font-semibold">缺少 Supabase 配置</h2>
          <p className="mt-2 text-sm text-slate-400">
            请复制 <code>.env.example</code> 为 <code>.env.local</code>，填入
            VITE_SUPABASE_URL 和 VITE_SUPABASE_ANON_KEY 后重启开发服务器。
          </p>
        </div>
      </div>
    )
  }

  const validEmail = (e: string) => EMAIL_REGEX.test(e)
  // 邮箱是否通过校验，用于实时红框与提示
  const emailValid = validEmail(email)
  // 仅当用户已开始输入才提示，避免首屏就报红
  const showEmailError = email.length > 0 && !emailValid

  const handleSendOtp = async () => {
    setMessage(null)
    if (!validEmail(email)) {
      setMessage({ type: 'error', text: '请输入有效的邮箱地址（例如 you@example.com）' })
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
    // 登录页固定深色科技风：dark class 让 shadcn 组件在本页内使用深色变量，不影响全局主题
    <div className="dark relative flex min-h-screen items-center justify-center overflow-hidden bg-[#050b12] p-4 text-slate-100">
      <Backdrop />

      <div className="relative z-10 w-full max-w-sm">
        {/* 品牌区 */}
        <div className="auth-enter mb-8 flex flex-col items-center text-center">
          <div className="relative mb-5">
            <div className="auth-ring absolute -inset-1.5 rounded-[1.25rem]" />
            <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-400 to-emerald-500 shadow-lg shadow-teal-500/40">
              <Dumbbell className="h-8 w-8 text-slate-950" />
            </div>
          </div>
          <h1 className="bg-gradient-to-r from-teal-300 via-emerald-300 to-cyan-300 bg-clip-text text-3xl font-bold tracking-tight text-transparent">
            FitUp
          </h1>
          <p className="mt-2 text-sm text-slate-400">你的智能健身计划引擎</p>
        </div>

        {/* 玻璃拟态卡片：1px 渐变描边 + 模糊背板 */}
        <div
          className="auth-enter rounded-3xl bg-gradient-to-b from-teal-400/50 via-white/10 to-transparent p-px shadow-2xl shadow-teal-950/60"
          style={{ animationDelay: '120ms' }}
        >
          <div className="rounded-3xl bg-slate-950/70 px-7 py-8 backdrop-blur-xl">
            {/* key 触发步骤切换时重新播放入场动画 */}
            <div key={step} className="auth-enter" style={{ animationDelay: '220ms' }}>
              <div className="mb-6 text-center">
                <h2 className="text-lg font-semibold text-slate-100">
                  {step === 'email' ? '欢迎回来' : '输入验证码'}
                </h2>
                <p className="mt-1 text-sm text-slate-400">
                  {step === 'email' ? '邮箱验证码登录，无需密码' : `验证码已发送至 ${email}`}
                </p>
              </div>

              {step === 'email' ? (
                <form
                  onSubmit={(e) => {
                    e.preventDefault()
                    void handleSendOtp()
                  }}
                  className="space-y-4"
                >
                  <div className="space-y-1.5">
                    <Label htmlFor="auth-email" className="text-slate-300">
                      邮箱
                    </Label>
                    <Input
                      id="auth-email"
                      type="email"
                      autoComplete="email"
                      placeholder="you@example.com"
                      value={email}
                      aria-invalid={showEmailError}
                      onChange={(e) => {
                        setEmail(e.target.value)
                        // 用户修改邮箱时清空旧提示，避免红框与绿色"已发送"提示并存
                        if (message) setMessage(null)
                      }}
                      className="h-11 rounded-xl border-white/10 bg-white/5 text-slate-100 placeholder:text-slate-500 focus-visible:ring-teal-400/60"
                    />
                    {showEmailError && (
                      <p className="text-xs text-rose-400">
                        邮箱格式不正确，请输入有效邮箱（例如 you@example.com）
                      </p>
                    )}
                  </div>
                  {message && (
                    <p className={`text-sm ${message.type === 'error' ? 'text-rose-400' : 'text-emerald-300'}`}>
                      {message.text}
                    </p>
                  )}
                  <Button
                    type="submit"
                    disabled={submitting}
                    className="h-11 w-full rounded-xl bg-gradient-to-r from-teal-400 to-emerald-500 font-semibold text-slate-950 shadow-lg shadow-teal-500/25 transition-all hover:from-teal-300 hover:to-emerald-400 hover:shadow-teal-400/40"
                  >
                    {submitting ? (
                      <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                    ) : (
                      <Mail className="mr-1 h-4 w-4" />
                    )}
                    发送验证码
                  </Button>
                </form>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-slate-300">验证码</Label>
                    <div className="flex justify-center">
                      <InputOTP
                        maxLength={OTP_LENGTH}
                        value={token}
                        onChange={setToken}
                        disabled={submitting}
                      >
                        <InputOTPGroup className="gap-2">
                          {[0, 1, 2, 3, 4, 5].map((i) => (
                            <InputOTPSlot
                              key={i}
                              index={i}
                              className="h-12 w-10 rounded-lg border-white/15 bg-white/5 text-lg font-semibold text-slate-100 first:rounded-lg last:rounded-lg"
                            />
                          ))}
                        </InputOTPGroup>
                      </InputOTP>
                    </div>
                  </div>

                  {message && (
                    <p className={`text-center text-sm ${message.type === 'error' ? 'text-rose-400' : 'text-emerald-300'}`}>
                      {message.text}
                    </p>
                  )}

                  <Button
                    onClick={() => void handleVerify()}
                    disabled={submitting || token.length !== OTP_LENGTH}
                    className="h-11 w-full rounded-xl bg-gradient-to-r from-teal-400 to-emerald-500 font-semibold text-slate-950 shadow-lg shadow-teal-500/25 transition-all hover:from-teal-300 hover:to-emerald-400 hover:shadow-teal-400/40"
                  >
                    {submitting && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
                    进入 FitUp
                  </Button>

                  <div className="flex items-center justify-between text-sm">
                    <Button
                      variant="link"
                      className="h-auto p-0 text-slate-400 hover:text-slate-200"
                      onClick={backToEmail}
                    >
                      ← 换个邮箱
                    </Button>
                    <Button
                      variant="link"
                      className="h-auto p-0 text-teal-300 hover:text-teal-200"
                      disabled={cooldown > 0 || submitting}
                      onClick={() => void handleResend()}
                    >
                      {cooldown > 0 ? `${cooldown}s 后可重发` : '重新发送'}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 特性点缀 */}
        <div
          className="auth-enter mt-6 flex items-center justify-center gap-5 text-xs text-slate-500"
          style={{ animationDelay: '320ms' }}
        >
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5 text-teal-400/80" />
            免密安全登录
          </span>
          <span className="flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-teal-400/80" />
            智能生成计划
          </span>
          <span className="flex items-center gap-1.5">
            <TrendingUp className="h-3.5 w-3.5 text-teal-400/80" />
            追踪每次进步
          </span>
        </div>
      </div>
    </div>
  )
}
