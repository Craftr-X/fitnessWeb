import type { ReactNode } from 'react'
import { Mail, MessageCircle } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'

const FEEDBACK_EMAIL = '1443608354@qq.com'
// 微信群二维码图片放在 public/ 下，过期后替换该文件重新部署即可
const WECHAT_QR_URL = `${import.meta.env.BASE_URL}wechat-group-qr.png`

/**
 * 「意见反馈」弹窗：微信群二维码 + 备用邮箱。
 * 首页页头和登录页共用，trigger 由调用方按各自风格传入。
 */
export default function FeedbackDialog({ trigger }: { trigger: ReactNode }) {
  return (
    <Dialog>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>意见反馈</DialogTitle>
          <DialogDescription>遇到问题、有好想法？随时告诉我，每条都会看。</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-3 py-2">
          <img
            src={WECHAT_QR_URL}
            alt="FitUp 微信群二维码"
            className="h-48 w-48 rounded-xl border object-cover"
          />
          <p className="text-center text-sm font-medium">扫码加入「FitUp 健身搭子群（内测）」</p>
          <p className="text-center text-xs text-muted-foreground">
            反馈 bug、提需求、聊训练打卡都可以
          </p>
        </div>

        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="h-px flex-1 bg-border" />
          不想加群？发邮件也行
          <span className="h-px flex-1 bg-border" />
        </div>

        <a
          href={`mailto:${FEEDBACK_EMAIL}?subject=FitUp 反馈`}
          className="flex items-center justify-center gap-2 rounded-xl border py-2.5 text-sm font-medium transition-colors hover:bg-accent"
        >
          <Mail className="h-4 w-4" />
          {FEEDBACK_EMAIL}
        </a>

        <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
          <MessageCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          群二维码若已过期，发邮件说一声，我拉你进群。
        </p>
      </DialogContent>
    </Dialog>
  )
}
