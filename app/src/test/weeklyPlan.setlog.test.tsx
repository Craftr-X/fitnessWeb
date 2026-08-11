import { describe, it, expect } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { addDays, format } from 'date-fns'
import WeeklyPlan from '@/sections/WeeklyPlan'
import { buildWeekPlan } from '@/lib/store'
import { Toaster } from '@/components/ui/sonner'
import type { CheckMap, ExerciseLogMap } from '@/types'

/**
 * WeeklyPlan 训记式重量记录弹窗的交互测试（三种负荷类型）。
 * 关键语义：弹窗内编辑只落在本地草稿，点「完成」且校验通过才保存；
 * X / 遮罩关闭 = 丢弃本次修改。
 * 负重动作（哑铃弯举）：重量+次数；自重动作（俯卧撑）：只记次数；时间类（平板支撑）：只记秒数。
 */

function Harness({ initialLogs = {} }: { initialLogs?: ExerciseLogMap }) {
  const [weekPlan] = useState(() => buildWeekPlan(1))
  const [checks, setChecks] = useState<CheckMap>({})
  const [setLogs, setSetLogs] = useState<ExerciseLogMap>(initialLogs)
  return (
    <>
      <WeeklyPlan
        weekPlan={weekPlan}
        setWeekPlan={() => {}}
        checks={checks}
        setChecks={setChecks}
        setLogs={setLogs}
        setSetLogs={setSetLogs}
        feedbacks={[]}
        onGoFeedback={() => {}}
      />
      <Toaster />
    </>
  )
}

type User = ReturnType<typeof userEvent.setup>

const WEIGHTED_EX = '哑铃弯举'
const BODYWEIGHT_EX = '俯卧撑（跪姿可退阶）'
const TIMED_EX = '平板支撑'

const today = new Date()
const todayStr = format(today, 'yyyy-MM-dd')
/** 本周日：一定落在本周内（>= startDate）且不是今天，用于本周历史用例 */
const sundayStr = format(addDays(new Date(buildWeekPlan(1).startDate + 'T00:00:00'), 6), 'yyyy-MM-dd')

/** 指定动作所在的动作行容器 */
function rowFor(name: string): HTMLElement {
  return screen.getByText(name).closest('div')!.parentElement!
}

/** 动作行里的记录入口按钮 */
function loggerTrigger(row: HTMLElement) {
  return within(row).getByRole('button', { name: /记录重量|记录次数|记录时长|上次|本次/ })
}

/** 打开指定动作的记录弹窗 */
async function openDialogFor(user: User, name: string) {
  await user.click(loggerTrigger(rowFor(name)))
  return screen.findByRole('dialog')
}

/** 填写第 n 组（先清空默认值再输入） */
async function fillSet(user: User, n: number, weight: string, reps: string) {
  const w = screen.getByLabelText(`第 ${n} 组重量（kg）`)
  const r = screen.getByLabelText(`第 ${n} 组次数`)
  await user.clear(w)
  await user.type(w, weight)
  await user.clear(r)
  await user.type(r, reps)
}

describe('记录入口按负荷类型区分', () => {
  it('负重=记录重量，自重=记录次数，时间类=记录时长，纯时长动作无入口', () => {
    render(<Harness />)
    expect(within(rowFor(WEIGHTED_EX)).getByRole('button', { name: '记录重量' })).toBeInTheDocument()
    expect(within(rowFor(BODYWEIGHT_EX)).getByRole('button', { name: '记录次数' })).toBeInTheDocument()
    expect(within(rowFor(TIMED_EX)).getByRole('button', { name: '记录时长' })).toBeInTheDocument()
    expect(rowFor('热身：开合跳 + 肩胸动态拉伸').textContent).not.toMatch(/记录/)
  })
})

