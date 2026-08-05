import { describe, it, expect } from 'vitest'
import {
  buildWeekPlanFromProfile,
  computeProgression,
  splitMuscleGroups,
  tuneByGoal,
  filterByInjury,
  assembleWeek,
  copyWeekPlanFromProfile,
  describeProfile,
  currentMonday,
} from '@/lib/planEngine'
import type { Profile } from '@/types'

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
    const hard = buildWeekPlanFromProfile(BASE_PROFILE, 7, 4)
    expect(hard.adjustmentNote).toContain('偏难')
    const easy = buildWeekPlanFromProfile(BASE_PROFILE, 7, 2)
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
