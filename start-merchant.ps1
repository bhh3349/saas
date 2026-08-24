$ErrorActionPreference = 'Stop'

function Restart-Service($name, $dir, $port, $log) {
  $conn = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
  if ($conn) { Stop-Process -Id $conn.OwningProcess -Force; Start-Sleep 2 }
  Start-Process -FilePath node -ArgumentList 'dist/main.js' -WorkingDirectory $dir -RedirectStandardOutput $log -RedirectStandardError "$log.err" -WindowStyle Hidden
}

# 后端：platform 3100 / saas 3200
Restart-Service 'platform' 'd:\c\saas\output\platform-service' 3100 'd:\c\saas\output\platform-service\stdout.log'
Restart-Service 'saas' 'd:\c\saas\output\saas-service' 3200 'd:\c\saas\output\saas-service\stdout.log'

Start-Sleep 5
$p = curl.exe -s -o NUL -w "%{http_code}" http://127.0.0.1:3100/auth/me
$s = curl.exe -s -o NUL -w "%{http_code}" http://127.0.0.1:3200/auth/me
Write-Output "platform_3100=$p saas_3200=$s"

# 前端：merchant-web 5175
$f = Get-NetTCPConnection -LocalPort 5175 -State Listen -ErrorAction SilentlyContinue
if ($f) { Stop-Process -Id $f.OwningProcess -Force; Start-Sleep 2 }
Start-Process -FilePath 'npx.cmd' -ArgumentList 'vite' -WorkingDirectory 'd:\c\saas\merchant-web' -RedirectStandardOutput 'd:\c\saas\merchant-web\vite.log' -RedirectStandardError 'd:\c\saas\merchant-web\vite.log.err' -WindowStyle Hidden
Start-Sleep 8
$w = curl.exe -s -o NUL -w "%{http_code}" http://127.0.0.1:5175/
Write-Output "merchant_5175=$w"
