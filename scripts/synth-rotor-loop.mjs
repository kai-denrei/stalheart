// A dedicated Rotor spin loop, synthesised so it loops without a seam: a
// four-barrel rotary motor at full spin. One second at 44.1 kHz, mono, PCM16,
// every partial an integer number of cycles per loop so the join is silent.
//   node scripts/synth-rotor-loop.mjs   -> assets/audio/rotor_spin.wav
// The game pitches this with the barrels (rate 0.5 at rest to 1.0 flat out).
import { writeFileSync, mkdirSync } from 'node:fs';
const SR = 44100, SECONDS = 1, N = SR * SECONDS;
const spinHz = 12;                       // barrel cluster revolutions per second at full spin
const partials = [[spinHz * 4, 0.55], [spinHz * 8, 0.30], [spinHz * 12, 0.16], [spinHz * 16, 0.09], [110, 0.22], [220, 0.12], [330, 0.06]];   // the four-blade chop and its harmonics, a motor hum under it
let seed = 7; const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296 - 0.5; };
const out = new Float32Array(N);
let lp = 0;
for (let i = 0; i < N; i++) {
  const t = i / SR; let v = 0;
  for (const [f, a] of partials) v += a * Math.sin(2 * Math.PI * f * t);
  v *= 0.75 + 0.25 * Math.sin(2 * Math.PI * spinHz * t);   // the cluster's own wobble, once per revolution
  lp += (rnd() - lp) * 0.12; v += lp * 0.9;                // filtered air noise, loop-safe because it is re-seeded per file, not per sample position
  out[i] = v;
}
// the noise is not periodic: crossfade the last 60 ms into the first so the join is silent
const X = Math.round(SR * 0.06); for (let i = 0; i < X; i++) { const w = i / X; out[N - X + i] = out[N - X + i] * (1 - w) + out[i] * w; }
let peak = 0; for (const v of out) peak = Math.max(peak, Math.abs(v)); const g = 0.85 / peak;
const pcm = new Int16Array(N); for (let i = 0; i < N; i++) pcm[i] = Math.round(out[i] * g * 32767);
const data = Buffer.from(pcm.buffer), header = Buffer.alloc(44);
header.write('RIFF', 0); header.writeUInt32LE(36 + data.length, 4); header.write('WAVE', 8); header.write('fmt ', 12); header.writeUInt32LE(16, 16); header.writeUInt16LE(1, 20); header.writeUInt16LE(1, 22); header.writeUInt32LE(SR, 24); header.writeUInt32LE(SR * 2, 28); header.writeUInt16LE(2, 32); header.writeUInt16LE(16, 34); header.write('data', 36); header.writeUInt32LE(data.length, 40);
mkdirSync('assets/audio', { recursive: true });
writeFileSync('assets/audio/rotor_spin.wav', Buffer.concat([header, data]));
console.log(`assets/audio/rotor_spin.wav: ${SECONDS} s, ${SR} Hz mono PCM16, ${(44 + data.length)} bytes, seam crossfade 60 ms`);
