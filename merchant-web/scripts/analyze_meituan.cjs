const XLSX = require('xlsx');
const path = 'D:\\c\\Users\\Administrator\\Downloads\\一棵树土火锅_菜品库_20260824_1833_a19238245609_1787567635222.xlsx';
const wb = XLSX.readFile(path);
const ws = wb.Sheets['菜品'];
const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: true });
const header = aoa[3].map(String);
console.log('HEADER:', header);
const data = aoa.slice(4).filter((r) => r.some((c) => String(c).trim() !== ''));
console.log('data rows:', data.length);

const catMap = {};
data.forEach((r) => { const c = String(r[3]).trim(); catMap[c] = (catMap[c] || 0) + 1; });
console.log('CATEGORIES:', JSON.stringify(catMap));

const specMap = {};
data.forEach((r) => { const c = String(r[6]).trim(); specMap[c] = (specMap[c] || 0) + 1; });
console.log('SPECS:', JSON.stringify(specMap));

const nameCount = {};
data.forEach((r) => { const n = String(r[2]).trim(); nameCount[n] = (nameCount[n] || 0) + 1; });
const names = Object.keys(nameCount);
console.log('unique names:', names.length);
const multi = names.filter((n) => nameCount[n] > 1);
console.log('multi-spec dishes:', multi.length, '->', multi.slice(0, 5).join(', '));

let bad = 0;
data.forEach((r, i) => {
  const name = String(r[2]).trim(), cat = String(r[3]).trim(), spec = String(r[6]).trim(), price = r[7];
  if (!name) { bad++; console.log('EMPTY NAME row', i + 4); }
  if (!cat) { bad++; console.log('EMPTY CAT row', i + 4, name); }
  if (Number.isNaN(Number(price)) || Number(price) < 0) { bad++; console.log('BAD PRICE row', i + 4, name, price); }
});
console.log('bad rows:', bad);

data.slice(0, 12).forEach((r, i) => console.log(i + 4, JSON.stringify(r)));
multi.slice(0, 2).forEach((n) => {
  console.log('--- multi example:', n);
  data.forEach((r) => { if (String(r[2]).trim() === n) console.log('   ', JSON.stringify(r)); });
});
