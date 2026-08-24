$ErrorActionPreference = 'Stop'
Push-Location d:\c\saas\output\saas-service
npm run build 2>&1 | Select-Object -Last 5
Pop-Location
$conn = Get-NetTCPConnection -LocalPort 3200 -State Listen -ErrorAction SilentlyContinue
if ($conn) { Stop-Process -Id $conn.OwningProcess -Force; Start-Sleep 2 }
Start-Process -FilePath node -ArgumentList 'dist/main.js' -WorkingDirectory 'd:\c\saas\output\saas-service' -RedirectStandardOutput 'd:\c\saas\output\saas-service\stdout.log' -RedirectStandardError 'd:\c\saas\output\saas-service\stdout.log.err' -WindowStyle Hidden
Start-Sleep 5
$s = curl.exe -s -o NUL -w "%{http_code}" http://127.0.0.1:3200/auth/me
Write-Output "saas_3200=$s"
