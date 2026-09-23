@echo off
setlocal
cd /d "%~dp0"
if "%~1"=="" (
    powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0skill.ps1" -Action check
) else (
    powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0skill.ps1" -Action "%~1"
)
