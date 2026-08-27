#!/usr/bin/env node
/**
 * 造真实业务数据脚本（路径 A：让商家后台报表有真实数据可看）
 *
 * 流程：拉起 platform-service(3100) + saas-service(3200)（端口空闲则清库重建）
 *   → 平台造码 → 注册店铺 → 建分类/菜品/桌台/结账方式/员工
 *   → 造 5 天真实业务订单（桌台/叫号、结账、免单、挂账+补收、改价、优惠券、折扣、退菜、拒单）
 *   → 回填历史日期时间戳 → 报表接口抽查
 * 结束后两个服务保持运行，可直接打开商家后台(5175)看报表。
 *
 * 用法：node scripts/seed-real.mjs
 * 前置：3100 / 3200 端口空闲（服务由本脚本拉起）
 */
import { spawn } from 'node:child_process';
import { rmSync, existsSync, writeSync, openSync, closeSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const PLATFORM_DIR = join(ROOT, '..', 'platform-service');

const PLATFORM_URL = 'http://127.0.0.1:3100';
const SAAS_URL = 'http://127.0.0.1:3200';
const BOSS = { phone: '13800000001', password: 'pass123456' };
const CASHIER = { phone: '13800000002', password: 'pass123456' };
const FINANCE = { phone: '13800000003', password: 'pass123456' };
const SHOP_NAME = '川香居餐厅（演示店）';
const DAYS = 5; // 造数据天数（含今天，d=0 为今天）

// ---- 可复现随机数 ----
let seed = 20260826;
const rand = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 0xffffffff);
const randInt = (min, max) => Math.floor(rand() * (max - min + 1)) + min;
const pick = (arr) => arr[Math.floor(rand() * arr.length)];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const LOG_FD = openSync(join(__dirname, 'seed-real.log'), 'w');
// 无缓冲输出：控制台(管道) + 日志文件双写，避免重定向/管道下进度不可见
const log = (...a) => {
  const line = a.join(' ') + '\n';
  writeSync(1, line);
  writeSync(LOG_FD, line);
};
const started = [];

// ---- HTTP 辅助 ----
async function api(base, method, path, { token, body } = {}) {
  const res = await fetch(base + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(30000),
  });
  const data = await res.json();
  if (!res.ok || data.code !== 0) {
    throw new Error(`[${method} ${path}] ${res.status} ${JSON.stringify(data)}`);
  }
  return data.data;
}

// ---- 端口探测 ----
function portOpen(port) {
  return new Promise((resolve) => {
    const sock = require('node:net').connect(port, '127.0.0.1', () => {
      sock.end();
      resolve(true);
    });
    sock.on('error', () => resolve(false));
  });
}
async function waitPort(port, ms = 60000) {
  const start = Date.now();
  while (Date.now() - start < ms) {
    if (await portOpen(port)) return true;
    await sleep(400);
  }
  return false;
}

// ---- 拉起服务（端口占用则报错，需干净环境） ----
async function ensureService(port, dir, env) {
  if (await portOpen(port)) {
    throw new Error(`端口 ${port} 已被占用，请先停止 ${dir} 中的旧服务再运行`);
  }
  const dataDir = join(dir, 'data');
  if (existsSync(dataDir)) rmSync(dataDir, { recursive: true, force: true });
  const child = spawn('node', ['dist/main.js'], {
    cwd: dir,
    env: { ...process.env, ...env },
    stdio: 'ignore',
  });
  started.push(child);
  const ok = await waitPort(port);
  if (!ok) throw new Error(`服务启动超时：${dir}（端口 ${port}）`);
  log(`  ✔ 服务就绪 ${dir}（端口 ${port}）`);
}

