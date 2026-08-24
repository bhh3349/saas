import { useEffect, useMemo, useState } from 'react';
import CommonSelect from './CommonSelect';
import type { TableFormItem } from './AddTableModal';

/** 不包含数字选项：跳过序号中包含这些数字的桌台 */
const SKIP_OPTIONS = [4, 7, 13];

interface BatchAddTableModalProps {
  open: boolean;
  /** 可选区域列表（所属区域下拉数据源） */
  areas: { id: number; name: string }[];
  onClose: () => void;
  /** 提交回调：返回 true 表示成功，成功后父组件关闭弹窗 */
  onSubmit: (items: TableFormItem[]) => Promise<boolean>;
  submitting?: boolean;
}

interface BatchFormState {
  namePrefix: string;
  indexStart: string;
  indexEnd: string;
  skipNumbers: number[];
  area: string;
  capacity: string;
  seatsMin: string;
  seatsMax: string;
  startTableNo: string;
}

const emptyForm = (): BatchFormState => ({
  namePrefix: '',
  indexStart: '',
  indexEnd: '',
  skipNumbers: [],
  area: '',
  capacity: '',
  seatsMin: '',
  seatsMax: '',
  startTableNo: '',
});

/** 批量新增桌台弹窗（对齐参考 UI：前缀 + 序号范围 + 跳过数字 + 区域/人数/助记码，固定堂食，无预订渠道） */
export default function BatchAddTableModal({
  open,
  areas,
  onClose,
  onSubmit,
  submitting = false,
}: BatchAddTableModalProps) {
  const [form, setForm] = useState<BatchFormState>(emptyForm());
  const [error, setError] = useState<string>('');

  useEffect(() => {
    if (open) {
      setForm(emptyForm());
      setError('');
    }
  }, [open]);

  const set = (patch: Partial<BatchFormState>) => {
    setForm((prev) => ({ ...prev, ...patch }));
  };

  const toggleSkip = (num: number) => {
    setForm((prev) => ({
      ...prev,
      skipNumbers: prev.skipNumbers.includes(num)
        ? prev.skipNumbers.filter((n) => n !== num)
        : [...prev.skipNumbers, num],
    }));
  };

  /** 按当前表单生成的桌台名称列表（仅用于预览） */
  const previewNames = useMemo(() => {
    const start = parseInt(form.indexStart, 10);
    const end = parseInt(form.indexEnd, 10);
    if (form.indexStart.trim() && form.indexEnd.trim() && !Number.isNaN(start) && !Number.isNaN(end)) {
      const names: string[] = [];
      for (let i = start; i <= end; i++) {
        if (form.skipNumbers.some((s) => String(i).includes(String(s)))) continue;
        names.push(form.namePrefix.trim() ? `${form.namePrefix.trim()}${i}` : `${i}`);
        if (names.length >= 8) break;
      }
      return names;
    }
    return [];
  }, [form.indexStart, form.indexEnd, form.namePrefix, form.skipNumbers]);

  /** 校验并组装批量桌台；不通过返回 null */
  const buildItems = (): TableFormItem[] | null => {
    const start = parseInt(form.indexStart, 10);
    const end = parseInt(form.indexEnd, 10);
    if (!form.indexStart.trim() || Number.isNaN(start) || start < 1) {
      setError('请输入开始序号');
      return null;
    }
    if (!form.indexEnd.trim() || Number.isNaN(end) || end < 1) {
      setError('请输入结束序号');
      return null;
    }
    if (start > end) {
      setError('开始序号不能大于结束序号');
      return null;
    }
    if (end - start + 1 > 500) {
      setError('一次最多批量新增500个桌台');
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

    let mnemonicBase: number | undefined;
    if (form.startTableNo.trim()) {
      const v = parseInt(form.startTableNo, 10);
      if (Number.isNaN(v) || v < 1 || v > 9799) {
        setError('助记码开始序号请输入1-9799的整数');
        return null;
      }
      mnemonicBase = v;
    }

    const prefix = form.namePrefix.trim();
    const items: TableFormItem[] = [];
    let mnemonicCursor = 0;
    for (let i = start; i <= end; i++) {
      if (form.skipNumbers.some((s) => String(i).includes(String(s)))) continue;
      items.push({
        name: prefix ? `${prefix}${i}` : `${i}`,
        area,
        capacity,
        seatsMin,
        seatsMax,
        mnemonic: mnemonicBase != null ? String(mnemonicBase + mnemonicCursor) : undefined,
      });
      mnemonicCursor++;
    }

    if (items.length === 0) {
      setError('序号范围内没有符合条件的桌台，请调整序号或跳过数字');
      return null;
    }
    return items;
  };

  const handleConfirm = async () => {
    const items = buildItems();
    if (!items) return;
    const ok = await onSubmit(items);
    if (ok) onClose();
  };

  if (!open) return null;

  const areaOptions = areas.map((a) => ({ value: a.name, label: a.name }));

  return (
    <div className="modal-mask" onClick={onClose}>
      <div className="modal-card batch-table-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div className="modal-title">批量新增桌台</div>
          <button className="modal-close" aria-label="关闭" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="modal-body">
          <div className="batch-table-tip">
            <span className="batch-table-tip-icon" aria-hidden>
              i
            </span>
            <span>
              例：桌台名称前缀为小桌，序号为1-4，标准用餐人数为4，将批量添加4个4人桌，
              桌台名称分别为：小桌1、小桌2、小桌3、小桌4
            </span>
          </div>

          {/* 桌台名称前缀 */}
          <div className="area-form-row">
            <label>桌台名称前缀</label>
            <input
              type="text"
              placeholder="例如：小桌、中桌、大桌"
              maxLength={10}
              value={form.namePrefix}
              onChange={(e) => set({ namePrefix: e.target.value })}
            />
          </div>

          {/* 桌台名称序号 */}
          <div className="area-form-row">
            <label>
              <span className="required-mark">*</span>桌台名称序号
            </label>
            <div className="seats-range-input">
              <input
                type="text"
                inputMode="numeric"
                placeholder="开始序号"
                maxLength={4}
                value={form.indexStart}
                onChange={(e) => set({ indexStart: e.target.value.replace(/\D/g, '') })}
              />
              <span>至</span>
              <input
                type="text"
                inputMode="numeric"
                placeholder="结束序号"
                maxLength={4}
                value={form.indexEnd}
                onChange={(e) => set({ indexEnd: e.target.value.replace(/\D/g, '') })}
              />
            </div>
          </div>

          {/* 不包含数字 */}
          <div className="area-form-row">
            <label />
            <div className="form-check-group">
              {SKIP_OPTIONS.map((num) => (
                <label key={num} className="form-check-item">
                  <input
                    type="checkbox"
                    checked={form.skipNumbers.includes(num)}
                    onChange={() => toggleSkip(num)}
                  />
                  <span className="form-check-box" aria-hidden />
                  <span className="form-check-label">不包含数字{num}</span>
                </label>
              ))}
            </div>
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

          {/* 助记码开始序号 */}
          <div className="area-form-row">
            <label>助记码开始序号</label>
            <input
              type="text"
              inputMode="numeric"
              placeholder="请输入1-9799的整数"
              maxLength={4}
              value={form.startTableNo}
              onChange={(e) => set({ startTableNo: e.target.value.replace(/\D/g, '') })}
            />
          </div>

          {previewNames.length > 0 && (
            <div className="batch-table-preview">
              将批量新增：{previewNames.join('、')}
              {previewNames.length >= 8 ? '…' : ''}
            </div>
          )}

          {error && <div className="area-form-error">{error}</div>}
        </div>

        <div className="modal-foot">
          <button className="tm-btn tm-btn-default" type="button" onClick={onClose}>
            取消
          </button>
          <button
            className="tm-btn tm-btn-primary"
            type="button"
            onClick={handleConfirm}
            disabled={submitting}
          >
            {submitting ? '提交中…' : '确定'}
          </button>
        </div>
      </div>
    </div>
  );
}
