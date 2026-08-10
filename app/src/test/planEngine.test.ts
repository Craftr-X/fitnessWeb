import { describe, it, expect } from 'vitest'
import {
  buildWeekPlanFromProfile,
  buildNextWeekPlan,
  computeProgression,
  splitMuscleGroups,
  tuneByGoal,
  filterByInjury,
  assembleWeek,
  copyWeekPlanFromProfile,
  describeProfile,
  currentMonday,
} from '@/lib/planEngine'
import { buildWeekPlan } from '@/lib/store'
import type { Profile, WeekFeedback, WeekPlan } from '@/types'

/** 测试用画像：男 / 25 岁 / 175cm / 70kg / 增肌 / 新手 / 4 天 / 哑铃 / 跑步 */
const BASE_PROFILE: Profile = {
  name: '测试',
  heightCm: 175,
  onboarded: true,
  gender: 'male',
  age: 25,
  weightKg: 70,
  weightGoal: 'gain',
  experience: 'beginner',
  trainDaysPerWeek: 4,
  equipment: 'dumbbell',
  sport: 'running',
  sportHours: 2,
  injuries: [],
}

/** 测试用反馈：默认值不触发任何调整规则，按需覆盖字段 */
const makeFb = (over: Partial<WeekFeedback> = {}): WeekFeedback => ({
  week: 6,
  date: '2026-08-02',
  completion: 80,
  difficulty: 3,
  soreness: [],
  sleep: '7-8',
  diet: '基本达标',
  note: '',
  ...over,
})

/** 第一个力量训练日（BASE_PROFILE：周一 胸 + 三头，exercises[1] 是主项哑铃卧推） */
const firstStrength = (plan: WeekPlan) => plan.days.find((d) => d.type === 'strength')!
/** 主项动作的次数下界 */
const loRepOf = (plan: WeekPlan) =>
  Number(firstStrength(plan).exercises[1].sets.match(/×\s*(\d+)/)?.[1] ?? 0)
/** 主项动作的组数 */
const setsOf = (plan: WeekPlan) =>
  Number(firstStrength(plan).exercises[1].sets.match(/^(\d+) 组/)?.[1] ?? 0)
/** 某一天所有「N 组」动作的组数列表（跳过热身/拉伸等分钟制条目） */
const setCounts = (day: WeekPlan['days'][number]) =>
  day.exercises
    .filter((e) => /^\d+ 组/.test(e.sets))
    .map((e) => Number(e.sets.match(/^(\d+)/)?.[1]))

/* ------------------------------------------------------------------ */
/* computeProgression —— 渐进超负荷                                     */
/* ------------------------------------------------------------------ */
describe('computeProgression', () => {
  it('第 1 周：step=0，无进阶', () => {
    const p = computeProgression(1)
    expect(p.extra).toBe(0)
    expect(p.addSet).toBe(false)
  })

  it('第 3 周：step=1', () => {
    expect(computeProgression(3).extra).toBe(1)
  })

  it('第 9 周后：step 封顶 4', () => {
    expect(computeProgression(20).extra).toBe(4)
  })

  it('week>=5 且无反馈：addSet=true', () => {
    expect(computeProgression(5).addSet).toBe(true)
  })

  it('difficulty>=4 降低进阶幅度', () => {
    // week=7 step=3, difficulty=4 → extra=max(0,2)=2
    expect(computeProgression(7, 4).extra).toBe(2)
    expect(computeProgression(7, 4).addSet).toBe(false)
  })

  it('difficulty<=2 额外加量', () => {
    // week=7 step=3, difficulty=2 → extra=4
    expect(computeProgression(7, 2).extra).toBe(4)
  })
})

/* ------------------------------------------------------------------ */
/* splitMuscleGroups —— 肌群分配                                        */
/* ------------------------------------------------------------------ */
describe('splitMuscleGroups', () => {
  it('3 天无专项：推/拉/腿', () => {
    expect(splitMuscleGroups(3, false)).toEqual(['push', 'pull', 'legs'])
  })

  it('3 天有专项：减少腿日，改为推/拉/核心', () => {
    expect(splitMuscleGroups(3, true)).toEqual(['push', 'pull', 'core'])
  })

  it('4 天：胸/背/肩/腿（无专项）', () => {
    expect(splitMuscleGroups(4, false)).toEqual(['chest', 'back', 'shoulder', 'legs'])
  })

  it('5 天：胸/背/肩/手臂/腿', () => {
    expect(splitMuscleGroups(5, false)).toEqual(['chest', 'back', 'shoulder', 'arms', 'legs'])
  })

  it('6 天：6 个独立肌群', () => {
    expect(splitMuscleGroups(6, false)).toHaveLength(6)
  })

  it('小于 2 钳制为 2（返回 2 个全身日）', () => {
    expect(splitMuscleGroups(1, false)).toEqual(['fullbody', 'fullbody'])
  })

  it('大于 6 钳制为 6', () => {
    expect(splitMuscleGroups(10, false)).toHaveLength(6)
  })
})

