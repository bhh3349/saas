# 食刻商户后台（merchant-web）性能优化报告

> 优化时间：2026-08-24 ｜ 执行：鹏城信息AI专家（前端性能优化）
> 原则：证据优先——所有结论均来自构建产物实测（sourcemap 体积归因），非推测。

---

## 一、优化前后核心指标对比（实测）

| 指标 | 优化前 | 优化后 | 变化 |
|---|---|---|---|
| 主 JS（首屏框架） | 1,273.16 kB（gzip **401.63 kB** 单文件） | 47.66 kB（gzip **16.29 kB**） | **-96%** |
| 首屏总传输（JS+CSS，gzip） | ≈ 416.9 kB | ≈ 218.9 kB | **-47.5%** |
| xlsx（导出/导入用） | 打进首屏 875 kB 源码（gzip ≈143 kB） | 独立 chunk 429.03 kB，**按需加载** | 移出首屏 |
| 页面代码 | 19 个页面全部打进首屏（src 555 kB） | 每个页面独立 chunk（2~44 kB），**打开才加载** | 按需 |
| 构建产物 chunk 数 | 2 个（1 JS + 1 CSS） | 30 个（29 JS + 1 CSS） | 代码分割 |
| 构建时间 | 5.46 s | 4.22 s | **-23%** |
| gzip 预压缩 | 无 | 全量 .gz 产物（25 个文件） | 新增 |
| Google Fonts 外链 | 4 个字体家族（渲染阻塞） | 已移除，系统字体栈 | 阻塞消除 |

---

## 二、根因与优化点清单（按影响排序）

### 1.【CRITICAL】xlsx 全量打入首屏
- **证据**：sourcemap 归因 xlsx 占 bundle 源码 **875 kB / 32.1%**；`TableManage.tsx:2`、`BatchImportTableModal.tsx:2` 静态 `import * as XLSX from 'xlsx'`。
- **改法**：新建 `src/utils/excel.ts` 统一封装（内部 `import('xlsx')` 懒加载，全局单例），业务文件改为调用 `exportAoaToXlsx()` / `readXlsxToAoa()`；同时移除两处静态导入。
- **收益**：首屏不再携带 xlsx（gzip ≈143 kB），仅点击「导出/导入/下载模板」时加载一次。
- **扩展**：后续菜品导入导出、报表导出直接复用 `src/utils/excel.ts`，xlsx chunk 浏览器只下载一次、全站共享。

### 2.【HIGH】19 个页面无代码分割
- **证据**：`App.tsx:5-23` 静态导入全部 views；src 项目代码 555 kB 全部进首屏。
- **改法**：`App.tsx` 改为 `React.lazy(() => import('./views/XXX'))` × 18 + 静态保留登录页 `AuthScreen`（首屏必经），页面区包 `<Suspense fallback={<PageFallback />}>`，新增 `.page-loading` 占位样式。
- **收益**：首屏只加载框架 + 当前页；登录后首页 OpsHome 仅 3.22 kB（gzip 1.34 kB）。

### 3.【HIGH】生产环境外链 Google Fonts（渲染阻塞）
- **证据**：`index.html` 加载 Space Grotesk / Inter / Inter Tight / Noto Sans SC 四族字体；且为国内网络环境，Google 域名常不可达导致挂起阻塞。
- **改法**：移除 `index.html` 全部字体外链；`global.css:54-55` 字体变量改为标准系统字体栈（`-apple-system / Segoe UI / PingFang SC / Microsoft YaHei / Arial`）。
- **收益**：消除渲染阻塞的外部请求，中文字体仍由系统渲染（PingFang SC / 微软雅黑）。

