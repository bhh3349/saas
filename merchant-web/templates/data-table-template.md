# 标准数据表格 DOM 模板

> 来源：菜品库 `merchant-web/src/views/DishLibrary.tsx` 的表格 DOM（样式的"唯一真源"）。
>
> **用途**：新建任何页面表格时，直接复制下面的结构，只替换「列头字段」和「数据绑定」，样式完全一致、无需新增 CSS。
>
> 所有类名样式已在 `merchant-web/src/styles/global.css` 定义，全局可用。

## 一、页面整体布局（表格所在的上下文）

```
.page
 ├─ .page-head          ← 页面标题 + 右上角操作按钮（可选）
 ├─ .goods-list-action-bar  ← 按钮组（可选）：tm-btn tm-btn-primary / tm-btn tm-btn-default
 ├─ section.panel       ← 查询栏（可选）：SearchForm 组件
 ├─ .data-table.table-list  ← ★ 表格外层
 │   └─ .area-table-scroll.checkout-scroll  ← 滚动容器
 │       └─ table.checkout-real-table        ← 真正表格
 │           ├─ colgroup
 │           ├─ thead > tr > th
 │           └─ tbody > tr > td
 └─ .table-pagination   ← 分页
```

## 二、表格主体 DOM（可整体复制）

```tsx
<div className="data-table table-list">
  <div className="area-table-scroll checkout-scroll">
    <table className="checkout-real-table">
      <colgroup>
        {/* 可选：批量选择列 */}
        {batchMode && <col style={{ width: 48 }} />}
        {/* 列宽规则：普通列 <col />，固定宽度列 <col style={{ width: 100 }} /> */}
        <col />
        <col />
        <col style={{ width: 100 }} />
        <col style={{ width: 130 }} />
      </colgroup>
      <thead>
        <tr>
          {/* 可选：全选 */}
          {batchMode && (
            <th className="th-center">
              <input type="checkbox" className="table-check" checked={isAllSelected} onChange={toggleSelectAll} />
            </th>
          )}
          <th>列头A</th>
          <th>列头B</th>
          <th className="th-center">列头C（居中）</th>
          <th className="th-sticky">操作</th>
        </tr>
      </thead>
      <tbody>
        {data.length === 0 ? (
          <tr>
            <td colSpan={colCount} style={{ height: 200, textAlign: 'center', padding: 0 }}>
              <EmptyState title="暂无数据" desc="这里可以描述空状态引导文案" />
            </td>
          </tr>
        ) : (
          data.map((d) => (
            <tr key={d.id}>
              {/* 可选：行选择 */}
              {batchMode && (
                <td className="td-center">
                  <input
                    type="checkbox"
                    className="table-check"
                    checked={selectedIds.includes(d.id)}
                    onChange={() => toggleSelect(d.id)}
                  />
                </td>
              )}
              <td style={{ fontWeight: 500 }}>{d.fieldA}</td>
              <td>{d.fieldB}</td>
              <td className="td-center">{d.fieldC}</td>
              <td>
                {/* 状态标签 */}
                <span className={`status-tag ${d.status === '在售' ? 'status-on' : 'status-off'}`}>
                  {d.status}
                </span>
              </td>
              <td className="td-sticky">
                <div className="row-actions">
                  <button className="action-link" type="button" onClick={() => openEdit(d)}>
                    编辑
                  </button>
                  <button className="action-link danger" type="button" onClick={() => setDelId(d.id)}>
                    删除
                  </button>
                </div>
              </td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  </div>
</div>
```

## 三、分页 DOM（可选）

```tsx
<div className="table-pagination">
  <span className="page-total">共 {filtered.length} 条记录</span>
  <div className="page-pages">
    <button
      className="page-btn"
      disabled={currentPage <= 1}
      aria-label="上一页"
      type="button"
      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
    >
      ‹
    </button>
    {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
      <button
        key={p}
        className={`page-num ${currentPage === p ? 'active' : ''}`}
        type="button"
        onClick={() => setCurrentPage(p)}
      >
        {p}
      </button>
    ))}
    <button
      className="page-btn"
      disabled={currentPage >= totalPages}
      aria-label="下一页"
      type="button"
      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
    >
      ›
    </button>
  </div>
  <CommonSelect
    className="page-size"
    value={String(pageSize)}
    align="right"
    width="auto"
    options={[
      { value: '20', label: '20 条/页' },
      { value: '50', label: '50 条/页' },
      { value: '100', label: '100 条/页' },
    ]}
    onChange={(v) => {
      setPageSize(Number(v));
      setCurrentPage(1);
    }}
  />
</div>
```

## 四、类名速查表

| 用途 | 类名 |
|---|---|
| 表格外层容器 | `.data-table.table-list` |
| 滚动容器 | `.area-table-scroll.checkout-scroll` |
| 表格 | `table.checkout-real-table` |
| 居中表头 | `th.th-center` |
| 固定操作列表头/单元格 | `th.th-sticky` / `td.td-sticky` |
| 居中单元格 | `td.td-center` |
| 空状态 | 组件 `<EmptyState title=".." desc=".." />`（`colSpan`=总列数） |
| 状态标签 | `.status-tag.status-on`（启用）/ `.status-tag.status-off`（停用） |
| 行操作按钮组 | `.row-actions` > `button.action-link`（危险：追加 `.danger`） |
| 批量勾选 | `input.table-check` |
| 分页容器 | `.table-pagination` > `.page-total` / `.page-pages` / `.page-btn` / `.page-num.active` / `.page-size` |
| 弹窗遮罩/卡片 | `.modal-mask` > `.modal-card`（+ 具体 modal 类如 `dish-modal`） |
| 弹窗头部 | `.modal-head` > `.modal-title` + `button.modal-close` |
| 弹窗底部 | `.modal-foot` > `button.tm-btn.tm-btn-default` / `.tm-btn.tm-btn-primary` |

## 五、使用规则

1. **列头**：`<th>` 默认左对齐；数字、状态、勾选等用 `th-center`；「操作」列固定最右用 `th-sticky`。
2. **行 key**：用数据唯一 id（`d.id`）。
3. **操作列**：最后一个 `<td>` 用 `td-sticky` + 内部 `.row-actions`，按钮用 `action-link`，危险操作用 `action-link danger`。
4. **状态展示**：统一 `status-tag` + `status-on/status-off`，不要自己写颜色。
5. **空数据**：必须渲染空状态行，`colSpan` 要等于实际总列数（含批量选择列）。
6. **分页**：需要分页时复用第三节 DOM，页码/条数/总数字段名按业务改。
7. **依赖组件**：`EmptyState`、`CommonSelect` 从 `../components/` 导入。
