import { Dumbbell } from 'lucide-react'
import { Spinner } from '@/components/ui/spinner'

/**
 * 全屏加载页：登录态恢复 / 云端数据同步期间展示。
 * 用品牌化画面代替裸 spinner，避免「白屏一闪」的断裂感。
 */
export default function AppSplash({ tip = '正在同步你的数据…' }: { tip?: string }) {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center gap-5 overflow-hidden bg-gradient-to-b from-primary/5 via-background to-background">
      {/* 背景装饰：与主页/登录页呼应的极光光斑 */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <div
          className="auth-aurora -top-24 left-[8%] h-72 w-72 bg-teal-400/10 dark:bg-teal-500/20"
          style={{ animation: 'aurora-1 20s ease-in-out infinite' }}
        />
        <div
          className="auth-aurora right-[4%] top-48 h-64 w-64 bg-emerald-400/8 dark:bg-emerald-500/15"
          style={{ animation: 'aurora-2 24s ease-in-out infinite' }}
        />
      </div>

      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-500 to-emerald-500 text-white shadow-lg shadow-teal-500/30">
        <Dumbbell className="h-8 w-8 animate-pulse" />
      </div>
      <div className="text-center">
        <p className="text-xl font-bold">FitUp 健身计划</p>
        <p className="mt-1 flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Spinner className="h-4 w-4" />
          {tip}
        </p>
      </div>
    </div>
  )
}
