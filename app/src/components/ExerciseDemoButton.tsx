import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { CirclePlay, Loader2, ImageOff, ExternalLink } from 'lucide-react'
import { demoUrl, type DemoInfo } from '@/lib/demos'

interface Props {
  exerciseName: string
  demo: DemoInfo
}

export default function ExerciseDemoButton({ exerciseName, demo }: Props) {
  const [idx, setIdx] = useState(0)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)

  const onError = () => {
    if (idx < demo.ids.length - 1) {
      setIdx((i) => i + 1)
      setLoading(true)
    } else {
      setFailed(true)
      setLoading(false)
    }
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7 shrink-0 text-orange-500 hover:bg-orange-100 hover:text-orange-600"
          title="查看标准动作示范"
          onClick={(e) => e.stopPropagation()}
        >
          <CirclePlay className="h-4.5 w-4.5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{exerciseName} · 标准动作示范</DialogTitle>
          <DialogDescription>跟着动图节奏做，动作质量比数量更重要</DialogDescription>
        </DialogHeader>

        <div className="relative flex min-h-64 items-center justify-center overflow-hidden rounded-xl bg-muted">
          {loading && !failed && (
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}
          {failed ? (
            <div className="flex flex-col items-center gap-2 p-6 text-center text-sm text-muted-foreground">
              <ImageOff className="h-8 w-8" />
              动图加载失败（需要网络）
              <a
                href="https://musclewiki.com/zh-cn"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-orange-600 underline"
              >
                去 MuscleWiki 查看动作库 <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          ) : (
            <img
              key={demo.ids[idx]}
              src={demoUrl(demo.ids[idx])}
              alt={`${exerciseName} 动作示范`}
              className="max-h-80 w-full object-contain"
              onLoad={() => setLoading(false)}
              onError={onError}
            />
          )}
        </div>

        <div className="space-y-1.5">
          <p className="text-sm font-medium">动作要点</p>
          <ul className="space-y-1 text-sm text-muted-foreground">
            {demo.cues.map((c, i) => (
              <li key={i} className="flex gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-orange-400" />
                {c}
              </li>
            ))}
          </ul>
        </div>
        <p className="text-xs text-muted-foreground">
          动图来源：free-exercise-db（开源健身动作库） · 更多动作可参考 MuscleWiki
        </p>
      </DialogContent>
    </Dialog>
  )
}
