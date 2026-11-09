import { expect, test } from '@playwright/test'
import { loginAndOnboard, resetBackend } from './helpers'

test.beforeEach(async ({ request }) => {
  await resetBackend(request)
})

test('计划页记组 → 自动打卡 → 行内摘要 + 休息计时器 @smoke', async ({ page }) => {
  await loginAndOnboard(page)
  await page.getByRole('tab', { name: '计划' }).click()

  // 依负荷类型不同，入口文案是「记录重量 / 记录次数 / 记录时长」
  const logButton = page.getByRole('button', { name: /记录(重量|次数|时长)/ }).first()
  await expect(logButton).toBeVisible()
  await logButton.click()

  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  // weighted 有两个数字输入（重量 + 次数），自重 / 计时只有一个
  const numbers = dialog.locator('input[type="number"]')
  const count = await numbers.count()
  expect(count).toBeGreaterThan(0)
  for (let i = 0; i < Math.min(count, 2); i += 1) {
    await numbers.nth(i).fill(count > 1 && i === 0 ? '12.5' : '10')
  }
  await dialog.getByRole('button', { name: '完成' }).click()

  await expect(page.getByRole('button', { name: /本次：/ }).first()).toBeVisible()
  await expect(page.getByRole('checkbox', { checked: true }).first()).toBeVisible()
  await expect(page.getByRole('timer')).toBeVisible()
})
