// THE BRIEFING AND ITS GLOSSARIES (moved out of src/td-tab.js, 2026-10-01, unchanged): the campaign board's opening briefing as
// cards, THE RECORD, the hostiles glossary generated from ENEMY_SPEC and the pickups. The host hands in the message element, the
// pause, the sprite shots and the icon builders; this only writes the modal's HTML.
import { ACHIEVEMENTS, ACHV_GROUPS } from '../achievements.js';
import { CREATURE_TINTS, ENEMY_SPEC, INTROS } from '../enemyspec.js';
import { makeTriadIcon, glossCard, GAMEPLAY_TIPS } from './briefing-cards.js';

// h: { msgEl, pause(), spriteShot(key, build), heartIcon(), unitIcon(type, tint), mobile(), round(), heldAchv(), towerLook(), buildTowerLook,
// starterTower(), look(), makeDotBurst, makeRewardSolid, HEART_MAX, DEFAULT_TANK }
export function createGlossaryModals(h) {
  // opening briefing: the pieces as cards, the ONE win condition, and two
  // clickable glossaries. The sim stays frozen until the player begins.
  function showBriefing() {
    h.pause();
    h.msgEl.innerHTML = `<div class="msg-head">transmission · briefing</div>` +
      `<div class="msg-scroll">` +
      `<div class="gcards">` +
      glossCard('#ff6a88', h.spriteShot('heart', h.heartIcon), 'the stalheart', 'the terraformer at the pole — without it the colony dies') +
      glossCard('#9fdcff', h.spriteShot('tank', h.unitIcon(h.DEFAULT_TANK, h.look().walker)), 'your tank', h.mobile()
        ? 'TAP the ground to send it · DRAG on the left to drive · ◉ shell · ∿ plasma · BUILD switch top-right · hold a tower to upgrade'
        : 'W/Q-E drive · A/D steer · SPACE shell · SHIFT lasers · 1/2/3 views · U upgrade · ESC pause') +
      glossCard('#9fdcff', h.spriteShot('tower-' + h.towerLook(), () => h.buildTowerLook(h.towerLook(), h.starterTower())), 'towers', 'your army — build them on the HIGH GROUND (walls) in BUILD mode') +
      glossCard('#ffb000', h.spriteShot('triad', makeTriadIcon), 'missile triads', 'drive over = +3 shells · shells also blast walls open') +
      glossCard('#66ff88', h.spriteShot('amoeba', h.unitIcon('amoeba', CREATURE_TINTS.amoeba)), 'fodder', 'soft creatures — RAM them, it’s free') +
      glossCard('#ff5340', h.spriteShot('barbed', h.unitIcon('barbed', CREATURE_TINTS.barbed)), 'spiked reds', 'armored — ramming hurts YOU · shells only') +
      glossCard('#ffffff', h.spriteShot('breach', () => h.makeDotBurst(0xcfd8ff, [0, 1, 0], 90)), 'breaches', 'enemy sources · orbital strikes seal them · exhausted waves close them') +
      `</div>` +
      GAMEPLAY_TIPS +
      `<b>WIN = CLOSE EVERY BREACH.</b> reaching the heart wins nothing — it's home.` +
      `</div>` +
      `<div class="msg-foot">` +
      `<button class="msg-glenemy">enemy glossary</button> ` +
      `<button class="msg-glachv">the record</button> ` +
      `<button class="msg-glfriend">pickups</button><br>` +
      `<button class="msg-begin">&rsaquo; begin round ${h.round()}</button>` +
      `</div>`;
    h.msgEl.classList.remove('hidden');
  }

  // THE RECORD. Everything earned and everything not, in one list, grouped
  // the way the table is. Unearned entries keep their NAME and lose their
  // note — a list of question marks tells a player nothing about what to go
  // and do, and a list that spells out every condition removes the reason to
  // wonder. The name is the hint.
  function showRecord() {
    h.pause();
    const held = new Set(h.heldAchv());
    const rows = ACHV_GROUPS.map((grp) => {
      const inGroup = ACHIEVEMENTS.filter((a) => a.group === grp);
      const got = inGroup.filter((a) => held.has(a.id)).length;
      return `<div class="rec-group">${grp} <i>${got}/${inGroup.length}</i></div>`
        + inGroup.map((a) => {
          const on = held.has(a.id);
          return `<div class="rec-row${on ? ' got' : ''}">`
            + `<span class="rec-mark">${on ? '&#10022;' : '&#9675;'}</span>`
            + `<span class="rec-name">${a.name}</span>`
            + `<span class="rec-note">${on ? a.note : '&mdash;'}</span></div>`;
        }).join('');
    }).join('');
    h.msgEl.innerHTML = `<div class="msg-head">the record</div>`
      + `<div class="msg-scroll"><div class="rec">${rows}</div></div>`
      + `<div class="go-reason">${held.size}/${ACHIEVEMENTS.length} &middot; the record survives a run; the run does not</div>`
      + `<button class="msg-back">&larr; back to briefing</button>`;
    h.msgEl.classList.remove('hidden');
  }

  function showEnemyGlossary() {
    h.pause();
    const cards = INTROS.map((iv) => {
      const spec = ENEMY_SPEC[iv.type];
      const tint = '#' + CREATURE_TINTS[iv.type].toString(16).padStart(6, '0');
      const ram = spec.rammable
        ? '<span style="color:#66ff88">▼ rammable</span>'
        : '<span style="color:#ff5340">× do not ram</span>';
      return glossCard(tint, h.spriteShot(iv.type, h.unitIcon(iv.type, CREATURE_TINTS[iv.type])), iv.label.toLowerCase(),
        `${iv.role} · ${spec.hp} hp · arrives wave ${iv.wave} · ${ram}`);
    }).join('');
    h.msgEl.innerHTML = `<div class="msg-head">glossary · hostiles</div>` +
      `<div class="gcards">${cards}` +
      glossCard('#ffffff', h.spriteShot('breach', () => h.makeDotBurst(0xcfd8ff, [0, 1, 0], 90)), 'breach', 'where they emerge · seal with an orbital strike · closes when waves are spent') +
      `</div><button class="msg-back">← back to briefing</button>`;
    h.msgEl.classList.remove('hidden');
  }

  function showFriendGlossary() {
    h.pause();
    const orbIcon = (shape, body) => () => h.makeRewardSolid(shape, { body, hi: 0xffffff }, 1.7);
    h.msgEl.innerHTML = `<div class="msg-head">glossary · pickups</div>` +
      `<div class="gcards">` +
      glossCard('#ff6a88', h.spriteShot('heart', h.heartIcon), 'the stalheart', `${h.HEART_MAX} hp · enemy contact drains it · regen charges heal it`) +
      glossCard('#9fdcff', h.spriteShot('tower-' + h.towerLook(), () => h.buildTowerLook(h.towerLook(), h.starterTower())), 'towers', 'mount on walls only · tap high ground in BUILD mode · upgrade twice · sell 75%') +
      glossCard('#ffb000', h.spriteShot('triad', makeTriadIcon), 'missile triad', '+3 shells on touch (rack caps at 9) — the ONLY ammo pickup') +
      glossCard('#9ff8ff', h.spriteShot('orb-power', orbIcon('star', 0x9ff8ff)), 'power sphere', 'far-field reward · +8% speed, permanent') +
      glossCard('#3dff6e', h.spriteShot('orb-health', orbIcon('cell', 0x3dff6e)), 'health sphere', 'far-field reward · +1 your hp') +
      glossCard('#ff2df0', h.spriteShot('orb-regen', orbIcon('ring', 0xff2df0)), 'regen charge', 'CARRY it back near the heart: +4 heart hp') +
      glossCard('#59c8ff', h.spriteShot('orb-shield', orbIcon('dome', 0x59c8ff)), 'energy shield', '12s bubble over the hull — touch damage bounces off') +
      `</div><button class="msg-back">← back to briefing</button>`;
    h.msgEl.classList.remove('hidden');
  }
  return { showBriefing, showRecord, showEnemyGlossary, showFriendGlossary };
}
