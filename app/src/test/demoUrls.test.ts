import { describe, expect, it } from 'vitest'
import { demoStorageBase, demoVideoUrl, MW_MEDIA_BASE } from '@/lib/demoUrls'

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
})