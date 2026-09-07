import { useEffect, useState, type ReactNode } from 'react';
import ConfirmModal from '../components/ConfirmModal';
import Toast, { type ToastData } from '../components/Toast';
import { getBucket, putBucket } from '../api/buckets';
import { getMeApi } from '../api/auth';

/** 门店档案配置桶 key（可编辑字段持久化） */
const BUCKET_KEY = 'store_profile';

/** 可编辑档案（存储于配置桶，随店铺多租户隔离） */
interface EditableProfile {
  shortName: string;
  category: string;
  brand: string;
  bizStart: string;
  bizEnd: string;
  area: number;
  staffCount: number;
  avgConsume: number;
  intro: string;
  paused: boolean;
}

/** 只读门店主数据（来自数据库 shop 表，登录 / me 下发） */
interface ShopBase {
  name: string;
  phone: string;
  shopId: number;
  address: string;
  openDate: string;
}

const DEFAULT_PROFILE: EditableProfile = {
  shortName: '',
  category: '',
  brand: '',
  bizStart: '10:00',
  bizEnd: '22:00',
  area: 0,
  staffCount: 0,
  avgConsume: 0,
  intro: '',
  paused: false,
};

/** 档案信息项 */
function InfoItem({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
      <span style={{ fontSize: 12, color: 'var(--color-ink-tertiary)' }}>{label}</span>
      <span style={{ fontSize: 13, color: 'var(--color-ink)', wordBreak: 'break-all' }}>{value || '-'}</span>
    </div>
  );
}

