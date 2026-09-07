#!/usr/bin/env bash
# audio-build.sh — turn the WAV masters in assets/audio/src/ into the
# trimmed, peak-normalized mono MP3s the game actually loads.
#
# Pipeline per file: trim -> pitch (where baked) -> fade-out ->
# peak-normalize to -1 dBTP -> mono 96 kbps MP3.
#
# Two things this script exists to enforce:
#
# 1. NO SAMPLE OUTLIVES ITS TOWER'S TIER-2 SHOT INTERVAL. towers.js
#    effectiveStats gives rate * 1.2 at tier 2, and the 'single' attack
#    family takes another * 1.2 -- so a fully upgraded rapid tower fires
#    at 4.32/s (0.231s apart) against a 1.54s source. Trimming here is
#    cheaper and more predictable than fighting the pile-up at runtime.
#
# 2. PITCH CHANGES DURATION. asetrate at 0.70 makes a slice ~1.43x
#    longer, so source trim = output duration * rate. field_pulse wants
#    0.80s out at 0.70, so it trims 0.56s of source.
#
# Peak-normalize rather than loudnorm: peak preserves the transients that
# make a blast read as a blast. Artistic level-setting lives in the
# manifest's per-sound gain, not in the encode.

set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."

SRC="assets/audio/src"
OUT="assets/audio"
SR=44100
BR=96k
FADE=0.04      # tail fade so a hard trim never clicks
TARGET=-1.5    # dBFS peak of the DECODED output

command -v ffmpeg >/dev/null || { echo "ffmpeg not found" >&2; exit 1; }
command -v ffprobe >/dev/null || { echo "ffprobe not found" >&2; exit 1; }

# True float peak. NOT volumedetect: that saturates its report at 0.0 dB,
# which hides exactly the overshoot we are here to remove. astats over
# fltp measures past full scale, which is the whole point -- MP3 decoding
# genuinely reconstructs peaks ABOVE the encoded sample peak (measured:
# Tower_upgrade came back at +4.3 dB), and Web Audio clips those at the
# output device.
apeak () {
  ffmpeg -hide_banner -nostats -i "$1" \
    -af "aformat=sample_fmts=fltp,astats=measure_overall=Peak_level:measure_perchannel=none" \
    -f null - 2>&1 | awk -F': ' '/Peak level dB/{print $2}'
}

# key|source wav|output duration (s)|playback rate|start offset (s, optional)
#
# The start offset exists because not every master begins where the sound
# does. A minigun roar has a tenth of a second of nothing and then a spin-up
# in front of the loop-worthy body; trimming from zero would give a slice
# that is mostly silence and a transient that is not the one wanted.
TABLE=$(cat <<'EOF'
kinetic_fire|Tower_Single_shot_muffled.wav|0.45|1.00
seeker_fire|Tower_Homing_heavy-blast-14.wav|0.66|1.00
field_pulse|Tower_Slow_beam-05.wav|0.80|0.70
plasma_fire|Tower_Laser_beam-05.wav|0.45|1.00
blast_fire|Tower_AoE_heavy-blast-03.wav|0.90|1.00
tower_upgrade|Tower_upgrade.wav|0.79|1.00
tank_main|Tank_MainWeapon_heavy-blast-15.wav|1.20|1.00
tank_secondary|Tank_Secondary_light-blast-09.wav|0.14|1.00
tank_spool_up|hydraulic_up.wav|1.10|1.00
tank_spool_down|hydraulic_down.wav|0.92|1.00
tank_destroyed|Tower_AoE_heavy-blast-03.wav|1.55|0.72
tank_pickup|Tank_PickUpItem_handling-26.wav|0.45|1.00
tank_shells|Tank_PickUpNewShells_reload-02.wav|0.91|1.00
# The wave warning. Kept at nearly its full 3.76s rather than trimmed to
# the 3.0s lead: the gush is meant to still be running as the first enemy
# clears the gate, so the sound hands over to the thing it warned about
# instead of stopping dead a frame before it.
portal_warn|Portal_WaveWarning_freezing_gush_01.wav|3.70|1.00
# The boss omen. Full length on purpose: it starts 10s before the boss
# wave lands, so the brass is still swelling as the knot clears the gate
# and decays naturally into the fight (same handover ethos as the gush).
boss_tension|BossTension_tension-scapes-brass.mp3|21.40|1.00
danger_alert|Danger_klaxon-gamestudio.mp3|1.01|1.00
# dry-fire click: the reload sample's first transient, pitched up — played
# while the trigger is held against overheated laser tubes
laser_click|Tank_PickUpNewShells_reload-02.wav|0.10|1.35
# the hack handshake: the dial-up modem, full length — six seconds of
# negotiation IS the fiction of connecting to the server
server_dialup|Server_dialup-handshake.mp3|6.15|1.00
enemy_die_a|slime-pop.wav|0.50|1.00
enemy_die_b|slime-organic.wav|0.57|1.00
enemy_die_c|splat_quick.wav|0.33|1.00
# THE ROTOR (operator's samples). Two halves of one gun: the spin-up plays
# on the way INTO an engagement and on the way out of one — the downtime,
# where a rotary weapon does most of its talking — and the roar is sliced
# from the steady body of the burst, past its own start transient, so that
# one round's worth reads as a piece of a continuous sound rather than as a
# little explosion. Deliberately quiet in the manifest: six barrels at four
# rounds a second is the easiest thing in this game to make unbearable.
minigun_ready|Minigun_Ready_244784.mp3|1.60|1.00|0.05
minigun_fire|Minigun_Firing_freesound_36769.mp3|0.17|1.00|0.12
EOF
)