/* ------------------------------------------------------------------ */
/* tuneByGoal —— 目标调节                                              */
/* ------------------------------------------------------------------ */
describe('tuneByGoal', () => {
  it('增肌：次数不偏移，组数不偏移', () => {
    const t = tuneByGoal('gain')
    expect(t.repOffset).toBe(0)
    expect(t.setOffset).toBe(0)
  })

  it('减脂：次数偏高、组数偏少', () => {
    const t = tuneByGoal('lose')
    expect(t.repOffset).toBeGreaterThan(0)
    expect(t.setOffset).toBeLessThan(0)
  })

  it('塑形：适度次数偏移', () => {
    expect(tuneByGoal('recomp').repOffset).toBeGreaterThan(0)
  })

  it('保持：零偏移', () => {
    const t = tuneByGoal('maintain')
    expect(t.repOffset).toBe(0)
    expect(t.setOffset).toBe(0)
  })
})

/* ------------------------------------------------------------------ */
/* filterByInjury —— 伤病过滤                                          */
/* ------------------------------------------------------------------ */
describe('filterByInjury', () => {
  it('无伤病：原样返回', () => {
    const pool = [{ name: '深蹲', baseLo: 10, baseHi: 12 }]
    expect(filterByInjury('legs', pool, undefined)).toEqual(pool)
    expect(filterByInjury('legs', pool, [])).toEqual(pool)
  })

  it('膝盖伤：过滤深蹲/弓步，补充靠墙静蹲', () => {
    const pool = [
      { name: '徒手深蹲', baseLo: 15, baseHi: 20 },
      { name: '弓步蹲', baseLo: 10, baseHi: 12 },
      { name: '臀桥', baseLo: 15, baseHi: 20 },
    ]
    const result = filterByInjury('legs', pool, ['膝盖不适'])
    const names = result.map((r) => r.name)
    expect(names).not.toContain('徒手深蹲')
    expect(names).not.toContain('弓步蹲')
    expect(names).toContain('臀桥')
    expect(names).toContain('靠墙静蹲')
  })

  it('肩伤：过滤推举类', () => {
    const pool = [
      { name: '哑铃肩上推举', baseLo: 10, baseHi: 12 },
      { name: '哑铃侧平举', baseLo: 12, baseHi: 15 },
    ]
    const result = filterByInjury('shoulder', pool, ['肩部劳损'])
    expect(result.some((r) => r.name.includes('推举'))).toBe(false)
  })

  it('过滤后为空时保留原池（不返回空数组）', () => {
    const pool = [{ name: '深蹲', baseLo: 10, baseHi: 12 }]
    // 全部命中的极端情况：过滤后为空 → 兜底返回原池
    const result = filterByInjury('legs', pool, ['膝盖'])
    expect(result.length).toBeGreaterThan(0)
  })

  it('跨肌群不污染：膝盖伤不应给肩日注入靠墙静蹲', () => {
    const shoulderPool = [
      { name: '哑铃肩上推举', baseLo: 10, baseHi: 12 },
      { name: '哑铃侧平举', baseLo: 12, baseHi: 15 },
    ]
    const result = filterByInjury('shoulder', shoulderPool, ['膝盖'])
    const names = result.map((r) => r.name)
    expect(names).not.toContain('靠墙静蹲')
    // 肩日原动作保留
    expect(names).toContain('哑铃肩上推举')
  })

  it('跨肌群不污染：肩伤不应给腿日注入侧平举', () => {
    const legsPool = [{ name: '徒手深蹲', baseLo: 15, baseHi: 20 }]
    const result = filterByInjury('legs', legsPool, ['肩部劳损'])
    const names = result.map((r) => r.name)
    expect(names).not.toContain('轻量侧平举')
  })
})

