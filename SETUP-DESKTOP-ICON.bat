@echo off
set "SCRIPT_PATH=%~dp0VisionCare-EMR.vbs"
set "DESKTOP_PATH=%USERPROFILE%\Desktop\VisionCare EMR.lnk"

echo Creating Desktop Shortcut...

powershell -Command "$s=(New-Object -COM WScript.Shell).CreateShortcut('%DESKTOP_PATH%');$s.TargetPath='wscript.exe';$s.Arguments='\"%SCRIPT_PATH%\"';$s.WindowStyle=1;$s.Description='Start VisionCare EMR';$s.WorkingDirectory='%~dp0';$s.Save()"

echo.
echo ======================================================
echo SUCCESS: VisionCare EMR Desktop Icon Created!
echo ======================================================
echo You can now close this window. 
echo Double-click the 'VisionCare EMR' icon on your desktop 
echo to start the system silently.
echo ======================================================
pause
