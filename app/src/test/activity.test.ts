import { describe, expect, it } from 'vitest'
import { bumpActivity, defaultCloudState } from '@/lib/store'

/* ------------------------------------------------------------------ */
/* bumpActivity —— 训练日历活跃度（打卡勾选驱动）                        */
/* ------------------------------------------------------------------ */
describe('bumpActivity', () => {
  it('新日期 +1 创建键并累加', () => {
    let map = bumpActivity({}, '2026-10-18', 1)
    expect(map).toEqual({ '2026-10-18': 1 })
    map = bumpActivity(map, '2026-10-18', 1)
    expect(map['2026-10-18']).toBe(2)
  })

  it('取消勾选 -1 递减', () => {
    const map = bumpActivity({ '2026-10-18': 3 }, '2026-10-18', -1)
    expect(map['2026-10-18']).toBe(2)
  })

  it('减到 0 删除键，不留无意义条目', () => {
    const map = bumpActivity({ '2026-10-18': 1 }, '2026-10-18', -1)
    expect(map).toEqual({})
  })

  it('clamp 到 0：已为 0（或缺失）再减不变', () => {
    const empty = bumpActivity({}, '2026-10-18', -1)
    expect(empty).toEqual({})
    const map = bumpActivity({ '2026-10-18': 0 }, '2026-10-18', -1)
    expect(map).toEqual({ '2026-10-18': 0 })
  })

  it('无变化时返回同一引用（不触发多余重渲染与云端同步）', () => {
    const original = { '2026-10-18': 2 }
    expect(bumpActivity(original, '2026-10-18', 0)).toBe(original)
    expect(bumpActivity(original, '2026-10-19', -1)).toBe(original)
    // -2 恰好减到 0 属于变化：删键并返回新对象
    expect(bumpActivity(original, '2026-10-18', -2)).toEqual({})
  })

  it('多日并存互不影响', () => {
    const map = bumpActivity({ '2026-10-17': 5 }, '2026-10-18', 1)
    expect(map).toEqual({ '2026-10-17': 5, '2026-10-18': 1 })
  })

  it('默认云状态包含空 activity（老缓存/老云端缺字段时兜底）', () => {
    expect(defaultCloudState().activity).toEqual({})
  })
})
