// THE WAVE CARD (moved out of src/td-tab.js unchanged, the refactor run, 2026-10-07): the NEW THREAT banner with its live model of
// the enemy (announceWave), its sprite renderer, scene, camera and light, and the next-wave chip (updateNextPreview). The sprite
// renderer is a SECOND WebGL context (an open finding for the owner: the main renderer could draw the sprite to a render target);
// the controller makes it (host.makeRenderer) so this module never constructs a context itself. The controller keeps the banner
// element and its timer (another banner shares them) and spins unit() in its frame.
import * as THREE from '../../vendor/three.module.js';
import { buildCreature } from '../units.js';
import { CREATURE_TINTS, ENEMY_SPEC, INTROS, computeWavePlan } from '../enemyspec.js';

export function createWaveCard(host) {

  // wave announcement banner — HokorobiTawaa's "New Threat" card, complete with its spinning live model of the enemy. The sprite
  // renderer is ONE persistent context created up front (never per-announcement — contexts are a scarce browser resource and leak
  // on loss).
  // preserveDrawingBuffer: the glossary snapshots toDataURL() this canvas
  const waveSpriteRenderer = host.makeRenderer();   // new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true }), made by the controller
  waveSpriteRenderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  waveSpriteRenderer.setSize(96, 96);
  waveSpriteRenderer.domElement.className = 'wave-sprite';
  const waveScene = new THREE.Scene();
  const waveCam = new THREE.PerspectiveCamera(38, 1, 0.1, 10);
  waveCam.position.set(0, 0.55, 2.7);
  waveCam.lookAt(0, 0.3, 0);
  waveScene.add(new THREE.HemisphereLight(0xffffff, 0x445566, 2.6));
  const waveSun = new THREE.DirectionalLight(0xffffff, 1.4);
  waveSun.position.set(2, 3, 2);
  waveScene.add(waveSun);
  let waveUnit = null;

  function announceWave(intro) {
    const tint = '#' + CREATURE_TINTS[intro.type].toString(16).padStart(6, '0');
    const spec = ENEMY_SPEC[intro.type];
    // the one fact the player must not miss: can I drive over it?
    const ram = spec.rammable
      ? '<div class="wave-ram" style="color:#66ff88">▼ RAMMABLE — run it over</div>'
      : '<div class="wave-ram" style="color:#ff5340">× DO NOT RAM — shells only</div>';
    host.waveEl.style.borderColor = tint;
    host.waveEl.style.color = tint;
    host.waveEl.innerHTML = `<div class="wave-num">WAVE ${intro.wave} · NEW THREAT</div>` +
      `<div class="wave-name">${intro.label}</div>` +
      `<div class="wave-role">${intro.role}</div>` + ram;
    // live model between the header and the name (innerHTML wipe means the
    // canvas must be re-inserted each announcement)
    host.waveEl.insertBefore(waveSpriteRenderer.domElement, host.waveEl.querySelector('.wave-name'));
    if (waveUnit) { waveScene.remove(waveUnit); host.disposeObj(waveUnit); }
    waveUnit = buildCreature(intro.type, { walker: CREATURE_TINTS[intro.type], walkerHi: 0xffffff });
    // mesh units stand on y=0, clouds center on the origin — lift clouds
    if (waveUnit.userData.kind === 'cloud') waveUnit.position.y = 0.3;
    waveScene.add(waveUnit);
    host.waveEl.classList.remove('hidden');
    clearTimeout(host.waveTimer());
    host.setWaveTimer(setTimeout(() => host.waveEl.classList.add('hidden'), 4200));
  }

  const nextEl = host.root.querySelector('#td-next');
  function updateNextPreview() {
    if (host.player.won || !nextEl) { nextEl && nextEl.classList.add('hidden'); return; }
    const n = host.wave() + 1;
    const plan = computeWavePlan(n, host.round(), host.params.waveSize, host.threatMult());
    const chips = plan.entries.map((e, i) => {
      const tint = '#' + CREATURE_TINTS[e.type].toString(16).padStart(6, '0');
      const mark = i === 0 ? '◈' : '●';
      const nm = (INTROS.find((iv) => iv.type === e.type)?.label || e.type).toLowerCase();
      return `<span class="nx-chip" style="color:${tint}">${mark} ${nm} ×${e.count}</span>`;
    }).join('');
    if (host.storyMode()) { nextEl.classList.add('hidden'); return; } const frozen = host.buildFrozen() || host.shotId() === 'reveal';   // the story world has no wave clock to count down
    let when;
    if (frozen) when = 'ready · leave BUILD to engage';
    else if (host.waveActive() && !host.enemies.every((e) => !e.alive)) {
      // mid-wave the chip said 'clear the field' — permanent furniture
      // saying something the board already says. It HIDES now: the chip
      // appears at wave-clear with the countdown and leaves at spawn.
      nextEl.classList.add('hidden');
      return;
    }
    // the armed countdown is the truth once it is running — during a stall
    // the gap clock is not what decides when the wave lands
    else if (host.waveIn() >= 0) when = `in ${Math.max(0, Math.ceil(host.waveIn()))}s`;
    else when = `in ${Math.max(0, Math.ceil(host.params.waveGap - host.interClock()))}s`;
    nextEl.innerHTML = `<div class="nx-head">NEXT WAVE ${n} · ${when}</div><div class="nx-row">${chips}</div>`;
    nextEl.classList.remove('hidden');
  }
  return { waveSpriteRenderer, waveScene, waveCam, unit: () => waveUnit, announceWave, updateNextPreview };
}
