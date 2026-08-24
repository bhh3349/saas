import { useState } from 'react';
import Icon from '../components/Icon';
import { forgotApi, loginApi, registerApi } from '../api/auth';
import { setStoredShop, setStoredUser, setToken } from '../api/http';
import type { MerchantUser } from '../api/types';

export type AuthTab = 'login' | 'register';
export type AuthView = 'form' | 'forgot' | 'blocked';

interface AuthScreenProps {
  /** 登录成功（boss 角色）进入主框架 */
  onLogin: (user: MerchantUser, shopName: string) => void;
}

/**
 * 登录页（设计稿 S1–S5，画布 1440×900），已对接 saas-service :3200 /auth/*
 * - S1 登录 Tab（默认）：POST /auth/login
 * - S2 注册新店铺 Tab：POST /auth/register（激活码 12 位大小写字母数字）
 * - S3 忘记密码：POST /auth/forgot-password（统一提示，不暴露账号）
 * - S4 登录错误：后端返回的 message 横幅
 * - S5 角色拦截：登录成功但 role 非 boss（收银员/财务）
 */
export default function AuthScreen({ onLogin }: AuthScreenProps) {
  const [tab, setTab] = useState<AuthTab>('login');
  const [view, setView] = useState<AuthView>('form');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [phone, setPhone] = useState('');
  const [pwd, setPwd] = useState('');

  const switchTab = (t: AuthTab) => {
    setTab(t);
    setView('form');
    setErrorMsg('');
    setSuccessMsg('');
  };

  /** 登录提交：POST /auth/login → 非 boss 角色走 S5 拦截 */
  const handleLogin = async () => {
    setErrorMsg('');
    setSuccessMsg('');
    if (!/^1\d{10}$/.test(phone)) {
      setErrorMsg('请输入正确的 11 位手机号');
      return;
    }
    if (!pwd) {
      setErrorMsg('请输入密码');
      return;
    }
    try {
      const res = await loginApi({ phone, password: pwd });
      // 持久化 token + 用户信息，供刷新后 /auth/me 恢复会话
      setToken(res.token);
      setStoredUser(res.user);
      setStoredShop(res.user.shopName ?? '');
      if (res.user.role !== 'boss') {
        setView('blocked');
        return;
      }
      onLogin(res.user, res.user.shopName ?? '');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : '登录失败，请重试');
    }
  };

  /** 注册成功：切回登录 Tab，预填手机号 + 提示去登录 */
  const handleRegistered = (phone2: string, shopName: string) => {
    setStoredShop(shopName);
    setTab('login');
    setView('form');
    setPhone(phone2);
    setErrorMsg('');
    setSuccessMsg('注册成功，请登录');
  };

  return (
    <div className="auth-screen">
      <div className="auth-glow" />
      <div className="auth-card">
        <AuthHeader tab={tab} onTab={switchTab} />
        {view === 'blocked' ? (
          <RoleBlocked onBack={() => { setView('form'); setErrorMsg(''); }} />
        ) : tab === 'login' ? (
          <LoginBody
            view={view}
            errorMsg={errorMsg}
            successMsg={successMsg}
            phone={phone}
            pwd={pwd}
            onPhone={setPhone}
            onPwd={setPwd}
            onSubmit={handleLogin}
            onForgot={() => { setErrorMsg(''); setSuccessMsg(''); setView('forgot'); }}
          />
        ) : (
          <RegisterBody onRegistered={handleRegistered} />
        )}
        <div className="auth-footer">© 2026 餐饮收银 SaaS · 仅限已授权商家</div>
      </div>
    </div>
  );
}

/* ---------------- AuthHeader（品牌 + Tab Bar） ---------------- */

function AuthHeader({ tab, onTab }: { tab: AuthTab; onTab: (t: AuthTab) => void }) {
  return (
    <div className="auth-header">
      <div className="auth-logo">
        <Icon name="brand-auth" className="auth-logo-svg" />
      </div>
      <div className="auth-title">餐饮收银 SaaS</div>
      <div className="auth-subtitle">商家管理后台</div>
      <div className="auth-tabs">
        <button
          className={`auth-tab ${tab === 'login' ? 'active' : ''}`}
          onClick={() => onTab('login')}
        >
          登录
        </button>
        <button
          className={`auth-tab ${tab === 'register' ? 'active' : ''}`}
          onClick={() => onTab('register')}
        >
          注册新店铺
        </button>
      </div>
    </div>
  );
}

/* ---------------- 登录表单（S1 / S3 / S4） ---------------- */

