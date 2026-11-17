// Original mechanical double bark: deterministic voiced pulses and breath.
// No upstream recording. Re-run to regenerate the PCM source asset.
import { execFileSync } from 'node:child_process';
const rate = 24000, seconds = .9, n = Math.round(rate * seconds), samples = new Float64Array(n);
let seed = 93, peak = 0;
for (let i = 0; i < n; i++) {
  const t = i / rate;
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  let value = 0;
  for (const start of [.03, .43]) {
    const u = t - start; if (u < 0 || u > .29) continue;
    const env = Math.min(1, u / .012) * Math.exp(-u * 14) * Math.min(1, (.29 - u) / .035);
    const phase = 2 * Math.PI * (185 * u - 95 * u * u);
    const voice = Math.sin(phase) + .5 * Math.sin(phase * 3) + .3 * Math.sin(phase * 5);
    const breath = (seed / 4294967296 - .5) * .35;
    value += env * (voice * (.65 + .35 * Math.sin(2 * Math.PI * 720 * u)) + breath);
  }
  samples[i] = value; peak = Math.max(peak, Math.abs(value));
}
const wav = Buffer.alloc(44 + n * 2);
wav.write('RIFF',0);wav.writeUInt32LE(wav.length-8,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);
wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(rate,24);wav.writeUInt32LE(rate*2,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);
wav.write('data',36);wav.writeUInt32LE(n*2,40);
for(let i=0;i<n;i++)wav.writeInt16LE(Math.round(samples[i]/peak*.78*32767),44+i*2);
execFileSync('ffmpeg', ['-y','-f','wav','-i','pipe:0','-codec:a','libmp3lame','-b:a','96k',new URL('../assets/audio/k9_bark.mp3',import.meta.url).pathname], { input: wav, stdio: ['pipe','ignore','pipe'] });
