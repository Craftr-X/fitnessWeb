import { Component, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

const RELOAD_FLAG = 'fitup:chunk-reload'

function isChunkLoadError(error: Error): boolean {
  return (
    /Failed to fetch dynamically imported module/.test(error.message) ||
    /error loading dynamically imported module/i.test(error.message) ||
    error.name === 'ChunkLoadError'
  )
}

/** 渲染异常兜底：显示错误页而不是黑屏 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: unknown) {
    console.error('[FitUp] 渲染异常：', error, info)
    // 新版本发布后，旧页面缓存的 hash 资源已不存在，自动刷新一次拉取新版
    if (isChunkLoadError(error) && !sessionStorage.getItem(RELOAD_FLAG)) {
      sessionStorage.setItem(RELOAD_FLAG, '1')
      window.location.reload()
    }
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-screen items-center justify-center p-4">
          <Card className="w-full max-w-sm">
            <CardHeader>
              <CardTitle>页面出错了</CardTitle>
              <CardDescription className="break-all text-xs">
                {this.state.error.message}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full" onClick={() => window.location.reload()}>
                刷新重试
              </Button>
            </CardContent>
          </Card>
        </div>
      )
    }
    return this.props.children
  }
}
