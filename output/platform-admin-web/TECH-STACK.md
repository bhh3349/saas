# 收银云平台后台（platform-admin-web）技术栈说明

> 用途：交接给 UI 审计使用，便于理解项目架构、依赖与布局现状。
> 更新时间：2026-08-24

## 一、核心技术栈

| 项 | 选型 | 版本 |
|---|---|---|
| 框架 | **Vue 3**（`<script setup>` 组合式 API） | 3.5.40 |
| 语言 | TypeScript | ~6.0.2 |
| 构建 | Vite | 8.2.0 |
| 路由 | **Vue Router 4**（HTML5 history 模式） | 4.6.4 |
| 状态管理 | **Pinia**（setup store 写法） | 4.0.3 |
| UI 组件库 | **无**（纯手写 CSS，antd 等均未引入） | — |
| 样式 | 单一 `src/style.css`（约 506 行），内联 SVG 图标 | — |
| 测试/截图 | Playwright（devDependency，用于页面截图验证） | 1.62.1 |

## 二、架构特点

### 1. 布局方式（与 merchant-web 完全不同）

- **没有固定设计稿画布缩放**，没有 `transform: scale` 逻辑；
- 采用普通流式布局：`AppView.vue` 中 `sidebar`（固定侧栏）+ `main`（topbar + content）的 flex 布局；
- 代码中未发现响应式断点（无媒体查询/栅格体系），小窗口下的表现需 UI 审计重点确认。

### 2. 路由（官方 Vue Router，非自研）

`src/router/index.ts`：

- **history 模式**（`createWebHistory`），非 hash；
- 路由懒加载：`() => import('@/views/XXX.vue')`；
- 路由结构：
  | 路径 | 视图 | 说明 |
  |---|---|---|
  | `/login` | `LoginView.vue` | 登录页 |
  | `/` | `AppView.vue` | 主框架壳（侧栏 + 顶栏 + 个人信息弹窗） |
  | `/` → `/codes` | 重定向 | 默认进激活码管理 |
  | `/codes` | `CodesView.vue` | 激活码管理 |
  | `/shops` | `ShopsView.vue` | 店铺管理 |
- 全局前置守卫 `beforeEach`：未登录强制跳 `/login`；已登录访问 `/login` 跳 `/codes`。

### 3. 状态管理（Pinia）

`src/stores/auth.ts`：`useAuthStore`（setup 写法），管理 `token` / `operator`（运营账号信息），含 `login / setOperator / logout`。token 与用户信息持久化在 localStorage。

### 4. 数据层

- `src/api/http.ts`：fetch 封装（`request<T>()`），支持 query 拼接、JSON body、原始 blob（导出 CSV）；
- 鉴权：`Authorization: Bearer <token>`；
- 统一响应结构 `ApiResult { code, message, data }`，`code !== 0` 抛 `ApiError`；
- 401 自动清 token 并跳 `/login`；
- localStorage keys：`platform_admin_token` / `platform_admin_user`；
- 接口文件：`auth.ts`（登录/资料/改密）、`codes.ts`（激活码 CRUD + CSV 导出）、`shops.ts`（店铺管理）、`types.ts`（类型定义）。

### 5. 后端对接

Vite dev 代理（`vite.config.ts`）：

| 前缀 | 目标 |
|---|---|
| `/auth` | `http://127.0.0.1:3100`（NestJS platform-service） |
| `/admin` | `http://127.0.0.1:3100` |

## 三、目录结构

```
platform-admin-web/
├── index.html
├── vite.config.ts        # 端口 5173，/auth、/admin 代理到 3100
├── tsconfig.json / app / node
├── public/
├── screenshots/          # Playwright 截图（11 张 PNG）
└── src/
    ├── main.ts           # createApp + Pinia + Router + style.css
    ├── App.vue           # RouterView + 全局 toast
    ├── style.css         # 全部样式（约 506 行，无 CSS 变量主题体系）
    ├── api/              # http/auth/codes/shops/types
    ├── composables/      # useToast.ts（全局 toast 状态）
    ├── router/index.ts   # 路由表 + 登录守卫
    ├── stores/auth.ts    # Pinia 登录态
    ├── utils/format.ts
    └── views/            # LoginView / AppView / CodesView / ShopsView
```

## 四、Views 清单

| 路由 | 文件 | 职责 |
|---|---|---|
| `/login` | `LoginView.vue` | 登录 |
| `/` | `AppView.vue` | 主框架：侧栏导航（激活码/店铺）、顶栏（导出按钮、用户菜单）、个人信息弹窗（改用户名/头像/密码） |
| `/codes` | `CodesView.vue` | 激活码管理 |
| `/shops` | `ShopsView.vue` | 店铺管理 |

## 五、与 merchant-web（商家后台）的关键差异

| 维度 | 平台后台 platform-admin-web | 商家后台 merchant-web |
|---|---|---|
| 框架 | Vue 3 + Pinia + Vue Router | React 18 + antd 6 + 自研 hash 路由 |
| UI 组件库 | 无，纯手写 CSS | antd 6.6 + 手写 CSS（global.css 5576 行） |
| 布局 | 流式布局，无固定画布缩放 | 固定 1600×900 画布 `transform: scale` 等比缩放 |
| 主题 | 无主题切换 | dark/light 双主题（CSS 变量） |
| 路由模式 | history（懒加载） | hash + 多页签（自研） |
| 页面数 | 4 | 19 |
| 后端 | NestJS platform-service :3100 | saas-service :3200 |
| 构建优化 | 无 manualChunks / 无压缩 | 已做 vendor 拆分 + gzip 预压缩 |

## 六、已知现状与建议审计重点

1. **响应式/滚动**：无媒体查询，窄窗口下侧栏与内容区可能挤压、表格无横向滚动策略，需 UI 审计确认；
2. **样式集中**：全部样式在 `style.css`（506 行），类名全局共享，改动需注意耦合；
3. **无构建优化**：`vite.config.ts` 仅 `vue()` 插件，未做 chunk 拆分与压缩（页面量小，当前影响有限）；
4. **登录与导出**：无验证码；激活码导出走 `exportCodesApi`（raw blob + CSV）。
