# 《安全审计报告》—— platform-service（收银云平台服务端）

| 项 | 内容 |
|---|---|
| 审计对象 | `D:\c\saas\output\platform-service`（NestJS 10 / TypeORM / better-sqlite3 / JWT） |
| 审计范围 | 全部 39 个 TS 源码文件 + 配置文件 + 编译产物 + 依赖树（全量） |
| 审计依据 | OWASP Top 10 (2021)、NIST 密码指南、CWE |
| 审计时间 | 2026-08-24 |
| 审计方式 | 静态代码审查 + 依赖漏洞扫描（npm audit） |

## 一、结论总览

整体安全基线**中等偏弱**：分层鉴权（JWT + Roles + 内网 HMAC 签名）框架设计清晰，参数化查询贯穿始终，**未发现 SQL 注入 / XSS / 路径遍历 / 不安全反序列化等传统高危注入类漏洞**。主要风险集中在：**默认弱密钥与弱口令、激活码并发竞态、登录无防爆破、依赖存在已知高危漏洞**。

### 风险统计

| 等级 | 数量 | 关键词 |
|---|---|---|
| 🔴 Critical | 2 | 默认密钥/弱口令、激活码 claim 竞态 |
| 🟠 High | 3 | 登录无防爆破、错误信息泄露、依赖高危漏洞 |
| 🟡 Medium | 7 | CORS 全开、激活码过期未校验、签名重放、synchronize、sourcemap、CSV 注入、安全响应头缺失 |
| 🟢 Low | 6 | 密码策略弱、角色延迟生效、bcrypt cost、参数格式校验、脚本不一致、canonicalJson 浅排序 |

---

## 二、Critical（必须修复）

### C1. 默认弱密钥 + 默认弱口令，可伪造管理员 JWT 与内网签名【A05 / A07】

- **位置**：`src/config/env.ts:17,19,21,23`
- **风险**：`JWT_SECRET`、`INTERNAL_SHARED_SECRET`、`SAAS_INTERNAL_SECRET`、种子密码 `admin123456` 全部有公开默认值。若生产部署未配置 `.env`（当前仓库内 `.env` 不存在，运行时必然回落到默认值），攻击者可：
  1. 用 `dev-secret-change-me` 伪造任意管理员 JWT → 完全接管激活码管理与店铺停用；
  2. 用 `dev-internal-secret` 伪造内网签名 → 任意调用 `/internal/activation/claim` 与状态查询。
- **利用路径**：`POST /auth/login`（admin/admin123456）→ 直接拿到管理员 token；或自行伪造 `Authorization: Bearer <伪造token>`。

**修复方案（启动时硬校验，不满足即拒绝启动）**：

```ts
// src/config/env.ts 末尾追加
function assertSecret(name: string, value: string): void {
  const DEFAULTS = new Set(['dev-secret-change-me', 'dev-internal-secret', 'internal-shared-secret-change-me']);
  if (DEFAULTS.has(value) || value.length < 32) {
    throw new Error(
      `[FATAL] ${name} 必须替换为随机强密钥（≥32 字符），禁止使用默认值。` +
      `生成示例：node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`,
    );
  }
}
assertSecret('JWT_SECRET', config.jwtSecret);
assertSecret('INTERNAL_SHARED_SECRET', config.internalSecret);
assertSecret('SAAS_INTERNAL_SECRET', config.saasInternalSecret);
```

种子密码改为**首启随机生成并仅打印一次**（或强制首登改密）：

```ts
if (!exists) {
  const pwd = randomBytes(12).toString('base64url'); // 或要求运维传入
  await this.operatorRepo.save(this.operatorRepo.create({
    username: config.seedOperatorUsername, password_hash: await hash(pwd, 12), role: 'admin',
  }));
  this.logger.warn(`种子账号已创建，一次性密码（仅此一次打印）：${pwd}`);
}
```

> ⚠️ **涉及 `env.ts` 与种子逻辑改动，请人工复核后再应用。**

---

### C2. 激活码 claim 存在并发竞态，同一激活码可绑定两家店铺【A01 失效的访问控制 / 业务逻辑漏洞】