echo "building $OUT/"
worst=-99

while IFS='|' read -r key src dur rate start; do
  # blank lines and comments: the table is worth annotating, and without
  # this a comment row reads as a key with an empty source path
  [[ -z "$key" || "$key" == \#* ]] && continue
  in="$SRC/$src"
  [[ -f "$in" ]] || { echo "missing source: $in" >&2; exit 1; }
  start="${start:-0}"

  # pitch changes duration: trim the source by dur*rate so the OUTPUT is dur
  trim=$(awk -v d="$dur" -v r="$rate" 'BEGIN{printf "%.4f", d*r}')
  tend=$(awk -v s="$start" -v t="$trim" 'BEGIN{printf "%.4f", s+t}')

  if [[ "$rate" == "1.00" ]]; then
    pitch=""
  else
    # asetrate resamples (pitch and speed together), aresample restores
    # the nominal rate so the container stays 44.1k
    newsr=$(awk -v s="$SR" -v r="$rate" 'BEGIN{printf "%d", s*r}')
    pitch="asetrate=${newsr},aresample=${SR},"
  fi

  fadest=$(awk -v d="$dur" -v f="$FADE" 'BEGIN{printf "%.4f", (d-f<0?0:d-f)}')
  # ...and a slice that does not start at zero needs a fade IN too, or the
  # cut lands mid-waveform and clicks on every retrigger
  fadein=""
  if awk -v s="$start" 'BEGIN{exit !(s > 0)}'; then
    fadein="afade=t=in:st=0:d=${FADE},"
  fi
  chain="atrim=${start}:${tend},asetpts=N/SR/TB,${pitch}${fadein}afade=t=out:st=${fadest}:d=${FADE}"

  # PEAK-normalize in two passes. Peak, not loudnorm and not a compressor:
  # peak is the only normalization that leaves the transient intact, and
  # the transient is what makes a blast read as a blast. Balance is the
  # manifest's job, not the encode's.
  #
  # Pass 1 lifts the source peak to TARGET. Pass 2 exists because lossy
  # encoding overshoots by an amount that varies per file (measured:
  # +0.9 to +4.3 dB) -- so measure what the DECODER actually produces and
  # pull the gain back by the excess. One correction converges.
  src_peak=$(ffmpeg -hide_banner -nostats -i "$in" \
    -af "${chain},aformat=sample_fmts=fltp,astats=measure_overall=Peak_level:measure_perchannel=none" \
    -f null - 2>&1 | awk -F': ' '/Peak level dB/{print $2}')
  [[ -z "$src_peak" ]] && { echo "peak detect failed: $key" >&2; exit 1; }

  vol=$(awk -v p="$src_peak" -v t="$TARGET" 'BEGIN{printf "%.2f", t-p}')
  ffmpeg -v error -y -i "$in" -af "${chain},volume=${vol}dB" \
    -ac 1 -ar "$SR" -b:a "$BR" "$OUT/${key}.mp3"

  got1=$(apeak "$OUT/${key}.mp3")
  vol2=$(awk -v v="$vol" -v p="$got1" -v t="$TARGET" 'BEGIN{printf "%.2f", v-(p-t)}')
  ffmpeg -v error -y -i "$in" -af "${chain},volume=${vol2}dB" \
    -ac 1 -ar "$SR" -b:a "$BR" "$OUT/${key}.mp3"

  final=$(apeak "$OUT/${key}.mp3")
  gotdur=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$OUT/${key}.mp3")
  worst=$(awk -v w="$worst" -v f="$final" 'BEGIN{print (f>w)?f:w}')
  printf "  %-15s %5.2fs (want %.2f)  peak %7.2f dBFS\n" "$key" "$gotdur" "$dur" "$final"
done <<< "$TABLE"

# --- looped beds: an inner slice, crossfaded to hide the seam ---------------
# A loop cannot just be trimmed: the join has to be inaudible. Take a steady
# inner slice and crossfade its tail back over its head.
#
# Tank_Engine_teleport is a swell-then-decay whoosh, but its RMS body holds
# within ~2.5 dB from 0.35s to 1.45s -- steady enough to loop from. Take that
# 1.10s body and crossfade its tail back over its head so the loop point is
# inaudible. Output is 1.10 - XF = 1.04s of seamless loop.
# key|source wav|slice start|slice end|crossfade
LOOPS=$(cat <<'EOF'
tank_engine|Tank_Engine_teleport.wav|0.35|1.45|0.06
tank_thruster|thruster.wav|0.50|3.50|0.10
EOF
)

while IFS='|' read -r key src lo hi xf; do
  # blank lines and comments: the table is worth annotating, and without
  # this a comment row reads as a key with an empty source path
  [[ -z "$key" || "$key" == \#* ]] && continue
  in="$SRC/$src"
  [[ -f "$in" ]] || { echo "missing source: $in" >&2; exit 1; }
  body=$(awk -v a="$lo" -v b="$hi" 'BEGIN{printf "%.4f", b-a}')
  head_end=$(awk -v b="$body" -v x="$xf" 'BEGIN{printf "%.4f", b-x}')

  ffmpeg -v error -y -i "$in" \
    -filter_complex "\
[0:a]atrim=${lo}:${hi},asetpts=N/SR/TB,aformat=channel_layouts=mono[body];\
[body]asplit[b1][b2];\
[b1]atrim=0:${head_end},asetpts=N/SR/TB[head];\
[b2]atrim=${head_end},asetpts=N/SR/TB[tail];\
[head][tail]acrossfade=d=${xf}:c1=tri:c2=tri[out]" \
    -map "[out]" -ac 1 -ar "$SR" -y "$OUT/.loop_raw.wav"

  # same two-pass peak normalize as the one-shots
  lraw=$(apeak "$OUT/.loop_raw.wav")
  lvol=$(awk -v p="$lraw" -v t="$TARGET" 'BEGIN{printf "%.2f", t-p}')
  ffmpeg -v error -y -i "$OUT/.loop_raw.wav" -af "volume=${lvol}dB" -ac 1 -ar "$SR" -b:a "$BR" "$OUT/${key}.mp3"
  l1=$(apeak "$OUT/${key}.mp3")
  lvol2=$(awk -v v="$lvol" -v p="$l1" -v t="$TARGET" 'BEGIN{printf "%.2f", v-(p-t)}')
  ffmpeg -v error -y -i "$OUT/.loop_raw.wav" -af "volume=${lvol2}dB" -ac 1 -ar "$SR" -b:a "$BR" "$OUT/${key}.mp3"
  rm -f "$OUT/.loop_raw.wav"

  lfinal=$(apeak "$OUT/${key}.mp3")
  gotdur=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$OUT/${key}.mp3")
  worst=$(awk -v w="$worst" -v f="$lfinal" 'BEGIN{print (f>w)?f:w}')
  printf "  %-15s %5.2fs (crossfaded loop)  peak %7.2f dBFS\n" "$key" "$gotdur" "$lfinal"
done <<< "$LOOPS"

# nothing may decode above full scale: Web Audio clips that at the device
if awk -v w="$worst" 'BEGIN{exit !(w >= 0)}'; then
  echo "FAIL: worst decoded peak ${worst} dBFS is at or above full scale" >&2
  exit 1
fi
echo "worst decoded peak: ${worst} dBFS (must stay below 0)"

echo "done: $(ls "$OUT"/*.mp3 | wc -l | tr -d ' ') files, $(du -sh "$OUT"/*.mp3 | awk '{s+=$1}END{print s}')K total"
