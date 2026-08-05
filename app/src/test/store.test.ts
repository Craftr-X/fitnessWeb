import { describe, it, expect } from 'vitest'
import {
  buildWeekPlan,
  copyWeekPlan,
  bmi,
  bmiLabel,
  proteinRange,
  weeksBetween,
  mergeOnboardingWeight,
} from '@/lib/store'
import type { WeekPlan, WeightEntry } from '@/types'

/* ------------------------------------------------------------------ */
/* bmi —— 体重 / 身高²                                                */
/* ------------------------------------------------------------------ */
describe('bmi', () => {
  it('标准计算', () => {
    // 50 / (1.63)² ≈ 18.816
    expect(bmi(50, 163)).toBeCloseTo(18.82, 1)
  })

  it('身高以 cm 传入，内部换算成 m', () => {
    expect(bmi(70, 175)).toBeCloseTo(22.86, 1)
  })

  it('身高为 0 不抛错（虽然不现实，但保证不会 NaN 崩溃）', () => {
    // 70 / 0 = Infinity，函数未做防御；这里锁定当前行为，避免后续误改
    expect(bmi(70, 0)).toBe(Infinity)
  })
})

/* ------------------------------------------------------------------ */
/* bmiLabel —— BMI 分级                                              */
/* ------------------------------------------------------------------ */
describe('bmiLabel', () => {
  it('18.5 是「正常」的下界（含）', () => {
    expect(bmiLabel(18.5)).toBe('正常')
  })

  it('低于 18.5 为「偏瘦」', () => {
    expect(bmiLabel(18.49)).toBe('偏瘦')
    expect(bmiLabel(15)).toBe('偏瘦')
  })

  it('24 是「超重」的下界（含）', () => {
    expect(bmiLabel(24)).toBe('超重')
  })

  it('23.99 仍属「正常」', () => {
    expect(bmiLabel(23.99)).toBe('正常')
  })

  it('28 是「肥胖」的下界（含）', () => {
    expect(bmiLabel(28)).toBe('肥胖')
    expect(bmiLabel(30)).toBe('肥胖')
  })
})

/* ------------------------------------------------------------------ */
/* proteinRange —— 增肌期每日蛋白质建议 (1.6–2.0 g/kg)               */
/* ------------------------------------------------------------------ */
describe('proteinRange', () => {
  it('返回 [1.6×体重, 2.0×体重] 且四舍五入', () => {
    expect(proteinRange(50)).toEqual([80, 100])
  })

  it('小数体重四舍五入到整数克', () => {
    // 52.5 × 1.6 = 84, 52.5 × 2.0 = 105
    expect(proteinRange(52.5)).toEqual([84, 105])
  })

  it('下界 ≤ 上界（单调性）', () => {
    const [lo, hi] = proteinRange(60)
    expect(lo).toBeLessThanOrEqual(hi)
  })
})

