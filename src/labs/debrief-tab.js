// THE DEBRIEF LAB (labs.html#debrief). The end-of-sector debrief (src/fx/sector-debrief.js) on a stand-in for the game
// behind it, with the four sample reports (src/content/debrief-samples.js): switch sample, replay, and hold the card at
// full width, 1280 or a 400 px phone column to judge the stacking. Sound arms on the first press in the lab (the ticks
// are a quiet oscillator here, the stamps the game's tower_upgrade cue). ?sample=, ?width=, ?sound=0 and ?still=1 are
// deep links; ?acceptance=1 exposes window.__stalheartDebriefTest for scripts/browser-test.mjs --debrief.
import { createSectorDebrief } from '../fx/sector-debrief.js';
import { DEBRIEF_SAMPLES, DEBRIEF_SAMPLE_ISAO } from '../content/debrief-samples.js';
import { makeAudio } from '../audio.js';
import { CONTENT } from '../content/runtime.js';
import { resolveSounds } from '../content/preset.js';

const SAMPLES = [['secure', 'SECURE'], ['flawless', 'FLAWLESS'], ['lost', 'LOST'], ['campaign', 'CAMPAIGN']];
const WIDTHS = [['full', 'FULL'], ['1280', '1280'], ['400', '400 PX']];

export function initDebriefTab(root) {
  const q = new URLSearchParams(location.search);
  const pick = (value, list, fallback) => (list.some(([key]) => key === value) ? value : fallback);
  let sample = pick(q.get('sample'), SAMPLES, 'secure');
  let width = pick(q.get('width'), WIDTHS, 'full');
  let sound = q.get('sound') !== '0';
  const events = [];

  root.innerHTML = `<div class="dbl-stage" data-width="${width}">
      <div class="dbl-host">
        <div class="dbl-world" aria-hidden="true"><i class="dbl-planet"></i><i class="dbl-grid"></i></div>
        <div class="dbl-idle" hidden><p>DEBRIEF DISMISSED BY <b data-f="why"></b></p><button type="button" class="dbl-btn" data-replay>REPLAY</button></div>
      </div>
    </div>
    <div class="dbl-bar">
      <span class="dbl-group"><b>SAMPLE</b>${SAMPLES.map(([key, label]) => `<button type="button" class="dbl-btn" data-sample="${key}">${label}</button>`).join('')}</span>
      <span class="dbl-group"><button type="button" class="dbl-btn" data-replay>REPLAY</button></span>
      <span class="dbl-group"><b>WIDTH</b>${WIDTHS.map(([key, label]) => `<button type="button" class="dbl-btn" data-width="${key}">${label}</button>`).join('')}</span>
      <span class="dbl-group"><button type="button" class="dbl-btn" data-sound></button><button type="button" class="dbl-btn" data-still></button></span>
    </div>`;
  const stage = root.querySelector('.dbl-stage'), host = root.querySelector('.dbl-host'), idle = root.querySelector('.dbl-idle');

  // sound: nothing is created until a press in the lab, so a page that is only looked at never opens an audio context
  let context = null, audio = null;
  function arm() {
    if (context || !sound) return;
    try {
      context = new AudioContext();
      audio = makeAudio({ seed: 7, sounds: resolveSounds(CONTENT), persist: false });
      audio.arm();
    } catch { context = null; audio = null; }
  }
  function beep(freq, ms) {
    if (!sound || !context) return;
    if (context.state === 'suspended') void context.resume();
    const t = context.currentTime, low = freq < 400;
    const osc = context.createOscillator(), gain = context.createGain();
    osc.type = low ? 'sine' : 'square';
    osc.frequency.setValueAtTime(freq, t);
    if (low) osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq * 0.5), t + ms / 1000);
    gain.gain.setValueAtTime(low ? 0.12 : 0.014, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + ms / 1000 + 0.02);
    osc.connect(gain).connect(context.destination);
    osc.start(t);
    osc.stop(t + ms / 1000 + 0.04);
  }
  const options = {
    play: (key) => { if (sound && audio) audio.play(key); },
    beep,
    onContinue: () => dismissed('CONTINUE'),
    onKeepHolding: () => dismissed('KEEP HOLDING'),
    onNewRun: () => dismissed('NEW RUN'),
    reducedMotion: q.get('still') === '1' ? true : undefined,
  };
  const debrief = createSectorDebrief(host, options);

  function dismissed(what) {
    events.push({ what, sample });
    idle.querySelector('[data-f=why]').textContent = what;
    idle.hidden = false;
  }
  function run() {
    idle.hidden = true;
    if (sample === 'campaign') debrief.showCampaign(DEBRIEF_SAMPLES.campaign, { isao: DEBRIEF_SAMPLE_ISAO.campaign });
    else debrief.show(DEBRIEF_SAMPLES[sample], { isao: DEBRIEF_SAMPLE_ISAO[sample] });
    paintBar();
  }
  function remember() {
    const url = new URL(location.href);
    url.searchParams.set('sample', sample);
    url.searchParams.set('width', width);
    history.replaceState(history.state, '', url);
  }
  function paintBar() {
    for (const b of root.querySelectorAll('[data-sample]')) b.classList.toggle('on', b.dataset.sample === sample);
    for (const b of root.querySelectorAll('.dbl-bar [data-width]')) b.classList.toggle('on', b.dataset.width === width);
    const soundButton = root.querySelector('[data-sound]'), stillButton = root.querySelector('[data-still]');
    soundButton.textContent = sound ? (context ? 'SOUND ON' : 'SOUND · PRESS TO ARM') : 'SOUND OFF';
    soundButton.classList.toggle('on', sound);
    stillButton.textContent = options.reducedMotion ? 'MOTION OFF' : 'MOTION ON';
    stillButton.classList.toggle('on', !options.reducedMotion);
    stage.dataset.width = width;
  }
  function setWidth(next) { width = pick(next, WIDTHS, width); remember(); paintBar(); }

  const onPress = () => arm();
  addEventListener('pointerdown', onPress, true);
  addEventListener('keydown', onPress, true);
  root.querySelector('.dbl-bar').addEventListener('click', (e) => {
    const button = e.target.closest('button');
    if (!button) return;
    if (button.dataset.sample) { sample = button.dataset.sample; remember(); run(); }
    else if (button.dataset.width) setWidth(button.dataset.width);
    else if (button.dataset.sound != null) { sound = !sound; arm(); paintBar(); }
    else if (button.dataset.still != null) { options.reducedMotion = options.reducedMotion ? undefined : true; paintBar(); }
    button.blur();
  });
  for (const button of root.querySelectorAll('[data-replay]')) button.addEventListener('click', () => { button.blur(); run(); });
  run();

  if (q.get('acceptance') === '1') {
    window.__stalheartDebriefTest = {
      show: (name) => { sample = pick(name, SAMPLES, sample); run(); return debrief.pages(); },
      width: (next) => { setWidth(next); return host.getBoundingClientRect().width; },
      skip: () => debrief.skip(),
      next: () => debrief.next(),
      back: () => debrief.back(),
      state: () => {
        const el = debrief.element, frame = el.querySelector('.sdb-frame'), body = el.querySelector('.sdb-body');
        const box = frame.getBoundingClientRect();
        // anything that pokes out of the frame sideways, outside a scroller of its own, is overflow a player would see
        const poking = [...el.querySelectorAll('.sdb-body *')].filter((n) => !n.closest('.sdb-table-wrap'))
          .filter((n) => { const r = n.getBoundingClientRect(); return r.width && (r.right > box.right + 1 || r.left < box.left - 1); })
          .slice(0, 6).map((n) => `${n.tagName.toLowerCase()}.${[...n.classList].join('.')}`);
        return {
          sample, width, events: events.slice(),
          open: debrief.isOpen(), page: debrief.page(), pages: debrief.pages(), animating: debrief.animating(),
          label: el.dataset.label, outcome: el.dataset.outcome, mode: el.dataset.mode,
          hostWidth: Math.round(host.getBoundingClientRect().width), frameWidth: Math.round(box.width),
          overflowX: body.scrollWidth - body.clientWidth, poking,
          stamps: el.querySelectorAll('.sdb-stamp.is-in, .sdb-stamp.is-set').length,
          stampsTotal: el.querySelectorAll('.sdb-stamp').length,
          rainbow: el.querySelectorAll('.sdb-rainbow').length,
          buttons: [...el.querySelectorAll('.sdb-foot button:not([hidden])')].map((b) => b.textContent.trim()),
        };
      },
    };
  }

  return {
    setActive() {},
    dispose() {
      removeEventListener('pointerdown', onPress, true);
      removeEventListener('keydown', onPress, true);
      debrief.dispose();
      audio?.dispose?.();
      void context?.close();
      if (window.__stalheartDebriefTest) delete window.__stalheartDebriefTest;
      root.replaceChildren();
    },
  };
}
