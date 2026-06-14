@echo off
echo.
echo ========================================================
echo   Starting VisionCare EMR - Standalone Package...
echo ========================================================
echo.

:: Check if port 80 is in use
netstat -ano | findstr ":80 " | findstr "LISTENING" >nul 2>&1
if %errorlevel% equ 0 (
    echo [!] WARNING: Port 80 is already in use by another service!
    echo     Please stop any other web server.
    echo.
    pause
    exit /b 1
)

:: Start standalone executable
echo Launching VisionCare-EMR.exe...
cd /d "%~dp0packaged-release"
start /b "" VisionCare-EMR.exe

:: Wait for initialization
echo Initializing environment...
timeout /t 3 /nobreak >nul

echo.
echo VisionCare EMR is running at: http://lunaeyehospital/
echo.

:: Open browser
start http://lunaeyehospital/

echo.
echo Keep this window open while using the app.
pause >nul
