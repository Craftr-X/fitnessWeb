import { describe, it, expect } from 'vitest'
import { cn } from '@/lib/utils'

describe('cn (classname 合并工具)', () => {
  it('合并多个 class 字符串', () => {
    expect(cn('foo', 'bar')).toBe('foo bar')
  })

  it('过滤掉 false / undefined / null 等无效值', () => {
    expect(cn('foo', false, undefined, null, 'bar')).toBe('foo bar')
  })

  it('tailwind 冲突类由后值覆盖前值', () => {
    // twMerge 会把冲突的 tailwind 类合并，后者胜出
    expect(cn('px-2', 'px-4')).toBe('px-4')
  })

  it('非冲突的 tailwind 类全部保留', () => {
    expect(cn('px-2', 'py-4')).toBe('px-2 py-4')
  })
})
