' ============================================================
' VisionCare EMR — Silent Background Server Launcher  (v7 — wscript-safe)
' Starts the server only (no browser). Used by the shortcut.
' ============================================================

Set WshShell = CreateObject("WScript.Shell")
Set FSO      = CreateObject("Scripting.FileSystemObject")

Dim strRootPath, strExePath, strRelease
strRootPath = FSO.GetParentFolderName(WScript.ScriptFullName)
strRelease  = strRootPath & "\packaged-release"
strExePath  = strRelease & "\VisionCare-EMR.exe"

' ── Guard: Verify executable exists ─────────────────────────────────
If Not FSO.FileExists(strExePath) Then
    WScript.Quit 1
End If

' ── Helper: detect admin rights ─────────────────────────────────────
Function IsAdmin()
    Dim tmpFile, retCode
    tmpFile = WshShell.ExpandEnvironmentStrings("%TEMP%") & "\vc_admin_check_srv.txt"
    ' net session returns 0 if admin, non-zero if not
    retCode = WshShell.Run("cmd /c net session > """ & tmpFile & """ 2>&1", 0, True)
    IsAdmin = (retCode = 0)
    FSO.DeleteFile tmpFile, True
End Function

' ── Helper: check if a LOCAL port is in LISTEN state ────────────────
Function IsPortListening(portNum)
    Dim tmpFile, psCmd, cmdLine, retCode
    tmpFile = WshShell.ExpandEnvironmentStrings("%TEMP%") & "\vc_port_check_srv.txt"

    psCmd = "$r=Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue" & _
            "|Where-Object{$_.LocalPort -eq " & portNum & "};" & _
            "if($r){'LISTENING'|Out-File -FilePath '" & tmpFile & "' -Encoding ASCII}" & _
            "else{'FREE'|Out-File -FilePath '" & tmpFile & "' -Encoding ASCII}"

    cmdLine = "cmd /c powershell -NoProfile -NonInteractive -Command """ & psCmd & """"

    WshShell.Run cmdLine, 0, True   ' 0=hidden, True=wait for completion

    IsPortListening = False
    If FSO.FileExists(tmpFile) Then
        Dim oStream, contents
        Set oStream = FSO.OpenTextFile(tmpFile, 1)
        contents = Trim(oStream.ReadAll())
        oStream.Close
        Set oStream = Nothing
        FSO.DeleteFile tmpFile, True
        
        contents = Replace(Replace(contents, vbCr, ""), vbLf, "")
        IsPortListening = (contents = "LISTENING")
    End If
End Function

' ── Helper: find first free port starting from startPort ────────────
Function FindFreePort(startPort)
    Dim port
    port = startPort
    Do While IsPortListening(CStr(port))
        port = port + 1
    Loop
    FindFreePort = CStr(port)
End Function

' ── Resolve Port ─────────────────────────────────────────────────────
Dim strPort
If IsAdmin() Then
    If Not IsPortListening("80") Then
        strPort = "80"
    Else
        strPort = FindFreePort(3200)
    End If
Else
    strPort = FindFreePort(3200)
End If

' ── If already running on the resolved port, exit silently ──────────
If IsPortListening(strPort) Then
    WScript.Quit 0
End If

' ── Launch server process as a detached WMI process ─────────────────────────────
' This prevents the child process from being terminated when the VBScript host exits.
' We use cmd.exe /c to set the PORT environment variable and launch the server.
' We set ShowWindow = 0 to run it completely hidden.
Dim objWMIService, objStartup, objConfig, objProcess, intReturn, intProcessID
Set objWMIService = GetObject("winmgmts:\\.\root\cimv2")
Set objStartup = objWMIService.Get("Win32_ProcessStartup")
Set objConfig = objStartup.SpawnInstance_
objConfig.ShowWindow = 0

Set objProcess = objWMIService.Get("Win32_Process")
intReturn = objProcess.Create("cmd.exe /c ""set PORT=" & strPort & " && VisionCare-EMR.exe""", strRelease, objConfig, intProcessID)

' ── Poll until the port is LISTENING (max 40 s, every 500 ms) ───────
Dim i, bReady
bReady = False
For i = 1 To 80
    WScript.Sleep 500
    If IsPortListening(strPort) Then
        bReady = True
        Exit For
    End If
Next

If Not bReady Then
    WScript.Quit 1
End If

Set WshShell = Nothing
Set FSO      = Nothing
WScript.Quit 0
