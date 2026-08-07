/**
 * 动作示范覆盖测试。
 *
 * 目的：确保规则引擎（planEngine）为任意新用户画像生成的计划里，每个"可教学"的动作
 * 都能在 demos.ts 的示范库里命中 getDemo，从而每个动作都能点开教学视频/动图。
 *
 * 做法：遍历器械 × 训练天数 × 伤病的代表性组合，用 buildWeekPlanFromProfile 生成完整计划，
 * 收集所有出现的动作名，对每个动作名调用 getDemo 断言命中。
 * 休息日的散步/睡眠/填写反馈等"非教学动作"通过 ALLOW_MISSING 白名单豁免。
 *
 * 当未来往 planEngine 的 POOL 里新增动作却忘了在 demos.ts 补示范时，本测试会失败提醒。
 */
import { describe, it, expect } from 'vitest'
import { buildWeekPlanFromProfile } from '@/lib/planEngine'
import { getDemo } from '@/lib/demos'
import type { Equipment, Profile, Sport } from '@/types'

/** 非教学动作白名单：休息日的恢复/睡眠/反馈类动作，不需要示范 */
const ALLOW_MISSING = [
  '散步',
  '充足睡眠',
  '填写本周反馈',
  '羽毛球训练',
  '跑步训练',
  '骑行训练',
  '可选',
]

/** 判断动作名是否属于白名单（非教学动作，不强制要求示范） */
function isAllowedMissing(name: string): boolean {
  return ALLOW_MISSING.some((k) => name.includes(k))
}

const BASE: Profile = {
  name: '测试用户',
  gender: 'male',
  age: 28,
  heightCm: 175,
  weightKg: 70,
  weightGoal: 'gain',
  experience: 'intermediate',
}

describe('动作示范覆盖：规则引擎产出的每个教学动作都能命中 getDemo', () => {
  // 遍历器械 × 训练天数 × 伤病 × 运动的代表性组合
  const equipments: Equipment[] = ['none', 'dumbbell', 'gym']
  const trainDaysList = [2, 3, 4, 5, 6]
  const sports: Sport[] = ['none', 'badminton', 'running', 'cycling']
  const injurySets: string[][] = [[], ['膝盖不适'], ['肩不适'], ['腰 / 下背不适']]

  // 收集所有组合下出现过的 (动作名) 及其命中情况
  const missMap = new Map<string, string[]>()

  for (const equipment of equipments) {
    for (const trainDays of trainDaysList) {
      for (const sport of sports) {
        const sportHours = sport === 'none' ? 0 : 2
        for (const injuries of injurySets) {
          const profile: Profile = {
            ...BASE,
            equipment,
            trainDaysPerWeek: trainDays,
            sport,
            sportHours,
            injuries,
          }
          const plan = buildWeekPlanFromProfile(profile, 1)
          for (const day of plan.days) {
            for (const ex of day.exercises) {
              if (isAllowedMissing(ex.name)) continue
              const demo = getDemo(ex.name)
              if (!demo) {
                const arr = missMap.get(ex.name) ?? []
                arr.push(`${equipment}/${trainDays}天/${sport || '无运动'}/${injuries.join('+') || '无伤'}`)
                missMap.set(ex.name, arr)
              }
            }
          }
        }
      }
    }
  }

  it('所有教学动作都有示范（missMap 应为空）', () => {
    const missList = [...missMap.entries()].map(
      ([name, combos]) => `  - "${name}"\n    出现于：${combos.slice(0, 3).join(' | ')}${combos.length > 3 ? ` 等 ${combos.length} 种组合` : ''}`,
    )
    expect(missMap.size, `以下 ${missMap.size} 个动作未命中示范库：\n${missList.join('\n')}\n请在 demos.ts 补充对应 key`).toBe(0)
  })
})
