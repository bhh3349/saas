$ErrorActionPreference = 'Stop'

function Restart-Service($name, $dir, $port, $log) {
  $conn = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
  if ($conn) { Stop-Process -Id $conn.OwningProcess -Force; Start-Sleep 2 }
  Start-Process -FilePath node -ArgumentList 'dist/main.js' -WorkingDirectory $dir -RedirectStandardOutput $log -RedirectStandardError "$log.err" -WindowStyle Hidden
}

# 1) rebuild both
Push-Location d:\c\saas\output\saas-service
npm run build 2>&1 | Select-Object -Last 3
Pop-Location
Push-Location d:\c\saas\output\platform-service
npm run build 2>&1 | Select-Object -Last 3
Pop-Location

# 2) restart both
Restart-Service 'saas' 'd:\c\saas\output\saas-service' 3200 'd:\c\saas\output\saas-service\stdout.log'
Restart-Service 'platform' 'd:\c\saas\output\platform-service' 3100 'd:\c\saas\output\platform-service\stdout.log'

# 3) verify
Start-Sleep 5
$p = curl.exe -s -o NUL -w "%{http_code}" http://127.0.0.1:3100/auth/me
$s = curl.exe -s -o NUL -w "%{http_code}" http://127.0.0.1:3200/auth/me
Write-Output "platform_3100=$p saas_3200=$s"
