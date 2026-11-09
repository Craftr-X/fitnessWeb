import { mergeConfig } from 'vitest/config'
import viteConfig from './vite.config'

/**
 * Vitest 配置：继承 vite.config.ts（保留 @ 别名等），再加 test 字段。
 * 保持与生产构建配置分离，避免 vite build 依赖 vitest 类型。
 */
export default mergeConfig(viteConfig, {
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.ts',
    // 只跑 src/test 下的单测：e2e/*.spec.ts 是 Playwright 用例，
    // 若被 vitest 扫到会因为 test.beforeEach() 不在其上下文中直接报错
    include: ['src/test/**/*.test.{ts,tsx}'],
    css: true,
    // 占位值：仅让 supabase.ts 模块加载时不 warn，测试不发起任何网络请求
    env: {
      VITE_SUPABASE_URL: 'https://test.supabase.co',
      VITE_SUPABASE_ANON_KEY: 'test-anon-key',
    },
  },
})
