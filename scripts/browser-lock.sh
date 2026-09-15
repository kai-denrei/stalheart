#!/bin/zsh
# Serialise browser suites across worktrees and agents. browser-test.mjs binds a
# fixed port (18155), so two runs at once collide; this waits for the port, a
# shared lock directory and a memory level that is not CRITICAL, then runs the
# command. Usage: scripts/browser-lock.sh node scripts/browser-test.mjs --defense
LOCK=/private/tmp/stalheart-browser.lock
waited=0
while true; do
  # a lock older than 40 minutes belongs to a run that died without cleaning up
  if [[ -d $LOCK ]] && [[ -n $(find $LOCK -maxdepth 0 -mmin +40 2>/dev/null) ]]; then rmdir $LOCK 2>/dev/null; fi
  level=$(~/scripts/check-memory.sh 2>/dev/null | tail -1 | sed -n 's/.*level=\([A-Z]*\).*/\1/p')
  if [[ $level != CRITICAL ]] && ! lsof -nP -iTCP:18155 -sTCP:LISTEN >/dev/null 2>&1 && mkdir $LOCK 2>/dev/null; then break; fi
  (( waited % 120 == 0 )) && echo "browser-lock: waiting (memory=${level:-?}, waited ${waited}s)" >&2
  sleep 10; (( waited += 10 ))
done
trap 'rmdir $LOCK 2>/dev/null' EXIT INT TERM
"$@"
