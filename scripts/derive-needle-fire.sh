#!/usr/bin/env bash
# derive-needle-fire.sh — the Needle's report (owner, 2026-10-05: "the second part of its sound effect, the 'click' reload after a shot,
# is too loud"). The Needle fired the tank's main-gun sample whole; this is that sample with its shot (0-0.66 s) untouched and its
# reload clicks (0.70-0.92 s) brought down 12 dB, over a 40 ms ramp so the cut never clicks itself. The tank keeps tank_main.mp3.
# Deterministic; pinned in docs/needle-audio.lock.json.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."
ffmpeg -hide_banner -loglevel error -y -i assets/audio/tank_main.mp3 \
  -af "asetnsamples=64,volume='if(lt(t,0.66),1,if(lt(t,0.70),1-(t-0.66)/0.04*0.749,0.251))':eval=frame" \
  -ac 1 -b:a 96k -map_metadata -1 -fflags +bitexact -flags:a +bitexact assets/audio/needle_fire.mp3
echo "needle_fire: $(ffprobe -v error -show_entries format=duration -of csv=p=0 assets/audio/needle_fire.mp3) s"
