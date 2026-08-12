import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { format } from 'date-fns'
import { toast } from 'sonner'
import type { User } from '@supabase/supabase-js'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Spinner } from '@/components/ui/spinner'
import { ArrowRight, Dumbbell, Flame, LogOut, MessageCircle } from 'lucide-react'
import { useCountUp } from '@/hooks/useCountUp'
import { currentMonday, hasUsageTrace, mergeOnboardingWeight, needsOnboarding, useCloudStorage, WEIGHT_GOAL_LABEL, weeksBetween } from '@/lib/store'
import { buildNextWeekPlan } from '@/lib/planEngine'
import { useAuth } from '@/hooks/useAuth'
import ThemeToggle from '@/components/ThemeToggle'
import AppSplash from '@/components/AppSplash'
import FeedbackDialog from '@/components/FeedbackDialog'
import Onboarding from '@/pages/Onboarding'
import type { Profile, WeekPlan } from '@/types'

// 路由级懒加载：5 个 section 按需加载，减轻首屏 bundle
const Overview = lazy(() => import('@/sections/Overview'))
const WeeklyPlan = lazy(() => import('@/sections/WeeklyPlan'))
const BodyData = lazy(() => import('@/sections/BodyData'))
const Feedback = lazy(() => import('@/sections/Feedback'))
const Nutrition = lazy(() => import('@/sections/Nutrition'))

function greeting(): string {
  const h = new Date().getHours()
  if (h < 6) return '夜深了'
  if (h < 12) return '早上好'
  if (h < 18) return '下午好'
  return '晚上好'
}

