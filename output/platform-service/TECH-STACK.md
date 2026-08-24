# 收银云平台服务端（platform-service）技术信息

> 用途：交接给审计/协作方使用，便于理解服务端架构、数据模型与接口面。
> 定位：餐饮收银 SaaS 平台端服务（激活码 + 店铺主数据），即「平台后台」的 API。
> 更新时间：2026-08-24

## 一、核心技术栈

| 项 | 选型 | 版本 |
|---|---|---|
| 框架 | **NestJS**（Express 平台） | ^10.4.15 |
| 语言 | TypeScript | ^5.7.3 |
| ORM | **TypeORM**（`@nestjs/typeorm`） | ^0.3.20 / ^10.0.2 |
| 数据库 | **better-sqlite3**（SQLite，单文件库） | ^12.2.0 |
| 认证 | **@nestjs/jwt**（JWT，8h 有效期） | ^10.2.0 |
| 密码 | bcryptjs | ^2.4.3 |
| 校验 | class-validator + class-transformer（全局 `ValidationPipe`） | ^0.14.1 / ^0.5.1 |
| 环境 | dotenv（`src/config/env.ts` 读取） | ^16.4.7 |
| 运行 | ts-node（dev）/ tsc（build） | ^10.9.2 |

## 二、运行方式

| 命令 | 说明 |
|---|---|
| `npm run start:dev` | 开发（ts-node + tsconfig-paths），默认端口 **3100** |
| `npm run build` | tsc 编译到 `dist/` |
| `npm start` | 运行 `dist/main.js` |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run smoke` | smoke 冒烟脚本（`scripts/smoke.mjs`） |

启动时 `main.ts` 自动创建数据库目录、启动 CORS、挂载全局 `ValidationPipe`（whitelist + transform）、`ResponseInterceptor`（统一响应结构）与 `HttpExceptionFilter`。

## 三、目录结构

```
platform-service/
├── scripts/smoke.mjs          # 冒烟测试脚本
├── data/platform.db           # SQLite 数据库（运行时生成，gitignore）
├── .env                       # 环境变量（可选项，见第六节）
└── src/
    ├── main.ts                # 启动入口
    ├── app.module.ts          # TypeORM 配置 + 6 个业务模块
    ├── config/env.ts          # 环境配置集中读取
    ├── common/                # 守卫 / 装饰器 / 过滤器 / 枚举
    │   ├── guards/
    │   │   ├── jwt-auth.guard.ts          # JWT 登录态守卫
    │   │   ├── roles.guard.ts             # 角色守卫（@Roles）
    │   │   └── internal-signature.guard.ts# 内网 HMAC 签名守卫
    │   ├── decorators/current-user.decorator.ts
    │   ├── business.exception.ts
    │   ├── enums.ts            # Role / CodeStatus / ShopStatus
    │   ├── http-exception.filter.ts       # 异常 → {code, message, data}
    │   └── response.interceptor.ts        # 成功响应统一包裹
    ├── entities/              # 4 张表（见第四节）
    └── modules/
        ├── auth/              # 登录 / 资料 / 改密
        ├── codes/             # 激活码管理
        ├── shops/             # 店铺管理
        ├── internal/          # 内网接口（saas-service 调用）
        ├── op-log/            # 敏感操作日志
        └── saas-client/       # 调用 saas-service 的客户端
