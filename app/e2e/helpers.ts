import { expect, type APIRequestContext, type Page } from '@playwright/test'

export const MOCK_URL = 'http://127.0.0.1:54321'

interface StateRow {
  data?: { profile?: { onboarded?: boolean } }
}

/** 每个用例前置清理后端内存 + data.json，避免用例之间串数据 */
export async function resetBackend(request: APIRequestContext) {
  const response = await request.post(`${MOCK_URL}/__reset`)
  expect(response.ok()).toBeTruthy()
}

/**
 * 走完「邮箱 → 任意 6 位验证码 → 2 步引导」，停在已登录、已生成第 1 周计划的首页。
 * 每个 test 有独立 browser context，localStorage 天然干净。
 */
export async function loginAndOnboard(page: Page) {
  await page.goto('/')
  await page.getByPlaceholder('you@example.com').fill(`e2e-${Date.now()}@example.com`)
  await page.getByRole('button', { name: '发送验证码' }).click()
  await expect(page.getByText('输入验证码')).toBeVisible()

  // input-otp 渲染的隐藏 input；填满 6 位会触发 onComplete 自动提交，
  // 不再点「进入 FitUp」，避免重复 verifyOtp
  await page.locator('input[autocomplete="one-time-code"]').fill('123456')

  await expect(page.getByRole('button', { name: '下一步' })).toBeVisible()
  await page.getByRole('button', { name: '下一步' }).click()
  await page.getByRole('button', { name: '生成我的计划' }).click()
  await expect(page.getByRole('tab', { name: '今日' })).toBeVisible()
  await expect(page.getByText('第 1 周', { exact: true }).first()).toBeVisible()
}

/**
 * 等云端真正写入含 onboarded:true 的文档再继续。
 * store 的 saveUserData 有 800ms 防抖，若刷新早于落盘，云端默认文档会覆盖本机缓存、
 * 把用户踢回引导页 —— 这里用条件轮询而不是 waitForTimeout。
 */
/**
 * 模拟浏览器返回键，连续回退直到离开当前 hash。
 * dev 下 StrictMode 会让一次 navigate push 出两条相同记录，单次 goBack 只会停在同一个 Tab；
 * Playwright 的 page.goBack() 在这种同文档条目上还会返回 null，所以用原生 history.back()。
 */
export async function backUntilHashChanges(page: Page, fromHash = '#/plan') {
  await expect
    .poll(
      async () => {
        const hash = await page.evaluate(() => window.location.hash)
        if (hash === fromHash) await page.evaluate(() => window.history.back())
        return hash
      },
      { timeout: 10_000, intervals: [100, 150, 250, 500] },
    )
    .not.toBe(fromHash)
}

export async function waitForCloudSync(page: Page) {
  await expect
    .poll(
      async () => {
        const response = await page.request.get(`${MOCK_URL}/__state`)
        const { rows } = (await response.json()) as { rows: Record<string, StateRow> }
        return Object.values(rows).some((row) => row?.data?.profile?.onboarded === true)
      },
      { timeout: 15_000 },
    )
    .toBe(true)
}
