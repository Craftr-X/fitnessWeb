import { describe, it, expect } from 'vitest'
import { computeTransformation, describeTransformation } from '@/lib/transformation'
import type { TransformationStats } from '@/lib/transformation'
import type { ExerciseLogMap, Profile, WeekFeedback, WeekPlan, WeightEntry } from '@/types'

const profile = (over: Partial<Profile> = {}): Profile => ({
  name: '我',
  heightCm: 170,
  ...over,
})
const weekPlan = (startDate = '2026-08-04'): WeekPlan => ({
  week: 2,
  startDate,
  days: [],
  adjustmentNote: '',
})
const w = (date: string, weight: number, bodyFat?: number | null): WeightEntry => ({
  date,
  weight,
  bodyFat: bodyFat ?? null,
})
const fb = (completion: number, week = 1): WeekFeedback => ({
  week,
  date: `2026-08-0${week}`,
  completion,
  difficulty: 3,
  soreness: [],
  sleep: '7-8',
  diet: '基本达标',
  note: '',
})

const stats = (over: Partial<TransformationStats> = {}): TransformationStats => ({
  weeksPersisted: 0,
  feedbackCount: 0,
  weightDelta: null,
  bodyFatDelta: null,
  bmi: null,
  bmiDelta: null,
  avgCompletion: null,
  weekPRs: [],
  hasData: false,
  ...over,
})

/* ------------------------------------------------------------------ */
/* computeTransformation                                              */
/* ------------------------------------------------------------------ */
describe('computeTransformation', () => {
  it('空数据：各项 null，hasData=false', () => {
    const s = computeTransformation({ weights: [], feedbacks: [], setLogs: {}, profile: profile(), weekPlan: weekPlan() })
    expect(s.weightDelta).toBeNull()
    expect(s.bodyFatDelta).toBeNull()
    expect(s.avgCompletion).toBeNull()
    expect(s.weekPRs).toEqual([])
    expect(s.weeksPersisted).toBe(0)
    expect(s.hasData).toBe(false)
  })

  it('单条体重：weightDelta=null（需≥2），bmi 仍计算', () => {
    const s = computeTransformation({
      weights: [w('2026-08-01', 60)],
      feedbacks: [],
      setLogs: {},
      profile: profile({ heightCm: 170 }),
      weekPlan: weekPlan(),
    })
    expect(s.weightDelta).toBeNull()
    expect(s.bmi).toBeCloseTo(20.8, 0) // 60 / 1.7² ≈ 20.76
  })

  it('两条体重：算出 weightDelta / bodyFatDelta / bmiDelta', () => {
    const s = computeTransformation({
      weights: [w('2026-08-01', 60, 22), w('2026-08-10', 58.5, 20.5)],
      feedbacks: [],
      setLogs: {},
      profile: profile({ heightCm: 170 }),
      weekPlan: weekPlan(),
    })
    expect(s.weightDelta).toBe(-1.5)
    expect(s.bodyFatDelta).toBe(-1.5)
    expect(s.bmiDelta).toBeCloseTo(-0.5, 0)
    expect(s.hasData).toBe(true)
  })

  it('体脂缺失一条：bodyFatDelta=null，weightDelta 仍算', () => {
    const s = computeTransformation({
      weights: [w('2026-08-01', 60), w('2026-08-10', 59, 21)],
      feedbacks: [],
      setLogs: {},
      profile: profile(),
      weekPlan: weekPlan(),
    })
    expect(s.weightDelta).toBe(-1)
    expect(s.bodyFatDelta).toBeNull()
  })

  it('平均完成率：多条反馈取均值（四舍五入）', () => {
    const s = computeTransformation({
      weights: [],
      feedbacks: [fb(80, 1), fb(90, 2), fb(70, 3)],
      setLogs: {},
      profile: profile(),
      weekPlan: weekPlan(),
    })
    expect(s.avgCompletion).toBe(80) // (80+90+70)/3 = 80
    expect(s.weeksPersisted).toBe(3)
    expect(s.feedbackCount).toBe(3)
  })

  it('本周力量 PR：仅取本周记录，按 1RM 排序', () => {
    const setLogs: ExerciseLogMap = {
      哑铃弯举: [
        { date: '2026-07-20', week: 1, sets: [{ weightKg: 10, reps: 10 }] }, // 旧，过滤
        { date: '2026-08-05', week: 2, sets: [{ weightKg: 20, reps: 10 }] }, // 本周
      ],
      杠铃卧推: [{ date: '2026-08-05', week: 2, sets: [{ weightKg: 60, reps: 8 }] }],
      自重深蹲: [{ date: '2026-08-05', week: 2, sets: [{ weightKg: null, reps: 20 }] }], // 无重量，剔除
    }
    const s = computeTransformation({
      weights: [],
      feedbacks: [],
      setLogs,
      profile: profile(),
      weekPlan: weekPlan('2026-08-04'),
    })
    expect(s.weekPRs).toHaveLength(2) // 弯举 + 卧推；自重深蹲剔除
    expect(s.weekPRs[0].name).toBe('杠铃卧推') // 1RM 更高排前
    expect(s.weekPRs[0].best1RM).toBeCloseTo(76, 0) // 60*(1+8/30)=76
  })
})

