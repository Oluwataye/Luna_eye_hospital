CONCURRENT OPERATION SETUP — PHARMCARE PRO & VISIONCARE EMR
============================================================

PHARMCARE PRO
  Backend Port:   3100
  Frontend Port:  3100 (Static assets served by backend)
  Start Command:  start-pharmcare.bat (Windows) / start-pharmcare.sh (Mac/Linux)
  Stop Command:   stop-pharmcare.bat / stop-pharmcare.sh
  Access URL:     http://localhost:3100
  Config Files Modified:
    - .env: Updated PORT to 3100 and VITE_API_URL to localhost:3100.
    - START_PHARMCARE.bat: Updated startup checks and browser redirection.
    - server/.env: Updated internal listener PORT to 3100.
  Backup Files Created:
    - .env.backup
    - START_PHARMCARE.bat.backup
    - server/.env.backup

VISIONCARE EMR (LUNA EYE HOSPITAL)
  Backend Port:   3200
  Frontend Port:  3200 (Static assets served by backend)
  Start Command:  start-visioncare.bat (Windows) / start-visioncare.sh (Mac/Linux)
  Stop Command:   stop-visioncare.bat / stop-visioncare.sh
  Access URL:     http://localhost:3200
  Config Files Modified:
    - server/.env: Updated PORT to 3200.
    - StartVisionCareEMR.vbs: Updated port monitoring and launch URL.
    - VisionCare-EMR.vbs: Updated shortcut launch URL.
  Backup Files Created:
    - server/.env.backup
    - StartVisionCareEMR.vbs.backup
    - VisionCare-EMR.vbs.backup

COMBINED LAUNCHER
  Start Both:     start-both-apps.bat / start-both-apps.sh
  Stop Both:      stop-both-apps.bat / stop-both-apps.sh

TO RESTORE ORIGINAL CONFIGURATION:
  Replace each modified config file with its .backup copy.
  All backup files are in the same directory as the originals.

Configured by: Antigravity AI
Date: 2026-05-16
