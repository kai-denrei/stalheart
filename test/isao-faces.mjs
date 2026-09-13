import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ISAO_MODEL, ISAO_FACE_CLIPS, ISAO_IDLE_CLIPS } from '../src/content/isao-faces.js';
import { EMOTION_IDS } from '../src/emotions.js';
const bytes = readFileSync(new URL(`../${ISAO_MODEL}`, import.meta.url));
const json = JSON.parse(bytes.toString('utf8', 20, 20 + bytes.readUInt32LE(12)));
const clips = new Set((json.animations ?? []).map((a) => a.name));
// every emotion the game can ask for has a performance, and every performance is in the pinned file
for (const id of EMOTION_IDS) assert.ok(ISAO_FACE_CLIPS[id], `no Isao performance for '${id}'`);
for (const [id, clip] of Object.entries(ISAO_FACE_CLIPS)) assert.ok(clips.has(clip), `${id} -> ${clip} is not in ${ISAO_MODEL}`);
for (const clip of ISAO_IDLE_CLIPS) assert.ok(clips.has(clip), `idle layer ${clip} missing`);
// the LED glyphs are scaled nodes, so the names the clips drive must survive into the game (a merge would weld them away)
const names = new Set(json.nodes.map((n) => n.name));
for (const n of ['LED_PANEL', 'FACE_NEUTRAL', 'FACE_SKEPTICAL_A', 'FACE_WORKING', 'ROTOR_FL_SPIN', 'ISAO_ROOT']) assert.ok(names.has(n), `node ${n} missing`);
console.log(`Isao faces: ${EMOTION_IDS.length} emotions onto ${new Set(Object.values(ISAO_FACE_CLIPS)).size} authored clips.`);
