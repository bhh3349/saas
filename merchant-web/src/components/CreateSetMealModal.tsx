import { useEffect, useMemo, useState } from 'react';
import CommonSelect from './CommonSelect';
import SelectDishesModal from './SelectDishesModal';
import { listCategoriesApi } from '../api/categories';
import { createSetmealApi } from '../api/setmeals';

/** 出品档口（与菜品创建保持一致） */
const DEPT_OPTIONS = ['后厨', '凉菜间', '热菜间', '甜品间', '水吧'];

export interface SetMealGroupDish {
  dishId: string;
  dishName: string;
  /** 菜品基础售价（来自菜品库，用于展示） */
  dishPrice: number;
  /** 菜品加价（元） */
  priceChange: number;
  /** 数量 */
  amount: number;
  /** 必选 */
  required: boolean;
  /** 默认 */
  defaultChecked: boolean;
}

export interface SetMealGroup {
  id: string;
  name: string;
  /** fixed: 固定分组 / optional: 可选分组 */
  type: 'fixed' | 'optional';
  /** 可选分组：本组菜品 N 选 M */
  selectCount: number;
  dishes: SetMealGroupDish[];
}

interface CreateSetMealModalProps {
  open: boolean;
  onClose: () => void;
}

function genCode(): string {
  return Math.floor(100000000 + Math.random() * 900000000).toString();
}

let groupSeq = 0;

function emptyGroup(): SetMealGroup {
  groupSeq += 1;
  return { id: `g_${Date.now()}_${groupSeq}`, name: '', type: 'fixed', selectCount: 1, dishes: [] };
}

