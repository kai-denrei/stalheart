import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SOUNDS } from '../src/content/audio-defaults.js';

// A LOOP HOLDS ITS LEVEL (2026-09-25 playtest: the Rotor fired on with only its spin to be heard). A sound the game loops while a
// trigger is held must loop a cut that holds its level: a one-shot recording looped whole plays its fade and its silence too.
// Every WAV loopFile is PCM16, and no 100 ms of it falls more than 20 dB under its median.
const root = new URL('../', import.meta.url);
const pcm16 = (path) => {
  const b = readFileSync(new URL(path, root));
  assert.equal(b.toString('ascii', 0, 4), 'RIFF', `${path}: a RIFF file`);
  assert.equal(b.readUInt16LE(20), 1, `${path}: PCM`); assert.equal(b.readUInt16LE(34), 16, `${path}: 16-bit`);
  let o = 12; while (o < b.length && b.toString('ascii', o, o + 4) !== 'data') o += 8 + b.readUInt32LE(o + 4);
  const n = b.readUInt32LE(o + 4) / 2, ch = b.readUInt16LE(22), sr = b.readUInt32LE(24), x = new Float32Array(n / ch);
  for (let i = 0; i < x.length; i++) x[i] = b.readInt16LE(o + 8 + i * 2 * ch) / 32768;
  return { x, sr };
};
const loops = Object.entries(SOUNDS).filter(([, s]) => typeof s.loopFile === 'string' && s.loopFile.endsWith('.wav'));
assert.ok(loops.length >= 4);
for (const key of ['rotor_pov_fire', 'gunship_rotary_fire']) assert.ok(loops.some(([k]) => k === key), `${key} loops a seamless cut, not its whole recording`);
for (const [key, s] of loops) {
  const { x, sr } = pcm16(s.loopFile.replace(/^\.?\//, ''));
  const w = Math.round(sr * 0.1), db = [];
  for (let i = 0; i + w <= x.length; i += w) { let e = 0; for (let k = 0; k < w; k++) e += x[i + k] * x[i + k]; db.push(10 * Math.log10(e / w + 1e-12)); }
  const med = db.slice().sort((a, b) => a - b)[Math.floor(db.length / 2)];
  assert.ok(Math.min(...db) > med - 20, `${key}: ${s.loopFile} drops ${(med - Math.min(...db)).toFixed(1)} dB inside the loop`);
}
console.log(`Audio loops: ${loops.length} WAV loops hold their level; the Rotor's and the gunship's fire loop a seamless cut.`);
