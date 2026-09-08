# 混合支付行模型设计

## 背景与目标

现有 orders 表只保留一个 payment_method_id / payment_method_name，无法表达「现金 + 微信」等多支付方式叠加。本次新增独立 order_payments 支付行，保留 orders 上的首笔支付快照，向后兼容现有接口、报表和小票。

## 表结构

order_payments 金额单位为「元」，避免引入分换算：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | integer PK | 自增主键 |
| order_id | integer | 所属订单，索引 |
| payment_method_id | integer | 结账方式 id |
| payment_method_name | varchar(32) | 结账方式名快照 |
| amount | real | 该行实际入账金额（元），找零不拆行 |
| created_at | datetime | 创建时间 |

索引：idx_order_payments_order_id(order_id)、idx_order_payments_method_created(payment_method_id, created_at)。

## 结账逻辑

POST /orders/:id/settle 新增可选 payments: [{ payment_method_id, amount }]：

- 传入 payments 时走新逻辑：逐个校验支付方式属于当前登录店铺且启用；金额须大于 0；保留两位小数；合计等于实收金额 paid_amount（缺省为优惠后应收）。传 paid_amount 且大于应收时允许 合计 = 实收，差额继续记录 change_amount，支付行只记实际入账。
- payments 中同一支付方式重复出现按多行保留，便于表达分次收款；不允许空数组，也不允许同时传 payment_method_id 与 payments。
- 未传 payments 时走旧单支付逻辑，服务端转换为一行支付记录；orders.payment_method_id / payment_method_name 继续保存首笔支付快照，避免破坏现有查询与兼容层。
- 折扣、改价、挂账补收逻辑不变；所有写入都在结账事务内。

## 报表口径

按结账方式汇总从 order_payments 读取，避免混合支付金额拆分失真。报表金额继续聚合订单实收；支付行数量计数为支付行数，免单不生成支付行，历史数据迁移后可完整汇总。兼容旧数据时，若订单无支付行则回退到 orders.payment_method_name + paid_amount。

## 退款、撤单、挂账

- 退菜/退款：不物理删除支付行；后续按退款金额、原支付方式或用户指定方式生成退款支付方向时可基于该表扩展。当前仍调整 orders.paid_amount，报表只汇总有效正向支付行，需要在退款方向扩展时明确排除或负数行约定。
- 反结账/reopen：删除并重建该订单支付行。
- 撤单/reject：未结账撤单无支付行；历史异常数据如已有支付行也一并清理。
- 挂账：不生成支付行；补收走 settle，生成实际支付行。
- 免单：不生成支付行。

## 向后兼容

1. 旧 settle 请求字段完全可用，响应结构不变；新增 payments 不影响旧客户端。
2. orders 首支付快照保留，现有订单详情、退款、报表过滤继续工作。
3. 迁移仅创建 order_payments；不自动回填历史单支付数据，报表读取时按「无行则回退订单快照」兜底。
4. 生产部署需在发布后手动执行 pm run migration:run；禁止启动时自动迁移。
