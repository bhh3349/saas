/**
 * 把美团导出的菜品 xlsx 导入 saas-service 后端（分类 + 菜品批量导入）。
 *
 * 流程：
 *   1. 解析 xlsx（复用前端 BatchImportDishModal 的模板解析逻辑）
 *   2. 登录获取 token
 *   3. 拉取现有菜品 / 分类（去重）
 *   4. 创建缺失分类（POST /admin/categories）
 *   5. 按名称分组合并多规格 → 分批 POST /admin/dishes/import（每批 ≤500）
 *   6. 对「停售」菜品逐个下架（POST /admin/dishes/:id/status）
 *
 * 用法：node scripts/import_dishes_to_backend.cjs [xlsx路径]
 *       默认文件：D:\c\Users\Administrator\Downloads\一棵树土火锅_菜品导入模板.xlsx
 */
const fs = require('fs');
const XLSX = require('xlsx');

const API_BASE = process.env.API_BASE || 'http://localhost:3200';
const PHONE = process.env.PHONE || '13800000001';
const PASSWORD = process.env.PASSWORD || 'test123456';
const DEFAULT_FILE = 'D:\\c\\Users\\Administrator\\Downloads\\一棵树土火锅_菜品导入模板.xlsx';

const BATCH_SIZE = 500;

/* ---------- 解析 xlsx → ImportDishRow[]（与前端 BatchImportDishModal.parseRows 一致） ---------- */
function parseRows(rows) {
  let headerIdx = -1;
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i].map((c) => String(c ?? '').trim());
    if (!row.some((c) => c.includes('菜品名称'))) continue;
    const nonEmpty = row.filter((c) => c !== '').length;
    if (nonEmpty >= 4) { headerIdx = i; break; }
  }
  if (headerIdx === -1) throw new Error('未找到表头，请使用系统模板（需包含「菜品名称」列）');

  const header = rows[headerIdx].map((c) => String(c ?? '').trim());
  const colName = header.findIndex((c) => c.includes('菜品名称') || (c.includes('名称') && !c.includes('套餐')));
  const colCategory = header.findIndex((c) => c.includes('菜品分类') || c.includes('基础分类') || c.includes('分类'));
  const colType = header.findIndex((c) => c.includes('菜品类型'));
  const colPrice = header.findIndex((c) => c.includes('菜品价格') || c.includes('售卖价') || c.includes('售价') || c.includes('价格'));
  const colStatus = header.findIndex((c) => c.includes('状态'));
  let colSpec = header.findIndex((c) => c.includes('菜品规格') || c.includes('规格名称'));
  if (colSpec === -1) colSpec = header.findIndex((c) => c.includes('规格') && !c.includes('编码'));

  const out = [];
  const errors = [];
  const seen = new Set();

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i].map((c) => String(c ?? '').trim());
    if (row.every((c) => c === '')) continue;
    const name = colName >= 0 ? row[colName] : '';
    if (!name) { errors.push(`第 ${i + 1} 行：缺少菜品名称`); continue; }
    if (name.startsWith('示例')) continue;
    const category = colCategory >= 0 && row[colCategory] ? row[colCategory] : '';
    if (!category) { errors.push(`第 ${i + 1} 行：缺少菜品分类`); continue; }
    const typeRaw = colType >= 0 ? row[colType] : '';
    const type = typeRaw === '称重菜' ? '称重菜' : '普通菜';
    const rawPrice = colPrice >= 0 ? row[colPrice] : '';
    if (rawPrice === '') { errors.push(`第 ${i + 1} 行：缺少菜品价格`); continue; }
    const price = Number(rawPrice);
    if (Number.isNaN(price) || price < 0) { errors.push(`第 ${i + 1} 行：价格非法`); continue; }
    const status = colStatus >= 0 && row[colStatus] ? row[colStatus] : '在售';
    if (status !== '在售' && status !== '停售') { errors.push(`第 ${i + 1} 行：状态仅支持在售/停售`); continue; }
    const spec = colSpec >= 0 && row[colSpec] ? row[colSpec] : '标准';
    const key = `${name}|${spec}`;
    if (seen.has(key)) { errors.push(`第 ${i + 1} 行：重复 ${key}`); continue; }
    seen.add(key);
    out.push({ name, category, type, price, spec, status });
  }
  return { rows: out, errors };
}

/* ---------- HTTP 请求封装（响应统一 {code, message, data}） ---------- */
async function api(path, { method = 'GET', body, token } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json();
  if (!res.ok || json.code !== 0) {
    throw new Error(`${method} ${path} 失败: ${json.message || res.statusText}`);
  }
  return json.data;
}

