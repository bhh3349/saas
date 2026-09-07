// fix-uts-compat2.mjs — 页面层 5.24 兼容修复
// 1) onLoad(options: Record<string, string>) → OnLoadOptions
// 2) Number(字符串/可空) → parseInt/parseFloat（|| 0 保持 NaN→0 语义）
// 3) Number(数字表达式) → 直接表达式（Number 全局函数在 UTS 不存在）
// 4) {} as Record<...> → 声明式 const x: Record<...> = {}
import fs from 'node:fs';
import path from 'node:path';

const root = 'D:\\c\\saas\\cashier-app';

const rules = [
  [/onLoad\(options: Record<string, string>\)/g, 'onLoad(options: OnLoadOptions)'],
  // Number(字符串 ?? '') → parseFloat（|| 0 保 NaN 语义）
  [/Number\((options\['[\w_]+'\] \?\? '')\)/g, '(parseFloat($1) || 0)'],
  // Number(可空数字 ?? 0) → 直接表达式（Number 全局函数不存在）
  [/Number\((this\.order\.total_amount \?\? 0)\)/g, '($1)'],
  [/Number\((this\.order\.paid_amount \?\? 0)\)/g, '($1)'],
  [/Number\((this\.order\.discount_amount \?\? 0)\)/g, '($1)'],
  [/Number\((settledOrder\.total_amount \?\? 0)\)/g, '($1)'],
  [/Number\((settledOrder\.paid_amount \?\? 0)\)/g, '($1)'],
  [/Number\((settledOrder\.discount_amount \?\? 0)\)/g, '($1)'],
  [/Number\((o\.total_amount \?\? 0)\)/g, '($1)'],
  // Number(字符串变量/表达式)
  [/Number\(this\.paidInput\)/g, '(parseFloat(this.paidInput) || 0)'],
  [/Number\(rawId\)/g, '(parseInt(rawId) || 0)'],
  [/Number\(res\.content\)/g, '(parseFloat(res.content) || 0)'],
  [/Number\(key\.substring\(0, idx\)\)/g, '(parseInt(key.substring(0, idx)) || 0)'],
  [/Number\(key\.substring\(idx \+ 1\)\)/g, '(parseInt(key.substring(idx + 1)) || 0)'],
  [/Number\(key\.substring\(key\.indexOf\('_'\) \+ 1\)\)/g, '(parseInt(key.substring(key.indexOf(\'_\') + 1)) || 0)'],
  // home: UTSJSONObject 取值转数字
  [/Number\(parsed\['id'\]\) \?\? 0/g, "(parseFloat((parsed['id'] ?? '0').toString()) || 0)"],
  [/Number\(parsed\['shop_id'\]\) \?\? 0/g, "(parseFloat((parsed['shop_id'] ?? '0').toString()) || 0)"],
  // {} as Record → 声明式
  [/const r = \{\} as Record<string, number>/g, 'const r: Record<string, number> = {}'],
];

const charCodeRules = [];

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
  if (c !== orig) {
    fs.writeFileSync(file, c, 'utf8');
    changed++;
    console.log('CHANGED:', path.relative(root, file));
  }
}
console.log('TOTAL_CHANGED=' + changed);
