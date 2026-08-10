import { describe, it, expect } from 'vitest'
import {
  buildWeekPlan,
  copyWeekPlan,
  bmi,
  bmiLabel,
  proteinRange,
  weeksBetween,
  mergeOnboardingWeight,
  hasUsageTrace,
  needsOnboarding,
  parseSetTarget,
  upsertExerciseLog,
  getLogForDate,
  getLastLogBefore,
  exerciseWeekStats,
  inferLoadType,
  EXERCISE_LOG_CAP,
} from '@/lib/store'
import type { CheckMap, ExerciseLogMap, WeekFeedback, WeekPlan, WeightEntry } from '@/types'

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

/* ------------------------------------------------------------------ */
/* 新老用户判定 —— hasUsageTrace / needsOnboarding                     */
/* ------------------------------------------------------------------ */

// 初始状态：defaultCloudState 的默认值（无任何使用痕迹）
const INITIAL_TRACE = {
  checks: {} as CheckMap,
  feedbacks: [] as WeekFeedback[],
  weights: [{ date: '2026-08-05', weight: 50.5, bodyFat: null }] as WeightEntry[],
  weekPlan: { ...buildWeekPlan(1) },
}

describe('hasUsageTrace', () => {
  it('全初始状态：false（真·新用户）', () => {
    expect(hasUsageTrace(INITIAL_TRACE)).toBe(false)
  })

  it('有打卡记录：true', () => {
    expect(hasUsageTrace({ ...INITIAL_TRACE, checks: { '1:0:0': true } })).toBe(true)
  })

  it('有反馈记录：true', () => {
    expect(hasUsageTrace({ ...INITIAL_TRACE, feedbacks: [{ week: 1, date: '2026-08-05', completion: 80, difficulty: 3, soreness: [], sleep: '', diet: '', note: '' }] })).toBe(true)
  })

  it('weights 多于 1 条（占位不算痕迹）：true', () => {
    expect(
      hasUsageTrace({
        ...INITIAL_TRACE,
        weights: [...INITIAL_TRACE.weights, { date: '2026-08-06', weight: 51, bodyFat: null }],
      }),
    ).toBe(true)
  })

  it('weekPlan 已推进到第 2 周：true（老用户跨周）', () => {
    expect(hasUsageTrace({ ...INITIAL_TRACE, weekPlan: { ...INITIAL_TRACE.weekPlan, week: 2 } })).toBe(true)
  })
})

describe('needsOnboarding', () => {
  it('真·新用户（ready + 未 onboarded）：true', () => {
    expect(needsOnboarding({ ready: true, onboarded: undefined })).toBe(true)
  })

  it('数据未就绪（ready=false）：false', () => {
    expect(needsOnboarding({ ready: false, onboarded: undefined })).toBe(false)
  })

  it('已 onboarded：false', () => {
    expect(needsOnboarding({ ready: true, onboarded: true })).toBe(false)
  })

  // 软迁移：onboarding 是生成计划的唯一入口，不再静默补 onboarded 标志。
  // 老用户（有使用痕迹）同样进引导，完成即迁移到规则引擎计划——与是否有痕迹无关。
  it('老用户（未 onboarded，可能有使用痕迹）：一律 true（锁定迁移行为）', () => {
    expect(needsOnboarding({ ready: true, onboarded: undefined })).toBe(true)
    expect(needsOnboarding({ ready: true, onboarded: false })).toBe(true)
  })
})

