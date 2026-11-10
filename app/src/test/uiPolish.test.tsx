import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, it, expect } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import Overview from '@/sections/Overview'
import TodayHero from '@/components/TodayHero'
import BodyData from '@/sections/BodyData'
import ExerciseDemoButton from '@/components/ExerciseDemoButton'
import { pickVideoPoster } from '@/lib/demos'
import { buildWeekPlanFromProfile } from '@/lib/planEngine'
import type { DemoInfo } from '@/lib/demos'
import type { Profile } from '@/types'

/**
 * T8 页面整洁与体验打磨的回归测试：
 * 折叠行为、数字去重、读写性约定、空态文案、弱网首帧。
 * 详见 docs/2026-11-10-t8-ui-polish-plan.md §2 / §3。
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

const WEEK_PLAN = buildWeekPlanFromProfile(PROFILE, 1)

function renderOverview() {
  return render(
    <Overview
      profile={PROFILE}
      setProfile={() => {}}
      weekPlan={WEEK_PLAN}
      weights={[{ date: '2026-11-02', weight: 72.4 }]}
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

const tipsIn = (container: HTMLElement) =>
  container.querySelector('#key-tips')?.querySelectorAll('li').length ?? -1

describe('关键提醒折叠', () => {
  it('默认只显示 2 条，按钮标记未展开', () => {
    const { container } = renderOverview()
    expect(tipsIn(container)).toBe(2)
    expect(screen.getByRole('button', { name: '查看全部 5 条提醒' })).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByRole('button', { name: '查看全部 5 条提醒' })).toHaveAttribute('aria-controls', 'key-tips')
  })

  it('展开后 5 条齐全，且标记已展开', () => {
    const { container } = renderOverview()
    fireEvent.click(screen.getByRole('button', { name: '查看全部 5 条提醒' }))
    expect(tipsIn(container)).toBe(5)
    expect(screen.getByRole('button', { name: '收起提醒' })).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText(/睡够 7-9 小时/)).toBeInTheDocument()
  })

  it('再点一次收起，回到 2 条（内容不丢，只是收起）', () => {
    const { container } = renderOverview()
    fireEvent.click(screen.getByRole('button', { name: '查看全部 5 条提醒' }))
    fireEvent.click(screen.getByRole('button', { name: '收起提醒' }))
    expect(tipsIn(container)).toBe(2)
    expect(screen.queryByText(/睡够 7-9 小时/)).not.toBeInTheDocument()
  })
})

describe('完成度数字去重', () => {
  it('Overview 不再出现「已打卡 x / y」', () => {
    renderOverview()
    expect(screen.queryByText(/已打卡/)).not.toBeInTheDocument()
  })

  it('卡片标题改为「本周 vs 上周」，不再重复「第 N 周进度」', () => {
    renderOverview()
    expect(screen.getByText('本周 vs 上周')).toBeInTheDocument()
    expect(screen.queryByText(/周进度/)).not.toBeInTheDocument()
  })

  it('T1 的三行对比与填写反馈按钮仍在', () => {
    renderOverview()
    expect(screen.getByText('完成度')).toBeInTheDocument()
    expect(screen.getByText('训练天数')).toBeInTheDocument()
    expect(screen.getByText('体重', { exact: true })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /填写本周反馈/ })).toBeInTheDocument()
  })
})

describe('英雄卡与周数口径', () => {
  const heroT = () =>
    render(
      <TodayHero
        weekPlan={WEEK_PLAN}
        todayPlan={WEEK_PLAN.days[0]}
        todayIdx={0}
        dayChecked={new Array<boolean>(7).fill(false)}
        daysTrained={0}
        done={0}
        total={WEEK_PLAN.days.reduce((n, d) => n + d.exercises.length, 0)}
        latestWeight={null}
        weeksPersisted={1}
        onStart={() => {}}
      />,
    )

  it('进度环仍是唯一的完成度锚点', () => {
    const { container } = heroT()
    expect(container.querySelector('svg circle')).toBeInTheDocument()
    expect(container.querySelector('[title*="已打卡"]')).toBeInTheDocument()
  })

  it('周数文案改为「计划周数」，不再用「已坚持周数」', () => {
    heroT()
    expect(screen.getByText('计划周数')).toBeInTheDocument()
    expect(screen.queryByText('已坚持周数')).not.toBeInTheDocument()
  })
})

describe('数据页空态说明', () => {
  const renderBodyData = (weights: { date: string; weight: number }[]) =>
    render(
      <BodyData
        weights={weights}
        setWeights={() => {}}
        heightCm={178}
        activity={{}}
        feedbacks={[]}
      />,
    )

  it('无记录时四个统计块都有说明文案，不再是孤立「—」', () => {
    renderBodyData([])
    expect(screen.getByText('还没有体重记录')).toBeInTheDocument()
    expect(screen.getByText('记录体脂后显示')).toBeInTheDocument()
    expect(screen.getByText('满 7 天后显示')).toBeInTheDocument()
    expect(screen.getByText('填体重后自动计算')).toBeInTheDocument()
    expect(screen.getByText('BMI（自动计算）')).toBeInTheDocument()
  })

  it('有记录时说明让位给正常标签', () => {
    renderBodyData([{ date: '2026-11-02', weight: 72.4 }])
    expect(screen.getByText('当前 BMI')).toBeInTheDocument()
    expect(screen.queryByText('填体重后自动计算')).not.toBeInTheDocument()
  })
})

const DEMO: DemoInfo = {
  level: '初级',
  front: [
    { type: 'video', url: 'https://example.com/front.mp4' },
    { type: 'img', url: 'https://example.com/front.jpg' },
  ],
  side: [{ type: 'img', url: 'https://example.com/side.jpg' }],
  steps: ['双手撑地，缓慢下放'],
}

describe('动作示范首帧', () => {
  it('复用同组备用静态图作为 poster', () => {
    expect(pickVideoPoster(DEMO.front)).toBe('https://example.com/front.jpg')
  })

  it('没有静态图源时返回 undefined，交给 CSS 占位', () => {
    expect(pickVideoPoster([{ type: 'video', url: 'https://example.com/a.mp4' }])).toBeUndefined()
  })

  it('弹层里的 video 带上 poster 属性', () => {
    const { container } = render(<ExerciseDemoButton exerciseName="俯卧撑" demo={DEMO} />)
    fireEvent.click(container.querySelector('button')!)
    const video = document.querySelector('video')
    expect(video).not.toBeNull()
    expect(video?.getAttribute('poster')).toBe('https://example.com/front.jpg')
  })
})

describe('可读性约定（防止低对比度类名回流）', () => {
  const files = [
    'src/components/TodayHero.tsx',
    'src/components/TransformationDialog.tsx',
    'src/components/RestTimer.tsx',
    'src/components/ExerciseDemoButton.tsx',
    'src/sections/Overview.tsx',
    'src/sections/BodyData.tsx',
    'src/sections/WeeklyPlan.tsx',
  ]
  const sourceOf = (f: string) => readFileSync(resolve(process.cwd(), f), 'utf-8')

  it('不再有 10/11px 的小字', () => {
    for (const f of files) expect(sourceOf(f)).not.toMatch(/text-\[(10|11)px\]/)
  })

  it('深色卡片文字不再二次降透明度', () => {
    for (const f of files) expect(sourceOf(f)).not.toMatch(/text-white\/(40|50|60|70|75|80)\b/)
  })

  it('次要文字不再在 muted 上再降透明度', () => {
    for (const f of files) expect(sourceOf(f)).not.toMatch(/text-muted-foreground\/(60|70)\b/)
  })
})
