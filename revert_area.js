const D = require('better-sqlite3');
const db = new D('d:/c/saas/output/saas-service/data/saas.db');
const r = db.prepare("SELECT id,name FROM areas WHERE name LIKE '%测试区%'").all();
for (const a of r) {
  db.prepare('UPDATE areas SET name=? WHERE id=?').run('默认区', a.id);
  db.prepare('UPDATE tables SET area=? WHERE area=?').run('默认区', a.name);
}
console.log('reverted', r.length);
