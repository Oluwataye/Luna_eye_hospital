@echo off
set "SCRIPT_PATH=%~dp0StartVisionCareEMR.vbs"
set "DESKTOP_PATH=%USERPROFILE%\Desktop\VisionCare EMR.lnk"
set "ICON_PATH=%SystemRoot%\System32\shell32.dll"
set "ICON_INDEX=22"

echo Creating Desktop Shortcuts...

:: Create Start Shortcut
powershell -Command "$s=(New-Object -COM WScript.Shell).CreateShortcut('%USERPROFILE%\Desktop\VisionCare EMR.lnk');$s.TargetPath='wscript.exe';$s.Arguments='\"%~dp0StartVisionCareEMR.vbs\"';$s.WorkingDirectory='%~dp0';$s.IconLocation='%ICON_PATH%, %ICON_INDEX%';$s.Description='Start VisionCare EMR';$s.Save()"

:: Create Stop Shortcut
powershell -Command "$s=(New-Object -COM WScript.Shell).CreateShortcut('%USERPROFILE%\Desktop\Stop VisionCare EMR.lnk');$s.TargetPath='wscript.exe';$s.Arguments='\"%~dp0StopVisionCareEMR.vbs\"';$s.WorkingDirectory='%~dp0';$s.IconLocation='%ICON_PATH%, 131';$s.Description='Stop VisionCare EMR';$s.Save()"

echo.
echo ======================================================
echo SUCCESS: VisionCare EMR Desktop Icons Created!
echo ======================================================
echo 1. Start VisionCare EMR
echo 2. Stop VisionCare EMR
echo ======================================================
pause
