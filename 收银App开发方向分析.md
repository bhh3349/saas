# 收银 App 开发方向分析

> 目的：盘点商家平台当前开发详情，明确收银 App 的产品定位、技术选型、页面规划、接口依赖与开发路径。
> 编写时间：2026-08-26（信息采集于代码现状）

---

## 一、商家平台现状盘点

### 1.1 系统整体架构

| 端 | 项目 | 技术栈 | 状态 |
|---|---|---|---|
| 平台管理后台 | `frontend/`（platform-admin-web） | Vue 3 + TS | 已部署上线 |
| 商家后台 Web | `merchant-web/` | React 18 + TS + antd 6 | 本地开发中，暂不部署 |
| 后端服务 | `output/saas-service/` | NestJS + TypeORM + better-sqlite3 | 代码完整，服务器/本地均未运行 |
| 收银 App | —— | 待开发（uni-app x） | 缺口，即本文分析对象 |

数据链路：**收银端（产生订单/结账数据）→ saas-service（多租户业务库）→ 商家后台 Web 与报表中心（管理 + 看账）**。当前缺的是最上游的"数据生产端"。

### 1.2 商家后台 Web（merchant-web）

- 入口 `src/App.tsx` + `src/data/navigation.ts` 两级菜单（运营中心 / 报表中心），Vite 开发端口 5175，代理 `/admin`、`/reports` 到后端。
- **运营中心页面（15 项）**：首页、桌台管理、结账方式管理、券类管理、优惠折扣、档口管理、票据样式、打印设置、打印分配、必点菜设置、营业模式设置、菜品库、菜单分类、菜品属性、门店档案、角色档案、员工档案、设备监控、运行日志（部分页面已建/部分为占位）。
- **报表中心页面（14 项）**：综合营业统计、促销活动统计、餐区/桌台营业统计、营业指标同环比、菜品销售统计、菜品优惠统计、菜品销售明细、退菜统计、店内订单明细、敏感操作统计、菜品敏感操作明细、收入优惠统计、券收入统计、收入优惠明细。
- **API 封装（11 个文件）**：`http.ts`（统一 `{code,message,data}` 拦截 + token）、`auth.ts`、`dishes.ts`、`categories.ts`、`attributes.ts`、`tables.ts`、`areas.ts`、`setmeals.ts`、`buckets.ts`（券/折扣）、`reports.ts`、`types.ts`。
- 编译状态：`tsc --noEmit` 0 错误。git 有未提交改动：菜品库、批量导入组件、报表中心（`components/report/`、`views/reports/`、`api/reports.ts`）。

### 1.3 后端服务（saas-service）

- NestJS + TypeORM（better-sqlite3）+ JWT + bcryptjs，监听 3200，跨服务对接平台端 `/internal/*`（激活码开店等）。
- **认证与角色**：`/auth/register`（激活码注册新店铺，自动建老板账号 + 默认桌台 + 现金/微信/支付宝三种结账方式）、`/auth/login`（返回 `{token, user:{id, shop_id, phone, name, role, shopName}}`）、`/auth/forgot-password`、`/auth/me`。JWT 携带 `userId / shopId / role`。
- 三种固定角色：`boss`（工作台 + 后台管理 + Web 全量）、`cashier`（仅收银工作台）、`finance`（仅看账，`/reports/*` 只读）。
- **业务模块（controller）13 个**：auth、orders、payments、tables、areas、dishes、categories、attributes、setmeals、staff、buckets（优惠券/折扣）、internal（供平台端）、reports。
- **数据实体 13 个**：order、order-refund、dish、category、attribute、setmeal、table、area、payment-method、user、shop、shop-bucket、operation-log。

#### 订单核心模型（收银 App 最重要契约）

| 维度 | 约定 |
|---|---|
| 状态机 | `pending`（待接单/制作中）→ `confirmed`（已接单）→ `completed`（已结账）；`on_account`（挂账，可补收 → completed）；`void`（拒单/作废） |
| 点餐模式 | `table` 桌台模式（必须选空闲桌台，下单即占用）、`ticket` 叫号模式（当日取餐号） |
| 金额 | 数据库存「分」（整数），API 出入参用「元」；**金额由服务端按菜品+规格重算，客户端只传 dish_id + qty**（防篡改） |
| 明细 | `items` 为 JSON 快照 `[{dish_id, name, spec_name, unit_price, qty, amount}]` |
| 优惠 | `discount_amount` + `discount_type`（discount 折扣 / voucher 优惠券 / price_change 改价 / free 免单）+ `discount_name` 快照 + `voucher_id` |
| 结账 | `payment_method_id/name` 快照、`paid_amount` 实收、`change_amount` 找零、`settled_at`（看账统计口径）、`remark` |
| 订单号 | `YYYYMMDD-序号`（当日自增），叫号模式 `ticket_no` 当日取餐号 |

