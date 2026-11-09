import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Copy, Mail, Send } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  buildFeedbackBody,
  CONTACT_MAX_LENGTH,
  FEEDBACK_EMAIL,
  FEEDBACK_MAX_LENGTH,
  feedbackMailto,
  MIN_FEEDBACK_LENGTH,
} from '@/lib/feedback'

const WECHAT_QR_URL = `${import.meta.env.BASE_URL}wechat-group-qr.png`

interface Props {
  /** 非受控模式：trigger 元素（登录页用法） */
  trigger?: ReactNode
  /** 受控模式：由父组件（如页头菜单项）控制开关 */
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

/**
 * 「意见反馈」弹窗：可填写表单 → 打开邮件客户端 / 复制反馈内容；微信群二维码降级为折叠区。
 * 首页页头传 open/onOpenChange（受控），登录页传 trigger（非受控）。
 * 不引入后端，也不发起任何网络请求。
 */
export default function FeedbackDialog({ trigger, open, onOpenChange }: Props) {
  const [text, setText] = useState('')
  const [contact, setContact] = useState('')
  const [copied, setCopied] = useState(false)
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // 只做卸载清理：避免「已复制」复位定时器在组件卸载后触发 setState
  useEffect(() => () => {
    if (copyTimer.current) clearTimeout(copyTimer.current)
  }, [])

  const canSend = text.trim().length >= MIN_FEEDBACK_LENGTH
  const host = location.host

  const handleSend = () => {
    if (!canSend) return
    window.open(feedbackMailto(text, contact, host), '_blank')
    toast.success('已打开邮件客户端，发送即可收到')
  }

  const handleCopy = async () => {
    const content = buildFeedbackBody(text, contact, host)
    try {
      // 非 HTTPS / 旧浏览器可能没有 clipboard API，走 catch 里的手动选中降级
      if (!navigator.clipboard?.writeText) throw new Error('clipboard unavailable')
      await navigator.clipboard.writeText(content)
      setCopied(true)
      toast.success('已复制，可以粘贴到微信/邮件')
      if (copyTimer.current) clearTimeout(copyTimer.current)
      copyTimer.current = setTimeout(() => setCopied(false), 2000)
    } catch {
      const textarea = document.getElementById('feedback-text') as HTMLTextAreaElement | null
      textarea?.focus()
      textarea?.select()
      toast.warning('浏览器不支持自动复制，已选中内容，请手动复制')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      {/* 390px / 键盘弹起时正文可滚动，输入框不会被裁掉 */}
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>意见反馈</DialogTitle>
          <DialogDescription>遇到问题、有好想法？随时告诉我，每条都会看。</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-2">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="feedback-text">遇到的问题 / 想要的功能</Label>
              <span
                aria-live="polite"
                className="shrink-0 text-xs tabular-nums text-muted-foreground"
              >
                {text.length}/{FEEDBACK_MAX_LENGTH}
              </span>
            </div>
            <Textarea
              id="feedback-text"
              value={text}
              maxLength={FEEDBACK_MAX_LENGTH}
              rows={4}
              placeholder="例：iOS Safari 上训练日历的数字重叠；希望支持导出 CSV"
              onChange={(event) => setText(event.target.value)}
              className="resize-y"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="feedback-contact">联系方式（可选）</Label>
            <Input
              id="feedback-contact"
              value={contact}
              maxLength={CONTACT_MAX_LENGTH}
              placeholder="邮箱 / 微信，方便我回复你"
              onChange={(event) => setContact(event.target.value)}
            />
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button className="flex-1" disabled={!canSend} onClick={handleSend}>
              <Send />
              发送反馈
            </Button>
            <Button variant="outline" onClick={() => void handleCopy()}>
              <Copy />
              {copied ? '已复制' : '复制反馈内容'}
            </Button>
          </div>

          <p className="text-xs text-muted-foreground">
            发送会打开系统邮件客户端；内容不经任何服务器，也可以复制后粘到微信 / 邮件。
          </p>
        </div>

        {/* 二维码降级为可选折叠区：手机端点不开自己的二维码，表单才是主路径 */}
        <details className="rounded-xl border px-3 py-2.5">
          <summary className="cursor-pointer text-sm font-medium marker:text-muted-foreground">
            也可以加入内测群（扫码）
          </summary>
          <div className="mt-3 flex flex-col items-center gap-2">
            <img
              src={WECHAT_QR_URL}
              alt="FitUp 微信群二维码"
              className="h-40 w-40 rounded-xl border object-cover"
            />
            <p className="text-center text-sm font-medium">扫码加入「FitUp 健身搭子群（内测）」</p>
            <p className="text-center text-xs text-muted-foreground">
              反馈 bug、提需求、聊训练打卡都可以
            </p>
            <a
              href={`mailto:${FEEDBACK_EMAIL}?subject=${encodeURIComponent('FitUp 反馈')}`}
              className="flex items-center gap-1.5 text-xs text-muted-foreground underline-offset-4 hover:underline"
            >
              <Mail className="h-3.5 w-3.5" />
              二维码过期？发邮件到 {FEEDBACK_EMAIL}
            </a>
          </div>
        </details>
      </DialogContent>
    </Dialog>
  )
}
