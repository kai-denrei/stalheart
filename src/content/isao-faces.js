// ISAO-Birudorōn's performance for each of the game's emotion ids. The model's faces are not a texture: every authored clip scales its
// FACE_* LED glyphs in and poses the body and limbs, so an emotion is one clip. Our ids come from src/emotions.js (the braille-lab set);
// the model authors fourteen, so the rest borrow the nearest performance. Upstream: assets/isao-birudoron/manifest.json.
export const ISAO_MODEL = 'assets/models/isao/isao_birudoron_lod1.glb';
export const ISAO_FACE_CLIPS = Object.freeze({
  neutral: 'Emotion_Neutral', happy: 'Emotion_Happy', glee: 'Emotion_Glee', awe: 'Emotion_Surprised', sad: 'Emotion_Sad',
  worried: 'Emotion_Worried', scared: 'Emotion_Alarm', angry: 'Emotion_Angry', frustrated: 'Emotion_Angry', focused: 'Emotion_Working',
  unimpressed: 'Emotion_Skeptical', skeptical: 'Emotion_Skeptical', suspicious: 'Emotion_Skeptical', surprised: 'Emotion_Surprised',
  sleepy: 'Emotion_Sleepy', blink: 'Emotion_Neutral', scan: 'Emotion_Curious', curious: 'Emotion_Curious', determined: 'Emotion_Determined',
  grin: 'Emotion_Glee', love: 'Emotion_Love',
});
// the always-on layers under a face: the hover bob and the rotors
export const ISAO_IDLE_CLIPS = Object.freeze(['Hover_Idle', 'Rotor_Cycle']);
