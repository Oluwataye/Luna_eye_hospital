@echo off
echo.
echo ========================================================
echo   Launching PharmCare Pro and VisionCare EMR...
echo ========================================================
echo.

set PHARM_PORT=3100
set VISION_PORT=3200

:: Check Ports
netstat -ano | findstr ":%PHARM_PORT% :%VISION_PORT% " | findstr "LISTENING" >nul 2>&1
if %errorlevel% equ 0 (
    echo [!] WARNING: One or both ports %PHARM_PORT%, %VISION_PORT% appear to be in use.
    echo     Instances may already be running.
)

:: Start PharmCare Pro
echo [1/2] Starting PharmCare Pro on port %PHARM_PORT%...
start "PharmCare Pro" /d "c:\Users\HP\Documents\pharmcare-pro offline" cmd /c start-pharmcare.bat

:: Delay
echo     Waiting for initialization...
timeout /t 5 /nobreak >nul

:: Start VisionCare EMR
echo [2/2] Starting VisionCare EMR on port %VISION_PORT%...
start "VisionCare EMR" /d "c:\Users\HP\Documents\Luna Eyes Hospital" cmd /c start-visioncare.bat

echo.
echo ========================================================
echo   SYSTEMS READY!
echo ========================================================
echo   PharmCare Pro:    http://localhost:%PHARM_PORT%
echo   VisionCare EMR:   http://localhost:%VISION_PORT%
echo ========================================================
echo.

:: Launch Browsers
timeout /t 5 /nobreak >nul
start http://localhost:%PHARM_PORT%
start http://localhost:%VISION_PORT%/login

echo Keep the server windows open to maintain connections.
pause >nul