/* ------------------------------------------------------------------ */
/* assembleWeek —— 7 天组装                                            */
/* ------------------------------------------------------------------ */
describe('assembleWeek', () => {
  const baseOpts = {
    equipment: 'dumbbell' as const,
    experience: 'beginner' as const,
    progression: computeProgression(1),
    tuning: tuneByGoal('gain'),
  }

  it('始终返回 7 天', () => {
    const days = assembleWeek(['push', 'pull', 'legs'], baseOpts)
    expect(days).toHaveLength(7)
  })

  it('周日固定为复盘休息日', () => {
    const days = assembleWeek(['push', 'pull', 'legs'], baseOpts)
    expect(days[6].type).toBe('rest')
    expect(days[6].focus).toContain('复盘')
  })

  it('有专项运动时周六是 sport 日', () => {
    const days = assembleWeek(['push', 'pull', 'core'], {
      ...baseOpts,
      sport: 'running',
      sportHours: 2,
    })
    expect(days[5].type).toBe('sport')
    expect(days[5].focus).toContain('跑步')
  })

  it('无专项运动时无 sport 日', () => {
    const days = assembleWeek(['push', 'pull', 'legs'], {
      ...baseOpts,
      sport: 'none',
      sportHours: 0,
    })
    expect(days.every((d) => d.type !== 'sport')).toBe(true)
  })

  it('day.type 只用合法 4 种枚举', () => {
    const days = assembleWeek(['chest', 'back', 'shoulder', 'legs'], {
      ...baseOpts,
      sport: 'badminton',
      sportHours: 3,
    })
    const valid = ['strength', 'sport', 'rest', 'recovery']
    for (const d of days) expect(valid).toContain(d.type)
  })

  it('训练日按 slot 分布，不挤在同一天', () => {
    const days = assembleWeek(['push', 'pull', 'legs'], baseOpts)
    const strengthDays = days.filter((d) => d.type === 'strength')
    expect(strengthDays).toHaveLength(3)
  })
})

