import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { toast } from 'sonner'
import FeedbackDialog from '@/components/FeedbackDialog'
import {
  buildFeedbackBody,
  CONTACT_MAX_LENGTH,
  FEEDBACK_EMAIL,
  FEEDBACK_MAX_LENGTH,
  feedbackMailto,
} from '@/lib/feedback'

// 弹层只依赖 toast 的调用，不挂载真实 Toaster，避免测试受主题 / DOM 测量影响
vi.mock('sonner', () => ({
  toast: { success: vi.fn(), warning: vi.fn(), error: vi.fn() },
}))

const writeText = vi.fn().mockResolvedValue(undefined)

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(window, 'open').mockImplementation(() => null)
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText },
  })
})

afterEach(() => {
  vi.restoreAllMocks()
})

const renderControlled = () =>
  render(<FeedbackDialog open onOpenChange={vi.fn()} />)

const textbox = () => screen.getByLabelText('遇到的问题 / 想要的功能')
const contactInput = () => screen.getByPlaceholderText('邮箱 / 微信，方便我回复你')
const sendButton = () => screen.getByRole('button', { name: /发送反馈/ })

describe('FeedbackDialog · 可填写表单（T3）', () => {
  it('初始「发送反馈」禁用，字数计数从 0/500 开始', () => {
    renderControlled()
    expect(sendButton()).toBeDisabled()
    expect(screen.getByText(`0/${FEEDBACK_MAX_LENGTH}`)).toBeInTheDocument()
  })

  it('输入 4 字仍禁用，第 5 字后启用', async () => {
    const user = userEvent.setup()
    renderControlled()
    await user.type(textbox(), '日历重叠')
    expect(sendButton()).toBeDisabled()
    await user.type(textbox(), '了')
    expect(sendButton()).toBeEnabled()
    expect(screen.getByText(`5/${FEEDBACK_MAX_LENGTH}`)).toBeInTheDocument()
  })

  it('纯空格不算有效反馈（trim 后不足 5 字）', async () => {
    const user = userEvent.setup()
    renderControlled()
    await user.type(textbox(), '      ')
    expect(sendButton()).toBeDisabled()
    expect(window.open).not.toHaveBeenCalled()
  })

  it('输入框带 maxLength 上限，联系方式上限 60', () => {
    renderControlled()
    expect(textbox()).toHaveAttribute('maxlength', String(FEEDBACK_MAX_LENGTH))
    expect(contactInput()).toHaveAttribute('maxlength', String(CONTACT_MAX_LENGTH))
  })

  it('点击发送：window.open 调用一次，mailto URL 含编码正文与联系方式', async () => {
    const user = userEvent.setup()
    renderControlled()
    await user.type(textbox(), 'iOS Safari 日历数字重叠')
    await user.type(contactInput(), 'test@example.com')
    await user.click(sendButton())

    expect(window.open).toHaveBeenCalledTimes(1)
    const [url, target] = vi.mocked(window.open).mock.calls[0]
    expect(url).toMatch(/^mailto:/)
    expect(url).toContain(FEEDBACK_EMAIL)
    expect(target).toBe('_blank')
    expect(url).toContain(encodeURIComponent('iOS Safari 日历数字重叠'))
    expect(url).toContain(encodeURIComponent('联系方式：test@example.com'))
    expect(toast.success).toHaveBeenCalledWith('已打开邮件客户端，发送即可收到')
  })

  it('复制按钮写入剪贴板，内容含正文与联系方式，并给出 toast', async () => {
    const user = userEvent.setup()
    // userEvent.setup() 会安装自己的 clipboard stub，这里换回可断言的 spy
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    })
    renderControlled()
    await user.type(textbox(), '希望支持导出 CSV')
    await user.type(contactInput(), 'wx: fitup_dev')
    await user.click(screen.getByRole('button', { name: /复制反馈内容/ }))

    expect(await screen.findByRole('button', { name: '已复制' })).toBeInTheDocument()
    expect(writeText).toHaveBeenCalledTimes(1)
    const copied = writeText.mock.calls[0][0] as string
    expect(copied).toContain('希望支持导出 CSV')
    expect(copied).toContain('联系方式：wx: fitup_dev')
    expect(toast.success).toHaveBeenCalledWith('已复制，可以粘贴到微信/邮件')
  })

  it('剪贴板不可用：降级为选中正文并提示，不抛错也不假装成功', async () => {
    const user = userEvent.setup()
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined })
    renderControlled()
    await user.type(textbox(), '收不到验证码')
    await user.click(screen.getByRole('button', { name: /复制反馈内容/ }))

    expect(writeText).not.toHaveBeenCalled()
    expect(toast.warning).toHaveBeenCalledWith('浏览器不支持自动复制，已选中内容，请手动复制')
    expect((textbox() as HTMLTextAreaElement).selectionEnd).toBe('收不到验证码'.length)
  })

  it('二维码默认折叠，点标题才展开（可选路径）', async () => {
    const user = userEvent.setup()
    renderControlled()
    const summary = screen.getByText('也可以加入内测群（扫码）')
    const details = summary.closest('details') as HTMLDetailsElement
    expect(details).not.toHaveAttribute('open')

    await user.click(summary)
    expect(details).toHaveAttribute('open')
    expect(screen.getByAltText('FitUp 微信群二维码')).toBeInTheDocument()
  })

  it('非受控模式（登录页 trigger）：点击入口才打开弹层', async () => {
    const user = userEvent.setup()
    render(
      <FeedbackDialog
        trigger={<button type="button">收不到验证码？点这里反馈</button>}
      />,
    )
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /收不到验证码/ }))
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    expect(sendButton()).toBeDisabled()
  })

  it('受控模式（页头菜单）：open 由父组件决定', () => {
    const { rerender } = render(<FeedbackDialog open={false} onOpenChange={vi.fn()} />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    rerender(<FeedbackDialog open onOpenChange={vi.fn()} />)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })
})

describe('feedback 纯函数', () => {
  it('正文 trim、联系方式为空时不出现该段、末尾带来源', () => {
    const body = buildFeedbackBody('  日历数字重叠  ', '   ', 'fitup.example.com')
    expect(body).toBe('日历数字重叠\n\n—— 来自 fitup.example.com')
    expect(body).not.toContain('联系方式')
  })

  it('联系方式与落款都进正文，host 为空时回落到 FitUp', () => {
    expect(buildFeedbackBody('想要深色模式', 'a@b.com')).toBe(
      '想要深色模式\n\n联系方式：a@b.com\n\n—— 来自 FitUp',
    )
  })

  it('mailto URL 编码 subject 与完整正文', () => {
    const url = feedbackMailto('日历数字重叠', 'test@example.com', 'localhost:3000')
    expect(url).toBe(
      `mailto:${FEEDBACK_EMAIL}?subject=${encodeURIComponent('FitUp 反馈')}` +
        `&body=${encodeURIComponent(buildFeedbackBody('日历数字重叠', 'test@example.com', 'localhost:3000'))}`,
    )
  })
})
