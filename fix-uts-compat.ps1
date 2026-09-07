# fix-uts-compat.ps1 — 5.24 编译器兼容批量修复
# 1) String(x) → x.toString()（数字/字符串接收器；可空接收器补 ?? 兜底）
# 2) charCodeAt 判空
$ErrorActionPreference = 'Stop'
$root = 'D:\c\saas\cashier-app'
$utf8 = New-Object System.Text.UTF8Encoding($false)

# 有序替换规则（长模式优先），作用于全部目标文件
$rules = @(
  @('String\(d\.getMonth\(\) \+ 1\)', '(d.getMonth() + 1).toString()'),
  @('String\(d\.getDate\(\)\)', 'd.getDate().toString()'),
  @('String\(d\.getHours\(\)\)', 'd.getHours().toString()'),
  @('String\(d\.getMinutes\(\)\)', 'd.getMinutes().toString()'),
  @('String\(d\.getFullYear\(\)\)', 'd.getFullYear().toString()'),
  @("String\(parsed\['phone'\] \?\? ''\)", "(parsed['phone'] ?? '').toString()"),
  @("String\(parsed\['name'\] \?\? ''\)", "(parsed['name'] ?? '').toString()"),
  @("String\(parsed\['role'\] \?\? ''\)", "(parsed['role'] ?? '').toString()"),
  @("String\(parsed\['status'\] \?\? ''\)", "(parsed['status'] ?? '').toString()"),
  @("String\(parsed\['shopName'\]\)", "(parsed['shopName'] ?? '').toString()"),
  @("String\(parsed\['shopAddress'\]\)", "(parsed['shopAddress'] ?? '').toString()"),
  @("String\(parsed\['shopCreatedAt'\]\)", "(parsed['shopCreatedAt'] ?? '').toString()"),
  @('String\(o\.table_id\)', '(o.table_id ?? 0).toString()'),
  @('String\(o\.ticket_no\)', '(o.ticket_no ?? 0).toString()'),
  @('String\(o\.id\)', 'o.id.toString()'),
  @("String\(o\.table_id \?\? ''\)", '(o.table_id ?? 0).toString()'),
  @('String\(this\.order\.table_id\)', '(this.order.table_id ?? 0).toString()'),
  @('String\(this\.tableId\)', 'this.tableId.toString()'),
  @('String\(this\.orderId\)', 'this.orderId.toString()'),
  @('String\(this\.guests\)', 'this.guests.toString()'),
  @('String\(this\.order\.id\)', 'this.order.id.toString()'),
  @('String\(order\.id\)', 'order.id.toString()'),
  @('String\(t\.order\.id\)', '(t.order?.id ?? 0).toString()'),
  @('String\(t\.id\)', 't.id.toString()'),
  @('String\(order\.table_id\)', '(order.table_id ?? 0).toString()'),
  @('String\(data\.guests\)', '(data.guests ?? 0).toString()'),
  @('String\(it\.qty\)', 'it.qty.toString()'),
  @('String\(first\.qty\)', 'first.qty.toString()'),
  @('String\(list\.length\)', 'list.length.toString()'),
  @('String\(dishId\)', 'dishId.toString()'),
  @('String\(d\.id\)', 'd.id.toString()'),
  @('String\(specIndex\)', 'specIndex.toString()'),
  @('String\(Date\.now\(\)\)', 'Date.now().toString()'),
  @('String\(v\)', 'v.toString()'),
  @('String\(n\)', 'n.toString()'),
  @('String\(id\)', 'id.toString()'),
  @('String\(guests\)', 'guests.toString()')
)

# charCodeAt 判空（esc-pos.uts 两处）
$charCodeRules = @(
  @("const c = s\.charCodeAt\(i\)\r?\n      if \(c >= 0x20", "const c = s.charCodeAt(i)`n      if (c == null) { continue }`n      if (c >= 0x20"),
  @("const c = s\.charCodeAt\(i\)\r?\n      w \+= c > 0x7f", "const c = s.charCodeAt(i)`n      if (c == null) { continue }`n      w += c > 0x7f")
)

$targets = Get-ChildItem $root -Recurse -Include '*.uts','*.uvue' | Where-Object { $_.FullName -notmatch 'unpackage|uni_modules' }
$changed = 0
foreach ($f in $targets) {
  $orig = [System.IO.File]::ReadAllText($f.FullName)
  $c = $orig
  foreach ($r in $rules) {
    $c = [System.Text.RegularExpressions.Regex]::Replace($c, $r[0], $r[1])
  }
  # esc-pos 专用：charCodeAt 判空
  if ($f.Name -eq 'esc-pos.uts') {
    foreach ($r in $charCodeRules) {
      $c = [System.Text.RegularExpressions.Regex]::Replace($c, $r[0], $r[1])
    }
  }
  if ($c -ne $orig) {
    [System.IO.File]::WriteAllText($f.FullName, $c, $utf8)
    $changed++
    Write-Output ("CHANGED: " + $f.FullName.Replace($root + '\', ''))
  }
}
Write-Output ("TOTAL_CHANGED=" + $changed)
