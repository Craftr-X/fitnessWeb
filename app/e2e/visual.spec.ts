import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test } from '@playwright/test'
import { loginAndOnboard, waitForCloudSync } from './helpers'

/**
 * 视觉验收留档（非冒烟）：把 T5 CSV / T4 设置 / T3 反馈三个弹层，
 * 在 390px 与 1440px、深浅两态各截一张，补齐前三个 PR 欠下的 §3.2 截图。
 * 用 `npm run test:visual` 生成，产物写到 docs/e2e-screenshots/2026-11-09/。
 */
const OUT_DIR = join(process.cwd(), '..', 'docs', 'e2e-screenshots', '2026-11-09')

const VIEWPORTS = [
  { label: '390', width: 390, height: 844 },
  { label: '1440', width: 1440, height: 900 },
]

test('生成 T5/T4/T3 弹层的 390/1440 深浅色截图 @visual', async ({ page }) => {
  mkdirSync(OUT_DIR, { recursive: true })
  await loginAndOnboard(page)
  await waitForCloudSync(page)
  // 引导成功 toast 会盖住弹层顶部，等它自动消失再开始截图
  // （属性名不匹配时 count 恒为 0，会立刻通过，不会卡住）
  await expect
    .poll(() => page.locator('[data-sonner-toast]').count(), { timeout: 10_000 })
    .toBe(0)

  const dialog = () => page.getByRole('dialog')
  const openMenu = () => page.getByRole('button', { name: '菜单' }).click()

  const shots = [
    {
      name: 't3-feedback',
      open: async () => {
        await openMenu()
        await page.getByRole('menuitem', { name: '意见反馈' }).click()
      },
    },
    {
      name: 't4-settings',
      open: async () => {
        await openMenu()
        await page.getByRole('menuitem', { name: '设置' }).click()
      },
    },
    {
      name: 't5-csv',
      open: async () => {
        await openMenu()
        await page.getByRole('menuitem', { name: '设置' }).click()
        await page.getByRole('button', { name: /导出 CSV/ }).click()
        // 设置弹层先关、CSV 弹层后开，等叠加态结束再截
        await expect(dialog()).toHaveCount(1)
        await expect(dialog().getByText('导出 CSV', { exact: true })).toBeVisible()
      },
    },
  ]

  for (const viewport of VIEWPORTS) {
    for (const dark of [true, false]) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height })
      await page.evaluate((isDark) => {
        document.documentElement.classList.toggle('dark', isDark)
      }, dark)

      for (const shot of shots) {
        await shot.open()
        await expect(dialog()).toBeVisible()
        await page.screenshot({
          path: join(OUT_DIR, `${shot.name}-${viewport.label}-${dark ? 'dark' : 'light'}.png`),
          animations: 'disabled',
        })
        await page.keyboard.press('Escape')
        await expect(dialog()).toHaveCount(0)
      }
    }
  }
})
