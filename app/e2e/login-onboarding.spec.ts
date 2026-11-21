import { expect, test } from '@playwright/test'
import { loginAndOnboard, resetBackend } from './helpers'

test.beforeEach(async ({ request }) => {
  await resetBackend(request)
})

test('登录 → 2 步引导 → 生成第 1 周计划 @smoke', async ({ page }) => {
  await loginAndOnboard(page)

  await expect(page.getByRole('tab', { name: '今日' })).toBeVisible()
  await expect(page.getByRole('tab', { name: '计划' })).toBeVisible()
  await expect(page.getByRole('tab', { name: '数据' })).toBeVisible()
  await expect(page.getByText('第 1 周', { exact: true }).first()).toBeVisible()
})
