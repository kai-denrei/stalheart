#!/usr/bin/env bash
# synth-beacon-ping.sh — the distress beacon's ping (owner, 2026-10-04: "beacon sounds one each"): a sonar-like tone, two partials an
# octave apart under an exponential decay with a short echo, mono 96 kbps. Deterministic: same ffmpeg, same bytes (pinned in
# docs/beacon-audio.lock.json; re-run and update the lock if it is ever changed).
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."
ffmpeg -hide_banner -loglevel error -y \
  -f lavfi -i "sine=frequency=1318.5:duration=1.6:sample_rate=44100" \
  -f lavfi -i "sine=frequency=659.25:duration=1.6:sample_rate=44100" \
  -filter_complex "[0]volume=0.55[a];[1]volume=0.45[b];[a][b]amix=inputs=2:normalize=0,afade=t=in:d=0.006,afade=t=out:st=0.02:d=1.55:curve=exp,aecho=0.8:0.5:210:0.32,volume=10,alimiter=limit=0.8" \
  -ac 1 -b:a 96k -map_metadata -1 -fflags +bitexact -flags:a +bitexact assets/audio/beacon_ping.mp3
echo "beacon_ping: $(ffprobe -v error -show_entries format=duration -of csv=p=0 assets/audio/beacon_ping.mp3) s"
