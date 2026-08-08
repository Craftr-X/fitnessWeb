import { beforeEach, describe, expect, it } from 'vitest'
import { readLegacyData } from '@/lib/sync'
import { LS_KEYS } from '@/lib/store'

/* ------------------------------------------------------------------ */
/* readLegacyData —— 旧版本地数据读取（账号体系上线前的无前缀 key）      */
/* ------------------------------------------------------------------ */
describe('readLegacyData', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('全部 key 缺失时返回 null', () => {
    expect(readLegacyData()).toBeNull()
  })

  it('只返回实际存在的 key，缺失字段不得带 undefined（防止展开合并覆盖默认值）', () => {
    // 老用户场景：有打卡和体重数据，但从来没有过 profile
    localStorage.setItem(LS_KEYS.checks, JSON.stringify({ '1:0:0': true }))
    localStorage.setItem(LS_KEYS.weights, JSON.stringify([{ date: '2026-08-01', weight: 60, bodyFat: null }]))

    const data = readLegacyData()
    expect(data).not.toBeNull()
    expect(data?.checks).toEqual({ '1:0:0': true })
    expect(data?.weights).toHaveLength(1)
    // 关键断言：缺失字段连 key 都不存在，{ ...defaults, ...data } 才不会把 profile 覆盖成 undefined
    expect('profile' in data!).toBe(false)
    expect('weekPlan' in data!).toBe(false)
    expect('feedbacks' in data!).toBe(false)
  })

  it('全部 key 存在时完整返回', () => {
    localStorage.setItem(LS_KEYS.profile, JSON.stringify({ name: '我', heightCm: 170 }))
    localStorage.setItem(LS_KEYS.weekPlan, JSON.stringify({ week: 3, startDate: '2026-08-03', days: [] }))
    localStorage.setItem(LS_KEYS.checks, JSON.stringify({}))
    localStorage.setItem(LS_KEYS.weights, JSON.stringify([]))
    localStorage.setItem(LS_KEYS.feedback, JSON.stringify([]))

    const data = readLegacyData()
    expect(data?.profile?.heightCm).toBe(170)
    expect(data?.weekPlan?.week).toBe(3)
  })

  it('单个 key 的 JSON 损坏时跳过该 key，不影响其他字段', () => {
    localStorage.setItem(LS_KEYS.checks, '{broken json')
    localStorage.setItem(LS_KEYS.weights, JSON.stringify([{ date: '2026-08-01', weight: 60, bodyFat: null }]))

    const data = readLegacyData()
    expect('checks' in data!).toBe(false)
    expect(data?.weights).toHaveLength(1)
  })

  it('所有 key 的 JSON 都损坏时返回 null', () => {
    localStorage.setItem(LS_KEYS.checks, '{broken')
    expect(readLegacyData()).toBeNull()
  })
})
