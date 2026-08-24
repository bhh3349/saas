import { useEffect, useState, type ReactNode } from 'react';
import ConfirmModal from '../components/ConfirmModal';
import Toast, { type ToastData } from '../components/Toast';
import { getBucket, putBucket } from '../api/buckets';

/** 门店档案配置桶 key */
const BUCKET_KEY = 'store_profile';

/** 门店档案（可编辑字段） */
interface StoreProfile {
  name: string;
  shortName: string;
  category: string;
  brand: string;
  phone: string;
  bizStart: string;
  bizEnd: string;
  area: number;
  openDate: string;
  staffCount: number;
  avgConsume: number;
  intro: string;
  paused: boolean;
}

/** 商户主数据（平台下发，只读） */
const MERCHANT_NO = '52105165';
const ORG_CODE = 'MD00002';
const CITY_REGION = '重庆市 / 重庆市 / 沙坪坝区';

/** 营业结算时间（报表营业日划分依据，只读） */
const SETTLE_TIME = '00:00:00';

/** 营业餐段（只读） */
const MEAL_PERIOD = '全天 10:00 - 23:30';

/** 班次设置（只读，交接班用） */
const SHIFTS = [
  { name: '午班', time: '09:00 - 16:00' },
  { name: '晚班', time: '16:00 - 22:00' },
];

const DEFAULT_PROFILE: StoreProfile = {
  name: '一棵树土火锅',
  shortName: '',
  category: '重庆火锅',
  brand: 'S BLACK',
  phone: '183****0911',
  bizStart: '10:00',
  bizEnd: '22:00',
  area: 0,
  openDate: '',
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
  const [profile, setProfile] = useState<StoreProfile>(DEFAULT_PROFILE);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<StoreProfile>(DEFAULT_PROFILE);
  const [pauseConfirm, setPauseConfirm] = useState<'pause' | 'resume' | null>(null);
  const [toast, setToast] = useState<ToastData | null>(null);

  /** 从云端加载门店档案 */
  useEffect(() => {
    let active = true;
    getBucket<StoreProfile>(BUCKET_KEY)
      .then((data) => {
        if (active && data && typeof data === 'object') {
          setProfile({ ...DEFAULT_PROFILE, ...data });
        }
      })
      .catch(() => {
        /* 忽略加载失败 */
      });
    return () => {
      active = false;
    };
  }, []);

  const openEdit = () => {
    setForm(profile);
    setModalOpen(true);
  };

  const updateForm = <K extends keyof StoreProfile>(key: K, value: StoreProfile[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  /** 保存到云端 */
  const persist = async (next: StoreProfile) => {
    setProfile(next);
    try {
      await putBucket(BUCKET_KEY, next);
    } catch (e) {
      setToast({ type: 'error', text: (e as Error).message || '保存失败' });
    }
  };

  const submitForm = async () => {
    if (!form.name.trim()) {
      setToast({ type: 'warning', text: '请输入门店名称' });
      return;
    }
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

      <div className="checkout-panel" style={{ overflowY: 'auto', gap: 16 }}>
        {/* 头部信息 */}
        <div className="panel">
          <div className="panel-body" style={{ padding: '20px 24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
              <span style={{ fontFamily: 'var(--font-heading)', fontSize: 20, fontWeight: 700, color: 'var(--color-ink)' }}>
                {profile.name}
              </span>
              <span className={`status-tag ${profile.paused ? 'status-off' : 'status-on'}`}>
                {profile.paused ? '暂停营业' : '营业中'}
              </span>
            </div>
            <div className="checkout-form-desc" style={{ marginBottom: 4 }}>
              报表中心会按营业结算时间（{SETTLE_TIME}）统计每个营业日的营业数据
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
              <InfoItem label="商户号" value={MERCHANT_NO} />
              <InfoItem label="机构编码" value={ORG_CODE} />
              <InfoItem label="门店名称" value={profile.name} />
              <InfoItem label="门店简称" value={profile.shortName} />
              <InfoItem label="品类" value={profile.category} />
              <InfoItem label="所属品牌" value={profile.brand} />
              <InfoItem label="门店电话" value={profile.phone} />
              <InfoItem label="城市区域" value={CITY_REGION} />
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
              <InfoItem label="开业日期" value={profile.openDate} />
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

        {/* 营业餐段 */}
        <div className="panel">
          <div className="panel-head">
            <div className="panel-title">营业餐段</div>
            <span className="checkout-form-desc">用于餐段营业统计</span>
          </div>
          <div className="panel-body">
            <div className="checkout-view">
              <div className="checkout-view-row">
                <span className="checkout-view-label">餐段：</span>
                <span className="checkout-view-value">{MEAL_PERIOD}</span>
              </div>
            </div>
          </div>
        </div>

        {/* 班次设置 */}
        <div className="panel">
          <div className="panel-head">
            <div className="panel-title">班次设置</div>
            <span className="checkout-form-desc">收银员可按对应班次在收银机上完成交接班</span>
          </div>
          <div className="panel-body">
            <div className="checkout-view">
              {SHIFTS.map((s) => (
                <div className="checkout-view-row" key={s.name}>
                  <span className="checkout-view-label">{s.name}：</span>
                  <span className="checkout-view-value">{s.time}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 编辑弹窗 */}
      {modalOpen && (
        <div className="modal-overlay" onClick={() => setModalOpen(false)}>
          <div className="modal-content checkout-modal-lg" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>编辑门店档案</h3>
              <button className="modal-close" onClick={() => setModalOpen(false)}>&times;</button>
            </div>
            <div className="modal-body checkout-form-lg">
              <div className="checkout-form-row">
                <label><span className="required-mark">*</span>门店名称：</label>
                <input
                  className="ant-input"
                  value={form.name}
                  onChange={(e) => updateForm('name', e.target.value)}
                  placeholder="请输入门店名称"
                />
              </div>
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
                <label>门店电话：</label>
                <input
                  className="ant-input"
                  value={form.phone}
                  onChange={(e) => updateForm('phone', e.target.value)}
                  placeholder="请输入门店电话"
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
                <label>开业日期：</label>
                <input
                  className="ant-input"
                  style={{ width: 200 }}
                  type="date"
                  value={form.openDate}
                  onChange={(e) => updateForm('openDate', e.target.value)}
                />
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