describe('负重动作（哑铃弯举）', () => {
  it('无历史记录时重量和次数默认为 0', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await openDialogFor(user, WEIGHTED_EX)
    expect((screen.getByLabelText('第 1 组重量（kg）') as HTMLInputElement).value).toBe('0')
    expect((screen.getByLabelText('第 3 组次数') as HTMLInputElement).value).toBe('0')
  })

  it('完成校验：全为 0 提示"重量和次数"，只填重量提示"次数"，并留在弹窗', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await openDialogFor(user, WEIGHTED_EX)

    await user.click(screen.getByRole('button', { name: '完成' }))
    expect(await screen.findByText(/第 1 组的重量和次数为 0/)).toBeInTheDocument()
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    const w1 = screen.getByLabelText('第 1 组重量（kg）')
    await user.clear(w1)
    await user.type(w1, '10')
    await user.click(screen.getByRole('button', { name: '完成' }))
    expect(await screen.findByText(/第 1 组的次数为 0/)).toBeInTheDocument()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('校验：填完第 1 组但第 2 组还是 0，提示位置精确到第 2 组', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await openDialogFor(user, WEIGHTED_EX)
    await fillSet(user, 1, '12.5', '10')
    await user.click(screen.getByRole('button', { name: '完成' }))
    expect(await screen.findByText(/第 2 组的重量和次数为 0/)).toBeInTheDocument()
  })

  it('全部填写后点完成：保存并关闭弹窗，入口显示本次摘要', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    const dialog = await openDialogFor(user, WEIGHTED_EX)
    expect(within(dialog).getByText(/目标 3 组 × 12 次/)).toBeInTheDocument()

    await fillSet(user, 1, '12.5', '10')
    await fillSet(user, 2, '12.5', '10')
    await fillSet(user, 3, '12.5', '8')
    // 容量实时跟随编辑：12.5×10×2 + 12.5×8 = 350
    expect(within(dialog).getByText(/本次容量 350 kg/)).toBeInTheDocument()

    await user.click(within(dialog).getByRole('button', { name: '完成' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(rowFor(WEIGHTED_EX).textContent).toContain('本次：12.5kg×10')
  })

  it('点 X 关闭丢弃本次修改：不保存、重开后恢复默认', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await openDialogFor(user, WEIGHTED_EX)
    await fillSet(user, 1, '12.5', '10')

    await user.click(screen.getByRole('button', { name: 'Close' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(rowFor(WEIGHTED_EX).textContent).not.toContain('本次')

    await openDialogFor(user, WEIGHTED_EX)
    expect((screen.getByLabelText('第 1 组重量（kg）') as HTMLInputElement).value).toBe('0')
  })

  it('「加一组」复制上一组数值，删除按钮可移除', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await openDialogFor(user, WEIGHTED_EX)

    expect(screen.getByLabelText('第 3 组次数')).toBeInTheDocument()
    expect(screen.queryByLabelText('第 4 组次数')).not.toBeInTheDocument()

    const w3 = screen.getByLabelText('第 3 组重量（kg）')
    await user.clear(w3)
    await user.type(w3, '20')
    await user.click(screen.getByRole('button', { name: /加一组/ }))
    const w4 = screen.getByLabelText('第 4 组重量（kg）') as HTMLInputElement
    expect(w4.value).toBe('20') // 新组复制上一组

    await user.click(screen.getByLabelText('删除第 4 组'))
    expect(screen.queryByLabelText('第 4 组重量（kg）')).not.toBeInTheDocument()
  })

  it('有历史记录时入口显示"上次"，弹窗预填上次重量次数', async () => {
    const user = userEvent.setup()
    const initialLogs: ExerciseLogMap = {
      [WEIGHTED_EX]: [
        {
          date: '2026-08-03',
          week: 1,
          sets: [
            { weightKg: 10, reps: 12 },
            { weightKg: 10, reps: 12 },
            { weightKg: 12.5, reps: 10 },
          ],
        },
      ],
    }
    render(<Harness initialLogs={initialLogs} />)
    expect(rowFor(WEIGHTED_EX).textContent).toContain('上次 10kg×12 · 3组')

    const dialog = await openDialogFor(user, WEIGHTED_EX)
    expect(within(dialog).getByText(/已为你预填/)).toBeInTheDocument()
    expect((screen.getByLabelText('第 1 组重量（kg）') as HTMLInputElement).value).toBe('10')
    expect((screen.getByLabelText('第 3 组重量（kg）') as HTMLInputElement).value).toBe('12.5')
  })

  it('今天的记录显示为"本次"而不是"上次"', () => {
    const initialLogs: ExerciseLogMap = {
      [WEIGHTED_EX]: [{ date: todayStr, week: 1, sets: [{ weightKg: 15, reps: 8 }] }],
    }
    render(<Harness initialLogs={initialLogs} />)
    expect(rowFor(WEIGHTED_EX).textContent).toContain('本次：15kg×8 · 1组')
    expect(rowFor(WEIGHTED_EX).textContent).not.toContain('上次')
  })

  it('弹窗展示本周其他天的历史记录，可回看之前重量', async () => {
    const user = userEvent.setup()
    const initialLogs: ExerciseLogMap = {
      [WEIGHTED_EX]: [{ date: sundayStr, week: 1, sets: [{ weightKg: 20, reps: 6 }] }],
    }
    render(<Harness initialLogs={initialLogs} />)
    const dialog = await openDialogFor(user, WEIGHTED_EX)
    expect(within(dialog).getByText('本周记录')).toBeInTheDocument()
    expect(within(dialog).getByText(/周日/)).toBeInTheDocument()
    expect(within(dialog).getByText('20kg×6 · 1组')).toBeInTheDocument()
  })

  it('弹窗顶部展示本周三条纪录：容量 / 重量 / 1RM 预测', async () => {
    const user = userEvent.setup()
    const initialLogs: ExerciseLogMap = {
      [WEIGHTED_EX]: [
        // 容量 20×6=120，最大重量 20，1RM = 20×1.2=24
        { date: sundayStr, week: 1, sets: [{ weightKg: 20, reps: 6 }] },
      ],
    }
    render(<Harness initialLogs={initialLogs} />)
    const dialog = await openDialogFor(user, WEIGHTED_EX)
    expect(within(dialog).getByText('容量纪录')).toBeInTheDocument()
    expect(within(dialog).getByText('重量纪录')).toBeInTheDocument()
    expect(within(dialog).getByText('1RM 预测')).toBeInTheDocument()
    expect(within(dialog).getByText('120')).toBeInTheDocument()
    expect(within(dialog).getByText('24')).toBeInTheDocument()
  })

  it('保存后重开弹窗，纪录带按已保存数据更新', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    let dialog = await openDialogFor(user, WEIGHTED_EX)
    expect(within(dialog).queryByText('容量纪录')).not.toBeInTheDocument()

    await fillSet(user, 1, '10', '10')
    await fillSet(user, 2, '10', '10')
    await fillSet(user, 3, '10', '10')
    await user.click(within(dialog).getByRole('button', { name: '完成' }))

    // 重开：容量 300、1RM = 10×(1+10/30) ≈ 13.3
    dialog = await openDialogFor(user, WEIGHTED_EX)
    expect(within(dialog).getByText('容量纪录')).toBeInTheDocument()
    expect(within(dialog).getByText('300')).toBeInTheDocument()
    expect(within(dialog).getByText('13.3')).toBeInTheDocument()
  })
})

describe('清除本次记录', () => {
  const loggedToday: ExerciseLogMap = {
    [WEIGHTED_EX]: [{ date: todayStr, week: 1, sets: [{ weightKg: 15, reps: 8 }] }],
  }

  it('无今日记录时弹窗没有「清除」入口', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    const dialog = await openDialogFor(user, WEIGHTED_EX)
    expect(within(dialog).queryByRole('button', { name: '清除' })).not.toBeInTheDocument()
  })

  it('两段确认：第一次点击进入确认态不删除，第二次才删记录并关闭弹窗', async () => {
    const user = userEvent.setup()
    render(<Harness initialLogs={loggedToday} />)
    // 弹窗标题也含动作名，开着弹窗时 rowFor 会匹配到多个，先取行元素再开弹窗
    const row = rowFor(WEIGHTED_EX)
    expect(row.textContent).toContain('本次：15kg×8')

    const dialog = await openDialogFor(user, WEIGHTED_EX)
    await user.click(within(dialog).getByRole('button', { name: '清除' }))
    // 第一次只进入确认态：记录还在，弹窗还在
    expect(within(dialog).getByRole('button', { name: '确认清除？' })).toBeInTheDocument()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(row.textContent).toContain('本次：15kg×8')

    await user.click(within(dialog).getByRole('button', { name: '确认清除？' }))
    // 第二次真正删除：弹窗关闭，入口回到未填写状态
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(rowFor(WEIGHTED_EX).textContent).not.toContain('本次')
    expect(within(rowFor(WEIGHTED_EX)).getByRole('button', { name: /记录重量/ })).toBeInTheDocument()
  })

  it('只删今天的记录，本周其他天的历史保留', async () => {
    const user = userEvent.setup()
    const initialLogs: ExerciseLogMap = {
      [WEIGHTED_EX]: [
        { date: '2026-08-03', week: 1, sets: [{ weightKg: 20, reps: 6 }] },
        { date: todayStr, week: 1, sets: [{ weightKg: 15, reps: 8 }] },
      ],
    }
    render(<Harness initialLogs={initialLogs} />)
    const dialog = await openDialogFor(user, WEIGHTED_EX)
    await user.click(within(dialog).getByRole('button', { name: '清除' }))
    await user.click(within(dialog).getByRole('button', { name: '确认清除？' }))

    // 今日记录被删，入口回退到展示之前的「上次」
    expect(rowFor(WEIGHTED_EX).textContent).not.toContain('本次')
    expect(rowFor(WEIGHTED_EX).textContent).toContain('上次 20kg×6 · 1组')
  })
})

