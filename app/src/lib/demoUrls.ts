export const MW_MEDIA_BASE = 'https://media.musclewiki.com/media/uploads/videos/branded'
export const DEMO_BUCKET = 'exercise-demos'

export function demoStorageBase(supabaseUrl: string | undefined): string | undefined {
  if (!supabaseUrl) return undefined
  const root = supabaseUrl.replace(/\/$/, '')
  return `${root}/storage/v1/object/public/${DEMO_BUCKET}/videos`
}

export function demoVideoUrl(key: string, supabaseUrl: string | undefined): string {
  const base = demoStorageBase(supabaseUrl)
  if (base) return `${base}/${key}.mp4`
  return `${MW_MEDIA_BASE}/${key}.mp4`
}