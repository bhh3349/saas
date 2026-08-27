/**
 * 报表演示数据（仅本地开发验证用）
 * 模拟收银行为在 shop_id=1 产生：优惠券核销 / 改价 / 免单 / 作废订单 / 退菜 记录。
 * 运行：node seed-report-demo.cjs
 */
const db = require('better-sqlite3')('data/saas.db');
const now = '2026-08-21 05:18:06';

// 1. 订单1：核销「新客立减券」5 元 + 退白米饭 1 份（2 元）
db.prepare(
  "UPDATE orders SET discount_amount=500, discount_type='voucher', discount_name='新客立减券', voucher_id=1, total_amount=3550, paid_amount=3050, change_amount=0, items=? WHERE id=1",
).run(
  JSON.stringify([
    { dish_id: 1, name: '宫保鸡丁', spec_name: '大份', unit_price: 3350, qty: 1, amount: 3350 },
    { dish_id: 2, name: '白米饭', spec_name: null, unit_price: 200, qty: 1, amount: 200 },
  ]),
);
db.prepare(
  'INSERT INTO order_refunds (shop_id, order_id, order_no, dish_id, name, spec_name, unit_price, qty, amount, reason, operator_id, operator_name, refunded_at) VALUES (1,1,\'20260821-0001\',2,\'白米饭\',NULL,200,1,200,\'顾客取消\',1,\'19637786940\',?)',
).run(now);

// 2. 订单2：改价优惠 5.5 元（25.5 → 20）
db.prepare(
  "UPDATE orders SET discount_amount=550, discount_type='price_change', discount_name='改价', paid_amount=2000, change_amount=0 WHERE id=2",
).run();

// 3. 订单3：免单（补优惠字段）
db.prepare(
  "UPDATE orders SET discount_amount=200, discount_type='free', discount_name='免单' WHERE id=3",
).run();

// 4. 敏感操作日志
const log = db.prepare(
  'INSERT INTO operation_logs (shop_id, user_id, user_name, action, target_type, target_id, amount, detail, created_at) VALUES (?,?,?,?,?,?,?,?,?)',
);
log.run(1, 1, '19637786940', 'voucher', 'order', 1, 500, '优惠券核销-新客立减券，优惠 ¥5.00', now);
log.run(1, 1, '19637786940', 'price_change', 'order', 2, 550, '改价，优惠 ¥5.50', now);
log.run(1, 1, '19637786940', 'free_order', 'order', 3, 200, '整单免单 ¥2.00', now);
log.run(1, 1, '19637786940', 'void_order', 'order', 4, 200, '拒单作废 ¥2.00', now);
log.run(1, 1, '19637786940', 'refund', 'order', 1, 200, '退菜 1 项，退款 ¥2.00', now);

console.log('report demo data seeded');
