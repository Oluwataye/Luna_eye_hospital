# 🏥 VisionCare EMR - Deployment & Setup Guide
### Luna Eye Hospital • Offline Enterprise EMR

Welcome to **VisionCare EMR**! This guide is designed for absolute beginners. Even if you have zero tech knowledge and have never touched code before, you will be able to set up, run, and connect your entire hospital network by following these simple steps.

---

## 🗺️ How the System Works (The Big Picture)
Before we start, think of this app like a **digital notebook** for the hospital:
1. **The Parent Computer (Server)**: This is the main computer that holds the notebook (the database). It runs the server program in the background.
2. **The Child Computers (Clients)**: These are the computers at the Reception, Nurse Station, and Doctor's desk. They connect to the Parent computer through your hospital's local Wi-Fi or network cable.
3. **No Internet Needed**: Everything runs offline inside your hospital. If the internet goes down, your hospital system keeps working perfectly!

---

## 📥 Stage 1: Setting Up the Parent Computer
*You only need to do this on the main computer (the one that will stay turned on at all times).*

### Step 1: Install Node.js
The system runs on a utility helper called **Node.js**. Let's install it:
1. Open your web browser (Chrome or Edge) on the Parent computer.
2. Go to: **[https://nodejs.org/](https://nodejs.org/)**
3. Download the version marked **LTS (Long Term Support)**—this is the most stable version.
4. Open the downloaded file and click **Next -> Next -> Install -> Finish** (leave all checkboxes at their default settings).
5. Restart your computer so Windows registers the installation.

### Step 2: Extract the Project Folder
1. Move your `Luna Eyes Hospital` system folder to a safe location on your computer (for example: `C:\VisionCare-EMR`).
2. Make sure the database file named `luna_eye_hospital.db` is inside the `server` folder. (Path should look like: `C:\VisionCare-EMR\server\luna_eye_hospital.db`).

### Step 3: Run the One-Click Installer
We have created a helper script that installs everything for you:
1. Open your system folder (`C:\VisionCare-EMR`).
2. Double-click the file named **`INSTALL-VisionCare-EMR.bat`**.
3. A black window will pop up. It will check for Node.js, install the system components, build the web code, and place two shortcuts on your desktop.
4. **Wait patiently** until the window says *"INSTALLATION COMPLETE!"* and press any key to close it.

---

## 🚀 Stage 2: How to Start and Stop the App
You will now see two new icons on your desktop:

### 🟢 Starting the App:
1. Double-click the icon named **`VisionCare EMR`** on your desktop.
2. The server will launch silently in the background (no ugly command boxes will stay open).
3. Within 3 seconds, your web browser will automatically open to `http://localhost:3200` showing the login page.
4. **Default Login**:
   - **Username**: `admin`
   - **Password**: `password`

### 🔴 Stopping the App:
1. If you need to stop the server (for example, to back up the database or restart the computer), double-click the **`Stop VisionCare EMR`** icon on your desktop.
2. A small message box will pop up confirming that the system has successfully stopped.

---

## 🌐 Stage 3: Connecting Other Computers (LAN Setup)
To let doctors, nurses, and receptionists access the system from their own desks, follow these steps:

### Step 1: Ensure they are on the Same Wi-Fi / Router
All computers in the hospital must be connected to the **same Wi-Fi network** or connected to the **same network switch/router** via Ethernet cables. If one computer is on a guest Wi-Fi and another is on your private office Wi-Fi, they will not be able to talk to each other.

### Step 2: Find the Parent Computer's IP Address
Think of this like finding the Parent computer's phone number:
1. On the **Parent computer**, click the Start button, type `cmd`, and press Enter to open the Command Prompt.
2. Type **`ipconfig`** and press Enter.
3. Scroll down and look for a line called **`IPv4 Address`** (under your active Wi-Fi or Ethernet adapter).
4. It will look like a set of numbers separated by dots (e.g., **`192.168.1.15`**). Write this down!

### Step 3: Open the Windows Firewall Gates
Windows Defender Firewall will naturally block external computers from connecting to your server. Let's unblock it:
1. On the **Parent computer**, click the Windows Start button, type **Firewall**, and click **"Windows Defender Firewall"**.
2. On the left-hand side, click **"Allow an app or feature through Windows Defender Firewall"**.
3. Click the **"Change settings"** button at the top (requires administrator rights).
4. Look through the list for `node.exe` or `Node.js JavaScript Runtime`.
5. Make sure **both the "Private" and "Public" checkboxes** next to it are checked.
6. Click **OK** to save.

### Step 4: Open the App on Client Computers
Now go to any nurse's or doctor's computer:
1. Open Google Chrome or Edge.
2. In the address bar at the very top (where you usually type `google.com`), type the Parent computer's IP address followed by `:3200`.
   - **Example**: `http://192.168.1.15:3200`
3. Press Enter, and the login page will load!

---

## 🏷️ Stage 4: Customizing the Friendly Website Name
Instead of remembering numbers like `192.168.1.15:3200`, your colleagues can type **`http://lunaeyehospital:3200`**.

### Method A: Built-in Automatic LAN Name (Simplest)
This system has a built-in NetBIOS (NBNS) and DNS broadcaster that runs automatically.
1. Make sure the Parent computer is running the server.
2. On any other **Windows computer** on the same Wi-Fi, open your browser.
3. Type **`http://lunaeyehospital:3200`** and press Enter.
4. *Note: On some office networks, security settings on the router might block this automatic discovery. If it fails, use Method B below.*

### Method B: The Hosts File Fallback (Guaranteed to Work)
Do this on any computer where the friendly name isn't loading automatically:
1. Click the Windows Start menu, type **Notepad**.
2. **Right-click** the Notepad icon and choose **"Run as administrator"**. Click "Yes" when prompted.
3. In Notepad, click **File -> Open...**
4. In the bottom-right corner of the file picker window, change `"Text Documents (*.txt)"` to **`"All Files (*.*)"`**.
5. Copy and paste this exact path into the "File name" box and click Open:
   `C:\Windows\System32\drivers\etc\hosts`
6. Scroll to the very bottom of the text document. On a new line, type the Parent IP address followed by `lunaeyehospital` like this:
   ```text
   192.168.1.15       lunaeyehospital
   ```
   *(Be sure to replace `192.168.1.15` with the actual IP address of your Parent computer!)*
7. Click **File -> Save** (or press `Ctrl + S`). You can now close Notepad and open `http://lunaeyehospital:3200` in your browser.

---

## 🛠️ Stage 5: Troubleshooting (When things go wrong)

### ❓ "The page says 'This site can’t be reached'!"
*   **Is the server running?** Go to the Parent computer and double-click the `VisionCare EMR` desktop icon.
*   **Are you on the correct Wi-Fi?** Make sure the computer you are using is on the exact same Wi-Fi network as the Parent computer.
*   **Did the IP address change?** Router systems sometimes change a computer's IP address when restarted. Go to the Parent computer, run `ipconfig` again, and check if the numbers match what you typed.

### ❓ "The installer says 'Node.js is not installed' but I installed it!"
*   Windows needs to update its list of installed programs. Simply restart the Parent computer and run `INSTALL-VisionCare-EMR.bat` again.

### ❓ "I get a database connection error on startup!"
*   Check if the database file is placed correctly. Inside your `Luna Eyes Hospital` folder, go to the `server` folder. Make sure a file named `luna_eye_hospital.db` exists there.

### ❓ "I get an error saying 'Port 3200 is already in use'!"
*   This means another instance of the server is already running. Click the **`Stop VisionCare EMR`** desktop shortcut to close any hidden instances, then click **`VisionCare EMR`** to start clean.

### ❓ "How do I take a backup of our records?"
*   Since this is an offline SQLite database, backing up is incredibly easy! Simply stop the system using the `Stop VisionCare EMR` icon, insert a USB flash drive, and copy the entire `Luna Eyes Hospital` folder onto the USB drive.

---
*Built with ❤️ for Luna Eye Hospital by T-Tech Solutions.*

