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

## 三、分页（复用 Pagination 组件，可选）

统一分页条优先直接使用 `merchant-web/src/components/Pagination.tsx` 组件（默认每页 **10** 条，选项 **10 / 20 / 30 / 50**）：

```tsx
import Pagination, { DEFAULT_PAGE_SIZE } from '../components/Pagination';

const [currentPage, setCurrentPage] = useState(1);
const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE); // 默认 10 条/页

<Pagination
  total={filtered.length}
  page={currentPage}
  pageSize={pageSize}
  onPageChange={setCurrentPage}
  onPageSizeChange={(s) => {
    setPageSize(s);
    setCurrentPage(1); // 注意：组件不重置页码，调用方需自行处理（见 DishLibrary）
  }}
/>
```

### 分页 DOM 结构（组件内部实现，供样式参考 / 手写兜底）

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
    {pageNumbers(currentPage, totalPages).map((n, i) =>
      n === '…' ? (
        <span key={`e${i}`} className="page-ellipsis">…</span>
      ) : (
        <button
          key={n}
          className={`page-num ${currentPage === n ? 'active' : ''}`}
          type="button"
          onClick={() => setCurrentPage(n)}
        >
          {n}
        </button>
      ),
    )}
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
      { value: '10', label: '10 条/页' },
      { value: '20', label: '20 条/页' },
      { value: '30', label: '30 条/页' },
      { value: '50', label: '50 条/页' },
    ]}
    onChange={(v) => {
      setPageSize(Number(v));
      setCurrentPage(1); // 调用方需自行重置页码，组件不负责
    }}
  />
</div>
```

### 紧凑页码窗口与 page-ellipsis

Pagination 组件内部用 `pageNumbers(page, totalPages)` 生成页码序列，规则如下：

1. 总页数 **≤ 7**：展示全部页码，无省略号。
2. 总页数 **> 7**：只保留「第 1、2 页 + 当前页及其前后各 1 页 + 倒数第 2 页和末页」，去重、过滤越界后升序排列；相邻页码间隔 > 1 的位置插入 `<span className="page-ellipsis">…</span>`。
3. 省略号是**纯展示元素**（不可点击），类名 `.page-ellipsis`，样式已在 `global.css` 定义。

示例：总 20 页、当前第 10 页 → `1 2 … 9 10 11 … 19 20`。

## 三·补、rowSpan 多规格表格（模板的自有扩展）

一行业务数据需要展开为多行（如多规格菜品：每个规格一行，公共列合并）时，在模板第二节基础上扩展。参考实现：`DishLibrary.tsx` 的 `tableRows` + 渲染部分。

**数据准备**：把每条记录展开为行对象数组，每行携带 `rowSpan`（合并行数）与 `isFirst`（是否组内首行）：

```tsx
const tableRows = useMemo(() => {
  return pageData.flatMap((d, idx) => {
    if (d.specs.length > 1) {
      return d.specs.map((s, i) => ({
        dish: d, seq: idx + 1, spec: s.spec, price: s.price,
        rowSpan: d.specs.length, isFirst: i === 0,
      }));
    }
    return [{ dish: d, seq: idx + 1, spec: '标准', price: d.price, rowSpan: 1, isFirst: true }];
  });
}, [pageData]);
```

**渲染规则**：

- `key` 用「记录 id + 规格标识」组合（如 `` `${d.id}_${r.spec}` ``），保证组内各行唯一。
- **公共列**（序号、名称、分类、状态、操作列等）只在 `r.isFirst` 为真时渲染，并写 `rowSpan={r.rowSpan}`；非首行不渲染这些 `<td>`。
- **分组内每行独有的列**（如规格名、单价）不加 `rowSpan`，每行正常渲染。

```tsx
{tableRows.map((r) => (
  <tr key={`${r.dish.id}_${r.spec}`}>
    {r.isFirst && (
      <td style={{ fontWeight: 500 }} rowSpan={r.rowSpan}>{r.dish.name}</td> // 公共列：仅首行渲染
    )}
    <td className="td-center">{r.spec}</td>          {/* 行独有列：每行渲染 */}
    <td className="td-center">{formatPrice(r.price)}</td>
    {r.isFirst && (
      <td className="td-sticky" rowSpan={r.rowSpan}>
        <div className="row-actions">{/* 行操作按钮 */}</div>
      </td>
    )}
  </tr>
))}
```

**注意**：空态判断的 `colSpan` 仍按「总列数」计算（合并只影响数据行，不影响表头列数）。

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
| 分页容器 | `.table-pagination` > `.page-total` / `.page-pages` / `.page-btn` / `.page-num.active` / `.page-ellipsis` / `.page-size` |
| 弹窗遮罩/卡片 | `.modal-mask` > `.modal-card`（+ 具体 modal 类如 `dish-modal`） |
| 弹窗头部 | `.modal-head` > `.modal-title` + `button.modal-close` |
| 弹窗底部 | `.modal-foot` > `button.tm-btn.tm-btn-default` / `.tm-btn.tm-btn-primary` |

## 五、使用规则

1. **列头**：`<th>` 默认左对齐；数字、状态、勾选等用 `th-center`；「操作」列固定最右用 `th-sticky`。
2. **行 key**：用数据唯一 id（`d.id`）。
3. **操作列**：最后一个 `<td>` 用 `td-sticky` + 内部 `.row-actions`，按钮用 `action-link`，危险操作用 `action-link danger`。
4. **状态展示**：统一 `status-tag` + `status-on/status-off`，不要自己写颜色。
5. **空数据**：必须渲染空状态行，`colSpan` 要等于实际总列数（含批量选择列）。
6. **分页**：需要分页时优先复用 `Pagination` 组件（第三节）；组件不负责页码重置，改每页条数时调用方需自行 `setCurrentPage(1)`。
7. **依赖组件**：`EmptyState`、`CommonSelect`、`Pagination` 从 `../components/` 导入。
7. **依赖组件**：`EmptyState`、`CommonSelect` 从 `../components/` 导入。
