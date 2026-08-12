import { describe, it, expect } from 'vitest'
import {
  bmi,
  bmiLabel,
  proteinRange,
  weightDeltaTone,
  weeksBetween,
  mergeOnboardingWeight,
  hasUsageTrace,
  needsOnboarding,
  parseSetTarget,
  upsertExerciseLog,
  removeExerciseLog,
  pruneEmptySets,
  cleanExerciseLogMap,
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
/* 新逻辑：空数组时插入当天 entry；已有记录则不动（用户在 BodyData 自记）*/
/* ------------------------------------------------------------------ */
describe('mergeOnboardingWeight', () => {
  it('无效体重（<=0）：原样返回，不写入', () => {
    expect(mergeOnboardingWeight([], 0, '2026-08-05')).toEqual([])
    expect(mergeOnboardingWeight([], -5, '2026-08-05')).toEqual([])
  })

  it('已有真实历史记录（length>=1）：不动', () => {
    // 单条记录（如刚完成 onboarding 的用户）
    const single: WeightEntry[] = [
      { date: '2026-08-01', weight: 61, bodyFat: null },
    ]
    expect(mergeOnboardingWeight(single, 70, '2026-08-05')).toBe(single)

    // 多条记录（用户在 BodyData 自行记录过）
    const multi: WeightEntry[] = [
      { date: '2026-07-01', weight: 60, bodyFat: null },
      { date: '2026-08-01', weight: 61, bodyFat: null },
    ]
    expect(mergeOnboardingWeight(multi, 70, '2026-08-05')).toBe(multi)
  })

  it('空数组 + 有效体重：插入当天记录', () => {
    const result = mergeOnboardingWeight([], 65, '2026-08-05')
    expect(result).toEqual([{ date: '2026-08-05', weight: 65, bodyFat: null }])
  })

  it('不修改入参数组（返回新数组）', () => {
    const prev: WeightEntry[] = []
    const result = mergeOnboardingWeight(prev, 70, '2026-08-05')
    expect(prev).toEqual([]) // 入参未被改
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
  weights: [] as WeightEntry[],
  weekPlan: { week: 1, startDate: '2026-08-03', days: [], adjustmentNote: '' } as WeekPlan,
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

  it('weights 多于 1 条：true', () => {
    expect(
      hasUsageTrace({
        ...INITIAL_TRACE,
        weights: [
          { date: '2026-08-05', weight: 60, bodyFat: null },
          { date: '2026-08-06', weight: 61, bodyFat: null },
        ],
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

  it('removeExerciseLog 只删指定日期的记录', () => {
    let map: ExerciseLogMap = {}
    map = upsertExerciseLog(map, '俯卧撑', rec('2026-08-03', 8, 10))
    map = upsertExerciseLog(map, '俯卧撑', rec('2026-08-05', 10, 12))
    const next = removeExerciseLog(map, '俯卧撑', '2026-08-05')
    expect(next['俯卧撑'].map((r) => r.date)).toEqual(['2026-08-03'])
    // 不动原 map（不可变更新）
    expect(map['俯卧撑']).toHaveLength(2)
  })

  it('removeExerciseLog 删完最后一条时连键一起移除', () => {
    const map = upsertExerciseLog({}, '俯卧撑', rec('2026-08-05', 10, 12))
    const next = removeExerciseLog(map, '俯卧撑', '2026-08-05')
    expect(next['俯卧撑']).toBeUndefined()
    expect('俯卧撑' in next).toBe(false)
  })

  it('removeExerciseLog 删不到记录时原样返回', () => {
    const map = upsertExerciseLog({}, '俯卧撑', rec('2026-08-05', 10, 12))
    expect(removeExerciseLog(map, '俯卧撑', '2026-08-06')).toBe(map)
    expect(removeExerciseLog(map, '不存在的动作', '2026-08-05')).toBe(map)
  })

  it('pruneEmptySets 剔除空组，保留合法的自重组', () => {
    const sets = [
      { weightKg: 2.5, reps: 10 }, // 合法负重组
      { weightKg: null, reps: 10 }, // 合法自重组（重量 null 不是脏数据）
      { weightKg: 0, reps: 0 },
      { weightKg: 0, reps: 10 }, // 重量 0 一定脏（负重不允许 0，自重是 null）
      { weightKg: 2.5, reps: 0 },
      { weightKg: null, reps: null },
    ]
    expect(pruneEmptySets(sets)).toEqual([
      { weightKg: 2.5, reps: 10 },
      { weightKg: null, reps: 10 },
    ])
  })

  it('cleanExerciseLogMap 剔除空组，让「N组」计数与容量重新对齐', () => {
    // 复现线上脏数据：3 组里只有第 1 组有效 → 摘要显示 3组 但容量只算 1 组
    const map: ExerciseLogMap = {
      卧推: [{ date: '2026-08-10', week: 1, sets: [{ weightKg: 2.5, reps: 10 }, { weightKg: 0, reps: 0 }, { weightKg: 0, reps: 0 }] }],
    }
    const next = cleanExerciseLogMap(map)
    expect(next['卧推'][0].sets).toEqual([{ weightKg: 2.5, reps: 10 }])
  })

  it('cleanExerciseLogMap 清洗后整条为空的记录连键移除', () => {
    const map: ExerciseLogMap = {
      卧推: [{ date: '2026-08-10', week: 1, sets: [{ weightKg: 0, reps: 0 }] }],
    }
    const next = cleanExerciseLogMap(map)
    expect('卧推' in next).toBe(false)
  })

  it('cleanExerciseLogMap 数据干净时原样返回（引用不变）', () => {
    const map = upsertExerciseLog({}, '俯卧撑', rec('2026-08-05', 10, 12))
    expect(cleanExerciseLogMap(map)).toBe(map)
  })

  it('upsertExerciseLog 写入时剔空组；整条皆空视为无效写入', () => {
    const map = upsertExerciseLog({}, '卧推', {
      date: '2026-08-10',
      week: 1,
      sets: [{ weightKg: 2.5, reps: 10 }, { weightKg: 0, reps: 0 }],
    })
    expect(map['卧推'][0].sets).toEqual([{ weightKg: 2.5, reps: 10 }])
    const empty = upsertExerciseLog({}, '卧推', {
      date: '2026-08-10',
      week: 1,
      sets: [{ weightKg: 0, reps: 0 }],
    })
    expect('卧推' in empty).toBe(false)
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
/* weightDeltaTone —— 体重变化方向是否符合目标预期（Overview 着色）      */
/* ------------------------------------------------------------------ */
describe('weightDeltaTone', () => {
  it('增肌：上涨 good / 下降 bad', () => {
    expect(weightDeltaTone('gain', 1.5)).toBe('good')
    expect(weightDeltaTone('gain', -0.8)).toBe('bad')
  })

  it('减脂：下降 good / 上涨 bad（与增肌相反）', () => {
    expect(weightDeltaTone('lose', -1.2)).toBe('good')
    expect(weightDeltaTone('lose', 0.5)).toBe('bad')
  })

  it('塑形/保持：方向中性（关注体脂而非体重绝对值）', () => {
    expect(weightDeltaTone('recomp', 1.0)).toBe('neutral')
    expect(weightDeltaTone('recomp', -1.0)).toBe('neutral')
    expect(weightDeltaTone('maintain', 0.5)).toBe('neutral')
    expect(weightDeltaTone('maintain', -0.5)).toBe('neutral')
  })

  it('近似零（浮点噪声 <0.01kg）一律 neutral', () => {
    expect(weightDeltaTone('gain', 0)).toBe('neutral')
    expect(weightDeltaTone('gain', 0.005)).toBe('neutral')
    expect(weightDeltaTone('lose', -0.009)).toBe('neutral')
  })

  it('goal 为 undefined：兜底按增肌方向（涨好跌坏）', () => {
    expect(weightDeltaTone(undefined, 1)).toBe('good')
    expect(weightDeltaTone(undefined, -1)).toBe('bad')
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
