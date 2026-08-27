import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import viteCompression from 'vite-plugin-compression';

// 1600×900 设计稿画布 → 交给运行时等比缩放（见 src/App.tsx 的 useCanvasScale）
export default defineConfig({
  plugins: [
    react(),
    // gzip 预压缩：产物直接产出 .gz，配合静态托管/nginx 使用，免去服务器实时压缩
    viteCompression({ threshold: 1024 }),
  ],
  server: {
    port: 5175,
    open: true,
    proxy: {
      // 商家端后端：saas-service 3200（本地开发实例）
      // 全部 /admin/* 后台接口（tables/areas/dishes/categories/attributes/setmeals/...）统一转发
      '/auth': { target: 'http://127.0.0.1:3200', changeOrigin: true },
      '/admin': { target: 'http://127.0.0.1:3200', changeOrigin: true },
      '/tables': { target: 'http://127.0.0.1:3200', changeOrigin: true },
      // 报表中心（14 页）后端接口
      '/reports': { target: 'http://127.0.0.1:3200', changeOrigin: true },
    },
  },
  build: {
    rollupOptions: {
      output: {
        // vendor 拆分：react 系列独立 chunk（高频复用、利于长期缓存），
        // antd 及其底层组件体系独立 chunk（体积大、更新频率低）
        manualChunks(id: string) {
          if (!id.includes('node_modules')) return;
          const m = id.match(/node_modules\/(?:@[^/]+\/)?[^/]+/);
          if (!m) return;
          const pkg = m[0].replace('node_modules/', '');
          if (['react', 'react-dom', 'scheduler', 'react-is'].includes(pkg)) {
            return 'react-vendor';
          }
          if (
            pkg.startsWith('antd') ||
            pkg.startsWith('@ant-design') ||
            pkg.startsWith('@rc-component') ||
            pkg.startsWith('@emotion') ||
            ['stylis', 'is-mobile', 'clsx'].includes(pkg)
          ) {
            return 'antd-vendor';
          }
          if (pkg === 'dayjs') return 'dayjs';
        },
      },
    },
  },
});