/* ------------------------------------------------------------------ */
/* parseSetTarget —— 从 sets 描述解析组数目标（重量记录入口判定）       */
/* ------------------------------------------------------------------ */
describe('parseSetTarget', () => {
  it('常规次数动作："3 组 × 8-12 次"', () => {
    expect(parseSetTarget('3 组 × 8-12 次')).toEqual({ count: 3, repsHint: '8-12 次' })
  })

  it('时间类动作："3 组 × 45 秒"', () => {
    expect(parseSetTarget('3 组 × 45 秒')).toEqual({ count: 3, repsHint: '45 秒' })
  })

  it('带修饰语："4 组 × 每侧 10 次"', () => {
    expect(parseSetTarget('4 组 × 每侧 10 次')).toEqual({ count: 4, repsHint: '每侧 10 次' })
  })

  it('纯时长描述不解析："5 分钟" / "3 小时" / "轻松配速"', () => {
    expect(parseSetTarget('5 分钟')).toBeNull()
    expect(parseSetTarget('3 小时')).toBeNull()
    expect(parseSetTarget('轻松配速')).toBeNull()
  })

  it('组数为 0 或非法：null', () => {
    expect(parseSetTarget('0 组 × 10 次')).toBeNull()
  })
})

/* ------------------------------------------------------------------ */
/* upsertExerciseLog / getLogForDate / getLastLogBefore —— 动作历史记录 */
/* ------------------------------------------------------------------ */
describe('ExerciseLog helpers', () => {
  const rec = (date: string, weightKg: number | null, reps: number | null) => ({
    date,
    week: 1,
    sets: [{ weightKg, reps }],
  })

  it('新日期追加并按日期升序排列', () => {
    let map: ExerciseLogMap = {}
    map = upsertExerciseLog(map, '俯卧撑', rec('2026-08-05', 10, 12))
    map = upsertExerciseLog(map, '俯卧撑', rec('2026-08-03', 8, 10))
    expect(map['俯卧撑'].map((r) => r.date)).toEqual(['2026-08-03', '2026-08-05'])
  })

  it('同一天覆盖而不是追加', () => {
    let map: ExerciseLogMap = {}
    map = upsertExerciseLog(map, '俯卧撑', rec('2026-08-05', 10, 12))
    map = upsertExerciseLog(map, '俯卧撑', rec('2026-08-05', 12.5, 10))
    expect(map['俯卧撑']).toHaveLength(1)
    expect(map['俯卧撑'][0].sets[0]).toEqual({ weightKg: 12.5, reps: 10 })
  })

  it('超出上限裁掉最旧的记录', () => {
    let map: ExerciseLogMap = {}
    for (let i = 1; i <= EXERCISE_LOG_CAP + 5; i++) {
      const date = `2026-08-${String(i).padStart(2, '0')}`
      map = upsertExerciseLog(map, '俯卧撑', rec(date, 10, 10))
    }
    expect(map['俯卧撑']).toHaveLength(EXERCISE_LOG_CAP)
    expect(map['俯卧撑'][0].date).toBe('2026-08-06')
  })

  it('传入 weekStart 时丢弃早于本周的记录（只保留当前周数据）', () => {
    let map: ExerciseLogMap = {}
    map = upsertExerciseLog(map, '俯卧撑', rec('2026-08-03', 8, 10)) // 上周一
    map = upsertExerciseLog(map, '俯卧撑', rec('2026-08-09', 9, 10)) // 上周日
    // 本周一（2026-08-10）写入新记录，weekStart = 本周一
    map = upsertExerciseLog(map, '俯卧撑', rec('2026-08-10', 10, 12), '2026-08-10')
    expect(map['俯卧撑'].map((r) => r.date)).toEqual(['2026-08-10'])
  })

  it('传入 weekStart 时保留本周内的历史记录', () => {
    let map: ExerciseLogMap = {}
    map = upsertExerciseLog(map, '俯卧撑', rec('2026-08-10', 10, 12)) // 周一
    map = upsertExerciseLog(map, '俯卧撑', rec('2026-08-12', 12, 10), '2026-08-10') // 周三
    expect(map['俯卧撑'].map((r) => r.date)).toEqual(['2026-08-10', '2026-08-12'])
  })

  it('getLogForDate 精确取当天记录', () => {
    const map = upsertExerciseLog({}, '俯卧撑', rec('2026-08-05', 10, 12))
    expect(getLogForDate(map, '俯卧撑', '2026-08-05')?.sets[0].weightKg).toBe(10)
    expect(getLogForDate(map, '俯卧撑', '2026-08-06')).toBeUndefined()
    expect(getLogForDate(map, '不存在的动作', '2026-08-05')).toBeUndefined()
  })

  it('getLastLogBefore 取指定日期之前最近一次记录', () => {
    let map: ExerciseLogMap = {}
    map = upsertExerciseLog(map, '俯卧撑', rec('2026-08-03', 8, 10))
    map = upsertExerciseLog(map, '俯卧撑', rec('2026-08-05', 10, 12))
    expect(getLastLogBefore(map, '俯卧撑', '2026-08-10')?.date).toBe('2026-08-05')
    expect(getLastLogBefore(map, '俯卧撑', '2026-08-05')?.date).toBe('2026-08-03')
    expect(getLastLogBefore(map, '俯卧撑', '2026-08-03')).toBeUndefined()
    expect(getLastLogBefore(map, '不存在的动作', '2026-08-10')).toBeUndefined()
  })
})

