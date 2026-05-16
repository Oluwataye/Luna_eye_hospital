@echo off
echo.
echo ========================================================
echo   Stopping PharmCare Pro and VisionCare EMR...
echo ========================================================
echo.

set PHARM_PORT=3100
set VISION_PORT=3200

:: Stop PharmCare
echo [1/2] Stopping PharmCare Pro...
set FOUND1=0
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":%PHARM_PORT% " ^| findstr "LISTENING"') do (
    taskkill /PID %%a /F >nul 2>&1
    echo     [✓] Process %%a stopped.
    set FOUND1=1
)
if %FOUND1% equ 0 echo     [!] Not running on port %PHARM_PORT%.

:: Stop VisionCare
echo [2/2] Stopping VisionCare EMR...
set FOUND2=0
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":%VISION_PORT% " ^| findstr "LISTENING"') do (
    taskkill /PID %%a /F >nul 2>&1
    echo     [✓] Process %%a stopped.
    set FOUND2=1
)
if %FOUND2% equ 0 echo     [!] Not running on port %VISION_PORT%.

echo.
echo ========================================================
echo   All services stopped.
echo ========================================================
timeout /t 3
