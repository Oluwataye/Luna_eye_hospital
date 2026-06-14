' ============================================================
' VisionCare EMR — Silent Launcher  (v7 — wscript-safe, fully reliable)
'
' v6 BUGS FIXED:
'   1. WshShell.Exec() with piped I/O hangs silently under wscript.exe (GUI mode).
'      wscript.exe is used when double-clicking a .vbs file. It does not have a
'      console stdin/stdout, so ReadAll() on the Exec pipe blocks forever.
'      FIX: Use WshShell.Run(..., True) with a temp output file instead of Exec.
'
'   2. WshShell.Run("""" & batPath & """", 0, False) cannot auto-invoke a .bat file
'      without cmd.exe. Must use: WshShell.Run "cmd /c """ & batPath & """", 0, False.
'
' DESIGN:
'   - IsPortListening writes PS output to a temp file, then reads it back.
'   - Server launch writes a small .bat to %TEMP%, invoked via cmd /c.
'   - Both temp files are self-cleaning.
' ============================================================

Set WshShell = CreateObject("WScript.Shell")
Set FSO      = CreateObject("Scripting.FileSystemObject")

' ── Absolute project root ────────────────────────────────────────────
Const strRoot = "C:\Users\HP\Documents\Luna Eyes Hospital"

Dim strRelease, strExe
strRelease = strRoot & "\packaged-release"
strExe     = strRelease & "\VisionCare-EMR.exe"

' ── Guard: verify executable exists ─────────────────────────────────
If Not FSO.FileExists(strExe) Then
    WshShell.Popup "VisionCare-EMR.exe not found:" & vbCrLf & strExe, _
                   0, "Launch Error", 16
    WScript.Quit 1
End If

' ── Helper: detect admin rights ─────────────────────────────────────
Function IsAdmin()
    Dim tmpFile, retCode
    tmpFile = WshShell.ExpandEnvironmentStrings("%TEMP%") & "\vc_admin_check.txt"
    ' net session returns 0 if admin, non-zero if not
    retCode = WshShell.Run("cmd /c net session > """ & tmpFile & """ 2>&1", 0, True)
    IsAdmin = (retCode = 0)
    FSO.DeleteFile tmpFile, True
End Function

' ── Helper: check if a LOCAL port is in LISTEN state ────────────────
' Runs PowerShell via cmd, writing exit code to a temp file.
' Safe for both wscript.exe (GUI/double-click) and cscript.exe (console).
Function IsPortListening(portNum)
    Dim tmpFile, psCmd, cmdLine, retCode
    tmpFile = WshShell.ExpandEnvironmentStrings("%TEMP%") & "\vc_port_check.txt"

    ' PowerShell writes "LISTENING" or "FREE" directly to a temp file.
    ' This avoids the %ERRORLEVEL% cmd-expansion issue (VBScript expands
    ' %VAR% in strings before passing to cmd, so echo %ERRORLEVEL% = "0"
    ' literally, not the actual exit code).
    psCmd = "$r=Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue" & _
            "|Where-Object{$_.LocalPort -eq " & portNum & "};" & _
            "if($r){'LISTENING'|Out-File -FilePath '" & tmpFile & "' -Encoding ASCII}" & _
            "else{'FREE'|Out-File -FilePath '" & tmpFile & "' -Encoding ASCII}"

    cmdLine = "cmd /c powershell -NoProfile -NonInteractive -Command """ & psCmd & """"

    WshShell.Run cmdLine, 0, True   ' 0=hidden, True=wait for completion

    ' Read back the result file
    IsPortListening = False
    If FSO.FileExists(tmpFile) Then
        Dim oStream, contents
        Set oStream = FSO.OpenTextFile(tmpFile, 1)
        contents = Trim(oStream.ReadAll())
        oStream.Close
        Set oStream = Nothing
        FSO.DeleteFile tmpFile, True
        ' VBScript Trim only removes space character (Chr(32)), not vbCrLf.
        ' We must explicitly strip vbCr and vbLf to get a clean comparison.
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

' ── Resolve Port and URL ────────────────────────────────────────────
Dim strPort, strURL
If IsAdmin() Then
    If Not IsPortListening("80") Then
        strPort = "80"
        strURL  = "http://lunaeyehospital/"
    Else
        strPort = FindFreePort(3200)
        strURL  = "http://localhost:" & strPort & "/"
    End If
Else
    strPort = FindFreePort(3200)
    strURL  = "http://localhost:" & strPort & "/"
End If

' ── If already running on the resolved port, just open the browser ──
If IsPortListening(strPort) Then
    WshShell.Run strURL, 9, False
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
    WshShell.Popup _
        "VisionCare EMR did not start within 40 seconds on port " & strPort & "." & vbCrLf & vbCrLf & _
        "Possible causes:" & vbCrLf & _
        "  • Port " & strPort & " is blocked by firewall or antivirus" & vbCrLf & _
        "  • The packaged-release folder is incomplete" & vbCrLf & _
        "  • Run as Administrator to use port 80", _
        0, "VisionCare EMR — Startup Timeout", 48
    WScript.Quit 1
End If

' 1 second for routes to settle
WScript.Sleep 1000

' ── Server is up — open the browser ─────────────────────────────────
WshShell.Run strURL, 9, False

Set WshShell = Nothing
Set FSO      = Nothing