/* ------------------------------------------------------------------ */
/* exerciseWeekStats —— 容量 / 重量 / 1RM 三条纪录（对齐训记图表页）     */
/* ------------------------------------------------------------------ */
describe('exerciseWeekStats', () => {
  it('空记录返回全 0', () => {
    expect(exerciseWeekStats([])).toEqual({ maxVolume: 0, maxWeight: 0, best1RM: 0, totalReps: 0, maxReps: 0 })
  })

  it('容量取单次训练最大值，重量取单组最大值', () => {
    const stats = exerciseWeekStats([
      // 容量 = 10×12 × 2 = 240
      { date: '2026-08-10', week: 1, sets: [{ weightKg: 10, reps: 12 }, { weightKg: 10, reps: 12 }] },
      // 容量 = 20×6 = 120，但最大重量 20
      { date: '2026-08-12', week: 1, sets: [{ weightKg: 20, reps: 6 }] },
    ])
    expect(stats.maxVolume).toBe(240)
    expect(stats.maxWeight).toBe(20)
  })

  it('1RM 用 Epley 公式：重量 × (1 + 次数/30)，取最佳并保留 1 位小数', () => {
    // 10kg × 12 次 → 10 × 1.4 = 14；20kg × 6 次 → 20 × 1.2 = 24
    const stats = exerciseWeekStats([
      { date: '2026-08-10', week: 1, sets: [{ weightKg: 10, reps: 12 }] },
      { date: '2026-08-12', week: 1, sets: [{ weightKg: 20, reps: 6 }] },
    ])
    expect(stats.best1RM).toBe(24)
  })

  it('自重组（weightKg null）不计入重量纪录和 1RM', () => {
    const stats = exerciseWeekStats([
      { date: '2026-08-10', week: 1, sets: [{ weightKg: null, reps: 15 }] },
    ])
    expect(stats).toEqual({ maxVolume: 0, maxWeight: 0, best1RM: 0, totalReps: 15, maxReps: 15 })
  })
})

