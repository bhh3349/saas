const XLSX = require('xlsx');

function verify(file) {
  const wb = XLSX.readFile(file);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: true });

  let headerIdx = -1;
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i].map((c) => String(c ?? '').trim());
    if (!row.some((c) => c.includes('菜品名称'))) continue;
    const nonEmpty = row.filter((c) => c !== '').length;
    if (nonEmpty >= 4) { headerIdx = i; break; }
  }
  console.log('\n=== file:', file.split('\\').pop());
  console.log('headerIdx:', headerIdx, 'row:', JSON.stringify(rows[headerIdx]));
  if (headerIdx === -1) { console.log('NO HEADER'); return; }

  const header = rows[headerIdx].map((c) => String(c ?? '').trim());
  const colName = header.findIndex((c) => c.includes('菜品名称') || (c.includes('名称') && !c.includes('套餐')));
  const colCategory = header.findIndex((c) => c.includes('菜品分类') || c.includes('基础分类') || c.includes('分类'));
  const colType = header.findIndex((c) => c.includes('菜品类型'));
  const colPrice = header.findIndex((c) => c.includes('菜品价格') || c.includes('售卖价') || c.includes('售价') || c.includes('价格'));
  const colStatus = header.findIndex((c) => c.includes('状态'));
  let colSpec = header.findIndex((c) => c.includes('菜品规格') || c.includes('规格名称'));
  if (colSpec === -1) colSpec = header.findIndex((c) => c.includes('规格') && !c.includes('编码'));
  console.log('cols:', { colName, colCategory, colType, colPrice, colStatus, colSpec });

  const out = []; const errors = []; const seen = new Set();
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i].map((c) => String(c ?? '').trim());
    if (row.every((c) => c === '')) continue;
    const name = colName >= 0 ? row[colName] : '';
    if (!name) { errors.push(`第 ${i + 1} 行缺少名称`); continue; }
    if (name.startsWith('示例')) continue;
    const category = colCategory >= 0 && row[colCategory] ? row[colCategory] : '';
    if (!category) { errors.push(`第 ${i + 1} 行缺少分类:${name}`); continue; }
    const rawPrice = colPrice >= 0 ? row[colPrice] : '';
    if (rawPrice === '') { errors.push(`第 ${i + 1} 行缺少价格:${name}`); continue; }
    const price = Number(rawPrice);
    if (Number.isNaN(price) || price < 0) { errors.push(`第 ${i + 1} 行价格非法:${name}`); continue; }
    const status = colStatus >= 0 && row[colStatus] ? row[colStatus] : '在售';
    if (status !== '在售' && status !== '停售') { errors.push(`第 ${i + 1} 行状态非法:${name}`); continue; }
    const spec = colSpec >= 0 && row[colSpec] ? row[colSpec] : '标准';
    const key = `${name}|${spec}`;
    if (seen.has(key)) { errors.push(`第 ${i + 1} 行重复:${key}`); continue; }
    seen.add(key);
    out.push({ name, category, type: '普通菜', price, spec, status });
  }
  console.log('parsed rows:', out.length, 'errors:', errors.length);
  if (errors.length) console.log(errors.slice(0, 5));
  console.log('sample:', JSON.stringify(out.slice(0, 3)));
}

verify('D:\\c\\Users\\Administrator\\Downloads\\一棵树土火锅_菜品导入模板.xlsx');
verify('D:\\c\\Users\\Administrator\\Downloads\\一棵树土火锅_菜品库_20260824_1833_a19238245609_1787567635222.xlsx');