#### 报表中心能力（`/reports/*`，仅 boss / finance）

11 个接口：`today`（今日概览）、`summary`、`dish-sales`、`dish-detail`、`table-stats`、`compare`（同环比）、`promo-stats`（促销活动）、`orders`（订单明细）、`dish-discount`、`dish-refund`、`sensitive-stats` / `sensitive-detail`（敏感操作，基于 operation-log）、`income-discount`、`income-coupon`、`income-discount-detail`。

**报表全部是对真实订单/退菜/操作日志的聚合**——数据源头就是收银行为。

### 1.4 现状结论

1. 商家后台 Web 前端基本成型、后端接口能力完整，**但报表中心没有真实数据可看**（目前主要是种子/演示数据）。
2. 缺一个**持续产生真实业务数据的收银端**——这正是收银 App 的定位。
3. 后端已有 `staff` 模块（员工增删改 + 角色分配），可支撑"给收银员开账号"的闭环。

---

## 二、收银 App 开发方向

### 2.1 产品定位

按 PRD 5.3：收银 App 是餐饮门店**每日经营操作的核心入口**（开台/点餐/接单/结账/看账），区别于商家后台 Web 的"管理 + 分析"定位。角色权限直接复用后端三角色：

- `boss`：收银工作台 + App 内后台管理（菜品/桌台/结账方式/员工）
- `cashier`：仅收银工作台（收银员，通过 boss 创建账号）
- `finance`：仅当日/区间看账

**核心价值**：App 产生的真实订单流 → saas-service → 商家后台报表中心全部报表直接可用，形成"生产 → 统计 → 分析"闭环，解决当前"无真实数据测试报表"的痛点。

### 2.2 技术选型

| 项 | 选择 | 理由 |
|---|---|---|
| 框架 | uni-app x（uts 语言，原生渲染） | 一套代码 Android/iOS 双端；符合项目既有 skill 规范 |
| 网络 | `uni.request` + 统一封装 | 对接 saas-service 3200 端口，契约与 merchant-web 一致（`{code,message,data}` + Bearer token） |
| 状态 | 全局内存 Store + `uni.setStorageSync` 持久化 token/登录态 | 页面级简单场景为主 |
| 复用 | 不复用 merchant-web 代码（React ≠ uts），**复用接口契约、枚举、金额规则** | 两端同源契约，避免口径不一致 |

### 2.3 MVP 页面规划（以"能真实产生数据"为第一目标）

| # | 页面 | 要点 | 角色 |
|---|---|---|---|
| 1 | 登录 | 手机号+密码；记住店铺名；退出 | 全部 |
| 2 | 注册 | 激活码 / 手机号 / 密码 / 店铺名 / 地址 → 自动建默认桌台与结账方式 | 新店铺 |
| 3 | 收银工作台 | 顶部今日概览（`/reports/today` 营业额/单量/优惠）；Tab：桌台 / 叫号 / 订单 | 全部 |
| 4 | 点餐下单 | 左侧分类 + 菜品宫格；选规格/数量；购物车侧栏；桌台模式选桌 / 叫号模式自动取号 | boss/cashier |
| 5 | 接单 / 看单 | 订单流列表（pending/confirmed）；接单、拒单（作废） | boss/cashier |
| 6 | 结账 | 结账方式选择（`/payments`）、改价/折扣、免单、挂账；实收/找零；打印口预留 | boss/cashier |
| 7 | 老板后台 | 菜品管理（增改/上下架/沽清）、桌台管理、结账方式管理、员工账号（复用 staff 模块） | boss |
| 8 | 当日营业 | 今日营业额、单量、客单、优惠、退菜（读 `/reports/today` + `summary`） | boss/finance |
| 9 | 我的 | 用户信息、角色、切换登录、版本 | 全部 |

**一期不做**（列为二期）：叫号屏/取餐叫号、报表全量明细页、打印对接、多屏联动、收银小票模板。

### 2.4 关键接口对接清单

