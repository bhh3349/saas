const XLSX = require('xlsx');
const path = 'D:\\c\\Users\\Administrator\\Downloads\\一棵树土火锅_菜品库_20260824_1833_a19238245609_1787567635222.xlsx';
const wb = XLSX.readFile(path);
wb.SheetNames.forEach((name) => {
  const ws = wb.Sheets[name];
  const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: true });
  console.log('=== SHEET:', name, 'rows:', aoa.length);
  aoa.slice(0, 15).forEach((r, i) => console.log(i + 1, JSON.stringify(r)));
});
