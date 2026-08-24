$ErrorActionPreference = 'Stop'
$pat = '*' + [char]0x684C + [char]0x53F0 + [char]0x4FE1 + [char]0x606F + [char]0x8868 + '*'
$dl = Get-ChildItem "D:\c\Users\Administrator\Downloads" -Filter *.xlsx | Where-Object { $_.Name -like $pat } | Sort-Object LastWriteTime -Descending | Select-Object -First 1
if (-not $dl) { throw 'xlsx not found' }
Copy-Item $dl.FullName 'd:\c\saas\temp_tables_ref.xlsx' -Force
$txt = Get-ChildItem "D:\c\Users\Administrator\Desktop" -Filter *.txt | Sort-Object LastWriteTime -Descending | Select-Object -First 1
if ($txt) { Copy-Item $txt.FullName 'd:\c\saas\temp_ref.txt' -Force }
Write-Output "copied: $($dl.Name)"
Get-ChildItem 'd:\c\saas\temp_ref*' | Select-Object Name, Length | Format-Table