/* ------------------------------------------------------------------ */
/* inferLoadType —— 负荷类型推断（旧数据无 loadType 字段时的兜底）       */
/* ------------------------------------------------------------------ */
describe('inferLoadType', () => {
  const ex = (name: string, sets: string, loadType?: 'weighted' | 'bodyweight' | 'timed') => ({
    name,
    sets,
    loadType,
  })

  it('结构化字段优先', () => {
    expect(inferLoadType(ex('随便什么动作', '3 组 × 10 次', 'weighted'))).toBe('weighted')
  })

  it('sets 含"秒" → timed', () => {
    expect(inferLoadType(ex('平板支撑', '3 组 × 45 秒'))).toBe('timed')
  })

  it('哑铃/杠铃/器械关键词 → weighted', () => {
    expect(inferLoadType(ex('哑铃弯举', '3 组 × 12 次'))).toBe('weighted')
    expect(inferLoadType(ex('杠铃深蹲', '3 组 × 8-10 次'))).toBe('weighted')
    expect(inferLoadType(ex('高位下拉', '3 组 × 10-12 次'))).toBe('weighted')
    expect(inferLoadType(ex('俯身反向飞鸟（练后束+上背）', '3 组 × 12 次'))).toBe('weighted')
    expect(inferLoadType(ex('负重卷腹', '3 组 × 15-20 次'))).toBe('weighted')
    expect(inferLoadType(ex('哑铃飞鸟（或毛巾飞鸟）', '3 组 × 12 次'))).toBe('weighted')
  })

  it('自重例外优先于关键词：毛巾开头 / 水瓶 / 引体 / 悬垂举腿 → bodyweight', () => {
    expect(inferLoadType(ex('毛巾飞鸟', '3 组 × 12-15 次'))).toBe('bodyweight')
    expect(inferLoadType(ex('侧平举（装水水瓶）', '3 组 × 12-15 次'))).toBe('bodyweight')
    expect(inferLoadType(ex('引体向上（可弹力带辅助）', '3 组 × 6-10 次'))).toBe('bodyweight')
    expect(inferLoadType(ex('悬垂举腿', '3 组 × 10-12 次'))).toBe('bodyweight')
  })

  it('无关键词的普通动作 → bodyweight（保守，不强迫自重动作填重量）', () => {
    expect(inferLoadType(ex('俯卧撑（跪姿可退阶）', '3 组 × 8-12 次'))).toBe('bodyweight')
    expect(inferLoadType(ex('徒手深蹲', '3 组 × 15-20 次'))).toBe('bodyweight')
    expect(inferLoadType(ex('卷腹', '3 组 × 15 次'))).toBe('bodyweight')
  })
})

/* ------------------------------------------------------------------ */
/* parseSetTarget —— 从 sets 描述解析组数目标（重量记录入口判定）       */
/* ------------------------------------------------------------------ */
describe('parseSetTarget', () => {
  it('常规次数动作："3 组 × 8-12 次"', () => {
    expect(parseSetTarget('3 组 × 8-12 次')).toEqual({ count: 3, repsHint: '8-12 次' })
  })

  it('时间类动作："3 组 × 45 秒"', () => {
    expect(parseSetTarget('3 组 × 45 秒')).toEqual({ count: 3, repsHint: '45 秒' })
  })

  it('带修饰语："4 组 × 每侧 10 次"', () => {
    expect(parseSetTarget('4 组 × 每侧 10 次')).toEqual({ count: 4, repsHint: '每侧 10 次' })
  })

  it('纯时长描述不解析："5 分钟" / "3 小时" / "轻松配速"', () => {
    expect(parseSetTarget('5 分钟')).toBeNull()
    expect(parseSetTarget('3 小时')).toBeNull()
    expect(parseSetTarget('轻松配速')).toBeNull()
  })

  it('组数为 0 或非法：null', () => {
    expect(parseSetTarget('0 组 × 10 次')).toBeNull()
  })
})

