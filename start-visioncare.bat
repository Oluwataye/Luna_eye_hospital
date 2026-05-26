@echo off
set PORT=3200
echo.
echo ========================================================
echo   Starting VisionCare EMR - Luna Eye Hospital on port %PORT%...
echo ========================================================
echo.

:: Check if port is in use
netstat -ano | findstr ":%PORT% " | findstr "LISTENING" >nul 2>&1
if %errorlevel% equ 0 (
    echo [!] WARNING: Port %PORT% is already in use!
    echo     Please ensure no other instance is running.
    echo.
    set /p choice="Do you want to continue anyway? (Y/N): "
    if /i "!choice!" neq "Y" exit /b 1
)

:: Start backend server
echo [1/2] Launching backend server...
cd /d "%~dp0server"
start /b "" node index.js

:: Wait for initialization
echo [2/2] Initializing environment...
timeout /t 3 /nobreak >nul

echo.
echo VisionCare EMR is running at: http://localhost:%PORT%
echo.

:: Open browser
start http://localhost:%PORT%/login

echo Keep this window open while using the app.
pause >nul
