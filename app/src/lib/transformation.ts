import { bmi, exerciseWeekStats } from '@/lib/store'
import type { ExerciseLogMap, Profile, WeekFeedback, WeekPlan, WeightEntry } from '@/types'

/**
 * 蜕变报告：从现有 CloudState 现算用户阶段性进步指标 + 规则模板生成鼓励文案。
 * 纯函数、无副作用，便于单测；UI 层据此渲染报告卡与可分享海报。
 * 范式参照 planEngine.describeProfile / tuneProgressionByFeedback（parts[] + 阈值分支）。
 */

export interface WeekPR {
  name: string
  best1RM: number // Epley 1RM 预测 kg
  maxWeight: number // 单组最大重量 kg
}

export interface TransformationStats {
  /** 已坚持周数（按提交反馈数计，与作战卡一致） */
  weeksPersisted: number
  feedbackCount: number
  /** 体重变化（latest - first）；<2 条记录返回 null */
  weightDelta: number | null
  bodyFatDelta: number | null
  /** 最新 BMI */
  bmi: number | null
  bmiDelta: number | null
  /** 历次反馈的平均完成率（0-100） */
  avgCompletion: number | null
  /** 本周力量 PR（按 1RM 排序前 3） */
  weekPRs: WeekPR[]
  /** 是否有足够数据展示报告 */
  hasData: boolean
}

const round2 = (n: number) => Math.round(n * 100) / 100
const round1 = (n: number) => Math.round(n * 10) / 10

export function computeTransformation(input: {
  weights: WeightEntry[]
  feedbacks: WeekFeedback[]
  setLogs: ExerciseLogMap
  profile: Profile
  weekPlan: WeekPlan
}): TransformationStats {
  const { weights, feedbacks, setLogs, profile, weekPlan } = input
  const heightCm = profile.heightCm

  const first = weights[0]
  const latest = weights[weights.length - 1]

  let weightDelta: number | null = null
  let bodyFatDelta: number | null = null
  let bmiVal: number | null = null
  let bmiDelta: number | null = null

  if (latest && heightCm > 0) bmiVal = round1(bmi(latest.weight, heightCm))
  if (first && latest && weights.length >= 2) {
    weightDelta = round2(latest.weight - first.weight)
    if (first.bodyFat != null && latest.bodyFat != null) {
      bodyFatDelta = round1(latest.bodyFat - first.bodyFat)
    }
    if (heightCm > 0) {
      bmiDelta = round1(bmi(latest.weight, heightCm) - bmi(first.weight, heightCm))
    }
  }

  const avgCompletion =
    feedbacks.length > 0
      ? Math.round(feedbacks.reduce((s, f) => s + (f.completion ?? 0), 0) / feedbacks.length)
      : null

  // 本周力量 PR：取本周记录，按 1RM 排序前 3
  const weekStart = weekPlan.startDate
  const weekPRs: WeekPR[] = weekStart
    ? Object.entries(setLogs)
        .flatMap(([name, records]) => {
          const weekRecords = records.filter((r) => r.date >= weekStart)
          if (weekRecords.length === 0) return []
          const s = exerciseWeekStats(weekRecords)
          if (s.maxWeight <= 0 && s.best1RM <= 0) return []
          return [{ name, best1RM: s.best1RM, maxWeight: s.maxWeight }]
        })
        .sort((a, b) => b.best1RM - a.best1RM || b.maxWeight - a.maxWeight)
        .slice(0, 3)
    : []

  const weeksPersisted = feedbacks.length
  const hasData = weights.length >= 2 || feedbacks.length >= 1 || weekPRs.length >= 1

  return {
    weeksPersisted,
    feedbackCount: feedbacks.length,
    weightDelta,
    bodyFatDelta,
    bmi: bmiVal,
    bmiDelta,
    avgCompletion,
    weekPRs,
    hasData,
  }
}

export interface TransformationCopy {
  /** 大标题，如「已坚持 8 周，向目标推进 3.2 kg」 */
  headline: string
  /** 鼓励要点（每条独立，UI 列表展示） */
  lines: string[]
  /** 目标对齐一句话判定 */
  verdict: string
}

