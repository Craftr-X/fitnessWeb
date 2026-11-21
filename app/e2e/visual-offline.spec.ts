import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test } from '@playwright/test'
import { loginAndOnboard, resetBackend, setFault } from './helpers'

/**
 * T7a 新增 UI 的视觉留档：离线待同步横幅在 390 / 1440 × 深浅两态共 4 张。
 * 与 visual.spec.ts 的 12 张弹层截图分开，产物写到
 * docs/e2e-screenshots/2026-11-10/，用 `npm run test:visual` 一起生成。
 */
const OUT_DIR = join(process.cwd(), '..', 'docs', 'e2e-screenshots', '2026-11-10')

const VIEWPORTS = [
  { label: '390', width: 390, height: 844 },
  { label: '1440', width: 1440, height: 900 },
]

test.beforeEach(async ({ request }) => {
  await resetBackend(request)
  await setFault(request, 'offline')
})

test.afterEach(async ({ request }) => {
  // fault 是 mock 后端的模块级状态，必须恢复，否则会串到同一次运行的其他 @visual 用例
  await setFault(request, 'none')
})

test('生成 T7a 离线待同步横幅的 390/1440 深浅色截图 @visual', async ({ page }) => {
  mkdirSync(OUT_DIR, { recursive: true })
  await loginAndOnboard(page)
  await expect(page.getByText(/云端数据没加载出来/)).toBeVisible()

  // 记一组，让横幅出现「本机有 1 项改动尚未同步到云端」
  await page.getByRole('tab', { name: '计划' }).click()
  const logButton = page.getByRole('button', { name: /记录(重量|次数|时长)/ }).first()
  await expect(logButton).toBeVisible()
  await logButton.click()
  const dialog = page.getByRole('dialog')
  const numbers = dialog.locator('input[type="number"]')
  const count = await numbers.count()
  for (let i = 0; i < Math.min(count, 2); i += 1) {
    await numbers.nth(i).fill(count > 1 && i === 0 ? '12.5' : '10')
  }
  await dialog.getByRole('button', { name: '完成' }).click()

  await expect(page.getByText(/本机有 1 项改动尚未同步/)).toBeVisible()
  // 引导成功的 toast 会盖住横幅上方，等它自动消失
  await expect
    .poll(() => page.locator('[data-sonner-toast]').count(), { timeout: 10_000 })
    .toBe(0)

  for (const viewport of VIEWPORTS) {
    for (const dark of [true, false]) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height })
      await page.evaluate((isDark) => {
        document.documentElement.classList.toggle('dark', isDark)
      }, dark)
      await expect(page.getByText(/本机有 1 项改动尚未同步/)).toBeVisible()
      await page.screenshot({
        path: join(OUT_DIR, `t7a-offline-banner-${viewport.label}-${dark ? 'dark' : 'light'}.png`),
        animations: 'disabled',
      })
    }
  }
})
