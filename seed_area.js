const Database = require('better-sqlite3');
const db = new Database('d:/c/saas/output/saas-service/data/saas.db');

// 插入外摆区（如果不存在）
db.prepare("INSERT OR IGNORE INTO areas (shop_id, name, sort) VALUES (1, '外摆区', 99)").run();
// 插入外摆区桌台
const exists = db.prepare("SELECT COUNT(*) c FROM tables WHERE shop_id=1 AND area='外摆区'").get();
if (exists.c === 0) {
  db.prepare("INSERT INTO tables (shop_id, name, area, capacity, status, created_at) VALUES (1, '外摆1号桌', '外摆区', 6, 'idle', datetime('now'))").run();
  db.prepare("INSERT INTO tables (shop_id, name, area, capacity, status, created_at) VALUES (1, '外摆2号桌', '外摆区', 4, 'idle', datetime('now'))").run();
}
const cnt = db.prepare("SELECT area, COUNT(*) c FROM tables WHERE shop_id=1 GROUP BY area").all();
console.log(JSON.stringify(cnt));
