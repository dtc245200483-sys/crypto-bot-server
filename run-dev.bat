@echo off
title Local Orchestrator Server (DEV MODE - AUTO RELOAD)
chcp 65001 >nul
cd /d "%~dp0"

echo =====================================================================
echo    KHỞI CHẠY LOCAL SERVER Ở CHẾ ĐỘ DEV (TỰ RELOAD KHI SỬA CODE)
echo =====================================================================
echo.

start "" cmd /c "timeout /t 2 /nobreak >nul && start http://localhost:8787"

echo [INFO] Đang chạy với cờ --watch...
node --watch server.js
pause
