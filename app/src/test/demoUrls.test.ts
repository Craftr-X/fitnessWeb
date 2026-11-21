import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { collectDemoVideoKeys } from '@/lib/demos'
import { demoStorageBase, demoVideoUrl, MW_MEDIA_BASE } from '@/lib/demoUrls'

/** 与 `app/scripts/mirror-demos.mjs` 相同的源码正则抽 key */
function extractMwKeysFromDemosSource(src: string): Set<string> {
  const keys = new Set<string>()
  for (const m of src.matchAll(/mw\(([^)]*)\)/g)) {
    for (const k of m[1].matchAll(/'([^']+)'/g)) keys.add(k[1])
  }
  return keys
}

describe('demoVideoUrl', () => {
  it('有 supabaseUrl 时指向 public storage videos 路径', () => {
    const url = demoVideoUrl('male-Bodyweight-push-up-front', 'https://abc.supabase.co')
    expect(url).toBe(
      'https://abc.supabase.co/storage/v1/object/public/exercise-demos/videos/male-Bodyweight-push-up-front.mp4',
    )
  })

  it('无 supabaseUrl 时回退 MuscleWiki', () => {
    expect(demoVideoUrl('male-Bodyweight-push-up-front', undefined)).toBe(
      `${MW_MEDIA_BASE}/male-Bodyweight-push-up-front.mp4`,
    )
  })

  it('demoStorageBase 去掉尾斜杠再拼', () => {
    expect(demoStorageBase('https://abc.supabase.co/')).toBe(
      'https://abc.supabase.co/storage/v1/object/public/exercise-demos/videos',
    )
  })

  it('mirror-demos 正则抽 key 与 collectDemoVideoKeys 一致', () => {
    const demosPath = resolve(import.meta.dirname, '../lib/demos.ts')
    const src = readFileSync(demosPath, 'utf8')
    const regexKeys = extractMwKeysFromDemosSource(src)
    const collected = new Set(collectDemoVideoKeys())
    expect([...regexKeys].sort()).toEqual([...collected].sort())
  })
})
