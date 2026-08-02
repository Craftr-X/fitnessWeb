import { format } from 'date-fns'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Dumbbell, Flame } from 'lucide-react'
import {
  LS_KEYS,
  DEFAULT_PROFILE,
  buildWeekPlan,
  useLocalStorage,
} from '@/lib/store'
import type { CheckMap, Profile, WeekFeedback, WeekPlan, WeightEntry } from '@/types'
import Overview from '@/sections/Overview'
import WeeklyPlan from '@/sections/WeeklyPlan'
import BodyData from '@/sections/BodyData'
import Feedback from '@/sections/Feedback'
import Nutrition from '@/sections/Nutrition'
import ThemeToggle from '@/components/ThemeToggle'

function greeting(): string {
  const h = new Date().getHours()
  if (h < 6) return '夜深了'
  if (h < 12) return '早上好'
  if (h < 18) return '下午好'
  return '晚上好'
}

export default function Home() {
  const [profile, setProfile] = useLocalStorage<Profile>(LS_KEYS.profile, DEFAULT_PROFILE)
  const [weekPlan, setWeekPlan] = useLocalStorage<WeekPlan>(
    LS_KEYS.weekPlan,
    () => buildWeekPlan(1),
  )
  const [checks, setChecks] = useLocalStorage<CheckMap>(LS_KEYS.checks, {})
  const [weights, setWeights] = useLocalStorage<WeightEntry[]>(LS_KEYS.weights, () => [
    { date: format(new Date(), 'yyyy-MM-dd'), weight: 50.5, bodyFat: null },
  ])
  const [feedbacks, setFeedbacks] = useLocalStorage<WeekFeedback[]>(LS_KEYS.feedback, [])

  const todayPlan = weekPlan.days[(new Date().getDay() + 6) % 7]
  const latestWeight = weights[weights.length - 1]?.weight

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
          <ThemeToggle />
          <Badge variant="secondary" className="bg-primary/10 text-primary">
            第 {weekPlan.week} 周
          </Badge>
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
                  <div className="text-2xl font-bold">{latestWeight.toFixed(1)}</div>
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

        <Tabs defaultValue="overview">
          <TabsList className="mb-6 grid h-11 w-full grid-cols-5 rounded-full bg-card p-1 shadow-sm">
            <TabsTrigger value="overview" className="rounded-full">总览</TabsTrigger>
            <TabsTrigger value="plan" className="rounded-full">每周计划</TabsTrigger>
            <TabsTrigger value="data" className="rounded-full">数据记录</TabsTrigger>
            <TabsTrigger value="feedback" className="rounded-full">每周反馈</TabsTrigger>
            <TabsTrigger value="nutrition" className="rounded-full">营养建议</TabsTrigger>
          </TabsList>

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
        </Tabs>
      </main>
    </div>
  )
}
