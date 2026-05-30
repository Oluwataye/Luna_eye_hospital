# 🏥 VisionCare EMR - Luna Eye Hospital (Simple Guide)

Hi there! Welcome to the **VisionCare EMR**. This is the "brain" of Luna Eye Hospital. It helps everyone—from the front desk to the doctors—work together to take care of patients.

Think of this system as a **digital notebook** that everyone in the hospital can write in and read from at the same time!

---

## 🚀 How to Start the System
You don't need to be a computer genius to start this! Just follow these steps:

1.  **Find the Icon**: Look for the file named `VisionCare-EMR.vbs` (it might have a little scroll icon).
2.  **Double-Click it**: That's it! 
3.  **Wait 3 Seconds**: The system starts quietly in the background. 
4.  **It Opens Automatically**: Your web browser (Chrome or Edge) will pop up and show you the login screen.

> [!TIP]
> If it doesn't open, just wait a few more seconds and refresh the page.

---

## 🔄 How the Hospital Workflow Works
The system follows the patient as they move through the hospital:

1.  **Front Desk (Receptionist)**: Registers the patient and gives them a "File Number." They then "Check-In" the patient to the **Triage** or **Consultation** queue.
2.  **Nursing Station (Nurse)**: Sees the patient in the "Triage" list. They record things like Blood Pressure and Eye Vision (Visual Acuity).
3.  **The Doctor (Consultant)**: Sees the patient in their "Consultation" list. They can see what the nurse wrote, check the patient's eyes, and write a treatment plan.
4.  **Cashier (Billing)**: When the doctor is done, the bill is ready! The cashier takes the payment and prints a receipt.

---

## 🌐 Setting Up the Network (Connecting Other Computers)
This is the most important part! You probably want the doctors and nurses to use the system from their own desks. Here is how to do that:

### Step 1: Find the "Parent" Computer's Address (IP)
The computer where you first started the system is the **Parent (Host)**. To let other computers talk to it, you need its "Address" (called an IP Address).
*   On the Parent computer, press the **Windows Key + R**, type `cmd`, and press Enter.
*   In the black box, type `ipconfig` and press Enter.
*   Look for a line that says **IPv4 Address**. It usually looks like `192.168.1.15`. **Write this down!**

### Step 2: Tell the Firewall to be Friendly
Windows sometimes blocks other computers from talking to each other.
1.  Search for "Windows Firewall" in the Start menu.
2.  Click **"Allow an app or feature through Windows Defender Firewall."**
3.  Click **"Change Settings."**
4.  Look for `node.exe` or `Node.js JavaScript Runtime`. Make sure both **Private** and **Public** boxes are checked.
5.  If you don't see it, click "Allow another app" and find the system folder.

### Step 3: Connect from Other Computers
*   Go to any other computer in the hospital.
*   Open Google Chrome or Edge.
*   In the top bar (where you type websites), type the Parent computer's address followed by `:3200`.
*   **Example**: `http://192.168.1.15:3200`
*   Press Enter, and the hospital system will appear!

---

## 🏷️ How to type "http://lunaeyehospital" instead of numbers
Typing numbers like `192.168.1.15:3200` can be hard to remember. If you want to type **`http://lunaeyehospital:3200`** instead, you can easily set it up by following these simple steps:

> [!NOTE]
> You will need to do this on **each computer** in the hospital that needs to use the friendly name.

### Step A: Open the computer's secret "Address Book"
1. Click the Windows **Start Button** (usually in the bottom-left corner of your screen).
2. Type **Notepad** in the search bar.
3. **Right-click** on the Notepad icon and click **"Run as administrator"**. Click "Yes" if a pop-up asks for permission.
4. In Notepad, click **File** (top left) and click **Open...**
5. At the bottom of the window that pops up, change the setting that says **"Text Documents (*.txt)"** to **"All Files (*.*)"**.
6. Copy and paste this exact line into the "File name" box at the bottom and click **Open**:
   `C:\Windows\System32\drivers\etc\hosts`

### Step B: Add the hospital website name
1. Scroll all the way to the very bottom of the document.
2. Press Enter to start a new line, and type:
   ```text
   192.168.1.15       lunaeyehospital
   ```
   *(Important: Replace `192.168.1.15` with the **Parent computer's IP address** that you wrote down in Step 1. If you are doing this setup on the **Parent computer itself**, just type `127.0.0.1       lunaeyehospital` instead).*

### Step C: Save and you are done!
1. Click **File** and click **Save** (or press **Ctrl + S** on your keyboard). You can now close Notepad.
2. Open your web browser (Chrome or Edge) and type:
   `http://lunaeyehospital:3200`
3. Press Enter, and you are ready to log in!

---

## 🛠️ Troubleshooting (When things go wrong)

### "The page says 'Site cannot be reached'!"
*   **Check the Parent computer**: Is it turned on? Did someone close the system?
*   **Check the address**: Did you type the IP address correctly? Don't forget the `:3200` at the end!

### "Other computers can't connect, but the Parent computer works fine."
*   This is almost always the **Firewall**. Go back to the "Setting Up the Network" section and make sure `node.exe` is allowed.
*   Make sure all computers are on the **same Wi-Fi or Network**. If one is on "Guest Wi-Fi" and the other is on "Main Wi-Fi," they won't see each other.

### "I forgot my password!"
*   Ask the **Admin** to reset it for you in the "User Management" section of the system.

---

## 👨‍💻 Technical Stuff (For the IT Person)
*   **Port**: 3200
*   **Language**: JavaScript (Node.js & React)
*   **Database**: SQLite (Stored in `server/luna_eye_hospital.db`)
*   **Backup**: To back up the whole system, just copy the entire folder to a USB drive.

---
*Built with ❤️ for Luna Eye Hospital by T-Tech Solutions.*
