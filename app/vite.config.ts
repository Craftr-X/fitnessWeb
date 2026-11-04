import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"
import { inspectAttr } from 'kimi-plugin-inspect-react'

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  base: './',
  // kimi 的 inspect 插件只在 dev 生效：生产构建里它会给每个 JSX 元素塞一个 code-path 属性，
  // 既让包变大，也把源码文件路径/行号泄漏到线上 DOM 里。
  plugins: [command === 'serve' ? inspectAttr() : null, react()],
  server: {
    port: 3000,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    // 拆分重型第三方库为独立 chunk：与主包并行加载、独立长缓存。
    // 注意：这里不要给 recharts 单独分包——对象式 manualChunks 会让它变成入口的静态依赖，
    // Vite 会在 index.html 里加 modulepreload，导致登录页就预下载 106KB(gzip) 的图表库。
    // 让它跟着 BodyData 这个懒加载 chunk 走，只有点开「数据」页才下载。
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router'],
          supabase: ['@supabase/supabase-js'],
        },
      },
    },
  },
}));
