@echo off
setlocal enabledelayedexpansion

echo ======================================================
echo VISIONCARE EMR - ONE-CLICK INSTALLER
echo Luna Eye Hospital Setup Utility
echo ======================================================
echo.

:: 1. Check for Node.js
echo Checking for Node.js...
node -v >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed!
    echo Please install Node.js from https://nodejs.org/ before running this setup.
    echo.
    pause
    exit /b 1
)
echo [OK] Node.js detected.
echo.

:: 2. Install Backend Dependencies
echo Installing Backend Components...
cd /d "%~dp0server"
call npm install
if %errorlevel% neq 0 (
    echo [ERROR] Failed to install backend components.
    pause
    exit /b 1
)
echo [OK] Backend ready.
echo.

:: 3. Install Frontend Dependencies and Build
echo Installing Frontend Components and Building UI...
cd /d "%~dp0"
call npm install
if %errorlevel% neq 0 (
    echo [ERROR] Failed to install frontend components.
    pause
    exit /b 1
)

echo Building Production Bundle (this may take a minute)...
call npm run build
if %errorlevel% neq 0 (
    echo [ERROR] Build failed! Please contact support.
    pause
    exit /b 1
)
echo [OK] Frontend Build Complete.
echo.

:: 4. Create Desktop Shortcuts
echo Finalizing Desktop Shortcuts...
set "ICON_PATH=%SystemRoot%\System32\shell32.dll"

:: Start Shortcut
powershell -Command "$s=(New-Object -COM WScript.Shell).CreateShortcut('%USERPROFILE%\Desktop\VisionCare EMR.lnk');$s.TargetPath='wscript.exe';$s.Arguments='\"%~dp0StartVisionCareEMR.vbs\"';$s.WorkingDirectory='%~dp0';$s.IconLocation='%ICON_PATH%, 22';$s.Description='Start VisionCare EMR';$s.Save()"

:: Stop Shortcut
powershell -Command "$s=(New-Object -COM WScript.Shell).CreateShortcut('%USERPROFILE%\Desktop\Stop VisionCare EMR.lnk');$s.TargetPath='wscript.exe';$s.Arguments='\"%~dp0StopVisionCareEMR.vbs\"';$s.WorkingDirectory='%~dp0';$s.IconLocation='%ICON_PATH%, 131';$s.Description='Stop VisionCare EMR';$s.Save()"

echo [OK] Shortcuts created on Desktop.
echo.

:: 5. Final Success Message
powershell -Command "[Reflection.Assembly]::LoadWithPartialName('System.Windows.Forms'); [System.Windows.Forms.MessageBox]::Show('VisionCare EMR has been set up successfully. Double-click the VisionCare EMR icon on your desktop to start.', 'Setup Complete', 0, 64)"

echo ======================================================
echo INSTALLATION COMPLETE!
echo ======================================================
echo You can now close this window.
echo ======================================================
pause
