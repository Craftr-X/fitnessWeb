import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test } from '@playwright/test'
import { format, subDays } from 'date-fns'
import { loginAndOnboard, resetBackend, waitForCloudSync } from './helpers'

/**
 * T9 趋势图按天聚合的视觉留档：数据页趋势卡在 390/1440 × 深浅色各截一张。
 *
 * 体重数据不走后端注入，直接用页面上的「记录身体数据」表单录入（mock 后端只认
 * 登录时随机生成的邮箱对应的 user_id，事后注入需要对齐哈希 id，反而不稳）：
 * 5 条记录分布在 4 个不同日期，其中今天早晚各一条——聚合后图上应为 4 个点、
 * 历史表格仍 5 行，正好把「图聚合、表不聚合」拍进同一张截图。
 *
 * 用 `npm run test:visual` 生成，产物写到 docs/e2e-screenshots/2026-11-14-t9/。
 */
const OUT_DIR = join(process.cwd(), '..', 'docs', 'e2e-screenshots', '2026-11-14-t9')

const VIEWPORTS = [
  { label: '390', width: 390, height: 844 },
  { label: '1440', width: 1440, height: 900 },
]

/** 距今 n 天的 yyyy-MM-dd */
const day = (n: number) => format(subDays(new Date(), n), 'yyyy-MM-dd')

// 4 个日期 5 条记录：今天早晚各一条，验证「同天取最后一条」在真实渲染下的样子
// （onboarding 会自动写入 1 条今日体重，历史表最终是 6 条，今天共 3 条 → 图上仍只 1 个点）
const ENTRIES: Array<{ date: string; time: string; weight: string; bodyFat: string }> = [
  { date: day(6), time: '08:00', weight: '71.2', bodyFat: '17.5' },
  { date: day(4), time: '08:00', weight: '71.8', bodyFat: '17.9' },
  { date: day(2), time: '08:00', weight: '72.4', bodyFat: '18.4' },
  { date: day(0), time: '08:00', weight: '72.0', bodyFat: '18.6' },
  { date: day(0), time: '20:00', weight: '72.9', bodyFat: '18.9' },
]

// 弱网用例会往 mock 后端注入故障，这里显式清空，保证截图始终在正常网络下生成
test.beforeEach(async ({ request }) => {
  await resetBackend(request)
})

test('生成 T9 数据页趋势图（按天聚合）的 390/1440 深浅色截图 @visual', async ({ page }) => {
  mkdirSync(OUT_DIR, { recursive: true })
  await loginAndOnboard(page)
  await waitForCloudSync(page)
  // 引导成功 toast 会盖住首屏，等它自动消失再开始录入
  await expect
    .poll(() => page.locator('[data-sonner-toast]').count(), { timeout: 10_000 })
    .toBe(0)

  // 进数据页，用真实表单录入体重（同天早晚各一条 + 前面三天）
  await page.getByRole('tab', { name: '数据' }).click()
  await expect(page.getByText('记录身体数据')).toBeVisible()
  for (const e of ENTRIES) {
    await page.locator('#bd-date').fill(e.date)
    await page.locator('#bd-time').fill(e.time)
    await page.locator('#bd-weight').fill(e.weight)
    await page.locator('#bd-fat').fill(e.bodyFat)
    await page.getByRole('button', { name: '保存' }).click()
  }

  // 录入生效：最新体重 = 今天 20:00 那条；历史徽标在（onboarding 的 1 条也在，共 6 条）
  await expect(page.getByText('72.90 kg')).toBeVisible()
  await expect(page.getByText(/^\d+ 条$/)).toBeVisible()
  // 取景锚点：范围按钮是趋势卡头部独有的控件（卡片标题是混合内容 div，文本定位匹配不到）
  const trendCard = page
    .getByRole('button', { name: '近 7 天' })
    .locator('xpath=ancestor::*[@data-slot="card"]')

  for (const viewport of VIEWPORTS) {
    for (const dark of [true, false]) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height })
      await page.evaluate((isDark) => {
        document.documentElement.classList.toggle('dark', isDark)
      }, dark)

      // 取景：整张趋势卡对齐到视口顶部（scrollIntoViewIfNeeded 只保证"可见"，
      // 会把卡停在视口底部切掉图表；block:'start' 才能保证标题+图+说明一起入镜），
      // 再上移一个吸顶栏的高度，避免卡标题被顶栏盖住
      await trendCard.evaluate((el) => el.scrollIntoView({ block: 'start' }))
      await page.evaluate(() => window.scrollBy(0, -88))
      await expect(page.locator('svg.recharts-surface').first()).toBeVisible()
      // recharts 折线有 ~1.5s 的绘制动画，等画完再截，避免截到半根线
      await page.waitForTimeout(2000)

      await page.screenshot({
        path: join(OUT_DIR, `t9-data-chart-${viewport.label}-${dark ? 'dark' : 'light'}.png`),
        animations: 'disabled',
      })
    }
  }
})
