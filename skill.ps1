param(
  [string]$Action = "help"
)

Write-Host "==============================================================================" -ForegroundColor Cyan
Write-Host "  LOCAL ORCHESTRATOR PRO - 5 CORE SKILLS" -ForegroundColor Magenta
Write-Host "  Server: http://127.0.0.1:8787" -ForegroundColor Blue
Write-Host "==============================================================================" -ForegroundColor Cyan

if ($Action -eq "check") {
    Write-Host "[1/4] Kiem tra Node.js..." -ForegroundColor Cyan
    node -v
    Write-Host "[2/4] Kiem tra thu vien node_modules..." -ForegroundColor Cyan
    if (Test-Path "node_modules") { Write-Host "node_modules OK" -ForegroundColor Green } else { npm install }
    Write-Host "[3/4] Kiem tra Database SQLite..." -ForegroundColor Cyan
    node -e "const db=require('./db'); console.log('SQLite OK! Co ' + db.getSetups({limit:1000}).length + ' setups.');"
    Write-Host "[4/4] Kiem tra API OKX..." -ForegroundColor Cyan
    node -e "fetch('https://www.okx.com/api/v5/market/candles?instId=BTC-USDT-SWAP`&bar=30m`&limit=2').then(r=>r.json()).then(d=>console.log('OKX API OK! Code: ' + d.code));"
    Write-Host "HE THONG SAN SANG HOAT DONG!" -ForegroundColor Green
} elseif ($Action -eq "test") {
    Write-Host "Dang kiem thu OKX Candles API va Server..." -ForegroundColor Cyan
    node -e "fetch('http://127.0.0.1:8787/api/health').then(r=>r.json()).then(d=>console.log('Health:', d.status));"
} elseif ($Action -eq "start") {
    Write-Host "Dang khoi chay server..." -ForegroundColor Green
    node server.js
} elseif ($Action -eq "dev") {
    Write-Host "Dang khoi chay server voi nodemon..." -ForegroundColor Yellow
    npx nodemon server.js
} elseif ($Action -eq "reset") {
    Write-Host "Dang xoa sach setups va candles..." -ForegroundColor Yellow
    node -e "const db=require('./db'); db.clearSetups(); console.log('Da xoa sach!');"
} elseif ($Action -eq "skills") {
    Write-Host "5 CORE SKILLS:" -ForegroundColor Yellow
    Write-Host "1. Skill 1: Multi-Timeframe Consensus Radar (15p, 30p, 1h, 4h)" -ForegroundColor Green
    Write-Host "2. Skill 2: Centralized AI Risk and Thresholds Engine" -ForegroundColor Green
    Write-Host "3. Skill 3: Multi-Timeframe OKX Candlestick Studio" -ForegroundColor Green
    Write-Host "4. Skill 4: 1-Click Instant Execution and Clipboard Engine" -ForegroundColor Green
    Write-Host "5. Skill 5: Real-Time Audio-Visual Telemetry" -ForegroundColor Green
} else {
    Write-Host "CACH DUNG: .\skill.ps1 -Action [check|test|start|dev|reset|skills]" -ForegroundColor Yellow
}
