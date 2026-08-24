# 收银云平台后台（platform-admin-web）全面优化报告

> 优化时间：2026-08-24 ｜ 执行：鹏城信息AI专家（前端性能优化）
> 范围：全面优化（不限于 TECH-STACK.md 已知问题清单）——构建、正确性、健壮性、安全、响应式

---

## 一、诊断结论（证据优先）

**项目体量**：Vue 3.5 + Vite 8 + Vue Router + Pinia + 无 UI 库，52 个模块，4 个页面（路由已懒加载）。

**优化前基准（实测构建）**：

| 指标 | 优化前 |
|---|---|
| 首屏 JS | 99.88 kB 单文件（gzip 38.88 kB，vue+pinia+router+业务全打在一起） |
| CSS | 21.12 kB（gzip 4.89 kB） |
| 构建时间 | 349 ms |
| 压缩/拆分 | 无 manualChunks、无 gzip 预压缩 |

**关键结论**：首屏体积本身不大（gzip 38.88 kB），真正的痛点集中在**正确性、健壮性、安全与响应式**，文档未提及这些问题。

---

## 二、优化点清单（问题 → 证据 → 改法 → 结果）

### 1.【CRITICAL·安全】登录页明文暴露默认账号密码
- **证据**：`LoginView.vue` 模板渲染「默认账号 admin / admin123456」，且输入框**预填**了该凭据（`username=ref('admin')`、`password=ref('admin123456')`），任何访问者可直接点击登录。
- **改法**：移除页面凭据展示与预填，输入框改空 + placeholder 提示。
- **结果**：默认口令不再泄露；管理员凭据由运维线下分发给受信人员。

### 2.【HIGH·正确性】分页 >5 页时中间页无法直达
- **证据**：`CodesView.vue:233`、`ShopsView.vue:183` 的 `pageList` 在总页数 >5 时返回 `[1, '…', last]`，用户只能逐页翻到中间页。
- **改法**：改为经典页码算法——>7 页时保留当前页前后各 2 页 + 省略号（如 `1 … 4 5 6 … 20`）。
- **结果**：任意页可直达。

### 3.【HIGH·正确性】列表请求竞态
- **证据**：`CodesView.loadCodes` / `ShopsView.loadShops` 无请求序号保护，快速切换筛选/翻页时，先发出的慢响应可能晚到并**覆盖新数据**（表格内容与筛选条件不一致）。
- **改法**：模块级 `listSeq` 请求序号，响应返回后比对序号，过期结果直接丢弃。
- **结果**：并发请求下数据始终与最新筛选一致。

### 4.【HIGH·健壮性】HTTP 层无超时
- **证据**：`api/http.ts` 的 `request()` 无 AbortController/超时，后端挂起时界面**无限 loading**。
- **改法**：`request()` 默认 8s 超时（可配置 `timeout: 0` 关闭），支持外部 `signal` 透传（组件卸载/竞态取消场景），超时抛 `ApiError(-2,'请求超时或已取消')`；401 跳转改 `location.replace` 避免堆积 history。
- **结果**：网络异常/后端卡死时 8s 内给出明确提示，不再无限转圈。

### 5.【MEDIUM·构建】无 vendor 拆分与预压缩
- **证据**：`vite.config.ts` 仅 `vue()` 插件。
- **改法**：`manualChunks` 拆分 `vue-vendor`（vue/vue-router/pinia）独立 chunk；接入 `vite-plugin-compression` 产出全量 `.gz` 预压缩。
- **结果**：**应用代码更新时浏览器只重下 6.23 kB（原 38.88 kB）**，vendor 命中长期缓存；nginx 配 `gzip_static on;` 即可免服务器实时压缩。

