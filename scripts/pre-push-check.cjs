/**
 * Git Pre-Push Hook Checker
 * Luna Eye Hospital - VisionCare EMR
 *
 * Verifies if the commits being pushed modify files in src/ or server/.
 * If changes are detected, automatically runs `npm run release:standalone`
 * to guarantee that the offline packaged executable (VisionCare-EMR.exe)
 * is fully up to date and compiles cleanly before allowing the push.
 *
 * Branch Targeting & Bypass:
 *   - Only runs on release branches by default: main, master, release*
 *   - Automatically bypasses for feature/experimental branches (feature/*, fix/*, etc.)
 *   - Configurable via: EMR_PACKAGE_BRANCHES="main,release*"
 *   - Manual env bypass: SKIP_EMR_PACKAGE=1 git push
 *   - Git native bypass: git push --no-verify
 *   - CLI Dry Run mode:  node scripts/pre-push-check.cjs --dry-run
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');

const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const isForce = args.includes('--force');

function checkEnvironmentBypass() {
  const bypassVars = ['SKIP_EMR_PACKAGE', 'SKIP_PACKAGING', 'SKIP_PACKAGE', 'NO_VERIFY', 'EMR_CI_OFFLOAD'];
  for (const v of bypassVars) {
    if (process.env[v] === '1' || process.env[v] === 'true') {
      console.log(`\n\x1b[33m⚡ [Git Pre-Push Hook] Flag ${v}=1 detected.\x1b[0m`);
      if (v === 'EMR_CI_OFFLOAD') {
        console.log('   Offloading release packaging to GitHub Actions CI runner in the cloud.\n');
      } else {
        console.log('   Bypassing offline standalone executable packaging pipeline.\n');
      }
      return true;
    }
  }
  return false;
}

function getTargetPushInfo() {
  const targets = [];
  let isBranchDeletion = false;

  // 1. Check CLI override: --branch <name>
  const branchArgIndex = args.indexOf('--branch');
  if (branchArgIndex !== -1 && args[branchArgIndex + 1]) {
    return { branches: [args[branchArgIndex + 1]], isBranchDeletion: false };
  }

  // 2. Read piped stdin from Git if available
  if (!process.stdin.isTTY) {
    try {
      const input = fs.readFileSync(0, 'utf-8');
      if (input && input.trim()) {
        const lines = input.trim().split(/\r?\n/);
        for (const line of lines) {
          const parts = line.trim().split(/\s+/);
          // format: <local ref> <local sha1> <remote ref> <remote sha1>
          if (parts.length >= 3) {
            const localSha = parts[1];
            const remoteRef = parts[2];
            // Check if deleting branch (all 0s or (delete))
            if (localSha === '0000000000000000000000000000000000000000' || parts[0] === '(delete)') {
              isBranchDeletion = true;
            }
            const branchName = remoteRef.replace(/^refs\/heads\//, '');
            targets.push(branchName);
          }
        }
      }
    } catch {
      // stdin not readable or empty, fall through
    }
  }

  // 3. Fallback: retrieve active local branch
  if (targets.length === 0) {
    try {
      const current = execSync('git rev-parse --abbrev-ref HEAD', {
        cwd: ROOT_DIR,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'ignore']
      }).trim();
      if (current && current !== 'HEAD') {
        targets.push(current);
      }
    } catch {
      // ignore
    }
  }

  return {
    branches: targets.length > 0 ? targets : ['main'],
    isBranchDeletion
  };
}

function checkBranchEligibility(targetBranches) {
  // Configurable via EMR_PACKAGE_BRANCHES (comma separated patterns)
  // Default: main, master, release*
  const patternConfig = process.env.EMR_PACKAGE_BRANCHES || 'main,master,release*';
  const patterns = patternConfig.split(',').map((p) => p.trim().toLowerCase()).filter(Boolean);

  for (const branch of targetBranches) {
    const bLower = branch.toLowerCase();
    const matches = patterns.some((pattern) => {
      if (pattern === '*') return true;
      if (pattern.endsWith('*')) {
        return bLower.startsWith(pattern.slice(0, -1));
      }
      return bLower === pattern;
    });

    if (matches) {
      return { eligible: true, branch, patterns };
    }
  }

  return { eligible: false, branch: targetBranches.join(', '), patterns };
}

function getChangedFiles() {
  try {
    // Diff against upstream tracking branch
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
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
VisionCare EMR — Pre-Push Hook Inspector

Usage:
  node scripts/pre-push-check.cjs [options]

Options:
  --dry-run         Simulate pre-push inspection without running the build
  --force           Force execution of release:standalone regardless of branch or diff
  --branch <name>   Test eligibility for a specific target branch
  --help, -h        Show this help screen

Branch Target Policy:
  Automated packaging is restricted to release branches (main, master, release*).
  Pushes to feature/*, fix/*, chore/*, etc. are automatically bypassed.
  Configure via: EMR_PACKAGE_BRANCHES="main,release*"

Manual Bypasses:
  SKIP_EMR_PACKAGE=1 git push
  git push --no-verify
`);
    process.exit(0);
  }

  console.log('\x1b[36m⚡ [Git Pre-Push Hook] Inspecting push payload...\x1b[0m');

  // Check 1: Manual environment bypass
  if (checkEnvironmentBypass()) {
    process.exit(0);
  }

  // Check 2: Branch target evaluation & remote deletion
  const { branches, isBranchDeletion } = getTargetPushInfo();

  if (isBranchDeletion) {
    console.log('\x1b[32m✔ [Git Pre-Push Hook] Remote branch deletion detected. Skipping standalone repackaging.\x1b[0m\n');
    process.exit(0);
  }

  const branchCheck = checkBranchEligibility(branches);

  if (!branchCheck.eligible && !isForce) {
    console.log(`\x1b[36mℹ [Git Pre-Push Hook] Target branch "${branchCheck.branch}" is a feature/non-release branch.\x1b[0m`);
    console.log(`   Configured release branches: ${branchCheck.patterns.join(', ')}`);
    console.log('   ✔ Automatically bypassing standalone repackaging for this push.\n');
    process.exit(0);
  }

  console.log(`\x1b[32m✔ [Git Pre-Push Hook] Target branch "${branchCheck.branch}" is an active release branch.\x1b[0m`);

  // Check 3: Modified files
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

  if (relevantFiles.length === 0 && !isForce) {
    console.log('\x1b[32m✔ [Git Pre-Push Hook] No changes in src/ or server/. Skipping standalone repackaging.\x1b[0m\n');
    process.exit(0);
  }

  console.log(`\x1b[33m⚠ [Git Pre-Push Hook] Detected ${relevantFiles.length} changed file(s) in src/ or server/:\x1b[0m`);
  relevantFiles.slice(0, 5).forEach((f) => console.log(`   • ${f}`));
  if (relevantFiles.length > 5) {
    console.log(`   ...and ${relevantFiles.length - 5} more`);
  }

  // Check 4: Dry Run Flag
  if (isDryRun) {
    console.log('\n\x1b[36mℹ [Git Pre-Push Hook] --dry-run mode active:\x1b[0m');
    console.log('   Build trigger confirmed, but release packaging skipped due to --dry-run flag.');
    console.log('   Push would proceed cleanly.\n');
    process.exit(0);
  }

  console.log('\n\x1b[33m⚡ Automatically compiling and packaging standalone release before push...\x1b[0m');
  console.log('\x1b[90m   💡 Tip: Use "EMR_CI_OFFLOAD=1 git push" to offload to GitHub Actions, or "git push --no-verify" to skip.\x1b[0m\n');

  try {
    execSync('npm run release:standalone', {
      cwd: ROOT_DIR,
      stdio: 'inherit'
    });
    console.log('\n\x1b[32m✔ [Git Pre-Push Hook] Standalone packaging completed successfully. Proceeding with push!\x1b[0m\n');
    process.exit(0);
  } catch (err) {
    console.error('\n\x1b[31m✖ [Git Pre-Push Hook ERROR] Standalone packaging failed! Aborting git push.\x1b[0m');
    console.error('\x1b[90m   To push anyway without packaging, run: SKIP_EMR_PACKAGE=1 git push\x1b[0m\n');
    process.exit(1);
  }
}

main();
