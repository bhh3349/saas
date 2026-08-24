const XLSX = require('xlsx');
const src = 'D:\\c\\Users\\Administrator\\Downloads\\一棵树土火锅_菜品库_20260824_1833_a19238245609_1787567635222.xlsx';
const out = 'D:\\c\\Users\\Administrator\\Downloads\\一棵树土火锅_菜品导入模板.xlsx';

const wb = XLSX.readFile(src);
const ws = wb.Sheets['菜品'];
const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: true });

// 表头在 aoa[2]（前两行为标题与查询条件）
const header = aoa[2].map((c) => String(c ?? '').trim());
const col = (keys) => header.findIndex((h) => keys.some((k) => h.includes(k)));
const iName = col(['菜品名称']);
const iCat = col(['基础分类', '菜品分类', '分类']);
const iPrice = col(['售卖价', '价格']);
const iSPU = col(['SPUID']);
const iSKU = col(['SKUID']);
const iSpec = col(['规格']);
console.log('col idx:', { iName, iCat, iPrice, iSPU, iSKU, iSpec });

const rows = [];
for (let i = 3; i < aoa.length; i++) {
  const r = aoa[i].map((c) => String(c ?? '').trim());
  if (r.every((c) => c === '')) continue;
  const name = r[iName] ?? '';
  const cat = r[iCat] ?? '';
  const price = Number(r[iPrice]);
  if (!name || !cat || Number.isNaN(price) || price < 0) continue;
  rows.push([name, cat, '普通菜', price, r[iSPU] ?? '', r[iSKU] ?? '', '在售', '份', (r[iSpec] || '标准')]);
}
console.log('converted rows:', rows.length);

const outAoa = [
  ['菜品信息表'],
  ['门店：[一棵树土火锅]; 菜品分类：[全部]; 菜品名称：[全部]'],
  ['菜品名称', '菜品分类', '菜品类型', '菜品价格', '菜品编码', '规格编码', '状态', '菜品单位', '菜品规格'],
  ...rows,
];
const nws = XLSX.utils.aoa_to_sheet(outAoa);
nws['!merges'] = [
  { s: { r: 0, c: 0 }, e: { r: 0, c: 8 } },
  { s: { r: 1, c: 0 }, e: { r: 1, c: 8 } },
];
nws['!cols'] = [
  { wch: 18 }, { wch: 14 }, { wch: 10 }, { wch: 10 }, { wch: 14 }, { wch: 14 }, { wch: 8 }, { wch: 8 }, { wch: 10 },
];
const nwb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(nwb, nws, '菜品信息');
XLSX.writeFile(nwb, out);
console.log('saved:', out);
