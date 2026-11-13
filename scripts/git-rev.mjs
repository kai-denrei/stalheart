// WHICH COMMIT IS THIS: the commit's date@short-sha (a branch's name can carry a stale date), plus "+dirty" when tracked files differ from the commit. Empty outside a checkout.
import { execFileSync } from 'node:child_process';
const git = (root, ...args) => execFileSync('git', ['-C', root, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
export function gitRev(root) {
  try {
    const sha = git(root, 'rev-parse', '--short', 'HEAD'), day = git(root, 'show', '-s', '--format=%cs', 'HEAD');
    const dirty = git(root, 'status', '--porcelain', '--untracked-files=no') !== '';
    return `${day}@${sha}${dirty ? '+dirty' : ''}`;
  } catch { return ''; }
}
