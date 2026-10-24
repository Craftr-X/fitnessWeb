import { describe, it, expect } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import WeeklyPlan from '@/sections/WeeklyPlan'
import { currentMonday } from '@/lib/planEngine'
import type { ActivityMap, CheckMap, ExerciseLogMap, WeekPlan } from '@/types'

const CURRENT_EX = '哑铃弯举'
const WARMUP_EX = '热身：开合跳 + 肩胸动态拉伸'

/** 与 setlog 测试同款固定计划：周一 strength，focus 反查到 chest 肌群 */
const TEST_PLAN: WeekPlan = {
  week: 1,
  startDate: currentMonday(),
  days: [
    {
      day: '周一',
      focus: '胸 + 三头',
      type: 'strength',
      exercises: [
        { name: WARMUP_EX, sets: '5 分钟' },
        { name: CURRENT_EX, sets: '3 组 × 12 次', loadType: 'weighted' },
      ],
    },
    ...Array.from({ length: 6 }, (_, i) => ({
      day: ['周二', '周三', '周四', '周五', '周六', '周日'][i],
      focus: '休息',
      type: 'rest' as const,
      exercises: [],
    })),
  ],
  adjustmentNote: '测试',
}

/**
 * 动作替换交互测试。
 * 关键语义：点选候选 = 槽位就地替换 + 该槽位本周打卡清除；
 * 其他槽位的打卡不受影响（打卡 key 按槽位索引，槽位不变）。
 */
function SwapHarness({ initialChecks = {} }: { initialChecks?: CheckMap }) {
  const [weekPlan, setWeekPlan] = useState(() => TEST_PLAN)
  const [checks, setChecks] = useState<CheckMap>(initialChecks)
  const [, setActivity] = useState<ActivityMap>({})
  return (
    <>
      <WeeklyPlan
        weekPlan={weekPlan}
        setWeekPlan={setWeekPlan}
        checks={checks}
        setChecks={setChecks}
        setLogs={{} as ExerciseLogMap}
        setSetLogs={() => {}}
        feedbacks={[]}
        onGoFeedback={() => {}}
        setActivity={setActivity}
      />
    </>
  )
}

function rowFor(name: string): HTMLElement {
  return screen.getByText(name).closest('div')!.parentElement!
}

/** Radix Checkbox 是 button[role=checkbox]，勾选状态在 data-state 上（非原生 .checked） */
function isChecked(row: HTMLElement): boolean {
  return within(row).getByRole('checkbox').getAttribute('data-state') === 'checked'
}

describe('动作替换', () => {
  it('正式动作有换动作入口，热身（纯时长）没有', () => {
    render(<SwapHarness />)
    expect(within(rowFor(CURRENT_EX)).getByRole('button', { name: `为${CURRENT_EX}更换动作` })).toBeInTheDocument()
    expect(within(rowFor(WARMUP_EX)).queryByRole('button', { name: /更换动作/ })).not.toBeInTheDocument()
  })

  it('弹窗候选为同肌群池且不含当前动作，组数按当周口径', async () => {
    const user = userEvent.setup()
    render(<SwapHarness />)
    await user.click(within(rowFor(CURRENT_EX)).getByRole('button', { name: `为${CURRENT_EX}更换动作` }))
    const dialog = await screen.findByRole('dialog')
    // chest + 无器械池：俯卧撑 / 上斜俯卧撑 / 毛巾飞鸟（当前动作不在该池，无排除效果）
    expect(within(dialog).getByText('毛巾飞鸟')).toBeInTheDocument()
    expect(within(dialog).getByText('上斜俯卧撑（手撑床沿/凳子）')).toBeInTheDocument()
    // 候选按钮里没有当前动作（弹窗描述文案里会提到它，按按钮角色过滤）
    expect(within(dialog).queryByRole('button', { name: new RegExp(CURRENT_EX) })).not.toBeInTheDocument()
    // 第 1 周新手增肌：3 组 × 8-12 次（部分候选带 note 后缀，用正则匹配）
    expect(within(dialog).getAllByText(/3 组 × \d+-\d+ 次/).length).toBeGreaterThan(0)
  })

  it('点选候选：槽位被替换，该槽位打卡清除，其他槽位打卡保留', async () => {
    const user = userEvent.setup()
    const initialChecks: CheckMap = { '1:0:0': true, '1:0:1': true } // 热身 + 哑铃弯举都打了卡（key = 周:日:动作）
    render(<SwapHarness initialChecks={initialChecks} />)
    expect(isChecked(rowFor(CURRENT_EX))).toBe(true)

    await user.click(within(rowFor(CURRENT_EX)).getByRole('button', { name: `为${CURRENT_EX}更换动作` }))
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByText('毛巾飞鸟'))

    // 槽位被替换为新动作，打卡回到未勾选（动作变了旧打卡不成立）
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(rowFor('毛巾飞鸟')).toBeInTheDocument()
    expect(screen.queryByText(CURRENT_EX)).not.toBeInTheDocument()
    expect(isChecked(rowFor('毛巾飞鸟'))).toBe(false)
    // 其他槽位（热身）的打卡不受影响
    expect(isChecked(rowFor(WARMUP_EX))).toBe(true)
  })
})
