/**
 * deep-clean.mjs
 * Version: 1.0.0
 *
 * Dependency-free replacement for:
 *   npx shx rm -rf *.tsbuildinfo dist coverage jest temp package-lock.json npm-shrinkwrap.json \
 *     .cache/* .cache/.[!.]* .cache/..?* node_modules/* node_modules/.[!.]* node_modules/..?*
 *
 * Fully removes the *.tsbuildinfo files, build/test output directories and lock files,
 * then empties the contents of .cache and node_modules while keeping those directories.
 *
 * Usage:
 *   node scripts/deep-clean.mjs
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

// Fully removed entries. The `.cache/*`, `node_modules/*` style globs keep the parent
// directory and only delete its contents, so those are handled separately below.
const targets = readdirSync(cwd).filter((name) => name.endsWith('.tsbuildinfo'));
targets.push('dist', 'coverage', 'jest', 'temp', 'package-lock.json', 'npm-shrinkwrap.json');

for (const target of targets) {
  rm(target);
}

// Empty the contents (including dotfiles) of these directories but keep the directory itself.
for (const dir of ['.cache', 'node_modules']) {
  let entries;
  try {
    entries = readdirSync(resolve(cwd, dir));
  } catch {
    continue; // Directory does not exist, nothing to empty.
  }
  for (const entry of entries) {
    rm(resolve(cwd, dir, entry));
  }
}
