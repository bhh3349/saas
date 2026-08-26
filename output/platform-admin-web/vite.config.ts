import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import type { Plugin } from 'vite'
import vue from '@vitejs/plugin-vue'
import viteCompressionPkg from 'vite-plugin-compression'

// 该插件为 CJS 风格类型声明，nodenext 下 default 导入类型无法直接调用，此处断言兼容（运行时由 esbuild 正确处理）
const viteCompression = viteCompressionPkg as unknown as (options?: {
  verbose?: boolean
  threshold?: number
}) => Plugin

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    // gzip 预压缩：产物直接产出 .gz，配合静态托管/nginx 使用，免去服务器实时压缩
    viteCompression({ threshold: 1024 }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    proxy: {
      // 平台端后端：NestJS 3100
      '/api': { target: 'http://127.0.0.1:3100', changeOrigin: true },
      '/auth': { target: 'http://127.0.0.1:3100', changeOrigin: true },
      '/admin': { target: 'http://127.0.0.1:3100', changeOrigin: true },
    },
  },
  build: {
    rollupOptions: {
      output: {
        // vendor 拆分：vue 生态独立 chunk，利于浏览器长期缓存
        manualChunks(id: string) {
          if (!id.includes('node_modules')) return
          const m = id.match(/node_modules\/(?:@[^/]+\/)?[^/]+/)
          if (!m) return
          const pkg = m[0].replace('node_modules/', '')
          if (pkg === 'vue' || pkg === 'vue-router' || pkg === 'pinia') {
            return 'vue-vendor'
          }
        },
      },
    },
  },
})
