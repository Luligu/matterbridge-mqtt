/**
 * clean.mjs
 * Version: 1.0.0
 *
 * Dependency-free replacement for `npx shx rm -rf *.tsbuildinfo dist`.
 * Removes every *.tsbuildinfo file in the current directory and the dist directory.
 *
 * Usage:
 *   node scripts/clean.mjs
 */

import { readdirSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';

const cwd = process.cwd();

// `maxRetries` lets Node retry the EPERM/EBUSY errors Windows raises when a file is briefly locked
// (antivirus, file indexer, an open handle). A lock held by a running process cannot be retried
// away, so warn and continue instead of aborting the whole clean.
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

const targets = readdirSync(cwd).filter((name) => name.endsWith('.tsbuildinfo'));
targets.push('dist');

for (const target of targets) {
  rm(target);
}