/* ---------- 拉取全部菜品（分页） ---------- */
async function fetchAllDishes(token) {
  const all = [];
  let page = 1;
  const pageSize = 100;
  for (;;) {
    const data = await api(`/admin/dishes?page=${page}&page_size=${pageSize}`, { token });
    all.push(...data.items);
    if (all.length >= data.total || data.items.length === 0) break;
    page++;
  }
  return all;
}

/* ---------- 主流程 ---------- */
async function main() {
  const file = process.argv[2] || DEFAULT_FILE;
  if (!fs.existsSync(file)) {
    console.error(`文件不存在: ${file}`);
    process.exit(1);
  }

  // 1. 解析
  const wb = XLSX.readFile(file);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: true });
  const { rows, errors } = parseRows(aoa);
  if (rows.length === 0) {
    console.error(`未解析到有效菜品数据（错误: ${errors[0] || '空' }）`);
    process.exit(1);
  }
  console.log(`解析完成：${rows.length} 行${errors.length ? `，跳过 ${errors.length} 行无效数据（首条：${errors[0]}）` : ''}`);

  // 2. 登录
  const auth = await api('/auth/login', { method: 'POST', body: { phone: PHONE, password: PASSWORD } });
  const token = auth.token;
  if (!token) throw new Error('登录未返回 token');
  console.log(`登录成功：${PHONE}（shopId=${auth.user?.shop_id ?? auth.shop_id ?? '-'}）`);

  // 3. 拉取现有菜品 / 分类
  const existing = await fetchAllDishes(token);
  const existingNames = new Set(existing.map((d) => d.name));
  const cats = await api('/admin/categories', { token });
  const existingCatNames = new Set(cats.map((c) => c.name));

  // 4. 创建缺失分类
  const catSet = new Set(rows.map((r) => r.category).filter(Boolean));
  const needCreate = [...catSet].filter((c) => !existingCatNames.has(c));
  console.log(`分类：共 ${catSet.size} 个，需新建 ${needCreate.length} 个`);
  for (const name of needCreate) {
    await api('/admin/categories', { method: 'POST', body: { name }, token });
    console.log(`  创建分类：${name}`);
  }

  // 5. 按名称分组合并多规格（与前端 handleImportSubmit 一致）
  const groups = new Map();
  for (const r of rows) {
    const arr = groups.get(r.name);
    if (arr) arr.push(r);
    else groups.set(r.name, [r]);
  }
  const now = Date.now();
  let counter = 0;
  const payloads = [];
  const offSaleNames = new Set();
  let skip = 0;
  for (const [name, group] of groups) {
    if (existingNames.has(name)) { skip++; continue; }
    const first = group[0];
    const multi = new Set(group.map((r) => r.spec)).size > 1;
    const specs = multi
      ? group.map((r) => ({ name: r.spec, price_delta: Math.round((r.price - first.price) * 100) / 100 }))
      : undefined;
    payloads.push({
      name,
      category: first.category,
      type: first.type,
      price: first.price,
      code: `D${now}_${counter}`,
      spec_code: `S${now}_${counter++}`,
      ...(specs ? { specs } : {}),
    });
    // 多规格中只要有一个在售则整菜在售；全部停售才下架
    if (group.every((r) => r.status === '停售')) offSaleNames.add(name);
  }
  console.log(`菜品：共 ${groups.size} 个，可导入 ${payloads.length} 个${skip ? `，跳过 ${skip} 个重名` : ''}，其中 ${offSaleNames.size} 个停售（导入后下架）`);

  // 6. 分批导入
  let imported = 0;
  for (let i = 0; i < payloads.length; i += BATCH_SIZE) {
    const batch = payloads.slice(i, i + BATCH_SIZE);
    const res = await api('/admin/dishes/import', { method: 'POST', body: { items: batch }, token });
    imported += res.count;
    console.log(`  导入批次 ${i / BATCH_SIZE + 1}: ${res.count} 条`);
  }

  // 7. 下架停售菜品
  if (offSaleNames.size > 0) {
    const all = await fetchAllDishes(token);
    const toOff = all.filter((d) => offSaleNames.has(d.name));
    let offed = 0;
    for (const d of toOff) {
      await api(`/admin/dishes/${d.id}/status`, { method: 'POST', body: { status: 'off_sale' }, token });
      offed++;
    }
    console.log(`已下架停售菜品 ${offed} 个`);
  }

  console.log(`\n导入完成：成功导入 ${imported} 个菜品，新建 ${needCreate.length} 个分类${skip ? `，跳过 ${skip} 个重名` : ''}`);
}

main().catch((e) => {
  console.error('\n导入失败:', e.message);
  process.exit(1);
});
