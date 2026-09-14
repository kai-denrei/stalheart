// WHICH COMMIT IS THIS: branch@short-sha, plus "+dirty" when tracked files differ from the commit. Empty outside a checkout.
import { execFileSync } from 'node:child_process';
const git = (root, ...args) => execFileSync('git', ['-C', root, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
export function gitRev(root) {
  try {
    const sha = git(root, 'rev-parse', '--short', 'HEAD'), branch = git(root, 'rev-parse', '--abbrev-ref', 'HEAD');
    const dirty = git(root, 'status', '--porcelain', '--untracked-files=no') !== '';
    return `${branch === 'HEAD' ? '' : `${branch}@`}${sha}${dirty ? '+dirty' : ''}`;
  } catch { return ''; }
}