/* ------------------------------------------------------------------ */
/* buildWeekPlan —— 渐进超负荷计划生成                                */
/* ------------------------------------------------------------------ */
describe('buildWeekPlan', () => {
  /* ---- 基础进阶 step = floor((week-1)/2)，上限 4 ---- */
  it('第 1 周：step=0，次数不进阶', () => {
    const plan = buildWeekPlan(1)
    // 周一俯卧撑 r(8)=8, r(12)=12 → "3 组 × 8-12 次"
    expect(plan.days[0].exercises[1].sets).toBe('3 组 × 8-12 次')
  })

  it('第 2 周：step 仍为 0', () => {
    const plan = buildWeekPlan(2)
    expect(plan.days[0].exercises[1].sets).toBe('3 组 × 8-12 次')
  })

  it('第 3 周：step=1，次数 +1', () => {
    const plan = buildWeekPlan(3)
    expect(plan.days[0].exercises[1].sets).toBe('3 组 × 9-13 次')
  })

  it('第 9 周：step=4（达到上限），week>=5 且无反馈 → addSet=true', () => {
    const plan = buildWeekPlan(9)
    // week>=5 且 difficulty=undefined → addSet=true → 4 组
    expect(plan.days[0].exercises[1].sets).toBe('4 组 × 12-16 次')
    // 平板支撑不受 addSet 影响，始终 3 组；秒数 45 + extra*5 = 45 + 4*5 = 65
    expect(plan.days[4].exercises[4].sets).toBe('3 组 × 65 秒')
  })

  it('第 11 周：step 仍为 4（上限封顶），addSet=true', () => {
    const plan = buildWeekPlan(11)
    expect(plan.days[0].exercises[1].sets).toBe('4 组 × 12-16 次')
  })

  /* ---- addSet 逻辑：week>=5 且 difficulty<=3 或无反馈 ---- */
  it('第 4 周（week<5）：addSet=false，组数仍为 3', () => {
    const plan = buildWeekPlan(4)
    expect(plan.days[0].exercises[1].sets).toContain('3 组')
  })

  it('第 5 周无反馈：addSet=true，组数升到 4', () => {
    const plan = buildWeekPlan(5)
    expect(plan.days[0].exercises[1].sets).toContain('4 组')
  })

  it('第 5 周 difficulty=3（≤3）：addSet=true', () => {
    const plan = buildWeekPlan(5, 3)
    expect(plan.days[0].exercises[1].sets).toContain('4 组')
  })

  it('第 5 周 difficulty=4（≥4）：addSet=false（偏难不加组）', () => {
    const plan = buildWeekPlan(5, 4)
    expect(plan.days[0].exercises[1].sets).toContain('3 组')
  })

  /* ---- difficulty 分支：extra 与 note 调整 ---- */
  it('difficulty>=4：extra = max(0, step-1)，降低进阶幅度', () => {
    // week=7, step=3, difficulty=4 → extra=max(0, 2)=2
    const plan = buildWeekPlan(7, 4)
    // r(8)=8+2=10, r(12)=12+2=14
    expect(plan.days[0].exercises[1].sets).toBe('3 组 × 10-14 次')
    expect(plan.adjustmentNote).toContain('偏难')
  })

  it('difficulty<=2：extra = step+1，额外加量', () => {
    // week=7, step=3, difficulty=2 → extra=4
    const plan = buildWeekPlan(7, 2)
    expect(plan.days[0].exercises[1].sets).toBe('4 组 × 12-16 次')
    expect(plan.adjustmentNote).toContain('较轻松')
  })

  it('difficulty=3：正常进阶（extra=step）', () => {
    // week=7, step=3, difficulty=3 → extra=3
    const plan = buildWeekPlan(7, 3)
    expect(plan.days[0].exercises[1].sets).toBe('4 组 × 11-15 次')
    expect(plan.adjustmentNote).toContain('难度适中')
  })

  it('difficulty=1（最低）：extra = step+1', () => {
    // week=3, step=1, difficulty=1 → extra=2
    const plan = buildWeekPlan(3, 1)
    // r(8)=10, r(12)=14
    expect(plan.days[0].exercises[1].sets).toBe('3 组 × 10-14 次')
  })

  it('difficulty=5（最高）：extra = max(0, step-1)', () => {
    // week=3, step=1, difficulty=5 → extra=max(0,0)=0
    const plan = buildWeekPlan(3, 5)
    expect(plan.days[0].exercises[1].sets).toBe('3 组 × 8-12 次')
  })

  /* ---- 结构完整性 ---- */
  it('返回完整 7 天计划', () => {
    const plan = buildWeekPlan(1)
    expect(plan.days).toHaveLength(7)
    expect(plan.days.map((d) => d.day)).toEqual([
      '周一', '周二', '周三', '周四', '周五', '周六', '周日',
    ])
  })

  it('每天的 type 在合法枚举内', () => {
    const plan = buildWeekPlan(1)
    const validTypes = ['strength', 'sport', 'rest', 'recovery']
    for (const d of plan.days) {
      expect(validTypes).toContain(d.type)
    }
  })

  it('week 字段等于传入参数', () => {
    expect(buildWeekPlan(1).week).toBe(1)
    expect(buildWeekPlan(7).week).toBe(7)
  })

  it('startDate 是 yyyy-MM-dd 格式', () => {
    const plan = buildWeekPlan(1)
    expect(plan.startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('每次调用返回独立对象（无共享引用）', () => {
    const a = buildWeekPlan(1)
    const b = buildWeekPlan(1)
    expect(a).not.toBe(b)
    expect(a.days).not.toBe(b.days)
    expect(a.days[0].exercises).not.toBe(b.days[0].exercises)
  })
})

/* ------------------------------------------------------------------ */
/* copyWeekPlan —— 原样复制下一周                                    */
/* ------------------------------------------------------------------ */
describe('copyWeekPlan', () => {
  const source: WeekPlan = {
    week: 3,
    startDate: '2026-01-05',
    adjustmentNote: '原周说明',
    days: [
      {
        day: '周一',
        focus: '测试',
        type: 'strength',
        exercises: [{ name: '测试动作', sets: '3 组' }],
      },
      ...Array(6).fill({ day: '周二', focus: '休', type: 'rest' as const, exercises: [] }),
    ],
  }

  it('week +1', () => {
    expect(copyWeekPlan(source).week).toBe(4)
  })

  it('不复制源 adjustmentNote，改用固定文案', () => {
    expect(copyWeekPlan(source).adjustmentNote).toBe('沿用上周计划，未做进阶调整。')
  })

  it('深拷贝 exercises（修改副本不影响源）', () => {
    const copy = copyWeekPlan(source)
    copy.days[0].exercises[0].name = '改了'
    expect(source.days[0].exercises[0].name).toBe('测试动作')
  })

  it('startDate 是 yyyy-MM-dd 格式', () => {
    expect(copyWeekPlan(source).startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})

/* ------------------------------------------------------------------ */
/* weeksBetween —— 两个周一日期相隔的自然周数                         */
/* ------------------------------------------------------------------ */
describe('weeksBetween', () => {
  it('同一周返回 0', () => {
    expect(weeksBetween('2026-08-03', '2026-08-03')).toBe(0)
    // 同一周内非周一也归 0（以周一为起点）
    expect(weeksBetween('2026-08-03', '2026-08-05')).toBe(0)
  })

  it('正好跨 1 周返回 1', () => {
    // 2026-08-03 周一 → 2026-08-10 周一
    expect(weeksBetween('2026-08-03', '2026-08-10')).toBe(1)
    // 2026-08-04 周二 → 2026-08-10 周一（跨过一次周一分界）仍为 1
    expect(weeksBetween('2026-08-04', '2026-08-10')).toBe(1)
  })

  it('跨多周正确累计', () => {
    // 2026-08-03 → 2026-08-24 = 3 周
    expect(weeksBetween('2026-08-03', '2026-08-24')).toBe(3)
  })

  it('to 早于 from 返回 0（不返回负数）', () => {
    expect(weeksBetween('2026-08-24', '2026-08-03')).toBe(0)
  })

  it('非法日期返回 0 不抛错', () => {
    expect(weeksBetween('not-a-date', '2026-08-03')).toBe(0)
    expect(weeksBetween('2026-08-03', '')).toBe(0)
  })
})

/* ------------------------------------------------------------------ */
/* mergeOnboardingWeight —— onboarding 体重落到 weights 数组           */
/* 锁定 P0：新用户填的体重必须出现在 weights，否则首页 BMI/热量仍按     */
/* 50.5kg 占位值展示                                                   */
/* ------------------------------------------------------------------ */
describe('mergeOnboardingWeight', () => {
  const PLACEHOLDER: WeightEntry = { date: '2026-01-01', weight: 50.5, bodyFat: null }

  it('无效体重（<=0）：原样返回，不写入', () => {
    expect(mergeOnboardingWeight([PLACEHOLDER], 0, '2026-08-05')).toEqual([PLACEHOLDER])
    expect(mergeOnboardingWeight([PLACEHOLDER], -5, '2026-08-05')).toEqual([PLACEHOLDER])
  })

  it('已有真实历史记录（length>1）：不动', () => {
    const history: WeightEntry[] = [
      { date: '2026-07-01', weight: 60, bodyFat: null },
      { date: '2026-08-01', weight: 61, bodyFat: null },
    ]
    expect(mergeOnboardingWeight(history, 70, '2026-08-05')).toBe(history)
  })

  it('只有占位 entry 且非当天：在头部插入当天记录', () => {
    const result = mergeOnboardingWeight([PLACEHOLDER], 70, '2026-08-05')
    expect(result).toHaveLength(2)
    expect(result[0]).toEqual({ date: '2026-08-05', weight: 70, bodyFat: null })
    // 占位 entry 保留作历史首点
    expect(result[1]).toEqual(PLACEHOLDER)
  })

  it('只有占位 entry 且恰是当天：直接覆盖', () => {
    const todayPlaceholder: WeightEntry = { date: '2026-08-05', weight: 50.5, bodyFat: null }
    const result = mergeOnboardingWeight([todayPlaceholder], 70, '2026-08-05')
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({ date: '2026-08-05', weight: 70, bodyFat: null })
  })

  it('空数组：插入当天记录', () => {
    const result = mergeOnboardingWeight([], 65, '2026-08-05')
    expect(result).toEqual([{ date: '2026-08-05', weight: 65, bodyFat: null }])
  })

  it('不修改入参数组（返回新数组）', () => {
    const prev = [PLACEHOLDER]
    const result = mergeOnboardingWeight(prev, 70, '2026-08-05')
    expect(prev).toEqual([PLACEHOLDER]) // 入参未被改
    expect(result).not.toBe(prev)
  })
})
