// The navigation shell's menu as data: two modes, PLAYTEST (the sections under playtest) and DEV (labs, tuning, docs,
// tools). A target is { page, hash, params } to navigate, { url } for a story jump, { doc } for the docs overlay or
// { tool } for a tool. A new playtest section is one entry here. Tuning pages are read from the variables modal at
// runtime, so they are not listed.
import { STAGES } from './base-layout.js';

export const NAV_MODES = Object.freeze(['playtest', 'dev']);

// the story's jump points: a wired jump is a game URL whose skip=<id> the shell finishes once the game is ready
export const STORY_JUMPS = Object.freeze([
  { id: 'rotor', label: 'ROTOR', title: 'the opening: the foundry cuts the rocket into feedstock, Isao prints the Rotor and hands it over', url: 'index.html?world=story&stage=1#td', wired: true },
  { id: 'quiver', label: 'QUIVER', title: 'not wired yet: the hard cores and the Quiver hand-over', url: null, wired: false },
  { id: 'study', label: 'STUDY', title: 'not wired yet: Isao\'s vibration-language analysis', url: null, wired: false },
  { id: 'gunship', label: 'GUNSHIP', title: 'the gunship on station with the seat taken, enemies up and waves continuing', url: 'index.html?world=story&stage=6&cine=0&acceptance=1&gunship=station&skip=gunship#td', wired: true },
  { id: 'defense', label: 'DEFENSE', title: 'after the handover: automatic towers, the tank, the gunship call-in, the expeditions', url: 'index.html?world=story&stage=6&cine=0&acceptance=1&phase=expedition#td', wired: true },
].map(Object.freeze));

export const NAV_DOCS = Object.freeze([
  { key: 'funmap', file: 'docs/FUNMAP.md', label: 'FunMap', hint: 'what is fun, lesson by lesson' },
  { key: 'roadmap', file: 'ROADMAP.md', label: 'Roadmap', hint: 'where this is going' },
  { key: 'devlog', file: 'DEVLOG.md', label: 'Devlog', hint: 'what happened' },
  { key: 'practices', file: 'PRACTICES.md', label: 'Practices', hint: 'what we learned' },
].map(Object.freeze));

export const NAV_GROUPS = Object.freeze([
  { mode: 'playtest', group: 'story', label: '' },
  { mode: 'playtest', group: 'defend', label: '' },
  { mode: 'playtest', group: 'arrival', label: '' },
  { mode: 'playtest', group: 'footer', label: '' },
  { mode: 'dev', group: 'workshop', label: 'Workshop' },
  { mode: 'dev', group: 'tuning', label: 'Tuning' },
  { mode: 'dev', group: 'docs', label: 'Docs' },
  { mode: 'dev', group: 'tools', label: 'Tools' },
].map(Object.freeze));

const LABS = [['units', 'units'], ['swarm', 'swarm'], ['beam', 'beam'], ['audio', 'audio'], ['metal', 'metal'], ['story', 'story'], ['sentry', 'sentry / impact'], ['portal', 'breach'], ['sim', 'sim']];

export const NAV_ENTRIES = Object.freeze([
  { id: 'story', label: 'Story', title: 'the story opening: land, print the Rotor, hold the gate', mode: 'playtest', group: 'story', target: { page: 'index.html', hash: 'td', params: { story: '1' } } },
  ...STAGES.map((s, n) => ({ id: `stage-${n}`, label: String(n), title: s.name, mode: 'playtest', group: 'story', row: 'stages', target: { page: 'index.html', hash: 'td', params: { story: String(n) } } })),
  ...STORY_JUMPS.map((j) => ({ id: `jump-${j.id}`, label: j.label, title: j.title, mode: 'playtest', group: 'story', row: 'jumps', disabled: !j.wired, target: { url: j.url } })),
  { id: 'defend', label: 'Defend', title: 'the finished base, the first hull rolls out of its bay', mode: 'playtest', group: 'defend', target: { page: 'index.html', hash: 'td', params: { story: '8' } } },
  { id: 'arrival', label: 'Arrival', title: 'the arrival cinematic: the SH02 lands and Isao comes out', mode: 'playtest', group: 'arrival', target: { page: 'labs.html', hash: 'story', params: { land: '1' } } },
  { id: 'record', label: 'Record', mode: 'playtest', group: 'footer', target: { page: 'index.html', hash: 'record', params: {} } },
  { id: 'settings', label: 'Settings', title: 'backup and import of records', mode: 'playtest', group: 'footer', target: { page: 'settings.html', hash: '', params: {} } },
  ...LABS.map(([hash, label]) => ({ id: `lab-${hash}`, label, mode: 'dev', group: 'workshop', target: { page: 'labs.html', hash, params: {} } })),
  ...NAV_DOCS.map((d) => ({ id: `doc-${d.key}`, label: d.label, title: d.hint, mode: 'dev', group: 'docs', target: { doc: d.key } })),
  { id: 'tool-felt', label: 'Felt it', title: 'note a moment that was satisfying or needs work', mode: 'dev', group: 'tools', target: { tool: 'felt' } },
  { id: 'tool-link', label: 'Copy deep link', title: 'copy this board as a URL', mode: 'dev', group: 'tools', target: { tool: 'link' } },
  { id: 'tool-fps', label: 'Frame readout', title: 'the fps readout (backtick)', mode: 'dev', group: 'tools', target: { tool: 'fps' } },
  { id: 'tool-diagnostics', label: 'Export diagnostics', title: 'the last game\'s local event history as JSON', mode: 'dev', group: 'tools', target: { tool: 'diagnostics' } },
].map(Object.freeze));
