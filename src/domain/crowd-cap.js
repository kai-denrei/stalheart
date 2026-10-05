// THE CROWD FITS THE MACHINE (owner, 2026-10-05: "sector 6 dropped to 7 fps but FUN! How to calibrate… perhaps successive waves but max
// x thousands at a time?"; "sector 9: 3fps"). Every body is its own draw call, about 2.5 a frame with the bloom pass (measured on the
// M4: 500 bodies 16.7 ms a frame, 2000 25.5 ms, 3000 34.8 ms, the enemies' own CPU only 2.6 ms of it), so what a machine can hold
// differs by machine. The cap on bodies alive at once follows the measured frame: `slowMs` and over, it comes down by `down`; `fastMs`
// and under, it goes back up by `up`, once every `every` seconds, between `min` and `max`. The waves still come whole: what does not
// fit waits in the queue and rises as the field thins (src/td-tab.js releaseSpawns). Pure: frame times in, the cap out.
export function makeCrowdCap({ start, min, max, slowMs, fastMs, down, up, every, alpha = 0.1 }) {
  return { cap: Math.max(min, Math.min(max, start)), ema: null, acc: 0, min, max, slowMs, fastMs, down, up, every, alpha };
}

// one frame of `ms` real milliseconds (a gap over `gapMs`, a hidden tab or a stall, is not a frame) with `alive` bodies up; returns the
// cap. It only goes up on evidence: fast frames with the field at `proven` of the cap or more (an empty field at 60 fps says nothing
// about two thousand bodies, and a cap grown on it let a whole flood land at once)
export function stepCrowdCap(c, ms, alive = Infinity, gapMs = 250, proven = 0.8) {
  if (!(ms > 0) || ms > gapMs) return c.cap;
  c.ema = c.ema == null ? ms : c.ema + (ms - c.ema) * c.alpha;
  c.acc += ms / 1000;
  if (c.acc >= c.every) {
    c.acc = 0;
    if (c.ema >= c.slowMs) c.cap = Math.max(c.min, Math.floor(c.cap * c.down));
    else if (c.ema <= c.fastMs && alive >= c.cap * proven) c.cap = Math.min(c.max, Math.ceil(c.cap * c.up));
  }
  return c.cap;
}