- **位置**：`src/modules/internal/internal.service.ts:32-57` + `src/entities/shop.entity.ts:19`
- **风险**：状态检查（`findOne`）在**事务外**执行，事务内是无条件 `save`（UPDATE），`shop.activation_code` 列**无唯一约束**。两个并发请求对同一 `unused` 激活码 claim 时，两个事务都能建店成功 → **一码两店**，激活码被变相使用两次（商家免费多开、平台营收受损）。
- **利用路径**：并发重放 `POST /internal/activation/claim`（同一 code）。

**修复方案 A（推荐：事务内条件更新 + 检查受影响行数）**：

```ts
async claim(dto: ClaimDto): Promise<ClaimResult> {
  return this.dataSource.transaction(async (manager) => {
    const codeRepo = manager.getRepository(ActivationCode);
    const shopRepo = manager.getRepository(Shop);

    const shop = await shopRepo.save(shopRepo.create({ name: dto.shop_name, /* ... */ }));

    // 原子抢占：只有 status='unused' 才能置为 used，返回受影响行数
    const upd = await codeRepo
      .createQueryBuilder()
      .update(ActivationCode)
      .set({ status: CodeStatus.Used, bound_shop_id: shop.id, bound_at: new Date() })
      .where('code = :code AND status = :status', { code: dto.code, status: CodeStatus.Unused })
      .execute();
    if (upd.affected !== 1) {
      throw new BusinessException('激活码已使用或已作废');
    }
    return { success: true, shopId: shop.id };
  });
}
```

**修复方案 B（纵深防御：加唯一约束兜底）**：

```ts
// shop.entity.ts
@Column({ type: 'varchar', length: 32, nullable: true, unique: true })
activation_code: string | null;
```

---

## 三、High（应当修复）

### H1. 登录接口无限流、无失败锁定，可暴力破解【A07 身份识别与认证失败】

- **位置**：`src/modules/auth/auth.controller.ts:22`、`src/modules/auth/auth.service.ts:50`
- **风险**：`/auth/login` 无任何速率限制 / 失败计数 / 锁定。叠加 C1 的默认弱口令，攻击者可对任意账号高速爆破。
- **修复**：接入 `@nestjs/throttler`（按 IP + 账号维度）：

```ts
// app.module.ts
import { ThrottlerModule } from '@nestjs/throttler';
ThrottlerModule.forRoot([{
  ttl: 60_000,                    // 1 分钟窗口
  limit: 10,                      // 最多 10 次
  skipSuccessfulRequests: true,   // 成功请求不计入
}]),
```

```ts
// 仅对 login 路由限流（防全局误伤）
@Post('login')
@Throttle({ default: { ttl: 60_000, limit: 5 } })
login(@Body() dto: LoginDto) { ... }
```

> 补充：`changePassword` 的旧密码校验同样应限流，防止已登录会话被猜改密码。

---

### H2. 未捕获异常将原始错误消息返回给客户端【A05 安全配置错误 / 信息泄露】

- **位置**：`src/common/http-exception.filter.ts:35-37`
- **风险**：`else if (exception instanceof Error) { message = exception.message; }` —— TypeORM / SQLite 等内部错误（含 SQL 片段、表名、绝对路径）会原样返回给客户端。运行日志（`stderr.log`）已证实堆栈中泄露 `D:\c\saas\output\platform-service\dist\...` 绝对路径。
- **修复**：

```ts
} else if (exception instanceof Error) {
  // 仅日志记录细节，对外一律返回通用消息
  console.error('[platform-service] 未处理异常:', exception);
  message = '服务器内部错误';
}
```

> 生产环境建议改用结构化日志（pino/winston）并脱敏，`console` 输出堆栈可保留在日志文件，但**不得回传响应体**。

---

### H3. 依赖树存在 2 个高危漏洞【A06 脆弱且过时的组件】

