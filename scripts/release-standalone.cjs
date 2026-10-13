/**
 * VisionCare EMR - Standalone Packaging Pipeline
 * Luna Eye Hospital, Minna
 *
 * Automates the complete standalone release build:
 * 1. Checks and terminates any running VisionCare-EMR.exe to avoid file locks.
 * 2. Compiles the React + Vite frontend bundle (npm run build).
 * 3. Compiles the Node.js TypeScript server (tsc in server/).
 * 4. Packages server and bundled assets into packaged-release/VisionCare-EMR.exe using pkg.
 * 5. Syncs dist/ assets and voice_config.json into packaged-release/.
 * 6. Verifies executable size and native SQLite binding.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const SERVER_DIR = path.resolve(ROOT_DIR, 'server');
const RELEASE_DIR = path.resolve(ROOT_DIR, 'packaged-release');
const EXE_PATH = path.resolve(RELEASE_DIR, 'VisionCare-EMR.exe');

function run(command, cwd = ROOT_DIR) {
  console.log(`\n\x1b[36m▶ Running:\x1b[0m ${command} \x1b[90m(in ${path.relative(ROOT_DIR, cwd) || '.'})\x1b[0m`);
  execSync(command, {
    cwd,
    stdio: 'inherit',
    env: { ...process.env, CI: 'true' }
  });
}

function stopRunningProcesses() {
  if (process.platform === 'win32') {
    try {
      console.log('\n\x1b[33m⚡ Checking for running VisionCare-EMR processes...\x1b[0m');
      execSync('taskkill /F /IM VisionCare-EMR.exe', { stdio: 'ignore' });
      console.log('   ✓ Terminated active VisionCare-EMR.exe process to unlock file.');
    } catch {
      // Process was not running, which is fine
      console.log('   ✓ No active VisionCare-EMR.exe process locking the binary.');
    }
  }
}

function syncReleaseAssets() {
  console.log('\n\x1b[33m⚡ Synchronizing release runtime assets...\x1b[0m');

  if (!fs.existsSync(RELEASE_DIR)) {
    fs.mkdirSync(RELEASE_DIR, { recursive: true });
  }

  // 1. Copy fresh dist folder
  const srcDist = path.resolve(ROOT_DIR, 'dist');
  const destDist = path.resolve(RELEASE_DIR, 'dist');
  if (fs.existsSync(srcDist)) {
    fs.cpSync(srcDist, destDist, { recursive: true, force: true });
    console.log('   ✓ Synced frontend dist/ into packaged-release/dist/');
  }

  // 2. Copy voice_config.json
  const srcVoiceConfig = path.resolve(SERVER_DIR, 'voice_config.json');
  const destVoiceConfig = path.resolve(RELEASE_DIR, 'voice_config.json');
  if (fs.existsSync(srcVoiceConfig)) {
    fs.copyFileSync(srcVoiceConfig, destVoiceConfig);
    console.log('   ✓ Synced voice_config.json into packaged-release/');
  }

  // 3. Verify SQLite native addon
  const nativeBinding = path.resolve(RELEASE_DIR, 'node_modules', 'sqlite3', 'build', 'Release', 'node_sqlite3.node');
  if (fs.existsSync(nativeBinding)) {
    console.log('   ✓ Verified native SQLite3 binding (node_sqlite3.node) is present.');
  } else {
    console.warn('   ⚠ Warning: Native SQLite binding not found at: ' + nativeBinding);
  }
}

function verifyBuild() {
  if (!fs.existsSync(EXE_PATH)) {
    throw new Error(`Executable was not generated at expected location: ${EXE_PATH}`);
  }

  const stats = fs.statSync(EXE_PATH);
  const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
  const updatedTime = stats.mtime.toLocaleTimeString();

  console.log('\n\x1b[32m══════════════════════════════════════════════════════════════\x1b[0m');
  console.log(`\x1b[32m✔ SUCCESS: Standalone VisionCare EMR successfully packaged!\x1b[0m`);
  console.log(`  File:        ${EXE_PATH}`);
  console.log(`  Size:        ${sizeMB} MB (${stats.size.toLocaleString()} bytes)`);
  console.log(`  Timestamp:   ${updatedTime}`);
  console.log('\x1b[32m══════════════════════════════════════════════════════════════\x1b[0m\n');
}

function main() {
  console.log('\x1b[35m╔══════════════════════════════════════════════════════════════╗\x1b[0m');
  console.log('\x1b[35m║      VisionCare EMR — Standalone Build & Package Pipeline    ║\x1b[0m');
  console.log('\x1b[35m║         Luna Eye Hospital | Automated Offline Release        ║\x1b[0m');
  console.log('\x1b[35m╚══════════════════════════════════════════════════════════════╝\x1b[0m');

  const startMs = Date.now();

  try {
    // Step 1: Unlock binary
    stopRunningProcesses();

    // Step 2: Build frontend
    console.log('\n\x1b[34m[1/4] Building React frontend production bundle...\x1b[0m');
    run('npm run build', ROOT_DIR);

    // Step 3: Compile server TypeScript
    console.log('\n\x1b[34m[2/4] Compiling server TypeScript...\x1b[0m');
    run('npx tsc -p tsconfig.json', SERVER_DIR);

    // Step 4: Package with pkg
    console.log('\n\x1b[34m[3/4] Packaging standalone executable with pkg (node18-win-x64)...\x1b[0m');
    run('npx pkg -t node18-win-x64 -o packaged-release/VisionCare-EMR.exe server/package.json', ROOT_DIR);

    // Step 5: Sync runtime assets
    console.log('\n\x1b[34m[4/4] Verifying and synchronizing release assets...\x1b[0m');
    syncReleaseAssets();

    // Step 6: Verify
    verifyBuild();

    const duration = ((Date.now() - startMs) / 1000).toFixed(1);
    console.log(`\x1b[32mDone in ${duration}s! Ready to launch via start-visioncare-silent.vbs\x1b[0m\n`);
  } catch (err) {
    console.error('\n\x1b[31m✖ ERROR: Packaging pipeline failed!\x1b[0m', err.message);
    process.exit(1);
  }
}

main();
