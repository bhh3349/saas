# saas-service 商家端服务（项目二）

多租户收银 SaaS 的商家端后端：账号、菜品、桌台、结账方式、订单、账目。

## 运行

```bash
npm install
npm run build
npm start          # 默认 3200 端口
```

依赖 platform-service（注册时跨服务调用 `/internal/activation/claim`），需先启动 platform-service。

## 环境变量

见 `.env.example`。关键项：

- `PORT`：本服务端口（默认 3200）
- `JWT_SECRET`：JWT 签名密钥（生产必须改）
- `PLATFORM_INTERNAL_BASE_URL` / `PLATFORM_INTERNAL_SECRET`：平台端内部接口地址与共享密钥，**必须与 platform-service 的 `INTERNAL_SHARED_SECRET` 一致**

## 里程碑 B1 范围

| 接口 | 说明 |
|---|---|
| `POST /auth/register` | 手机号唯一 → 调平台端 claim（内网签名）→ 建老板账号 + 初始配置（默认桌台 / 默认结账方式） |
| `POST /auth/login` | 手机号 + 密码 → 签发 JWT（含 userId / shopId / role） |
| `POST /auth/forgot-password` | 统一返回联系客服提示，不暴露账号是否存在 |
| `GET /auth/me` | 当前登录用户信息 |
| `POST /admin/staff` | 创建员工（老板权限；仅收银员 / 财务） |
| `GET /admin/staff` | 员工列表（老板权限；按 shopId 隔离） |
| `POST /admin/staff/:id/status` | 停用 / 启用员工（老板权限；按 shopId 隔离） |

## 冒烟测试

```bash
npm run build
npm run smoke       # 需先启动 platform-service（或脚本自动拉起）
```
