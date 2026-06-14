Set WshShell = CreateObject("WScript.Shell")

' Kill the standalone VisionCare-EMR.exe process directly
WshShell.Run "cmd /c taskkill /f /im VisionCare-EMR.exe", 0, True

' Show confirmation popup (4 seconds timeout)
WshShell.Popup "VisionCare EMR has been stopped successfully.", 4, "System Status", 64

Set WshShell = Nothing