/* ------------------------------------------------------------------ */
/* buildWeekPlanFromProfile —— 主函数集成                              */
/* ------------------------------------------------------------------ */
describe('buildWeekPlanFromProfile', () => {
  it('返回完整 7 天，顺序为周一到周日', () => {
    const plan = buildWeekPlanFromProfile(BASE_PROFILE, 1)
    expect(plan.days).toHaveLength(7)
    expect(plan.days.map((d) => d.day)).toEqual([
      '周一', '周二', '周三', '周四', '周五', '周六', '周日',
    ])
  })

  it('week 字段等于传入参数', () => {
    expect(buildWeekPlanFromProfile(BASE_PROFILE, 1).week).toBe(1)
    expect(buildWeekPlanFromProfile(BASE_PROFILE, 5).week).toBe(5)
  })

  it('startDate 是 yyyy-MM-dd 格式且等于当前周一', () => {
    const plan = buildWeekPlanFromProfile(BASE_PROFILE, 1)
    expect(plan.startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(plan.startDate).toBe(currentMonday())
  })

  it('每次调用返回独立对象（无共享引用）', () => {
    const a = buildWeekPlanFromProfile(BASE_PROFILE, 1)
    const b = buildWeekPlanFromProfile(BASE_PROFILE, 1)
    expect(a).not.toBe(b)
    expect(a.days).not.toBe(b.days)
    expect(a.days[0].exercises).not.toBe(b.days[0].exercises)
  })

  it('difficulty 透传到渐进参数（adjustmentNote 体现）', () => {
    const hard = buildWeekPlanFromProfile(BASE_PROFILE, 7, makeFb({ difficulty: 4 }))
    expect(hard.adjustmentNote).toContain('偏难')
    const easy = buildWeekPlanFromProfile(BASE_PROFILE, 7, makeFb({ difficulty: 2 }))
    expect(easy.adjustmentNote).toContain('较轻松')
  })

  /* ---- 差异化：不同画像产出不同计划 ---- */
  it('减脂 vs 增肌：相同动作次数更高（repOffset 生效）', () => {
    const gain = buildWeekPlanFromProfile({ ...BASE_PROFILE, weightGoal: 'gain' }, 1)
    const lose = buildWeekPlanFromProfile({ ...BASE_PROFILE, weightGoal: 'lose' }, 1)
    // 取同一个 strength 日的主项动作次数对比
    const gainMain = gain.days.find((d) => d.type === 'strength')!.exercises[1].sets
    const loseMain = lose.days.find((d) => d.type === 'strength')!.exercises[1].sets
    // 提取次数下界
    const extractLo = (s: string) => Number(s.match(/×\s*(\d+)/)?.[1] ?? 0)
    expect(extractLo(loseMain)).toBeGreaterThan(extractLo(gainMain))
  })

  it('不同器械：健身房 vs 无器械，动作名不同', () => {
    const none = buildWeekPlanFromProfile({ ...BASE_PROFILE, equipment: 'none' }, 1)
    const gym = buildWeekPlanFromProfile({ ...BASE_PROFILE, equipment: 'gym' }, 1)
    const noneNames = none.days
      .find((d) => d.type === 'strength')!
      .exercises.map((e) => e.name)
      .join()
    const gymNames = gym.days
      .find((d) => d.type === 'strength')!
      .exercises.map((e) => e.name)
      .join()
    expect(noneNames).not.toEqual(gymNames)
    // 无器械日应含"俯卧撑"或徒手类
    expect(noneNames).toMatch(/俯卧撑|徒手|水瓶/)
    // 健身房日应含杠铃/器械类
    expect(gymNames).toMatch(/杠铃|绳索|引体/)
  })

  it('不同训练天数：3 vs 5，力量训练日数量不同', () => {
    const d3 = buildWeekPlanFromProfile({ ...BASE_PROFILE, trainDaysPerWeek: 3, sport: 'none', sportHours: 0 }, 1)
    const d5 = buildWeekPlanFromProfile({ ...BASE_PROFILE, trainDaysPerWeek: 5, sport: 'none', sportHours: 0 }, 1)
    const count3 = d3.days.filter((d) => d.type === 'strength').length
    const count5 = d5.days.filter((d) => d.type === 'strength').length
    expect(count5).toBeGreaterThan(count3)
  })

  it('有专项运动：周六为 sport 日且 focus 含运动名', () => {
    const plan = buildWeekPlanFromProfile(
      { ...BASE_PROFILE, sport: 'badminton', sportHours: 3 },
      1,
    )
    expect(plan.days[5].type).toBe('sport')
    expect(plan.days[5].focus).toContain('羽毛球')
  })

  it('无专项运动：无 sport 日，力量日按肌群分', () => {
    const plan = buildWeekPlanFromProfile(
      { ...BASE_PROFILE, sport: 'none', sportHours: 0 },
      1,
    )
    expect(plan.days.every((d) => d.type !== 'sport')).toBe(true)
  })

  it('新手：组数封顶 3（不被 addSet 拉到 4）', () => {
    // week=5 本应 addSet=true 拉到 4 组，但 beginner 封顶 3
    const plan = buildWeekPlanFromProfile(
      { ...BASE_PROFILE, experience: 'beginner' },
      5,
    )
    const strength = plan.days.find((d) => d.type === 'strength')!
    // 主项动作（非热身/拉伸）的组数应 ≤ 3
    const mainSets = strength.exercises
      .filter((e) => /^\d+ 组/.test(e.sets))
      .map((e) => Number(e.sets.match(/^(\d+)/)?.[1]))
    for (const s of mainSets) expect(s).toBeLessThanOrEqual(3)
  })

  it('进阶 + 第 5 周：组数可到 4', () => {
    const plan = buildWeekPlanFromProfile(
      { ...BASE_PROFILE, experience: 'intermediate' },
      5,
    )
    const strength = plan.days.find((d) => d.type === 'strength')!
    const maxSets = Math.max(
      ...strength.exercises
        .filter((e) => /^\d+ 组/.test(e.sets))
        .map((e) => Number(e.sets.match(/^(\d+)/)?.[1])),
    )
    expect(maxSets).toBeGreaterThanOrEqual(4)
  })

  /* ---- 缺失字段的兜底 ---- */
  it('profile 几乎为空（仅老字段）：不抛错，产出可用的默认计划', () => {
    const minimal: Profile = {
      name: '我',
      heightCm: 170,
    }
    const plan = buildWeekPlanFromProfile(minimal, 1)
    expect(plan.days).toHaveLength(7)
    expect(plan.days.every((d) => d.exercises.length > 0)).toBe(true)
  })

  it('伤病过滤生效：膝盖伤的计划里深蹲被替代', () => {
    const plan = buildWeekPlanFromProfile(
      { ...BASE_PROFILE, injuries: ['膝盖不适'], trainDaysPerWeek: 5, sport: 'none', sportHours: 0 },
      1,
    )
    const legDay = plan.days.find((d) => d.focus.includes('腿'))
    if (legDay) {
      const names = legDay.exercises.map((e) => e.name).join()
      expect(names).not.toMatch(/深蹲|弓步/)
    }
  })

  it('膝盖伤不污染其他肌群日（肩日不能出现靠墙静蹲）', () => {
    const plan = buildWeekPlanFromProfile(
      { ...BASE_PROFILE, injuries: ['膝盖'], trainDaysPerWeek: 4, sport: 'badminton', sportHours: 3 },
      1,
    )
    // 检查所有非腿日的 strength 日，都不应混入靠墙静蹲
    for (const d of plan.days) {
      if (d.type === 'strength' && !d.focus.includes('腿')) {
        const names = d.exercises.map((e) => e.name).join()
        expect(names).not.toContain('靠墙静蹲')
      }
    }
  })
})

/* ------------------------------------------------------------------ */
/* buildWeekPlanFromProfile —— 每周反馈驱动调整                          */
/* ------------------------------------------------------------------ */
describe('buildWeekPlanFromProfile — 每周反馈驱动调整', () => {
  it('完成度 <60%：进阶降一阶 + 组数上限 -1，并说明原因', () => {
    const plan = buildWeekPlanFromProfile(BASE_PROFILE, 7, makeFb({ completion: 50 }))
    // week=7 step=3，降量后 extra=2 → 主项 8+2=10 次起
    expect(loRepOf(plan)).toBe(10)
    // beginner 常规封顶 3 组，降量后 2 组
    expect(setsOf(plan)).toBe(2)
    expect(plan.adjustmentNote).toContain('上周完成度偏低（50%），本周训练量下调')
  })

  it('完成度低 + difficulty≥4：降阶不重复触发（只额外叠加组数上限 -1）', () => {
    const hardOnly = buildWeekPlanFromProfile(BASE_PROFILE, 7, makeFb({ difficulty: 5 }))
    const both = buildWeekPlanFromProfile(BASE_PROFILE, 7, makeFb({ difficulty: 5, completion: 40 }))
    // 次数进阶相同（只降一阶，不双重降）
    expect(loRepOf(both)).toBe(loRepOf(hardOnly))
    // 组数上限仍因完成度低再降一档
    expect(setsOf(hardOnly)).toBe(3)
    expect(setsOf(both)).toBe(2)
  })

  it('完成度 ≥90% 且 difficulty≤2：在常规台阶上额外 +1 阶', () => {
    const plan = buildWeekPlanFromProfile(BASE_PROFILE, 7, makeFb({ completion: 95, difficulty: 2 }))
    // step=3；difficulty≤2 已 +1，完成度规则再 +1 → extra=5 → 8+5=13
    expect(loRepOf(plan)).toBe(13)
    expect(plan.adjustmentNote).toContain('上周完成度很高且感觉轻松，本周适度加量')
  })

  it('酸痛部位命中训练日：该日组数 -1（不低于 2）并标注 tip，其他日不受影响', () => {
    const plan = buildWeekPlanFromProfile(BASE_PROFILE, 1, makeFb({ soreness: ['胸'] }))
    const chestDay = plan.days[0]
    expect(chestDay.focus).toContain('胸')
    // week=1 beginner 常规 3 组 → 全部降为 2 组
    expect(setCounts(chestDay).every((s) => s === 2)).toBe(true)
    expect(chestDay.tip).toContain('（上周酸痛，减量恢复）')
    // 周二背日不受影响
    expect(setCounts(plan.days[1]).every((s) => s === 3)).toBe(true)
    expect(plan.days[1].tip).not.toContain('减量恢复')
  })

  it('全身轻微酸痛：不减量，只在最后一个训练日加恢复提醒', () => {
    const plan = buildWeekPlanFromProfile(BASE_PROFILE, 1, makeFb({ soreness: ['全身轻微'] }))
    const allSets = plan.days.flatMap((d) => setCounts(d))
    expect(allSets.every((s) => s === 3)).toBe(true)
    const trainDays = plan.days.filter((d) => d.type === 'strength' || d.type === 'sport')
    expect(trainDays[trainDays.length - 1].tip).toContain('充分热身、拉伸和恢复')
  })

  it('无明显酸痛：不做任何减量或提示', () => {
    const plan = buildWeekPlanFromProfile(BASE_PROFILE, 1, makeFb({ soreness: ['无明显酸痛'] }))
    expect(setsOf(plan)).toBe(3)
    for (const d of plan.days) expect(d.tip ?? '').not.toContain('减量恢复')
  })

  it('睡眠 <6 小时：本周不加量（轻松 + 高完成度的加成被压住），休息日提示补觉', () => {
    const normal = buildWeekPlanFromProfile(BASE_PROFILE, 7, makeFb({ difficulty: 3 }))
    const sleepy = buildWeekPlanFromProfile(BASE_PROFILE, 7, makeFb({ difficulty: 2, completion: 95, sleep: '<6' }))
    // 不加睡眠规则会走到 extra=5，被睡眠规则压回 step=3，与正常进阶持平
    expect(loRepOf(sleepy)).toBe(loRepOf(normal))
    expect(sleepy.adjustmentNote).toContain('睡眠不足会影响恢复，本周不加量')
    const restDay = sleepy.days.find((d) => d.type === 'rest')!
    expect(restDay.tip).toContain('睡够 7-9 小时')
  })

  it('睡眠 <6 小时：addSet 也被抑制（进阶用户第 5 周仍 3 组）', () => {
    const plan = buildWeekPlanFromProfile(
      { ...BASE_PROFILE, experience: 'intermediate' },
      5,
      makeFb({ sleep: '<6' }),
    )
    expect(setsOf(plan)).toBe(3)
  })

  it('饮食经常不够 + 增肌目标：训练日提示蛋白质', () => {
    const plan = buildWeekPlanFromProfile(BASE_PROFILE, 3, makeFb({ diet: '经常不够' }))
    const tips = plan.days.filter((d) => d.type === 'strength').map((d) => d.tip ?? '').join()
    expect(tips).toContain('蛋白质要吃够')
  })

  it('饮食完全没注意 + 减脂目标：训练日提示热量缺口纪律', () => {
    const plan = buildWeekPlanFromProfile(
      { ...BASE_PROFILE, weightGoal: 'lose' },
      3,
      makeFb({ diet: '完全没注意' }),
    )
    const tips = plan.days.filter((d) => d.type === 'strength').map((d) => d.tip ?? '').join()
    expect(tips).toContain('规律记录饮食')
  })

  it('饮食基本达标：不加饮食提示', () => {
    const plan = buildWeekPlanFromProfile(BASE_PROFILE, 3, makeFb({ diet: '基本达标' }))
    const tips = plan.days.filter((d) => d.type === 'strength').map((d) => d.tip ?? '').join()
    expect(tips).not.toContain('蛋白质要吃够')
  })

  it('adjustmentNote：无反馈时保持原有进阶说明', () => {
    const plan = buildWeekPlanFromProfile(BASE_PROFILE, 3)
    expect(plan.adjustmentNote).toBe('第 3 周：在前一阶段基础上动作次数 +1（渐进超负荷）。')
  })

  it('adjustmentNote：有反馈但未触发任何规则 → 兜底文案', () => {
    const plan = buildWeekPlanFromProfile(BASE_PROFILE, 3, makeFb())
    expect(plan.adjustmentNote).toContain('根据上周反馈检查，本周保持原计划节奏。')
  })

  it('adjustmentNote：多条规则触发时用「；」拼接', () => {
    const plan = buildWeekPlanFromProfile(BASE_PROFILE, 7, makeFb({ completion: 50, sleep: '<6' }))
    expect(plan.adjustmentNote).toContain('训练量下调')
    expect(plan.adjustmentNote).toContain('睡眠不足')
    expect(plan.adjustmentNote).toContain('；')
  })
})

/* ------------------------------------------------------------------ */
/* buildNextWeekPlan —— 统一的生成下周入口                               */
/* ------------------------------------------------------------------ */
describe('buildNextWeekPlan', () => {
  it('onboarded 用户走规则引擎，吃完整反馈', () => {
    const from = buildWeekPlanFromProfile(BASE_PROFILE, 1)
    const next = buildNextWeekPlan(BASE_PROFILE, from, makeFb({ completion: 50 }))
    expect(next.week).toBe(2)
    expect(next.adjustmentNote).toContain('训练量下调')
  })

  it('未 onboarded 用户回退老模板（只吃 difficulty）', () => {
    const from = buildWeekPlan(2, 3)
    const next = buildNextWeekPlan({ name: '我', heightCm: 170 }, from, makeFb({ difficulty: 4 }))
    expect(next.week).toBe(3)
    expect(next.adjustmentNote).toContain('偏难')
  })

  it('支持指定目标周（跨多周补齐），无反馈也可生成', () => {
    const from = buildWeekPlanFromProfile(BASE_PROFILE, 1)
    const next = buildNextWeekPlan(BASE_PROFILE, from, undefined, 4)
    expect(next.week).toBe(4)
  })
})

/* ------------------------------------------------------------------ */
/* copyWeekPlanFromProfile —— 复制下周                                  */
/* ------------------------------------------------------------------ */
describe('copyWeekPlanFromProfile', () => {
  const source = buildWeekPlanFromProfile(BASE_PROFILE, 3)

  it('week +1', () => {
    expect(copyWeekPlanFromProfile(source).week).toBe(4)
  })

  it('固定文案，不沿用源 adjustmentNote', () => {
    expect(copyWeekPlanFromProfile(source).adjustmentNote).toBe('沿用上周计划，未做进阶调整。')
  })

  it('深拷贝 exercises', () => {
    const copy = copyWeekPlanFromProfile(source)
    copy.days[0].exercises[0].name = '改了'
    expect(source.days[0].exercises[0].name).not.toBe('改了')
  })
})

/* ------------------------------------------------------------------ */
/* describeProfile —— 画像自然语言描述                                 */
/* ------------------------------------------------------------------ */
describe('describeProfile', () => {
  it('完整画像：拼接所有维度', () => {
    const text = describeProfile(BASE_PROFILE)
    expect(text).toContain('男')
    expect(text).toContain('25 岁')
    expect(text).toContain('175cm')
    expect(text).toContain('70kg')
    expect(text).toContain('增肌')
    expect(text).toContain('4 天/周')
    expect(text).toContain('新手')
  })

  it('空画像：不抛错', () => {
    expect(describeProfile({ name: '', heightCm: 0 })).toBe('')
  })
})

/* ------------------------------------------------------------------ */
/* loadType 生成：器械池 → weighted，徒手池 → bodyweight，timed → timed，*/
/* 健身房池里的自重例外（引体/悬垂举腿）→ bodyweight                      */
/* ------------------------------------------------------------------ */
describe('生成动作的 loadType 标注', () => {
  const strengthExercises = (plan: WeekPlan) =>
    plan.days.filter((d) => d.type === 'strength').flatMap((d) => d.exercises)

  it('哑铃池动作 → weighted', () => {
    const plan = buildWeekPlanFromProfile(BASE_PROFILE, 1)
    const main = strengthExercises(plan).filter((e) => e.name.includes('哑铃'))
    expect(main.length).toBeGreaterThan(0)
    expect(main.every((e) => e.loadType === 'weighted')).toBe(true)
  })

  it('徒手池动作 → bodyweight，时间类 → timed', () => {
    const plan = buildWeekPlanFromProfile({ ...BASE_PROFILE, equipment: 'none' }, 1)
    const exs = strengthExercises(plan)
    const pushup = exs.find((e) => e.name.includes('俯卧撑'))
    expect(pushup?.loadType).toBe('bodyweight')
  })

  it('健身房池里的自重例外 → bodyweight', () => {
    const plan = buildWeekPlanFromProfile({ ...BASE_PROFILE, equipment: 'gym' }, 1)
    const exs = strengthExercises(plan)
    const pullup = exs.find((e) => e.name.includes('引体向上'))
    if (pullup) expect(pullup.loadType).toBe('bodyweight')
    // 器械动作仍 weighted
    const barbell = exs.find((e) => e.name.includes('杠铃'))
    expect(barbell?.loadType).toBe('weighted')
  })

  it('时间类动作（平板支撑）→ timed', () => {
    const plan = buildWeekPlanFromProfile({ ...BASE_PROFILE, trainDaysPerWeek: 6, sport: 'none', sportHours: 0 }, 1)
    const exs = strengthExercises(plan)
    const plank = exs.find((e) => e.name.includes('平板支撑'))
    if (plank) expect(plank.loadType).toBe('timed')
  })
})
