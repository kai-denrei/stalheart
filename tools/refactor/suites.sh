#!/bin/zsh
# Run browser suites one after another from a frozen snapshot, waiting while memory is not OK.
# Usage: tools/refactor/suites.sh <snapshot-dir> <logdir> --flag [--flag ...]
# Each suite's output goes to <logdir>/<flag>.log; one summary line per suite goes to <logdir>/summary.log.
# A WARN that is only the swap (desktop Chrome pins it over 3 GB) with at least 20% headroom counts as OK; anything else waits.
snap=$1; shift
logs=$1; shift
mkdir -p $logs
for flag in "$@"; do
  waited=0
  while true; do
    line=$(~/scripts/check-memory.sh 2>/dev/null | tail -1)
    level=$(echo $line | sed -n 's/.*level=\([A-Z]*\).*/\1/p')
    head=$(echo $line | sed -n 's/.*headroom=\([0-9]*\).*/\1/p')
    [[ $level == OK ]] && break
    [[ $level == WARN && ${head:-0} -ge 20 ]] && break
    (( waited % 600 == 0 )) && echo "memory=$level headroom=$head before $flag, waited ${waited}s" >> $logs/summary.log
    sleep 60; (( waited += 60 ))
  done
  start=$(date +%s)
  (cd $snap && scripts/browser-lock.sh node scripts/browser-test.mjs $flag > $logs/${flag#--}.log 2>&1)
  rc=$?
  echo "$flag rc=$rc $(( $(date +%s) - start ))s (memory $level, headroom $head%)" >> $logs/summary.log
done
echo DONE >> $logs/summary.log
