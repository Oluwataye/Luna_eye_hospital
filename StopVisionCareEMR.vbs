Set WshShell = CreateObject("WScript.Shell")

' 1. Find the Process ID (PID) listening on Port 3200 and kill it
' This specifically targets our application server without affecting other node processes
WshShell.Run "cmd /c for /f ""tokens=5"" %a in ('netstat -ano ^| findstr :3200 ^| findstr LISTENING') do taskkill /f /pid %a", 0, True

' 2. Show a clean confirmation message to the staff
' Parameter 5 means 5 seconds timeout
' Parameter 64 is the Information Icon
WshShell.Popup "VisionCare EMR has been stopped successfully.", 5, "System Status", 64

Set WshShell = Nothing
