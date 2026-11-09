import { expect, test } from '@playwright/test'
import { loginAndOnboard, resetBackend } from './helpers'

test.beforeEach(async ({ request }) => {
  await resetBackend(request)
})

test('今日页反馈 → 下周预览 → 应用第 2 周计划 @smoke', async ({ page }) => {
  await loginAndOnboard(page)

  await page.getByRole('button', { name: '填写本周反馈' }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByText('第 1 周反馈')).toBeVisible()

  await dialog.getByRole('button', { name: '保存本周反馈' }).click()
  await expect(dialog.getByText(/第 2 周计划已按本次反馈算好/)).toBeVisible()

  await dialog.getByRole('button', { name: '应用第 2 周计划' }).click()
  await expect(page).toHaveURL(/#\/plan$/)
  await expect(page.getByRole('tab', { name: '计划' })).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByText('第 2 周', { exact: true }).first()).toBeVisible()
})
