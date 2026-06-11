/**
 * prepublish-clean.mjs
 * Version: 1.0.0
 *
 * Dependency-free replacement for:
 *   npx shx rm -rf node_modules/* node_modules/.[!.]* node_modules/..?* package-lock.json npm-shrinkwrap.json
 *
 * Empties the contents of node_modules (including dotfiles) while keeping the directory,
 * then removes the lock files.
 *
 * Usage:
 *   node scripts/prepublish-clean.mjs
 */

import { readdirSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';

const cwd = process.cwd();

// `maxRetries` lets Node retry the EPERM/EBUSY errors Windows raises when a node_modules
// binary is read-only or briefly locked (antivirus, file indexer, an open handle). A lock held
// by a running process (e.g. an LSP with a native .node addon mapped) cannot be retried away,
// so warn and continue instead of aborting the whole clean.
const rm = (target) => {
  try {
    rmSync(resolve(cwd, target), { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  } catch (error) {
    if (error.code === 'EPERM' || error.code === 'EBUSY' || error.code === 'ENOTEMPTY') {
      console.warn(`Skipped locked path (${error.code}): ${error.path ?? target} — likely held by a running process.`);
      return;
    }
    throw error;
  }
};

// Empty the contents (including dotfiles) of node_modules but keep the directory itself.
try {
  for (const entry of readdirSync(resolve(cwd, 'node_modules'))) {
    rm(resolve(cwd, 'node_modules', entry));
  }
} catch {
  // node_modules does not exist, nothing to empty.
}

// Fully remove the lock files.
rm('package-lock.json');
rm('npm-shrinkwrap.json');
