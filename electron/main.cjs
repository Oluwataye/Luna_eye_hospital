// electron/main.cjs
const { app, BrowserWindow, Tray, Menu } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const net = require('net');
const http = require('http');
const fs = require('fs');

let mainWindow = null;
let splashWindow = null;
let tray = null;
let childProcess = null;
let isQuitting = false;
let selectedPort = null;

// Logger setup
const logDir = path.join(app.getPath('userData'), 'logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}
const logFile = path.join(logDir, 'server.log');
const logStream = fs.createWriteStream(logFile, { flags: 'a' });

function log(msg) {
  const time = new Date().toISOString();
  const line = `[${time}] [Electron-Main] ${msg}\n`;
  console.log(line.trim());
  logStream.write(line);
}

// Port finding helpers
function isPortFree(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => {
      resolve(false);
    });
    server.once('listening', () => {
      server.close(() => {
        resolve(true);
      });
    });
    server.listen(port);
  });
}

function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on('error', reject);
    server.listen(0, () => {
      const port = server.address().port;
      server.close(() => {
        resolve(port);
      });
    });
  });
}

async function resolvePort() {
  log('Resolving application port...');
  // Try port 80 first for direct local network access (lunaeyehospital)
  if (await isPortFree(80)) {
    log('Port 80 is free, selecting port 80.');
    return 80;
  }
  // Try port 3200
  if (await isPortFree(3200)) {
    log('Port 3200 is free, selecting port 3200.');
    return 3200;
  }
  // Fallback to random dynamic high port
  const freePort = await getFreePort();
  log(`Port 80/3200 in use, selecting dynamic port: ${freePort}`);
  return freePort;
}

// Poll status route
function pollServer(port, timeoutMs = 20000, intervalMs = 250) {
  const startTime = Date.now();
  return new Promise((resolve, reject) => {
    function check() {
      const req = http.get(`http://localhost:${port}/api/status`, (res) => {
        log(`Server responded to poll: status = ${res.statusCode}`);
        if (res.statusCode === 200 || res.statusCode === 401 || res.statusCode === 404) {
          resolve();
        } else {
          retry();
        }
      });
      req.on('error', (err) => {
        retry();
      });
      req.end();
    }

    function retry() {
      if (Date.now() - startTime > timeoutMs) {
        reject(new Error(`Server failed to start on port ${port} after ${timeoutMs}ms`));
      } else {
        setTimeout(check, intervalMs);
      }
    }

    check();
  });
}

// Start sidecar process
function startSidecar(port) {
  return new Promise((resolve, reject) => {
    const isPackaged = app.isPackaged;
    let sidecarPath;
    let sidecarCwd;

    if (isPackaged) {
      sidecarPath = path.join(process.resourcesPath, 'packaged-release', 'VisionCare-EMR.exe');
      sidecarCwd = path.join(process.resourcesPath, 'packaged-release');
    } else {
      sidecarPath = path.join(__dirname, '..', 'packaged-release', 'VisionCare-EMR.exe');
      sidecarCwd = path.join(__dirname, '..', 'packaged-release');
    }

    log(`Spawning sidecar at: ${sidecarPath}`);
    log(`Sidecar working directory: ${sidecarCwd}`);

    if (!fs.existsSync(sidecarPath)) {
      const errMsg = `Sidecar executable not found at: ${sidecarPath}`;
      log(errMsg);
      return reject(new Error(errMsg));
    }

    // Set custom env including PORT
    const env = { 
      ...process.env, 
      PORT: String(port),
      NODE_ENV: isPackaged ? 'production' : 'development'
    };

    childProcess = spawn(sidecarPath, [], {
      cwd: sidecarCwd,
      env: env,
      stdio: 'pipe'
    });

    childProcess.stdout.on('data', (data) => {
      const text = data.toString().trim();
      logStream.write(`[Sidecar-Out] ${text}\n`);
    });

    childProcess.stderr.on('data', (data) => {
      const text = data.toString().trim();
      logStream.write(`[Sidecar-Err] ${text}\n`);
      console.error(`[Sidecar-Err] ${text}`);
    });

    childProcess.on('error', (err) => {
      log(`Sidecar spawn error: ${err.message}`);
      reject(err);
    });

    childProcess.on('exit', (code, signal) => {
      log(`Sidecar process exited with code ${code} and signal ${signal}`);
      if (!isQuitting) {
        log('Sidecar exited unexpectedly. Quitting Electron app.');
        isQuitting = true;
        app.quit();
      }
    });

    resolve();
  });
}

function createSplashWindow() {
  splashWindow = new BrowserWindow({
    width: 450,
    height: 400,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    icon: path.join(__dirname, 'assets', 'icon.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  splashWindow.loadFile(path.join(__dirname, 'loading.html'));
  splashWindow.on('closed', () => {
    splashWindow = null;
  });
}

function createMainWindow(port) {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    show: false, // Show once contents are loaded
    icon: path.join(__dirname, 'assets', 'icon.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.cjs')
    }
  });

  // Load backend server root (serves compiled Vite React app)
  mainWindow.loadURL(`http://localhost:${port}`);

  mainWindow.once('ready-to-show', () => {
    if (splashWindow) {
      splashWindow.close();
    }
    mainWindow.show();
  });

  // Handle close to tray
  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function createTray() {
  const iconPath = path.join(__dirname, 'assets', 'icon.png');
  tray = new Tray(iconPath);
  const contextMenu = Menu.buildFromTemplate([
    { label: 'Open VisionCare EMR', click: () => { if (mainWindow) mainWindow.show(); } },
    { type: 'separator' },
    { label: 'Quit', click: () => {
        isQuitting = true;
        app.quit();
      }
    }
  ]);

  tray.setToolTip('VisionCare EMR — Luna Eye Hospital');
  tray.setContextMenu(contextMenu);

  tray.on('double-click', () => {
    if (mainWindow) mainWindow.show();
  });
}

// Prevent multiple instances
const additionalData = { myKey: 'luna-eyes-hospital-emr' };
const gotTheLock = app.requestSingleInstanceLock(additionalData);

if (!gotTheLock) {
  log('Another instance is already running. Exiting.');
  app.quit();
} else {
  app.on('second-instance', () => {
    // Someone tried to run a second instance, focus our window
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      if (!mainWindow.isVisible()) mainWindow.show();
      mainWindow.focus();
    }
  });

  // App initialization
  app.whenReady().then(async () => {
    log('Electron app is ready.');
    createSplashWindow();
    createTray();

    try {
      selectedPort = await resolvePort();
      await startSidecar(selectedPort);
      await pollServer(selectedPort);
      log('Server is online. Launching main window.');
      createMainWindow(selectedPort);
    } catch (err) {
      log(`Initialization failed: ${err.message}`);
      if (splashWindow) {
        splashWindow.close();
      }
      // Show simple native dialog
      const { dialog } = require('electron');
      dialog.showErrorBox(
        'Startup Error',
        `Failed to launch the backend server. Details:\n${err.message}`
      );
      isQuitting = true;
      app.quit();
    }
  });
}

// Clean shutdown
function cleanUp() {
  if (childProcess) {
    log('Terminating sidecar process...');
    childProcess.kill();
    childProcess = null;
  }
}

app.on('before-quit', () => {
  isQuitting = true;
  cleanUp();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null && selectedPort) {
    createMainWindow(selectedPort);
  }
});
