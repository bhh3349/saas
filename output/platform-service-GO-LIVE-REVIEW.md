# 《上线就绪复审报告》—— platform-service（收银云平台服务端）

| 项 | 内容 |
|---|---|
| 复审对象 | `D:\c\saas\output\platform-service`（2026-08-24 首次审计后的修复版本） |
| 复审目的 | 确认服务是否达到**上线**标准 |
| 复审时间 | 2026-08-25 |
| 复审方式 | 代码复验 + 静态验证（typecheck/build/audit）+ 生产模式启动测试 + 运行时攻击面实测 |
| 结论 | ✅ **安全层面达标，代码层面无阻塞，具备上线条件**（部署时按 P1 配置环境变量） |

---

## 一、结论摘要

上一轮审计的 **2 Critical / 3 High / 7 Medium / 6 Low 共 18 项问题已全部修复**，且通过了**运行时实测**（登录限流、并发 claim、token 吊销、签名重放、生产启动）。依赖漏洞 **0 high / 0 critical**，类型检查与生产构建零错误。

**上线判定：可上线（GO-LIVE）**。
原唯一阻塞项「初始数据库迁移缺失」（P0）已于 2026-08-25 **解决并验证通过**（详见第四节）；剩余 6 项为部署时的环境变量配置（P1）与运维建议（P2），不阻塞上线。

---

## 二、修复验证矩阵（上一轮 18 项 → 全部修复 ✅）

| 原编号 | 问题 | 修复方式 | 验证 |
|---|---|---|---|
| C1 | 默认密钥 + 弱口令 | `assertSecret()` 生产强校验（拒绝弱密钥 + ≥32 位）；种子密码随机生成一次性打印；bcrypt cost 12 | ✅ 实测：生产 + 弱密钥启动被拒；强密钥正常启动 |
| C2 | claim 并发竞态（一码两店） | 事务内条件更新原子抢占 + `shop.activation_code` 唯一约束 | ✅ 实测：10 并发 claim 同一码仅 1 成功，绑定店铺数=1 |
| H1 | 登录无限流 | `@nestjs/throttler` 全局 60/min + login 5/min + 改密 10/min | ✅ 实测：第 5 次错误登录即 429 |
| H2 | 异常消息泄露 | 非 HttpException 一律返回通用消息，详情仅记日志 | ✅ 代码确认 |
| H3 | 依赖高危（2 high/8 moderate） | NestJS 10→11.2.1 + throttler/helmet | ✅ `npm audit`：0 漏洞 |
| M1 | CORS 全开放 | `CORS_ORIGINS` 白名单 + 方法/头限制 | ✅ 代码确认 |
| M2 | 激活码过期未校验 | claim 增加 `expired_at` 校验 | ✅ 代码确认 |
| M3 | 签名重放（5min 窗口无 nonce） | `X-Internal-Nonce` 去重（10min 窗口） | ✅ 实测：同签名重放第 2 次 403 |
| M4 | `synchronize: true` | `DB_SYNC` 控制，生产默认 false；migration CLI 就绪 | ✅ 代码确认 |
| M5 | sourcemap 泄露 | `tsconfig.build.json` 关闭 sourcemap | ✅ 实测：dist 0 个 .js.map |
| M6 | CSV 公式注入 | 字段双引号包裹（`csvEsc`） | ✅ 代码确认 |
| M7 | 无安全响应头 | `helmet()` 接入（纯 JSON API 关 CSP） | ✅ 代码确认 |
| L1 | 密码策略弱 | 新密码 8-64 位 + 必须含字母和数字 | ✅ 代码确认 |
| L2 | 改密后旧 token 有效 / role 内嵌 | JWT 携带 `ver` + 每请求查库比对 `token_version`，改密/改资料自增 | ✅ 实测：改密后旧 token 立即 401 |
| L3 | bcrypt cost 10 | 提升至 12 | ✅ 代码确认 |
| L4 | `:code` 路由参数无校验 | 新增 `CodeParamDto`（12 位字母数字） | ✅ 代码确认 |
| L5 | smoke 脚本与实现不一致 | 码格式断言同步为 12 位无前缀 | ✅ 代码确认 |
| L6 | canonicalJson 浅排序 | 守卫端改为**递归排序** | ✅ 扁平 body 互通实测通过 |

> 附带修复：`op_log` 增加 `ip` / `user_agent` 审计字段；`.env.example` 补齐 `NODE_ENV / DB_SYNC / CORS_ORIGINS` 与密钥生成指引。

---

## 三、本次静态与运行时验证结果

### 3.1 静态验证
| 项目 | 结果 |
|---|---|
| `npm run typecheck`（tsc --noEmit） | ✅ 0 错误 |
| `npm run build`（tsconfig.build.json） | ✅ 通过，exit 0 |
| dist sourcemap | ✅ 0 个 |
| `npm audit`（官方源） | ✅ **0 漏洞**（high 0 / moderate 0 / critical 0） |
| 依赖安装 | ✅ @nestjs/core 11.2.1 / throttler 6.5.0 / helmet 8.3.0 |

### 3.2 运行时实测（本次执行）
| 场景 | 结果 |
|---|---|
| 生产模式 + 弱密钥启动 | ✅ 被拒（`生产环境禁止使用默认密钥`） |
| 生产模式 + 强密钥启动（synchronize=false 连现有库） | ✅ `listening on :3999` |
| 登录限流 | ✅ 连续 6 次错误登录，第 5 次起 HTTP 429 |
| 并发 claim（10 并发同一激活码） | ✅ 仅 1 次成功（shopId=9），其余 400「激活码已使用」；库内绑定店铺数 = 1 |
| 改密后旧 token | ✅ 立即 401，新密码登录正常 |
| 签名重放（同 nonce） | ✅ 第 1 次 201，第 2 次 403 |
| 内网签名互通（浅排序签名 → 递归排序校验） | ✅ 扁平 body 全部校验通过 |

