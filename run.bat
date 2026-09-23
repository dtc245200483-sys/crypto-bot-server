@echo off
title Local Orchestrator Server - Port 8787
chcp 65001 >nul
cd /d "%~dp0"

echo =====================================================================
echo           KHỞI CHẠY LOCAL ORCHESTRATOR SERVER (PORT 8787)
echo =====================================================================
echo.

:: 1. Kiểm tra Node.js đã được cài đặt chưa
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [LỖI] Không tìm thấy Node.js trên máy tính!
    echo Vui lòng cài đặt Node.js từ https://nodejs.org/ trước khi chạy.
    echo.
    pause
    exit /b 1
)

:: 2. Kiểm tra và tự động cài đặt dependencies nếu chưa có
if not exist "node_modules\" (
    echo [INFO] Thư mục node_modules chưa tồn tại. Đang tự động cài đặt thư viện...
    call npm install
    if %errorlevel% neq 0 (
        echo [LỖI] Cài đặt thư viện thất bại! Vui lòng kiểm tra kết nối mạng.
        echo.
        pause
        exit /b 1
    )
    echo [INFO] Cài đặt thư viện thành công!
    echo.
)

:: 3. Tự động mở trình duyệt Web Dashboard sau 2 giây
start "" cmd /c "timeout /t 2 /nobreak >nul && start http://localhost:8787"

echo [INFO] Đang chạy máy chủ tại http://127.0.0.1:8787
echo [INFO] Trình duyệt sẽ tự động mở trang Dashboard sau giây lát...
echo [INFO] Nhấn tổ hợp phím Ctrl + C để dừng máy chủ.
echo.
echo =====================================================================
echo.

:: 4. Khởi chạy máy chủ Express
node server.js

if %errorlevel% neq 0 (
    echo.
    echo [LỖI] Máy chủ đã dừng với mã lỗi: %errorlevel%.
    echo Vui lòng xem log ở trên để kiểm tra chi tiết.
    pause
)
