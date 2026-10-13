/**
 * Release Tagging Automation Helper
 * Luna Eye Hospital - VisionCare EMR
 *
 * Usage:
 *   npm run release:tag 1.1.0
 *   node scripts/tag-release.cjs 1.1.0
 *
 * Automates:
 *   1. Validates working tree is clean.
 *   2. Bumps version in package.json & server/package.json.
 *   3. Commits and creates annotated git tag (vX.Y.Z).
 *   4. Pushes tag to origin, triggering the GitHub Actions Release workflow.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const PKG_PATH = path.resolve(ROOT_DIR, 'package.json');
const SERVER_PKG_PATH = path.resolve(ROOT_DIR, 'server', 'package.json');

function run(command) {
  console.log(`\x1b[36m▶ Running:\x1b[0m ${command}`);
  return execSync(command, { cwd: ROOT_DIR, stdio: 'inherit', encoding: 'utf-8' });
}

function checkCleanWorkingTree() {
  const status = execSync('git status --porcelain', { cwd: ROOT_DIR, encoding: 'utf-8' }).trim();
  if (status) {
    console.error('\n\x1b[31m✖ Working tree is not clean. Please commit or stash changes before tagging.\x1b[0m');
    process.exit(1);
  }
}

function parseVersion(arg) {
  if (!arg) {
    console.error('\n\x1b[31m✖ Missing version argument.\x1b[0m');
    console.log('Usage: npm run release:tag <version>  (e.g., npm run release:tag 1.1.0)\n');
    process.exit(1);
  }
  const clean = arg.replace(/^v/, '');
  if (!/^\d+\.\d+\.\d+(-[a-zA-Z0-9.]+)?$/.test(clean)) {
    console.error(`\n\x1b[31m✖ Invalid semver format: "${arg}". Expected format: X.Y.Z (e.g. 1.1.0)\x1b[0m\n`);
    process.exit(1);
  }
  return clean;
}

function bumpJsonVersion(filePath, version) {
  if (fs.existsSync(filePath)) {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    data.version = version;
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf-8');
    console.log(`   ✓ Updated version in ${path.relative(ROOT_DIR, filePath)} to ${version}`);
  }
}

function main() {
  const targetVer = parseVersion(process.argv[2]);
  const tag = `v${targetVer}`;

  console.log('\n\x1b[35m╔══════════════════════════════════════════════════════════════╗\x1b[0m');
  console.log(`\x1b[35m║        Preparing VisionCare EMR Release Tag: ${tag.padEnd(16)}║\x1b[0m`);
  console.log('\x1b[35m╚══════════════════════════════════════════════════════════════╝\x1b[0m\n');

  checkCleanWorkingTree();

  console.log('\x1b[33m1. Bumping package versions...\x1b[0m');
  bumpJsonVersion(PKG_PATH, targetVer);
  bumpJsonVersion(SERVER_PKG_PATH, targetVer);

  console.log('\n\x1b[33m2. Committing version bump...\x1b[0m');
  run(`git add package.json server/package.json`);
  run(`git commit -m "chore(release): bump version to ${tag}"`);

  console.log(`\n\x1b[33m3. Creating annotated tag ${tag}...\x1b[0m`);
  run(`git tag -a ${tag} -m "VisionCare EMR Release ${tag}"`);

  console.log(`\n\x1b[33m4. Pushing main and ${tag} to GitHub...\x1b[0m`);
  // Use SKIP_EMR_PACKAGE so local push is instantaneous; GitHub Actions builds the release
  process.env.SKIP_EMR_PACKAGE = '1';
  run(`git push origin main`);
  run(`git push origin ${tag}`);

  console.log('\n\x1b[32m══════════════════════════════════════════════════════════════\x1b[0m');
  console.log(`\x1b[32m✔ SUCCESS: Release tag ${tag} pushed to GitHub!\x1b[0m`);
  console.log(`  GitHub Actions is now compiling VisionCare-EMR.exe and`);
  console.log(`  publishing VisionCare-EMR-Standalone-Windows-x64.zip.`);
  console.log('\x1b[32m══════════════════════════════════════════════════════════════\x1b[0m\n');
}

main();
