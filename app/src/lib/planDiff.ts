import type { WeekPlan } from '@/types'
import { parseSetTarget } from '@/lib/store'

/** 单条变化：某个动作的组数 / 次数区间 / 动作本身变了 */
export type PlanChangeField = 'sets' | 'reps' | 'exercise'

export interface PlanChange {
  /** 周几（周一…周日） */
  day: string
  /** 在 days 里的下标，UI 用来跳转到对应日卡 */
  dayIndex: number
  /** 变化后的动作名（动作被替换时这里也是新名字） */
  name: string
  field: PlanChangeField
  /** 变化前的展示文案，如 "3 组 × 8-12 次" */
  from: string
  /** 变化后的展示文案 */
  to: string
  /** 组数增减（仅 field='sets' 时有值，负数 = 减组） */
  setsDelta?: number
}

export interface PlanDiff {
  changes: PlanChange[]
  /** 涉及的训练日数量 */
  dayCount: number
  /** 整体方向：全部加量=up，全部降量=down，有增有减=mixed，无变化=none */
  direction: 'up' | 'down' | 'mixed' | 'none'
  /** 全部变化动作的组数增减合计 */
  totalSetsDelta: number
}

/**
 * 对比「没有反馈时本来会生成的计划」与「带上反馈后生成的计划」，输出人类可读的差异。
 *
 * 用途：用户填完每周反馈后，把规则引擎真正做的调整（比如"10 个动作各减 1 组"）摊开给他看，
 * 而不是只丢一句 adjustmentNote。纯函数，planEngine 的输出直接喂进来即可。
 *
 * 对齐方式：按 天下标 + 动作下标 对位。计划由同一套规则引擎生成，顺序稳定；
 * 用户在计划页手动换过动作时（名字不同）按 field='exercise' 记一条。
 */
export function diffWeekPlans(base: WeekPlan, next: WeekPlan): PlanDiff {
  const changes: PlanChange[] = []

  next.days.forEach((day, di) => {
    const baseDay = base.days[di]
    if (!baseDay) return
    day.exercises.forEach((ex, ei) => {
      const before = baseDay.exercises[ei]
      if (!before) {
        // 新增的动作（例如 5 周后加组导致的动作变化）不算"调整"，跳过
        return
      }
      if (before.name !== ex.name) {
        changes.push({
          day: day.day,
          dayIndex: di,
          name: ex.name,
          field: 'exercise',
          from: before.name,
          to: ex.name,
        })
        return
      }
      if (before.sets === ex.sets) return

      const b = parseSetTarget(before.sets)
      const n = parseSetTarget(ex.sets)
      if (b && n && b.count !== n.count) {
        changes.push({
          day: day.day,
          dayIndex: di,
          name: ex.name,
          field: 'sets',
          from: before.sets,
          to: ex.sets,
          setsDelta: n.count - b.count,
        })
        return
      }
      changes.push({
        day: day.day,
        dayIndex: di,
        name: ex.name,
        field: 'reps',
        from: before.sets,
        to: ex.sets,
      })
    })
  })

  const totalSetsDelta = changes.reduce((sum, c) => sum + (c.setsDelta ?? 0), 0)
  const dayCount = new Set(changes.map((c) => c.dayIndex)).size

  let direction: PlanDiff['direction'] = 'none'
  const deltas = changes.map((c) => c.setsDelta).filter((d): d is number => d !== undefined)
  if (changes.length > 0) {
    if (deltas.length > 0 && deltas.every((d) => d < 0)) direction = 'down'
    else if (deltas.length > 0 && deltas.every((d) => d > 0)) direction = 'up'
    else direction = 'mixed'
  }

  return { changes, dayCount, direction, totalSetsDelta }
}

/** 一句话概括，用于卡片标题 / toast */
export function summarizePlanDiff(diff: PlanDiff): string {
  if (diff.changes.length === 0) return '和按原计划顺延一样，没有额外调整'
  const setsChanges = diff.changes.filter((c) => c.field === 'sets')
  const uniformOneSet =
    setsChanges.length === diff.changes.length &&
    setsChanges.every((c) => c.setsDelta === -1) &&
    setsChanges.length > 1
  if (uniformOneSet) return `训练量下调：${setsChanges.length} 个动作各减 1 组`
  const uniformAddOne =
    setsChanges.length === diff.changes.length &&
    setsChanges.every((c) => c.setsDelta === 1) &&
    setsChanges.length > 1
  if (uniformAddOne) return `训练量上调：${setsChanges.length} 个动作各加 1 组`
  const verb = diff.direction === 'down' ? '下调' : diff.direction === 'up' ? '上调' : '调整'
  return `本周${verb}了 ${diff.changes.length} 处`
}

/** 按天分组，供「展开明细」使用（保持 days 顺序） */
export function groupChangesByDay(diff: PlanDiff): { day: string; dayIndex: number; changes: PlanChange[] }[] {
  const map = new Map<number, { day: string; dayIndex: number; changes: PlanChange[] }>()
  for (const c of diff.changes) {
    const entry = map.get(c.dayIndex) ?? { day: c.day, dayIndex: c.dayIndex, changes: [] }
    entry.changes.push(c)
    map.set(c.dayIndex, entry)
  }
  return [...map.values()].sort((a, b) => a.dayIndex - b.dayIndex)
}

/** 变更文案："3 组 → 2 组"（组数）或整段组次描述（次数区间变化） */
export function describeChange(c: PlanChange): string {
  if (c.field === 'sets') {
    const b = parseSetTarget(c.from)
    const n = parseSetTarget(c.to)
    return b && n ? `${b.count} 组 → ${n.count} 组` : `${c.from} → ${c.to}`
  }
  if (c.field === 'exercise') return `${c.from} → ${c.to}`
  return `${c.from} → ${c.to}`
}