- **位置**：`package.json`（`npm audit` 实测：high 2 / moderate 8 / critical 0）
- **漏洞明细**：
  | 包 | 等级 | 漏洞 |
  |---|---|---|
  | `@nestjs/platform-express` (`<=11.1.14`) | high | 经 `multer` 多个 DoS：GHSA-xf7r-hgr6-v32p、GHSA-v52c-386h-88mc、GHSA-5528-5vmv-3xc2、GHSA-72gw-mp4g-v24j、GHSA-3p4h-7m6x-2hcm |
  | `@nestjs/core` (`<=11.1.17`) | moderate | 输出注入（GHSA-36xv-jgw5-4q75, CVSS 6.1） |
  | `multer` / `body-parser` / `qs` / `file-type` / `uuid` | moderate | 多项 DoS（CVSS 3.7-7.5） |
- **修复**：
  ```bash
  npm audit --registry=https://registry.npmjs.org          # 复核
  npm audit fix --registry=https://registry.npmjs.org      # 自动修复不跨 major 的部分
  # 完整修复需升级 NestJS 10 → 11（semver-major，需回归测试）：
  npm install @nestjs/common@^11 @nestjs/core@^11 @nestjs/platform-express@^11 @nestjs/typeorm@^11
  ```
  > multer 类 DoS 仅在 multipart 上传场景触发，当前项目无上传接口，实际利用面有限，但建议在升级窗口内一并解决。

---

## 四、Medium（建议修复）

### M1. CORS 全开放【A05】

- **位置**：`src/main.ts:18` — `app.enableCors()` 无参数 → `Access-Control-Allow-Origin: *`，任意网站可跨域读取 API 响应。
- **修复**（白名单运营后台域名）：
  ```ts
  app.enableCors({
    origin: ['https://admin.example.com', /^https:\/\/admin\.example\.com$/],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: false,   // Bearer 放 header，无需凭据模式
    maxAge: 86400,
  });
  ```
  > 若未来改用 Cookie 承载会话，CORS 全开将直接升级为 **Critical（CSRF）**。

### M2. 激活码过期时间从未校验【A04 不安全设计 / 业务控制失效】

- **位置**：`src/entities/activation-code.entity.ts:25` 定义 `expired_at`，但 `internal.service.ts` claim 流程全程未检查。
- **现状**：`batchCreate` 恒置 `expired_at: null`，暂无实际影响；一旦运营启用过期激活码即失效。
- **修复**：
  ```ts
  if (activationCode.expired_at && activationCode.expired_at.getTime() < Date.now()) {
    throw new BusinessException('激活码已过期');
  }
  ```

### M3. 内网签名接口存在重放窗口（5 分钟，无 nonce）【A07 / 安全设计】

- **位置**：`src/common/guards/internal-signature.guard.ts:50-52`
- **风险**：窗口内同一签名请求可原样重放；`claim` 非幂等，叠加 C2 竞态会放大危害。
- **修复**（请求体去重）：
  ```ts
  // 新增可选请求头 X-Internal-Nonce，服务端缓存最近 10 分钟内的 nonce 拒绝重复
  const nonce = req.headers['x-internal-nonce'] as string | undefined;
  if (nonce) {
    const key = `sig:${nonce}`;
    if (!this.nonceCache.set(key, 1, 600_000)) throw new ForbiddenException('请求已重放');
  }
  // 或更简单：claim 支持幂等（按 shop_name 唯一约束，重复请求返回已绑定结果）
  ```

### M4. TypeORM `synchronize: true`【A05】

- **位置**：`src/app.module.ts:21`
- **风险**：生产环境自动同步 schema，误改实体即可能删列/改类型，且无审计回滚路径。
- **修复**：生产配置 `synchronize: false` + TypeORM migration：
  ```bash
  npm i -D typeorm-ts-node-commonjs
  # package.json: "typeorm": "typeorm-ts-node-commonjs -d src/data-source.ts"
  # 迁移流程：migration:generate → migration:run（CI 中执行，人工 review diff）
  ```

### M5. dist 产物包含 sourcemap，生产可还原源码【A05】

- **位置**：`tsconfig.json:14`（`sourceMap: true`），`dist/` 实测 39 个 `.js.map`。
- **修复**：生产构建关闭 sourcemap：
  ```jsonc
  // tsconfig.build.json（extends 主配置）
  { "compilerOptions": { "sourceMap": false, "declaration": false } }
  ```

### M6. 导出 CSV 存在公式注入风险【A03 注入 / 纵深防御】