export default function CreateSetMealModal({ open, onClose }: CreateSetMealModalProps) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [price, setPrice] = useState('');
  const [groups, setGroups] = useState<SetMealGroup[]>([emptyGroup()]);
  const [printEnable, setPrintEnable] = useState(false);
  const [printDept, setPrintDept] = useState('');
  const [status, setStatus] = useState<'on' | 'off'>('on');
  const [minAmount, setMinAmount] = useState('1');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [expandedPick, setExpandedPick] = useState<string | null>(null);

  // 每次打开时重置表单
  useEffect(() => {
    if (open) {
      setName('');
      setCategory('');
      setPrice('');
      setGroups([emptyGroup()]);
      setPrintEnable(false);
      setPrintDept('');
      setStatus('on');
      setMinAmount('1');
      setError('');
      setSuccess('');
      setExpandedPick(null);
    }
  }, [open]);

  /** 套餐分类下拉：后端分类（含 0 关联） */
  const [catNames, setCatNames] = useState<string[]>([]);

  useEffect(() => {
    if (!open) return;
    let active = true;
    setCatNames([]);
    listCategoriesApi()
      .then((cats) => {
        if (active) setCatNames(cats.map((c) => c.name));
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [open]);

  const categoryOptions = useMemo(() => catNames.map((n) => ({ value: n, label: n })), [catNames]);

  const updateGroup = (id: string, patch: Partial<SetMealGroup>) => {
    setGroups((prev) => prev.map((g) => (g.id === id ? { ...g, ...patch } : g)));
  };

  const removeGroup = (id: string) => {
    setGroups((prev) => {
      const next = prev.filter((g) => g.id !== id);
      return next.length ? next : prev;
    });
  };

  const removeDish = (groupId: string, dishId: string) => {
    setGroups((prev) =>
      prev.map((g) => (g.id === groupId ? { ...g, dishes: g.dishes.filter((x) => x.dishId !== dishId) } : g))
    );
  };

  const updateDish = (groupId: string, dishId: string, patch: Partial<SetMealGroupDish>) => {
    setGroups((prev) =>
      prev.map((g) =>
        g.id === groupId
          ? { ...g, dishes: g.dishes.map((d) => (d.dishId === dishId ? { ...d, ...patch } : d)) }
          : g
      )
    );
  };

  /** 移动菜品到目标序号（排序列下拉） */
  const moveDish = (groupId: string, fromIdx: number, toIdx: number) => {
    if (fromIdx === toIdx) return;
    setGroups((prev) =>
      prev.map((g) => {
        if (g.id !== groupId) return g;
        const list = [...g.dishes];
        const [item] = list.splice(fromIdx, 1);
        list.splice(toIdx, 0, item);
        return { ...g, dishes: list };
      })
    );
  };

  const handleSubmit = async () => {
    setError('');
    if (!name.trim()) {
      setError('请填写套餐名称');
      return;
    }
    if (!category) {
      setError('请选择套餐分类');
      return;
    }
    const p = Number(price);
    if (!price || Number.isNaN(p) || p < 0) {
      setError('请填写正确的套餐价格');
      return;
    }
    if (!groups.length) {
      setError('请至少添加一个分组');
      return;
    }
    for (const g of groups) {
      if (!g.name.trim()) {
        setError('请填写分组名称');
        return;
      }
      if (!g.dishes.length) {
        setError(`分组「${g.name}」至少添加一个菜品`);
        return;
      }
      if (g.type === 'optional') {
        const sc = Number(g.selectCount);
        if (!g.selectCount || Number.isNaN(sc) || sc < 1) {
          setError(`分组「${g.name}」请填写可选数量`);
          return;
        }
        if (sc > g.dishes.length) {
          setError(`分组「${g.name}」可选数量不能大于已添加菜品数（${g.dishes.length}）`);
          return;
        }
      }
    }
    if (printEnable && !printDept) {
      setError('请选择出品档口');
      return;
    }
    const ma = Number(minAmount);
    if (!minAmount || Number.isNaN(ma) || ma < 1) {
      setError('请填写正确的套餐起售份数');
      return;
    }

    try {
      await createSetmealApi({
        code: genCode(),
        name: name.trim(),
        category,
        // 套餐价格按「分」提交
        price: Math.round(p * 100),
        groups: groups.map((g) => ({
          name: g.name.trim(),
          type: g.type,
          min_choose: g.type === 'optional' ? Number(g.selectCount) : undefined,
          dishes: g.dishes.map((d) => ({
            id: Number(d.dishId),
            name: d.dishName,
            category: '',
            // 分组内菜品价格按「分」提交（基础售价 + 加价）
            price: Math.round((d.dishPrice + (d.priceChange || 0)) * 100),
            type: 'normal',
          })),
        })),
        print_enable: printEnable,
        print_dept: printDept,
        status: status === 'on' ? '在售' : '停售',
        min_amount: ma,
      });
      setError('');
      setSuccess('套餐保存成功');
      window.setTimeout(() => onClose(), 900);
    } catch (e) {
      setError((e as Error).message || '保存失败');
    }
  };

  return (
    <div className="modal-mask" onClick={onClose}>
      <div className="modal-card dish-modal setmeal-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div className="modal-title">创建套餐</div>
          <button className="modal-close" type="button" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="modal-body">
          {/* 基础信息 */}
          <div className="dish-form-group">
            <div className="dish-form-group-title">基础信息</div>
            <div className="dish-form-grid">
              <div className="dish-form-item">
                <div className="dish-form-item-label">
                  <span className="required-mark">*</span>套餐名称
                </div>
                <div className="dish-form-item-control">
                  <input
                    type="text"
                    placeholder="请输入套餐名称"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
              </div>
              <div className="dish-form-item">
                <div className="dish-form-item-label">
                  <span className="required-mark">*</span>套餐分类
                </div>
                <div className="dish-form-item-control">
                  <CommonSelect
                    value={category}
                    onChange={setCategory}
                    options={categoryOptions}
                    placeholder="选择店内一个分类"
                    className="dish-select"
                  />
                </div>
              </div>
            </div>
            <div className="dish-form-item dish-form-item-price">
              <div className="dish-form-item-label">
                <span className="required-mark">*</span>套餐价格
              </div>
              <div className="dish-form-item-control">
                <input
                  type="number"
                  min="0"
                  placeholder="请输入套餐价格"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                />
                <span className="dish-form-note">元</span>
              </div>
            </div>
          </div>

          {/* 套餐菜品 */}
          <div className="dish-form-group">
            <div className="dish-form-group-title">套餐菜品</div>
            {groups.map((g, idx) => (
              <div className="setmeal-group-card" key={g.id}>
                <div className="setmeal-group-head">
                  <span className="setmeal-group-index">{idx + 1}</span>
                  <input
                    type="text"
                    className="setmeal-group-name-input"
                    placeholder="请输入组名，例如热菜"
                    value={g.name}
                    onChange={(e) => updateGroup(g.id, { name: e.target.value })}
                  />
                  <div className="setmeal-group-type">
                    <CommonSelect
                      value={g.type}
                      onChange={(v) => updateGroup(g.id, { type: v as 'fixed' | 'optional' })}
                      options={[
                        { value: 'optional', label: '可选分组' },
                        { value: 'fixed', label: '固定分组' },
                      ]}
                      width={110}
                      ariaLabel="组类型"
                    />
                  </div>
                  {g.type === 'optional' && (
                    <div className="setmeal-group-amount">
                      <span className="setmeal-group-amount-label">本组菜品{g.dishes.length}选</span>
                      <input
                        type="number"
                        min="1"
                        className="setmeal-amount-input"
                        placeholder="请输入"
                        value={g.selectCount || ''}
                        onChange={(e) => updateGroup(g.id, { selectCount: Number(e.target.value) })}
                      />
                      <span className="setmeal-group-amount-note">按固定值</span>
                    </div>
                  )}
                  <button
                    className="setmeal-group-remove"
                    type="button"
                    onClick={() => removeGroup(g.id)}
                  >
                    删除分组
                  </button>
                </div>

                <div className="setmeal-table-wrap">
                  <table className="setmeal-sku-table">
                    <thead>
                      <tr>
                        <th>序号</th>
                        <th>名称</th>
                        <th>基础售卖状态</th>
                        <th>菜品销售价</th>
                        <th>
                          菜品加价<i className="setmeal-th-tip">?</i>
                        </th>
                        <th>
                          数量<i className="setmeal-th-tip">?</i>
                        </th>
                        <th>必选</th>
                        <th>默认</th>
                        <th>排序</th>
                        <th>操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {g.dishes.map((d, di) => (
                        <tr key={d.dishId}>
                          <td className="setmeal-td-center">{di + 1}</td>
                          <td className="setmeal-td-name" title={d.dishName}>
                            {d.dishName}
                          </td>
                          <td>在售</td>
                          <td>￥{(d.dishPrice ?? 0).toFixed(2)}</td>
                          <td>
                            <span className="setmeal-cell-input">
                              <input
                                type="number"
                                min="0"
                                value={d.priceChange || ''}
                                placeholder="请输入"
                                onChange={(e) =>
                                  updateDish(g.id, d.dishId, { priceChange: Number(e.target.value) })
                                }
                              />
                              <span className="setmeal-cell-input-suffix">元</span>
                            </span>
                          </td>
                          <td>
                            <input
                              type="number"
                              min="1"
                              className="setmeal-cell-num"
                              value={d.amount || ''}
                              placeholder="请输入数量"
                              onChange={(e) =>
                                updateDish(g.id, d.dishId, { amount: Number(e.target.value) })
                              }
                            />
                          </td>
                          <td className="setmeal-td-center">
                            <input
                              type="checkbox"
                              checked={d.required}
                              onChange={(e) => updateDish(g.id, d.dishId, { required: e.target.checked })}
                            />
                          </td>
                          <td className="setmeal-td-center">
                            <input
                              type="checkbox"
                              checked={d.defaultChecked}
                              onChange={(e) =>
                                updateDish(g.id, d.dishId, { defaultChecked: e.target.checked })
                              }
                            />
                          </td>
                          <td>
                            <select
                              className="setmeal-sort-select"
                              value={di}
                              onChange={(e) => moveDish(g.id, di, Number(e.target.value))}
                            >
                              {g.dishes.map((_, si) => (
                                <option key={si} value={si}>
                                  {si + 1}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td>
                            <button
                              type="button"
                              className="setmeal-dish-del"
                              onClick={() => removeDish(g.id, d.dishId)}
                            >
                              删除
                            </button>
                          </td>
                        </tr>
                      ))}
                      {g.dishes.length === 0 && (
                        <tr>
                          <td className="setmeal-empty-cell" colSpan={10}>
                            暂未添加菜品，请点击下方「添加菜品」
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="setmeal-table-footer">
                  <button
                    className="tm-btn tm-btn-default setmeal-add-btn"
                    type="button"
                    onClick={() => setExpandedPick(g.id)}
                  >
                    + 添加菜品
                  </button>
                </div>
              </div>
            ))}
            <div className="setmeal-group-actions">
              <button
                className="tm-btn setmeal-new-group-btn"
                type="button"
                onClick={() => setGroups((prev) => [...prev, emptyGroup()])}
              >
                新建分组
              </button>
            </div>
          </div>

          {/* 打印配置 */}
          <div className="dish-form-group">
            <div className="dish-form-group-title">打印配置</div>
            <div className="dish-form-item">
              <div className="dish-form-item-label">是否需要打印</div>
              <div className="dish-form-item-control">
                <div className="area-form-radios">
                  <label className="radio-item">
                    <input
                      type="radio"
                      checked={!printEnable}
                      onChange={() => {
                        setPrintEnable(false);
                        setPrintDept('');
                      }}
                    />
                    <span className="radio-dot"></span>
                    否
                  </label>
                  <label className="radio-item">
                    <input
                      type="radio"
                      checked={printEnable}
                      onChange={() => setPrintEnable(true)}
                    />
                    <span className="radio-dot"></span>
                    是
                  </label>
                </div>
                <span className="dish-form-note">开启后需选择出品档口</span>
              </div>
            </div>
            {printEnable && (
              <div className="dish-form-item">
                <div className="dish-form-item-label">
                  <span className="required-mark">*</span>选择档口
                </div>
                <div className="dish-form-item-control">
                  <CommonSelect
                    value={printDept}
                    onChange={setPrintDept}
                    options={DEPT_OPTIONS.map((d) => ({ value: d, label: d }))}
                    placeholder="选择出品档口"
                    className="dish-select"
                  />
                </div>
              </div>
            )}
          </div>

          {/* 销售信息 */}
          <div className="dish-form-group">
            <div className="dish-form-group-title">销售信息</div>
            <div className="dish-form-item">
              <div className="dish-form-item-label">售卖状态</div>
              <div className="dish-form-item-control">
                <div className="area-form-radios">
                  <label className="radio-item">
                    <input
                      type="radio"
                      checked={status === 'on'}
                      onChange={() => setStatus('on')}
                    />
                    <span className="radio-dot"></span>
                    在售
                  </label>
                  <label className="radio-item">
                    <input
                      type="radio"
                      checked={status === 'off'}
                      onChange={() => setStatus('off')}
                    />
                    <span className="radio-dot"></span>
                    停售
                  </label>
                </div>
              </div>
            </div>
            <div className="dish-form-item">
              <div className="dish-form-item-label">套餐起售份数</div>
              <div className="dish-form-item-control">
                <input
                  type="number"
                  min="1"
                  value={minAmount}
                  onChange={(e) => setMinAmount(e.target.value)}
                />
                <span className="dish-form-note">份</span>
              </div>
            </div>
          </div>
        </div>

        {success ? (
          <div className="area-form-success" style={{ margin: '0 24px 12px' }}>
            {success}
          </div>
        ) : error ? (
          <div className="area-form-error" style={{ margin: '0 24px 12px' }}>
            {error}
          </div>
        ) : null}
        <div className="modal-foot">
          <button className="tm-btn tm-btn-default" type="button" onClick={onClose}>
            取消
          </button>
          <button className="tm-btn tm-btn-primary" type="button" onClick={handleSubmit}>
            保存
          </button>
        </div>
      </div>
      {expandedPick && (
        <SelectDishesModal
          open
          initialSelected={
            groups.find((g) => g.id === expandedPick)?.dishes.map((d) => d.dishId) ?? []
          }
          onClose={() => setExpandedPick(null)}
          onConfirm={(items) => {
            const gid = expandedPick;
            setGroups((prev) =>
              prev.map((g) => {
                if (g.id !== gid) return g;
                const map = new Map(g.dishes.map((d) => [d.dishId, d]));
                items.forEach((it) => {
                  if (!map.has(it.id)) {
                    map.set(it.id, {
                      dishId: it.id,
                      dishName: it.name,
                      dishPrice: it.price ?? 0,
                      priceChange: 0,
                      amount: 1,
                      required: false,
                      defaultChecked: false,
                    });
                  }
                });
                return { ...g, dishes: Array.from(map.values()) };
              })
            );
            setExpandedPick(null);
          }}
        />
      )}
    </div>
  );
}