/* ------------------------------------------------------------------ */
/* describeTransformation                                             */
/* ------------------------------------------------------------------ */
describe('describeTransformation', () => {
  it('减脂目标 + 体重下降：headline 含「减掉」，verdict 方向正确', () => {
    const copy = describeTransformation(
      stats({ weeksPersisted: 8, weightDelta: -2.5 }),
      profile({ weightGoal: 'lose' }),
    )
    expect(copy.headline).toBe('已坚持 8 周，减掉 2.5 kg')
    expect(copy.verdict).toContain('减脂方向正确')
  })

  it('减脂目标 + 体重上升：headline 回退到完成率，verdict 提示', () => {
    const copy = describeTransformation(
      stats({ weeksPersisted: 4, weightDelta: 1, avgCompletion: 70 }),
      profile({ weightGoal: 'lose' }),
    )
    expect(copy.headline).toContain('平均完成 70%') // 体重方向不契合，不进 headline
    expect(copy.verdict).toContain('体重有所上升')
  })

  it('增肌目标 + 体重上升：headline 含「增重」', () => {
    const copy = describeTransformation(
      stats({ weeksPersisted: 6, weightDelta: 1.2 }),
      profile({ weightGoal: 'gain' }),
    )
    expect(copy.headline).toContain('增重 1.2 kg')
    expect(copy.verdict).toContain('增肌方向正确')
  })

  it('体脂下降：lines 含「体脂率下降」', () => {
    const copy = describeTransformation(stats({ weeksPersisted: 5, bodyFatDelta: -1.5 }), profile())
    expect(copy.lines.some((l) => l.includes('体脂率下降 1.5%'))).toBe(true)
  })

  it('完成率分层：≥80 自律得可怕；≥60 坚持就是胜利；<60 每一练都算数', () => {
    const hi = describeTransformation(stats({ weeksPersisted: 3, avgCompletion: 85 }), profile())
    const mid = describeTransformation(stats({ weeksPersisted: 3, avgCompletion: 65 }), profile())
    const lo = describeTransformation(stats({ weeksPersisted: 3, avgCompletion: 50 }), profile())
    expect(hi.lines.some((l) => l.includes('自律得可怕'))).toBe(true)
    expect(mid.lines.some((l) => l.includes('坚持就是胜利'))).toBe(true)
    expect(lo.lines.some((l) => l.includes('每一练都算数'))).toBe(true)
  })

  it('里程碑：52>26>12>8>4 取最高已达成档', () => {
    expect(describeTransformation(stats({ weeksPersisted: 30 }), profile()).lines.some((l) => l.includes('坚持半年'))).toBe(true)
    expect(describeTransformation(stats({ weeksPersisted: 12 }), profile()).lines.some((l) => l.includes('12 周'))).toBe(true)
    expect(describeTransformation(stats({ weeksPersisted: 2 }), profile()).lines.some((l) => l.includes('坚持'))).toBe(false)
  })

  it('本周力量 PR：lines 含动作新高', () => {
    const copy = describeTransformation(
      stats({ weeksPersisted: 2, weekPRs: [{ name: '杠铃卧推', best1RM: 76, maxWeight: 60 }] }),
      profile(),
    )
    expect(copy.lines.some((l) => l.includes('杠铃卧推') && l.includes('76kg'))).toBe(true)
  })

  it('完全空数据（0 周）：lines 无默认鼓励，headline 兜底', () => {
    const copy = describeTransformation(stats(), profile())
    expect(copy.headline).toBe('已坚持 0 周')
    expect(copy.lines).toEqual([])
    expect(copy.verdict).toBe('')
  })
})
