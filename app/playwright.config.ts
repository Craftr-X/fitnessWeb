import { defineConfig, devices } from '@playwright/test'

const MOCK_URL = 'http://127.0.0.1:54321'
const APP_URL = 'http://127.0.0.1:3100'

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.spec.ts',
  // 不在 config 里设 grep：CLI 的 --grep 会与它取交集。
  // 两个 npm script 各自带过滤：test:e2e → @smoke（4 条），test:visual → @visual（截图留档）
  timeout: 60_000,
  expect: { timeout: 10_000 },
  // 4 条用例共用同一个有状态的 mock 后端，并行会互相 /__reset，必须串行
  fullyParallel: false,
  workers: 1,
  // 失败就红，不用重试掩盖 flaky
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: APP_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'node e2e/mock-supabase.mjs',
      url: `${MOCK_URL}/__health`,
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
    {
      command: 'npm run dev -- --port 3100 --host 127.0.0.1',
      // 用 port 做 TCP 就绪检查：Playwright 的 HTTP 探针不带 Accept 头，
      // Vite 的 HTML fallback 会给 `/` 返回 404，用 url 会一直等到超时
      port: 3100,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: {
        VITE_SUPABASE_URL: MOCK_URL,
        VITE_SUPABASE_ANON_KEY: 'e2e-anon',
      },
    },
  ],
})