/* ------------------------------------------------------------------ */
/* upsertExerciseLog / getLogForDate / getLastLogBefore —— 动作历史记录 */
/* ------------------------------------------------------------------ */
describe('ExerciseLog helpers', () => {
  const rec = (date: string, weightKg: number | null, reps: number | null) => ({
    date,
    week: 1,
    sets: [{ weightKg, reps }],
  })

  it('新日期追加并按日期升序排列', () => {
    let map: ExerciseLogMap = {}
    map = upsertExerciseLog(map, '俯卧撑', rec('2026-08-05', 10, 12))
    map = upsertExerciseLog(map, '俯卧撑', rec('2026-08-03', 8, 10))
    expect(map['俯卧撑'].map((r) => r.date)).toEqual(['2026-08-03', '2026-08-05'])
  })

  it('同一天覆盖而不是追加', () => {
    let map: ExerciseLogMap = {}
    map = upsertExerciseLog(map, '俯卧撑', rec('2026-08-05', 10, 12))
    map = upsertExerciseLog(map, '俯卧撑', rec('2026-08-05', 12.5, 10))
    expect(map['俯卧撑']).toHaveLength(1)
    expect(map['俯卧撑'][0].sets[0]).toEqual({ weightKg: 12.5, reps: 10 })
  })

  it('超出上限裁掉最旧的记录', () => {
    let map: ExerciseLogMap = {}
    for (let i = 1; i <= EXERCISE_LOG_CAP + 5; i++) {
      const date = `2026-08-${String(i).padStart(2, '0')}`
      map = upsertExerciseLog(map, '俯卧撑', rec(date, 10, 10))
    }
    expect(map['俯卧撑']).toHaveLength(EXERCISE_LOG_CAP)
    expect(map['俯卧撑'][0].date).toBe('2026-08-06')
  })

  it('传入 weekStart 时丢弃早于本周的记录（只保留当前周数据）', () => {
    let map: ExerciseLogMap = {}
    map = upsertExerciseLog(map, '俯卧撑', rec('2026-08-03', 8, 10)) // 上周一
    map = upsertExerciseLog(map, '俯卧撑', rec('2026-08-09', 9, 10)) // 上周日
    // 本周一（2026-08-10）写入新记录，weekStart = 本周一
    map = upsertExerciseLog(map, '俯卧撑', rec('2026-08-10', 10, 12), '2026-08-10')
    expect(map['俯卧撑'].map((r) => r.date)).toEqual(['2026-08-10'])
  })

  it('传入 weekStart 时保留本周内的历史记录', () => {
    let map: ExerciseLogMap = {}
    map = upsertExerciseLog(map, '俯卧撑', rec('2026-08-10', 10, 12)) // 周一
    map = upsertExerciseLog(map, '俯卧撑', rec('2026-08-12', 12, 10), '2026-08-10') // 周三
    expect(map['俯卧撑'].map((r) => r.date)).toEqual(['2026-08-10', '2026-08-12'])
  })

  it('getLogForDate 精确取当天记录', () => {
    const map = upsertExerciseLog({}, '俯卧撑', rec('2026-08-05', 10, 12))
    expect(getLogForDate(map, '俯卧撑', '2026-08-05')?.sets[0].weightKg).toBe(10)
    expect(getLogForDate(map, '俯卧撑', '2026-08-06')).toBeUndefined()
    expect(getLogForDate(map, '不存在的动作', '2026-08-05')).toBeUndefined()
  })

  it('getLastLogBefore 取指定日期之前最近一次记录', () => {
    let map: ExerciseLogMap = {}
    map = upsertExerciseLog(map, '俯卧撑', rec('2026-08-03', 8, 10))
    map = upsertExerciseLog(map, '俯卧撑', rec('2026-08-05', 10, 12))
    expect(getLastLogBefore(map, '俯卧撑', '2026-08-10')?.date).toBe('2026-08-05')
    expect(getLastLogBefore(map, '俯卧撑', '2026-08-05')?.date).toBe('2026-08-03')
    expect(getLastLogBefore(map, '俯卧撑', '2026-08-03')).toBeUndefined()
    expect(getLastLogBefore(map, '不存在的动作', '2026-08-10')).toBeUndefined()
  })
})