export default function Home({ user }: { user: User }) {
  const cloud = useCloudStorage(user.id)
  const { signOut } = useAuth()
  const { ready, migrated, syncError } = cloud
  const [profile, setProfile] = cloud.profile
  const [weekPlan, setWeekPlan] = cloud.weekPlan
  const [checks, setChecks] = cloud.checks
  const [weights, setWeights] = cloud.weights
  const [feedbacks, setFeedbacks] = cloud.feedbacks
  const [setLogs, setSetLogs] = cloud.setLogs
  const [tab, setTab] = useState('overview')

  // 未 onboarded 一律走引导：真·新用户首次配置；老用户（账号体系上线前已有数据）
  // 借此软迁移到规则引擎计划——onboarding 是生成计划的唯一入口
  const trace = { checks, feedbacks, weights, weekPlan }
  const needsOnboardingVal = needsOnboarding({ ready, onboarded: profile.onboarded })
  // 老用户迁移：走引导时带上已有画像预填（最新真实体重取自 weights，仅 onboarding 写入的 1 条不算）
  const isLegacyMigration = needsOnboardingVal && hasUsageTrace(trace)

  // 进入新自然周后自动生成新一周计划：跨多周时一次性补齐到当前周
  const rolledOver = useRef(false) // 防止 StrictMode 下 effect 双跑重复弹提示
  useEffect(() => {
    if (!ready || rolledOver.current || needsOnboardingVal) return
    const gap = weeksBetween(weekPlan.startDate, currentMonday())
    if (gap <= 0) return
    rolledOver.current = true
    // 多周未打开 App：跳到当前周；gap=1 为正常跨周
    const targetWeek = weekPlan.week + gap
    const lastFb = feedbacks.find((f) => f.week === weekPlan.week)
    const next = buildNextWeekPlan(profile, weekPlan, lastFb, targetWeek)
    setWeekPlan(next)
    toast.success(
      gap === 1
        ? `📅 新的一周开始了，已为你生成第 ${targetWeek} 周计划！`
        : `📅 你离开了 ${gap} 周，已把计划推进到第 ${targetWeek} 周（中间周未打卡，可按需补练）。`,
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready])

  // 旧版本地数据迁移提示
  const migrationNotified = useRef(false)
  useEffect(() => {
    if (!ready || !migrated || migrationNotified.current) return
    migrationNotified.current = true
    toast.success('📦 已把本机的历史数据迁移到你的云端账号！')
  }, [ready, migrated])

  // 同步状态提示：失败时驻留 toast，网络恢复（syncError 转 false）后自动消失。
  // 用固定 id 去重，避免每次防抖都弹新 toast。
  useEffect(() => {
    if (syncError) {
      toast.error('同步失败，数据已暂存本地，网络恢复后会自动重试', {
        id: 'sync-error',
        duration: Infinity,
      })
    } else {
      toast.dismiss('sync-error')
    }
  }, [syncError])

  // 把 onboarding 采集的体重落到 weights（逻辑见 store.mergeOnboardingWeight，已单测覆盖）
  const syncWeightFromProfile = (weightKg: number) => {
    if (weightKg <= 0) return
    const today = format(new Date(), 'yyyy-MM-dd')
    setWeights((prev) => mergeOnboardingWeight(prev, weightKg, today))
  }

  // onboarding 完成：写入 profile + 生成匹配的第 1 周计划
  const handleOnboard = (newProfile: Profile, newPlan: WeekPlan) => {
    setProfile({ ...newProfile, onboarded: true })
    setWeekPlan(newPlan)
    // 旧打卡 key（周:日:动作序号）会错配到新计划，直接清空；
    // 历史完成度已快照在 feedbacks.completion，体重历史保留
    setChecks({})
    syncWeightFromProfile(newProfile.weightKg ?? 0)
    rolledOver.current = true // 防止刚生成的计划立即触发 rollover
    toast.success(
      isLegacyMigration
        ? '🎉 已按你的画像生成新计划！历史体重与反馈已保留。'
        : '🎉 你的专属健身计划已生成！',
    )
  }

  // 重新定制完成（老用户）：重置为第 1 周
  const handleRebuild = (newProfile: Profile, newPlan: WeekPlan) => {
    setProfile({ ...newProfile, onboarded: true })
    setWeekPlan(newPlan)
    setChecks({}) // 同 handleOnboard：防止旧打卡错配到新计划
    syncWeightFromProfile(newProfile.weightKg ?? 0)
    toast.success('🔄 计划已按你的最新情况重新生成！')
  }

  const handleSignOut = async () => {
    const ok = await cloud.flush() // 把防抖窗口内的最新数据先写入云端
    if (!ok) {
      // 数据未同步但不丢：dirty 标记仍在，下次登录会自动重推
      toast.warning('部分数据未能同步，下次登录会自动重试')
    }
    await signOut()
  }

  const todayIdx = (new Date().getDay() + 6) % 7
  const todayPlan = weekPlan.days[todayIdx]
  const latestWeight = weights[weights.length - 1]?.weight

  // 本周打卡统计：完成项数 + 每天是否打过卡（作战卡进度环 / 打卡点用）
  const { done, total, dayChecked } = useMemo(() => {
    let d = 0
    let t = 0
    const perDay = new Array<boolean>(7).fill(false)
    weekPlan.days.forEach((day, di) => {
      day.exercises.forEach((_, ei) => {
        t += 1
        if (checks[`${weekPlan.week}:${di}:${ei}`]) {
          d += 1
          perDay[di] = true
        }
      })
    })
    return { done: d, total: t, dayChecked: perDay }
  }, [weekPlan, checks])
  const weekPct = total === 0 ? 0 : Math.round((done / total) * 100)
  const daysTrained = dayChecked.filter(Boolean).length

  // 作战卡数字 count-up
  const animatedPct = useCountUp(weekPct)
  const animatedWeight = useCountUp(latestWeight ?? 0)
  const animatedWeeks = useCountUp(feedbacks.length)

  // 新用户首次进入 / 老用户软迁移：走 onboarding 引导（老用户带画像预填）
  if (needsOnboardingVal) {
    const existing: Profile | undefined = isLegacyMigration
      ? { ...profile, weightKg: weights.length > 1 ? latestWeight : profile.weightKg }
      : undefined
    return <Onboarding existing={existing} onComplete={handleOnboard} />
  }

  if (!ready) {
    return <AppSplash />
  }

  return (
    <div className="relative min-h-screen bg-gradient-to-b from-primary/5 via-background to-background">
      {/* 背景装饰：与登录页呼应的点阵网格 + 极光光斑（浅色下更淡） */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <div className="auth-grid absolute inset-0 opacity-50 dark:opacity-100" />
        <div
          className="auth-aurora -top-24 left-[8%] h-72 w-72 bg-teal-400/10 dark:bg-teal-500/20"
          style={{ animation: 'aurora-1 20s ease-in-out infinite' }}
        />
        <div
          className="auth-aurora right-[4%] top-48 h-64 w-64 bg-emerald-400/8 dark:bg-emerald-500/15"
          style={{ animation: 'aurora-2 24s ease-in-out infinite' }}
        />
      </div>

      <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-emerald-500 text-white shadow-md shadow-teal-500/30">
            <Dumbbell className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <h1 className="text-lg font-bold leading-tight">FitUp 健身计划</h1>
            <p className="text-xs text-muted-foreground">
              {profile.heightCm} cm · 目标：{profile.weightGoal ? WEIGHT_GOAL_LABEL[profile.weightGoal] : '—'}
            </p>
          </div>
          <span className="hidden max-w-40 truncate text-xs text-muted-foreground sm:block">
            {user.email}
          </span>
          <Tooltip>
            <FeedbackDialog
              trigger={
                <TooltipTrigger asChild>
                  <Button size="icon" variant="ghost" aria-label="意见反馈">
                    <MessageCircle className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </TooltipTrigger>
              }
            />
            <TooltipContent>意见反馈</TooltipContent>
          </Tooltip>
          <ThemeToggle />
          <Badge variant="secondary" className="bg-primary/10 text-primary">
            第 {weekPlan.week} 周
          </Badge>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button size="icon" variant="ghost" aria-label="退出登录" onClick={handleSignOut}>
                <LogOut className="h-4 w-4 text-muted-foreground" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>退出登录</TooltipContent>
          </Tooltip>
        </div>
      </header>

      <main className="relative mx-auto max-w-5xl px-4 py-5">
        {/* 今日作战卡 */}
        <div className="relative mb-6 overflow-hidden rounded-2xl bg-gradient-to-br from-teal-600 via-teal-500 to-emerald-500 p-5 text-white shadow-lg shadow-teal-500/25 sm:p-6">
          {/* 卡内装饰：细网格 + 光斑 */}
          <div
            className="pointer-events-none absolute inset-0 opacity-35"
            style={{
              backgroundImage:
                'linear-gradient(to right, rgb(255 255 255 / 0.09) 1px, transparent 1px), linear-gradient(to bottom, rgb(255 255 255 / 0.09) 1px, transparent 1px)',
              backgroundSize: '28px 28px',
            }}
            aria-hidden
          />
          <div className="pointer-events-none absolute -right-10 -top-16 h-48 w-48 rounded-full bg-white/15 blur-2xl" aria-hidden />
          <div className="pointer-events-none absolute -bottom-16 right-28 h-40 w-40 rounded-full bg-emerald-300/25 blur-2xl" aria-hidden />

          <div className="relative flex flex-wrap items-center gap-5">
            <div className="min-w-56 flex-1">
              <p className="text-sm text-white/80">{greeting()}！{format(new Date(), 'M月d日')}</p>
              <h2 className="mt-0.5 text-xl font-bold">
                今天：{todayPlan.day} · {todayPlan.focus}
              </h2>
              <p className="mt-1 text-sm text-white/80">
                {todayPlan.type === 'rest'
                  ? '休息日也要记得拉伸和好好吃饭 💪'
                  : todayPlan.type === 'sport'
                    ? '羽毛球日！尽情挥洒汗水，注意补水 🏸'
                    : '练前别忘了 5 分钟热身，动作质量优先 🔥'}
              </p>

              {/* 本周打卡点：亮=当天有打卡，光环=今天 */}
              <div className="mt-3 flex items-center gap-1.5">
                {weekPlan.days.map((d, di) => (
                  <span
                    key={di}
                    title={d.day}
                    className={`h-2.5 w-2.5 rounded-full transition-colors ${
                      dayChecked[di] ? 'bg-white shadow-sm shadow-white/60' : 'bg-white/25'
                    } ${di === todayIdx ? 'ring-2 ring-white/80 ring-offset-2 ring-offset-teal-500' : ''}`}
                  />
                ))}
                <span className="ml-2 text-xs text-white/75">本周已练 {daysTrained} 天</span>
              </div>

              <Button
                onClick={() => setTab('plan')}
                className="mt-4 bg-white font-semibold text-teal-700 shadow-md transition-transform hover:scale-[1.03] hover:bg-teal-50"
              >
                {todayPlan.type === 'rest' ? '查看本周计划' : '开始今日训练'}
                <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </div>

            <div className="flex items-center gap-6 pr-1">
              {/* 本周完成度进度环 */}
              <div className="relative h-20 w-20" title={`已打卡 ${done} / ${total} 项`}>
                <svg viewBox="0 0 80 80" className="h-20 w-20 -rotate-90">
                  <circle cx="40" cy="40" r="34" fill="none" stroke="rgba(255,255,255,0.22)" strokeWidth="7" />
                  <circle
                    cx="40"
                    cy="40"
                    r="34"
                    fill="none"
                    stroke="#fff"
                    strokeWidth="7"
                    strokeLinecap="round"
                    strokeDasharray={2 * Math.PI * 34}
                    strokeDashoffset={2 * Math.PI * 34 * (1 - animatedPct / 100)}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-lg font-bold leading-none">{Math.round(animatedPct)}%</span>
                  <span className="mt-0.5 text-[10px] text-white/75">本周进度</span>
                </div>
              </div>

              <div className="space-y-3">
                {latestWeight && (
                  <div className="text-center">
                    <div className="text-2xl font-bold tabular-nums">{animatedWeight.toFixed(2)}</div>
                    <div className="text-xs text-white/75">当前体重 kg</div>
                  </div>
                )}
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1 text-2xl font-bold tabular-nums">
                    <Flame className="h-5 w-5" />
                    {Math.round(animatedWeeks)}
                  </div>
                  <div className="text-xs text-white/75">已坚持周数</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="mb-6 grid h-11 w-full grid-cols-5 rounded-full bg-card p-1 shadow-sm">
            <TabsTrigger value="overview" className="rounded-full">总览</TabsTrigger>
            <TabsTrigger value="plan" className="rounded-full">每周计划</TabsTrigger>
            <TabsTrigger value="data" className="rounded-full">数据记录</TabsTrigger>
            <TabsTrigger value="feedback" className="rounded-full">每周反馈</TabsTrigger>
            <TabsTrigger value="nutrition" className="rounded-full">营养建议</TabsTrigger>
          </TabsList>

          {/* Suspense 包整个 Tabs：Radix Tabs 默认只挂载当前 Tab，切 Tab 时触发对应 section 的懒加载 */}
          <Suspense
            fallback={
              <div className="flex items-center justify-center py-20">
                <Spinner className="h-6 w-6" />
              </div>
            }
          >
            <TabsContent value="overview" className="fade-enter">
              <Overview
                profile={profile}
                setProfile={setProfile}
                weekPlan={weekPlan}
                weights={weights}
                checks={checks}
                feedbacks={feedbacks}
                onRebuild={handleRebuild}
              />
            </TabsContent>
            <TabsContent value="plan" className="fade-enter">
              <WeeklyPlan
                weekPlan={weekPlan}
                setWeekPlan={setWeekPlan}
                checks={checks}
                setChecks={setChecks}
                setLogs={setLogs}
                setSetLogs={setSetLogs}
                feedbacks={feedbacks}
                onGoFeedback={() => setTab('feedback')}
                profile={profile}
              />
            </TabsContent>
            <TabsContent value="data" className="fade-enter">
              <BodyData weights={weights} setWeights={setWeights} heightCm={profile.heightCm} />
            </TabsContent>
            <TabsContent value="feedback" className="fade-enter">
              <Feedback
                feedbacks={feedbacks}
                setFeedbacks={setFeedbacks}
                weekPlan={weekPlan}
                setWeekPlan={setWeekPlan}
                profile={profile}
                onGoPlan={() => setTab('plan')}
              />
            </TabsContent>
            <TabsContent value="nutrition" className="fade-enter">
              <Nutrition weights={weights} weightGoal={profile.weightGoal} />
            </TabsContent>
          </Suspense>
        </Tabs>
      </main>
    </div>
  )
}
