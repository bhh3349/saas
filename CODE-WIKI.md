# 餐饮收银 SaaS — Code Wiki

> 本文档为「餐饮收银 SaaS」项目仓库的结构化代码 Wiki，覆盖项目整体架构、主要模块职责、关键类与函数说明、依赖关系以及项目运行方式等关键信息。
> 仓库根目录：`d:\c\saas`
> 文档基线日期：2026-08-28

---

## 目录

- [一、项目总览](#一项目总览)
- [二、整体架构](#二整体架构)
- [三、仓库目录结构](#三仓库目录结构)
- [四、platform-service（平台端服务）](#四platform-service平台端服务)
- [五、saas-service（商家端服务）](#五saas-service商家端服务)
- [六、cashier-app（收银 App · uni-app x）](#六cashier-app收银-app--uni-app-x)
- [七、打印链路（printers + saas-printer）](#七打印链路printers--saas-printer)
- [八、跨服务协作与多租户隔离](#八跨服务协作与多租户隔离)
- [九、merchant-web（商家后台 Web · React）](#九merchant-web商家后台-web--react)
- [十、platform-admin-web（平台后台 Web · Vue3）](#十platform-admin-web平台后台-web--vue3)
- [十一、依赖关系总览](#十一依赖关系总览)
- [十二、部署与运行方式](#十二部署与运行方式)
- [十三、安全体系与关键约定](#十三安全体系与关键约定)

---

## 一、项目总览

餐饮收银 SaaS 是一套部署在云端的餐厅收银系统，一套云端服务服务多家餐厅，平台方自研激活码体系。产品按「多租户」理念设计与实现，按店铺严格隔离数据。

### 1.1 工程构成

| 工程 | 目录 | 端形态 | 使用方 | 核心模块 |
|---|---|---|---|---|
| **平台端服务** | `output/platform-service` | NestJS 后端 API | 公司运营人员 | 激活码管理、店铺主数据、内网接口 |
| **平台后台 Web** | `output/platform-admin-web` | Vue3 Web | 公司运营人员 | 激活码管理、店铺信息管理、品牌设置 |
| **商家端服务** | `output/saas-service` | NestJS 后端 API | 餐厅商家 | 账号、菜品、桌台、订单、结账、打印、设备、报表 |
| **商家后台 Web** | `merchant-web` | React Web | 商家老板 | 运营中心全量管理 + 报表中心 |
| **收银 App** | `cashier-app` | uni-app x 原生 App | 餐厅收银员/老板 | 收银工作台、桌台点餐、结账、打印 |
| **旧版静态页** | `frontend` | HTML 静态页 | — | 已被各 Web 工程替代（leagacy） |

> 历史上有过 `output/saas-admin-web`（Vue3 商家管理后台），当前仓库已**不再包含**该工程，商家管理职责统一交给 `merchant-web`。

### 1.2 核心原则

- **手机优先**：收银端所有操作面向触屏重做，交互简单直接
- **收银为核**：开台 / 点餐 / 接单 / 结账记账一条线走通
- **记账不收款**：结账 = 记账，不接支付通道
- **数据双保险**：云端主源 + 老板手机本地备份
- **多租户隔离**：所有业务表带 `shop_id`，后端按 JWT 强制隔离，任何接口不得跨店访问

### 1.3 角色权限（商家端固定三种，不开放自定义）

| 角色 | 权限范围 |
|---|---|
| **老板（boss）** | 收银工作台 + App 后台管理 + 商家后台 Web 全量管理 |
| **收银员（cashier）** | 仅收银工作台（开台 / 点餐 / 接单 / 结账） |
| **财务（finance）** | 仅看账（账目与报表，不可操作） |

> 完整产品需求见 [餐饮收银SaaS-PRD.md](file:///d:/c/saas/餐饮收银SaaS-PRD.md)

---

## 二、整体架构

### 2.1 双服务架构

后端采用 **双服务架构**，避免多进程并发写同一 SQLite 的锁冲突：平台端管主数据与资费（激活码、店铺档案），商家端管经营数据（菜品、订单、账目），两类数据分属不同库。

```
┌───────────────────────────────────────────────────────────────┐
│ platform-service（平台端，NestJS + TypeORM + better-sqlite3）  │
│   数据：data/platform.db（激活码、店铺主数据，shopId 源头）       │
│   前端：platform-admin-web（激活码 + 店铺信息）                │
│   权限：运营权限（跨租户看所有店）                              │
└──────────────────────────────┬────────────────────────────────┘
                               │ POST /internal/activation/claim（内网签名）
┌──────────────────────────────▼────────────────────────────────┐
│ saas-service（商家端，NestJS + TypeORM + better-sqlite3）       │
│   数据：data/saas.db（账号、角色、菜品 / 桌台 / 订单 / 账目）   │
│   前端：merchant-web（React）+ cashier-app（uni-app x）        │
│   权限：租户权限（只能看自己店）                               │
└───────────────────────────────────────────────────────────────┘
```

### 2.2 技术选型

| 端 | 技术 |
|---|---|
| 平台端服务 | Node + NestJS + TypeORM + better-sqlite3 + JWT（内部接口另加 HMAC 签名）+ helmet + 限流 |
| 商家端服务 | Node + NestJS + TypeORM + better-sqlite3 + JWT + bcryptjs |
| 商家后台 Web | React 18 + TypeScript + Vite 5 + Ant Design 6 |
| 平台后台 Web | Vue 3 + TypeScript + Vite + Pinia + Vue Router |
| 收银 App | uni-app x（原生渲染） |
| 数据库 | SQLite（单文件 × 2，`platform.db` / `saas.db`） |
| 打印 | ESC/POS 指令 → 原生蓝牙 SPP / WiFi TCP 发送 |

### 2.3 系统拓扑

```
                     ┌─────────────────────────────────────────┐
                     │              Nginx（反代 + 静态托管）      │
                     │  / → platform-admin-web 静态产物          │
                     │  /api/platform → 127.0.0.1:3100          │
                     │  /api/saas     → 127.0.0.1:3200          │
                     │  /merchant     → merchant-web 静态产物    │
                     └───────────┬───────────────┬──────────────┘
                                 │               │
              ┌──────────────────▼──┐  ┌─────────▼──────────────┐
              │ platform-service    │  │ saas-service            │
              │ :3100  platform.db  │◄─┤ :3200  saas.db         │
              │ 激活码 / 店铺主数据  │  │ 账号/菜品/桌台/订单/打印  │
              └─────────────────────┘  └─────────────────────────┘
                       ▲                          ▲
                       │ 内网 HMAC 签名            │
                       │  claim（注册建店）        │ push（停用同步）
                       └───────── push/pull ───────┘
                       （店铺状态：平台 push + 登录 pull 兜底）

  前端：
  - platform-admin-web（Vue3）→ platform-service :3100
  - merchant-web       （React）→ saas-service :3200 + platform-service :3100
  - cashier-app   （uni-app x）→ saas-service :3200（HTTP） + 本地打印机（蓝牙/无线）
```

---

## 三、仓库目录结构

```
d:\c\saas/
├── cashier-app/                    # 【收银App】uni-app x 原生 App
│   ├── api/                        # 后端接口封装（areas/auth/dishes/orders/payments/printers/reports/tables）
│   ├── pages/                      # 11 个页面（login/register/home/tables/order/cart/order-detail/settle/orders/print/print-add）
│   ├── utils/                      # config/request/esc-pos（小票指令）/print-manager（打印管理）
│   ├── uni_modules/saas-printer/   # 原生打印插件（蓝牙 SPP / WiFi TCP）
│   ├── App.uvue / main.uts / manifest.json / pages.json / uni.scss
│   └── unpackage/                  # 本地编译缓存（HBuilderX），不入库
├── frontend/                       # 旧版静态登录页（legacy，已被 Web 工程取代）
├── logo/                           # 品牌 LOGO 与 favicon 资源
├── merchant-web/                   # 【前端·商家后台】React + TS + Vite + antd
│   ├── src/
│   │   ├── api/                    # HTTP 封装 + 业务接口（含 reports/devices/staff 等）
│   │   ├── components/             # 通用组件 + components/report 报表组件
│   │   ├── data/navigation.ts      # 菜单/视图元数据（自研 hash 路由）
│   │   ├── views/                  # 运营/报表页面 + views/reports 报表页
│   │   ├── styles/global.css       # 单一全局样式表
│   │   ├── App.tsx / main.tsx / theme.ts
│   │   └── utils/                  # excel / favorites
│   ├── scripts/                    # 美团菜品导入/转换脚本
│   ├── OVERVIEW.md / PERF-REPORT.md / PROJECT_CONTEXT.md / TECH-STACK.md
│   └── package.json / vite.config.ts / tsconfig*.json
├── output/                         # 所有「可部署」服务工程
│   ├── platform-admin-web/         # 【前端·平台后台】Vue3（激活码 + 店铺 + 设置）
│   ├── platform-service/          # 【后端·平台端】NestJS（3100 / platform.db）
│   └── saas-service/              # 【后端·商家端】NestJS（3200 / saas.db）
├── scripts/
│   ├── deploy/                    # 腾讯云 Ubuntu 部署脚本（见第十二节）
│   └── deploy_remote.py
├── unpackage 相关 / *.ps1 / *.py / *.js   # 本地辅助脚本（rebuild-restart、seed_area、parse_xlsx 等）
├── 餐饮收银SaaS-PRD.md            # 产品需求文档
├── 商家后台Web-UI设计输入文档.md
├── 平台后台Web-UI设计输入文档.md
├── 平台系统LOGO设计规格.md
├── 开发人员接手指南.md
├── 收银App开发接手指南.md
├── 收银App开发方向分析.md
├── SECURITY-AUDIT-platform-service.md
├── platform-service-GO-LIVE-REVIEW.md
└── CODE-WIKI.md                  # 本文档
```

---

## 四、platform-service（平台端服务）

> 路径：`output/platform-service`
> 定位：餐饮收银 SaaS 平台端服务（激活码 + 店铺主数据），即「平台后台」的 API。
> 默认端口：**3100**；数据库：`data/platform.db`（SQLite 单文件）

### 4.1 技术栈

| 项 | 选型 | 版本 |
|---|---|---|
| 框架 | NestJS（Express 平台） | ^10.4.15 |
| 语言 | TypeScript | ^5.7.3 |
| ORM | TypeORM（`@nestjs/typeorm`） | ^0.3.20 / ^10.0.2 |
| 数据库 | better-sqlite3 | ^12.2.0 |
| 认证 | @nestjs/jwt（JWT，8h 有效期） | ^10.2.0 |
| 密码 | bcryptjs（cost=12） | ^2.4.3 |
| 校验 | class-validator + class-transformer（全局 ValidationPipe） | ^0.14.1 / ^0.5.1 |
| 安全 | helmet、@nestjs/throttler（全局限流 60 次/分钟） | — |
| 环境 | dotenv | ^16.4.7 |

### 4.2 启动流程（[main.ts](file:///d:/c/saas/output/platform-service/src/main.ts)）

1. `getConfig()` 读取配置 → `assertSecret(config)` 生产环境密钥安全校验（拒绝默认/弱密钥、要求 ≥32 位）
2. `mkdirSync` 确保数据库目录存在
3. `NestFactory.create(AppModule)` 创建应用
4. 挂载 `helmet`（安全响应头，CSP 关闭）、CORS 白名单、JSON body（8MB）、cache-control 头
5. 注册全局 `ValidationPipe`（whitelist + transform）、`ResponseInterceptor`、`HttpExceptionFilter`
6. `app.listen(config.port)` 监听 **3100**

### 4.3 顶层模块（[app.module.ts](file:///d:/c/saas/output/platform-service/src/app.module.ts)）

```ts
@Module({
  imports: [
    ThrottlerModule.forRoot({ throttlers: [{ ttl: 60_000, limit: 60 }] }), // 全局限流
    TypeOrmModule.forRoot({
      type: 'better-sqlite3',
      database: getConfig().dbPath,
      entities: [Operator, ActivationCode, Shop, OpLog, SystemSetting],
      synchronize: getConfig().dbSync, // 生产关闭，走 migration
    }),
    AuthModule, CodesModule, ShopsModule, InternalModule,
    OpLogModule, SaasClientModule, SettingsModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
```

> CLI 数据源见 [data-source.ts](file:///d:/c/saas/output/platform-service/src/data-source.ts)，生产关闭同步、走 `src/migrations/*`。

### 4.4 数据模型（5 张表）

| 实体 | 表 | 关键字段 | 说明 |
|---|---|---|---|
| [Operator](file:///d:/c/saas/output/platform-service/src/entities/operator.entity.ts) | operator | username(唯一), password_hash, role, avatar, token_version, created_at | 平台运营账号，`token_version` 用于改密/改名后使旧 token 失效 |
| [ActivationCode](file:///d:/c/saas/output/platform-service/src/entities/activation-code.entity.ts) | activation_code | code(varchar32 **主键**), batch_no, status, bound_shop_id, bound_at, created_at, expired_at | 激活码，状态 unused/used/void |
| [Shop](file:///d:/c/saas/output/platform-service/src/entities/shop.entity.ts) | shop | id(PK 自增，**shopId 源头**), name, address, phone, activation_code, status, created_at | 店铺主数据 |
| [OpLog](file:///d:/c/saas/output/platform-service/src/entities/op-log.entity.ts) | op_log | operator_id, action, target, detail, created_at | 敏感操作日志 |
| [SystemSetting](file:///d:/c/saas/output/platform-service/src/entities/system-setting.entity.ts) | system_setting | system_name, logo, favicon（单行 id=1） | 品牌设置，未认证场景公开读取 |

> 激活码生成：`randomBytes(12)` 在 62 字符集（大小写字母+数字）取模生成，去重保证唯一。状态机 `unused → used`（注册绑定）/ `unused → void`（作废），used/void 不可逆。

### 4.5 业务模块与接口面

统一响应结构：`{ code, message, data }`（`ResponseInterceptor` 包裹，`code === 0` 为成功；导出接口 `/export` 透传不包裹）。

| 模块 | 路径 | 关键接口 |
|---|---|---|
| [auth](file:///d:/c/saas/output/platform-service/src/modules/auth/auth.controller.ts) | `/auth` | `POST /login`、`GET /me`、`PUT /profile`（改名 +token_version 失效旧 token）、`PUT /password`。`onModuleInit` 首启创建种子运营账号，未配置密码则随机生成并打印一次 |
| [codes](file:///d:/c/saas/output/platform-service/src/modules/codes/codes.controller.ts) | `/admin/codes` | `POST /batch` 批量生成、`GET /` 列表、`GET /export` 导出 CSV（双引号包裹防公式注入）、`POST /:code/void` 作废 |
| [shops](file:///d:/c/saas/output/platform-service/src/modules/shops/shops.controller.ts) | `/admin/shops` | `GET /` 跨租户列表、`POST /:id/status` 停用/启用（记 op_log + push 同步 saas-service） |
| [internal](file:///d:/c/saas/output/platform-service/src/modules/internal/internal.controller.ts) | `/internal` | `POST /activation/claim`（商家注册时校验激活码 + 建店）、`GET /shops/:id/status`（登录 pull 兜底） |
| [saas-client](file:///d:/c/saas/output/platform-service/src/modules/saas-client/saas-client.service.ts) | — | `pushShopStatus`：状态变更时构造 canonical JSON + HMAC 签名 POST 到 saas-service `/internal/shop-status` |
| [op-log](file:///d:/c/saas/output/platform-service/src/modules/op-log/op-log.service.ts) | — | `log(operatorId, action, target, detail, meta)` 记录敏感操作 |
| [settings](file:///d:/c/saas/output/platform-service/src/modules/settings/settings.service.ts) | — | `getPublic` / `update` 品牌信息公开读取与管理员更新 |

- **claim 并发安全**：`InternalService.claim` 在校验激活码后，于事务内用 `WHERE code=? AND status='unused'` 条件更新原子抢占，`affected!==1` 抛错回滚，确保一码一店。
- 登录/改密接口在 controller 用 `@Throttle` 单独收紧限流。

### 4.6 公共基础设施（[src/common/](file:///d:/c/saas/output/platform-service/src/common)）

| 文件 | 职责 |
|---|---|
| response.interceptor.ts | 统一响应 `{code:0, message:'ok', data}`；`/export` 路径透传 |
| http-exception.filter.ts | 全局异常 → `{code:status, message, data:null}`，不泄露内部错误 |
| business.exception.ts | 业务异常类 |
| enums.ts | `CodeStatus`(unused/used/void)、`ShopStatus`(active/disabled)、`Role`(admin) |
| guards/jwt-auth.guard.ts | JWT 登录态守卫，校验 Bearer token + token_version |
| guards/roles.guard.ts | 角色守卫，配合 `@Roles()` |
| guards/internal-signature.guard.ts | 内网 HMAC 签名守卫 |
| decorators/current-user.decorator.ts | `@CurrentUser()` 注入当前运营账号 |

#### 内网签名规范（[internal-signature.guard.ts](file:///d:/c/saas/output/platform-service/src/common/guards/internal-signature.guard.ts)）

- 请求头：`X-Internal-Key` / `X-Internal-Timestamp` / `X-Internal-Signature`（可选 `X-Internal-Nonce` 防重放，10 分钟窗口）
- 签名串 = `${timestamp}.${METHOD}.${path}.${canonicalBody}`，HMAC-SHA256(`INTERNAL_SHARED_SECRET`)
- `canonicalJson`：按 key 递归排序后序列化，保证调用方与接收方一致
- 时间窗口 5 分钟；`timingSafeEqual` 防时序攻击

### 4.7 环境配置（[config/env.ts](file:///d:/c/saas/output/platform-service/src/config/env.ts)）

| 变量 | 默认 | 说明 |
|---|---|---|
| PORT | 3100 | 服务端口 |
| DB_PATH | `data/platform.db` | SQLite 路径 |
| JWT_SECRET | `dev-secret-change-me` | JWT 密钥（生产必改，≥32 位） |
| JWT_EXPIRES_IN | `8h` | 登录态有效期 |
| INTERNAL_SHARED_SECRET | `dev-internal-secret` | 自身内网签名密钥 |
| SAAS_INTERNAL_BASE_URL | `http://127.0.0.1:3200` | saas-service 地址 |
| SAAS_INTERNAL_SECRET | `dev-internal-secret` | 调用 saas-service 签名密钥 |
| SEED_OPERATOR_USERNAME | `admin` | 种子运营账号 |
| SEED_OPERATOR_PASSWORD | （空则随机生成） | 种子密码 |
| CORS_ORIGINS | `http://localhost:5173,...` | CORS 白名单 |
| DB_SYNC | 非生产 true | 是否自动同步表结构 |

### 4.8 脚本

| 命令 | 说明 |
|---|---|
| `npm run start:dev` | 开发（ts-node + tsconfig-paths） |
| `npm run build` | tsc 编译到 `dist/` |
| `npm start` | 运行 `dist/main.js` |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run smoke` | 冒烟脚本 `scripts/smoke.mjs` |

---

## 五、saas-service（商家端服务）

> 路径：`output/saas-service`
> 定位：商家端后端（账号、菜品、桌台、结账方式、订单、打印、设备、报表），多租户按店铺隔离。
> 默认端口：**3200**；数据库：`data/saas.db`
> 依赖 platform-service（注册时跨服务调用），需先启动 platform-service。

### 5.1 技术栈

NestJS + TypeORM + better-sqlite3 + @nestjs/jwt + bcryptjs + class-validator。与 platform-service 同构，但额外有 **ShopStatusGuard**（店铺停用全局拦截）。

### 5.2 启动流程（[main.ts](file:///d:/c/saas/output/saas-service/src/main.ts)）

创建应用 → `setGlobalPrefix('')` → 全局 `ValidationPipe`(whitelist+transform) + `ResponseInterceptor` + `HttpExceptionFilter` → 关闭缓存 → 开启 SQLite WAL → `app.listen(port)`。

### 5.3 顶层模块（[app.module.ts](file:///d:/c/saas/output/saas-service/src/app.module.ts)）

```ts
imports: [
  TypeOrmModule.forRoot({ type: 'better-sqlite3', database: getConfig().dbPath,
    entities: [User, Table, Area, PaymentMethod, Dish, Order, Shop, Category,
               Attribute, Setmeal, ShopBucket, OrderRefund, OperationLog, Device, Printer],
    synchronize: true }),   // 开发自动建表
  JwtModule.register({ global: true, secret, signOptions: { expiresIn } }),
  AuthModule, StaffModule, DishesModule, CategoriesModule, AttributesModule,
  SetmealsModule, BucketsModule, TablesModule, AreasModule, PaymentsModule,
  OrdersModule, ReportsModule, InternalModule, DevicesModule, PrintersModule,
],
providers: [{ provide: APP_GUARD, useClass: ShopStatusGuard }],
```

### 5.4 数据模型（15 张表）

| 实体 | 表 | 关键字段 | 说明 |
|---|---|---|---|
| [User](file:///d:/c/saas/output/saas-service/src/entities/user.entity.ts) | users | shop_id, phone(唯一), password_hash, name, role, status | 老板/收银员/财务账号 |
| [Shop](file:///d:/c/saas/output/saas-service/src/entities/shop.entity.ts) | shop | shop_id(PK), name, status | **本地快照**，权威在 platform-service |
| [Dish](file:///d:/c/saas/output/saas-service/src/entities/dish.entity.ts) | dishes | shop_id, name, category, price(**分**), specs(JSON), code, type, sort_order, status, sold_out | 单价/规格加价以「分」存，避免浮点误差 |
| [Category](file:///d:/c/saas/output/saas-service/src/entities/category.entity.ts) | categories | shop_id, name, sort_order | 菜品分类 |
| [Attribute](file:///d:/c/saas/output/saas-service/src/entities/attribute.entity.ts) | attributes | shop_id, name, ... | 菜品属性 |
| [Setmeal](file:///d:/c/saas/output/saas-service/src/entities/setmeal.entity.ts) | setmeals | shop_id, ... | 套餐 |
| [Area](file:///d:/c/saas/output/saas-service/src/entities/area.entity.ts) | areas | shop_id, name, sort_order | 餐区 |
| [Table](file:///d:/c/saas/output/saas-service/src/entities/table.entity.ts) | tables | shop_id, name, area, capacity, status | 桌台（idle/occupied） |
| [PaymentMethod](file:///d:/c/saas/output/saas-service/src/entities/payment-method.entity.ts) | payment_methods | shop_id, name, code, sort, enabled | 结账方式 |
| [Order](file:///d:/c/saas/output/saas-service/src/entities/order.entity.ts) | orders | shop_id, order_no, mode, table_id/ticket_no, status, items(JSON), total/paid/change_amount(**分**), payment_method_id/name, remark, settled_at | 收银记账单 |
| [OrderRefund](file:///d:/c/saas/output/saas-service/src/entities/order-refund.entity.ts) | order_refund | order_id, item_id, quantity, refund_amount, reason | 订单退款明细（退菜） |
| [OperationLog](file:///d:/c/saas/output/saas-service/src/entities/operation-log.entity.ts) | operation_log | shop_id, operator, action, target_type, target_id, amount, detail, created_at | 商家端敏感操作日志 |
| [Device](file:///d:/c/saas/output/saas-service/src/entities/device.entity.ts) | device | device_id, shop_id, name/type/location/ip/mac/os/app_version, last_seen_at | 收银端设备心跳/在线监控 |
| [Printer](file:///d:/c/saas/output/saas-service/src/entities/printer.entity.ts) | printer | shop_id, name, type(bluetooth/tcp), address, port, brand, width_mm, is_default, enabled | 打印机配置 |
| ShopBucket | shop_buckets | shop_id, ... | 店铺存储桶（如图片） |

> **金额约定**：所有金额以「分」存储（整数），API 层出入参统一用「元」。`items` 为 JSON 快照 `[{ dish_id, name, spec_name, unit_price, qty, amount }]`。

### 5.5 枚举（[common/enums.ts](file:///d:/c/saas/output/saas-service/src/common/enums.ts)）

| 枚举 | 取值 |
|---|---|
| `UserRole` | boss / cashier / finance |
| `UserStatus` | active / disabled |
| `ShopStatus` | active / disabled |
| `TableStatus` | idle / occupied |
| `OrderMode` | table（桌台）/ ticket（叫号） |
| `DishStatus` | on_sale / off_sale |
| `OrderStatus` | pending → confirmed → completed / on_account / void（on_account 可经 settle → completed） |

### 5.6 业务模块与接口面

#### auth 模块（[auth.controller.ts](file:///d:/c/saas/output/saas-service/src/modules/auth/auth.controller.ts)）

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/auth/register` | 注册新店铺（跨服务 claim + 建老板账号 + 初始配置） |
| POST | `/auth/login` | 登录，签发 JWT（含 userId/shopId/role/phone） |
| POST | `/auth/forgot-password` | 忘记密码（统一提示，不暴露账号是否存在） |
| GET | `/auth/me` | 当前用户信息（JWT 守卫） |

- **注册链路**（`AuthService.register`）：校验手机号唯一 → 调 `PlatformClientService.claim` 建店 → 事务内建老板账号 + 本地店铺快照 + 默认桌台 + 默认结账方式（现金/微信/支付宝）。
- **登录链路**（`AuthService.login`）：密码/状态校验 → 优先 pull 平台端权威店铺状态（停用立即生效），失败回退本地快照 → 签发 JWT 下发用户信息 + 店铺名。
- [platform-client.service.ts](file:///d:/c/saas/output/saas-service/src/modules/auth/platform-client.service.ts)：平台端内部接口客户端，`claim` 与 `getShopStatus`，canonicalJson 与平台端 `InternalSignatureGuard` 完全一致。

#### orders 模块（收银工作台，[orders.controller.ts](file:///d:/c/saas/output/saas-service/src/modules/orders/orders.controller.ts)）

`@Roles(UserRole.Boss, UserRole.Cashier)`

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/orders` | 下单（开台 + 点餐合并） |
| GET | `/orders` | 订单流（按状态 + 日期筛选分页） |
| GET | `/orders/:id` | 单订单详情（占用桌台查看） |
| POST | `/orders/:id/items` | 追加菜品（桌台循环加菜） |
| POST | `/orders/:id/confirm` | 接单 |
| POST | `/orders/:id/reject` | 拒单（释放桌台） |
| POST | `/orders/:id/settle` | 结账记账（支持优惠/改价，释放桌台） |
| POST | `/orders/:id/refund` | 退菜（写 order_refund，扣减应付/实收） |
| POST | `/orders/:id/free` | 免单（金额记 0，释放桌台） |
| POST | `/orders/:id/on-account` | 挂账（释放桌台，可补收） |
| POST | `/orders/:id/reopen` | 重新结账（已结/挂账 → 已下单，清空记账） |

#### reports 模块（看账，[reports.controller.ts](file:///d:/c/saas/output/saas-service/src/modules/reports/reports.controller.ts)）

`@Roles(UserRole.Boss, UserRole.Finance)`，全部 GET（财务天然只读）。

| 路径 | 说明 |
|---|---|
| `/reports/today` | 今日概览 |
| `/reports/summary` | 日期范围营业汇总（营业额 = 已结账实收之和，免单实收 0 不计入；按结账方式汇总） |
| `/reports/daily` | 按日营业统计（区间内每天一条） |
| `/reports/dish-sales` | 菜品销售统计（按菜品聚合，支持餐名筛选） |
| `/reports/dish-detail` | 菜品销售明细（订单 × 品项展开） |
| `/reports/table-stats` | 餐区/桌台营业统计 |
| `/reports/compare` | 营业指标同环比 |
| `/reports/promo-stats` | 促销活动统计 |
| `/reports/orders` | 日期范围订单明细（已结账 + 挂账，支持状态/方式/桌台/关键字筛选） |
| `/reports/dish-discount` | 菜品优惠统计 |
| `/reports/dish-refund` | 菜品退菜统计 |
| `/reports/sensitive-stats` | 敏感操作统计（按操作类型聚合） |
| `/reports/sensitive-detail` | 敏感操作明细（分页） |
| `/reports/income-discount` | 收入优惠统计 |
| `/reports/income-coupon` | 券收入统计 |
| `/reports/income-discount-detail` | 收入优惠明细 |

#### devices 模块（设备监控，[devices.controller.ts](file:///d:/c/saas/output/saas-service/src/modules/devices/devices.controller.ts)）

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/devices/heartbeat` | 收银端心跳上报（按 shop_id+device_id upsert，更新 last_seen_at，计算 is_online） |
| GET | `/admin/devices` | 商家后台设备列表 |

#### printers 模块（打印配置，[printers.controller.ts](file:///d:/c/saas/output/saas-service/src/modules/printers/printers.controller.ts)）

| 方法 | 路径 | 说明 |
|---|---|---|
| GET/POST/PUT/DELETE | `/printers` | 打印机增删改查（校验连接方式重复、维护默认单选） |
| POST | `/printers/:id/default` | 设置默认打印机 |

> 打印机仅做**配置存储**，收银 App 通过 HTTP 拉取打印机列表后，直接经本地原生插件打印（见第七节）。

#### internal 模块（[internal.controller.ts](file:///d:/c/saas/output/saas-service/src/modules/internal/internal.controller.ts)）

接收 platform-service push 的店铺状态同步：`POST /internal/shop-status`，由 `InternalSignatureGuard` 鉴权。

#### 其他业务模块

| 模块 | 路径前缀 | 职责 |
|---|---|---|
| areas | `/admin/areas` | 餐区增删改 / 排序 / 批量删 |
| tables | `/admin/tables` | 桌台增删改 / 导入 / 列表 |
| categories | `/admin/categories` | 菜品分类增删改 |
| attributes | `/admin/attributes` | 菜品属性增删改 |
| setmeals | `/admin/setmeals` | 套餐增删改 |
| payments | `/admin/payments` | 结账方式增删改 |
| staff | `/admin/staff` | 员工增删改 / 状态（老板权限；按 shopId 隔离） |
| buckets | `/admin/buckets` | 店铺存储桶（如图片） |

### 5.7 公共基础设施（`src/common/`）

| 文件 | 职责 |
|---|---|
| guards/jwt-auth.guard.ts | JWT 登录态守卫 |
| guards/roles.guard.ts | 角色守卫 |
| guards/shop-status.guard.ts | **店铺停用全局守卫**：解析 JWT → 查本地店铺快照 → 停用则 403；无 token/无效 token 放行交 JwtAuthGuard |
| guards/internal-signature.guard.ts | 内网签名守卫（接收 platform-service 调用） |
| decorators/current-user.decorator.ts | `@CurrentUser()` 注入 AuthUser（含 userId/shopId/role） |
| decorators/roles.decorator.ts | `@Roles(...)` 角色标注 |
| response.interceptor.ts / http-exception.filter.ts / business.exception.ts | 与 platform-service 同构 |

### 5.8 环境配置（[config/env.ts](file:///d:/c/saas/output/saas-service/src/config/env.ts)）

| 变量 | 默认 | 说明 |
|---|---|---|
| PORT | 3200 | 服务端口 |
| DB_PATH | `data/saas.db` | SQLite 路径 |
| JWT_SECRET | `dev-jwt-secret-change-me` | JWT 密钥（生产必改） |
| JWT_EXPIRES_IN | `8h` | |
| PLATFORM_INTERNAL_BASE_URL | `http://127.0.0.1:3100` | 平台端地址 |
| PLATFORM_INTERNAL_SECRET | `dev-internal-secret` | **必须与 platform-service 的 INTERNAL_SHARED_SECRET 一致** |
| DEFAULT_TABLE_COUNT | 10 | 注册时默认创建的桌台数 |

### 5.9 脚本

`npm install` → `npm run build` → `npm start`；`npm run smoke`（需先启动 platform-service）。另有 `scripts/seed-real.mjs`、`scripts/dedupe-dishes.cjs` 等辅助脚本。

---

## 六、cashier-app（收银 App · uni-app x）

> 路径：`cashier-app`
> 定位：餐厅收银端原生 App（uni-app x），老板/收银员使用。iOS/Android 双端，当前 Android 原生打印已实现。
> App 名称：**收银**；appid `__UNI__539B9A9`；版本 1.0.0（[manifest.json](file:///d:/c/saas/cashier-app/manifest.json)）。

### 6.1 全局配置

- [pages.json](file:///d:/c/saas/cashier-app/pages.json)：全局导航栏白字、主题色 `#FF6A00`、背景 `#F5F6F8`；11 个页面。
- [App.uvue](file:///d:/c/saas/cashier-app/App.uvue)：`onLaunch / onShow / onHide` 生命周期日志 + 全局样式。
- [main.uts](file:///d:/c/saas/cashier-app/main.uts)：`createSSRApp(App)` 创建并返回 app 实例。
- Android 权限：INTERNET、网络/蓝牙/WiFi 状态、蓝牙 SPP 相关权限、定位（蓝牙扫描需要）。

### 6.2 页面（[pages/](file:///d:/c/saas/cashier-app/pages)）

| 路径 | 职责 |
|---|---|
| login | 登录（老板/收银员） |
| register | 注册店铺（绑定激活码） |
| home | 收银工作台（今日概览、待办订单、门迎入口） |
| tables | 桌台点餐（按餐区映射桌台，进桌点餐） |
| order | 点餐（选择分类/菜品、加购物车） |
| cart | 购物车（增减、下单） |
| order-detail | 订单详情（查看、加菜） |
| settle | 结账（选择结账方式、优惠/改价、记账） |
| orders | 订单管理（按状态流筛选） |
| print/index | 打印管理（打印机列表、默认打印机） |
| print/add | 添加打印机（蓝牙 / TCP 配置） |

### 6.3 公共工具（[utils/](file:///d:/c/saas/cashier-app/utils)）

| 文件 | 核心导出 | 职责 |
|---|---|---|
| [config.uts](file:///d:/c/saas/cashier-app/utils/config.uts) | `BASE_URL`、`TIMEOUT` | 后端地址 `http://10.0.2.2:3200`（模拟器指向宿主机），超时 10000ms |
| [request.uts](file:///d:/c/saas/cashier-app/utils/request.uts) | `request<T>/getToken/setToken/clearToken` | 统一请求：Bearer 注入、`code===0` 成功解析、401 自动清 token 并 `reLaunch` 回登录页 |
| [esc-pos.uts](file:///d:/c/saas/cashier-app/utils/esc-pos.uts) | `buildReceipt/buildTestReceipt` | 生成 ESC/POS 小票指令（初始化/走纸/切纸/对齐/放大/加粗），返回 `Uint8Array` |
| [print-manager.uts](file:///d:/c/saas/cashier-app/utils/print-manager.uts) | `getDefaultPrinter/printReceipt/printTest/invalidatePrinterCache` | 默认打印机缓存（TTL 60s）、组装指令并调用原生插件发送 |

### 6.4 API 接口封装（[api/](file:///d:/c/saas/cashier-app/api)）

| 文件 | 核心导出 | 后端路径 |
|---|---|---|
| [auth.uts](file:///d:/c/saas/cashier-app/api/auth.uts) | `login()/register()/fetchMe()` | `/auth/login`、`/auth/register`、`/auth/me` |
| [orders.uts](file:///d:/c/saas/cashier-app/api/orders.uts) | 订单列表/活跃/详情/创建/加菜/结账/今日/重新结账/接单/拒单 | `/orders/**` |
| [tables.uts](file:///d:/c/saas/cashier-app/api/tables.uts) | `fetchTablesAll()` | 收银工作台桌台列表 |
| [areas.uts](file:///d:/c/saas/cashier-app/api/areas.uts) | `fetchAreas()` | `/areas` 排序后区域列表 |
| [dishes.uts](file:///d:/c/saas/cashier-app/api/dishes.uts) | `fetchMenu()` | `/dishes/menu` 在售未沽清菜单 |
| [payments.uts](file:///d:/c/saas/cashier-app/api/payments.uts) | `fetchPayments()` | 启用中的结账方式 |
| [reports.uts](file:///d:/c/saas/cashier-app/api/reports.uts) | `fetchToday()` | `/reports/today` 今日概览 |
| [printers.uts](file:///d:/c/saas/cashier-app/api/printers.uts) | 打印机增删改查 + 默认设置 | `/printers/**` |

### 6.5 uni_modules/saas-printer（原生打印插件）

- [utssdk/index.uts](file:///d:/c/saas/cashier-app/uni_modules/saas-printer/utssdk/index.uts)：跨平台入口，根据 type 分发到蓝牙/TCP；非 Android 或不支持平台返回降级响应。
- [utssdk/app-android/index.uts](file:///d:/c/saas/cashier-app/uni_modules/saas-printer/utssdk/app-android/index.uts)：Android 原生实现，`sendBytes(type, address, port, bytes)`——蓝牙 SPP 连接发送 / WiFi TCP 连接发送，含超时保护、蓝牙状态与已配对设备查询。

---

## 七、打印链路（printers + saas-printer）

打印采用「后端存配置，App 本地打」的分工：

```
saas-service  printers 模块  ──存打印机配置（type/address/port/width/is_default/enabled）
        │  GET /printers
        ▼
cashier-app  api/printers.uts  →  utils/print-manager.uts（默认打印机缓存）
        │  buildReceipt(...) 生成 ESC/POS Uint8Array
        ▼
uni_modules/saas-printer  sendBytes（蓝牙 SPP / WiFi TCP）→ 热敏打印机
```

- 商家后台在 merchant-web「打印管理 / 票据样式 / 打印设置 / 打印分配」配置；App 端在「打印管理 / 添加打印机」配置。
- App 每次出单前先取默认打印机（本地缓存 60s），未配置则提示。

---

## 八、跨服务协作与多租户隔离

### 8.1 注册链路（跨服务）

```
商家 App 提交注册
  → saas-service POST /auth/register（校验手机号唯一）
  → 调 platform-service POST /internal/activation/claim（内网签名）
      ├─ 校验激活码状态（非 unused 拒绝）
      ├─ 事务内建店铺主数据，激活码原子抢占置 used + bound_shop_id
      └─ 返回 { success, shopId }
  → saas-service 用 shopId 建老板账号 + 本地店铺快照 + 初始配置（默认桌台/结账方式）
  → 返回注册成功，可立即登录
```

> 激活码仅在注册时调用一次，调用量极低，HTTP 直连 + 内网签名足够，无需消息队列。

### 8.2 店铺状态同步（push + pull 兜底）

```
platform-service  ──push(HMAC 签名)──▶  saas-service   （店铺停用/启用即时生效）
      ▲  ▲
      │  └─ pull：商家登录时 GET /internal/shops/:id/status 校验（兜底）
      │
      └── 商家注册：saas-service 调 POST /internal/activation/claim（校验激活码 + 建店）
```

- 平台端停用店铺 → `SaasClientService.pushShopStatus` 同步到 saas-service `/internal/shop-status`（失败不阻断）。
- saas-service 全局 `ShopStatusGuard` 解析 JWT → 查本地快照 → 停用则 403。
- 登录时 `AuthService.login` 主动 pull 平台端权威状态，刷新本地快照。

### 8.3 多租户隔离实现要点

- 所有业务表带 `shop_id`，后端从 JWT 解析 shopId 并按租户过滤所有查询。
- `@CurrentUser()` 装饰器从 JWT 注入 `AuthUser`（含 shopId），所有 service 按 `user.shopId` 隔离。
- 平台端接口仅限运营身份访问；`/internal/*` 仅限内网签名访问。
- 测试必须覆盖：A 店 token 访问 B 店数据返回 403 / 空。

---

## 九、merchant-web（商家后台 Web · React）

> 路径：`merchant-web`；定位：食刻商户后台 Web 管理后台（设计稿转码），仅老板登录。
> 技术栈：React 18 + TypeScript + Vite 5 + Ant Design 6 + dayjs + xlsx（导入导出）。（[package.json](file:///d:/c/saas/merchant-web/package.json)）

### 9.1 入口与顶层（[main.tsx](file:///d:/c/saas/merchant-web/src/main.tsx) / [App.tsx](file:///d:/c/saas/merchant-web/src/App.tsx)）

- `main.tsx`：初始化 dayjs 中文 + 应用主题 + antd `ConfigProvider`（中文包）+ 挂载 App。
- `App.tsx` 核心职责：
  1. **画布缩放** `useCanvasScale`：按固定设计稿画布（主框架 1600×900，登录页 1440×900）绘制，运行时 `transform: scale()` 整体等比缩放铺满视口。
  2. **自研 hash 路由**（无 React Router）：`viewKeyToHash` / `hashToViewKey` 做 `#/ops/...` ↔ 视图映射，监听 `hashchange`。
  3. **多页签系统**：`tabs` 状态渲染多页签，当前页才 `display:flex`；切换/关闭/清空页签。
  4. **登录态**：启动时 `GET /auth/me` 刷新用户信息；失效则清会话回登录页。
  5. **状态持久化**：当前视图/分组/页签/主题全存 localStorage（`merchant_*` 前缀）。
  6. **页面懒加载**：所有业务页 `lazy(() => import(...))`，首屏只加载当前页与框架。

### 9.2 HTTP 封装（[api/http.ts](file:///d:/c/saas/merchant-web/src/api/http.ts)）

- `request<T>(path, options)`：基于 fetch，自动注入 `Authorization: Bearer <token>`。
- token 持久化：`merchant_token` / `merchant_user` / `merchant_shop`。
- 401 处理：默认清会话 + 整页刷新；`skip401Redirect` 选项用于未登录态接口（当作普通业务错误抛出）。
- 业务错误码：`json.code !== 0` 抛 `ApiError`。

### 9.3 API 模块（[api/](file:///d:/c/saas/merchant-web/src/api)）

| 文件 | 说明 |
|---|---|
| auth / staff / tables / areas / attributes / buckets | 对应后端 `/auth`、`/admin/*` |
| categories / dishes / setmeals / types | 菜品相关（导入/排序/上下架） |
| devices | 设备监控（心跳列表） |
| [reports.ts](file:///d:/c/saas/merchant-web/src/api/reports.ts) | 报表接口，导出 `fetchDailyReport / fetchDishSales / fetchDishDetail / fetchTableStats / fetchCompare / fetchPromoStats / fetchOrders / fetchReportSummary / fetchDishDiscount / fetchDishRefund / fetchSensitiveStats / fetchSensitiveDetail / fetchIncomeDiscount / fetchIncomeCoupon / fetchIncomeDiscountDetail`，分别对应 `/reports/*` |

### 9.4 菜单元数据（[data/navigation.ts](file:///d:/c/saas/merchant-web/src/data/navigation.ts)）

`NAV_GROUPS`（运营中心 `ops` + 报表中心 `rpt`）+ `ViewKey` 枚举 + `findViewMeta(key)`。完整菜单：

**运营中心（ops）**

- 首页 `ops:home`
- 餐厅管理（父级容器）：桌台管理、区域管理
  - 结账方式管理（容器）：结账方式管理、券类管理、优惠折扣
  - 打印管理（容器）：档口管理、票据样式、打印设置、打印分配
  - 经营设置（容器）：必点菜设置、营业模式设置
- 菜品管理（容器）：菜品库、菜单分类、菜品属性
- 档案管理（容器）：门店档案、角色档案、员工档案
- 系统设置（容器）：设备监控、运行日志

**报表中心（rpt）**

- 首页 `rpt:home`
- 营业数据（容器）：综合营业统计、促销活动统计、餐区/桌台营业统计、营业指标同环比
- 菜品销售（容器）：菜品销售统计、菜品优惠统计、菜品销售明细、退菜统计
- 订单数据（容器）：店内订单明细、敏感操作统计、敏感操作明细
- 收入数据（容器）：收入优惠统计、券收入统计、收入优惠明细

### 9.5 页面（[views/](file:///d:/c/saas/merchant-web/src/views)）

含运营页与报表页，顶层懒加载。其中报表页集中在 `views/reports/`，复用 `components/report/` 通用组件。

| 分组 | 文件 | 职责 |
|---|---|---|
| 运营 | OpsHome / TableManage / AreaManage / CheckoutManage / VoucherManage / DiscountManage / StallManage / PrintStyle / PrintSettings / PrintAssign / MustDish / BusinessMode / DishLibrary / DishCategory / DishAttribute / StoreProfile / RoleManage / StaffManage / DeviceMonitor / OperationLog / AuthScreen / PlaceholderView | 详见导航对应菜单 |
| 报表 | BizStats / PromoStats / AreaTableStats / CompareReport / DishSalesStats / DishDetail / DishDiscountStats / DishRefundStats / InStoreOrders / SensitiveStats / SensitiveDetail / IncomeDiscountStats / IncomeCouponStats / IncomeDiscountDetail / ReportHome | 对应 rpt 报表中心各页 |
| 组件 | ReportSkeleton | 报表加载骨架 |

### 9.6 组件（[components/](file:///d:/c/saas/merchant-web/src/components)）

- **报表组件（components/report/）**：[ReportTable](file:///d:/c/saas/merchant-web/src/components/report/ReportTable.tsx)（列定义/加载/空态/合计/分页）、ReportToolbar、TrendChart（趋势图）、useToast。
- 通用组件：`TopBar / Drawer / TabsBar / ConfirmModal / Toast / CommonSelect / Pagination / SearchForm / StatCard / EmptyState / Icon / FavStar / SortAreaModal / SortDishModal / EditAreaModal / AddAreaModal / AddTableModal / BatchAddTableModal / BatchDeleteAreasModal / BatchDeleteTableModal / BatchImportTableModal / BatchImportDishModal / CreateSetMealModal / DishPickerModal / SelectDishesModal`。
- `useToast`（utils/favorites.ts、components/report/useToast.ts）：通用提示。

> 部分页面（如档案类、票据样式等）采用前端 localStorage 存储（自增 `KEY_vN` 版本）。

### 9.7 样式与主题

- **单一 `global.css`**，原生 CSS 变量主题（`--color-*`、`--ctrl-radius`），无 CSS Modules / Tailwind / 预处理器。
- 主题切换（[theme.ts](file:///d:/c/saas/merchant-web/src/theme.ts)）：`html[data-theme="dark|light"]` 切换 CSS 变量。

### 9.8 Vite 配置（[vite.config.ts](file:///d:/c/saas/merchant-web/vite.config.ts)）与脚本

- 开发端口 5175，proxy：`/auth`、`/admin`、`/tables` → `http://127.0.0.1:3200`（saas-service）。
- gzip 预压缩 + vendor 拆分（react-vendor / antd-vendor / dayjs）。
- `npm run dev` / `npm run build` / `npm run preview`。
- 辅助脚本（[scripts/](file:///d:/c/saas/merchant-web/scripts)）：美团菜品读取/转换/导入/校验（`read_meituan.*`、`analyze_meituan.cjs`、`convert_meituan.cjs`、`import_dishes_to_backend.cjs`、`verify_convert.cjs`）。

---

## 十、platform-admin-web（平台后台 Web · Vue3）

> 路径：`output/platform-admin-web`；定位：平台方网页后台（运营端），激活码管理 + 店铺信息管理。
> 技术栈：Vue 3 + TypeScript + Vite + Pinia + Vue Router（History 模式）。

### 10.1 入口与路由（[main.ts](file:///d:/c/saas/output/platform-admin-web/src/main.ts) / [router/index.ts](file:///d:/c/saas/output/platform-admin-web/src/router/index.ts)）

- `main.ts`：`createApp(App)` + Pinia + Router + 全局样式；启动时 `useSettingsStore().load()` 拉取品牌设置（系统名/logo/favicon）。
- 路由：`/login`；`/`（AppView 主框架）下含 `codes` / `shops` / `settings` 子路由，默认重定向 `/codes`。
- 全局守卫：未登录跳登录页；已登录访问 `/login` 重定向 `/codes`。

### 10.2 状态管理（[stores/](file:///d:/c/saas/output/platform-admin-web/src/stores)）

- `auth.ts`：token / 用户信息持久化（localStorage `platform_admin_token` / `platform_admin_user`）。
- `settings.ts`：品牌信息。

### 10.3 HTTP 封装（[api/http.ts](file:///d:/c/saas/output/platform-admin-web/src/api/http.ts)）

- `request<T>(path, options)`：支持 query/params/body、`raw`（blob 下载）、超时（默认 8000ms）、外部 `AbortSignal`。
- 401 清会话跳 `/login`；429 友好提示「操作过于频繁」。
- api 模块：`auth / codes / shops / settings / types`。

### 10.4 页面（[views/](file:///d:/c/saas/output/platform-admin-web/src/views)）

| 视图 | 职责 |
|---|---|
| LoginView.vue | 运营登录 |
| AppView.vue | 主框架（侧边栏 + 顶栏 + 路由出口） |
| CodesView.vue | 激活码管理（批量生成 / 列表筛选 / 作废 / 导出 CSV） |
| ShopsView.vue | 店铺信息管理（跨租户列表 / 停用启用） |
| SettingsView.vue | 系统品牌设置 |

### 10.5 其他

- `composables/useToast.ts`、`utils/format.ts`。
- Vite 端口 5173，proxy `/api`、`/auth`、`/admin` → `http://127.0.0.1:3100`。
- `screenshots/` 含页面截图。

---

## 十一、依赖关系总览

### 11.1 服务间依赖

```
platform-service ◀─claim/pull── saas-service
platform-service ──push（停用同步）──▶ saas-service
```

- saas-service **依赖** platform-service（注册 claim、登录 pull 状态）。
- platform-service **单向 push** saas-service（停用同步，失败有 pull 兜底）。
- 启动顺序：先 platform-service，后 saas-service。

### 11.2 前端/App → 后端依赖

| 前端 | 后端 |
|---|---|
| merchant-web（React） | saas-service :3200（/auth /admin /tables /reports）+ platform-service :3100 |
| platform-admin-web（Vue3） | platform-service :3100 |
| cashier-app（uni-app x） | saas-service :3200（/auth /orders /dishes /printers /reports /devices） |

### 11.3 后端内部依赖（platform-service）

```
auth ──▶ operator(entity)
codes ──▶ activation_code(entity) + shop(join) + op-log
shops ──▶ shop(entity) + op-log + saas-client(push)
internal ──▶ activation_code + shop + (InternalSignatureGuard)
settings ──▶ system_setting
saas-client ──▶ (HTTP 调用 saas-service)
```

### 11.4 后端内部依赖（saas-service）

```
auth ──▶ user + shop(snapshot) + table + payment-method + platform-client(claim/pull)
orders ──▶ order + order-refund(退菜) + table(释放) + dish(快照) + operation-log
reports ──▶ order + order-refund + operation-log（各统计查询）
devices ──▶ device（upsert 心跳）
printers ──▶ printer
dishes/categories/attributes/setmeals ──▶ 各自 entity
areas / tables ──▶ area / table
payments ──▶ payment-method
internal ──▶ shop(snapshot 更新) + (InternalSignatureGuard)
buckets ──▶ shop-bucket
```

### 11.5 打印链路依赖

```
saas-service printers ──▶ merchant-web（打印管理配置 + App 端拉取）
cashier-app print-manager/esc-pos ──▶ saas-printer（原生 sendBytes）──▶ 打印机
```

---

## 十二、部署与运行方式

### 12.1 本地开发

| 工程 | 启动命令 | 端口 | 依赖 |
|---|---|---|---|
| platform-service | `cd output/platform-service && npm i && npm run start:dev` | 3100 | 无（先启） |
| saas-service | `cd output/saas-service && npm i && npm run start:dev` | 3200 | 先启 platform-service |
| merchant-web | `cd merchant-web && npm i && npm run dev` | 5175 | saas-service（proxy → 3200） |
| platform-admin-web | `cd output/platform-admin-web && npm i && npm run dev` | 5173 | platform-service（proxy → 3100） |
| cashier-app | HBuilderX 打开 `cashier-app` 运行到 Android | — | saas-service（`config.uts` 指向 3200；真机需改 IP） |

> 跨服务签名密钥本地默认 `dev-internal-secret`，两端一致即可。收银 App 默认后端地址 `http://10.0.2.2:3200`（模拟器指向宿主机），真机需改 [config.uts](file:///d:/c/saas/cashier-app/utils/config.uts) 为宿主机局域网 IP。

### 12.2 生产部署（腾讯云 Ubuntu）

部署脚本：[scripts/deploy/](file:///d:/c/saas/scripts/deploy)，不安装面板（无 MySQL/Redis），全部软件源适配腾讯云内网镜像 + npmmirror，**不依赖国际网络**。服务器目录 `output/` 只含 `platform-service/` 与 `saas-service/`。

执行步骤：

| 步骤 | 脚本 | 作用 |
|---|---|---|
| ① | [01-apt-tencent.sh](file:///d:/c/saas/scripts/deploy/01-apt-tencent.sh) | apt 换腾讯云内网源 + 装基础软件（nginx、sqlite3、编译工具） |
| ② | [02-install-node.sh](file:///d:/c/saas/scripts/deploy/02-install-node.sh) | 安装 Node.js 22（npmmirror 国内镜像） |
| ③ | [03-deploy.sh](file:///d:/c/saas/scripts/deploy/03-deploy.sh) | 安装依赖 + 构建两服务 + 生成 `.env` + pm2 启动 |
| ④ | [04-nginx.sh](file:///d:/c/saas/scripts/deploy/04-nginx.sh) | 配置 Nginx（反代 3100/3200 + 托管前端静态文件） |
| ⑤ | [05-backup.sh](file:///d:/c/saas/scripts/deploy/05-backup.sh) | 每日备份（crontab 凌晨 2 点，保留 30 天） |

[03-deploy.sh](file:///d:/c/saas/scripts/deploy/03-deploy.sh) 关键逻辑：

- 生成**同一个** `SHARED_SECRET`（`openssl rand -hex 32`）写入三处（platform 的 `INTERNAL_SHARED_SECRET` / `SAAS_INTERNAL_SECRET` + saas 的 `PLATFORM_INTERNAL_SECRET`），保证两端互通。
- 平台运营初始密码随机生成（`openssl rand -hex 8`），打印提示立即保存。
- JWT_SECRET 各自随机生成。
- pm2 托管 + `pm2 startup` 开机自启。

### 12.3 生产环境必改项

| 项 | 位置 | 说明 |
|---|---|---|
| JWT 密钥 | 两个 `.env` 的 `JWT_SECRET` | 03 脚本已自动随机生成，勿改回默认 |
| 内部签名密钥 | 三个 `*_SECRET` 字段 | 03 脚本生成同一随机值写入三处 |
| 运营初始密码 | `platform-service/.env` 的 `SEED_OPERATOR_PASSWORD` | 03 脚本随机生成，部署后立即登录 |
| HTTPS | Nginx | 建议申请免费 SSL |

### 12.4 辅助脚本（仓库根）

- [rebuild-restart.ps1](file:///d:/c/saas/rebuild-restart.ps1) / [restart-saas.ps1](file:///d:/c/saas/restart-saas.ps1) / [start-merchant.ps1](file:///d:/c/saas/start-merchant.ps1)：本地构建重启。
- [seed_area.js](file:///d:/c/saas/seed_area.js) / [revert_area.js](file:///d:/c/saas/revert_area.js)：餐区数据种子/回退。
- [parse_xlsx.py](file:///d:/c/saas/parse_xlsx.py)：Excel 解析。
- [scripts/deploy_remote.py](file:///d:/c/saas/scripts/deploy_remote.py)：远程部署辅助。

---

## 十三、安全体系与关键约定

### 13.1 安全体系

| 层 | 机制 | 说明 |
|---|---|---|
| 登录态 | `JwtAuthGuard` | 校验 `Authorization: Bearer <token>`；payload 含 userId/shopId/role |
| 角色控制 | `RolesGuard` + `@Roles()` | 限定管理接口；商家端三角色（boss/cashier/finance），平台端 admin |
| 店铺停用 | `ShopStatusGuard`（saas 全局） | 解析 JWT → 本地店铺快照 → 停用则 403 |
| 内网签名 | `InternalSignatureGuard` | HMAC-SHA256 + canonicalJson（key 排序）+ 时间窗口 5 分钟 + nonce 重放去重（10 分钟） |
| 密码 | bcryptjs | 平台 cost=12，商家 cost=10 |
| 限流 | `ThrottlerGuard`（platform） | 全局 60 次/分钟；登录/改密 `@Throttle` 收紧 |
| 安全头 | helmet（platform） | CSP 关闭（纯 JSON API） |
| 密钥校验 | `assertSecret`（platform） | 生产拒绝默认/弱密钥，要求 ≥32 位 |
| 敏感操作日志 | `OpLogService`（platform）+ operation_log（saas） | 作废激活码、店铺状态、退菜、免单、挂账等 |
| token 失效 | token_version（platform）/清 token（App） | 改密/改名后使旧 token 失效 |

### 13.2 关键约定

| 约定 | 说明 |
|---|---|
| 统一响应格式 | `{ code: 0, message: 'ok', data }` 成功；`code !== 0` 业务错误；`/export` 透传 |
| 金额存储 | 所有金额以「分」存储（整数），API 出入参统一用「元」，避免浮点误差 |
| 多租户键 | 所有业务表带 `shop_id`，shopId 由 platform-service 的 shop 表产生 |
| 店铺快照 | saas-service 的 shop 表为本地快照，权威在 platform-service；push + pull 同步 |
| 激活码 | 12 位大小写字母+数字，无分隔符；状态 unused/used/void，used/void 不可逆 |
| 订单状态机 | pending → confirmed → completed / on_account / void；on_account 可经 settle → completed |
| 画布缩放 | merchant-web 按 1600×900（登录 1440×900）固定画布，`transform: scale()` 整体缩放 |
| 状态持久化 | merchant-web 视图/分组/页签/主题存 localStorage（`merchant_*` 前缀） |
| 打印协议 | 后端存配置，App 端生成 ESC/POS 指令经原生蓝牙/TCP 发送 |
| 命名规范 | API 命名统一小写下划线（如 `shop_id`、`bound_shop_id`）；业务状态用枚举管理 |
| CSV 导出 | 字段双引号包裹，防 Excel 公式注入（`= +/- @` 开头） |

---

> 本 Wiki 基于仓库当前代码状态生成。各工程根目录另有 `TECH-STACK.md` / `README.md` / `OVERVIEW.md` / `PERF-REPORT.md` 及根目录的开发类文档（[开发人员接手指南.md](file:///d:/c/saas/开发人员接手指南.md)、[收银App开发接手指南.md](file:///d:/c/saas/收银App开发接手指南.md)、[收银App开发方向分析.md](file:///d:/c/saas/收银App开发方向分析.md)）可作补充阅读。