import { Badge } from '@/components/ui/badge'
import { isPrPoint, type MaxWeightPoint } from '@/lib/setLogTrend'

const W = 120
const H = 36
const PAD = 4

function sparkCoords(points: MaxWeightPoint[]): { x: number; y: number }[] {
  const weights = points.map((p) => p.maxWeight)
  const minW = Math.min(...weights)
  const maxW = Math.max(...weights)
  const range = maxW - minW || 1
  return points.map((p, i) => {
    const x = points.length === 1 ? W / 2 : PAD + (i / (points.length - 1)) * (W - 2 * PAD)
    const y = H - PAD - ((p.maxWeight - minW) / range) * (H - 2 * PAD)
    return { x, y }
  })
}

/** 记组弹窗内最近场次最大重量迷你折线（纯 SVG，不含今日） */
export default function SetLogMiniTrend({
  points,
  allTimeMax,
}: {
  points: MaxWeightPoint[]
  allTimeMax: number
}) {
  if (points.length === 0) return null

  const last = points[points.length - 1]
  const pr = isPrPoint(last.maxWeight, allTimeMax)

  if (points.length === 1) {
    const { x, y } = sparkCoords(points)[0]
    return (
      <div
        className="flex items-center gap-3 rounded-lg border bg-card/80 px-3 py-2"
        data-testid="setlog-mini-trend"
      >
        <svg width={W} height={H} aria-hidden className="shrink-0 text-emerald-600 dark:text-emerald-400">
          <circle cx={x} cy={y} r={4} fill="currentColor" />
        </svg>
        <p className="min-w-0 flex-1 text-xs text-muted-foreground">仅 1 次记录</p>
        <p className="shrink-0 text-sm font-semibold tabular-nums">
          {last.maxWeight}
          <span className="ml-0.5 text-xs font-normal text-muted-foreground">kg</span>
        </p>
        {pr && <PrBadge />}
      </div>
    )
  }

  const coords = sparkCoords(points)
  const line = coords.map((c) => `${c.x},${c.y}`).join(' ')

  return (
    <div
      className="flex items-center gap-3 rounded-lg border bg-card/80 px-3 py-2"
      data-testid="setlog-mini-trend"
    >
      <svg width={W} height={H} aria-hidden className="shrink-0 text-emerald-600 dark:text-emerald-400">
        <polyline
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          points={line}
          opacity={0.85}
        />
        {coords.map((c, i) => (
          <circle
            key={i}
            cx={c.x}
            cy={c.y}
            r={i === coords.length - 1 ? 3.5 : 2.5}
            fill="currentColor"
            opacity={i === coords.length - 1 ? 1 : 0.55}
          />
        ))}
      </svg>
      <p className="min-w-0 flex-1 text-xs text-muted-foreground">最近 {points.length} 次</p>
      <p className="shrink-0 text-sm font-semibold tabular-nums">
        {last.maxWeight}
        <span className="ml-0.5 text-xs font-normal text-muted-foreground">kg</span>
      </p>
      {pr && <PrBadge />}
    </div>
  )
}

function PrBadge() {
  return (
    <Badge
      data-testid="setlog-pr-badge"
      variant="secondary"
      className="shrink-0 border-amber-500/30 bg-amber-500/15 text-[10px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300"
    >
      PR
    </Badge>
  )
}
