import { useEffect, useState } from 'react';
import CommonSelect from './CommonSelect';

/** 桌台表单项（新增/编辑，表单层语义字段） */
export interface TableFormItem {
  name: string;
  /** 所属区域名称 */
  area: string;
  /** 标准用餐人数（1-99） */
  capacity: number;
  /** 用餐人数范围下限（可选） */
  seatsMin?: number;
  /** 用餐人数范围上限（可选） */
  seatsMax?: number;
  /** 数字助记码（可选） */
  mnemonic?: string;
}

interface AddTableModalProps {
  open: boolean;
  /** 可选区域列表（所属区域下拉数据源） */
  areas: { id: number; name: string }[];
  /** 编辑模式：传入已有桌台数据（不含 id），新增模式传 null */
  initial?: Partial<TableFormItem> | null;
  onClose: () => void;
  /** 提交回调：返回 true 表示成功（「保存并继续新增」依赖返回值决定是否重置表单） */
  onSubmit: (item: TableFormItem, mode: 'save' | 'saveAndContinue') => Promise<boolean>;
  submitting?: boolean;
}

interface TableFormState {
  name: string;
  area: string;
  capacity: string;
  seatsMin: string;
  seatsMax: string;
  mnemonic: string;
}

const emptyForm = (): TableFormState => ({
  name: '',
  area: '',
  capacity: '',
  seatsMin: '',
  seatsMax: '',
  mnemonic: '',
});