function LoginBody({
  view,
  errorMsg,
  successMsg,
  phone,
  pwd,
  onPhone,
  onPwd,
  onSubmit,
  onForgot,
}: {
  view: AuthView;
  errorMsg: string;
  successMsg: string;
  phone: string;
  pwd: string;
  onPhone: (v: string) => void;
  onPwd: (v: string) => void;
  onSubmit: () => void;
  onForgot: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [showPwd, setShowPwd] = useState(false);

  const handleSubmit = async () => {
    if (loading) return;
    setLoading(true);
    try {
      await onSubmit();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-body">
      {errorMsg && <div className="auth-error-banner">{errorMsg}</div>}
      {successMsg && <div className="auth-success-banner">{successMsg}</div>}
      <AuthField label="手机号">
        <div className="auth-input">
          <Icon name="icon-phone" className="auth-input-icon" />
          <input
            className="auth-input-native"
            type="text"
            placeholder="请输入 11 位手机号"
            value={phone}
            maxLength={11}
            onChange={(e) => onPhone(e.target.value.replace(/\D/g, ''))}
          />
        </div>
      </AuthField>
      <AuthField label="密码">
        <div className="auth-input">
          <Icon name="icon-lock" className="auth-input-icon" />
          <input
            className="auth-input-native"
            type={showPwd ? 'text' : 'password'}
            placeholder="请输入密码"
            value={pwd}
            onChange={(e) => onPwd(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') void handleSubmit(); }}
          />
          <button
            className="auth-eye"
            type="button"
            tabIndex={-1}
            onClick={() => setShowPwd((v) => !v)}
            aria-label={showPwd ? '隐藏密码' : '显示密码'}
          >
            <Icon name={showPwd ? 'icon-eye-off' : 'icon-eye'} className="auth-input-icon" />
          </button>
        </div>
      </AuthField>
      {view === 'forgot' ? (
        <ForgotBody />
      ) : (
        <>
          <div className="auth-forgot-row">
            <button className="auth-forgot-link" onClick={onForgot}>
              忘记密码？
            </button>
          </div>
          <button
            className="auth-submit"
            onClick={() => void handleSubmit()}
            disabled={loading}
          >
            {loading ? '登录中…' : '登录'}
          </button>
        </>
      )}
    </div>
  );
}

/* ---------------- 忘记密码（S3，就地展开） ---------------- */

function ForgotBody() {
  const [fphone, setFphone] = useState('');
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSend = async () => {
    if (loading) return;
    setMsg('');
    if (!/^1\d{10}$/.test(fphone)) {
      setMsg('请输入正确的 11 位手机号');
      return;
    }
    setLoading(true);
    try {
      const res = await forgotApi({ phone: fphone });
      setMsg(res.message || '如该手机号已注册，请联系客服重置密码');
    } catch (err) {
      setMsg(err instanceof Error ? err.message : '发送失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-forgot">
      <div className="auth-divider" />
      {msg && <div className="auth-success-banner">{msg}</div>}
      <AuthField label="手机号">
        <div className="auth-input">
          <Icon name="icon-phone" className="auth-input-icon" />
          <input
            className="auth-input-native"
            type="text"
            placeholder="请输入绑定手机号"
            value={fphone}
            maxLength={11}
            onChange={(e) => setFphone(e.target.value.replace(/\D/g, ''))}
          />
        </div>
      </AuthField>
      <button
        className="auth-submit secondary"
        onClick={() => void handleSend()}
        disabled={loading}
      >
        {loading ? '发送中…' : '发送重置指引'}
      </button>
      <div className="auth-forgot-hint">
        如该手机号已注册，请联系客服重置密码
      </div>
    </div>
  );
}

/* ---------------- 注册表单（S2） ---------------- */

function RegisterBody({
  onRegistered,
}: {
  onRegistered: (phone: string, shopName: string) => void;
}) {
  const [form, setForm] = useState({
    code: '',
    shop_name: '',
    shop_address: '',
    phone: '',
    name: '',
    password: '',
    confirm: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [banner, setBanner] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPwd, setShowPwd] = useState(false);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!/^[A-Za-z0-9]{12}$/.test(form.code)) {
      e.code = '激活码格式不正确，请输入 12 位字母或数字';
    }
    if (!form.shop_name.trim()) e.shop_name = '请输入店铺名称';
    if (!/^1\d{10}$/.test(form.phone)) e.phone = '请输入正确的 11 位手机号';
    if (!form.password || form.password.length < 6) e.password = '密码至少 6 位';
    if (form.password !== form.confirm) e.confirm = '两次输入的密码不一致';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleRegister = async () => {
    if (loading) return;
    setBanner('');
    if (!validate()) return;
    setLoading(true);
    try {
      await registerApi({
        code: form.code,
        shop_name: form.shop_name.trim(),
        shop_address: form.shop_address.trim() || undefined,
        phone: form.phone,
        name: form.name.trim() || undefined,
        password: form.password,
      });
      onRegistered(form.phone, form.shop_name.trim());
    } catch (err) {
      setBanner(err instanceof Error ? err.message : '注册失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-body">
      {banner && <div className="auth-error-banner">{banner}</div>}
      <AuthField label="激活码" required error={errors.code}>
        <div className="auth-input">
          <input
            className="auth-input-native mono"
            type="text"
            placeholder="请输入激活码"
            value={form.code}
            maxLength={12}
            onChange={set('code')}
          />
        </div>
      </AuthField>
      <AuthField label="店铺名称" required error={errors.shop_name}>
        <div className="auth-input">
          <input
            className="auth-input-native"
            type="text"
            placeholder="请输入店铺名称"
            value={form.shop_name}
            maxLength={128}
            onChange={set('shop_name')}
          />
        </div>
      </AuthField>
      <AuthField label="店铺地址（选填）">
        <div className="auth-input">
          <input
            className="auth-input-native"
            type="text"
            placeholder="请输入店铺地址"
            value={form.shop_address}
            maxLength={255}
            onChange={set('shop_address')}
          />
        </div>
      </AuthField>
      <AuthField label="手机号" required error={errors.phone}>
        <div className="auth-input">
          <input
            className="auth-input-native"
            type="text"
            placeholder="请输入 11 位手机号"
            value={form.phone}
            maxLength={11}
            onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value.replace(/\D/g, '') }))}
          />
        </div>
      </AuthField>
      <AuthField label="老板姓名（选填）">
        <div className="auth-input">
          <input
            className="auth-input-native"
            type="text"
            placeholder="请输入老板姓名"
            value={form.name}
            maxLength={32}
            onChange={set('name')}
          />
        </div>
      </AuthField>
      <AuthField label="登录密码" required error={errors.password}>
        <div className="auth-input">
          <Icon name="icon-lock" className="auth-input-icon" />
          <input
            className="auth-input-native"
            type={showPwd ? 'text' : 'password'}
            placeholder="请输入至少 6 位密码"
            value={form.password}
            onChange={set('password')}
          />
          <button
            className="auth-eye"
            type="button"
            tabIndex={-1}
            onClick={() => setShowPwd((v) => !v)}
            aria-label={showPwd ? '隐藏密码' : '显示密码'}
          >
            <Icon name={showPwd ? 'icon-eye-off' : 'icon-eye'} className="auth-input-icon" />
          </button>
        </div>
      </AuthField>
      <AuthField label="确认密码" required error={errors.confirm}>
        <div className="auth-input">
          <Icon name="icon-lock" className="auth-input-icon" />
          <input
            className="auth-input-native"
            type="password"
            placeholder="请再次输入密码"
            value={form.confirm}
            onChange={set('confirm')}
            onKeyDown={(e) => { if (e.key === 'Enter') void handleRegister(); }}
          />
        </div>
      </AuthField>
      <button
        className="auth-submit"
        onClick={() => void handleRegister()}
        disabled={loading}
      >
        {loading ? '注册中…' : '注册并创建店铺'}
      </button>
      <div className="auth-terms">
        注册即代表同意《服务协议》与《隐私政策》
      </div>
    </div>
  );
}

/* ---------------- 角色拦截（S5） ---------------- */

function RoleBlocked({ onBack }: { onBack: () => void }) {
  return (
    <div className="auth-body center">
      <div className="auth-warn">
        <Icon name="icon-warn" className="auth-warn-svg" />
      </div>
      <div className="auth-block-title">无后台管理权限</div>
      <div className="auth-block-desc">
        该账号为收银员 / 财务，无后台管理权限，请使用收银 App
      </div>
      <div className="auth-block-hint">
        登录状态已失效，请使用有权限的账号重新登录
      </div>
      <button className="auth-submit secondary" onClick={onBack}>
        返回登录
      </button>
    </div>
  );
}

/* ---------------- 通用字段 ---------------- */

function AuthField({
  label,
  required,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="auth-field">
      <div className="auth-label">
        {required && <span className="auth-required">*</span>}
        {label}
      </div>
      {children}
      {error && <div className="auth-field-error">{error}</div>}
    </div>
  );
}
