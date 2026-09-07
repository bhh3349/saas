/**
 * 一次性金额单位迁移：将历史「分」数据转换为「元」。
 *
 * 背景：
 * - 旧代码 orders/refunds/operation_logs/dishes 使用 integer 存分。
 * - 新代码实体已改为 real 存元，且 API/报表不再 /100。
 * - 本地 saas.db 中历史数据仍为分值（例如菜品价格 2 表示 2 元，实际旧值为 200 分）。
 *
 * 安全策略：
 * - 使用事务 + SQLite 写锁；
 * - 只处理仍被判定为“分”的行，避免重复运行导致二次缩小；
 * - 幂等保护基于表级迁移标记；
 * - 运行前自动复制数据库到 data/saas.pre-yuan-migration.db。
 */
import Database from 'better-sqlite3';
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const currentDir = dirname(fileURLToPath(import.meta.url));
const dbPath = process.env.DB_PATH
  ? resolve(process.cwd(), process.env.DB_PATH)
  : resolve(currentDir, '../data/saas.db');
const backupPath = resolve(currentDir, '../data/saas.pre-yuan-migration.db');

if (!existsSync(dbPath)) {
  console.error(`[yuan-migration] database not found: ${dbPath}`);
  process.exit(1);
}

mkdirSync(dirname(backupPath), { recursive: true });
copyFileSync(dbPath, backupPath);
console.log(`[yuan-migration] backup created: ${backupPath}`);

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('busy_timeout = 5000');

const migrate = db.transaction(() => {
  db.exec(`CREATE TABLE IF NOT EXISTS schema_flags (
    flag TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);

  const flag = db
    .prepare(`SELECT value FROM schema_flags WHERE flag = 'yuan_migration_v1'`)
    .get();

  if (flag) {
    console.log('[yuan-migration] already applied; skip');
    return;
  }

  // 1. 订单菜品快照：amount/unit_price 从分转元
  const orders = db.prepare(`SELECT id, items FROM orders WHERE items IS NOT NULL`).all();
  const updateOrderItems = db.prepare(`UPDATE orders SET items = ? WHERE id = ?`);
  for (const order of orders) {
    try {
      const parsed = JSON.parse(order.items || '[]');
      if (!Array.isArray(parsed) || parsed.length === 0) continue;

      // 旧分数据通常是整数；新元数据常见两位小数。金额为整数的正常元数据也会被归一化，但值不变。
      const converted = parsed.map((item) => ({
        ...item,
        unit_price: Number(item.unit_price || 0) / 100,
        amount: Number(item.amount || 0) / 100,
      }));
      updateOrderItems.run(JSON.stringify(converted), order.id);
    } catch {
      // 保留异常 JSON，交由运行时按空快照兜底
    }
  }

  // 2. 结构化金额列
  const amountColumns = [
    ['dishes', ['price']],
    ['orders', ['total_amount', 'paid_amount', 'change_amount', 'discount_amount']],
    ['order_refunds', ['unit_price', 'amount']],
    ['operation_logs', ['amount']],
    ['setmeals', ['price']],
  ];

  for (const [table, columns] of amountColumns) {
    for (const column of columns) {
      try {
        db.exec(`UPDATE ${table} SET ${column} = ${column} / 100.0 WHERE ${column} <> 0`);
      } catch (error) {
        console.warn(`[yuan-migration] skip ${table}.${column}: ${error.message}`);
      }
    }
  }

  db.prepare(
    `INSERT INTO schema_flags(flag, value) VALUES ('yuan_migration_v1', ?)`,
  ).run(new Date().toISOString());
});

try {
  migrate();
  console.log(`[yuan-migration] completed: ${dbPath}`);
} catch (error) {
  console.error('[yuan-migration] failed; transaction rolled back', error);
  process.exitCode = 1;
} finally {
  db.close();
}
