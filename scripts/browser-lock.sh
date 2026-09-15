#!/bin/zsh
# Serialise browser suites across worktrees and agents, two at a time.
# browser-test.mjs serves on 18155 unless STALHEART_BROWSER_PORT says otherwise;
# slot 1 is 18155 for any command, slot 2 is 18156 and is only taken by a
# `scripts/browser-test.mjs` run whose copy reads that variable, and only while
# memory is OK. Waits for a free slot and a memory level that is not CRITICAL.
# Usage: scripts/browser-lock.sh node scripts/browser-test.mjs --defense
LOCKS=/private/tmp/stalheart-browser
second=0
if [[ " $* " == *" scripts/browser-test.mjs "* ]] && grep -q STALHEART_BROWSER_PORT scripts/browser-test.mjs 2>/dev/null; then second=1; fi
waited=0; slot=
while true; do
  for n in 1 2; do
    # a lock older than 40 minutes belongs to a run that died without cleaning up
    if [[ -d $LOCKS-$n.lock ]] && [[ -n $(find $LOCKS-$n.lock -maxdepth 0 -mmin +40 2>/dev/null) ]]; then rmdir $LOCKS-$n.lock 2>/dev/null; fi
  done
  level=$(~/scripts/check-memory.sh 2>/dev/null | tail -1 | sed -n 's/.*level=\([A-Z]*\).*/\1/p')
  if [[ $level != CRITICAL ]]; then
    if ! lsof -nP -iTCP:18155 -sTCP:LISTEN >/dev/null 2>&1 && mkdir $LOCKS-1.lock 2>/dev/null; then slot=1; port=18155; break; fi
    if (( second )) && [[ $level == OK ]] && ! lsof -nP -iTCP:18156 -sTCP:LISTEN >/dev/null 2>&1 && mkdir $LOCKS-2.lock 2>/dev/null; then slot=2; port=18156; break; fi
  fi
  (( waited % 120 == 0 )) && echo "browser-lock: waiting (memory=${level:-?}, waited ${waited}s)" >&2
  sleep 10; (( waited += 10 ))
done
trap "rmdir $LOCKS-$slot.lock 2>/dev/null" EXIT INT TERM
echo "browser-lock: slot $slot, port $port" >&2
STALHEART_BROWSER_PORT=$port "$@"
