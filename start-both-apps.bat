@echo off
echo.
echo ========================================================
echo   Launching VisionCare EMR (Standalone)...
echo ========================================================
echo.

:: Start VisionCare EMR standalone
echo Starting VisionCare EMR...
cd /d "%~dp0"
start "VisionCare EMR" cmd /c start-visioncare.bat

echo.
echo ========================================================
echo   SYSTEM READY!
echo ========================================================
echo   VisionCare EMR:   http://lunaeyehospital/
echo ========================================================
echo.

echo Keep the server window open to maintain connection.
pause >nul
