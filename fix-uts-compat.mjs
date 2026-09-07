// fix-uts-compat.mjs — 5.24 编译器兼容批量修复
// 1) String(x) → x.toString()（可空接收器补 ?? 兜底）
// 2) esc-pos charCodeAt 判空
import fs from 'node:fs';
import path from 'node:path';

const root = 'D:\\c\\saas\\cashier-app';

// 有序替换规则（长模式优先）
const rules = [
  [/String\(d\.getMonth\(\) \+ 1\)/g, '(d.getMonth() + 1).toString()'],
  [/String\(d\.getDate\(\)\)/g, 'd.getDate().toString()'],
  [/String\(d\.getHours\(\)\)/g, 'd.getHours().toString()'],
  [/String\(d\.getMinutes\(\)\)/g, 'd.getMinutes().toString()'],
  [/String\(d\.getFullYear\(\)\)/g, 'd.getFullYear().toString()'],
  [/String\(parsed\['phone'\] \?\? ''\)/g, "(parsed['phone'] ?? '').toString()"],
  [/String\(parsed\['name'\] \?\? ''\)/g, "(parsed['name'] ?? '').toString()"],
  [/String\(parsed\['role'\] \?\? ''\)/g, "(parsed['role'] ?? '').toString()"],
  [/String\(parsed\['status'\] \?\? ''\)/g, "(parsed['status'] ?? '').toString()"],
  [/String\(parsed\['shopName'\]\)/g, "(parsed['shopName'] ?? '').toString()"],
  [/String\(parsed\['shopAddress'\]\)/g, "(parsed['shopAddress'] ?? '').toString()"],
  [/String\(parsed\['shopCreatedAt'\]\)/g, "(parsed['shopCreatedAt'] ?? '').toString()"],
  [/String\(o\.table_id \?\? ''\)/g, '(o.table_id ?? 0).toString()'],
  [/String\(o\.table_id\)/g, '(o.table_id ?? 0).toString()'],
  [/String\(o\.ticket_no\)/g, '(o.ticket_no ?? 0).toString()'],
  [/String\(o\.id\)/g, 'o.id.toString()'],
  [/String\(this\.order\.table_id\)/g, '(this.order.table_id ?? 0).toString()'],
  [/String\(this\.tableId\)/g, 'this.tableId.toString()'],
  [/String\(this\.orderId\)/g, 'this.orderId.toString()'],
  [/String\(this\.guests\)/g, 'this.guests.toString()'],
  [/String\(this\.order\.id\)/g, 'this.order.id.toString()'],
  [/String\(order\.id\)/g, 'order.id.toString()'],
  [/String\(order\.table_id\)/g, '(order.table_id ?? 0).toString()'],
  [/String\(t\.order\.id\)/g, '(t.order?.id ?? 0).toString()'],
  [/String\(t\.order\.guests\)/g, '(t.order?.guests ?? 0).toString()'],
  [/String\(t\.id\)/g, 't.id.toString()'],
  [/String\(data\.guests\)/g, '(data.guests ?? 0).toString()'],
  [/String\(it\.qty\)/g, 'it.qty.toString()'],
  [/String\(first\.qty\)/g, 'first.qty.toString()'],
  [/String\(list\.length\)/g, 'list.length.toString()'],
  [/String\(dishId\)/g, 'dishId.toString()'],
  [/String\(d\.id\)/g, 'd.id.toString()'],
  [/String\(specIndex\)/g, 'specIndex.toString()'],
  [/String\(Date\.now\(\)\)/g, 'Date.now().toString()'],
  [/String\(v\)/g, 'v.toString()'],
  [/String\(n\)/g, 'n.toString()'],
  [/String\(guests\)/g, 'guests.toString()'],
  [/String\(id\)/g, 'id.toString()'],
];

const escPosRules = [
  [/const c = s\.charCodeAt\(i\)\r?\n(\s+)if \(c >= 0x20/g, 'const c = s.charCodeAt(i)\n$1if (c == null) { continue }\n$1if (c >= 0x20'],
  [/const c = s\.charCodeAt\(i\)\r?\n(\s+)w \+= c > 0x7f/g, 'const c = s.charCodeAt(i)\n$1if (c == null) { continue }\n$1w += c > 0x7f'],
];

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === 'unpackage' || e.name === 'uni_modules' || e.name === 'node_modules') continue;
      walk(p, out);
    } else if (/\.(uts|uvue)$/.test(e.name)) {
      out.push(p);
    }
  }
  return out;
}

let changed = 0;
for (const file of walk(root)) {
  const orig = fs.readFileSync(file, 'utf8');
  let c = orig.replace(/\r\n/g, '\n');
  for (const [re, to] of rules) c = c.replace(re, to);
  if (file.endsWith('esc-pos.uts')) {
    for (const [re, to] of escPosRules) c = c.replace(re, to);
  }
  if (c !== orig) {
    fs.writeFileSync(file, c, 'utf8');
    changed++;
    console.log('CHANGED:', path.relative(root, file));
  }
}
console.log('TOTAL_CHANGED=' + changed);
