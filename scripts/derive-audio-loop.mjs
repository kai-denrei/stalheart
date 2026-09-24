// A SEAMLESS LOOP FROM A RECORDING (2026-09-25). A one-shot recording looped whole plays its tail too: the Rotor's POV fire
// is 1.85 s of gunfire then 3.7 s of fade and silence, so a held trigger went quiet after two seconds while rounds kept
// flying. This cuts the steady part [start, end) out of a recording, decoded mono 44.1 kHz, and blends its first `xfade`
// seconds with the `xfade` seconds just after the cut (equal power), so the end runs into the start without a seam; PCM16.
// Choose end - start as a whole number of the recording's own rhythm (a shot period) and the loop keeps the rhythm too.
//   node scripts/derive-audio-loop.mjs <source> <start s> <end s> <xfade s> <out.wav>
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const [src, a, b, xf, out] = process.argv.slice(2);
if (!out) { console.error('usage: node scripts/derive-audio-loop.mjs <source> <start s> <end s> <xfade s> <out.wav>'); process.exit(2); }
const SR = 44100, start = Math.round(+a * SR), end = Math.round(+b * SR), fade = Math.round(+xf * SR);
const raw = execFileSync('ffmpeg', ['-v', 'error', '-i', src, '-ac', '1', '-ar', String(SR), '-f', 'f32le', '-'], { maxBuffer: 1 << 28 });
const x = new Float32Array(raw.buffer, raw.byteOffset, raw.length / 4);
if (!(start >= 0 && end > start + fade && end + fade <= x.length)) throw Error(`the cut [${a}, ${b}) plus ${xf} s of fade does not fit a ${(x.length / SR).toFixed(3)} s recording`);
const n = end - start, loop = new Float32Array(n);
for (let i = 0; i < n; i++) loop[i] = x[start + i];
for (let i = 0; i < fade; i++) { const u = (i + 0.5) / fade; loop[i] = x[start + i] * Math.sin(u * Math.PI / 2) + x[end + i] * Math.cos(u * Math.PI / 2); }
const pcm = Buffer.alloc(44 + n * 2), w = (o, s) => pcm.write(s, o, 'ascii');
w(0, 'RIFF'); pcm.writeUInt32LE(36 + n * 2, 4); w(8, 'WAVE'); w(12, 'fmt '); pcm.writeUInt32LE(16, 16); pcm.writeUInt16LE(1, 20); pcm.writeUInt16LE(1, 22);
pcm.writeUInt32LE(SR, 24); pcm.writeUInt32LE(SR * 2, 28); pcm.writeUInt16LE(2, 32); pcm.writeUInt16LE(16, 34); w(36, 'data'); pcm.writeUInt32LE(n * 2, 40);
for (let i = 0; i < n; i++) pcm.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(loop[i] * 32767))), 44 + i * 2);
writeFileSync(out, pcm);
console.log(`${out}: ${(n / SR).toFixed(3)} s loop from ${a}-${b} s of ${src}, ${xf} s equal-power seam, ${pcm.length} bytes`);
