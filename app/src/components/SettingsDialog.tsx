import { useState } from 'react'
import { Download, FileSpreadsheet, ShieldAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface Props {
  open: boolean
  onOpenChange: (v: boolean) => void
  email?: string
  /** 删除进行中：按钮显示「正在删除…」并禁用，避免重复提交 */
  deleting: boolean
  onExportJson: () => void
  onExportCsv: () => void
  onDeleteAccount: () => Promise<void>
}

/**
 * 账号设置弹层（T4）：账号信息、数据导出、危险操作集中在一处。
 *
 * 删除账号改为「原样输入登录邮箱」确认，替代原来的菜单直达 + AlertDialog 二次确认；
 * 弹层只做校验，删除的执行仍留在 Home。
 */
export default function SettingsDialog({
  open,
  onOpenChange,
  email,
  deleting,
  onExportJson,
  onExportCsv,
  onDeleteAccount,
}: Props) {
  const [confirming, setConfirming] = useState(false)
  const [typed, setTyped] = useState('')

  // 关闭时清空第二步输入，下次打开回到第一步。
  // 所有关闭路径（X / 遮罩 / ESC / 导出 CSV）都走 onOpenChange，
  // 因此在关闭事件里重置即可，不必在 effect 里同步 setState。
  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setConfirming(false)
      setTyped('')
    }
    onOpenChange(next)
  }

  // 忽略首尾空格与大小写；没有邮箱时不允许删除（无法确认身份）
  const matched = !!email && typed.trim().toLowerCase() === email.trim().toLowerCase()

  // 先关设置再开 CSV 弹层，避免两个 Dialog 叠在一起
  const handleExportCsv = () => {
    handleOpenChange(false)
    onExportCsv()
  }

  const handleDelete = async () => {
    if (!matched || deleting) return
    await onDeleteAccount()
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>设置</DialogTitle>
          <DialogDescription>账号信息、数据导出与危险操作。</DialogDescription>
        </DialogHeader>

        <section className="space-y-2">
          <h3 className="text-sm font-medium">账号</h3>
          <div className="space-y-1.5">
            <Label htmlFor="settings-email">登录邮箱</Label>
            <Input id="settings-email" value={email ?? ''} readOnly className="text-muted-foreground" />
          </div>
        </section>

        <section className="space-y-2">
          <h3 className="text-sm font-medium">数据</h3>
          <Button variant="outline" className="w-full justify-start" onClick={onExportJson}>
            <Download />
            导出 JSON（完整备份）
          </Button>
          <Button variant="outline" className="w-full justify-start" onClick={handleExportCsv}>
            <FileSpreadsheet />
            导出 CSV（Excel 打开）
          </Button>
        </section>

        <section className="space-y-2 rounded-lg border border-destructive/40 p-3">
          <h3 className="text-sm font-medium text-destructive">危险区</h3>
          {confirming ? (
            <>
              <p className="text-xs text-muted-foreground">
                此操作不可恢复。请原样输入登录邮箱{' '}
                <span className="font-medium text-foreground">{email}</span> 以确认。
              </p>
              <div className="space-y-1.5">
                <Label htmlFor="settings-confirm-email">邮箱</Label>
                <Input
                  id="settings-confirm-email"
                  value={typed}
                  onChange={(e) => setTyped(e.target.value)}
                  placeholder="输入你的登录邮箱"
                  autoComplete="off"
                  disabled={deleting}
                />
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  disabled={deleting}
                  onClick={() => {
                    setConfirming(false)
                    setTyped('')
                  }}
                >
                  取消
                </Button>
                <Button
                  variant="destructive"
                  className="flex-1"
                  disabled={!matched || deleting}
                  onClick={() => void handleDelete()}
                >
                  {deleting ? '正在删除…' : '确认删除'}
                </Button>
              </div>
            </>
          ) : (
            <>
              <p className="text-xs text-muted-foreground">
                删除后云端的训练计划、打卡、体重与反馈数据全部清空，本机缓存一并清除，随后退出登录，不可恢复。
              </p>
              <Button
                variant="outline"
                className="w-full justify-start text-destructive hover:text-destructive"
                onClick={() => setConfirming(true)}
              >
                <ShieldAlert />
                删除账号与全部数据
              </Button>
            </>
          )}
        </section>
      </DialogContent>
    </Dialog>
  )
}
