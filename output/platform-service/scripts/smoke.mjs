/**
 * A1 冒烟测试：登录 → 批量生成码 → 列表 → 作废 → claim 建店绑定 → 店铺列表
 * 前提：platform-service 已启动（默认 http://localhost:3100）
 */
import { createHmac } from 'node:crypto';

const BASE = process.env.BASE_URL || 'http://localhost:3100';
const SECRET = process.env.INTERNAL_SHARED_SECRET || 'dev-internal-secret';

let passCount = 0;
let failCount = 0;

function check(name, cond, extra = '') {
  if (cond) {
    passCount++;
    console.log(`  PASS  ${name}`);
  } else {
    failCount++;
    console.log(`  FAIL  ${name} ${extra}`);
  }
}

async function api(method, path, { token, body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => null);
  return { status: res.status, body: json };
}

/** 内网签名 */
function sign(method, path, body) {
  const ts = Date.now().toString();
  const canonical = body ? JSON.stringify(Object.fromEntries(Object.entries(body).sort())) : '{}';
  const text = `${ts}.${method.toUpperCase()}.${path}.${canonical}`;
  const sig = createHmac('sha256', SECRET).update(text).digest('hex');
  return {
    'X-Internal-Key': 'internal',
    'X-Internal-Timestamp': ts,
    'X-Internal-Signature': sig,
  };
}

async function main() {
  console.log(`[smoke] BASE=${BASE}`);

  // 1. 登录
  const login = await api('POST', '/auth/login', {
    body: { username: 'admin', password: process.env.SEED_OPERATOR_PASSWORD || 'admin123456' },
  });
  check('运营登录成功', login.status === 200 && login.body?.code === 0, JSON.stringify(login.body));
  if (login.status !== 200) {
    console.log('登录失败，请检查种子账号配置（SEED_OPERATOR_USERNAME/PASSWORD）');
    process.exit(1);
  }
  const token = login.body.data.token;
  check('登录返回 token', !!token);

  // 2. 批量生成（POST 默认返回 201）
  const batch = await api('POST', '/admin/codes/batch', {
    token,
    body: { count: 5, batch_no: 'SMOKE-001' },
  });
  check('批量生成 5 个码', batch.body?.code === 0 && batch.body?.data?.codes?.length === 5, JSON.stringify(batch.body));
  const codes = batch.body?.data?.codes || [];
  const firstCode = codes[0];
  check('码格式 12 位字母数字', /^[A-Za-z0-9]{12}$/.test(firstCode || ''), firstCode);

  // 3. 列表查询
  const list = await api('GET', '/admin/codes?batch_no=SMOKE-001&status=unused', { token });
  check('按批次+状态筛选', list.body?.data?.total === 5, JSON.stringify(list.body));

  // 4. 作废
  const voidRes = await api('POST', `/admin/codes/${firstCode}/void`, { token });
  check('作废未使用码', voidRes.body?.data?.status === 'void', JSON.stringify(voidRes.body));
  const voidAgain = await api('POST', `/admin/codes/${firstCode}/void`, { token });
  check('已作废码不可再作废', voidAgain.status === 400, JSON.stringify(voidAgain.body));

  // 5. claim（内网签名）
  const claimBody = { code: codes[1], shop_name: '冒烟测试餐厅', shop_address: '测试地址 1 号', phone: '13800000000' };
  const claim = await fetch(`${BASE}/internal/activation/claim`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...sign('POST', '/internal/activation/claim', claimBody) },
    body: JSON.stringify(claimBody),
  });
  const claimJson = await claim.json();
  check('claim 建店绑定成功', claimJson?.code === 0 && claimJson?.data?.success === true, JSON.stringify(claimJson));
  const shopId = claimJson?.data?.shopId;
  check('claim 返回 shopId', typeof shopId === 'number' && shopId > 0, `shopId=${shopId}`);

  // 6. 重复 claim 拒绝
  const claimAgain = await fetch(`${BASE}/internal/activation/claim`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...sign('POST', '/internal/activation/claim', claimBody) },
    body: JSON.stringify(claimBody),
  });
  const claimAgainJson = await claimAgain.json();
  check('重复 claim 被拒（已使用）', claimAgainJson?.code === 400, JSON.stringify(claimAgainJson));

  // 7. 伪造签名拒绝
  const forged = await fetch(`${BASE}/internal/activation/claim`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...sign('POST', '/internal/activation/claim', claimBody), 'X-Internal-Signature': 'deadbeef' },
    body: JSON.stringify(claimBody),
  });
  check('伪造签名被拒', forged.status === 403, `status=${forged.status}`);

  // 8. 绑定后激活码变 used
  const usedList = await api('GET', `/admin/codes?batch_no=SMOKE-001&status=used`, { token });
  check('绑定后状态=used', usedList.body?.data?.total === 1, JSON.stringify(usedList.body));

  // 9. 店铺列表
  const shops = await api('GET', '/admin/shops', { token });
  check('店铺列表含新店', shops.body?.data?.items?.some((s) => s.id === shopId), JSON.stringify(shops.body));
  const target = shops.body?.data?.items?.find((s) => s.id === shopId);
  check('店铺信息完整', !!target && target.name === '冒烟测试餐厅' && target.activation_code === codes[1], JSON.stringify(target));

  // 10. 无 token 拒绝
  const noAuth = await api('GET', '/admin/codes', {});
  check('无 token 访问管理接口被拒', noAuth.status === 401, `status=${noAuth.status}`);

  console.log(`\n[smoke] 结果: ${passCount} 通过, ${failCount} 失败`);
  process.exit(failCount === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('[smoke] 异常:', err);
  process.exit(1);
});
