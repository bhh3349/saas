# 餐饮收银 SaaS — Code Wiki

> 本文档为「餐饮收银 SaaS」项目仓库的结构化代码 Wiki，覆盖项目整体架构、主要模块职责、关键类与函数说明、依赖关系以及项目运行方式等关键信息。
> 仓库根目录：`d:\c\saas`
> 文档基线日期：2026-08-25

---

## 目录

- [一、项目总览](#一项目总览)
- [二、整体架构](#二整体架构)
- [三、仓库目录结构](#三仓库目录结构)
- [四、platform-service（平台端服务）](#四platform-service平台端服务)
- [五、saas-service（商家端服务）](#五saas-service商家端服务)
- [六、跨服务协作与多租户隔离](#六跨服务协作与多租户隔离)
- [七、merchant-web（商家后台 Web · React）](#七merchant-web商家后台-web--react)
- [八、platform-admin-web（平台后台 Web · Vue3）](#八platform-admin-web平台后台-web--vue3)
- [九、saas-admin-web（商家管理后台 Web · Vue3）](#九saas-admin-web商家管理后台-web--vue3)
- [十、部署与运行方式](#十部署与运行方式)
- [十一、依赖关系总览](#十一依赖关系总览)
- [十二、安全体系与关键约定](#十二安全体系与关键约定)

---

## 一、项目总览

餐饮收银 SaaS 是一套部署在云端的餐厅收银系统，一套云端服务服务多家餐厅，平台方自研激活码体系。产品由三个项目构成，共享多租户理念，按店铺严格隔离数据。

| 项目 | 端形态 | 使用方 | 核心模块 |
|---|---|---|---|
| **项目一：平台方网页后台** | Web | 公司运营人员（自用） | 激活码管理、店铺信息管理 |
| **项目二：商家 SaaS** | 网页后台 + 手机 App | 餐厅商家 | 商家后台 Web（全量管理）；收银 App（员工 / 老板） |
| **项目三：顾客扫码点餐** | 小程序 / H5（二期） | 顾客 | 扫码点餐、下单、加菜催菜 |

### 核心原则

- **手机优先**：收银端所有操作面向触屏重做，交互简单直接
- **收银为核**：开台 / 点餐 / 接单 / 结账记账一条线走通
- **记账不收款**：结账 = 记账，不接支付通道
- **数据双保险**：云端主源 + 老板手机本地备份
- **多租户隔离**：所有业务表带 `shop_id`，后端按 JWT 强制隔离，任何接口不得跨店访问

### 角色权限（商家端固定三种，不开放自定义）

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
│   前端：merchant-web（React）+ saas-admin-web（Vue3）          │
│   权限：租户权限（只能看自己店）                               │
└───────────────────────────────────────────────────────────────┘
```

### 2.2 技术选型

| 端 | 技术 |
|---|---|
| 平台端服务 | Node + NestJS + TypeORM + better-sqlite3 + JWT（内部接口另加 HMAC 签名）+ helmet + 限流 |
| 商家端服务 | Node + NestJS + TypeORM + better-sqlite3 + JWT + bcryptjs |
| 商家后台 Web | React 18 + TypeScript + Vite + Ant Design 6 |
| 平台后台 Web | Vue 3 + TypeScript + Vite + Pinia + Vue Router |
| 商家管理后台 Web | Vue 3 + TypeScript + Vite + Pinia + Vue Router |
| 商家收银 App | uni-app x（原生渲染，本仓库不含源码） |
| 数据库 | SQLite（单文件 × 2，`platform.db` / `saas.db`） |

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
              │ 激活码 / 店铺主数据  │  │ 账号 / 菜品 / 桌台 / 订单 │
              └─────────────────────┘  └─────────────────────────┘
                       ▲                          ▲
                       │ 内网 HMAC 签名            │
                       │  claim（注册建店）        │ push（停用同步）
                       └───────── push/pull ───────┘
                       （店铺状态：平台 push + 登录 pull 兜底）

  前端：
  - platform-admin-web（Vue3）→ platform-service :3100
  - saas-admin-web     （Vue3）→ saas-service     :3200
  - merchant-web       （React）→ saas-service    :3200 + platform-service :3100
```

---

## 三、仓库目录结构

```
d:\c\saas/
├── frontend/                       # 旧版静态登录页（HTML，已被各 Web 工程取代）
│   ├── index.html
│   └── merchant-login.html
├── logo/                           # 品牌 LOGO 与 favicon 资源
│   ├── favicon/
│   └── 源文件/、说明/
├── merchant-web/                   # 【前端一】商家后台 Web（React + TS + Vite + antd）
│   ├── src/
│   │   ├── api/                    # HTTP 封装与各业务接口
│   │   ├── components/            # 20 个通用组件
│   │   ├── data/navigation.ts     # 菜单/视图元数据（自研 hash 路由）
│   │   ├── styles/global.css      # 单一全局样式表
│   │   ├── views/                 # 19 个页面
│   │   ├── App.tsx                # 顶层：登录态 + 画布缩放 + 自研路由 + 多页签
│   │   ├── main.tsx               # 入口（antd ConfigProvider + 主题）
│   │   └── theme.ts               # dark/light 主题
│   ├── scripts/                   # 美团菜品数据导入/转换脚本
│   ├── templates/                 # 表格组件模板说明
│   ├── OVERVIEW.md / PERF-REPORT.md / PROJECT_CONTEXT.md / TECH-STACK.md
│   ├── package.json / vite.config.ts / tsconfig*.json
│   └── index.html
├── output/                         # 所有「可部署」工程（服务 + 平台/商家 Web）
│   ├── platform-admin-web/         # 【前端二】平台后台 Web（Vue3）
│   │   ├── src/{api,composables,router,stores,utils,views}
│   │   ├── AUDIT-REPORT.md / PERF-REPORT.md / README.md / TECH-STACK.md
│   │   └── package.json / vite.config.ts
│   ├── platform-service/          # 【后端一】平台端服务（NestJS）
│   │   ├── src/{common,config,entities,migrations,modules}
│   │   ├── scripts/smoke.mjs       # 冒烟测试
│   │   ├── .env.example / README.md / TECH-STACK.md
│   │   └── package.json / nest-cli.json / tsconfig*.json
│   ├── saas-admin-web/            # 【前端三】商家管理后台 Web（Vue3）
│   │   ├── src/{api,composables,config,router,stores,views}
│   │   └── package.json / vite.config.ts
│   ├── saas-service/              # 【后端二】商家端服务（NestJS）
│   │   ├── src/{common,config,entities,modules}
│   │   ├── scripts/smoke.mjs
│   │   ├── .env.example / README.md
│   │   └── package.json / nest-cli.json / tsconfig*.json
│   └── .gitignore
├── scripts/
│   ├── deploy/                    # 腾讯云 Ubuntu 部署脚本（见第十节）
│   │   ├── 01-apt-tencent.sh / 02-install-node.sh / 03-deploy.sh
│   │   ├── 04-nginx.sh / 05-backup.sh / README.md
│   └── deploy_remote.py
├── .gitattributes / .gitignore
├── *.ps1 / *.py / *.js            # 本地辅助脚本（rebuild-restart、seed_area、parse_xlsx 等）
├── login.yaml
├── 餐饮收银SaaS-PRD.md            # 产品需求文档
├── 商家后台Web-UI设计输入文档.md
├── 平台后台Web-UI设计输入文档.md
├── 平台系统LOGO设计规格.md
├── SECURITY-AUDIT-platform-service.md
├── platform-service-GO-LIVE-REVIEW.md
└── 开发人员接手指南.md
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
4. 挂载 `helmet`（安全响应头，CSP 关闭）、CORS 白名单、JSON body（8MB）
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

### 4.4 数据模型（5 张表）

#### 1. `operator` — 平台运营账号（[operator.entity.ts](file:///d:/c/saas/output/platform-service/src/entities/operator.entity.ts)）

| 字段 | 类型 | 说明 |
|---|---|---|
| id | int PK 自增 | |
| username | varchar(64) 唯一 | 登录名（seed 默认 `admin`） |
| password_hash | varchar(128) | bcrypt 哈希 |
| role | varchar(16) | 默认 `admin` |
| avatar | text 可空 | data URL / 图片地址 |
| token_version | int | 改密/改用户名后 +1，使旧 token 失效 |
| created_at | datetime | |

#### 2. `activation_code` — 激活码（[activation-code.entity.ts](file:///d:/c/saas/output/platform-service/src/entities/activation-code.entity.ts)）

| 字段 | 类型 | 说明 |
|---|---|---|
| code | varchar(32) **主键** | 激活码本身（12 位字母+数字） |
| batch_no | varchar(64) | 批次号 |
| status | varchar(16) | `unused / used / void`（[CodeStatus](file:///d:/c/saas/output/platform-service/src/common/enums.ts)） |
| bound_shop_id | int 可空 | 绑定店铺 id |
| bound_at | datetime 可空 | 绑定时间 |
| created_at | datetime | |
| expired_at | datetime 可空 | 过期时间 |

#### 3. `shop` — 店铺主数据（shopId 源头）

| 字段 | 类型 | 说明 |
|---|---|---|
| id | int PK 自增 | shopId 由本表产生，saas-service 引用 |
| name | varchar(128) | 店铺名 |
| address / phone | varchar | 地址 / 电话（默认 ''） |
| activation_code | varchar(32) 可空 | 绑定激活码 |
| status | varchar(16) | `active / disabled`（ShopStatus） |
| created_at | datetime | |

#### 4. `op_log` — 敏感操作日志

| 字段 | 类型 | 说明 |
|---|---|---|
| id | int PK | |
| operator_id | int | 操作者 |
| action | varchar(32) | `code_void` / `shop_status_update` |
| target | varchar(64) | 操作对象 |
| detail | varchar(255) | 详情 |
| created_at | datetime | |

#### 5. `system_setting` — 系统品牌设置（单行 id=1）

`system_name` / `logo` / `favicon`，供登录页等未认证场景公开读取（[settings.service.ts](file:///d:/c/saas/output/platform-service/src/modules/settings/settings.service.ts)）。

### 4.5 业务模块与接口面

统一响应结构：`{ code, message, data }`（`ResponseInterceptor` 包裹，`code === 0` 为成功；导出接口 `/export` 透传不包裹）。

#### auth 模块（[auth.controller.ts](file:///d:/c/saas/output/platform-service/src/modules/auth/auth.controller.ts) / [auth.service.ts](file:///d:/c/saas/output/platform-service/src/modules/auth/auth.service.ts)）

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/auth/login` | 登录，返回 token + 运营账号资料 |
| GET | `/auth/me` | 当前账号资料（JWT 守卫） |
| PUT | `/auth/profile` | 修改用户名 / 头像（改用户名 +token_version 失效旧 token） |
| PUT | `/auth/password` | 修改密码（校验原密码，bcrypt cost=12） |

- `AuthService.onModuleInit`：首次启动创建种子运营账号；未显式配置密码时自动生成随机密码并打印一次。
- 登录/改密接口在 controller 用 `@Throttle` 单独收紧限流。

#### codes 模块（激活码管理，[codes.controller.ts](file:///d:/c/saas/output/platform-service/src/modules/codes/codes.controller.ts) / [codes.service.ts](file:///d:/c/saas/output/platform-service/src/modules/codes/codes.service.ts)）

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/admin/codes/batch` | 批量生成（输入数量/批次号） |
| GET | `/admin/codes` | 列表查询（分页/按批次/状态筛选，关联返回绑定店铺名） |
| GET | `/admin/codes/export` | 导出 CSV（默认全部未使用，CSV 字段双引号包裹防公式注入） |
| POST | `/admin/codes/:code/void` | 作废（仅 unused 可作废；记 op_log） |

- 激活码生成：`randomCode()` 用 `randomBytes(12)` 在 62 字符集（大小写字母+数字）取模生成，去重保证唯一。
- 状态机：`unused → used`（注册绑定）/ `unused → void`（作废）；used/void 不可再变更。
- 受 `JwtAuthGuard + RolesGuard` + `@Roles(Role.Admin)` 保护。

#### shops 模块（[shops.controller.ts](file:///d:/c/saas/output/platform-service/src/modules/shops/shops.controller.ts) / [shops.service.ts](file:///d:/c/saas/output/platform-service/src/modules/shops/shops.service.ts)）

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/admin/shops` | 店铺列表（跨租户，关键字+状态筛选分页） |
| POST | `/admin/shops/:id/status` | 停用 / 启用（记 op_log + push 同步 saas-service） |

- `updateStatus`：状态变更后调用 `SaasClientService.pushShopStatus` 同步到 saas-service；push 失败仅记日志不阻断（saas 端登录 pull 兜底）。

#### internal 模块（内网接口，[internal.controller.ts](file:///d:/c/saas/output/platform-service/src/modules/internal/internal.controller.ts) / [internal.service.ts](file:///d:/c/saas/output/platform-service/src/modules/internal/internal.service.ts)）

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/internal/activation/claim` | 商家注册：校验激活码 + 建店绑定（供 saas-service 调用） |
| GET | `/internal/shops/:id/status` | 店铺状态查询（登录时校验，pull 兜底） |

- `InternalService.claim`：校验激活码状态/过期 → 事务内建店铺 + 条件更新原子抢占激活码（`WHERE code=? AND status='unused'`，affected!==1 抛错回滚），确保一码一店并发安全。
- 由 `InternalSignatureGuard` 鉴权（HMAC 签名）。

#### saas-client 模块（[saas-client.service.ts](file:///d:/c/saas/output/platform-service/src/modules/saas-client/saas-client.service.ts)）

`SaasClientService.pushShopStatus`：店铺状态变更时构造 canonical JSON + HMAC 签名，POST 到 saas-service `/internal/shop-status`。

#### op-log 模块（[op-log.service.ts](file:///d:/c/saas/output/platform-service/src/modules/op-log/op-log.service.ts)）

`OpLogService.log(operatorId, action, target, detail, meta)`：记录敏感操作（IP / UA 等元信息）。

#### settings 模块（[settings.service.ts](file:///d:/c/saas/output/platform-service/src/modules/settings/settings.service.ts)）

`getPublic` / `update`：品牌信息（系统名称/logo/favicon）的公开读取与管理员更新。

### 4.6 公共基础设施（`src/common/`）

| 文件 | 职责 |
|---|---|
| [response.interceptor.ts](file:///d:/c/saas/output/platform-service/src/common/response.interceptor.ts) | 统一响应 `{code:0, message:'ok', data}`；`/export` 路径透传 |
| [http-exception.filter.ts](file:///d:/c/saas/output/platform-service/src/common/http-exception.filter.ts) | 全局异常 → `{code:status, message, data:null}`；不向客户端暴露内部错误 |
| [business.exception.ts](file:///d:/c/saas/output/platform-service/src/common/business.exception.ts) | 业务异常类（携带业务 message） |
| [enums.ts](file:///d:/c/saas/output/platform-service/src/common/enums.ts) | `CodeStatus`(unused/used/void)、`ShopStatus`(active/disabled)、`Role`(admin) |
| [guards/jwt-auth.guard.ts](file:///d:/c/saas/output/platform-service/src/common/guards/jwt-auth.guard.ts) | JWT 登录态守卫，校验 `Authorization: Bearer <token>` + token_version |
| [guards/roles.guard.ts](file:///d:/c/saas/output/platform-service/src/common/guards/roles.guard.ts) | 角色守卫，配合 `@Roles()` 限定管理接口 |
| [guards/internal-signature.guard.ts](file:///d:/c/saas/output/platform-service/src/common/guards/internal-signature.guard.ts) | 内网 HMAC 签名守卫（见下） |
| [decorators/current-user.decorator.ts](file:///d:/c/saas/output/platform-service/src/common/decorators/current-user.decorator.ts) | `@CurrentUser()` 注入当前运营账号 |

#### 内网签名规范（[internal-signature.guard.ts](file:///d:/c/saas/output/platform-service/src/common/guards/internal-signature.guard.ts)）

- 请求头：`X-Internal-Key` / `X-Internal-Timestamp` / `X-Internal-Signature`（可选 `X-Internal-Nonce` 重放去重，10 分钟窗口）
- 签名串 = `${timestamp}.${METHOD}.${path}.${canonicalBody}`，HMAC-SHA256(INTERNAL_SHARED_SECRET)
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
> 定位：商家端后端（账号、菜品、桌台、结账方式、订单、账目），多租户按店铺隔离。
> 默认端口：**3200**；数据库：`data/saas.db`
> 依赖 platform-service（注册时跨服务调用），需先启动 platform-service。

### 5.1 技术栈

NestJS + TypeORM + better-sqlite3 + @nestjs/jwt + bcryptjs + class-validator。与 platform-service 同构，但额外有 **ShopStatusGuard**（店铺停用全局拦截）。

### 5.2 启动流程（[main.ts](file:///d:/c/saas/output/saas-service/src/main.ts)）

创建应用 → `setGlobalPrefix('')` → 全局 `ValidationPipe`(whitelist+transform) + `ResponseInterceptor` + `HttpExceptionFilter` → `app.listen(port)`。

### 5.3 顶层模块（[app.module.ts](file:///d:/c/saas/output/saas-service/src/app.module.ts)）

```ts
@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'better-sqlite3',
      database: getConfig().dbPath,
      entities: [User, Table, Area, PaymentMethod, Dish, Order,
                 Shop, Category, Attribute, Setmeal, ShopBucket],
      synchronize: true,
    }),
    TypeOrmModule.forFeature([Shop]),
    JwtModule.register({ global: true, secret: ..., signOptions: { expiresIn: ... } }),
    AuthModule, StaffModule, DishesModule, CategoriesModule, AttributesModule,
    SetmealsModule, BucketsModule, TablesModule, AreasModule,
    PaymentsModule, OrdersModule, ReportsModule, InternalModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ShopStatusGuard }],
})
```

### 5.4 数据模型（11 张表）

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
| [PaymentMethod](file:///d:/c/saas/output/saas-service/src/entities/payment-method.entity.ts) | payment_methods | shop_id, name, sort, enabled | 结账方式 |
| [Order](file:///d:/c/saas/output/saas-service/src/entities/order.entity.ts) | orders | shop_id, order_no, mode, table_id/ticket_no, status, items(JSON), total_amount/paid_amount/change_amount(**分**), payment_method_id/name, remark, settled_at | 收银记账单 |
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

#### auth 模块（[auth.controller.ts](file:///d:/c/saas/output/saas-service/src/modules/auth/auth.controller.ts) / [auth.service.ts](file:///d:/c/saas/output/saas-service/src/modules/auth/auth.service.ts)）

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/auth/register` | 注册新店铺（跨服务 claim + 建老板账号 + 初始配置） |
| POST | `/auth/login` | 登录，签发 JWT（含 userId/shopId/role/phone） |
| POST | `/auth/forgot-password` | 忘记密码（统一提示，不暴露账号是否存在） |
| GET | `/auth/me` | 当前用户信息（JWT 守卫） |

- **注册链路**（`AuthService.register`）：
  1. 校验手机号全局唯一
  2. 调 `PlatformClientService.claim`（内网签名）→ 返回 shopId
  3. 事务内建老板账号 + 本地店铺快照 + 默认桌台（DEFAULT_TABLE_COUNT 个）+ 默认结账方式（现金/微信/支付宝）
  4. 本地失败则记 error 日志（激活码已在平台端置 used，需人工核对）
- **登录链路**（`AuthService.login`）：
  1. 账号密码校验（bcrypt）+ 账号状态校验
  2. 店铺状态校验：优先 pull 平台端权威状态（停用立即生效），失败回退本地快照
  3. 签发 JWT，下发用户信息 + 店铺名（供后台 TopBar 展示）

#### platform-client（[platform-client.service.ts](file:///d:/c/saas/output/saas-service/src/modules/auth/platform-client.service.ts)）

平台端内部接口客户端：
- `claim(dto)`：POST `/internal/activation/claim`，构造 canonical JSON + HMAC 签名调用平台端建店绑码。
- `getShopStatus(shopId)`：GET `/internal/shops/:id/status`，登录时 pull 店铺状态。
- canonicalJson 与平台端 `InternalSignatureGuard` 完全一致（key 排序）。

#### dishes 模块（[dishes.controller.ts](file:///d:/c/saas/output/saas-service/src/modules/dishes/dishes.controller.ts)）

后台 `admin/dishes` 增删改查 / 导入 / 排序 / 上下架 / 沽清；点餐菜单 `GET dishes/menu`。使用 JWT + 角色守卫 + `@Roles` 限制。

#### orders 模块（收银工作台，[orders.controller.ts](file:///d:/c/saas/output/saas-service/src/modules/orders/orders.controller.ts)）

`@Roles(UserRole.Boss, UserRole.Cashier)`

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/orders` | 下单（开台 + 点餐合并） |
| GET | `/orders` | 订单流（按状态筛选分页） |
| POST | `/orders/:id/confirm` | 接单 |
| POST | `/orders/:id/reject` | 拒单（释放桌台） |
| POST | `/orders/:id/settle` | 结账记账（释放桌台） |
| POST | `/orders/:id/free` | 免单（金额记 0，释放桌台） |
| POST | `/orders/:id/on-account` | 挂账（释放桌台，可补收） |

#### reports 模块（看账，[reports.service.ts](file:///d:/c/saas/output/saas-service/src/modules/reports/reports.service.ts)）

- `today(user)`：今日概览
- `summary(user, from, to)`：日期范围营业汇总（营业额 = 已结账实收之和，免单实收 0 不计入；按结账方式汇总）
- `orderList(user, from, to, page, pageSize)`：日期范围订单明细（已结账 + 挂账）
- 金额分↔元换算在 service 层完成。

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
| internal | `/internal` | 内网接口（接收 platform-service push 的店铺状态同步） |

### 5.7 公共基础设施（`src/common/`）

| 文件 | 职责 |
|---|---|
| [guards/jwt-auth.guard.ts](file:///d:/c/saas/output/saas-service/src/common/guards/jwt-auth.guard.ts) | JWT 登录态守卫 |
| [guards/roles.guard.ts](file:///d:/c/saas/output/saas-service/src/common/guards/roles.guard.ts) | 角色守卫 |
| [guards/shop-status.guard.ts](file:///d:/c/saas/output/saas-service/src/common/guards/shop-status.guard.ts) | **店铺停用全局守卫**：解析 JWT → 查本地店铺快照 → 停用则 403；无 token / 无效 token 放行交给 JwtAuthGuard |
| [guards/internal-signature.guard.ts](file:///d:/c/saas/output/saas-service/src/common/guards/internal-signature.guard.ts) | 内网签名守卫（接收 platform-service 调用） |
| [decorators/current-user.decorator.ts](file:///d:/c/saas/output/saas-service/src/common/decorators/current-user.decorator.ts) | `@CurrentUser()` 注入 AuthUser（含 userId/shopId/role） |
| [decorators/roles.decorator.ts](file:///d:/c/saas/output/saas-service/src/common/decorators/roles.decorator.ts) | `@Roles(...)` 角色标注 |
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

`npm install` → `npm run build` → `npm start`；`npm run smoke`（需先启动 platform-service）。

---

## 六、跨服务协作与多租户隔离

### 6.1 注册链路（跨服务）

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

### 6.2 店铺状态同步（push + pull 兜底）

```
platform-service  ──push(HMAC 签名)──▶  saas-service   （店铺停用/启用即时生效）
      ▲  ▲
      │  └─ pull：商家登录时 GET /internal/shops/:id/status 校验（兜底，确保停用立即生效）
      │
      └── 商家注册：saas-service 调 POST /internal/activation/claim（校验激活码 + 建店）
```

- 平台端停用店铺 → `SaasClientService.pushShopStatus` 同步到 saas-service `/internal/shop-status`（失败不阻断）。
- saas-service 全局 `ShopStatusGuard` 解析 JWT → 查本地快照 → 停用则 403。
- 登录时 `AuthService.login` 主动 pull 平台端权威状态，刷新本地快照。

### 6.3 多租户隔离实现要点

- 所有业务表带 `shop_id`，后端从 JWT 解析 shopId 并按租户过滤所有查询。
- `@CurrentUser()` 装饰器从 JWT 注入 `AuthUser`（含 shopId），所有 service 按 `user.shopId` 隔离。
- 平台端接口仅限运营身份访问；`/internal/*` 仅限内网签名访问。
- 测试必须覆盖：A 店 token 访问 B 店数据返回 403 / 空。

---

## 七、merchant-web（商家后台 Web · React）

> 路径：`merchant-web`；定位：食刻商户后台 Web 管理后台（设计稿转码），仅老板登录。
> 技术栈：React 18 + TypeScript + Vite 5 + Ant Design 6 + dayjs + xlsx（导入导出）。

### 7.1 入口与顶层（[main.tsx](file:///d:/c/saas/merchant-web/src/main.tsx) / [App.tsx](file:///d:/c/saas/merchant-web/src/App.tsx)）

- `main.tsx`：初始化 dayjs 中文 + 应用主题 + antd `ConfigProvider`（中文包）+ 挂载 App。
- `App.tsx` 核心职责：
  1. **画布缩放** `useCanvasScale`：按固定设计稿画布（主框架 1600×900，登录页 1440×900）绘制，运行时 `transform: scale()` 整体等比缩放铺满视口（窗口 < 1600 用 contain，更大用 cover）。
  2. **自研 hash 路由**（无 React Router）：`viewKeyToHash` / `hashToViewKey` 做 `#/ops/...` ↔ 视图映射，监听 `hashchange`。
  3. **多页签系统**：`tabs` 状态渲染多页签，当前页才 `display:flex`；切换/关闭页签、清空页签。
  4. **登录态**：启动时 `GET /auth/me` 刷新用户信息；失效则清会话回登录页。
  5. **状态持久化**：当前视图/分组/页签/主题全部存 localStorage（`merchant_*` 前缀）。
  6. **页面懒加载**：所有业务页 `lazy(() => import(...))`，首屏只加载当前页与框架。

### 7.2 HTTP 封装（[api/http.ts](file:///d:/c/saas/merchant-web/src/api/http.ts)）

- `request<T>(path, options)`：基于 fetch，自动注入 `Authorization: Bearer <token>`。
- token 持久化：`merchant_token` / `merchant_user` / `merchant_shop`。
- 401 处理：默认清会话 + 整页刷新；`skip401Redirect` 选项用于登录/注册等未登录态接口（401 当普通业务错误抛出）。
- 业务错误码：`json.code !== 0` 抛 `ApiError`。
- api 模块：`auth / areas / attributes / buckets / categories / dishes / setmeals / tables / types`。

### 7.3 菜单元数据（[data/navigation.ts](file:///d:/c/saas/merchant-web/src/data/navigation.ts)）

定义 `NAV_GROUPS`（运营中心 `ops` + 报表中心 `rpt`），枚举所有 `ViewKey`（如 `ops:home`、`ops:dish:library`、`rpt:biz-stats`）。`findViewMeta(key)` 查找菜单标签与分组，驱动侧边栏、顶部导航和路由映射。

### 7.4 Vite 配置（[vite.config.ts](file:///d:/c/saas/merchant-web/vite.config.ts)）

- 开发端口 5175，proxy：`/auth`、`/admin`、`/tables` → `http://127.0.0.1:3200`（saas-service）。
- gzip 预压缩（`vite-plugin-compression`）。
- vendor 拆分：`react-vendor`、`antd-vendor`、`dayjs` 独立 chunk（利于长期缓存）。

### 7.5 页面（19 个，[views/](file:///d:/c/saas/merchant-web/src/views)）

| ViewKey | 文件 | 职责 |
|---|---|---|
| `ops:home` | OpsHome.tsx | 运营中心首页 |
| `ops:restaurant:table` | TableManage.tsx | 桌台管理（区域/桌台 tab、搜索、批量、分页） |
| `ops:checkout` | CheckoutManage.tsx | 结账方式管理 |
| `ops:checkout:coupon` | VoucherManage.tsx | 券类管理 |
| `ops:checkout:discount` | DiscountManage.tsx | 优惠折扣 |
| `ops:print:assign` | PrintAssign.tsx | 打印分配 |
| `ops:print:station` | StallManage.tsx | 档口管理 |
| `ops:business:must` | MustDish.tsx | 必点菜设置 |
| `ops:business:mode` | BusinessMode.tsx | 营业模式设置 |
| `ops:dish:library` | DishLibrary.tsx | 菜品库（后端数据→前端展示模型转换） |
| `ops:dish:category` | DishCategory.tsx | 菜单分类 |
| `ops:dish:attribute` | DishAttribute.tsx | 菜品属性 |
| `ops:archive:store` | StoreProfile.tsx | 门店档案 |
| `ops:archive:staff` | StaffManage.tsx | 员工档案 |
| `ops:archive:role` | RoleManage.tsx | 角色档案 |
| `rpt:home` | ReportHome.tsx | 报表首页 |
| `rpt:biz-stats` | BizStats.tsx | 综合营业统计 |
| — | AuthScreen.tsx | 登录页（登录/注册/忘记密码；拦截非 boss 角色） |
| — | PlaceholderView.tsx | 占位页 |

> 部分页面（如 StallManage、PrintAssign）**纯前端 localStorage 存储**（自增 `KEY_vN` 版本）。

### 7.6 组件（20 个，[components/](file:///d:/c/saas/merchant-web/src/components)）

`TopBar / Drawer / TabsBar / ConfirmModal / Toast / CommonSelect / Pagination / SearchForm / StatCard / EmptyState / Icon / SortAreaModal / SortDishModal / EditAreaModal / AddAreaModal / AddTableModal / BatchAddTableModal / BatchDeleteAreasModal / BatchDeleteTableModal / BatchImportTableModal / BatchImportDishModal / CreateSetMealModal / DishPickerModal / SelectDishesModal`

- `TabsBar`：多页签 UI，与 App.tsx 页签状态逻辑配套。
- `ConfirmModal`：替代 `window.confirm`，支持键盘确认/取消、危险样式。

### 7.7 样式与主题

- **单一 `global.css`（约 5576 行）**，原生 CSS 变量主题（`--color-*`、`--ctrl-radius`），无 CSS Modules / Tailwind / 预处理器。
- 主题切换（[theme.ts](file:///d:/c/saas/merchant-web/src/theme.ts)）：`html[data-theme="dark|light"]` 切换 CSS 变量；antd 未接入主题，样式全部手写。

### 7.8 脚本

| 命令 | 说明 |
|---|---|
| `npm run dev` | Vite 开发（5175） |
| `npm run build` | `tsc -b && vite build` |
| `npm run preview` | 预览产物 |

辅助脚本（[scripts/](file:///d:/c/saas/merchant-web/scripts)）：`read_meituan.*` / `analyze_meituan.cjs` / `convert_meituan.cjs` / `import_dishes_to_backend.cjs` / `verify_convert.cjs`（美团菜品数据读取/转换/导入）。

---

## 八、platform-admin-web（平台后台 Web · Vue3）

> 路径：`output/platform-admin-web`；定位：平台方网页后台（运营端），激活码管理 + 店铺信息管理。
> 技术栈：Vue 3 + TypeScript + Vite + Pinia + Vue Router（History 模式）。

### 8.1 入口与路由（[main.ts](file:///d:/c/saas/output/platform-admin-web/src/main.ts) / [router/index.ts](file:///d:/c/saas/output/platform-admin-web/src/router/index.ts)）

- `main.ts`：`createApp(App)` + Pinia + Router + 全局样式；启动时 `useSettingsStore().load()` 拉取品牌设置（系统名/logo/favicon）。
- 路由：`/login`（登录页）；`/`（AppView 主框架）下含 `codes` / `shops` / `settings` 子路由，默认重定向到 `/codes`。
- 全局守卫：未登录跳登录页；已登录访问 `/login` 重定向到 `/codes`。

### 8.2 状态管理（[stores/](file:///d:/c/saas/output/platform-admin-web/src/stores)）

- `auth.ts`：token / 用户信息持久化（localStorage `platform_admin_token` / `platform_admin_user`）。
- `settings.ts`：品牌信息（系统名/logo/favicon）。

### 8.3 HTTP 封装（[api/http.ts](file:///d:/c/saas/output/platform-admin-web/src/api/http.ts)）

- `request<T>(path, options)`：fetch 封装，支持 query/params、body、`raw`（blob 下载）、超时（默认 8000ms）、外部 `AbortSignal`。
- 401 自动清会话跳 `/login`；429 友好提示「操作过于频繁」。
- api 模块：`auth / codes / shops / settings / types`。

### 8.4 页面（[views/](file:///d:/c/saas/output/platform-admin-web/src/views)）

| 视图 | 职责 |
|---|---|
| LoginView.vue | 运营登录 |
| AppView.vue | 主框架（侧边栏 + 顶栏 + 路由出口） |
| CodesView.vue | 激活码管理（批量生成 / 列表筛选 / 作废 / 导出 CSV） |
| ShopsView.vue | 店铺信息管理（跨租户列表 / 停用启用） |
| SettingsView.vue | 系统品牌设置 |

### 8.5 其他

- `composables/useToast.ts`：通用 toast。
- `utils/format.ts`：格式化工具。
- 截图（[screenshots/](file:///d:/c/saas/output/platform-admin-web/screenshots)）：登录/激活码/店铺等页面截图。

---

## 九、saas-admin-web（商家管理后台 Web · Vue3）

> 路径：`output/saas-admin-web`；定位：商家管理后台 Web（仅老板）。
> 技术栈：Vue 3 + TypeScript + Vite + Pinia + Vue Router。

### 9.1 入口与路由（[main.ts](file:///d:/c/saas/output/saas-admin-web/src/main.ts) / [router/index.ts](file:///d:/c/saas/output/saas-admin-web/src/router/index.ts)）

- 路由：由菜单配置 `collectLeaves()` 自动生成叶子路由，`/`（AppView）下挂所有叶子，默认重定向 `/ops/home`；`/login` 登录页；通配符重定向。
- 路由守卫：`requiresAuth` 路由要求 **token + user + role==='boss'**，否则跳登录页（商家后台仅老板可用）。
- 当前各功能页统一指向 `PlaceholderView.vue`（后续逐步替换 component）。

### 9.2 菜单配置（[config/menu.ts](file:///d:/c/saas/output/saas-admin-web/src/config/menu.ts)）

定义 `modules`（含 `children`，children 可为 `leaf` 或 `group` 嵌套）；`collectLeaves()` 收集所有叶子节点驱动路由生成。

### 9.3 状态与 HTTP

- `stores/auth.ts`：token / 用户信息。
- `api/`：`auth / http / types`（http 封装同 platform-admin-web 风格）。

### 9.4 页面

LoginView.vue（登录）、AppView.vue（主框架）、PlaceholderView.vue（占位，待功能填充）。

---

## 十、部署与运行方式

### 10.1 本地开发

| 工程 | 启动命令 | 端口 | 依赖 |
|---|---|---|---|
| platform-service | `cd output/platform-service && npm i && npm run start:dev` | 3100 | 无（先启） |
| saas-service | `cd output/saas-service && npm i && npm run start:dev` | 3200 | 先启 platform-service |
| merchant-web | `cd merchant-web && npm i && npm run dev` | 5175 | saas-service（proxy /auth /admin /tables → 3200） |
| platform-admin-web | `cd output/platform-admin-web && npm i && npm run dev` | Vite 默认 | platform-service |
| saas-admin-web | `cd output/saas-admin-web && npm i && npm run dev` | Vite 默认 | saas-service |

> 跨服务签名密钥本地默认 `dev-internal-secret`，两端一致即可。

### 10.2 生产部署（腾讯云 Ubuntu）

部署脚本：[scripts/deploy/](file:///d:/c/saas/scripts/deploy)，不安装面板（无 MySQL/Redis），全部软件源适配腾讯云内网镜像 + npmmirror，**不依赖国际网络**。

服务器目录结构：

```
/opt/saas/
├── scripts/              ← 部署脚本
├── output/
│   ├── platform-service/ ← 平台端服务源码
│   └── saas-service/     ← 商家端服务源码
├── backups/              ← 每日备份
└── logs/                 ← 运行日志
```

执行步骤：

| 步骤 | 脚本 | 作用 |
|---|---|---|
| ① | [01-apt-tencent.sh](file:///d:/c/saas/scripts/deploy/01-apt-tencent.sh) | apt 换腾讯云内网源 + 装基础软件（nginx、sqlite3、编译工具） |
| ② | [02-install-node.sh](file:///d:/c/saas/scripts/deploy/02-install-node.sh) | 安装 Node.js 22（npmmirror 国内镜像下载） |
| ③ | [03-deploy.sh](file:///d:/c/saas/scripts/deploy/03-deploy.sh) | 安装依赖 + 构建两服务 + 生成 `.env` + **pm2** 启动 |
| ④ | [04-nginx.sh](file:///d:/c/saas/scripts/deploy/04-nginx.sh) | 配置 Nginx（反代 3100/3200 + 托管前端静态文件） |
| ⑤ | [05-backup.sh](file:///d:/c/saas/scripts/deploy/05-backup.sh) | 每日备份（crontab 凌晨 2 点，保留 30 天） |

[03-deploy.sh](file:///d:/c/saas/scripts/deploy/03-deploy.sh) 关键逻辑：

- 生成**同一个** `SHARED_SECRET`（`openssl rand -hex 32`）写入三处（platform 的 `INTERNAL_SHARED_SECRET` / `SAAS_INTERNAL_SECRET` + saas 的 `PLATFORM_INTERNAL_SECRET`），保证两端互通。
- 平台运营初始密码随机生成（`openssl rand -hex 8`），打印提示立即保存。
- JWT_SECRET 各自随机生成。
- pm2 托管两个进程 + `pm2 startup` 开机自启。

### 10.3 生产环境必改项

| 项 | 位置 | 说明 |
|---|---|---|
| JWT 密钥 | 两个 `.env` 的 `JWT_SECRET` | 03 脚本已自动随机生成，勿改回默认 |
| 内部签名密钥 | 三个 `*_SECRET` 字段 | 03 脚本生成同一随机值写入三处 |
| 运营初始密码 | `platform-service/.env` 的 `SEED_OPERATOR_PASSWORD` | 03 脚本随机生成，部署后立即登录 |
| HTTPS | Nginx | 建议申请免费 SSL |

### 10.4 辅助脚本（仓库根）

- [rebuild-restart.ps1](file:///d:/c/saas/rebuild-restart.ps1) / [restart-saas.ps1](file:///d:/c/saas/restart-saas.ps1) / [start-merchant.ps1](file:///d:/c/saas/start-merchant.ps1)：本地构建重启。
- [seed_area.js](file:///d:/c/saas/seed_area.js) / [revert_area.js](file:///d:/c/saas/revert_area.js)：餐区数据种子/回退。
- [parse_xlsx.py](file:///d:/c/saas/parse_xlsx.py)：Excel 解析。
- [scripts/deploy_remote.py](file:///d:/c/saas/scripts/deploy_remote.py)：远程部署辅助。

---

## 十一、依赖关系总览

### 11.1 服务间依赖

```
platform-service ──push/pull──▶ saas-service
      ▲                              │
      │ claim（注册建店）              │
      └──────────────────────────────┘
```

- saas-service **依赖** platform-service（注册 claim、登录 pull 状态）。
- platform-service **单向 push** saas-service（停用同步，失败有 pull 兜底）。
- 启动顺序：先 platform-service，后 saas-service。

### 11.2 前端→后端依赖

| 前端 | 后端 |
|---|---|
| merchant-web（React） | saas-service :3200（/auth /admin /tables）+ platform-service :3100 |
| platform-admin-web（Vue3） | platform-service :3100 |
| saas-admin-web（Vue3） | saas-service :3200 |

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
orders ──▶ order + table(释放) + dish(快照)
dishes / categories / attributes / setmeals ──▶ 各自 entity
areas / tables ──▶ area / table
payments ──▶ payment-method
reports ──▶ order + orders(toItem)
internal ──▶ shop(snapshot 更新) + (InternalSignatureGuard)
buckets ──▶ shop-bucket
```

### 11.5 后端公共依赖

两个服务共享同构的 `common/` 基础设施（response.interceptor / http-exception.filter / business.exception / guards / decorators / enums），约定一致的统一响应格式 `{code, message, data}` 与 HMAC canonicalJson 序列化。

---

## 十二、安全体系与关键约定

### 12.1 安全体系

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
| 敏感操作日志 | `OpLogService`（platform） | 作废激活码、店铺停用/启用等记 op_log |
| token 失效 | token_version | platform 改用户名/改密后 +1，使旧 token 失效 |

### 12.2 关键约定

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
| 命名规范 | API 命名统一小写下划线（如 `shop_id`、`bound_shop_id`）；业务状态用枚举管理 |
| CSV 导出 | 字段双引号包裹，防 Excel 公式注入（`= +/- @` 开头） |

---

> 本 Wiki 基于仓库当前代码状态生成。各工程根目录另有 `TECH-STACK.md` / `README.md` / `OVERVIEW.md` / `PERF-REPORT.md` 等专项文档可作补充阅读。