/* ------------------------------------------------------------------ */
/* exerciseWeekStats —— 容量 / 重量 / 1RM 三条纪录（对齐训记图表页）     */
/* ------------------------------------------------------------------ */
describe('exerciseWeekStats', () => {
  it('空记录返回全 0', () => {
    expect(exerciseWeekStats([])).toEqual({ maxVolume: 0, maxWeight: 0, best1RM: 0, totalReps: 0, maxReps: 0 })
  })

  it('容量取单次训练最大值，重量取单组最大值', () => {
    const stats = exerciseWeekStats([
      // 容量 = 10×12 × 2 = 240
      { date: '2026-08-10', week: 1, sets: [{ weightKg: 10, reps: 12 }, { weightKg: 10, reps: 12 }] },
      // 容量 = 20×6 = 120，但最大重量 20
      { date: '2026-08-12', week: 1, sets: [{ weightKg: 20, reps: 6 }] },
    ])
    expect(stats.maxVolume).toBe(240)
    expect(stats.maxWeight).toBe(20)
  })

  it('1RM 用 Epley 公式：重量 × (1 + 次数/30)，取最佳并保留 1 位小数', () => {
    // 10kg × 12 次 → 10 × 1.4 = 14；20kg × 6 次 → 20 × 1.2 = 24
    const stats = exerciseWeekStats([
      { date: '2026-08-10', week: 1, sets: [{ weightKg: 10, reps: 12 }] },
      { date: '2026-08-12', week: 1, sets: [{ weightKg: 20, reps: 6 }] },
    ])
    expect(stats.best1RM).toBe(24)
  })

  it('自重组（weightKg null）不计入重量纪录和 1RM', () => {
    const stats = exerciseWeekStats([
      { date: '2026-08-10', week: 1, sets: [{ weightKg: null, reps: 15 }] },
    ])
    expect(stats).toEqual({ maxVolume: 0, maxWeight: 0, best1RM: 0, totalReps: 15, maxReps: 15 })
  })
})

/* ------------------------------------------------------------------ */
/* inferLoadType —— 负荷类型推断（旧数据无 loadType 字段时的兜底）       */
/* ------------------------------------------------------------------ */
describe('inferLoadType', () => {
  const ex = (name: string, sets: string, loadType?: 'weighted' | 'bodyweight' | 'timed') => ({
    name,
    sets,
    loadType,
  })

  it('结构化字段优先', () => {
    expect(inferLoadType(ex('随便什么动作', '3 组 × 10 次', 'weighted'))).toBe('weighted')
  })

  it('sets 含"秒" → timed', () => {
    expect(inferLoadType(ex('平板支撑', '3 组 × 45 秒'))).toBe('timed')
  })

  it('哑铃/杠铃/器械关键词 → weighted', () => {
    expect(inferLoadType(ex('哑铃弯举', '3 组 × 12 次'))).toBe('weighted')
    expect(inferLoadType(ex('杠铃深蹲', '3 组 × 8-10 次'))).toBe('weighted')
    expect(inferLoadType(ex('高位下拉', '3 组 × 10-12 次'))).toBe('weighted')
    expect(inferLoadType(ex('俯身反向飞鸟（练后束+上背）', '3 组 × 12 次'))).toBe('weighted')
    expect(inferLoadType(ex('负重卷腹', '3 组 × 15-20 次'))).toBe('weighted')
    expect(inferLoadType(ex('哑铃飞鸟（或毛巾飞鸟）', '3 组 × 12 次'))).toBe('weighted')
  })

  it('自重例外优先于关键词：毛巾开头 / 水瓶 / 引体 / 悬垂举腿 → bodyweight', () => {
    expect(inferLoadType(ex('毛巾飞鸟', '3 组 × 12-15 次'))).toBe('bodyweight')
    expect(inferLoadType(ex('侧平举（装水水瓶）', '3 组 × 12-15 次'))).toBe('bodyweight')
    expect(inferLoadType(ex('引体向上（可弹力带辅助）', '3 组 × 6-10 次'))).toBe('bodyweight')
    expect(inferLoadType(ex('悬垂举腿', '3 组 × 10-12 次'))).toBe('bodyweight')
  })

  it('无关键词的普通动作 → bodyweight（保守，不强迫自重动作填重量）', () => {
    expect(inferLoadType(ex('俯卧撑（跪姿可退阶）', '3 组 × 8-12 次'))).toBe('bodyweight')
    expect(inferLoadType(ex('徒手深蹲', '3 组 × 15-20 次'))).toBe('bodyweight')
    expect(inferLoadType(ex('卷腹', '3 组 × 15 次'))).toBe('bodyweight')
  })
})
