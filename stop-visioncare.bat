@echo off
set PORT=3200
echo.
echo Stopping VisionCare EMR on port %PORT%...

set FOUND=0
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":%PORT% " ^| findstr "LISTENING"') do (
    echo [!] Found process %%a listening on port %PORT%
    taskkill /PID %%a /F >nul 2>&1
    echo [✓] VisionCare EMR stopped successfully.
    set FOUND=1
)

if %FOUND% equ 0 (
    echo [!] WARNING: VisionCare EMR was not found running on port %PORT%.
)

timeout /t 2 >nul
