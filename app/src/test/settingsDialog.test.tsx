import type { ComponentProps } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SettingsDialog from '@/components/SettingsDialog'

/**
 * 账号设置弹层（T4）：删除必须「原样输入邮箱」才放行，
 * 忽略首尾空格与大小写；导出 CSV 要先关设置，避免两个 Dialog 叠加。
 */
const EMAIL = 'BaiHan@Example.com'

type Props = ComponentProps<typeof SettingsDialog>

function renderDialog(overrides: Partial<Props> = {}) {
  const props: Props = {
    open: true,
    onOpenChange: vi.fn(),
    email: EMAIL,
    deleting: false,
    onExportJson: vi.fn(),
    onExportCsv: vi.fn(),
    onDeleteAccount: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }
  render(<SettingsDialog {...props} />)
  return props
}

/** 进入第二步（输入邮箱确认） */
async function openConfirmStep(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: /删除账号与全部数据/ }))
  return screen.getByPlaceholderText('输入你的登录邮箱')
}

describe('SettingsDialog · 删除账号确认', () => {
  it('输入不匹配的邮箱：确认删除保持禁用', async () => {
    const user = userEvent.setup()
    renderDialog()
    const input = await openConfirmStep(user)
    await user.type(input, 'someone@else.com')
    expect(screen.getByRole('button', { name: '确认删除' })).toBeDisabled()
  })

  it('输入匹配（首尾空格 + 大小写不一致也算）：确认删除启用', async () => {
    const user = userEvent.setup()
    renderDialog()
    const input = await openConfirmStep(user)
    await user.type(input, '  baihan@example.com  ')
    expect(screen.getByRole('button', { name: '确认删除' })).toBeEnabled()
  })

  it('点击确认后 onDeleteAccount 只调用一次', async () => {
    const user = userEvent.setup()
    const props = renderDialog()
    const input = await openConfirmStep(user)
    await user.type(input, EMAIL)
    await user.click(screen.getByRole('button', { name: '确认删除' }))
    expect(props.onDeleteAccount).toHaveBeenCalledTimes(1)
  })

  it('没有邮箱时不允许删除（无法确认身份）', async () => {
    const user = userEvent.setup()
    renderDialog({ email: undefined })
    const input = await openConfirmStep(user)
    await user.type(input, 'anything')
    expect(screen.getByRole('button', { name: '确认删除' })).toBeDisabled()
  })

  it('删除进行中：按钮显示「正在删除…」且禁用', async () => {
    const user = userEvent.setup()
    renderDialog({ deleting: true })
    await user.click(screen.getByRole('button', { name: /删除账号与全部数据/ }))
    expect(screen.getByRole('button', { name: '正在删除…' })).toBeDisabled()
  })

  it('导出 CSV：先关闭设置再触发回调，避免弹层叠加', async () => {
    const user = userEvent.setup()
    const props = renderDialog()
    await user.click(screen.getByRole('button', { name: /导出 CSV/ }))
    expect(props.onOpenChange).toHaveBeenCalledWith(false)
    expect(props.onExportCsv).toHaveBeenCalledTimes(1)
  })
})
