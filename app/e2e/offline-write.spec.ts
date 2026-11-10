import { expect, test, type Page } from '@playwright/test'
import {
  cloudRows,
  loginAndOnboard,
  readLocalCloud,
  resetBackend,
  setFault,
  waitForCloudSync,
} from './helpers'

/**
 * T7a 弱网回归。对应 docs/2026-11-09-t7a-offline-hardening-plan.md §2.7 / §3.1：
 * 核心断言是「断网记组 → 刷新 → setLogs / checks / activity 仍在」，
 * 这是改造前必然失败的路径（loadError 期间连 localStorage 都不写）。
 */

/** 在计划页给第一个动作记一组，同时触发 setLogs / checks / activity 三个域 */
async function logFirstSet(page: Page) {
  await page.getByRole('tab', { name: '计划' }).click()
  const logButton = page.getByRole('button', { name: /记录(重量|次数|时长)/ }).first()
  await expect(logButton).toBeVisible()
  await logButton.click()

  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  const numbers = dialog.locator('input[type="number"]')
  const count = await numbers.count()
  expect(count).toBeGreaterThan(0)
  for (let i = 0; i < Math.min(count, 2); i += 1) {
    await numbers.nth(i).fill(count > 1 && i === 0 ? '12.5' : '10')
  }
  await dialog.getByRole('button', { name: '完成' }).click()
  await expect(page.getByRole('button', { name: /本次：/ }).first()).toBeVisible()
}

function expectThreeDomains(cache: Record<string, unknown> | null) {
  expect(Object.keys((cache?.setLogs as Record<string, unknown>) ?? {}).length).toBeGreaterThan(0)
  expect(Object.keys((cache?.checks as Record<string, boolean>) ?? {}).length).toBeGreaterThan(0)
  expect(Object.keys((cache?.activity as Record<string, number>) ?? {}).length).toBeGreaterThan(0)
}

test.beforeEach(async ({ request }) => {
  await resetBackend(request) // 同时清空 fault
})

test('断网记组 → 刷新仍在 → 联网重推 @offline', async ({ page, request }) => {
  await setFault(request, 'offline')
  await loginAndOnboard(page)

  // 云端 GET 失败：页面仍可用，但要如实告知
  await expect(page.getByText(/云端数据没加载出来/)).toBeVisible()
  await logFirstSet(page)
  await expect(page.getByText(/本机有 1 项改动尚未同步/)).toBeVisible()

  // ① 改动确实落了本机，并且标了 dirty；同时云端一个字节都没写
  const before = await readLocalCloud(page)
  expect(before.dirty).toBe('1')
  expectThreeDomains(before.cache)
  expect(Object.keys(await cloudRows(request))).toHaveLength(0)

  // ② 核心回归断言：刷新后三个域都还在（改造前这一步必然失败）
  await page.reload()
  await expect(page.getByRole('tab', { name: '计划' })).toBeVisible()
  await expect(page.getByRole('button', { name: /本次：/ }).first()).toBeVisible()
  const after = await readLocalCloud(page)
  expect(after.cache?.setLogs).toEqual(before.cache?.setLogs)
  expect(after.cache?.checks).toEqual(before.cache?.checks)
  expect(after.cache?.activity).toEqual(before.cache?.activity)
  expect(after.dirty).toBe('1')

  // ③ 网络恢复：online 事件触发重推，云端拿到含 setLogs 的整份文档
  await setFault(request, 'none')
  await page.evaluate(() => window.dispatchEvent(new Event('online')))
  await expect
    .poll(
      async () => {
        const rows = await cloudRows(request)
        return Object.values(rows).some((row) => Object.keys(row?.data?.setLogs ?? {}).length > 0)
      },
      { timeout: 15_000 },
    )
    .toBe(true)
  await expect
    .poll(async () => (await readLocalCloud(page)).dirty, { timeout: 10_000 })
    .toBeNull()
  await expect(page.getByText(/本机有 \d+ 项改动尚未同步/)).toHaveCount(0)
})

test('删号后重新登录：本机无残留、训练数据不重放复活 @offline', async ({ page, request }) => {
  const email = await loginAndOnboard(page)
  await waitForCloudSync(page)
  await logFirstSet(page)
  await expect
    .poll(
      async () => {
        const rows = await cloudRows(request)
        return Object.values(rows).some((row) => Object.keys(row?.data?.setLogs ?? {}).length > 0)
      },
      { timeout: 15_000 },
    )
    .toBe(true)

  // 菜单 → 设置 → 危险区输入邮箱确认删除（T4 的两步确认）
  await page.getByRole('button', { name: '菜单' }).click()
  await page.getByRole('menuitem', { name: '设置' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('button', { name: '删除账号与全部数据' }).click()
  await dialog.getByPlaceholder('输入你的登录邮箱').fill(email)
  await dialog.getByRole('button', { name: '确认删除' }).click()

  await expect(page.getByPlaceholder('you@example.com')).toBeVisible()
  const afterDelete = await readLocalCloud(page)
  expect(afterDelete.keys).toHaveLength(0)
  expect(Object.keys(await cloudRows(request))).toHaveLength(0)

  // 重新登录同一邮箱。新用户加载时会自动建一份默认文档（既有行为），
  // 因此「云端为空」的验收改为：行里绝不能出现删掉之前的训练数据。
  await page.getByPlaceholder('you@example.com').fill(email)
  await page.getByRole('button', { name: '发送验证码' }).click()
  await expect(page.getByText('输入验证码')).toBeVisible()
  await page.locator('input[autocomplete="one-time-code"]').fill('123456')
  await expect(page.getByRole('button', { name: '下一步' })).toBeVisible()

  await expect
    .poll(async () => Object.keys(await cloudRows(request)).length, { timeout: 10_000 })
    .toBeGreaterThan(0)
  for (const row of Object.values(await cloudRows(request))) {
    expect(Object.keys(row?.data?.setLogs ?? {})).toHaveLength(0)
    expect(Object.keys(row?.data?.checks ?? {})).toHaveLength(0)
    expect(Object.keys(row?.data?.activity ?? {})).toHaveLength(0)
  }
  const relogin = await readLocalCloud(page)
  expect(Object.keys((relogin.cache?.setLogs as Record<string, unknown>) ?? {})).toHaveLength(0)
})

test('慢网导致云端读超时：页面不会永久停在 splash @offline', async ({ page, request }) => {
  // 9000ms > LOAD_TIMEOUT_MS(8000)，GET 必定被 withTimeout 判超时
  await setFault(request, 'slow', 9000)
  await loginAndOnboard(page)

  await expect(page.getByRole('tab', { name: '今日' })).toBeVisible()
  await expect(page.getByText(/云端数据没加载出来/)).toBeVisible()
})
