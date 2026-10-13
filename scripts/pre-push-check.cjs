/**
 * Git Pre-Push Hook Checker
 * Luna Eye Hospital - VisionCare EMR
 *
 * Verifies if the commits being pushed modify files in src/ or server/.
 * If changes are detected, automatically runs `npm run release:standalone`
 * to guarantee that the offline packaged executable (VisionCare-EMR.exe)
 * is fully up to date and compiles cleanly before allowing the push.
 */

const { execSync } = require('child_process');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');

function getChangedFiles() {
  try {
    // Try diffing against upstream tracking branch
    const output = execSync('git diff --name-only @{u} HEAD', {
      cwd: ROOT_DIR,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'ignore']
    });
    return output.split(/\r?\n/).filter(Boolean);
  } catch {
    try {
      // Fallback: diff against origin/main
      const output = execSync('git diff --name-only origin/main HEAD', {
        cwd: ROOT_DIR,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'ignore']
      });
      return output.split(/\r?\n/).filter(Boolean);
    } catch {
      try {
        // Fallback: diff the latest commit
        const output = execSync('git diff-tree --no-commit-id --name-only -r HEAD', {
          cwd: ROOT_DIR,
          encoding: 'utf-8',
          stdio: ['pipe', 'pipe', 'ignore']
        });
        return output.split(/\r?\n/).filter(Boolean);
      } catch {
        return [];
      }
    }
  }
}

function main() {
  console.log('\x1b[36m⚡ [Git Pre-Push Hook] Inspecting push payload...\x1b[0m');

  const files = getChangedFiles();
  const relevantFiles = files.filter(
    (file) =>
      file.startsWith('src/') ||
      file.startsWith('src\\') ||
      file.startsWith('server/') ||
      file.startsWith('server\\') ||
      file === 'package.json' ||
      file === 'vite.config.ts'
  );

  if (relevantFiles.length === 0) {
    console.log('\x1b[32m✔ [Git Pre-Push Hook] No changes in src/ or server/. Skipping standalone repackaging.\x1b[0m\n');
    process.exit(0);
  }

  console.log(`\x1b[33m⚠ [Git Pre-Push Hook] Detected ${relevantFiles.length} changed file(s) in src/ or server/:\x1b[0m`);
  relevantFiles.slice(0, 5).forEach((f) => console.log(`   • ${f}`));
  if (relevantFiles.length > 5) {
    console.log(`   ...and ${relevantFiles.length - 5} more`);
  }

  console.log('\n\x1b[33m⚡ Automatically compiling and packaging standalone release before push...\x1b[0m\n');

  try {
    execSync('npm run release:standalone', {
      cwd: ROOT_DIR,
      stdio: 'inherit'
    });
    console.log('\n\x1b[32m✔ [Git Pre-Push Hook] Standalone packaging completed successfully. Proceeding with push!\x1b[0m\n');
    process.exit(0);
  } catch (err) {
    console.error('\n\x1b[31m✖ [Git Pre-Push Hook ERROR] Standalone packaging failed! Aborting git push.\x1b[0m\n');
    process.exit(1);
  }
}

main();
