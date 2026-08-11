import { useEffect, useMemo, useRef, useState } from 'react'
import { format } from 'date-fns'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { Trash2, Upload, Camera, Columns2, Layers, X } from 'lucide-react'
import {
  addPhoto,
  deletePhoto,
  getPhotoObjectUrl,
  photosEnabled,
  removePhoto,
  resizeImage,
  uploadPhoto,
} from '@/lib/photos'
import type { PhotoEntry, PhotoView } from '@/types'

const VIEW_OPTIONS: { value: PhotoView; label: string }[] = [
  { value: 'front', label: '正面' },
  { value: 'side', label: '侧面' },
  { value: 'back', label: '背面' },
]
const VIEW_LABEL: Record<PhotoView, string> = { front: '正面', side: '侧面', back: '背面' }

interface Props {
  photos: PhotoEntry[]
  setPhotos: (v: PhotoEntry[] | ((p: PhotoEntry[]) => PhotoEntry[])) => void
  userId: string
}

/** 单张照片：按需下载 blob → object URL，加载中/失败有占位 */
function PhotoImg({
  userId,
  id,
  className,
  imgClassName,
}: {
  userId: string
  id: string
  className?: string
  imgClassName?: string
}) {
  const [url, setUrl] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)
  const [prevId, setPrevId] = useState(id)
  // 组件被复用、id 变化时（如对比区固定位置换图），渲染期间重置为加载态，
  // 再由下面的 effect 拉取新图。属 React 官方推荐的「根据先前渲染信息调整状态」模式。
  if (prevId !== id) {
    setPrevId(id)
    setUrl(null)
    setFailed(false)
  }
  useEffect(() => {
    let cancelled = false
    void getPhotoObjectUrl(userId, id).then((u) => {
      if (cancelled) return
      if (u) setUrl(u)
      else setFailed(true)
    })
    return () => {
      cancelled = true
    }
  }, [userId, id])
  if (failed) {
    return (
      <div className={`flex items-center justify-center bg-muted/60 text-xs text-muted-foreground ${className ?? ''}`}>
        加载失败
      </div>
    )
  }
  if (!url) {
    return <div className={`animate-pulse bg-muted/60 ${className ?? ''}`} />
  }
  return <img src={url} alt="身材照片" className={`${imgClassName ?? ''} ${className ?? ''}`} />
}