### 4.【MEDIUM】无 vendor 拆分与预压缩
- **证据**：`vite.config.ts` 无任何 `build.rollupOptions` 配置；产物仅 2 个文件。
- **改法**：
  - `manualChunks` 拆分：`react-vendor`（react/react-dom/scheduler）、`antd-vendor`（antd + @ant-design + @rc-component 等）、`dayjs` 独立 chunk——高频复用的 vendor 单独缓存，业务更新不影响缓存命中；
  - 引入 `vite-plugin-compression`（devDependency），构建产出全量 `.gz` 预压缩（nginx/静态托管直接使用，免服务器实时压缩）。
- **收益**：缓存友好 + 服务器零压缩开销。

---

## 三、改动文件清单

| 文件 | 改动 |
|---|---|
| `src/utils/excel.ts` | **新增**：xlsx 懒加载封装（单例 + 导出/读取工具），后续功能复用入口 |
| `src/views/TableManage.tsx` | 移除 `import * as XLSX`，导出逻辑改用 `exportAoaToXlsx` |
| `src/components/BatchImportTableModal.tsx` | 移除 `import * as XLSX`，模板下载/解析改用工具封装 |
| `src/App.tsx` | 18 个页面改 `React.lazy`，页面区包 `Suspense` + `PageFallback` |
| `index.html` | 移除 Google Fonts 4 族外链 |
| `src/styles/global.css` | 字体变量改系统字体栈；新增 `.page-loading` 样式 |
| `vite.config.ts` | `manualChunks` vendor 拆分 + `vite-plugin-compression` 预压缩 |
| `package.json` / `package-lock.json` | 新增 devDependency：`vite-plugin-compression` |

## 四、验证结果

- ✅ `npx vite build` 构建通过（4.22~4.32 s，无 warning）
- ✅ 产物 29 个 JS chunk 落位正确，`.gz` 预压缩 25 个文件全部生成
- ✅ `dist/index.html`：字体外链已移除，框架所需 chunk 已 `modulepreload`，无 500 kB 超限警告
- ✅ 改动文件均通过 `tsc` 类型检查（无新增类型错误）
- ✅ 开发服务器已自动重启并加载新配置（Vite 监听 `vite.config.ts` 变更）

## 五、待办与注意事项（非本次范围）

1. **【已解决】布局不能自适应窗口**（TECH-STACK.md 重点问题）：`useCanvasScale` 改为 `scale = Math.min(innerWidth/width, 1)`（永不放大）+ `.app` 的 `overflow: hidden` 改为 `auto` 兜底滚动。2560×1080 视口下之前登录卡底部被裁 180px 且无滚动条，现在 scale=1 完整可见。1366×768 仍可缩小完整显示且能滚动。实测三种视口全部通过（2560×1080 / 2560×1440 / 1366×768）。
2. **【既有问题，非本次引入】** `npm run build` 中的 `tsc -b` 会因 `src/views/DiscountManage.tsx` 的 **11 个既有类型错误**（`Activity` 类型缺 `reduceRules` / `scanOrderEffective` / `stopped` / `excludeDishes` 字段，121/145/174/197/530 等行）失败。当前请用 `npx vite build` 构建；建议后续单独修复该文件类型错误，恢复 `npm run build` 全流程。
3. **后端未运行**：dev 代理 `/auth/login → 127.0.0.1:3200` 当前 ECONNREFUSED（saas-service 未启动），登录功能联调需先启动后端。
4. **首屏可继续优化（可选）**：`antd-vendor` 399.84 kB（gzip 134.41 kB）来自 antd 核心 + 日期选择器体系，由 `main.tsx` 的 `ConfigProvider` 全局包裹所致。若未来将 `ConfigProvider` 移出全局（仅在用到的页面包裹），可再省部分；或评估 `@ant-design/cssinjs` 运行时样式注入的替代方案。

## 六、后续行动清单（可直接执行）

1. `npx vite build` 构建，将 `dist/` 部署到静态托管/nginx（已含 .gz 预压缩，nginx 配置 `gzip_static on;` 即可生效）。
2. 单独安排一次 DiscountManage 类型修复（范围外）。
3. 新增导入导出功能时，一律走 `src/utils/excel.ts`，勿再静态 `import 'xlsx'`。