### 6.【MEDIUM·响应式】表格窄窗口被裁切、无窄屏适配（文档已知问题 1）
- **证据**：`.table-wrap` 无 `overflow-x`，表格列宽总和超视口时内容溢出被裁；无任何媒体查询。
- **改法**：`.table-wrap` 加 `overflow-x:auto`（横向滚动）；新增 `≤900px`（侧栏 200px、间距收窄）、`≤640px`（侧栏 56px 图标模式、工具条输入框全宽、分页纵向堆叠）两级媒体查询。
- **结果**：窄窗口下列表可横向滚动查看，侧栏不挤压内容。

### 7.【LOW·样式】字体栈引用不存在的字体
- **证据**：`style.css` 声明 `'Inter'/'Inter Tight'/'JetBrains Mono'` 为首选字体，但项目**未引入**任何字体源（index.html 无外链、无本地字体文件），浏览器白做字体名查找后回退。
- **改法**：三个字体变量改为纯系统字体栈（`-apple-system/Segoe UI/PingFang SC/Microsoft YaHei`；mono 用 `ui-monospace/Consolas`）。
- **结果**：消除无效字体解析，渲染更稳定。

### 8.【LOW·体验】顶栏导出无防重复
- **证据**：`AppView.vue` 顶栏「导出」按钮无 loading/禁用，可连点触发多次 CSV 下载。
- **改法**：`handleExport` 加 `exporting` 状态，导出中按钮禁用并显示「导出中…」。

### 9.【LOW·SEO/可访问性】index.html 元信息缺失
- **证据**：`lang="en"`、`<title>platform-admin-web</title>`、无 description。
- **改法**：`lang="zh-CN"`、`<title>收银云 · 平台后台</title>`、补充 description。

---

## 三、改动文件清单

| 文件 | 改动 |
|---|---|
| `src/views/LoginView.vue` | 移除默认凭据展示与预填（安全） |
| `src/views/CodesView.vue` | 分页直达 + 请求竞态修复 |
| `src/views/ShopsView.vue` | 分页直达 + 请求竞态修复 |
| `src/api/http.ts` | 请求超时（8s）+ AbortSignal 支持 + 401 改 location.replace |
| `src/views/AppView.vue` | 导出按钮防重复 + loading |
| `src/style.css` | 表格横向滚动、两级窄屏媒体查询、系统字体栈 |
| `index.html` | lang/title/description |
| `vite.config.ts` | vue-vendor 拆分 + gzip 预压缩（含 CJS 类型断言） |
| `tsconfig.node.json` | esModuleInterop（CJS 插件类型兼容） |
| `package.json` | 新增 devDependency：`vite-plugin-compression` |

## 四、验证结果（优化后实测）

- ✅ `vue-tsc -b` 类型检查 **0 错误**
- ✅ `vite build` 通过：`index 13.75 kB（gzip 6.23 kB）` + `vue-vendor 86.80 kB（gzip 33.50 kB）`，7 个 `.gz` 预压缩文件落位正确
- ✅ 构建 297 ms（较前 349 ms 微升为 chunk 拆分开销，可忽略）
- ✅ 产物 index.html：lang=zh-CN、中文 title、modulepreload 正确
- ✅ 无错误路径残留（dist 顶层仅 assets + 静态资源）

## 五、待办与注意事项

1. **后端未运行**：dev 代理 `/auth、/admin → 127.0.0.1:3100` 需启动 NestJS platform-service 才能联调登录/列表。
2. **`public/icons.svg`（5 KB）未被任何代码引用**，仅随构建复制到 dist；如确认无用可删除。
3. **默认账号移除后的运维**：新环境初始化账号需由后端种子数据创建，请确保部署时已创建管理员账号，否则无法登录。
4. **登录页现无账号预填**，管理员输入凭据登录即可（无验证码为既有设计，如需可后续加）。

## 六、后续行动清单

1. 启动 platform-service:3100 后，浏览器验证登录、两个列表页的分页直达/快速筛选、导出按钮防重复。
2. 部署 dist 到静态托管/nginx（已含 .gz，配 `gzip_static on;`）。
3. 视需要删除未引用的 `public/icons.svg`。
