' ============================================================
' LunaEyeHospitalEMR - Silent Background Server Launcher
' Runs the Node.js backend with ZERO visible windows.
' Executed by wscript.exe on startup, which has no CMD window.
' ============================================================

Dim WshShell, FSO, strServerPath, strNodeCmd, objExec, strOutput

Set WshShell = CreateObject("WScript.Shell")
Set FSO = CreateObject("Scripting.FileSystemObject")

' Absolute path to the server directory
strServerPath = "C:\Users\HP\Documents\Luna Eyes Hospital\server"

' --- Guard: Check if already running on port 80 ---
Set objExec = WshShell.Exec("cmd /c netstat -ano | findstr :80")
strOutput = objExec.StdOut.ReadAll
Set objExec = Nothing

If InStr(strOutput, "LISTENING") > 0 Then
    ' Server already running, nothing to do. Exit silently.
    WScript.Quit 0
End If

' --- Guard: Verify server directory exists ---
If Not FSO.FolderExists(strServerPath) Then
    WScript.Quit 1
End If

' --- Launch server silently ---
' WshShell.Run with window style 0 = hidden, False = don't wait
' We use "node index.js" directly instead of "npm start" to avoid
' the npm process creating its own visible console window.
strNodeCmd = "node """ & strServerPath & "\index.js"""
WshShell.Run strNodeCmd, 0, False

' Cleanup
Set WshShell = Nothing
Set FSO = Nothing
WScript.Quit 0
