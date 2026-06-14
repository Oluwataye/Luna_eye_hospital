@echo off
echo.
echo Stopping VisionCare EMR...

taskkill /F /IM VisionCare-EMR.exe >nul 2>&1
if %errorlevel% equ 0 (
    echo [OK] VisionCare EMR stopped successfully.
) else (
    echo [!] WARNING: VisionCare EMR was not running.
)

timeout /t 2 >nul
