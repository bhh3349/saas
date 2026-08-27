/**
 * 一次性清理脚本：按「名称 + 分类 + 类型 + 规格」合并全部店铺的重复菜品。
 * - 同名同分类同类型：不同规格合并进 id 最小的一条（多规格），完全重复的规格行删除；
 * - 被删除记录在套餐分组 / 退菜记录中的引用自动改写为保留记录；
 * - 执行前自动备份 saas.db。
 * 用法：node scripts/dedupe-dishes.cjs（在 saas-service 目录下运行，需先停后端进程）
 */
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const dbPath = path.resolve(__dirname, '..', 'data', 'saas.db');
if (!fs.existsSync(dbPath)) {
  console.error('未找到数据库：' + dbPath);
  process.exit(1);
}

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupPath = path.join(path.dirname(dbPath), `saas.db.bak-${stamp}`);
fs.copyFileSync(dbPath, backupPath);

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

const dishes = db
  .prepare(
    'SELECT id, shop_id, name, category, price, specs, type, sort_order, status, sold_out FROM dishes ORDER BY id ASC',
  )
  .all();

function parseSpecs(s) {
  try {
    const arr = JSON.parse(s || '[]');
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

const groups = new Map();
for (const r of dishes) {
  const key = `${r.shop_id}|${r.name}|${r.category}|${r.type}`;
  if (!groups.has(key)) groups.set(key, []);
  groups.get(key).push(r);
}

const deletedMap = new Map(); // 被删 id → 保留 id
const mainUpdates = new Map(); // 保留 id → { price, specs }
let groupCount = 0;
let conflictPrices = 0;
const details = [];

for (const list of groups.values()) {
  if (list.length < 2) continue;
  const specAbs = new Map(); // 规格名 → { abs, fromId }
  for (const r of list) {
    const specs = parseSpecs(r.specs);
    if (specs.length === 0) {
      const name = '标准';
      if (!specAbs.has(name)) specAbs.set(name, { abs: r.price, fromId: r.id });
      else if (specAbs.get(name).abs !== r.price) conflictPrices++;
      continue;
    }
    for (const s of specs) {
      const name = String(s.name || '').trim() || '标准';
      const abs = r.price + (Number(s.price_delta) || 0);
      if (!specAbs.has(name)) specAbs.set(name, { abs, fromId: r.id });
      else if (specAbs.get(name).abs !== abs) conflictPrices++;
    }
  }

  const main = list[0];
  const base = Math.min(...[...specAbs.values()].map((v) => v.abs));
  if (specAbs.size <= 1) {
    mainUpdates.set(main.id, { price: (specAbs.get('标准') || { abs: base }).abs, specs: '[]' });
  } else {
    mainUpdates.set(main.id, {
      price: base,
      specs: JSON.stringify(
        [...specAbs.entries()].map(([name, v]) => ({ name, price_delta: v.abs - base })),
      ),
    });
  }
  for (const r of list.slice(1)) deletedMap.set(r.id, main.id);
  groupCount++;
  details.push({
    shop_id: main.shop_id,
    name: main.name,
    category: main.category,
    keep: main.id,
    del: list.slice(1).map((r) => r.id),
  });
}

if (deletedMap.size === 0) {
  console.log('无需清理：未发现重复菜品（备份已保留：' + backupPath + '）');
  process.exit(0);
}

// 改写套餐分组中的 dish_id
let setmealTouched = 0;
const setmeals = db.prepare('SELECT id, groups FROM setmeals').all();
const updSetmeal = db.prepare('UPDATE setmeals SET groups=? WHERE id=?');
for (const sm of setmeals) {
  let changed = false;
  let parsed;
  try {
    parsed = JSON.parse(sm.groups || '{}');
  } catch {
    continue;
  }
  const arr = Array.isArray(parsed.groups) ? parsed.groups : [];
  for (const grp of arr) {
    for (const d of Array.isArray(grp.dishes) ? grp.dishes : []) {
      if (typeof d.id === 'number' && deletedMap.has(d.id)) {
        d.id = deletedMap.get(d.id);
        changed = true;
      }
    }
  }
  if (changed) {
    updSetmeal.run(JSON.stringify(parsed), sm.id);
    setmealTouched++;
  }
}

// 改写退菜记录中的 dish_id
let refundTouched = 0;
let refunds = [];
try {
  refunds = db.prepare('SELECT id, dish_id FROM order_refunds').all();
} catch {
  refunds = [];
}
const updRefund = db.prepare('UPDATE order_refunds SET dish_id=? WHERE id=?');
for (const r of refunds) {
  if (deletedMap.has(r.dish_id)) {
    updRefund.run(deletedMap.get(r.dish_id), r.id);
    refundTouched++;
  }
}

// 更新保留记录（合并规格）
const updMain = db.prepare('UPDATE dishes SET price=?, specs=? WHERE id=?');
for (const [id, u] of mainUpdates) updMain.run(u.price, u.specs, id);

// 删除重复记录
const delStmt = db.prepare('DELETE FROM dishes WHERE id=?');
for (const id of deletedMap.keys()) delStmt.run(id);

console.log(
  JSON.stringify(
    {
      backup: backupPath,
      mergedGroups: groupCount,
      deleted: deletedMap.size,
      conflictPrices,
      setmealRefUpdated: setmealTouched,
      refundRefUpdated: refundTouched,
      details: details.slice(0, 50),
    },
    null,
    2,
  ),
);
