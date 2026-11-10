import { expect, type APIRequestContext, type Page } from '@playwright/test'

export const MOCK_URL = 'http://127.0.0.1:54321'

export type FaultMode = 'none' | 'offline' | 'slow' | 'error'

interface StateRow {
  data?: {
    profile?: { onboarded?: boolean }
    setLogs?: Record<string, unknown>
    checks?: Record<string, boolean>
    activity?: Record<string, number>
  }
}

/** 每个用例前置清理后端内存 + data.json + 故障注入，避免用例之间串数据 */
export async function resetBackend(request: APIRequestContext) {
  const response = await request.post(`${MOCK_URL}/__reset`)
  expect(response.ok()).toBeTruthy()
}

/** 注入弱网故障；mode=none 恢复。（T7a：/rest/v1/user_data 的 GET / 写请求生效） */
export async function setFault(request: APIRequestContext, mode: FaultMode, ms = 0) {
  const response = await request.post(`${MOCK_URL}/__fault`, { data: { mode, ms } })
  expect(response.ok()).toBeTruthy()
}

/** 读取 mock 后端的全部 user_data 行 */
export async function cloudRows(request: APIRequestContext): Promise<Record<string, StateRow>> {
  const response = await request.get(`${MOCK_URL}/__state`)
  const { rows } = (await response.json()) as { rows: Record<string, StateRow> }
  return rows
}

/** 读取浏览器侧的本机缓存与未同步标记（key 按 userId 生成，这里只筛前缀） */
export async function readLocalCloud(page: Page): Promise<{
  cache: Record<string, unknown> | null
  dirty: string | null
  keys: string[]
}> {
  return page.evaluate(() => {
    const keys = Object.keys(localStorage).filter((k) => k.startsWith('fitup:u:'))
    const cacheKey = keys.find((k) => !k.endsWith(':dirty'))
    const dirtyKey = keys.find((k) => k.endsWith(':dirty'))
    let cache: Record<string, unknown> | null = null
    try {
      cache = cacheKey ? (JSON.parse(localStorage.getItem(cacheKey) || 'null') as Record<string, unknown>) : null
    } catch {
      cache = null
    }
    return { cache, dirty: dirtyKey ? localStorage.getItem(dirtyKey) : null, keys }
  })
}

/**
 * 走完「邮箱 → 任意 6 位验证码 → 2 步引导」，停在已登录、已生成第 1 周计划的首页。
 * 返回本次用的邮箱，供删号 / 重新登录用例复用。
 * 每个 test 有独立 browser context，localStorage 天然干净。
 */
export async function loginAndOnboard(page: Page): Promise<string> {
  const email = `e2e-${Date.now()}-${Math.floor(Math.random() * 10000)}@example.com`
  await page.goto('/')
  await page.getByPlaceholder('you@example.com').fill(email)
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
  return email
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