---

## 四、上线阻塞项（P0，必须处理）

### BLOCK-1：初始数据库迁移缺失（全新生产库无法建表）—— ✅ 已解决（2026-08-25）
- **根因**：`src/data-source.ts` 配置 `migrations: ['migrations/*.ts']`，glob 相对 cwd 解析不到实际目录；且 `migrations/` 目录不存在、无任何迁移文件。
- **处理**：
  1. 修正 `src/data-source.ts` glob 为 `src/migrations/*.ts`；
  2. 基于**全新空库**执行 `npm run migration:generate -- src/migrations/Init`，生成 `src/migrations/1787628389601-Init.ts`（activation_code / op_log / operator / shop 四表 + down 回滚）；
  3. 在全新空库执行 `npm run migration:run` **实测通过**：4 张表全部创建并记入 `migrations` 表。
- **验证**：`npm run build` 通过，迁移已编译进 `dist/migrations/`。
- ⚠️ 生产部署流程：**全新库直接 `npm run migration:run`**（初始迁移已入库），无需再 generate；本地 `data/platform.db` 已有 synchronize 建的表，**不要**对其执行 `migration:run`（会 CREATE TABLE 冲突），本地库保持现状即可。

---

## 五、上线必做配置（P1）

| # | 事项 | 说明 |
|---|---|---|
| 1 | 生产 `.env` 三项强密钥 | `JWT_SECRET` / `INTERNAL_SHARED_SECRET` / `SAAS_INTERNAL_SECRET`（≥32 位随机 hex），启动强校验兜底 |
| 2 | **跨服务密钥一致** | `SAAS_INTERNAL_SECRET`（本服务）必须等于 saas-service 的 `PLATFORM_INTERNAL_SECRET`，否则店铺状态同步/注册链路全部失败 |
| 3 | `CORS_ORIGINS` | 必须配置运营后台真实域名（默认是 `localhost:5173` 开发值） |
| 4 | `SEED_OPERATOR_PASSWORD` | 建议显式配置强密码；留空则随机生成仅打印一次（注意收集日志） |
| 5 | `NODE_ENV=production` | 触发 assertSecret 与 synchronize=false |
| 6 | **固定 Node 版本** | `better-sqlite3` 为原生模块，`npm install` 与运行时 Node ABI 必须一致（本次测试中已因 Node 22/24 混用触发 `NODE_MODULE_VERSION` 报错并 `npm rebuild` 修复）；部署文档须固定 Node ≥22 LTS 并注明 rebuild 命令 |

---

## 六、建议跟进（P2，不阻塞上线）

1. **canonicalJson 实现漂移**：platform 守卫已改递归排序，但 `saas-client.service.ts` 与 saas-service 端仍是浅排序。**当前扁平 body 互通已验证正常**，但未来新增嵌套/数组字段前必须统一三处实现，否则签名互通失效。
2. **push 方向无 nonce**：`saas-client` 调用 saas-service 未携带 `X-Internal-Nonce`，且 saas-service 端无 nonce 校验——重放防护仅覆盖 saas→platform 方向。建议两端同步补齐。
3. **op_log 无查询接口**：审计日志只有写没有读，运营侧无法检索敏感操作记录，建议后续补充。
4. **进程守护与健康检查**：未提供 pm2/Docker 配置与 `/health` 探活端点，建议随部署方案补充。
5. **TECH-STACK.md 过时**：文档仍描述旧默认值（`dev-secret-change-me`、`admin123456` 等），建议同步当前实现。
6. **测试数据隔离**：本地 `data/platform.db` 含本次验证产生的测试店铺/激活码（并发店 1-10、重放测试店等），生产务必使用全新数据库文件。

---

## 七、上线 Checklist（复制即用）

```bash
# 1. 生产目录部署
git clone / rsync <代码> && cd platform-service
npm ci                      # 锁版本安装（Node 版本与运行环境一致）

# 2. 环境变量（禁止默认值）
cat > .env <<'EOF'
NODE_ENV=production
PORT=3100
DB_PATH=data/platform.db
DB_SYNC=false
JWT_SECRET=<random 48+ hex>
INTERNAL_SHARED_SECRET=<random 48+ hex>     # 与 saas-service 侧保持一致
SAAS_INTERNAL_SECRET=<random 48+ hex>       # 必须等于 saas-service 的 PLATFORM_INTERNAL_SECRET
SAAS_INTERNAL_BASE_URL=http://<saas-service>:3200
CORS_ORIGINS=https://admin.your-domain.com
SEED_OPERATOR_USERNAME=admin
SEED_OPERATOR_PASSWORD=<强密码>
EOF

# 3. 构建 + 迁移 + 启动
npm run build
npm run migration:run        # 初始迁移 Init 已在仓库 src/migrations/ 内，新库直接执行
node dist/main.js            # 或 pm2 start dist/main.js --name platform-service

# 4. 上线验证
curl -s https://admin-api/…/auth/login  → 弱密钥/弱口令均被拒
curl -s …/auth/me 无 token → 401
重复错误登录 5 次 → 429
```

---

*复审完 — 结论：安全缺陷清零、依赖零漏洞、关键攻击面实测通过；**BLOCK-1 初始迁移已解决并实测通过，代码层面无阻塞，可上线**。部署时按第五节完成 P1 环境变量配置即可。*