describe('自重动作（俯卧撑）', () => {
  it('弹窗没有重量列，只填次数；保存后摘要为"N 次 · M组"', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    const dialog = await openDialogFor(user, BODYWEIGHT_EX)
    expect(screen.queryByLabelText('第 1 组重量（kg）')).not.toBeInTheDocument()

    for (const [n, r] of [[1, '10'], [2, '10'], [3, '8']] as const) {
      const input = screen.getByLabelText(`第 ${n} 组次数`)
      await user.clear(input)
      await user.type(input, r)
    }
    await user.click(within(dialog).getByRole('button', { name: '完成' }))
    expect(rowFor(BODYWEIGHT_EX).textContent).toContain('本次：10 次 · 3组')
  })

  it('自重动作校验只要求次数，不校验重量', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await openDialogFor(user, BODYWEIGHT_EX)
    await user.click(screen.getByRole('button', { name: '完成' }))
    // 提示次数为 0，不出现重量相关文案
    expect(await screen.findByText(/第 1 组的次数为 0/)).toBeInTheDocument()
    expect(screen.queryByText(/重量和次数/)).not.toBeInTheDocument()
  })

  it('自重动作纪录带显示总次数 / 单组最多', async () => {
    const user = userEvent.setup()
    const initialLogs: ExerciseLogMap = {
      [BODYWEIGHT_EX]: [
        { date: sundayStr, week: 1, sets: [{ weightKg: null, reps: 10 }, { weightKg: null, reps: 12 }] },
      ],
    }
    render(<Harness initialLogs={initialLogs} />)
    const dialog = await openDialogFor(user, BODYWEIGHT_EX)
    expect(within(dialog).getByText('总次数')).toBeInTheDocument()
    expect(within(dialog).getByText('22')).toBeInTheDocument()
    expect(within(dialog).getByText('单组最多')).toBeInTheDocument()
    expect(within(dialog).getByText('12')).toBeInTheDocument()
    expect(within(dialog).queryByText('容量纪录')).not.toBeInTheDocument()
  })

  it('历史按负重录入的旧数据：展示忽略重量，保存时剥离写净（闭环）', async () => {
    const user = userEvent.setup()
    // 类型调整前按负重录过的俯卧撑记录（含 weightKg）
    const initialLogs: ExerciseLogMap = {
      [BODYWEIGHT_EX]: [{ date: todayStr, week: 1, sets: [{ weightKg: 2.5, reps: 10 }] }],
    }
    render(<Harness initialLogs={initialLogs} />)
    // 入口展示按当前自重类型渲染，不带旧重量
    expect(rowFor(BODYWEIGHT_EX).textContent).toContain('本次：10 次 · 1组')
    expect(rowFor(BODYWEIGHT_EX).textContent).not.toContain('2.5kg')

    // 弹窗预填只带次数；直接完成（次数>0 通过校验）后记录被写净
    await openDialogFor(user, BODYWEIGHT_EX)
    expect((screen.getByLabelText('第 1 组次数') as HTMLInputElement).value).toBe('10')
    await user.click(screen.getByRole('button', { name: '完成' }))
    expect(rowFor(BODYWEIGHT_EX).textContent).toContain('本次：10 次 · 1组')
  })
})

describe('时间类动作（平板支撑）', () => {
  it('弹窗没有重量列，次数列按秒记录；校验提示"秒数"', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await openDialogFor(user, TIMED_EX)
    expect(screen.queryByLabelText('第 1 组重量（kg）')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '完成' }))
    expect(await screen.findByText(/第 1 组的秒数为 0/)).toBeInTheDocument()

    for (const n of [1, 2, 3]) {
      const input = screen.getByLabelText(`第 ${n} 组次数`)
      await user.clear(input)
      await user.type(input, '45')
    }
    await user.click(screen.getByRole('button', { name: '完成' }))
    expect(rowFor(TIMED_EX).textContent).toContain('本次：45 秒 · 3组')
  })
})