export default function StoreProfile() {
  const [profile, setProfile] = useState<EditableProfile>(DEFAULT_PROFILE);
  /** 真实店铺主数据（数据库） */
  const [shopBase, setShopBase] = useState<ShopBase>({
    name: '',
    phone: '',
    shopId: 0,
    address: '',
    openDate: '',
  });
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<EditableProfile>(DEFAULT_PROFILE);
  const [pauseConfirm, setPauseConfirm] = useState<'pause' | 'resume' | null>(null);
  const [toast, setToast] = useState<ToastData | null>(null);

  /** 从数据库加载：真实店铺主数据（me）+ 可编辑档案（配置桶） */
  useEffect(() => {
    let active = true;
    Promise.all([getMeApi(), getBucket<EditableProfile>(BUCKET_KEY)])
      .then(([me, data]) => {
        if (!active) return;
        setShopBase({
          name: me.shopName ?? '',
          phone: me.phone ?? '',
          shopId: me.shop_id ?? 0,
          address: me.shopAddress ?? '',
          openDate: me.shopCreatedAt ?? '',
        });
        if (data && typeof data === 'object') {
          setProfile({ ...DEFAULT_PROFILE, ...data });
        }
      })
      .catch(() => {
        /* 忽略加载失败 */
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const openEdit = () => {
    setForm(profile);
    setModalOpen(true);
  };

  const updateForm = <K extends keyof EditableProfile>(key: K, value: EditableProfile[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  /** 保存到云端（配置桶） */
  const persist = async (next: EditableProfile) => {
    setProfile(next);
    try {
      await putBucket(BUCKET_KEY, next);
    } catch (e) {
      setToast({ type: 'error', text: (e as Error).message || '保存失败' });
    }
  };

  const submitForm = async () => {
    await persist(form);
    setToast({ type: 'success', text: '保存成功' });
    setModalOpen(false);
  };

  const confirmPause = async () => {
    const paused = pauseConfirm === 'pause';
    await persist({ ...profile, paused });
    setToast({ type: 'success', text: paused ? '已暂停营业' : '已恢复营业' });
    setPauseConfirm(null);
  };

  return (
    <div className="page">
      <div className="page-head">
        <h1 className="page-title">门店档案</h1>
        <div className="page-actions" style={{ display: 'flex', gap: 8 }}>
          {!profile.paused && (
            <button className="saas-btn saas-btn-default" onClick={() => setPauseConfirm('pause')}>
              暂停营业
            </button>
          )}
          <button className="saas-btn saas-btn-primary" onClick={openEdit}>
            编辑
          </button>
        </div>
      </div>

      {loading ? (
        <div className="page-loading">加载中…</div>
      ) : (
        <div className="checkout-panel" style={{ overflowY: 'auto', gap: 16 }}>
          {/* 头部信息 */}
          <div className="panel">
            <div className="panel-body" style={{ padding: '20px 24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                <span style={{ fontFamily: 'var(--font-heading)', fontSize: 20, fontWeight: 700, color: 'var(--color-ink)' }}>
                  {shopBase.name || '-'}
                </span>
                <span className={`status-tag ${profile.paused ? 'status-off' : 'status-on'}`}>
                  {profile.paused ? '暂停营业' : '营业中'}
                </span>
              </div>
              <div className="checkout-form-desc" style={{ marginBottom: 4 }}>
                报表中心会按营业结算时间（00:00）统计每个营业日的营业数据
              </div>
            </div>
          </div>

          {/* 基础信息 */}
          <div className="panel">
            <div className="panel-head">
              <div className="panel-title">基础信息</div>
            </div>
            <div className="panel-body">
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: '14px 24px',
                  alignContent: 'start',
                }}
              >
                <InfoItem label="商户号" value={shopBase.shopId || '-'} />
                <InfoItem label="门店名称" value={shopBase.name} />
                <InfoItem label="门店简称" value={profile.shortName} />
                <InfoItem label="品类" value={profile.category} />
                <InfoItem label="所属品牌" value={profile.brand} />
                <InfoItem label="门店电话" value={shopBase.phone} />
                <InfoItem label="门店地址" value={shopBase.address} />
              </div>
            </div>
          </div>

          {/* 营业信息 */}
          <div className="panel">
            <div className="panel-head">
              <div className="panel-title">营业信息</div>
            </div>
            <div className="panel-body">
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: '14px 24px',
                  alignContent: 'start',
                }}
              >
                <InfoItem label="营业时间" value={`${profile.bizStart} - ${profile.bizEnd}`} />
                <InfoItem label="营业面积" value={profile.area > 0 ? `${profile.area} ㎡` : ''} />
                <InfoItem label="开业日期" value={shopBase.openDate} />
                <InfoItem label="员工数" value={profile.staffCount > 0 ? `${profile.staffCount} 人` : ''} />
                <InfoItem label="人均消费" value={profile.avgConsume > 0 ? `¥${profile.avgConsume}` : ''} />
              </div>
              {profile.intro && (
                <div style={{ marginTop: 14 }}>
                  <InfoItem label="餐厅介绍" value={profile.intro} />
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 编辑弹窗（仅可编辑字段，门店主数据只读） */}
      {modalOpen && (
        <div className="modal-overlay" onClick={() => setModalOpen(false)}>
          <div className="modal-content checkout-modal-lg" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>编辑门店档案</h3>
              <button className="modal-close" onClick={() => setModalOpen(false)}>&times;</button>
            </div>
            <div className="modal-body checkout-form-lg">
              <div className="checkout-form-row">
                <label>门店简称：</label>
                <input
                  className="ant-input"
                  value={form.shortName}
                  onChange={(e) => updateForm('shortName', e.target.value)}
                  placeholder="请输入门店简称"
                />
              </div>
              <div className="checkout-form-row">
                <label>品类：</label>
                <input
                  className="ant-input"
                  value={form.category}
                  onChange={(e) => updateForm('category', e.target.value)}
                  placeholder="如：重庆火锅"
                />
              </div>
              <div className="checkout-form-row">
                <label>所属品牌：</label>
                <input
                  className="ant-input"
                  value={form.brand}
                  onChange={(e) => updateForm('brand', e.target.value)}
                  placeholder="请输入所属品牌"
                />
              </div>
              <div className="checkout-form-row">
                <label>营业时间：</label>
                <div className="checkout-form-control">
                  <input
                    className="ant-input"
                    style={{ width: 120 }}
                    type="time"
                    value={form.bizStart}
                    onChange={(e) => updateForm('bizStart', e.target.value)}
                  />
                  <span style={{ margin: '0 8px', color: 'var(--color-ink-muted)' }}>-</span>
                  <input
                    className="ant-input"
                    style={{ width: 120 }}
                    type="time"
                    value={form.bizEnd}
                    onChange={(e) => updateForm('bizEnd', e.target.value)}
                  />
                </div>
              </div>
              <div className="checkout-form-row">
                <label>营业面积：</label>
                <div className="checkout-form-control">
                  <input
                    className="ant-input"
                    style={{ width: 140 }}
                    type="number"
                    min={0}
                    value={form.area}
                    onChange={(e) => updateForm('area', Number(e.target.value))}
                  />
                  <span style={{ marginLeft: 6, fontSize: 13, color: 'var(--color-ink-muted)' }}>㎡</span>
                </div>
              </div>
              <div className="checkout-form-row">
                <label>员工数：</label>
                <div className="checkout-form-control">
                  <input
                    className="ant-input"
                    style={{ width: 140 }}
                    type="number"
                    min={0}
                    value={form.staffCount}
                    onChange={(e) => updateForm('staffCount', Number(e.target.value))}
                  />
                  <span style={{ marginLeft: 6, fontSize: 13, color: 'var(--color-ink-muted)' }}>人</span>
                </div>
              </div>
              <div className="checkout-form-row">
                <label>人均消费：</label>
                <div className="checkout-form-control">
                  <input
                    className="ant-input"
                    style={{ width: 140 }}
                    type="number"
                    min={0}
                    value={form.avgConsume}
                    onChange={(e) => updateForm('avgConsume', Number(e.target.value))}
                  />
                  <span style={{ marginLeft: 6, fontSize: 13, color: 'var(--color-ink-muted)' }}>元</span>
                </div>
              </div>
              <div className="checkout-form-row">
                <label>餐厅介绍：</label>
                <textarea
                  className="ant-input"
                  rows={3}
                  value={form.intro}
                  onChange={(e) => updateForm('intro', e.target.value)}
                  placeholder="请输入餐厅介绍"
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="saas-btn saas-btn-default" onClick={() => setModalOpen(false)}>取消</button>
              <button className="saas-btn saas-btn-primary" onClick={submitForm}>保存</button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        open={pauseConfirm !== null}
        title={pauseConfirm === 'pause' ? '确认暂停营业' : '确认恢复营业'}
        message={
          pauseConfirm === 'pause'
            ? '暂停营业后，收银台将无法继续接待客人。确定暂停吗？'
            : '恢复营业后，收银台可正常接待客人。确定恢复吗？'
        }
        confirmText={pauseConfirm === 'pause' ? '暂停' : '恢复'}
        onConfirm={confirmPause}
        onCancel={() => setPauseConfirm(null)}
      />
      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}
