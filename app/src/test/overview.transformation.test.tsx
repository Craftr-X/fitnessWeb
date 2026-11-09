import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import Overview from '@/sections/Overview'
import { buildWeekPlanFromProfile } from '@/lib/planEngine'
import type { Profile, WeightEntry } from '@/types'

/**
 * 「我的蜕变」入口按数据量收起：不足 4 周或体重记录 <2 条时不显示，
 * 数据够了恢复显示（T2）。同时保证收起后卡片底部不留布局空洞。
 */
const PROFILE: Profile = {
  name: '我',
  heightCm: 178,
  onboarded: true,
  gender: 'male',
  age: 25,
  weightKg: 72.4,
  weightGoal: 'gain',
  experience: 'beginner',
  trainDaysPerWeek: 3,
  equipment: 'dumbbell',
  sport: 'badminton',
  sportHours: 2,
  injuries: [],
}

const TWO_WEIGHTS: WeightEntry[] = [
  { date: '2026-10-12', weight: 71.2 },
  { date: '2026-11-02', weight: 72.4 },
]

function renderOverview(week: number, weights: WeightEntry[]) {
  return render(
    <Overview
      profile={PROFILE}
      setProfile={() => {}}
      weekPlan={buildWeekPlanFromProfile(PROFILE, week)}
      weights={weights}
      checks={{}}
      feedbacks={[]}
      setLogs={{}}
      activity={{}}
      onRebuild={() => {}}
      onOpenFeedback={() => {}}
      onOpenNutrition={() => {}}
    />,
  )
}

describe('「我的蜕变」入口按数据量收起', () => {
  it('第 1 周新用户：看不到入口，卡片底部只剩「重新定制我的计划」', () => {
    renderOverview(1, [{ date: '2026-11-02', weight: 72.4 }])
    expect(screen.queryByRole('button', { name: /我的蜕变/ })).not.toBeInTheDocument()
    // 无布局空洞：上一个按钮仍在
    expect(screen.getByRole('button', { name: /重新定制我的计划/ })).toBeInTheDocument()
  })

  it('边界：第 4 周但只有 1 条体重、或第 3 周有 2 条体重，都收起', () => {
    const { unmount } = renderOverview(4, [{ date: '2026-11-02', weight: 72.4 }])
    expect(screen.queryByRole('button', { name: /我的蜕变/ })).not.toBeInTheDocument()
    unmount()

    renderOverview(3, TWO_WEIGHTS)
    expect(screen.queryByRole('button', { name: /我的蜕变/ })).not.toBeInTheDocument()
  })

  it('第 4 周且 ≥2 条体重记录：入口出现', () => {
    renderOverview(4, TWO_WEIGHTS)
    expect(screen.getByRole('button', { name: /我的蜕变/ })).toBeInTheDocument()
  })
})
