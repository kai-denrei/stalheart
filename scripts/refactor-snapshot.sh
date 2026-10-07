#!/bin/zsh
# APFS-clone the worktree (no .git, artifacts, dist) into the session scratchpad so a browser suite serves a frozen tree
# while editing continues. Assets are COPIED (serve.mjs realpaths every file and 403s anything outside --dir).
# Usage: scripts/refactor-snapshot.sh <tag>   -> prints the snapshot dir. Run suites with cwd = that dir:
#   (cd $(scripts/refactor-snapshot.sh t10) && scripts/browser-lock.sh node scripts/browser-test.mjs --defense)
set -e
tag=${1:-snap}
base=${STALHEART_SNAPSHOTS:-/private/tmp/stalheart-snapshots}
mkdir -p $base
dest=$base/$tag-$(date +%H%M%S)
mkdir -p $dest
for entry in *; do
  case $entry in .git|artifacts|dist|node_modules) continue;; esac
  cp -Rc $entry $dest/
done
ln -s $(pwd)/node_modules $dest/node_modules
echo $dest
