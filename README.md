# 🏥 VisionCare EMR — Ultimate Setup & Networking Guide
### Luna Eye Hospital • Complete Offline Hospital System
> **Written for Everyone!** Whether you are 15 years old, a nurse, a clinic manager, or a tech beginner, this guide will walk you through setting up VisionCare EMR step-by-step. Zero coding experience needed!

---

## 🎮 How This Works (Imagine a Multiplayer Game!)

Think of VisionCare EMR just like hosting a **LAN Minecraft world** or a **multiplayer game** with your friends:

| Hospital Part | Gaming Analogy | What It Actually Does |
|---|---|---|
| **The Server (Main PC)** | **The Game Host** | The main desktop in the hospital that stays on. It holds the hospital records, patient database, and AI voice system. |
| **The Clients (Other PCs)** | **The Players Joining** | The laptops and computers at the Reception, Consultation room, Pharmacy, and Lab. They just open their web browser (Chrome or Edge) to join! |
| **The Local Network (LAN)** | **The Shared Wi-Fi Room** | Your clinic's Wi-Fi router or office cables. No internet data or airtime needed! If the internet cuts off, the hospital never stops running. |

```
                       ┌──────────────────────────────────────────────┐
                       │   🏥 SERVER COMPUTER (Main Station / IT)    │
                       │   Runs VisionCare-EMR + Faster-Whisper AI    │
                       │   IP Address: 192.168.1.50                   │
                       └──────────────────────┬───────────────────────┘
                                              │
                      ┌───────────────────────┴───────────────────────┐
                      │    📡 CLINIC WI-FI ROUTER / SWITCH (LAN)      │
                      │    (No Internet or Data Subscription Needed)  │
                      └───────┬───────────────┬───────────────┬───────┘
                              │               │               │
                              ▼               ▼               ▼
                       ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
                       │  👩‍💼 Reception│ │  🩺 Doctor  │ │ 💊 Pharmacy │
                       │   Browser:  │ │   Browser:  │ │   Browser:  │
                       │192.168.1.50 │ │192.168.1.50 │ │192.168.1.50 │
                       └─────────────┘ └─────────────┘ └─────────────┘
```

---

## 🚦 Pick Your Setup Method

Choose the path that fits you best:
- **Option 1 (Easiest — Standalone Executable)**: Best for hospital staff! No Node.js installation needed. Just launch the `.exe` or desktop shortcut.
- **Option 2 (Developer / Source Code)**: Best if you want to inspect, code, or modify the React & TypeScript files.

---

## ⚡ Option 1: Super Easy Setup (Pre-Packaged Standalone)
*Recommended for Hospital Staff and Daily Clinic Operations*

You don't need to install programming languages or tools. Everything is already packed into a single portable application!

### Step 1: Place the Hospital Folder on the Main Computer
1. Place the `Luna Eyes Hospital` folder onto your main computer's drive (for example: `C:\Users\HP\Documents\Luna Eyes Hospital`).
2. Make sure the database file `luna_eye_hospital.db` is present inside the folder.

### Step 2: Double-Click the Launcher
Inside the folder, you will see a shortcut file:
👉 **`start-visioncare-silent.vbs - Shortcut`** (or `start-visioncare-silent.vbs`)

1. **Double-click it!**
2. The server will silently wake up in the background (no scary black command boxes will clutter your screen).
3. Within 3 seconds, your default web browser (Chrome or Edge) will pop open automatically!
4. You will see the **VisionCare EMR Login Screen**.

> [!TIP]
> **Pro Tip (Port 80 Access)**: If you right-click `start-visioncare-silent.vbs` and choose **"Run as administrator"**, it will bind to Windows Port 80. That means you can visit `http://lunaeyehospital/` or `http://localhost/` directly without needing any port numbers!

### Step 3: Log In
Use the default administrator credentials:
- **Username**: `admin`
- **Password**: `admin123` *(or `password` if using an earlier test backup)*

---

## 💻 Option 2: Developer Setup (From Source Code)
*Recommended if you want to build or modify features*

