import { useCallback, useState } from 'react'
import { addDays, format, startOfWeek } from 'date-fns'
import type { DayPlan, Profile, WeekPlan } from '@/types'

/** 通用 localStorage 持久化 Hook */
export function useLocalStorage<T>(
  key: string,
  initial: T | (() => T),
): [T, (v: T | ((p: T) => T)) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key)
      if (raw != null) return JSON.parse(raw) as T
    } catch {
      /* ignore */
    }
    return typeof initial === 'function' ? (initial as () => T)() : initial
  })
  const set = useCallback((v: T | ((p: T) => T)) => {
    setValue((prev) => {
      const next = typeof v === 'function' ? (v as (p: T) => T)(prev) : v
      try {
        localStorage.setItem(key, JSON.stringify(next))
      } catch {
        /* ignore */
      }
      return next
    })
  }, [])
  return [value, set]
}

export const LS_KEYS = {
  profile: 'fitup:profile',
  weekPlan: 'fitup:weekPlan',
  checks: 'fitup:checks',
  weights: 'fitup:weights',
  feedback: 'fitup:feedback',
}

export const DEFAULT_PROFILE: Profile = {
  name: '我',
  heightCm: 163,
  badmintonHours: 3,
  goal: '上身增肌（胸 / 背 / 肩 / 手臂），保持羽毛球体能',
}

export function currentMonday(): string {
  return format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd')
}

/**
 * 根据周数生成一周计划。
 * 进阶策略（渐进超负荷）：随周数提升次数/组数上限；
 * difficulty 为上周反馈难度(1-5)，>=4 保持不加量，<=2 额外加一点。
 */
