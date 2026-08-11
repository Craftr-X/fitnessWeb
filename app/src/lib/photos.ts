import { supabase } from '@/lib/supabase'
import type { PhotoEntry } from '@/types'

/**
 * 身材照片：二进制存 Supabase Storage 私有 bucket（body_photos），
 * 元数据（PhotoEntry[]）随 user_data jsonb 同步。本模块封装 Storage I/O 与图片处理。
 */

/** 存储桶名（与 supabase/schema.sql 中一致） */
export const PHOTO_BUCKET = 'body_photos'

/** 拼装 Storage 对象 key：`${userId}/${id}.jpg` */
export function photoPath(userId: string, id: string): string {
  return `${userId}/${id}.jpg`
}

/** supabase 是否可用（未配置环境变量时为 false，UI 应降级提示） */
export const photosEnabled = (): boolean => supabase != null

/**
 * 客户端压缩：缩放到最长边 maxDim，导出 JPEG。用 createImageBitmap 的
 * imageOrientation 顺带处理手机照片的 EXIF 方向（避免躺拍旋转）。
 */
export async function resizeImage(file: File, maxDim = 1080, quality = 0.8): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height))
  const w = Math.max(1, Math.round(bitmap.width * scale))
  const h = Math.max(1, Math.round(bitmap.height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas 2d context 不可用')
  ctx.drawImage(bitmap, 0, 0, w, h)
  bitmap.close?.()
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality))
  if (!blob) throw new Error('图片压缩失败')
  return blob
}

/** 上传照片二进制；upsert 以便同 id 重传安全。成功返回 true。 */
export async function uploadPhoto(userId: string, id: string, blob: Blob): Promise<boolean> {
  if (!supabase) return false
  const { error } = await supabase.storage
    .from(PHOTO_BUCKET)
    .upload(photoPath(userId, id), blob, { contentType: 'image/jpeg', upsert: true })
  if (error) {
    console.error('[FitUp] 上传照片失败：', error.message)
    return false
  }
  return true
}

/** 删除照片二进制（best-effort：孤儿对象受 RLS 隔离无害，失败仅记日志） */
export async function deletePhoto(userId: string, id: string): Promise<void> {
  if (!supabase) return
  const { error } = await supabase.storage.from(PHOTO_BUCKET).remove([photoPath(userId, id)])
  if (error) console.error('[FitUp] 删除照片失败：', error.message)
}

// 模块级 object URL 缓存：避免切视图/反复渲染时重复下载同一张图
const urlCache = new Map<string, string>()

/**
 * 下载照片并返回 object URL（供 <img src>）。同一 key 命中缓存直接返回。
 * 失败返回 null（UI 显示占位）。会话内不主动 revoke，刷新页面由浏览器回收。
 */
export async function getPhotoObjectUrl(userId: string, id: string): Promise<string | null> {
  if (!supabase) return null
  const path = photoPath(userId, id)
  const cached = urlCache.get(path)
  if (cached) return cached
  const { data, error } = await supabase.storage.from(PHOTO_BUCKET).download(path)
  if (error || !data) {
    console.error('[FitUp] 下载照片失败：', error?.message)
    return null
  }
  const url = URL.createObjectURL(data)
  urlCache.set(path, url)
  return url
}

/* ------------------------------------------------------------------ */
/* 纯元数据助手（无副作用，便于单测）                                  */
/* ------------------------------------------------------------------ */

/** 新增/覆盖一条照片元数据；按拍摄日期降序、同日按入库时间降序排列 */
export function addPhoto(prev: PhotoEntry[], entry: PhotoEntry): PhotoEntry[] {
  const rest = prev.filter((p) => p.id !== entry.id)
  return [...rest, entry].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))
}

/** 按 id 删除一条；无匹配时原样返回（引用不变，避免多余重渲染） */
export function removePhoto(prev: PhotoEntry[], id: string): PhotoEntry[] {
  const next = prev.filter((p) => p.id !== id)
  return next.length === prev.length ? prev : next
}
