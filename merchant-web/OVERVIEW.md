# 食刻 · 商户后台（merchant-web）

本目录是从 Ardot 设计稿（fileId: 717221854071094）生成的商家后台 React + TypeScript 项目，包含登录注册五态页（S1–S5）与登录后主框架（S6–S9）。

## 技术栈

- **React 18.3** + **TypeScript 5.6**
- **Vite 5.4**
- **原生 CSS**（无 UI 库、无路由库）
- 设计稿画布尺寸：登录页 **1440×900**、主框架 **1600×900**；`useCanvasScale(width)` 按当前舞台宽度等比缩放

## 已实现内容

### 登录注册页（S1–S5，AuthScreen · 1440×900）

- **登录门控**：启动默认展示登录页（1440 舞台），登录成功后经 `onLogin` 切换至主框架（1600 舞台），双画布共用缩放逻辑
- **S1 登录**：品牌头（Logo +「餐饮收银 SaaS」/「商家管理后台」）+ 登录/注册 segmented Tab + 手机号/密码字段 + 忘记密码链接 + primary 登录按钮
- **S2 注册**（注册 Tab）：激活码（JetBrains Mono、示范值 ABC123、12 位格式错误示范）、店铺名称、店铺地址（选填）、手机号、老板姓名（选填）、登录密码、确认密码（不一致错误示范）、「注册并创建店铺」、协议提示
- **S3 忘记密码**（就地展开）：分割线 + 绑定手机号 + secondary「发送重置指引」+ 统一提示「如该手机号已注册，请联系客服重置密码」（不暴露账号）
- **S4 登录失败**：错误横幅「账号或密码错误，请重试」+ 保留输入
- **S5 角色拦截**：警告图标 +「无后台管理权限」+ 收银员/财务提示 +「返回登录」
- **演示交互**（无真实提交）：空值提交 → S4 错误横幅；手机号 `10000000000` → S5 角色拦截；其余非空 → 进入主框架；切换 Tab 重置错误态
- 登录/注册字段均为占位文案与设计稿示范值，无编造业务数据

### 框架交互

- 顶部一级 Tab 切换：**运营中心 / 报表中心**
- 左侧 72px 窄抽屉菜单：图标在上、文字在下、选中项亮黄底
- hover 带三级子菜单的抽屉项时，右侧弹出 Flyout 子菜单面板
- 24 个视图状态路由（内部 `useState` 派发），未实现页面显示占位框架

### 4 个主视图（按设计稿）

| 视图 | 路径 | 内容 |
|------|------|------|
| 首页 | `ops:home` | 4 个统计卡占位、当日订单表格框架 + 空态、快捷入口 8 宫格 |
| 桌台管理 | `ops:restaurant` | 桌台区域/桌台管理 Tab、区域筛选 pills、新增桌台按钮、桌台列表空态 |
| 营业概览 | `rpt:home` | 日/周/月 Tab、4 个统计卡、收入构成空态 |
| 综合营业统计 | `rpt:biz-stats` | 日期范围工具栏、营业明细表格空态 |

### 设计系统

- 16 色 Linear 暗色 token（见 `src/styles/global.css` `:root`）
- Inter / Inter Tight 字体
- 通用组件：`TopBar`、`Drawer`、`Flyout`、`StatCard`、`EmptyState`
- 复用样式类：`panel`、`pill-tab`、`filter-pill`、`btn`、`data-table`、`empty-state` 等

## 重要约束

用户明确要求后台只搭框架、**不填业务数据**，因此：

- 所有统计卡数值显示为「—」，不展示 trend/sub
- 所有表格仅保留表头 +「暂无数据」空态
- 不展示编造订单、桌台状态、营业额等数据

## 运行/构建

```bash
npm install
npm run dev      # 开发预览
npm run build    # 生产构建（已通过 tsc + vite build）
```

## 目录结构

```
merchant-web/
├── index.html
├── package.json
├── vite.config.ts
├── tsconfig*.json
└── src/
    ├── main.tsx
    ├── App.tsx          # 登录门控 + 双画布（1440 登录 / 1600 主框架）
    ├── vite-env.d.ts
    ├── styles/global.css
    ├── data/navigation.ts
    ├── components/
    │   ├── Icon.tsx
    │   ├── TopBar.tsx
    │   ├── Drawer.tsx
    │   ├── StatCard.tsx
    │   └── EmptyState.tsx
    ├── views/
    │   ├── AuthScreen.tsx   # 登录/注册/忘记密码/错误/拦截五态
    │   ├── OpsHome.tsx
    │   ├── TableManage.tsx
    │   ├── ReportHome.tsx
    │   ├── BizStats.tsx
    │   └── PlaceholderView.tsx
    └── assets/svg/      # 10 个轨道图标 + search + empty + 5 个登录页图标（brand-auth / phone / lock / eye / warn，Vite ?raw 内联）
```

## 后续接入建议

1. 将 `App.tsx` 内部状态路由替换为真实路由或菜单配置，连接后端 API。
2. 为其余 20 个占位页面补全业务表单/表格。
3. 将「全局搜索 / 日期选择 / 导出」等静态元素升级为真实交互组件。
4. 登录/注册接入 saas-service :3200 `/auth/*` 真实接口（当前为演示逻辑，无真实提交）。
