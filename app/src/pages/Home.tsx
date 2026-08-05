import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { format } from 'date-fns'
import { toast } from 'sonner'
import type { User } from '@supabase/supabase-js'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { Dumbbell, Flame, LogOut } from 'lucide-react'
import { buildWeekPlan, currentMonday, useCloudStorage, weeksBetween } from '@/lib/store'
import { useAuth } from '@/hooks/useAuth'
import ThemeToggle from '@/components/ThemeToggle'

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
  const { ready, migrated } = cloud
  const [profile, setProfile] = cloud.profile
  const [weekPlan, setWeekPlan] = cloud.weekPlan
  const [checks, setChecks] = cloud.checks
  const [weights, setWeights] = cloud.weights
  const [feedbacks, setFeedbacks] = cloud.feedbacks
  const [tab, setTab] = useState('overview')

  // 进入新自然周后自动生成新一周计划：跨多周时一次性补齐到当前周
  const rolledOver = useRef(false) // 防止 StrictMode 下 effect 双跑重复弹提示
  useEffect(() => {
    if (!ready || rolledOver.current) return
    const gap = weeksBetween(weekPlan.startDate, currentMonday())
    if (gap <= 0) return
    rolledOver.current = true
    // 多周未打开 App：跳到当前周；gap=1 为正常跨周
    const targetWeek = weekPlan.week + gap
    const lastFb = feedbacks.find((f) => f.week === weekPlan.week)
    setWeekPlan(buildWeekPlan(targetWeek, lastFb?.difficulty))
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

  const handleSignOut = async () => {
    await cloud.flush() // 把防抖窗口内的最新数据先写入云端
    await signOut()
  }

  const todayPlan = weekPlan.days[(new Date().getDay() + 6) % 7]
  const latestWeight = weights[weights.length - 1]?.weight

  if (!ready) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3">
        <Spinner className="h-8 w-8" />
        <p className="text-sm text-muted-foreground">正在同步你的数据…</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary/5 via-background to-background">
      <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-emerald-500 text-white shadow-md shadow-teal-500/30">
            <Dumbbell className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <h1 className="text-lg font-bold leading-tight">FitUp 健身计划</h1>
            <p className="text-xs text-muted-foreground">
              {profile.heightCm} cm · 目标：{profile.goal}
            </p>
          </div>
          <span className="hidden max-w-40 truncate text-xs text-muted-foreground sm:block">
            {user.email}
          </span>
          <ThemeToggle />
          <Badge variant="secondary" className="bg-primary/10 text-primary">
            第 {weekPlan.week} 周
          </Badge>
          <Button size="icon" variant="ghost" title="退出登录" onClick={handleSignOut}>
            <LogOut className="h-4 w-4 text-muted-foreground" />
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-5">
        {/* 欢迎横幅 */}
        <div className="relative mb-6 overflow-hidden rounded-2xl bg-gradient-to-r from-teal-500 via-teal-500 to-emerald-500 p-5 text-white shadow-lg shadow-teal-500/25">
          <div className="pointer-events-none absolute -right-8 -top-10 h-40 w-40 rounded-full bg-white/10" />
          <div className="pointer-events-none absolute -bottom-12 right-16 h-32 w-32 rounded-full bg-white/10" />
          <div className="relative flex flex-wrap items-center gap-4">
            <div className="flex-1">
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
            </div>
            <div className="flex items-center gap-6 pr-2">
              {latestWeight && (
                <div className="text-center">
                  <div className="text-2xl font-bold">{latestWeight.toFixed(2)}</div>
                  <div className="text-xs text-white/75">当前体重 kg</div>
                </div>
              )}
              <div className="text-center">
                <div className="flex items-center gap-1 text-2xl font-bold">
                  <Flame className="h-5 w-5" />
                  {feedbacks.length}
                </div>
                <div className="text-xs text-white/75">已坚持周数</div>
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
            <TabsContent value="overview">
              <Overview
                profile={profile}
                setProfile={setProfile}
                weekPlan={weekPlan}
                weights={weights}
                checks={checks}
                feedbacks={feedbacks}
              />
            </TabsContent>
            <TabsContent value="plan">
              <WeeklyPlan
                weekPlan={weekPlan}
                setWeekPlan={setWeekPlan}
                checks={checks}
                setChecks={setChecks}
                feedbacks={feedbacks}
                onGoFeedback={() => setTab('feedback')}
              />
            </TabsContent>
            <TabsContent value="data">
              <BodyData weights={weights} setWeights={setWeights} heightCm={profile.heightCm} />
            </TabsContent>
            <TabsContent value="feedback">
              <Feedback feedbacks={feedbacks} setFeedbacks={setFeedbacks} weekPlan={weekPlan} />
            </TabsContent>
            <TabsContent value="nutrition">
              <Nutrition weights={weights} />
            </TabsContent>
          </Suspense>
        </Tabs>
      </main>
    </div>
  )
}