/** 新增/编辑桌台弹窗（对齐 saas-ui 参考：所属区域下拉、人数范围、助记码、桌台类型、预订渠道） */
export default function AddTableModal({
  open,
  areas,
  initial = null,
  onClose,
  onSubmit,
  submitting = false,
}: AddTableModalProps) {
  const [form, setForm] = useState<TableFormState>(emptyForm());
  const [error, setError] = useState<string>('');

  useEffect(() => {
    if (!open) return;
    setForm(
      initial
        ? {
            name: initial.name ?? '',
            area: initial.area ?? '',
            capacity: initial.capacity != null ? String(initial.capacity) : '',
            seatsMin: initial.seatsMin != null ? String(initial.seatsMin) : '',
            seatsMax: initial.seatsMax != null ? String(initial.seatsMax) : '',
            mnemonic: initial.mnemonic ?? '',
          }
        : emptyForm(),
    );
    setError('');
  }, [open, initial]);

  if (!open) return null;

  const set = (patch: Partial<TableFormState>) => {
    setForm((prev) => ({ ...prev, ...patch }));
    if (patch.name !== undefined) setError('');
  };

  /** 校验并组装提交数据；不通过返回 null */
  const validate = (): TableFormItem | null => {
    const name = form.name.trim();
    if (!name) {
      setError('请输入桌台名称');
      return null;
    }
    const area = form.area.trim();
    if (!area) {
      setError('请选择所属区域');
      return null;
    }
    const capacity = parseInt(form.capacity, 10);
    if (!form.capacity.trim() || Number.isNaN(capacity) || capacity < 1 || capacity > 99) {
      setError('标准用餐人数请输入1-99的整数');
      return null;
    }
    let seatsMin: number | undefined;
    let seatsMax: number | undefined;
    if (form.seatsMin.trim() || form.seatsMax.trim()) {
      const min = parseInt(form.seatsMin, 10);
      const max = parseInt(form.seatsMax, 10);
      if (form.seatsMin.trim() && (Number.isNaN(min) || min < 1 || min > 99)) {
        setError('用餐人数范围请输入1-99的整数');
        return null;
      }
      if (form.seatsMax.trim() && (Number.isNaN(max) || max < 1 || max > 99)) {
        setError('用餐人数范围请输入1-99的整数');
        return null;
      }
      if (form.seatsMin.trim() && form.seatsMax.trim() && min > max) {
        setError('用餐人数范围最小值不能大于最大值');
        return null;
      }
      seatsMin = form.seatsMin.trim() ? min : undefined;
      seatsMax = form.seatsMax.trim() ? max : undefined;
    }
    const mnemonic = form.mnemonic.trim();
    return {
      name,
      area,
      capacity,
      seatsMin,
      seatsMax,
      mnemonic: mnemonic || undefined,
    };
  };

  /** 「保存」：成功即关闭 */
  const handleSave = async () => {
    const item = validate();
    if (!item) return;
    const ok = await onSubmit(item, 'save');
    if (ok) onClose();
  };

  /** 「保存并继续新增」：成功后重置表单（保留区域/类型/渠道，便于连续录入） */
  const handleSaveAndContinue = async () => {
    const item = validate();
    if (!item) return;
    const ok = await onSubmit(item, 'saveAndContinue');
    if (ok) {
      setForm((prev) => ({
        ...prev,
        name: '',
        capacity: '',
        seatsMin: '',
        seatsMax: '',
        mnemonic: '',
      }));
      setError('');
    }
  };

  const areaOptions = areas.map((a) => ({ value: a.name, label: a.name }));

  return (
    <div className="modal-mask" onClick={onClose}>
      <div className="modal-card area-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div className="modal-title">{initial ? '编辑桌台' : '新增桌台'}</div>
          <button className="modal-close" aria-label="关闭" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="modal-body">
          {/* 桌台名称 */}
          <div className="area-form-row">
            <label>
              <span className="required-mark">*</span>桌台名称
            </label>
            <input
              type="text"
              placeholder="请输入桌台名称，例如：小桌01"
              maxLength={20}
              value={form.name}
              onChange={(e) => set({ name: e.target.value })}
            />
          </div>

          {/* 所属区域 */}
          <div className="area-form-row">
            <label>
              <span className="required-mark">*</span>所属区域
            </label>
            <CommonSelect
              width="100%"
              containerStyle={{ flex: 1 }}
              value={form.area}
              placeholder="请选择"
              options={areaOptions}
              ariaLabel="所属区域"
              onChange={(v) => set({ area: v })}
            />
          </div>

          {/* 标准用餐人数 */}
          <div className="area-form-row">
            <label>
              <span className="required-mark">*</span>标准用餐人数
            </label>
            <input
              type="text"
              inputMode="numeric"
              placeholder="请输入1-99的整数"
              maxLength={2}
              value={form.capacity}
              onChange={(e) => set({ capacity: e.target.value.replace(/\D/g, '') })}
            />
          </div>

          {/* 用餐人数范围 */}
          <div className="area-form-row">
            <label>用餐人数范围</label>
            <div className="seats-range-input">
              <input
                type="text"
                inputMode="numeric"
                placeholder="请输入1-99的整数"
                maxLength={2}
                value={form.seatsMin}
                onChange={(e) => set({ seatsMin: e.target.value.replace(/\D/g, '') })}
              />
              <span>至</span>
              <input
                type="text"
                inputMode="numeric"
                placeholder="请输入1-99的整数"
                maxLength={2}
                value={form.seatsMax}
                onChange={(e) => set({ seatsMax: e.target.value.replace(/\D/g, '') })}
              />
            </div>
          </div>

          {/* 数字助记码 */}
          <div className="area-form-row">
            <label>数字助记码</label>
            <input
              type="text"
              inputMode="numeric"
              placeholder="请输入数字"
              maxLength={10}
              value={form.mnemonic}
              onChange={(e) => set({ mnemonic: e.target.value.replace(/\D/g, '') })}
            />
          </div>

          {error && <div className="area-form-error">{error}</div>}
        </div>

        <div className="modal-foot">
          <button className="tm-btn tm-btn-default" type="button" onClick={onClose}>
            取消
          </button>
          {!initial && (
            <button
              className="tm-btn tm-btn-default"
              type="button"
              onClick={handleSaveAndContinue}
              disabled={submitting}
            >
              保存并继续新增
            </button>
          )}
          <button
            className="tm-btn tm-btn-primary"
            type="button"
            onClick={handleSave}
            disabled={submitting}
          >
            {submitting ? '保存中…' : '保存'}
          </button>
        </div>
      </div>
    </div>
  );
}