### Step 1: Install Node.js
1. Go to [https://nodejs.org/](https://nodejs.org/) on your browser.
2. Download the version marked **LTS (Long Term Support)**.
3. Run the installer and click **Next ➔ Next ➔ Install ➔ Finish**.
4. Restart your computer once installed.

### Step 2: Install Dependencies
Open PowerShell or Command Prompt inside the project folder:
```powershell
# 1. Install frontend packages
npm install

# 2. Install server packages
cd server
npm install
cd ..
```

### Step 3: Run the Development Server
```powershell
# In one terminal window, start the Node backend:
cd server
npm run dev

# In a second terminal window, start the React frontend:
npm run dev
```

---

## 🌐 Stage 3: Connecting Other Computers (LAN Setup)

Now comes the fun part! Let's connect the Receptionist's laptop, the Doctor's desktop, and the Pharmacist's tablet so they can all share patient records in real-time.

```
       Main Server PC                       Doctor / Reception Laptop
  ┌─────────────────────┐                   ┌─────────────────────┐
  │  IP: 192.168.1.50   │ ════ (Wi-Fi) ════ │  Opens Chrome:      │
  │  VisionCare Server  │                   │  192.168.1.50:3200  │
  └─────────────────────┘                   └─────────────────────┘
```

### Step 1: Connect to the Exact Same Wi-Fi Router
Every computer in the clinic must be connected to the **same router** (either through the same Wi-Fi name or by Ethernet cables plugged into the same router box).
> ⚠️ **Common Trap**: If the Main PC is connected to `Clinic_Office_WiFi` and the Doctor is connected to a mobile phone hotspot, they cannot talk to each other! Both must be on `Clinic_Office_WiFi`.

---

### Step 2: Find the Main Computer's "Address" (IPv4 Address)
Think of this like finding the street address of your house so your friends can visit:

1. Go to the **Main Computer (Server)**.
2. Press the <kbd>Windows Key</kbd> on your keyboard, type **`cmd`**, and press <kbd>Enter</kbd>.
3. In the black window that opens, type:
   ```cmd
   ipconfig
   ```
4. Press <kbd>Enter</kbd>.
5. Look down the list for the adapter you are using (either *Wireless LAN adapter Wi-Fi* or *Ethernet adapter*).
6. Find the line that says **`IPv4 Address`**.
7. It will look something like this:
   ```text
   IPv4 Address. . . . . . . . . . . : 192.168.1.50
   ```
8. **Write this number down!** (In this example, it is `192.168.1.50`).

---

### Step 3: Tell Windows Firewall to Let Other Computers In
Windows has a built-in security "bouncer" called the Firewall. We need to tell the bouncer to let computers on your clinic Wi-Fi talk to VisionCare:

#### Method A: The Fast 10-Second Command (Run as Administrator)
1. On the **Main Server Computer**, click Start, type **PowerShell**, right-click it, and select **"Run as administrator"**.
2. Copy and paste this single command and press <kbd>Enter</kbd>:
   ```powershell
   netsh advfirewall firewall add rule name="VisionCare EMR Web" dir=in action=allow protocol=TCP localport=80,3200,3201,3202,8765
   ```
3. You will see `Ok.` printed. You are done!

#### Method B: The Click-Through Menu Way
1. Open the Windows Start menu, type **Firewall**, and click **Windows Defender Firewall**.
2. On the left side, click **Advanced settings**.
3. Click **Inbound Rules** on the left ➔ click **New Rule...** on the right.
4. Select **Port** ➔ click **Next**.
5. Select **TCP**, and in *Specific local ports*, type: `80, 3200, 8765` ➔ click **Next**.
6. Select **Allow the connection** ➔ click **Next**.
7. Check all boxes (*Domain*, *Private*, *Public*) ➔ click **Next**.
8. Name it `VisionCare EMR` and click **Finish**.

---

### Step 4: Open the App from Any Other Computer or Tablet!
Now walk over to any Doctor, Nurse, or Reception computer:

1. Open **Google Chrome**, **Microsoft Edge**, or **Safari** (even works on an iPad or Android tablet!).
2. In the top address bar (where you normally type `google.com`), type the Main PC's IP address followed by the port:
   ```text
   http://192.168.1.50:3200/
   ```
   *(Replace `192.168.1.50` with the actual IP address you wrote down in Step 2!)*
   *(If the main PC was started as Administrator on Port 80, you can just type `http://192.168.1.50/`)*
3. Press <kbd>Enter</kbd>!
4. 🎉 **Boom!** The VisionCare login screen will load instantly. Multiple staff members can now log in and work simultaneously!

---

### Step 5: (Bonus Trick) Use a Friendly Name Like `http://lunaeyehospital/`
Instead of forcing doctors to remember numbers like `192.168.1.50:3200`, you can give it a friendly name!

#### On Any Windows Workstation:
1. Open the Windows Start menu, search for **Notepad**.
2. **Right-click Notepad** and choose **"Run as administrator"** (click *Yes* if asked).
3. In Notepad, click **File ➔ Open**.
4. In the bottom-right corner, change the dropdown from `Text Documents (*.txt)` to **`All Files (*.*)`**.
5. Paste this path into the File Name box and hit Open:
   ```text
   C:\Windows\System32\drivers\etc\hosts
   ```
6. Scroll down to the very bottom, add a new line, and type your server's IP followed by `lunaeyehospital`:
   ```text
   192.168.1.50       lunaeyehospital
   ```
7. Press <kbd>Ctrl</kbd> + <kbd>S</kbd> to save and close Notepad.
8. Now, on that computer, anyone can simply type:
   👉 **`http://lunaeyehospital:3200/`** (or `http://lunaeyehospital/`)!

---

## 🎙️ Stage 4: Using the AI Voice & Dictation System

VisionCare EMR has a built-in ophthalmic AI speech-to-text scribe powered by **Faster-Whisper**. Doctors can dictate consultation notes instead of typing everything by hand!

### 1. How It Works
- Runs **100% locally on the main computer** using CPU or an NVIDIA GPU. Zero audio is ever sent to the internet or outside the clinic.
- High-speed WebSocket streaming provides immediate transcription.

### 2. The Push-to-Talk Hotkey
Doctors can dictate into whichever clinical field they are currently focused on without touching the mouse!
1. Click into any clinical text box (e.g. *History of Present Illness*, *Assessment*, *Treatment Plan*).
2. Press the global shortcut:
   👉 <kbd>Ctrl</kbd> + <kbd>Space</kbd> (or <kbd>F8</kbd>)
3. A pulsing **Recording Badge** will appear. Speak naturally:
   > *"Patient reports bilateral ocular itching and burning sensation for 3 days. SLE reveals mild conjunctival injection OD."*
4. Press <kbd>Ctrl</kbd> + <kbd>Space</kbd> again to stop.
5. The transcribed text will appear directly in the box! An **Undo / Review** banner is provided if you want to revert or edit.

### 3. Customizing the Hotkey & AI Settings
1. Log in as an Administrator.
2. Go to **Settings ➔ AI Voice & Dictation**.
3. Here you can:
   - Change the hotkey to <kbd>F8</kbd>, <kbd>Alt</kbd>+<kbd>D</kbd>, or any key combination.
   - Switch AI models (`tiny.en` for older computers, `base.en` for balanced accuracy, `small.en` for maximum precision).
   - Toggle optional Ollama local LLM formatting.

---

## 🖨️ Stage 5: Setting Up Silent Thermal Receipt Printing (80mm & 58mm ESC/POS)

In a busy eye clinic, waiting for the browser's slow Windows print popup wastes cashier and patient time. VisionCare EMR includes **direct, silent hardware printing** using industry-standard **ESC/POS** commands. Receipts print in **under 1 second** the moment a payment is confirmed!

### 1. Supported Connection Types
1. **Network (LAN / Wi-Fi) — Recommended for Speed**:
   - Plug your thermal receipt printer (e.g. Epson TM-T20, Xprinter, Rongta, Zywell) into the router using an Ethernet cable, or connect it to clinic Wi-Fi.
   - The printer connects via raw TCP on **Port 9100**. Any computer on the hospital network can print to it instantly!
2. **USB (WebUSB Direct)**:
   - Plug the thermal printer into the cashier's computer using a USB cable.
   - In Chrome or Edge, pair it once using the **"Pair USB Device"** button.
3. **Browser Fallback**:
   - If the printer runs out of paper, is turned off, or disconnected, the system automatically falls back to the standard browser print dialog so transactions are never interrupted.

### 2. How to Configure Your Printer
1. Go to **Settings ➔ Thermal Receipt Printer** (or click the **"Thermal Setup"** button in the top-right of the **Billing** screen).
2. Choose your connection mode:
   - **Network TCP**: Enter the printer's local IP address (e.g. `192.168.1.200`) and port (`9100`).
   - **WebUSB Direct**: Click *Pair New USB Printer* and select your device from the browser prompt.
3. Select your paper roll width:
   - **80mm (Standard)**: 48 columns per line (default for hospital desks).
   - **58mm (Compact)**: 32 columns per line (for compact portable units).
4. Turn on **"Auto-Print on Payment"** if you want receipts to shoot out automatically the instant "Process Payment" is clicked.
5. Click **"Test Print Slip"** to test! A receipt slip with hospital header and cut command will immediately print out.
6. Click **"Save Configuration"**. Your settings are saved on that computer.

---

## 📦 Stage 6: Updating and Building New Releases

If a developer makes changes to the app and you want to update the standalone package:

### 1. The One-Command Rebuild
Run this command from the main folder:
```bash
npm run release:standalone
```
This automatically:
- Closes any open `.exe` so Windows doesn't lock it.
- Rebuilds the frontend and server.
- Generates a fresh `packaged-release\VisionCare-EMR.exe`.
- Syncs all web assets and configurations.

### 2. Publishing an Official Station Release
When you are ready to publish a new hospital version:
```bash
npm run release:tag 1.2.0
```
This automatically tags the version, pushes to GitHub, and triggers **GitHub Actions** in the cloud to package `VisionCare-EMR-Standalone-Windows-x64.zip` ready for download!

---

## 💾 Stage 7: Backing Up Hospital Records (Saving Your Progress)

Because VisionCare EMR uses a reliable local SQLite database, backing up your clinic records is as simple as copying a file!

### Daily Backup Method (Recommended):
1. Plug a USB flash drive or external hard drive into the main computer.
2. Inside your `Luna Eyes Hospital` folder, locate the file named:
   👉 **`luna_eye_hospital.db`** (or in `packaged-release\luna_eye_hospital.db`)
3. Copy this file onto your USB drive and label it with today's date (e.g., `backup-2026-10-13.db`).
4. That's it! If the main computer ever crashes, you can restore all patient records in 10 seconds simply by copying this file back.

---

## 🛠️ Stage 8: Troubleshooting (FAQ)

### ❓ "This site can't be reached" when connecting from another computer
1. **Check the Wi-Fi**: Are both computers connected to the exact same Wi-Fi network? (Not one on phone hotspot and one on router).
2. **Did the IP address change?** Some office Wi-Fi routers change a computer's IP address when restarted. Go to the main computer, run `ipconfig` in Command Prompt again, and check if the number changed.
3. **Check the Firewall**: Make sure you ran the firewall command in Stage 3, Step 3.

### ❓ "The standalone executable won't start"
1. Another instance might already be running in the background.
2. Double-click **`StopVisionCareEMR.vbs`** (or run `taskkill /f /im VisionCare-EMR.exe` in CMD).
3. Try starting again with `start-visioncare-silent.vbs`.

### ❓ "The microphone says Offline or Not Connected"
1. The Faster-Whisper background service boots on port 8765. Give it 5-10 seconds upon first launch to warm up the model.
2. Ensure Python 3.11 is installed if running from developer source mode. In standalone mode, the local microservice starts automatically.

---

## 📞 Support & Hospital Credits

- **Hospital**: Luna Eye Hospital, Minna, Niger State
- **Developer**: Oluwataye & Hospital IT Team
- **License**: Proprietary Hospital Healthcare Software
- **Need help?** Check the internal `DEVELOPER_NOTES.md` file or contact your IT administration desk.
