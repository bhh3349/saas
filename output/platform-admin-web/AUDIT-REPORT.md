# 收银云平台后台（platform-admin-web）上线审计报告

> 审计时间：2026-08-25 ｜ 范围：能否上线 + 风险清单 + 部署要求
> 审计人：鹏城信息AI专家（前端 + 部署视角）

---

## 一、审计结论

**🟢 有条件可上线**（上线前需完成 4 项部署侧必做 + 1 项业务确认）

| 维度 | 状态 | 说明 |
|---|---|---|
| 构建 | ✅ 0 错误 | `vue-tsc -b && vite build` 通过，无类型错误 |
| 依赖安全 | ✅ 0 漏洞 | `npm audit`（官方 registry）`found 0 vulnerabilities` |
| 代码质量 | ✅ 干净 | 无 TODO/FIXME/console.log/硬编码密钥/明文 URL |
| 运行时 | ✅ 全部通过 | 登录→列表→导出→弹窗关键路径实测正常 |
| 响应式 | ✅ | 800 视口下弹窗居中、表格滚动兜底 |
| **部署配置** | ⚠️ | 需 nginx 配 history 回退 + 反向代理 + 安全响应头 |
| **认证安全** | ⚠️ | token 存 localStorage 存在 XSS 风险，需明确接受 |
| **遗留缺陷** | 🟡 | 1 项后端数据 + 1 项冗余资源 |

---

## 二、详细审计结果

### 1. 构建产物（实测 `npm run build`）

| 资源 | 大小 | gzip |
|---|---|---|
| index（应用代码） | 13.5 KB | 6.1 KB |
| vue-vendor（vue+pinia+router） | 84.8 KB | 32.3 KB |
| CSS | 21.2 KB | 4.9 KB |
| 4 个 view chunks（已懒加载） | 2.97/12.9/8.6/9.4 KB | gzip ~1.5-4.8 KB |
| .gz 预压缩 | 7 个文件 | — |
| **dist 总大小** | **278 KB** | — |

体积轻、首屏 gzip 6.1 KB（应用代码）+ 32.3 KB（vue）≈ 39 KB，加 CSS ≈ **44 KB 首屏传输**。非常适合生产。

### 2. 依赖安全

```
npm audit --registry=https://registry.npmjs.org
found 0 vulnerabilities
```

依赖极少（vue 3.5 + pinia 4 + vue-router 4 + vite 8 + dev:vue-tsc/playwright/ts/vite-plugin-compression）。**0 漏洞**。

### 3. 代码质量扫描

| 检查项 | 结果 |
|---|---|
| TODO/FIXME/XXX | 0 |
| console.log/debug | 0 |
| 硬编码密钥/口令 | 0（已在上轮移除默认凭据） |
| 明文 URL / IP / localhost | 0（所有接口用相对路径走 vite proxy） |

### 4. 运行时关键路径验证（1440×900 + 800×600 实测）

| 步骤 | 结果 |
|---|---|
| 登录页加载 | ✅ 标题中文、输入框空、无默认凭据展示 |
| 登录（admin/admin123456） | ✅ 跳转激活码管理 |
| 激活码列表（16+ 条真实数据） | ✅ 状态标签、分页、操作列正常 |
| 顶栏导出 CSV | ✅ toast「已导出激活码 CSV」 |
| 切换到店铺管理 | ✅ 10 条数据加载 |
| 个人信息弹窗 | ✅ 头像预览/修改用户名/修改密码 完整 |
| 800 视口弹窗 | ✅ max-width 兜底居中 + 内部滚动 |

### 5. 响应式（800 视口）

- 弹窗：max-width:calc(100vw - 32px) 兜底，居中显示
- 主表格：横向滚动条兜底（之前 .table-wrap overflow-x:auto 已加）
- 弹窗内部：.modal-body overflow-y:auto 内容可滚
- 极窄视口（≤900/640）：侧栏收窄、工具栏换行

---

## 三、上线前必做项（部署侧）

### 1. ⚠️ Vue Router history 模式回退（必做）

本项目用 `createWebHistory()`（非 hash）。**直接访问 `/codes` `/shops` 等非根路径会 404**。nginx 必须配：

```nginx
location / {
    try_files $uri $uri/ /index.html;
}
```

### 2. ⚠️ 后端 API 反向代理（必做）

`vite.config.ts` 的 proxy 只在 **dev 模式**生效。生产环境需要 nginx 反向代理：

```nginx
location /auth/ {
    proxy_pass http://127.0.0.1:3100/auth/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
}
location /admin/ {
    proxy_pass http://127.0.0.1:3100/admin/;
    # ... 同上
}
```

或者后端 NestJS 配 CORS（推荐用反代，避免 CORS 配置复杂度与浏览器预检问题）。

### 3. ⚠️ gzip_static 启用（充分利用 .gz 预压缩）

产物已含 .gz 预压缩文件。nginx 配：

