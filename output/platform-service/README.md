# platform-service 平台端服务

餐饮收银 SaaS 平台端后端：激活码管理 + 店铺主数据（shopId 源头）。

## 技术栈

NestJS + TypeORM + better-sqlite3（同步 API）+ JWT + 内网签名

## 快速开始

```bash
npm install
cp .env.example .env    # 按需修改配置
npm run start:dev       # 开发模式（默认 3100 端口）
```

## 接口一览

| 方法 | 路径 | 鉴权 | 说明 |
|---|---|---|---|
| POST | /auth/login | - | 运营登录，返回 JWT |
| POST | /admin/codes/batch | 运营 JWT | 批量生成激活码 |
| GET | /admin/codes | 运营 JWT | 激活码列表（按批次 / 状态筛选） |
| GET | /admin/codes/export | 运营 JWT | 导出激活码 CSV |
| POST | /admin/codes/:code/void | 运营 JWT | 作废激活码（仅 unused） |
| GET | /admin/shops | 运营 JWT | 店铺列表（跨租户） |
| POST | /admin/shops/:id/status | 运营 JWT | 店铺停用 / 启用 |
| POST | /internal/activation/claim | 内网签名 | 商家注册时校验激活码并建店绑定 |

统一响应格式：`{ code, message, data }`，`code === 0` 表示成功。

## 内网签名规则（saas-service 调用方须一致）

请求头：

- `X-Internal-Key: internal`
- `X-Internal-Timestamp: <毫秒时间戳>`
- `X-Internal-Signature: <hex>`，其中签名串为 `timestamp.METHOD.path.canonicalBody`，使用 HMAC-SHA256（密钥 = INTERNAL_SHARED_SECRET）。`canonicalBody` = 按 key 排序后的 JSON 字符串。时间戳窗口 5 分钟。

示例（Node）：

```js
const crypto = require('node:crypto');
const body = JSON.stringify(sortKeys({ code, shop_name, phone }));
const text = `${ts}.POST./internal/activation/claim.${body}`;
const sig = crypto.createHmac('sha256', SECRET).update(text).digest('hex');
```