```

## 四、数据模型（SQLite · TypeORM `synchronize: true`）

> 注意：`synchronize: true` 会自动建表/同步结构，生产环境需评估迁移策略。

### 1. `operator` — 平台运营账号
| 字段 | 类型 | 说明 |
|---|---|---|
| id | int PK 自增 | |
| username | varchar(64) 唯一 | 登录名（seed 默认 `admin`） |
| password_hash | varchar(128) | bcrypt 哈希 |
| role | varchar(16) | 默认 `admin`（枚举 `Role`） |
| avatar | text 可空 | data URL / 图片地址 |
| created_at | datetime | |

### 2. `activation_code` — 激活码
| 字段 | 类型 | 说明 |
|---|---|---|
| code | varchar(32) **主键** | 激活码本身 |
| batch_no | varchar(64) | 批次号 |
| status | varchar(16) | `unused / bound / void`（`CodeStatus`） |
| bound_shop_id | int 可空 | 绑定店铺 id |
| bound_at | datetime 可空 | 绑定时间 |
| created_at | datetime | |
| expired_at | datetime 可空 | 过期时间 |

### 3. `shop` — 店铺主数据（shopId 源头）
| 字段 | 类型 | 说明 |
|---|---|---|
| id | int PK 自增 | shopId 由本表产生，saas-service 引用 |
| name | varchar(128) | 店铺名 |
| address | varchar(255) | 地址（默认 ''） |
| phone | varchar(32) | 电话（默认 ''） |
| activation_code | varchar(32) 可空 | 绑定激活码 |
| status | varchar(16) | `active / disabled`（`ShopStatus`） |
| created_at | datetime | |

### 4. `op_log` — 敏感操作日志
| 字段 | 类型 | 说明 |
|---|---|---|
| id | int PK 自增 | |
| operator_id | int | 操作者（运营账号 id） |
| action | varchar(32) | `code_void` / `shop_status_update` |
| target | varchar(64) | 操作对象（激活码 / 店铺 id） |
| detail | varchar(255) | 详情 |
| created_at | datetime | |

## 五、接口面（REST / JSON）

统一响应结构：`{ code, message, data }`（`ResponseInterceptor` 包裹，`code === 0` 为成功）。

### 认证 `auth`（JwtAuthGuard 保护后三个）
| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/auth/login` | 登录，返回 token + 运营账号资料 |
| GET | `/auth/me` | 当前账号资料 |
| PUT | `/auth/profile` | 修改用户名 / 头像 |
| PUT | `/auth/password` | 修改密码 |

### 激活码 `admin/codes`（JwtAuthGuard + RolesGuard，需 `admin` 角色）
| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/admin/codes/batch` | 批量生成激活码 |
| GET | `/admin/codes` | 列表查询（分页/筛选） |
| GET | `/admin/codes/export` | 导出 CSV（定义在 `:code` 动态路由前） |
| POST | `/admin/codes/:code/void` | 作废激活码 |

### 店铺 `admin/shops`（JwtAuthGuard + RolesGuard，需 `admin` 角色）
| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/admin/shops` | 店铺列表（跨租户） |
| POST | `/admin/shops/:id/status` | 停用 / 启用（记日志 + 同步 saas-service） |

### 内网 `internal`（InternalSignatureGuard，供 saas-service 调用）
| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/internal/activation/claim` | 商家注册：校验激活码 + 建店绑定 |
| GET | `/internal/shops/:id/status` | 店铺状态查询（登录时校验，pull 兜底） |

## 六、环境配置（`src/config/env.ts`，均有默认值）

| 变量 | 默认 | 说明 |
|---|---|---|
| PORT | `3100` | 服务端口 |
| DB_PATH | `data/platform.db` | SQLite 文件路径 |
| JWT_SECRET | `dev-secret-change-me` | JWT 签名密钥（生产必改） |
| JWT_EXPIRES_IN | `8h` | 登录态有效期 |
| INTERNAL_SHARED_SECRET | `dev-internal-secret` | 自身内网签名密钥 |
| SAAS_INTERNAL_BASE_URL | `http://127.0.0.1:3200` | saas-service 地址 |
| SAAS_INTERNAL_SECRET | `dev-internal-secret` | 调用 saas-service 的签名密钥 |
| SEED_OPERATOR_USERNAME | `admin` | 种子运营账号 |
| SEED_OPERATOR_PASSWORD | `admin123456` | 种子密码 |

## 七、安全体系

1. **登录态**：`JwtAuthGuard` 校验 `Authorization: Bearer <token>`，payload 为 `OperatorPayload`（`userId` + `role`）；
2. **角色控制**：`RolesGuard` + `@Roles(Role.Admin)` 限定管理接口；
3. **内网签名**：`InternalSignatureGuard` — 与 saas-service 约定 HMAC-SHA256 规范序列化（key 排序的 canonical JSON），头字段 `x-internal-key` / `x-internal-timestamp` / `x-internal-signature`；
4. **密码**：bcryptjs 哈希存储；
5. **日志**：作废激活码、店铺停用/启用等敏感操作写入 `op_log`。

## 八、与 saas-service（商家服务端）的协作

```
platform-service  ──push(HMAC 签名)──▶  saas-service   （店铺停用/启用即时生效）
      ▲  ▲
      │  └─ pull：商家登录时 /internal/shops/:id/status 校验（兜底，确保停用立即生效）
      │
      └── 商家注册：saas-service 调用 /internal/activation/claim（校验激活码 + 建店）
```

- `SaasClientService.pushShopStatus`：同步店铺状态，失败仅记日志不阻断（有 pull 兜底）；
- 规范序列化函数 `canonicalJson` 与 saas-service 的 `InternalSignatureGuard` 保持一致（key 排序）。
