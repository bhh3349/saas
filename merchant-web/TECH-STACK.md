# 食刻商户后台（merchant-web）技术栈说明

> 用途：交接给 UI 审计使用，便于理解项目架构、依赖与已知布局问题。
> 更新时间：2026-08-24

## 一、核心技术栈

| 项 | 选型 | 版本 |
|---|---|---|
| 框架 | React | 18.3.1 |
| 语言 | TypeScript | ~5.6.2 |
| 构建 | Vite | 5.4.11 |
| UI 库 | Ant Design（`ConfigProvider` 中文包，未用组件级主题配置） | 6.6.1 |
| 日期 | dayjs（antd 内置依赖，已设 `zh-cn` locale） | 1.11.23 |
| 表格 | xlsx（桌台导入导出） | 0.18.5 |

## 二、需要重点关注的布局问题背景

### 1. 布局「不能自适应窗口」的根因

根因在 `src/App.tsx` 的 `useCanvasScale`：

- 页面按**固定设计稿画布 1600×900**（登录页 1440×900）绘制，运行时用 `transform: scale()` 整体等比缩放铺满视口；
- 窗口宽度 < 1600 时用 `contain`（缩小完整显示），窗口更大时 `cover` 放大；
- 设计稿本身固定 900 高度，**画布内没有滚动机制**，所以内容超出屏幕时无法滚动、无法显示。

### 2. 路由是自研 hash 路由（没有 React Router）

- `src/data/navigation.ts` 定义菜单/视图元数据（`ViewKey` 如 `ops:print:station`）；
- `App.tsx` 里 `viewKeyToHash` / `hashToViewKey` 做 `#/ops/...` ↔ 视图映射，监听 `hashchange`；
- 页面切换通过 `tabs` 状态渲染多页签 `tab-pane`，当前页才 `display:flex`；
- 导航状态全部持久化在 localStorage（当前视图、分组、页签列表）。

## 三、目录结构

```
src/
├── App.tsx            # 顶层：登录态、缩放画布、自研路由、多页签
├── main.tsx           # 入口：antd ConfigProvider + 主题预应用
├── theme.ts           # dark/light 主题（html[data-theme] + localStorage）
├── api/               # HTTP 封装与接口（http/auth/areas/tables/types）
├── components/        # 20 个通用组件（TopBar/Drawer/TabsBar/Modal/Toast/CommonSelect…）
├── data/navigation.ts # 菜单与页面元数据（唯一）
├── styles/global.css  # 单一全局样式表，约 5576 行
└── views/             # 19 个页面（OpsHome/TableManage/StallManage/DiscountManage…）
```

## 四、样式体系

- **单一 `global.css`（5576 行）**，原生 CSS 变量主题（`--color-*`、`--ctrl-radius` 等），无 CSS Modules / Tailwind / 预处理器；
- 主题切换：`html[data-theme="dark|light"]` 切换 CSS 变量，antd 未接入，样式全部手写；
- 布局类名多为全局类（`.page`、`.checkout-form-row`、`.stall-*` 等），跨页面复用。

## 五、数据层

- 部分页面（如档口管理 `StallManage`、打印分配 `PrintAssign`）**纯前端 localStorage 存储**（自增 `KEY_vN` 版本）；
- 其余走 HTTP：`src/api/http.ts` 封装 fetch，带 token；接口经 Vite proxy 转发到后端 `saas-service:3200` / `platform-service:3100`（`vite.config.ts` 中 `/auth`、`/admin/tables`、`/admin/areas`、`/tables`）。

## 六、Views 清单

| 视图 Key | 文件 |
|---|---|
| `ops:home` | `views/OpsHome.tsx` |
| `ops:restaurant:table` | `views/TableManage.tsx` |
| `ops:checkout` | `views/CheckoutManage.tsx` |
| `ops:checkout:coupon` | `views/VoucherManage.tsx` |
| `ops:checkout:discount` | `views/DiscountManage.tsx` |
| `ops:print:assign` | `views/PrintAssign.tsx` |
| `ops:print:station` | `views/StallManage.tsx` |
| `ops:business:must` | `views/MustDish.tsx` |
| `ops:business:mode` | `views/BusinessMode.tsx` |
| `ops:dish:library` | `views/DishLibrary.tsx` |
| `ops:dish:category` | `views/DishCategory.tsx` |
| `ops:dish:attribute` | `views/DishAttribute.tsx` |
| `ops:archive:store` | `views/StoreProfile.tsx` |
| `ops:archive:staff` | `views/StaffManage.tsx` |
| `ops:archive:role` | `views/RoleManage.tsx` |
| `rpt:home` | `views/ReportHome.tsx` |
| `rpt:biz-stats` | `views/BizStats.tsx` |
| —（登录页） | `views/AuthScreen.tsx` |
| —（占位页） | `views/PlaceholderView.tsx` |

## 七、Components 清单

`AddAreaModal / AddTableModal / BatchAddTableModal / BatchDeleteAreasModal / BatchDeleteTableModal / BatchImportTableModal / CommonSelect / ConfirmModal / DishPickerModal / Drawer / EditAreaModal / EmptyState / Icon / SearchForm / SortAreaModal / SortDishModal / StatCard / TabsBar / Toast / TopBar`

## 八、关键约定

- 设计稿尺寸：登录页 1440×900，主框架 1600×900（见 `App.tsx` 顶部常量）；
- 页面持久化 key：`merchant_current_view` / `merchant_current_group` / `merchant_current_page` / `merchant_current_tabs` / `merchant_theme`；
- 主题变量：`html[data-theme]` + `--color-*` CSS 变量（见 `src/theme.ts`、`src/styles/global.css`）。