export function buildWeekPlan(week: number, difficulty?: number): WeekPlan {
  // 每 2 周一个台阶，最多 +4 次 / +1 组
  const step = Math.min(Math.floor((week - 1) / 2), 4)
  let extra = step
  let note = `第 ${week} 周：在前一阶段基础上动作次数 +${step}（渐进超负荷）。`
  if (difficulty !== undefined) {
    if (difficulty >= 4) {
      extra = Math.max(0, step - 1)
      note = `上周反馈偏难（${difficulty}/5），本周降低进阶幅度，先把动作做标准。`
    } else if (difficulty <= 2) {
      extra = step + 1
      note = `上周反馈较轻松（${difficulty}/5），本周适度加量，可以试试更重的哑铃。`
    } else {
      note = `上周难度适中（${difficulty}/5），本周按计划正常进阶（次数 +${step}）。`
    }
  }
  const r = (base: number) => base + extra // 次数进阶
  const addSet = week >= 5 && (difficulty === undefined || difficulty <= 3)

  const days: DayPlan[] = [
    {
      day: '周一',
      focus: '胸 + 三头肌',
      type: 'strength',
      tip: '增肌重点日。俯卧撑若太轻松，把脚垫高或背个小书包负重。',
      exercises: [
        { name: '热身：开合跳 + 肩胸动态拉伸', sets: '5 分钟' },
        { name: '俯卧撑（跪姿可退阶）', sets: `${addSet ? 4 : 3} 组 × ${r(8)}-${r(12)} 次`, note: '胸触地、核心收紧' },
        { name: '上斜俯卧撑 / 哑铃上斜卧推', sets: `3 组 × ${r(10)} 次`, note: '手撑床沿/凳子练上胸' },
        { name: '哑铃飞鸟（或毛巾飞鸟）', sets: `3 组 × ${r(12)} 次`, note: '感受胸部挤压' },
        { name: '凳上臂屈伸', sets: `3 组 × ${r(10)} 次`, note: '练三头，瘦手臂先练它' },
        { name: '胸部 + 三头静态拉伸', sets: '3 分钟' },
      ],
    },
    {
      day: '周二',
      focus: '休息 / 主动恢复',
      type: 'rest',
      tip: '肌肉在休息时生长。散步 20-30 分钟 + 全身拉伸即可。',
      exercises: [
        { name: '散步或轻松骑车', sets: '20-30 分钟' },
        { name: '全身拉伸（重点胸肩）', sets: '10 分钟' },
      ],
    },
    {
      day: '周三',
      focus: '背 + 二头肌',
      type: 'strength',
      tip: '背是上身视觉宽度的关键。没有单杠就用哑铃划船替代引体。',
      exercises: [
        { name: '热身：弹力带/毛巾绕肩 + 猫式伸展', sets: '5 分钟' },
        { name: '单臂哑铃划船', sets: `${addSet ? 4 : 3} 组 × 每侧 ${r(10)} 次`, note: '可用装满水的水瓶替代' },
        { name: '俯身哑铃划船', sets: `3 组 × ${r(12)} 次` },
        { name: '俯身反向飞鸟（练后束+上背）', sets: `3 组 × ${r(12)} 次`, note: '改善圆肩体态' },
        { name: '哑铃弯举', sets: `3 组 × ${r(12)} 次` },
        { name: '背部 + 二头静态拉伸', sets: '3 分钟' },
      ],
    },
    {
      day: '周四',
      focus: '休息 / 轻有氧（可选）',
      type: 'rest',
      tip: '为明天的肩部训练和周六羽毛球储备体力。',
      exercises: [{ name: '可选：快走 20 分钟', sets: '轻松配速' }],
    },
    {
      day: '周五',
      focus: '肩 + 核心',
      type: 'strength',
      tip: '宽肩能让上身立刻显壮。侧平举用小重量多次数效果最好。',
      exercises: [
        { name: '热身：肩部环绕 + 招财猫式', sets: '5 分钟' },
        { name: '哑铃肩上推举', sets: `${addSet ? 4 : 3} 组 × ${r(10)} 次`, note: '可坐椅子上做' },
        { name: '哑铃侧平举', sets: `3 组 × ${r(15)} 次`, note: '小重量、慢速、到肩高' },
        { name: '俯身侧平举（后束）', sets: `3 组 × ${r(12)} 次` },
        { name: '平板支撑', sets: `3 组 × ${45 + extra * 5} 秒` },
        { name: '卷腹', sets: `3 组 × ${r(15)} 次` },
        { name: '肩部拉伸', sets: '3 分钟' },
      ],
    },
    {
      day: '周六',
      focus: '羽毛球日（3 小时高强度）',
      type: 'sport',
      tip: '高强度羽毛球已充分锻炼下肢与心肺，所以平时不额外安排腿部大重量。注意补水和碳水。',
      exercises: [
        { name: '动态热身（重点踝关节、肩）', sets: '10 分钟' },
        { name: '羽毛球对抗', sets: '3 小时', note: '中途每 30-40 分钟补水' },
        { name: '赛后静态拉伸（小腿、肩、手腕）', sets: '10 分钟' },
      ],
    },
    {
      day: '周日',
      focus: '完全休息 + 本周复盘',
      type: 'rest',
      tip: '睡够 7-9 小时。记得称体重、填写本周反馈，然后生成下周计划。',
      exercises: [
        { name: '充足睡眠', sets: '7-9 小时' },
        { name: '填写本周反馈 & 生成下周计划', sets: '在"每周反馈"页完成' },
      ],
    },
  ]

  return { week, startDate: currentMonday(), days, adjustmentNote: note }
}

/** 原样复制当前计划为下一周：不做进阶调整，startDate 取下一个周一 */
export function copyWeekPlan(plan: WeekPlan): WeekPlan {
  const nextMonday = format(startOfWeek(addDays(new Date(), 7), { weekStartsOn: 1 }), 'yyyy-MM-dd')
  return {
    week: plan.week + 1,
    startDate: nextMonday,
    days: plan.days.map((d) => ({ ...d, exercises: d.exercises.map((e) => ({ ...e })) })),
    adjustmentNote: '沿用上周计划，未做进阶调整。',
  }
}

/** 计算 BMI */
export function bmi(weightKg: number, heightCm: number): number {
  const m = heightCm / 100
  return weightKg / (m * m)
}

export function bmiLabel(v: number): string {
  if (v < 18.5) return '偏瘦'
  if (v < 24) return '正常'
  if (v < 28) return '超重'
  return '肥胖'
}

/** 每日蛋白质建议（增肌 1.6-2.0 g/kg） */
export function proteinRange(weightKg: number): [number, number] {
  return [Math.round(weightKg * 1.6), Math.round(weightKg * 2.0)]
}
