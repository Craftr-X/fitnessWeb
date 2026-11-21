import { useEffect, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CirclePlay, Loader2, ImageOff } from 'lucide-react'
import { pickVideoPoster } from '@/lib/demos'
import type { DemoInfo, DemoSource } from '@/lib/demos'

interface Props {
  exerciseName: string
  demo: DemoInfo
}

/** 单源加载超时：卡住/慢 404 时尽快切下一候选，避免干等浏览器 onError */
export const DEMO_SOURCE_TIMEOUT_MS = 2000

/** 侧面媒体延迟启动：先抢正面带宽，弱网下首屏更快出画面 */
export const DEMO_SIDE_DEFER_MS = 600

/** 双帧循环播放的图片（free-exercise-db 逐帧图，模拟动图效果）。两帧同时加载、按显隐切换，避免切帧时闪烁 */
function AnimatedImg({ url, url2, alt, onLoad, onError }: { url: string; url2: string; alt: string; onLoad: () => void; onError: () => void }) {
  const [frame, setFrame] = useState(0)
  const [frame2Failed, setFrame2Failed] = useState(false)

  useEffect(() => {
    if (frame2Failed) return
    const timer = setInterval(() => setFrame((f) => 1 - f), 900)
    return () => clearInterval(timer)
  }, [frame2Failed])

  return (
    <>
      <img
        src={url}
        alt={alt}
        className={frame === 0 || frame2Failed ? 'h-full w-full object-contain' : 'hidden'}
        onLoad={onLoad}
        onError={onError}
      />
      {/* 第二帧失败时退化为静态展示第一帧，不触发整体降级 */}
      <img
        src={url2}
        alt=""
        aria-hidden
        className={frame === 1 && !frame2Failed ? 'h-full w-full object-contain' : 'hidden'}
        onError={() => setFrame2Failed(true)}
      />
    </>
  )
}

/** 单视角媒体：按顺序尝试 sources，全部失败显示兜底 */
function DemoMedia({
  sources,
  label,
  exerciseName,
  active,
  onReady,
}: {
  sources: DemoSource[]
  label: string
  exerciseName: string
  /** false 时不发起请求（用于侧面分时加载） */
  active: boolean
  onReady?: () => void
}) {
  const [idx, setIdx] = useState(0)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)

  const onError = () => {
    if (idx < sources.length - 1) {
      setIdx((i) => i + 1)
      setLoading(true)
    } else {
      setFailed(true)
      setLoading(false)
      onReady?.()
    }
  }

  const markReady = () => {
    setLoading(false)
    onReady?.()
  }

  // 超时强制降级：弱网/404 挂起时不必等浏览器 error；加载成功后 loading=false 清掉计时
  useEffect(() => {
    if (!active || failed || !loading) return
    const timer = setTimeout(() => onError(), DEMO_SOURCE_TIMEOUT_MS)
    return () => clearTimeout(timer)
    // 仅在当前源尝试期间计时；成功/失败都会改 loading/failed 从而清掉
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: tick per source attempt
  }, [active, idx, failed, loading, sources.length])

  if (!active) {
    return (
      <div className="relative flex aspect-video items-center justify-center overflow-hidden rounded-xl bg-muted">
        <div className="absolute inset-0 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
        <span className="absolute bottom-1.5 left-1.5 rounded-md bg-black/55 px-1.5 py-0.5 text-xs font-medium text-white">
          {label}
        </span>
      </div>
    )
  }

  const source = sources[idx]
  const poster = source.type === 'video' ? pickVideoPoster(sources) : undefined
  // 有 poster 时首帧已可见，不再盖一层转圈抢视觉
  const showSpinner = loading && !failed && !poster

  return (
    <div className="relative flex aspect-video items-center justify-center overflow-hidden rounded-xl bg-muted">
      {/* 视频没有可用首帧时用图标占位，弱网下不再是纯黑块加转圈 */}
      {source.type === 'video' && !poster && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center" aria-hidden>
          <CirclePlay className="h-10 w-10 text-muted-foreground" />
        </div>
      )}
      {showSpinner && (
        <div className="absolute inset-0 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}
      {failed ? (
        <div className="flex flex-col items-center gap-1 p-4 text-center text-xs text-muted-foreground">
          <ImageOff className="h-6 w-6" />
          加载失败
        </div>
      ) : source.type === 'video' ? (
        <video
          key={source.url}
          src={source.url}
          poster={poster}
          className="h-full w-full object-contain"
          autoPlay
          loop
          muted
          playsInline
          controls
          preload="metadata"
          onLoadedData={markReady}
          onError={onError}
        />
      ) : source.url2 ? (
        <AnimatedImg
          key={source.url}
          url={source.url}
          url2={source.url2}
          alt={`${exerciseName} ${label}示范`}
          onLoad={markReady}
          onError={onError}
        />
      ) : (
        <img
          key={source.url}
          src={source.url}
          alt={`${exerciseName} ${label}示范`}
          className="h-full w-full object-contain"
          onLoad={markReady}
          onError={onError}
        />
      )}
      <span className="absolute bottom-1.5 left-1.5 rounded-md bg-black/55 px-1.5 py-0.5 text-xs font-medium text-white">
        {label}
      </span>
    </div>
  )
}

export default function ExerciseDemoButton({ exerciseName, demo }: Props) {
  const [open, setOpen] = useState(false)
  const [sideActive, setSideActive] = useState(false)
  const [frontLabel, sideLabel] = demo.mediaLabels ?? ['正面', '侧面']

  // 打开后延迟启动侧面，把首段带宽留给正面；关闭时在 onOpenChange 复位
  useEffect(() => {
    if (!open) return
    const timer = setTimeout(() => setSideActive(true), DEMO_SIDE_DEFER_MS)
    return () => clearTimeout(timer)
  }, [open])

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) setSideActive(false)
      }}
    >
      <DialogTrigger asChild>
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7 shrink-0 text-orange-500 hover:bg-orange-100 hover:text-orange-600 dark:hover:bg-orange-500/15 dark:hover:text-orange-400"
          title="查看标准动作示范"
          onClick={(e) => e.stopPropagation()}
        >
          <CirclePlay className="h-4.5 w-4.5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <DialogTitle>{exerciseName}</DialogTitle>
            <Badge className="border-emerald-200 bg-emerald-500/15 text-emerald-700 dark:border-emerald-500/30 dark:text-emerald-300">
              {demo.level}
            </Badge>
          </div>
          <DialogDescription>
            {demo.mediaLabels
              ? `${frontLabel} + ${sideLabel} 两段示范，跟着节奏做，动作质量比数量更重要`
              : '正面 + 侧面双视角示范，跟着节奏做，动作质量比数量更重要'}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <DemoMedia
            sources={demo.front}
            label={frontLabel}
            exerciseName={exerciseName}
            active={open}
            onReady={() => setSideActive(true)}
          />
          <DemoMedia
            sources={demo.side}
            label={sideLabel}
            exerciseName={exerciseName}
            active={open && sideActive}
          />
        </div>

        <ol className="space-y-2.5">
          {demo.steps.map((step, i) => (
            <li key={i} className="flex items-start gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-orange-500 text-xs font-semibold text-white">
                {i + 1}
              </span>
              <span className="pt-0.5 text-sm text-muted-foreground">{step}</span>
            </li>
          ))}
        </ol>
      </DialogContent>
    </Dialog>
  )
}