- **位置**：`src/modules/codes/codes.service.ts:139-143`
- **风险**：字段以 `= + - @` 开头时，Excel 打开会将其解释为公式执行（`batch_no` 为管理员输入，可诱导执行）。
- **修复**（字段转义 + 公式前缀拦截）：
  ```ts
  const esc = (v: string): string => {
    const s = v.replace(/^[=+\-@]/g, "'");          // 公式前缀加单引号
    return s.includes(',') || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const rows = items.map((c) =>
    [c.code, esc(c.batch_no), c.status, c.bound_shop_id ?? '', /* ... */].join(','));
  ```

### M7. 缺少安全响应头【A05】

- **位置**：`src/main.ts`（未使用 helmet）
- **修复**：
  ```ts
  import helmet from 'helmet';
  app.use(helmet({
    contentSecurityPolicy: { directives: { defaultSrc: ["'self'"] } }, // 按运营后台实际资源调整
  }));
  ```

---

## 五、Low（可考虑）

| 编号 | 位置 | 问题 | 建议 |
|---|---|---|---|
| L1 | `auth/dto/change-password.dto.ts:11` | 新密码仅要求 6 位，无复杂度 | 至少 8 位，建议加字符类别校验 |
| L2 | `common/guards/jwt-auth.guard.ts:10` | role 内嵌 JWT，改角色后 8h 内旧权限生效 | 引入 token 版本号（DB 字段），改角色/改密后 `version+1`，verify 时比对 |
| L3 | `auth.service.ts:37` | bcrypt cost = 10 | 提升至 12（bcryptjs 兼容） |
| L4 | `codes.controller.ts:50` | `@Param('code')` 无格式校验 | 加 `@Matches(/^[A-Za-z0-9]{12}$/)`（与 claim DTO 对齐） |
| L5 | `scripts/smoke.mjs:66-71` | 断言 `POS-XXXX-XXXX` 格式，与当前 12 位无前缀实现**不一致**，脚本必失败 | 同步脚本至当前实现 |
| L6 | `internal-signature.guard.ts:15-31` | canonicalJson 仅浅排序，嵌套对象 key 顺序不一致会导致签名失败/不一致 | 改为递归排序；当前 DTO 扁平，影响可控 |

---

## 六、加固清单（Checklist）

- [ ] **P0** 生产 `.env` 配置随机强密钥（JWT / 内部签名 ×2），启动强校验兜底
- [ ] **P0** 修改种子账号密码，关闭默认口令；首启密码一次性打印或强制改密
- [ ] **P0** claim 改为事务内条件更新 + `shop.activation_code` 唯一约束
- [ ] **P1** 登录/改密接口接入限流与失败锁定
- [ ] **P1** 异常过滤器对非 HttpException 一律返回通用消息
- [ ] **P1** 升级 NestJS 10 → 11 修复依赖高危漏洞（回归测试）
- [ ] **P2** CORS 白名单化；接入 helmet；生产关闭 sourcemap；`synchronize: false` + migration
- [ ] **P2** 激活码过期时间校验；签名请求 nonce 去重；CSV 输出转义
- [ ] **P3** 审计日志补充 IP/UA 字段（当前 `op_log` 无请求上下文，溯源能力弱）
- [ ] **P3** 修复 smoke 脚本与实现不一致；JWT 引入 token 版本机制

## 七、复测要点

1. 伪造 token：使用默认密钥与任意随机密钥各签一个 JWT，验证默认密钥被拒；
2. 并发 claim：对同一激活码发起 10 个并发请求，断言仅 1 个成功且无重复建店；
3. 爆破测试：对 `/auth/login` 连续请求 11+ 次，断言触发限流；
4. 错误注入：向 `/admin/shops` 发送畸形查询触发 DB 错误，断言响应不含 SQL/路径；
5. 重放测试：同一签名请求在窗口内重放，断言第二次被拒；
6. `npm audit` 复跑，断言 high/critical 清零。

---

*报告完 — 修复涉及 `env.ts`、`internal.service.ts`、`main.ts`、`http-exception.filter.ts` 等敏感文件，应用前请人工复核。*
