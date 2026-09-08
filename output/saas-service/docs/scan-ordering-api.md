# 扫码点餐公开接口预留设计

## 1. 背景与范围

本设计服务 PRD §5.5 的二期「顾客扫码点餐」。当前一期只落地**免登录、只读、按店铺隔离**的公开菜单接口；桌台、下单、加菜、催菜和点单查询仅预留契约，返回 `501 Not Implemented`。

本期不新增前端页面，不引入支付能力，也不修改店铺表结构。

## 2. 二维码与解析流程

### 2.1 二维码内容

推荐使用 HTTPS 稳定链接：

```text
https://{host}/s/{shopCode}/{tableCode}
```

示例：

```text
https://app.example.com/s/1f/A12
```

- `shopCode`：公开店铺码。
- `tableCode`：桌台公开码，一期 schema 未落地，仅在链接中预留。
- 前端/H5 打开链接后解析路径，调用 `GET /public/{shopCode}/menu` 展示菜单。
- 二期点餐时携带 `tableCode` 调用 `POST /public/{shopCode}/orders`。

### 2.2 shopCode 方案

当前 `shop` 表没有 `shop_code` 列。为避免一期产生 migration，本期使用确定性短编码：

```text
shopCode = shop_id.toString(36)
```

服务端收到 `shopCode` 后按 base36 解码为 `shop_id`，再校验本地店铺快照存在且状态为 `active`。该方案不暴露连续敏感信息，也不返回内部 `shop_id`。二期如需运营侧自定义短码，可增加 `shop_code` 唯一列，并保留 `shopCode` 路由兼容。

## 3. 公开端点

所有响应沿用全局 `{ code, message, data }` 包装。公开端点不加 `JwtAuthGuard`。

### 3.1 GET /public/:shopCode/menu

状态：**一期已实现**。

用途：获取当前店铺在售菜单。

响应字段（白名单）：

| 字段 | 类型 | 说明 |
|---|---|---|
| `code` | string | 菜品公开码；菜品未配置时由内部 id 转 base36 |
| `name` | string | 菜品名称 |
| `category` | string | 分类名 |
| `price` | number | 单价，单位「元」 |
| `specs` | array | 规格 `{ code, name, price_delta }`，金额仍为「元」 |

过滤规则：

- `shop_id` 等于解码后的店铺。
- `status = on_sale`。
- `sold_out = false`。
- 排序：`category ASC, sort_order ASC, id ASC`。

不返回成本、打印部门、上下架控制、内部 id、创建时间等管理字段。

### 3.2 GET /public/:shopCode/tables/:tableCode

状态：**预留**，返回 `501`。

用途：二期根据桌台码返回桌台状态、点餐模式和可点餐状态。

### 3.3 POST /public/:shopCode/orders

状态：**预留**，返回 `501`。

二期请求体方向：

```json
{
  "tableCode": "A12",
  "items": [
    {
      "dishCode": "gbdjd",
      "specCode": "large",
      "qty": 1
    }
  ],
  "remark": "少辣"
}
```

正式落地时应使用 class-validator DTO，并在服务端重新读取菜品价格，禁止信任客户端提交的金额。

### 3.4 GET /public/:shopCode/orders/:ticketNo

状态：**预留**，返回 `501`。

用途：顾客查看自己的点单状态、菜品进度和加菜结果。

## 4. 安全与稳定性

### 4.1 租户隔离

每次请求先解码并校验 `shopCode`；店铺不存在或停用时返回 `404`。菜单查询以服务端解析出的 `shop_id` 作为唯一过滤条件，禁止直接接受内部 id。

### 4.2 限流

公开接口建议按两级维度限流：

- 全局：同一 IP 对 `/public/*` 的访问限制到每分钟 60 次。
- 店铺：同一 `shopCode` 每分钟限制到 120 次。
- 二期下单：同一 IP + `shopCode` + `tableCode` 每分钟限制到 10 次，命中后返回 `429`。

### 4.3 幂等

一期菜单接口天然只读。二期下单必须支持幂等：

- 客户端生成 `clientRequestId`（UUID）。
- 服务端建立 `shop_id + clientRequestId` 唯一约束。
- 重复请求返回首次创建的点单，而不是创建新单。
- 同一点单内加菜请求也使用独立 `clientRequestId`，避免网络重试造成重复菜品。

### 4.4 数据暴露控制

- 只返回公开字段白名单。
- 不暴露内部自增 id 作为业务字段。
- 错误提示不区分「店铺不存在」和「店铺已停用」的内部运维细节，统一为 404。
- 后续若增加桌台状态，也应避免返回与结算、支付、后厨内部路由相关的信息。

## 5. 冒烟覆盖

`scripts/smoke.mjs` 覆盖以下路径：

1. 合法 `shopCode` 匿名读取菜单，返回 200 且包含在售菜品。
2. 非法 `shopCode` 返回 404。
3. 有效店铺访问预留下单端点返回 501。