```nginx
gzip_static on;
gzip_proxied any;
gzip_vary on;
```

不配则服务器实时压缩（多耗 CPU）；配了则直接 .gz 命中。

### 4. ⚠️ 安全响应头（强烈建议）

nginx 配（防 XSS / MIME 嗅探 / 嵌入攻击）：

```nginx
add_header X-Content-Type-Options "nosniff" always;
add_header X-Frame-Options "DENY" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' http://127.0.0.1:3100" always;
```

CSP 要根据实际后端域名调整 `connect-src`。

---

## 四、风险与建议

### 🟡 风险 1：token 存 localStorage（XSS 风险）

`api/http.ts` 把 JWT token 存在 `localStorage.platform_admin_token`。**若 XSS 攻击注入恶意脚本，可直接窃取 token**。

**缓解方案**（按优先级）：
1. **后端将 token 改为 HttpOnly Cookie**（最安全，前端无需 JS 操作，浏览器自动发送）—— 需后端配合
2. **保持现状 + 后端配 CSP + 严格审计依赖**（已 `0 vulnerabilities`，可接受临时方案）
3. **加短 token 过期 + refresh token 轮换**（当前 JWT 7 天过期，可缩到 1-2 小时 + refresh 机制）

**上线前请业务方明确选择方案**。

### 🟡 风险 2：登录无验证码 / 限流（暴力破解）

当前 `/auth/login` 仅有账号密码校验，无：
- 图形验证码 / 滑块
- IP 失败次数限流（如 5 次/分钟封 IP）
- 账号登录次数限流

**建议**：上线前至少加 IP 限流（nginx `limit_req` 或后端中间件）。

### 🟢 风险 3：CSV 导出注入（低风险）

`exportCodesApi` 返回的 CSV 由后端生成。若后端未对字段做转义（`=`, `+`, `-`, `@` 开头会被 Excel 解析为公式），可能存在 CSV 注入。**前端无法干预，需后端处理**。

### 🟢 风险 4：后端用户列表分页

店铺列表 `共 10 条 / 1 页` —— 数据量小暂 OK。若未来店铺量上 10 万级，ShopView.vue 的 `PAGE_SIZE = 20` + 简单分页（`.pageList` 直接生成序列）会出现：当前生成 `[1, '…', last]` 中间页不可直达。**上轮已修复为经典页码算法 + 请求竞态保护**，但需关注数据量。

---

## 五、遗留缺陷与待清理

| 编号 | 项 | 状态 | 建议 |
|---|---|---|---|
| 1 | `public/icons.svg`（5 KB） | 已被 `grep` 确认**完全无引用**（源码 + index.html） | 上线前删除，避免 dist 多 5KB 冗余 |
| 2 | 后端数据：`?????Batch` 绑定店铺名（乱码） | 已在 8-24 标记遗留 | 上线前由后端排查（关联查询或编码） |
| 3 | Shop.contact 字段 | 前端预留、后端暂无（types.ts 注释说明） | 当前显示 "—"，可接受 |
| 4 | `vue-tsc` 在 `verbatimModuleSyntax` 下 CJS 插件 | 8-24 已用类型断言绕过 | 关注 vite-plugin-compression 升级是否支持 ESM default 导出 |

---

## 六、上线 checklist

- [ ] 部署前删除 `public/icons.svg`（5KB 冗余）
- [ ] nginx 配 `try_files` history 模式回退
- [ ] nginx 配 `/auth/` `/admin/` 反向代理到 3100
- [ ] nginx 启用 `gzip_static on;`
- [ ] nginx 配 CSP/X-Frame-Options 等安全响应头
- [ ] 业务方确认：token 存 localStorage 是否可接受？（或上 HttpOnly Cookie）
- [ ] 后端加 IP 登录限流（最低限度）
- [ ] 后端修复 `?????Batch` 乱码数据
- [ ] 后端处理 CSV 导出注入（如果数据来源不可控）
- [ ] 部署后用 `curl` 验证 `/codes` `/shops` 直访不会 404
- [ ] 部署后手动登录一次验证整条链路

---

## 七、审计附录

- 构建命令：`npm run build`（vue-tsc -b && vite build）
- 依赖：`vue@3.5.40 vue-router@4.6.4 pinia@4.0.3 vite@8.2.0 typescript@~6.0.2 vite-plugin-compression@0.5.1 playwright@1.62.1`
- 源码：15 个文件，5576 行 CSS 还在不断优化中（**项目体量小**）
- 路由：`/login` `/` → `/codes` `/shops`，4 个 view，已懒加载
- 状态管理：Pinia setup store（useAuthStore），token + operator 持久化
- 入口：51 入口模块，构建 297 ms

**最后结论**：项目本身**代码质量过硬**（0 漏洞、0 错误、0 凭据泄露、端到端验证通过）。**主要风险集中在部署配置和后端配合**。完成上文 checklist 后可上线。
