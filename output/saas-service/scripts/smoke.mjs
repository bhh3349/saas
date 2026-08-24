/**
 * B1 冒烟测试：注册（真实跨服务调 platform claim）→ 登录 → 三角色守卫 → 多租户隔离
 *
 * 前置：
 *  - 两个服务均已 npm run build
 *  - 本脚本会自动拉起未启动的 platform-service(3100) / saas-service(3200)
 *
 * 运行：
 *   npm run smoke
 */
import { spawn } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SAAS_DIR = path.resolve(__dirname, '..');
const PLATFORM_DIR = path.resolve(__dirname, '..', '..', 'platform-service');

const PLATFORM_URL = 'http://127.0.0.1:3100';
const SAAS_URL = 'http://127.0.0.1:3200';

let failed = 0;
const checks = [];
function check(name, ok, extra = '') {
  checks.push({ name, ok });
  if (!ok) failed += 1;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? `  [${extra}]` : ''}`);
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function waitPort(port, timeoutMs = 20000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tryOnce = () => {
      const sock = net.connect({ host: '127.0.0.1', port });
      sock.once('connect', () => {
        sock.destroy();
        resolve();
      });
      sock.once('error', () => {
        sock.destroy();
        if (Date.now() - start > timeoutMs) {
          reject(new Error(`port ${port} not ready in ${timeoutMs}ms`));
        } else {
          setTimeout(tryOnce, 300);
        }
      });
    };
    tryOnce();
  });
}

async function isPortOpen(port) {
  return new Promise((resolve) => {
    const sock = net.connect({ host: '127.0.0.1', port });
    sock.once('connect', () => {
      sock.destroy();
      resolve(true);
    });
    sock.once('error', () => {
      sock.destroy();
      resolve(false);
    });
  });
}

const started = [];

/** 终止子进程：先 SIGTERM，3s 未退则强杀（Windows 上 SIGTERM/SIGKILL 均 TerminateProcess） */
function stopService(child) {
  if (!child || child.exitCode !== null) return Promise.resolve();
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      try { child.kill('SIGKILL'); } catch { /* ignore */ }
    }, 3000);
    child.once('exit', () => { clearTimeout(timer); resolve(); });
    try { child.kill('SIGTERM'); } catch { clearTimeout(timer); resolve(); }
  });
}

/**
 * 终止本次拉起的全部服务。
 * 关键：必须主动 kill 子进程，否则父进程因子进程 stdio pipe 活跃永不退出，
 * 表现为 npm run smoke「假死」——这是脚本卡死的根因。
 */
async function stopStartedServices() {
  await Promise.all(started.map(stopService));
  started.length = 0;
}

async function ensureService(port, dir, env) {
  if (await isPortOpen(port)) {
    console.log(`[smoke] port ${port} already listening, reuse`);
    return null;
  }
  // 清库保证可重复运行
  const dataDir = path.join(dir, 'data');
  if (existsSync(dataDir)) rmSync(dataDir, { recursive: true, force: true });
  console.log(`[smoke] starting service in ${dir}`);
  const child = spawn(process.execPath, ['dist/main.js'], {
    cwd: dir,
    env: { ...process.env, ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.on('data', (d) => process.stdout.write(`[${path.basename(dir)}] ${d}`));
  child.stderr.on('data', (d) => process.stderr.write(`[${path.basename(dir)}] ${d}`));
  started.push(child);
  await waitPort(port);
  return child;
}

async function api(base, method, url, { token, body } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15000);
  let res;
  try {
    res = await fetch(`${base}${url}`, {
      method,
      headers: {
        'content-type': 'application/json',
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: ctrl.signal,
    });
  } finally {
    clearTimeout(timer);
  }
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }
  return { status: res.status, body: json };
}

/** 手机号：标准 11 位，随机生成 */
function randomPhone() {
  return `1${String(Math.floor(Math.random() * 1e10)).padStart(10, '0')}`;
}

async function main() {
  console.log('=== B1 saas-service smoke ===');

  // 1. 拉起服务
  await ensureService(3100, PLATFORM_DIR, { PORT: '3100' });
  await ensureService(3200, SAAS_DIR, {
    PORT: '3200',
    PLATFORM_INTERNAL_BASE_URL: PLATFORM_URL,
    PLATFORM_INTERNAL_SECRET: 'dev-internal-secret',
  });

  // 2. 平台端造码
  const platLogin = await api(PLATFORM_URL, 'POST', '/auth/login', {
    body: { username: 'admin', password: 'admin123456' },
  });
  check('平台端登录', platLogin.body?.code === 0, JSON.stringify(platLogin.body));
  const platToken = platLogin.body?.data?.token;

  const batch = await api(PLATFORM_URL, 'POST', '/admin/codes/batch', {
    token: platToken,
    body: { count: 2, batch_no: `B1-${Date.now()}`, prefix: 'B1' },
  });
  const codes = batch.body?.data?.codes || [];
  check('平台端造 2 个码', codes.length === 2, JSON.stringify(batch.body));
  const codeA = codes[0];
  const codeB = codes[1];

  // 3. 注册 A 店
  const phoneA = randomPhone('138');
  const phoneB = randomPhone('137');
  const regA = await api(SAAS_URL, 'POST', '/auth/register', {
    body: {
      code: codeA,
      phone: phoneA,
      password: 'pass123456',
      shop_name: `冒烟A店-${Date.now()}`,
      shop_address: '测试地址A',
    },
  });
  check('注册 A 店成功', regA.body?.code === 0, JSON.stringify(regA.body));

  // 4. 平台端验证：激活码 used + 店铺出现
  const codesAfter = await api(PLATFORM_URL, 'GET', '/admin/codes?status=used&page_size=50', {
    token: platToken,
  });
  const usedCodes = codesAfter.body?.data?.items || [];
  const usedCodeA = usedCodes.find((c) => c.code === codeA);
  check('激活码已置 used 并绑定店铺', usedCodeA?.status === 'used' && usedCodeA?.bound_shop_id > 0, JSON.stringify(usedCodeA));

  const shops = await api(PLATFORM_URL, 'GET', '/admin/shops?page_size=50', {
    token: platToken,
  });
  const shopItems = shops.body?.data?.items || [];
  check('平台端店铺主数据出现', shopItems.some((s) => s.activation_code === codeA), JSON.stringify(shopItems.map((s) => s.name)));

  // 5. 老板登录
  const loginA = await api(SAAS_URL, 'POST', '/auth/login', {
    body: { phone: phoneA, password: 'pass123456' },
  });
  const userA = loginA.body?.data?.user;
  check('老板登录成功且 role=boss', loginA.body?.code === 0 && userA?.role === 'boss', JSON.stringify(loginA.body?.data?.user));
  const tokenA = loginA.body?.data?.token;

  // 6. 老板创建员工（收银员 + 财务）
  const cashierPhone = randomPhone('136');
  const financePhone = randomPhone('135');
  const createCashier = await api(SAAS_URL, 'POST', '/admin/staff', {
    token: tokenA,
    body: { phone: cashierPhone, password: 'pass123456', name: '小王', role: 'cashier' },
  });
  check('创建收银员成功', createCashier.body?.code === 0 && createCashier.body?.data?.role === 'cashier', JSON.stringify(createCashier.body));

  const createFinance = await api(SAAS_URL, 'POST', '/admin/staff', {
    token: tokenA,
    body: { phone: financePhone, password: 'pass123456', name: '老李', role: 'finance' },
  });
  check('创建财务成功', createFinance.body?.code === 0 && createFinance.body?.data?.role === 'finance', JSON.stringify(createFinance.body));

  // 7. 员工登录
  const loginCashier = await api(SAAS_URL, 'POST', '/auth/login', {
    body: { phone: cashierPhone, password: 'pass123456' },
  });
  const tokenCashier = loginCashier.body?.data?.token;
  check('收银员登录成功', loginCashier.body?.code === 0 && loginCashier.body?.data?.user?.role === 'cashier');

  const loginFinance = await api(SAAS_URL, 'POST', '/auth/login', {
    body: { phone: financePhone, password: 'pass123456' },
  });
  const tokenFinance = loginFinance.body?.data?.token;
  check('财务登录成功', loginFinance.body?.code === 0 && loginFinance.body?.data?.user?.role === 'finance');

  // 8. 角色守卫：收银员 / 财务访问后台管理接口 → 403
  const cashierToAdmin = await api(SAAS_URL, 'GET', '/admin/staff', { token: tokenCashier });
  check('收银员访问后台管理被拒 403', cashierToAdmin.status === 403, `status=${cashierToAdmin.status}`);

  const financeToAdmin = await api(SAAS_URL, 'GET', '/admin/staff', { token: tokenFinance });
  check('财务访问后台管理被拒 403', financeToAdmin.status === 403, `status=${financeToAdmin.status}`);

  // 9. 老板查看员工列表（本店）
  const staffListA = await api(SAAS_URL, 'GET', '/admin/staff?page_size=50', { token: tokenA });
  const staffPhonesA = (staffListA.body?.data?.items || []).map((i) => i.phone);
  check(
    '老板查看本店员工（含收银员 / 财务）',
    staffListA.body?.code === 0 && staffPhonesA.includes(cashierPhone) && staffPhonesA.includes(financePhone),
    JSON.stringify(staffListA.body?.data),
  );

  // 10. 注册 B 店并验证多租户隔离
  const regB = await api(SAAS_URL, 'POST', '/auth/register', {
    body: { code: codeB, phone: phoneB, password: 'pass123456', shop_name: `冒烟B店-${Date.now()}` },
  });
  check('注册 B 店成功', regB.body?.code === 0, JSON.stringify(regB.body));

  const loginB = await api(SAAS_URL, 'POST', '/auth/login', {
    body: { phone: phoneB, password: 'pass123456' },
  });
  const tokenB = loginB.body?.data?.token;
  const shopIdA = userA?.shop_id;
  const shopIdB = loginB.body?.data?.user?.shop_id;
  check('A / B 店 shopId 不同', shopIdA !== shopIdB, `A=${shopIdA}, B=${shopIdB}`);

  const staffListB = await api(SAAS_URL, 'GET', '/admin/staff?page_size=50', { token: tokenB });
  const staffPhonesB = (staffListB.body?.data?.items || []).map((i) => i.phone);
  const noLeak = staffPhonesB.every((p) => p !== cashierPhone && p !== financePhone);
  check('B 店看不到 A 店员工（多租户隔离）', noLeak, JSON.stringify(staffListB.body?.data));

  // 11. 异常分支
  const dupReg = await api(SAAS_URL, 'POST', '/auth/register', {
    body: { code: codeB, phone: phoneA, password: 'pass123456', shop_name: '重复店' },
  });
  check('重复手机号注册被拒', dupReg.body?.code !== 0 && /已注册/.test(dupReg.body?.message || ''), JSON.stringify(dupReg.body));

  const badCode = await api(SAAS_URL, 'POST', '/auth/register', {
    body: { code: 'XXXX-NOPE-0000', phone: randomPhone(), password: 'pass123456', shop_name: '无效码店' },
  });
  check('无效激活码注册被拒', badCode.body?.code !== 0, JSON.stringify(badCode.body));

  const wrongPwd = await api(SAAS_URL, 'POST', '/auth/login', {
    body: { phone: phoneA, password: 'wrong-password' },
  });
  check('错误密码登录被拒', wrongPwd.status === 401, `status=${wrongPwd.status}`);

  const noToken = await api(SAAS_URL, 'GET', '/auth/me');
  check('未登录访问 me 被拒 401', noToken.status === 401, `status=${noToken.status}`);

  const me = await api(SAAS_URL, 'GET', '/auth/me', { token: tokenA });
  check('老板 me 返回本人信息', me.body?.code === 0 && me.body?.data?.phone === phoneA, JSON.stringify(me.body?.data));

  // 12. 菜品管理（仅老板；收银员只读菜单）
  const createDish = await api(SAAS_URL, 'POST', '/admin/dishes', {
    token: tokenA,
    body: {
      name: '宫保鸡丁',
      category: '热菜',
      price: 28.5,
      specs: [
        { name: '大份', price_delta: 5 },
        { name: '小份', price_delta: -3 },
      ],
    },
  });
  check(
    '创建菜品成功（元分转换 / 规格）',
    createDish.body?.code === 0 &&
      createDish.body?.data?.price === 28.5 &&
      createDish.body?.data?.specs?.length === 2,
    JSON.stringify(createDish.body?.data),
  );
  const dishId = createDish.body?.data?.id;

  const dishList = await api(SAAS_URL, 'GET', '/admin/dishes?page_size=50', { token: tokenA });
  check('菜品管理列表含新菜', (dishList.body?.data?.items || []).some((d) => d.id === dishId));

  const dishMenu = await api(SAAS_URL, 'GET', '/dishes/menu', { token: tokenCashier });
  check('收银员菜单可见在售菜品', (dishMenu.body?.data || []).some((d) => d.id === dishId), JSON.stringify(dishMenu.body?.data));

  const dishOff = await api(SAAS_URL, 'POST', `/admin/dishes/${dishId}/status`, {
    token: tokenA,
    body: { status: 'off_sale' },
  });
  check('下架菜品', dishOff.body?.code === 0 && dishOff.body?.data?.status === 'off_sale');

  const dishMenu2 = await api(SAAS_URL, 'GET', '/dishes/menu', { token: tokenCashier });
  check('下架后菜单不可见', !(dishMenu2.body?.data || []).some((d) => d.id === dishId));

  const dishSold = await api(SAAS_URL, 'POST', `/admin/dishes/${dishId}/status`, {
    token: tokenA,
    body: { sold_out: true },
  });
  check('沽清设置', dishSold.body?.code === 0 && dishSold.body?.data?.sold_out === true);

  const finCreateDish = await api(SAAS_URL, 'POST', '/admin/dishes', {
    token: tokenFinance,
    body: { name: '越权菜', price: 1 },
  });
  check('财务不可操作菜品管理 403', finCreateDish.status === 403, `status=${finCreateDish.status}`);

  // 13. 桌台管理（仅老板；收银员只读列表）
  const createTable = await api(SAAS_URL, 'POST', '/admin/tables', {
    token: tokenA,
    body: { name: 'VIP1', area: '包间', capacity: 8 },
  });
  check('创建桌台成功', createTable.body?.code === 0 && createTable.body?.data?.status === 'idle', JSON.stringify(createTable.body?.data));
  const vipTableId = createTable.body?.data?.id;

  const tablesAll = await api(SAAS_URL, 'GET', '/tables', { token: tokenCashier });
  check('收银员桌台列表含新桌台', (tablesAll.body?.data || []).some((t) => t.id === vipTableId));

  // 占用桌台不可删（订单模块未上线，直接写库模拟占用状态）
  const saasDb = new Database(path.join(SAAS_DIR, 'data', 'saas.db'));
  saasDb.prepare('UPDATE tables SET status = ? WHERE id = ?').run('occupied', vipTableId);
  saasDb.close();
  const delOccupied = await api(SAAS_URL, 'DELETE', `/admin/tables/${vipTableId}`, { token: tokenA });
  check('占用桌台删除被拒', delOccupied.body?.code !== 0, JSON.stringify(delOccupied.body));
  const saasDb2 = new Database(path.join(SAAS_DIR, 'data', 'saas.db'));
  saasDb2.prepare('UPDATE tables SET status = ? WHERE id = ?').run('idle', vipTableId);
  saasDb2.close();
  const delTable = await api(SAAS_URL, 'DELETE', `/admin/tables/${vipTableId}`, { token: tokenA });
  check('空闲桌台可删除', delTable.body?.code === 0, JSON.stringify(delTable.body));

  // 14. 结账方式管理（仅老板；收银员只读）
  const createPay = await api(SAAS_URL, 'POST', '/admin/payments', {
    token: tokenA,
    body: { name: '赊账', sort: 9 },
  });
  check('创建结账方式成功', createPay.body?.code === 0 && createPay.body?.data?.name === '赊账', JSON.stringify(createPay.body?.data));
  const payId = createPay.body?.data?.id;

  const payList = await api(SAAS_URL, 'GET', '/payments', { token: tokenCashier });
  check('收银员结账方式列表（默认 3 + 新增）', (payList.body?.data || []).length >= 4, JSON.stringify(payList.body?.data?.map((p) => p.name)));

  const payDisable = await api(SAAS_URL, 'PUT', `/admin/payments/${payId}`, {
    token: tokenA,
    body: { enabled: false },
  });
  check('停用结账方式', payDisable.body?.code === 0 && payDisable.body?.data?.enabled === false);

  const payList2 = await api(SAAS_URL, 'GET', '/payments', { token: tokenCashier });
  check('停用后结账列表不可见', !(payList2.body?.data || []).some((p) => p.id === payId));

  // 15. 多租户隔离：B 店看不到 A 店的菜品 / 桌台 / 结账方式
  const dishListB = await api(SAAS_URL, 'GET', '/admin/dishes?page_size=50', { token: tokenB });
  check('B 店看不到 A 店菜品', !(dishListB.body?.data?.items || []).some((d) => d.id === dishId));

  const tablesB = await api(SAAS_URL, 'GET', '/tables', { token: tokenB });
  check('B 店桌台不含 A 店新增桌台', !(tablesB.body?.data || []).some((t) => t.id === vipTableId));

  const paysB = await api(SAAS_URL, 'GET', '/payments', { token: tokenB });
  check('B 店结账方式不含 A 店新增', !(paysB.body?.data || []).some((p) => p.id === payId));

  // 16. 注册链路本地初始配置：默认桌台 × 10 + 默认结账方式（现金 / 微信 / 支付宝）
  const tablesInit = await api(SAAS_URL, 'GET', '/tables', { token: tokenB });
  check('注册默认桌台 10 张', (tablesInit.body?.data || []).length === 10, `count=${(tablesInit.body?.data || []).length}`);

  const paysInit = await api(SAAS_URL, 'GET', '/payments', { token: tokenB });
  const payNamesInit = (paysInit.body?.data || []).map((p) => p.name);
  check(
    '注册默认结账方式（现金 / 微信 / 支付宝）',
    payNamesInit.includes('现金') && payNamesInit.includes('微信') && payNamesInit.includes('支付宝'),
    JSON.stringify(payNamesInit),
  );

  // 17. 订单：开台 + 点餐 + 金额计算
  // 恢复宫保鸡丁上架（第 12 步已下架 + 沽清），再建一个简单菜品
  await api(SAAS_URL, 'POST', `/admin/dishes/${dishId}/status`, { token: tokenA, body: { status: 'on_sale', sold_out: false } });
  const createRice = await api(SAAS_URL, 'POST', '/admin/dishes', { token: tokenA, body: { name: '白米饭', category: '主食', price: 2 } });
  const dish2Id = createRice.body?.data?.id;
  check('创建白米饭', createRice.body?.code === 0 && createRice.body?.data?.price === 2, JSON.stringify(createRice.body?.data));

  const paysA = await api(SAAS_URL, 'GET', '/payments', { token: tokenA });
  const cashPay = (paysA.body?.data || []).find((p) => p.name === '现金');
  const wechatPay = (paysA.body?.data || []).find((p) => p.name === '微信');
  check('A 店默认结账方式可用', cashPay && wechatPay);

  const tablesA = await api(SAAS_URL, 'GET', '/tables', { token: tokenA });
  const table1 = (tablesA.body?.data || []).find((t) => t.status === 'idle');
  check('A 店有空闲桌台', !!table1, JSON.stringify((tablesA.body?.data || []).slice(0, 3)));

  // 订单1：桌台模式，宫保鸡丁大份(33.5) + 白米饭×2(4) = 37.5
  const order1 = await api(SAAS_URL, 'POST', '/orders', {
    token: tokenA,
    body: {
      mode: 'table',
      table_id: table1.id,
      items: [
        { dish_id: dishId, spec_index: 0, qty: 1 },
        { dish_id: dish2Id, qty: 2 },
      ],
    },
  });
  check(
    '下单成功（开台 + 规格计价 + 元分转换）',
    order1.body?.code === 0 &&
      order1.body?.data?.total_amount === 37.5 &&
      order1.body?.data?.items?.[0]?.unit_price === 33.5 &&
      /^\d{8}-\d{4}$/.test(order1.body?.data?.order_no || ''),
    JSON.stringify(order1.body?.data),
  );
  const order1Id = order1.body?.data?.id;

  const tablesA2 = await api(SAAS_URL, 'GET', '/tables', { token: tokenA });
  check('下单后桌台占用', (tablesA2.body?.data || []).find((t) => t.id === table1.id)?.status === 'occupied');

  const orderDup = await api(SAAS_URL, 'POST', '/orders', {
    token: tokenA,
    body: { mode: 'table', table_id: table1.id, items: [{ dish_id: dish2Id, qty: 1 }] },
  });
  check('占用桌台不可重复开台', orderDup.body?.code !== 0, JSON.stringify(orderDup.body));

  const confirm1 = await api(SAAS_URL, 'POST', `/orders/${order1Id}/confirm`, { token: tokenA });
  check('接单成功', confirm1.body?.code === 0 && confirm1.body?.data?.status === 'confirmed');

  const settle1 = await api(SAAS_URL, 'POST', `/orders/${order1Id}/settle`, {
    token: tokenA,
    body: { payment_method_id: cashPay.id, paid_amount: 40 },
  });
  check(
    '结账记账（实收 40 / 找零 2.5 / 记结账方式）',
    settle1.body?.code === 0 &&
      settle1.body?.data?.status === 'completed' &&
      settle1.body?.data?.paid_amount === 40 &&
      settle1.body?.data?.change_amount === 2.5 &&
      settle1.body?.data?.payment_method_name === '现金',
    JSON.stringify(settle1.body?.data),
  );

  const tablesA3 = await api(SAAS_URL, 'GET', '/tables', { token: tokenA });
  check('结账后桌台释放', (tablesA3.body?.data || []).find((t) => t.id === table1.id)?.status === 'idle');

  // 18. 挂账 → 补收；免单；拒单
  const order2 = await api(SAAS_URL, 'POST', '/orders', {
    token: tokenA,
    body: { mode: 'table', table_id: table1.id, items: [{ dish_id: dishId, spec_index: 1, qty: 1 }] },
  });
  check('第二单（小份减价 25.5）', order2.body?.data?.total_amount === 25.5, JSON.stringify(order2.body?.data));
  const order2Id = order2.body?.data?.id;

  const oa = await api(SAAS_URL, 'POST', `/orders/${order2Id}/on-account`, { token: tokenA });
  check('挂账成功', oa.body?.code === 0 && oa.body?.data?.status === 'on_account');

  const tablesA4 = await api(SAAS_URL, 'GET', '/tables', { token: tokenA });
  check('挂账后桌台释放', (tablesA4.body?.data || []).find((t) => t.id === table1.id)?.status === 'idle');

  const settle2 = await api(SAAS_URL, 'POST', `/orders/${order2Id}/settle`, {
    token: tokenA,
    body: { payment_method_id: wechatPay.id },
  });
  check('挂账单补收结清（微信 25.5）', settle2.body?.code === 0 && settle2.body?.data?.status === 'completed' && settle2.body?.data?.paid_amount === 25.5, JSON.stringify(settle2.body?.data));

  const order3 = await api(SAAS_URL, 'POST', '/orders', {
    token: tokenA,
    body: { mode: 'ticket', items: [{ dish_id: dish2Id, qty: 1 }] },
  });
  check('叫号模式取餐号', order3.body?.data?.mode === 'ticket' && order3.body?.data?.ticket_no >= 1, JSON.stringify(order3.body?.data));
  const order3Id = order3.body?.data?.id;

  const free1 = await api(SAAS_URL, 'POST', `/orders/${order3Id}/free`, { token: tokenA });
  check('免单（实收 0 / 记免单）', free1.body?.code === 0 && free1.body?.data?.status === 'completed' && free1.body?.data?.paid_amount === 0 && free1.body?.data?.payment_method_name === '免单', JSON.stringify(free1.body?.data));

  const order4 = await api(SAAS_URL, 'POST', '/orders', {
    token: tokenA,
    body: { mode: 'ticket', items: [{ dish_id: dish2Id, qty: 1 }] },
  });
  const reject1 = await api(SAAS_URL, 'POST', `/orders/${order4.body?.data?.id}/reject`, { token: tokenA });
  check('拒单作废', reject1.body?.code === 0 && reject1.body?.data?.status === 'void');

  // 19. 沽清 / 已结账订单不可再结账
  await api(SAAS_URL, 'POST', `/admin/dishes/${dish2Id}/status`, { token: tokenA, body: { sold_out: true } });
  const orderSoldOut = await api(SAAS_URL, 'POST', '/orders', {
    token: tokenA,
    body: { mode: 'ticket', items: [{ dish_id: dish2Id, qty: 1 }] },
  });
  check('沽清菜品不可下单', orderSoldOut.body?.code !== 0, JSON.stringify(orderSoldOut.body));
  await api(SAAS_URL, 'POST', `/admin/dishes/${dish2Id}/status`, { token: tokenA, body: { sold_out: false } });

  const reSettle = await api(SAAS_URL, 'POST', `/orders/${order1Id}/settle`, {
    token: tokenA,
    body: { payment_method_id: cashPay.id },
  });
  check('已结账订单不可重复结账', reSettle.body?.code !== 0, JSON.stringify(reSettle.body));

  // 20. 多租户隔离：B 店看不到 / 不可操作 A 店订单
  const ordersB = await api(SAAS_URL, 'GET', '/orders?page_size=50', { token: tokenB });
  check('B 店看不到 A 店订单', !(ordersB.body?.data?.items || []).some((o) => o.id === order1Id), `count=${ordersB.body?.data?.total}`);

  const crossSettle = await api(SAAS_URL, 'POST', `/orders/${order1Id}/settle`, {
    token: tokenB,
    body: { payment_method_id: 1 },
  });
  check('B 店不可操作 A 店订单', crossSettle.body?.code !== 0, JSON.stringify(crossSettle.body));

  // 21. 角色守卫 + 看账
  const finCreateOrder = await api(SAAS_URL, 'POST', '/orders', {
    token: tokenFinance,
    body: { mode: 'ticket', items: [{ dish_id: dish2Id, qty: 1 }] },
  });
  check('财务不可下单 403', finCreateOrder.status === 403, `status=${finCreateOrder.status}`);

  const cashierReport = await api(SAAS_URL, 'GET', '/reports/today', { token: tokenCashier });
  check('收银员不可看账 403', cashierReport.status === 403, `status=${cashierReport.status}`);

  const todayR = await api(SAAS_URL, 'GET', '/reports/today', { token: tokenFinance });
  const td = todayR.body?.data;
  check(
    '财务看账：今日概览（3 单 / 营业额=实收 65.5）',
    td?.order_count === 3 && td?.revenue === 65.5 && td?.pending_receivable === 0,
    JSON.stringify(td),
  );
  check(
    '看账：按结账方式汇总（现金 40 / 微信 25.5 / 免单 0）',
    Array.isArray(td?.methods) &&
      td.methods.some((m) => m.name === '现金' && m.amount === 40 && m.order_count === 1) &&
      td.methods.some((m) => m.name === '微信' && m.amount === 25.5) &&
      td.methods.some((m) => m.name === '免单' && m.amount === 0),
    JSON.stringify(td?.methods),
  );

  const summaryR = await api(SAAS_URL, 'GET', '/reports/summary', { token: tokenA });
  check('老板看账：summary 与今日一致', summaryR.body?.data?.order_count === 3 && summaryR.body?.data?.revenue === 65.5, JSON.stringify(summaryR.body?.data));

  const reportOrders = await api(SAAS_URL, 'GET', '/reports/orders?page_size=50', { token: tokenFinance });
  const roItems = reportOrders.body?.data?.items || [];
  check('看账订单明细含已结账订单（含挂账补收单）', roItems.some((o) => o.id === order1Id) && roItems.some((o) => o.id === order2Id) && !roItems.some((o) => o.id === order4.body?.data?.id), `count=${reportOrders.body?.data?.total}`);

  const todayB = await api(SAAS_URL, 'GET', '/reports/today', { token: tokenB });
  check('B 店看账为空（隔离）', todayB.body?.data?.order_count === 0 && todayB.body?.data?.revenue === 0, JSON.stringify(todayB.body?.data));

  // 必须先杀掉拉起服务的子进程，否则 npm run smoke 永不退出（stdio pipe 保持事件循环活跃）
  await stopStartedServices();

  console.log('\n=== 结果 ===');
  console.log(`通过 ${checks.filter((c) => c.ok).length}/${checks.length}`);
  if (failed > 0) {
    checks.filter((c) => !c.ok).forEach((c) => console.log(`FAIL: ${c.name}`));
    process.exitCode = 1;
  }
}

main().catch(async (err) => {
  console.error('[smoke] unexpected error:', err);
  await stopStartedServices();
  process.exitCode = 1;
});

// 兜底：任何意外导致挂死时，120s 强制退出
setTimeout(() => {
  console.error('[smoke] TIMEOUT after 120s, force exit');
  process.exit(2);
}, 120_000).unref();

// 最后兜底：正常退出路径下若仍有残留子进程，同步发送终止信号
process.on('exit', () => {
  for (const child of started) {
    try { child.kill(); } catch { /* ignore */ }
  }
});
