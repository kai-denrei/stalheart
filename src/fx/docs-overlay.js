// The docs over the current page: FunMap, roadmap, devlog and practices, fetched from the files they already are, so
// a `npm run log -- render` or an edit to docs/FUNMAP.md is the only way this ever changes. The page underneath keeps
// running. Esc or the close button hides it. Replaces the workshop's notes tab.
import { NAV_DOCS } from '../content/nav.js';
import { markdown } from '../core/markdown.js';

let overlay = null;

export function openDocsOverlay(key = NAV_DOCS[0].key) {
  if (!overlay) overlay = build();
  overlay.show(key);
  return overlay;
}

function build() {
  const el = document.createElement('div');
  el.id = 'docs-overlay'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'docs');
  el.innerHTML = `<div id="notes">
    <nav class="nt-rail">
      ${NAV_DOCS.map((d) => `<button type="button" data-doc="${d.key}"><b>${d.label}</b><span>${d.hint}</span></button>`).join('')}
      <label class="nt-find">find<input type="search" data-find placeholder="ram premium, sinkhole, …"></label>
      <div class="nt-toc" data-toc></div>
    </nav>
    <article class="nt-body" data-body><p class="nt-wait">loading…</p></article>
    <button type="button" class="docs-close" data-close title="close (Esc)">×</button>
  </div>`;
  document.body.append(el);
  const body = el.querySelector('[data-body]');
  const toc = el.querySelector('[data-toc]');
  const find = el.querySelector('[data-find]');
  const cache = new Map();
  let current = NAV_DOCS[0].key;

  async function load(key) {
    const doc = NAV_DOCS.find((d) => d.key === key);
    if (!cache.has(key)) {
      try {
        const r = await fetch(new URL(`../../${doc.file}`, import.meta.url));
        if (!r.ok) throw Error(String(r.status));
        cache.set(key, await r.text());
      } catch (e) {
        // a release that did not ship the file says so plainly rather than rendering an empty page
        cache.set(key, `# ${doc.label} unavailable\n\n\`${doc.file}\` could not be fetched (${e.message}). It is in the repository; this build did not ship it.`);
      }
    }
    if (current !== key) return;
    body.innerHTML = markdown(cache.get(key));
    buildToc();
    applyFind();
    body.scrollTop = 0;
  }

  function buildToc() {
    toc.innerHTML = [...body.querySelectorAll('h2')].map((h, n) => { h.id = `nt-${n}`; return `<a href="#nt-${n}" data-jump="${n}">${h.textContent}</a>`; }).join('');
  }
  toc.addEventListener('click', (e) => {
    const a = e.target.closest('[data-jump]'); if (!a) return;
    e.preventDefault();
    body.querySelector(`#nt-${a.dataset.jump}`)?.scrollIntoView({ block: 'start' });
  });

  // filtering hides whole sections rather than lines: an entry read without its context is a headline
  function applyFind() {
    const q = find.value.trim().toLowerCase();
    const blocks = [...body.children];
    if (!q) { for (const b of blocks) b.hidden = false; return; }
    let keep = false;
    blocks.forEach((b, i) => {
      if (/^H[12]$/.test(b.tagName) || i === 0) {
        const run = [b];
        for (let k = i + 1; k < blocks.length && !/^H[12]$/.test(blocks[k].tagName); k++) run.push(blocks[k]);
        keep = run.some((n) => n.textContent.toLowerCase().includes(q));
      }
      b.hidden = !keep;
    });
  }
  find.addEventListener('input', applyFind);

  el.querySelector('.nt-rail').addEventListener('click', (e) => {
    const b = e.target.closest('[data-doc]'); if (b) show(b.dataset.doc);
  });
  // the keyboard while this is open (Esc closes, nothing reaches the game) is src/fx/shell-nav.js's to route
  const close = () => { el.hidden = true; };
  el.querySelector('[data-close]').addEventListener('click', close);

  function show(key) {
    el.hidden = false; current = key;
    for (const o of el.querySelectorAll('[data-doc]')) o.classList.toggle('on', o.dataset.doc === key);
    load(key);
  }
  return { show, close, element: el };
}
