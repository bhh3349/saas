// fix-uts-compat3.mjs — 把 (parseInt/parseFloat(x) || 0) 形式替换为 utils/num.uts 的 toInt/toNum
import fs from 'node:fs';
import path from 'node:path';

const root = 'D:\\c\\saas\\cashier-app';

const rules = [
  [/\(parseInt\(key\.substring\(0, idx\)\) \|\| 0\)/g, 'toInt(key.substring(0, idx))'],
  [/\(parseInt\(key\.substring\(idx \+ 1\)\) \|\| 0\)/g, 'toInt(key.substring(idx + 1))'],
  [/\(parseInt\(key\.substring\(key\.indexOf\('_'\) \+ 1\)\) \|\| 0\)/g, 'toInt(key.substring(key.indexOf(\'_\') + 1))'],
  [/\(parseInt\(rawId\) \|\| 0\)/g, 'toInt(rawId)'],
  [/\(parseFloat\(options\['([\w_]+)'\]\) \|\| 0\)/g, "toNum(options['$1'])"],
  [/\(parseFloat\(this\.paidInput\) \|\| 0\)/g, 'toNum(this.paidInput)'],
  [/\(parseFloat\(res\.content\) \|\| 0\)/g, 'toNum(res.content)'],
  [/\(parseFloat\(\(parsed\['id'\] \?\? '0'\)\.toString\(\)\) \|\| 0\)/g, "toNum((parsed['id'] ?? '0').toString())"],
  [/\(parseFloat\(\(parsed\['shop_id'\] \?\? '0'\)\.toString\(\)\) \|\| 0\)/g, "toNum((parsed['shop_id'] ?? '0').toString())"],
];

// 需要补 import 的文件 → import 行插入位置（首个 import 行后）
const needImport = ['pages\\cart\\index.uvue', 'pages\\home\\index.uvue', 'pages\\order\\index.uvue', 'pages\\order-detail\\index.uvue', 'pages\\orders\\index.uvue', 'pages\\settle\\index.uvue', 'pages\\tables\\index.uvue'];

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
  let c = orig;
  for (const [re, to] of rules) c = c.replace(re, to);
  // 用到 toInt/toNum 的页面补 import
  if (c !== orig && needImport.some((s) => file.endsWith(s))) {
    if (!c.includes('utils/num.uts') && (c.includes('toInt(') || c.includes('toNum('))) {
      c = c.replace(/(^import .*\n)/m, "$1import { toInt, toNum } from '../utils/num.uts'\n");
    }
  }
  if (c !== orig) {
    fs.writeFileSync(file, c, 'utf8');
    changed++;
    console.log('CHANGED:', path.relative(root, file));
  }
}
console.log('TOTAL_CHANGED=' + changed);