export default function PhotoCompare({ photos, setPhotos, userId }: Props) {
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [view, setView] = useState<PhotoView>('front')
  const [note, setNote] = useState('')
  const [uploading, setUploading] = useState(false)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [mode, setMode] = useState<'side' | 'overlay'>('side')
  const [opacity, setOpacity] = useState(50)
  const fileRef = useRef<HTMLInputElement>(null)

  const enabled = photosEnabled()

  // 画廊按拍摄日期倒序分组
  const groups = useMemo(() => {
    const m = new Map<string, PhotoEntry[]>()
    for (const p of photos) {
      const arr = m.get(p.date) ?? []
      arr.push(p)
      m.set(p.date, arr)
    }
    return [...m.entries()].sort((a, b) => b[0].localeCompare(a[0]))
  }, [photos])

  const selected = selectedIds
    .map((id) => photos.find((p) => p.id === id))
    .filter((p): p is PhotoEntry => p != null)

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id)
      if (prev.length >= 2) return [prev[1], id] // 满两时淘汰最早选中的
      return [...prev, id]
    })
  }

  // 一键对比最早 / 最新（优先正面，不足则取全部）
  const compareEnds = () => {
    const pool = photos.filter((p) => p.view === 'front')
    const base = pool.length >= 2 ? pool : photos
    if (base.length >= 2) {
      setSelectedIds([base[base.length - 1].id, base[0].id])
      setMode('side')
    }
  }

  const handleFile = async (file: File | undefined) => {
    if (!file) return
    if (!enabled) {
      toast.error('未配置 Supabase，无法上传')
      return
    }
    setUploading(true)
    try {
      const blob = await resizeImage(file)
      const id = crypto.randomUUID()
      const ok = await uploadPhoto(userId, id, blob)
      if (!ok) {
        toast.error('上传失败，请重试')
        return
      }
      setPhotos((prev) =>
        addPhoto(prev, {
          id,
          date,
          view,
          note: note.trim() || undefined,
          createdAt: new Date().toISOString(),
        }),
      )
      setNote('')
      toast.success('已上传')
    } catch {
      toast.error('图片处理失败，请换一张试试')
    } finally {
      setUploading(false)
    }
  }

  const handleDelete = (entry: PhotoEntry) => {
    setPhotos((prev) => removePhoto(prev, entry.id))
    setSelectedIds((prev) => prev.filter((x) => x !== entry.id))
    void deletePhoto(userId, entry.id)
    toast.success('已删除')
  }

  // 未配置后端：降级提示
  if (!enabled) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          身材照片需要配置 Supabase Storage。请先按 DEPLOY 文档设置
          <code className="mx-1 rounded bg-muted px-1">VITE_SUPABASE_URL</code>/
          <code className="ml-1 rounded bg-muted px-1">ANON_KEY</code>，
          并在 Dashboard 执行 schema.sql 中的 body_photos 建表语句。
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* 上传 */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Camera className="h-4 w-4 text-orange-500" /> 上传身材照
            <span className="text-xs font-normal text-muted-foreground">
              建议固定时间、相同光线与距离拍摄，便于长期对比
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label htmlFor="pc-date">拍摄日期</Label>
              <Input
                id="pc-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-40"
              />
            </div>
            <div className="space-y-1">
              <Label>拍摄角度</Label>
              <div className="flex gap-2">
                {VIEW_OPTIONS.map((o) => (
                  <Button
                    key={o.value}
                    size="sm"
                    variant={view === o.value ? 'default' : 'outline'}
                    onClick={() => setView(o.value)}
                  >
                    {o.label}
                  </Button>
                ))}
              </div>
            </div>
            <div className="flex-1 space-y-1" style={{ minWidth: 140 }}>
              <Label htmlFor="pc-note">备注（可选）</Label>
              <Input
                id="pc-note"
                placeholder="如：增肌期第 4 周"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="w-full"
              />
            </div>
            <Button
              disabled={uploading}
              onClick={() => fileRef.current?.click()}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              <Upload className="mr-1 h-4 w-4" /> {uploading ? '上传中…' : '选择照片'}
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                void handleFile(e.target.files?.[0])
                e.target.value = '' // 允许连续选同一张
              }}
            />
          </div>
        </CardContent>
      </Card>

      {/* 画廊 */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex flex-wrap items-center gap-2 text-base">
            时间轴
            <span className="text-xs font-normal text-muted-foreground">
              共 {photos.length} 张 · 点击选 2 张对比
            </span>
            {photos.length >= 2 && (
              <Button size="sm" variant="outline" className="ml-auto" onClick={compareEnds}>
                <Columns2 className="mr-1 h-4 w-4" /> 对比最早/最新
              </Button>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {photos.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              还没有照片。上传第一张身材照，开始记录你的蜕变。
            </p>
          ) : (
            <div className="space-y-4">
              {groups.map(([d, list]) => (
                <div key={d}>
                  <p className="mb-2 text-xs font-medium text-muted-foreground">
                    {format(new Date(d + 'T00:00:00'), 'yyyy年M月d日')}
                  </p>
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
                    {list.map((p) => {
                      const selectedIdx = selectedIds.indexOf(p.id)
                      return (
                        <div key={p.id} className="relative">
                          <button
                            type="button"
                            onClick={() => toggleSelect(p.id)}
                            className={`relative block aspect-[3/4] w-full overflow-hidden rounded-lg border-2 bg-muted/40 transition ${
                              selectedIdx >= 0
                                ? 'border-primary ring-2 ring-primary/30'
                                : 'border-transparent hover:border-muted-foreground/30'
                            }`}
                          >
                            <PhotoImg
                              userId={userId}
                              id={p.id}
                              className="absolute inset-0 h-full w-full"
                              imgClassName="object-cover"
                            />
                            <span className="absolute left-1 top-1 rounded bg-black/55 px-1.5 py-0.5 text-[10px] text-white">
                              {VIEW_LABEL[p.view]}
                              {selectedIdx >= 0 ? ` · ${selectedIdx + 1}` : ''}
                            </span>
                            {p.note && (
                              <span className="absolute inset-x-1 bottom-1 truncate rounded bg-black/55 px-1 text-[10px] text-white">
                                {p.note}
                              </span>
                            )}
                          </button>
                          <Button
                            size="icon"
                            variant="secondary"
                            className="absolute right-1 top-1 h-6 w-6 rounded-full opacity-80"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDelete(p)
                            }}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 对比区 */}
      {selected.length === 2 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex flex-wrap items-center gap-2 text-base">
              对比
              <span className="ml-auto flex gap-2">
                <Button size="sm" variant={mode === 'side' ? 'default' : 'outline'} onClick={() => setMode('side')}>
                  <Columns2 className="mr-1 h-4 w-4" /> 并排
                </Button>
                <Button
                  size="sm"
                  variant={mode === 'overlay' ? 'default' : 'outline'}
                  onClick={() => setMode('overlay')}
                >
                  <Layers className="mr-1 h-4 w-4" /> 叠加
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setSelectedIds([])}>
                  <X className="mr-1 h-4 w-4" /> 清除
                </Button>
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {mode === 'side' ? (
              <div className="grid grid-cols-2 gap-3">
                {selected.map((p) => (
                  <div key={p.id} className="space-y-1">
                    <div className="aspect-[3/4] w-full overflow-hidden rounded-lg bg-muted/40">
                      <PhotoImg
                        userId={userId}
                        id={p.id}
                        className="h-full w-full"
                        imgClassName="object-contain"
                      />
                    </div>
                    <p className="text-center text-xs text-muted-foreground">
                      {format(new Date(p.date + 'T00:00:00'), 'yyyy/M/d')} · {VIEW_LABEL[p.view]}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                <div className="relative mx-auto aspect-[3/4] w-full max-w-sm overflow-hidden rounded-lg bg-muted/40">
                  <PhotoImg
                    userId={userId}
                    id={selected[0].id}
                    className="absolute inset-0 h-full w-full"
                    imgClassName="object-contain"
                  />
                  <div className="absolute inset-0" style={{ opacity: opacity / 100 }}>
                    <PhotoImg
                      userId={userId}
                      id={selected[1].id}
                      className="h-full w-full"
                      imgClassName="object-contain"
                    />
                  </div>
                </div>
                <div className="mx-auto flex max-w-sm items-center gap-3">
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {format(new Date(selected[0].date + 'T00:00:00'), 'yy/M/d')}
                  </span>
                  <Slider value={[opacity]} onValueChange={(v) => setOpacity(v[0])} max={100} step={1} />
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {format(new Date(selected[1].date + 'T00:00:00'), 'yy/M/d')}
                  </span>
                </div>
                <p className="text-center text-xs text-muted-foreground">
                  滑动调整上层透明度，对齐姿势查看线条变化
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
