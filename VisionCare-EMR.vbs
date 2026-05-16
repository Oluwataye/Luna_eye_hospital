Set WshShell = CreateObject("WScript.Shell")
Set FSO = CreateObject("Scripting.FileSystemObject")

' Get the absolute path of the directory where this script is located
strPath = FSO.GetParentFolderName(WScript.ScriptFullName)

' 1. Start the Backend Server Invisibly
' The '0' parameter hides the window
' The 'False' parameter tells the script to continue without waiting for the command to finish
WshShell.Run "cmd /c cd /d """ & strPath & "\server"" && node index.js", 0, False

' 2. Wait for the server to initialize (3 seconds)
WScript.Sleep 3000

' 3. Open the browser directly to the application
' It will use the default browser
WshShell.Run "http://localhost:3200", 9, False

Set WshShell = Nothing
Set FSO = Nothing
