#!/bin/zsh
# Run browser suites one after another from a frozen snapshot, waiting while memory is not OK.
# Usage: tools/refactor/suites.sh <snapshot-dir> <logdir> --flag [--flag ...]
# Each suite's output goes to <logdir>/<flag>.log; one summary line per suite goes to <logdir>/summary.log.
snap=$1; shift
logs=$1; shift
mkdir -p $logs
for flag in "$@"; do
  waited=0
  while true; do
    level=$(~/scripts/check-memory.sh 2>/dev/null | tail -1 | sed -n 's/.*level=\([A-Z]*\).*/\1/p')
    [[ $level == OK ]] && break
    (( waited % 600 == 0 )) && echo "memory=$level before $flag, waited ${waited}s" >> $logs/summary.log
    sleep 60; (( waited += 60 ))
  done
  start=$(date +%s)
  (cd $snap && scripts/browser-lock.sh node scripts/browser-test.mjs $flag > $logs/${flag#--}.log 2>&1)
  rc=$?
  echo "$flag rc=$rc $(( $(date +%s) - start ))s" >> $logs/summary.log
done
echo DONE >> $logs/summary.log
