Set WshShell = CreateObject("WScript.Shell")
Set FSO = CreateObject("Scripting.FileSystemObject")

' Get the absolute path of the directory where this script is located
strPath = FSO.GetParentFolderName(WScript.ScriptFullName)
strDBPath = strPath & "\server\luna_eye_hospital.db"
strURL = "http://localhost:3200"

On Error Resume Next

' 1. Check if Node.js is installed
intNodeCheck = WshShell.Run("node -v", 0, True)
If Err.Number <> 0 Then
    WshShell.Popup "VisionCare EMR could not start. A required component (Node.js) is missing. Please contact T-Tech Solutions for support.", 0, "Startup Error", 16
    WScript.Quit
End If

' 2. Check if Database exists
If Not FSO.FileExists(strDBPath) Then
    WshShell.Popup "VisionCare EMR could not start. Database connection failed (File not found). Please contact your system administrator.", 0, "Database Error", 16
    WScript.Quit
End If

' 3. Check if the application is already running (Port 80)
Set objExec = WshShell.Exec("cmd /c netstat -ano | findstr :3200")
strOutput = objExec.StdOut.ReadAll

If InStr(strOutput, "LISTENING") > 0 Then
    ' Already running - Show friendly notice and open browser
    WshShell.Popup "VisionCare EMR is already running. Opening browser now...", 3, "Notice", 64
    LaunchBrowser()
Else
    ' 4. Start the Backend Server Invisibly
    ' We use 'cmd /c' to ensure the environment is correctly set up
    intResult = WshShell.Run("cmd /c cd /d """ & strPath & "\server"" && node index.js", 0, False)
    
    If intResult <> 0 Then
        WshShell.Popup "VisionCare EMR failed to launch. Please ensure the application folder hasn't been moved.", 0, "System Error", 16
        WScript.Quit
    End If

    ' 5. Wait for the server to initialize (3 seconds)
    WScript.Sleep 3000
    LaunchBrowser()
End If

' Function to safely launch the browser
Sub LaunchBrowser()
    Err.Clear
    intBrowserResult = WshShell.Run(strURL, 9, False)
    If Err.Number <> 0 Then
        WshShell.Popup "Please open your browser and go to " & strURL & " to access VisionCare EMR.", 0, "Browser Link", 64
    End If
End Sub

Set WshShell = Nothing
Set FSO = Nothing