| 用途 | 方法 | 路径 | 关键字段 / 约束 |
|---|---|---|---|
| 登录 | POST | `/auth/login` | `{phone,password}` → `{token,user}` |
| 注册 | POST | `/auth/register` | 激活码 / 手机号 / 密码 / 店铺名 / 地址 |
| 修改密码 | POST | `/auth/forgot-password` | — |
| 今日概览 | GET | `/reports/today` | 工作台顶部数据 |
| 桌台列表 | GET | `/tables` | 状态 idle/occupied，用于开台 |
| 点餐菜单 | GET | `/dishes/menu` | 分类 + 在售菜品 + 规格 |
| 下单 | POST | `/orders` | `{mode, table_id?, items:[{dish_id,qty,spec_name?}]}`，金额服务端算 |
| 订单流 | GET | `/orders` | 按状态筛选 |
| 接单 | POST | `/orders/:id/confirm` | pending → confirmed |
| 拒单 | POST | `/orders/:id/reject` | → void |
| 结账 | POST | `/orders/:id/settle` | 结账方式、实收/找零、优惠、挂账判定 |
| 免单 | POST | `/orders/:id/free` | discount_type=free |
| 挂账 | POST | `/orders/:id/on-account` | → on_account，可补收 |
| 退菜 | POST | `/orders/:id/refund` | 记录 operation-log（敏感操作报表数据源） |
| 结账方式 | GET | `/payments` | 结账页选择 |
| 员工管理 | GET/POST/PATCH | `/staff/*` | boss 创建收银员账号 |
| 菜品管理 | GET/POST/PATCH | `/dishes/*` | boss 后台 |

### 2.5 与 Web 商家后台的分工

| 端 | 职责 | 数据流向 |
|---|---|---|
| 收银 App | 产生数据：开台、点餐、接单、结账、免单、挂账、退菜 | 写 |
| 商家后台 Web | 管理 + 分析：菜品/券/折扣/打印/营业模式配置，报表中心 14 页 | 读为主 + 少量写 |
| saas-service | 统一数据模型与业务规则（状态机、金额分/元、多租户） | 承载 |

### 2.6 环境前提与开发路径

**当前本机环境**（已核实）：
- 未检测到 HBuilderX（uni-app x 必需工具链）、未检测到 adb（Android 环境）；
- saas-service 未在本地运行（3200 未监听）。

**路径 A —— 立即验证闭环（零成本，建议先做）**：
1. 本地启动 saas-service（`npm run start:dev`）；
2. 用 merchant-web 现有"收银/订单流"页面（若未建，则用接口脚本）完成注册店铺 → 开台 → 点餐 → 接单 → 结账；
3. 到报表中心 14 页验证真实数据。产出：确认报表口径正确 + 沉淀一份"造数据脚本"，供 App 联调用。

**路径 B —— 收银 App 开发（需先装环境）**：
1. 安装 HBuilderX（uni-app x 版），准备 Android 模拟器或真机（adb）；
2. HBuilderX 新建 uni-app x 工程 → 按 2.3 页面规划开发 → 真机/模拟器联调 saas-service；
3. 用 App 日常操作积累真实订单，持续验证报表。

**建议节奏**：先走 A（半天内让报表看到真实数据），同时安装 HBuilderX 并行启动 B。

### 2.7 里程碑建议

| 里程碑 | 内容 | 预估 |
|---|---|---|
| M0 | 本地起 saas-service + 用脚本/Web 造数据，报表中心全部有真实数据 | 0.5 天 |
| M1 | uni-app x 工程搭建 + 登录/注册 + 收银工作台（今日概览 + 桌台/叫号 Tab） | 0.5~1 天 |
| M2 | 点餐下单 + 接单/看单 + 结账（含免单/挂账/退菜）闭环 | 1~2 天 |
| M3 | 老板后台（菜品/桌台/结账方式/员工）+ 当日营业看板 | 1 天 |
| M4 | 真机联调、造数据、与商家后台报表对账验收 | 0.5~1 天 |

### 2.8 风险与待确认事项

1. **环境**：本机无 HBuilderX / Android 环境，App 无法在本机直接运行，需用户先安装（下载 HBuilderX 较大）。
2. **部署目标**：App 打正式包需云打包（DCloud 账号）或本地离线打包（Android SDK）；与"商家后台暂不部署"的策略独立，可先本地联调。
3. **数据一致性**：种子/演示数据与真实数据并存，报表验收时需区分；建议 M0 清理种子数据后以真实操作为准。
4. **接口缺口确认**：`staff` 模块的权限模型（boss 建收银员）与 App 登录是否已有对应入口需在 M3 前核对；`/dishes/menu` 与 Web 端 `dishes.ts` 的字段差异需在 M1 前对齐。
5. **金额与打印**：找零、改价、免单、挂账补收的 UI 交互需与服务端规则严格一致；打印接口后端未实现，一期仅预留。
