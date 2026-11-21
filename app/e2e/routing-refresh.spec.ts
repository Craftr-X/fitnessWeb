import { expect, test } from '@playwright/test'
import { backUntilHashChanges, loginAndOnboard, resetBackend, waitForCloudSync } from './helpers'

test.beforeEach(async ({ request }) => {
  await resetBackend(request)
})

test('切到计划页 → 返回键回上一个 Tab → 刷新保持登录态与 Tab @smoke', async ({ page }) => {
  await loginAndOnboard(page)
  // 刷新前必须等引导后的文档落盘，否则云端默认文档会把用户踢回引导页
  await waitForCloudSync(page)
  // 标记当前文档，返回键若触发整页重载就会丢失
  await page.evaluate(() => {
    ;(window as unknown as { __e2eAlive?: string }).__e2eAlive = 'yes'
  })

  await page.getByRole('tab', { name: '计划' }).click()
  await expect(page).toHaveURL(/#\/plan$/)
  await expect(page.getByRole('tab', { name: '计划' })).toHaveAttribute('aria-selected', 'true')

  // 浏览器返回键：回到上一个 Tab，且 SPA 不重新加载
  await backUntilHashChanges(page)
  await expect(page.getByRole('tab', { name: '今日' })).toHaveAttribute('aria-selected', 'true')
  expect(await page.evaluate(() => (window as unknown as { __e2eAlive?: string }).__e2eAlive)).toBe(
    'yes',
  )
  await expect(page.getByText('第 1 周', { exact: true }).first()).toBeVisible()

  // 再切回计划并刷新：hash 与登录态都要保持
  // （reload 会清空 Chromium 的回退历史，所以返回键验证放在刷新之前）
  await page.getByRole('tab', { name: '计划' }).click()
  await page.reload()
  await expect(page).toHaveURL(/#\/plan$/)
  await expect(page.getByRole('tab', { name: '计划' })).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByText('第 1 周', { exact: true }).first()).toBeVisible()
})
