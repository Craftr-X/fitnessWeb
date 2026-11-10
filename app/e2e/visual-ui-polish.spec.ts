import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test } from '@playwright/test'
import { loginAndOnboard, resetBackend, waitForCloudSync } from './helpers'

/**
 * T8 页面整洁与体验打磨的视觉留档。
 *
 * 同一份 spec 在改动前后各跑一次，产物分目录，便于逐张对比：
 *   UI_POLISH_PHASE=before npx playwright test e2e/visual-ui-polish.spec.ts
 *   npm run test:visual                       （默认 after）
 *
 * 只用 Tab 名等通用选择器，不依赖本轮新增的按钮文案，保证改动前的代码也能跑。
 * 输出：docs/e2e-screenshots/2026-11-10-ui/{before,after}/
 */
const PHASE = process.env.UI_POLISH_PHASE === 'before' ? 'before' : 'after'
const OUT_DIR = join(process.cwd(), '..', 'docs', 'e2e-screenshots', '2026-11-10-ui', PHASE)

const VIEWPORTS = [
  { label: '390', width: 390, height: 844 },
  { label: '1440', width: 1440, height: 900 },
]

// 弱网用例会往 mock 后端注入故障，这里显式清空，保证截图始终在正常网络下生成
test.beforeEach(async ({ request }) => {
  await resetBackend(request)
})

test('生成 T8 UI 打磨的 390/1440 深浅色首屏截图 @visual', async ({ page }) => {
  mkdirSync(OUT_DIR, { recursive: true })
  await loginAndOnboard(page)
  await waitForCloudSync(page)
  // 引导成功 toast 会盖住首屏，等它自动消失再截
  await expect
    .poll(() => page.locator('[data-sonner-toast]').count(), { timeout: 10_000 })
    .toBe(0)

  for (const viewport of VIEWPORTS) {
    for (const dark of [true, false]) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height })
      await page.evaluate((isDark) => {
        document.documentElement.classList.toggle('dark', isDark)
      }, dark)
      await expect(page.getByRole('tab', { name: '今日' })).toBeVisible()
      // 上一轮点「查看全部」会让浏览器自动滚动到按钮；每轮开头强制回顶部，
      // 保证 before / after 的「首屏」截图取的是同一个位置，可以直接逐张对比
      await page.evaluate(() => window.scrollTo(0, 0))

      const suffix = `${viewport.label}-${dark ? 'dark' : 'light'}.png`
      await page.screenshot({
        path: join(OUT_DIR, `t8-today-${suffix}`),
        animations: 'disabled',
      })

      // 「查看全部提醒」是 T8 新增控件，只在 after 阶段留档展开态
      if (PHASE === 'after') {
        await page.getByRole('button', { name: /查看全部/ }).click()
        await page.screenshot({
          path: join(OUT_DIR, `t8-today-expanded-${suffix}`),
          animations: 'disabled',
        })
        await page.getByRole('button', { name: /收起提醒/ }).click()
      }
    }
  }
})
