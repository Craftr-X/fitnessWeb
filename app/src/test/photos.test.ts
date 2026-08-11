import { describe, it, expect } from 'vitest'
import { addPhoto, removePhoto, photoPath } from '@/lib/photos'
import type { PhotoEntry } from '@/types'

const entry = (id: string, date: string, createdAt = date + 'T00:00:00.000Z'): PhotoEntry => ({
  id,
  date,
  view: 'front',
  createdAt,
})

describe('photoPath', () => {
  it('拼成 `${userId}/${id}.jpg`', () => {
    expect(photoPath('u1', 'p1')).toBe('u1/p1.jpg')
  })
})

describe('addPhoto', () => {
  it('空数组新增一条', () => {
    expect(addPhoto([], entry('a', '2026-01-01'))).toEqual([entry('a', '2026-01-01')])
  })

  it('按拍摄日期降序排列（最新在前）', () => {
    const prev = [entry('a', '2026-01-01')]
    const next = addPhoto(prev, entry('b', '2026-03-01'))
    expect(next.map((p) => p.id)).toEqual(['b', 'a'])
  })

  it('同日按入库时间降序', () => {
    const prev = [entry('a', '2026-01-01', '2026-01-01T10:00:00.000Z')]
    const next = addPhoto(prev, entry('b', '2026-01-01', '2026-01-01T08:00:00.000Z'))
    expect(next.map((p) => p.id)).toEqual(['a', 'b'])
  })

  it('同 id 覆盖而非重复', () => {
    const prev = [entry('a', '2026-01-01')]
    const next = addPhoto(prev, entry('a', '2026-02-01'))
    expect(next).toHaveLength(1)
    expect(next[0].date).toBe('2026-02-01')
  })
})

describe('removePhoto', () => {
  it('按 id 删除', () => {
    const prev = [entry('a', '2026-01-01'), entry('b', '2026-02-01')]
    expect(removePhoto(prev, 'a').map((p) => p.id)).toEqual(['b'])
  })

  it('无匹配时原样返回同一引用', () => {
    const prev = [entry('a', '2026-01-01')]
    expect(removePhoto(prev, 'nope')).toBe(prev)
  })
})