// ---- 造数据主流程 ----
async function main() {
  if (process.env.SKIP_SERVE) {
    log('== 1. 跳过服务拉起（SKIP_SERVE=1，复用已运行服务）==');
  } else {
    log('== 1. 拉起服务 ==');
    await ensureService(3100, PLATFORM_DIR, { PORT: '3100', SEED_OPERATOR_PASSWORD: 'admin123456' });
    await ensureService(3200, ROOT, {
      PORT: '3200',
      PLATFORM_INTERNAL_BASE_URL: PLATFORM_URL,
      PLATFORM_INTERNAL_SECRET: 'dev-internal-secret',
    });
  }

  log('== 2. 平台造激活码 ==');
  const plat = await api(PLATFORM_URL, 'POST', '/auth/login', {
    body: { username: 'admin', password: 'admin123456' },
  });
  const platToken = plat.token;
  const batch = await api(PLATFORM_URL, 'POST', '/admin/codes/batch', {
    token: platToken,
    body: { count: 1, note: '收银App联调', batch_no: `seed-${Date.now()}`, prefix: 'SEED' },
  });
  const code = batch.codes[0];
  log(`  ✔ 激活码: ${code}`);

  log('== 3. 注册店铺 + 老板登录 ==');
  await api(SAAS_URL, 'POST', '/auth/register', {
    body: {
      code,
      phone: BOSS.phone,
      password: BOSS.password,
      shop_name: SHOP_NAME,
      shop_address: '演示路 88 号',
    },
  });
  const boss = await api(SAAS_URL, 'POST', '/auth/login', {
    body: { phone: BOSS.phone, password: BOSS.password },
  });
  const token = boss.token;
  const shopId = boss.user.shop_id;
  log(`  ✔ 店铺「${SHOP_NAME}」id=${shopId}，老板账号 ${BOSS.phone}`);

  log('== 4. 建分类 / 菜品 / 桌台 / 结账方式 / 员工 ==');
  // 分类
  const catNames = ['热菜', '凉菜', '主食', '汤类', '饮品'];
  const cats = {};
  for (let i = 0; i < catNames.length; i++) {
    cats[catNames[i]] = await api(SAAS_URL, 'POST', '/admin/categories', {
      token,
      body: { name: catNames[i], sort_order: i + 1 },
    });
  }
  // 菜品（含规格）
  const dishDefs = [
    { name: '宫保鸡丁', category: '热菜', price: 28.5, specs: [{ name: '大份', price_delta: 6 }, { name: '小份', price_delta: -4 }] },
    { name: '水煮鱼', category: '热菜', price: 68, specs: [{ name: '大份', price_delta: 10 }] },
    { name: '回锅肉', category: '热菜', price: 32 },
    { name: '麻婆豆腐', category: '热菜', price: 22, specs: [{ name: '大份', price_delta: 4 }] },
    { name: '鱼香肉丝', category: '热菜', price: 26 },
    { name: '辣子鸡丁', category: '热菜', price: 36 },
    { name: '拍黄瓜', category: '凉菜', price: 12 },
    { name: '口水鸡', category: '凉菜', price: 30 },
    { name: '凉拌木耳', category: '凉菜', price: 14 },
    { name: '皮蛋豆腐', category: '凉菜', price: 10 },
    { name: '白米饭', category: '主食', price: 2, specs: [{ name: '加量', price_delta: 1 }] },
    { name: '蛋炒饭', category: '主食', price: 12 },
    { name: '手工水饺(12只)', category: '主食', price: 16 },
    { name: '阳春面', category: '主食', price: 10 },
    { name: '紫菜蛋花汤', category: '汤类', price: 15, specs: [{ name: '大份', price_delta: 5 }] },
    { name: '番茄蛋汤', category: '汤类', price: 13 },
    { name: '可乐', category: '饮品', price: 6 },
    { name: '酸梅汤', category: '饮品', price: 8 },
  ];
  const dishes = [];
  for (const d of dishDefs) {
    const created = await api(SAAS_URL, 'POST', '/admin/dishes', {
      token,
      body: { name: d.name, category: d.category, price: d.price, specs: d.specs || [], code: `D${dishes.length + 1}` },
    });
    dishes.push(created);
  }
  // 桌台
  const tables = [];
  for (let i = 1; i <= 6; i++) {
    tables.push(await api(SAAS_URL, 'POST', '/admin/tables', { token, body: { name: `大厅${i}号`, area: '大厅', capacity: i % 2 ? 4 : 6 } }));
  }
  for (let i = 1; i <= 3; i++) {
    tables.push(await api(SAAS_URL, 'POST', '/admin/tables', { token, body: { name: `包间${i}`, area: '包间', capacity: 8 + i } }));
  }
  // 结账方式（注册自带现金/微信/支付宝，补一个赊账）
  await api(SAAS_URL, 'POST', '/admin/payments', { token, body: { name: '赊账', sort: 4 } });
  const payments = await api(SAAS_URL, 'GET', '/payments', { token });
  const pm = Object.fromEntries(payments.map((p) => [p.name, p.id]));
  log(`  ✔ 分类 ${catNames.length} 个 / 菜品 ${dishes.length} 道 / 桌台 ${tables.length} 张 / 结账方式 ${payments.map((p) => p.name).join(',')}`);

  // 员工（收银员 / 财务）
  await api(SAAS_URL, 'POST', '/admin/staff', { token, body: { phone: CASHIER.phone, password: CASHIER.password, name: '张三', role: 'cashier' } });
  await api(SAAS_URL, 'POST', '/admin/staff', { token, body: { phone: FINANCE.phone, password: FINANCE.password, name: '李四', role: 'finance' } });
  log(`  ✔ 收银员 ${CASHIER.phone} / 财务 ${FINANCE.phone}（密码均为 pass123456）`);

  log('== 5. 造 5 天业务订单 ==');
  const refundReasons = ['口味不合适', '上错了菜', '菜里有异物', '客人退菜', '份量太少'];
  const orderRecs = []; // { id, dayOffset, settledAt?: 'now' }
  const pendingAccounts = []; // 待补收的挂账单 { id, day: offset }

  const makeOrder = async (dayOffset) => {
    const isTable = rand() < 0.7;
    let tableId = null;
    if (isTable) {
      const list = await api(SAAS_URL, 'GET', '/tables', { token });
      const idle = list.filter((t) => t.status === 'idle');
      if (idle.length === 0) return null;
      tableId = pick(idle).id;
    }
    // 随机 1~4 道菜
    const nItems = randInt(1, 4);
    const chosen = new Set();
    const items = [];
    for (let i = 0; i < nItems; i++) {
      let dish = pick(dishes);
      let guard = 0;
      while (chosen.has(dish.id) && guard++ < 20) dish = pick(dishes);
      chosen.add(dish.id);
      items.push({ dish_id: dish.id, qty: randInt(1, 3), ...(dish.specs?.length && rand() < 0.4 ? { spec_index: randInt(0, dish.specs.length - 1) } : {}) });
    }
    const order = await api(SAAS_URL, 'POST', '/orders', {
      token,
      body: { mode: isTable ? 'table' : 'ticket', ...(tableId ? { table_id: tableId } : {}), items },
    });
    return order;
  };

  for (let d = 0; d < DAYS; d++) {
    const label = d === 0 ? '今天' : `-${d}天`;
    // 先补收昨天的挂账单
    const toCollect = pendingAccounts.filter((p) => p.day === d - 1);
    for (const p of toCollect) {
      await api(SAAS_URL, 'POST', `/orders/${p.id}/settle`, {
        token,
        body: { payment_method_id: pm['微信'] },
      });
      const rec = orderRecs.find((x) => x.id === p.id);
      if (rec) rec.settledDay = d; // 补收日归入今天
    }
    const n = 8 + randInt(0, 4); // 每天 8~12 单
    let made = 0;
    let rejectDone = false;
    let pendingToday = false;
    for (let i = 0; i < n; i++) {
      const order = await makeOrder(d);
      if (!order) continue;
      made++;
      // 今天留 1 单待接单（不接单不结账）
      if (d === 0 && !pendingToday && rand() < 0.25) {
        pendingToday = true;
        orderRecs.push({ id: order.id, createdDay: d }); // 未结账，无 settled_at
        continue;
      }
      // 每天 1 单拒单
      if (!rejectDone && rand() < 0.3) {
        rejectDone = true;
        await api(SAAS_URL, 'POST', `/orders/${order.id}/reject`, { token });
        orderRecs.push({ id: order.id, createdDay: d }); // 拒单，无 settled_at
        continue;
      }
      await api(SAAS_URL, 'POST', `/orders/${order.id}/confirm`, { token });
      const roll = rand();
      const pay = order.total_amount; // 应付（元）
      // 挂账：仅 d>=1（次日补收）
      if (d >= 1 && roll < 0.06) {
        await api(SAAS_URL, 'POST', `/orders/${order.id}/on-account`, { token });
        pendingAccounts.push({ id: order.id, day: d });
        orderRecs.push({ id: order.id, createdDay: d }); // 挂账未结，settledDay 在次日补收时设置
        continue;
      }
      // 免单
      if (roll < 0.11) {
        await api(SAAS_URL, 'POST', `/orders/${order.id}/free`, { token });
        orderRecs.push({ id: order.id, createdDay: d, settledDay: d });
        continue;
      }
      // 结账：优惠策略
      const r2 = rand();
      const methodName = pick(pm['现金'] ? ['现金', '微信', '支付宝', '微信', '支付宝'] : ['微信', '支付宝']);
      const body = { payment_method_id: pm[methodName] };
      if (r2 < 0.08 && pay >= 50) {
        // 折扣：满 50 减随机 5~15
        const amt = Math.min(15, Math.round(pay * 0.15 * 10) / 10);
        body.discount_amount = amt;
        body.discount_type = 'discount';
        body.discount_name = '开业八八折';
      } else if (r2 < 0.15) {
        // 优惠券：新客立减 10
        const amt = Math.min(10, pay - 1);
        body.discount_amount = amt;
        body.discount_type = 'voucher';
        body.discount_name = '新客立减10元';
        body.voucher_id = 1;
      } else if (r2 < 0.20 && pay >= 20) {
        // 改价抹零：随机 0.1~2 元
        body.discount_amount = Math.round(randInt(1, 20)) / 10;
        body.discount_type = 'price_change';
        body.discount_name = '抹零';
      } else if (methodName === '现金' && rand() < 0.3) {
        // 现金找零：向上取整到 10 元
        body.paid_amount = Math.ceil(pay) % 10 === 0 ? Math.ceil(pay) : (Math.floor(pay / 10) + 1) * 10;
      }
      await api(SAAS_URL, 'POST', `/orders/${order.id}/settle`, { token, body });
      // 结账后退菜（每天 1~2 单，选多菜品单）
      if (order.items && order.items.length >= 2 && rand() < 0.18) {
        const snap = order.items;
        const target = snap[randInt(0, snap.length - 1)];
        await api(SAAS_URL, 'POST', `/orders/${order.id}/refund`, {
          token,
          body: { items: [{ dish_id: target.dish_id, qty: 1, reason: pick(refundReasons) }], reason: '客人退菜' },
        });
      }
      orderRecs.push({ id: order.id, createdDay: d, settledDay: d });
    }
    log(`  ✔ ${label}: ${made} 单（挂账待补收 ${pendingAccounts.filter((p) => p.day === d).length} 单）`);
  }

  log('== 6. 回填历史日期时间戳（UTC 存储，与 typeorm 写入格式一致）==');
  const db = require('../node_modules/better-sqlite3')(join(ROOT, 'data', 'saas.db'));
  const p2 = (n) => String(n).padStart(2, '0');
  // typeorm 对 sqlite 按 UTC 组件序列化（写入 datetime('now')，查询参数也是 UTC）
  const fmtUtc = (dt) =>
    `${dt.getUTCFullYear()}-${p2(dt.getUTCMonth() + 1)}-${p2(dt.getUTCDate())} ${p2(dt.getUTCHours())}:${p2(dt.getUTCMinutes())}:${p2(dt.getUTCSeconds())}.000`;
  const dayDate = (offset) => {
    const now = new Date();
    // 营业时段 11:00~21:00（本地）对应 UTC 3:00~13:00
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - offset, randInt(3, 13), randInt(0, 59), randInt(0, 59)));
  };
  let backfilled = 0;
  const updOrder = db.prepare('UPDATE orders SET created_at = ?, settled_at = ? WHERE id = ?');
  const updLog = db.prepare("UPDATE operation_logs SET created_at = ? WHERE target_type = 'order' AND target_id = ?");
  const updRefund = db.prepare('UPDATE order_refunds SET refunded_at = ? WHERE order_id = ?');
  const tx = db.transaction((recs) => {
    for (const r of recs) {
      if (r.createdDay === 0) continue; // 今天的订单由 typeorm 实时写入，不回填
      const createdAt = fmtUtc(dayDate(r.createdDay));
      const settledAt = r.settledDay != null ? fmtUtc(dayDate(r.settledDay)) : null;
      updOrder.run(createdAt, settledAt, r.id);
      updLog.run(createdAt, r.id);
      updRefund.run(createdAt, r.id);
      backfilled++;
    }
  });
  tx(orderRecs);
  db.close();
  log(`  ✔ 回填 ${backfilled} 条订单时间戳（操作日志/退菜明细已同步）`);

  log('== 7. 报表抽查 ==');
  const q = (from, to) => `?from=${from}&to=${to}`;
  const today = await api(SAAS_URL, 'GET', '/reports/today', { token });
  log('  今日概览:', JSON.stringify(today));
  const from = new Date(Date.now() - (DAYS - 1) * 86400000).toISOString().slice(0, 10);
  const to = new Date().toISOString().slice(0, 10);
  const range = q(from, to);
  const summary = await api(SAAS_URL, 'GET', `/reports/summary${range}`, { token });
  log(`  近${DAYS}天汇总: 营业额=${summary.revenue}元 订单=${summary.order_count}（挂账待收 ${summary.pending_receivable} 元）`);
  const dishSales = await api(SAAS_URL, 'GET', `/reports/dish-sales${q(from, to)}`, { token });
  log(`  菜品销售统计: ${dishSales.total} 个菜品，Top3: ${dishSales.items.slice(0, 3).map((d) => `${d.name}×${d.qty}`).join(' / ')}`);
  const promo = await api(SAAS_URL, 'GET', `/reports/promo-stats${range}`, { token });
  log(`  促销活动: ${promo.summary.promo_count} 个活动，优惠 ${promo.summary.discount_amount} 元`);
  const sensitive = await api(SAAS_URL, 'GET', `/reports/sensitive-stats${range}`, { token });
  log('  敏感操作:', JSON.stringify(sensitive.items));
  const refund = await api(SAAS_URL, 'GET', `/reports/dish-refund${range}`, { token });
  log(`  退菜统计: ${refund.total} 个菜品被退`);

  log('');
  log('✅ 造数完成！服务保持运行中：');
  log(`   - 商家后台报表入口: http://127.0.0.1:5175（需另起 merchant-web）`);
  log(`   - 登录：老板 ${BOSS.phone} / 收银员 ${CASHIER.phone} / 财务 ${FINANCE.phone}（密码均 pass123456）`);
  log(`   - 店铺：${SHOP_NAME}`);
}

main()
  .catch((err) => {
    const line = `❌ 造数失败: ${err.message}\n`;
    writeSync(1, line);
    writeSync(LOG_FD, line);
    process.exitCode = 1;
  })
  .finally(() => closeSync(LOG_FD));