/** 体重变化方向是否契合目标 */
function weightDeltaAligned(goal: Profile['weightGoal'], delta: number): boolean {
  if (goal === 'lose') return delta < 0
  if (goal === 'gain') return delta > 0
  return true // recomp/maintain：不按体重方向判定
}

/** 坚持周数里程碑（取已达成的最高一档） */
function milestone(weeks: number): string | null {
  if (weeks >= 52) return '坚持满一年，你已超过 99% 的人'
  if (weeks >= 26) return '坚持半年，习惯已刻进生活'
  if (weeks >= 12) return '坚持满 12 周，习惯初步成型'
  if (weeks >= 8) return '坚持 8 周，进入稳定期'
  if (weeks >= 4) return '坚持 4 周，最难的开头已经过去'
  return null
}

export function describeTransformation(stats: TransformationStats, profile: Profile): TransformationCopy {
  const { weeksPersisted, weightDelta, bodyFatDelta, avgCompletion, weekPRs } = stats
  const goal = profile.weightGoal
  const lines: string[] = []

  // —— headline：以坚持周数为锚 + 最有分量的信号 ——
  const head = [`已坚持 ${weeksPersisted} 周`]
  if (weightDelta != null && goal && weightDeltaAligned(goal, weightDelta)) {
    const dir = goal === 'lose' ? '减掉' : goal === 'gain' ? '增重' : '调整'
    head.push(`${dir} ${Math.abs(weightDelta)} kg`)
  } else if (avgCompletion != null) {
    head.push(`平均完成 ${avgCompletion}%`)
  } else if (weekPRs.length > 0) {
    head.push(`${weekPRs[0].name} 破纪录`)
  } else if (weeksPersisted > 0) {
    head.push('稳步前行')
  }
  const headline = head.join('，')

  // —— verdict：目标对齐一句话 ——
  let verdict = ''
  if (weightDelta != null && goal) {
    if (goal === 'lose') {
      verdict =
        weightDelta < 0
          ? '减脂方向正确，体重稳步下降'
          : weightDelta > 0
            ? '体重有所上升，留意饮食与有氧配比'
            : '体重保持稳定，继续坚持'
    } else if (goal === 'gain') {
      verdict =
        weightDelta > 0
          ? '增肌方向正确，体重稳步上涨'
          : weightDelta < 0
            ? '体重下降，注意热量盈余与力量训练'
            : '体重保持稳定，继续坚持'
    } else if (goal === 'recomp') {
      verdict =
        bodyFatDelta != null && bodyFatDelta < 0
          ? '体脂下降，塑形初见成效'
          : '体型重塑中，关注围度变化'
    } else {
      verdict = '体重保持稳定，状态良好'
    }
  }

  // —— lines：独立鼓励要点，缺数据跳过 ——
  if (bodyFatDelta != null && bodyFatDelta < 0) {
    lines.push(`体脂率下降 ${Math.abs(bodyFatDelta)}%，线条更清晰`)
  }
  if (avgCompletion != null) {
    if (avgCompletion >= 80) lines.push(`平均完成度 ${avgCompletion}%，自律得可怕`)
    else if (avgCompletion >= 60) lines.push(`平均完成度 ${avgCompletion}%，坚持就是胜利`)
    else lines.push(`平均完成度 ${avgCompletion}%，每一练都算数`)
  }
  const ms = milestone(weeksPersisted)
  if (ms) lines.push(ms)
  if (weekPRs.length > 0) {
    const pr = weekPRs[0]
    lines.push(pr.best1RM > 0 ? `本周 ${pr.name} 创下 ${pr.best1RM}kg 新高（1RM 预测）` : `本周 ${pr.name} 最大重量 ${pr.maxWeight}kg`)
  }
  if (lines.length === 0 && weeksPersisted > 0) {
    lines.push('持续记录本身，就是改变的开始')
  }

  return { headline, lines, verdict }
}
