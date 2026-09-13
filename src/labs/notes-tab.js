// notes-tab.js — the roadmap, the practices and the development log, in the workshop.
//
// They already exist as files: ROADMAP.md is the forward view and DEVLOG.md is
// generated from docs/log/entries/. This does not copy either of them, and it
// does not hold a second opinion about what is open — it FETCHES them, so a
// `npm run log -- render` is the only way this page ever changes and there is
// no third place for the truth to live.
//
// The markdown subset is deliberately small: headings, lists, tables, fences,
// rules, quotes, and inline code/emphasis/links. Enough for these two files
// and nothing more, because a fuller parser is a dependency and this repo has
// none by choice.
const DOCS = [
  { key: 'roadmap', file: 'ROADMAP.md', label: 'roadmap', hint: 'where this is going' },
  { key: 'practices', file: 'PRACTICES.md', label: 'practices', hint: 'what we learned' },
  { key: 'devlog', file: 'DEVLOG.md', label: 'devlog', hint: 'what happened' },
];

const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// Inline pass runs AFTER escaping, so a fence containing <div> stays visible
// rather than becoming one.
function inline(s) {
  return esc(s)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>')
    .replace(/~~([^~]+)~~/g, '<del>$1</del>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" rel="noreferrer">$1</a>');
}

function markdown(src) {
  const out = [];
  const lines = src.split('\n');
  let i = 0, list = null;
  const closeList = () => { if (list) { out.push(`</${list}>`); list = null; } };
  while (i < lines.length) {
    const line = lines[i];
    if (/^```/.test(line)) {                       // fenced code
      closeList(); i++;
      const buf = [];
      while (i < lines.length && !/^```/.test(lines[i])) buf.push(lines[i++]);
      i++; out.push(`<pre><code>${esc(buf.join('\n'))}</code></pre>`); continue;
    }
    if (/^\s*\|/.test(line) && /^\s*\|[\s:|-]+\|\s*$/.test(lines[i + 1] || '')) {
      closeList();
      const cells = (r) => r.trim().replace(/^\||\|$/g, '').split('|').map((c) => inline(c.trim()));
      const head = cells(line); i += 2;
      const body = [];
      while (i < lines.length && /^\s*\|/.test(lines[i])) body.push(cells(lines[i++]));
      out.push(`<table><thead><tr>${head.map((c) => `<th>${c}</th>`).join('')}</tr></thead><tbody>`
        + body.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('') + '</tbody></table>');
      continue;
    }
    const hd = line.match(/^(#{1,6})\s+(.*)$/);
    if (hd) { closeList(); out.push(`<h${hd[1].length}>${inline(hd[2])}</h${hd[1].length}>`); i++; continue; }
    if (/^---+\s*$/.test(line)) { closeList(); out.push('<hr>'); i++; continue; }
    if (/^>\s?/.test(line)) { closeList(); out.push(`<blockquote>${inline(line.replace(/^>\s?/, ''))}</blockquote>`); i++; continue; }
    const li = line.match(/^\s*([-*]|\d+\.)\s+(.*)$/);
    if (li) {
      const want = /^\d/.test(li[1]) ? 'ol' : 'ul';
      if (list !== want) { closeList(); out.push(`<${want}>`); list = want; }
      out.push(`<li>${inline(li[2])}</li>`); i++; continue;
    }
    if (!line.trim()) { closeList(); i++; continue; }
    closeList();
    const buf = [line]; i++;
    while (i < lines.length && lines[i].trim() && !/^(#{1,6}\s|\s*[-*]\s|\s*\d+\.\s|```|>|\s*\|)/.test(lines[i])) buf.push(lines[i++]);
    out.push(`<p>${inline(buf.join(' '))}</p>`);
  }
  closeList();
  return out.join('\n');
}

export function initNotesTab(root) {
  root.innerHTML = `<div id="notes">
    <nav class="nt-rail">
      ${DOCS.map((d, n) => `<button type="button" data-doc="${d.key}"${n ? '' : ' class="on"'}>
        <b>${d.label}</b><span>${d.hint}</span></button>`).join('')}
      <label class="nt-find">find<input type="search" data-find placeholder="ram premium, sinkhole, …"></label>
      <div class="nt-toc" data-toc></div>
    </nav>
    <article class="nt-body" data-body><p class="nt-wait">loading…</p></article>
  </div>`;

  const body = root.querySelector('[data-body]');
  const toc = root.querySelector('[data-toc]');
  const find = root.querySelector('[data-find]');
  const cache = new Map();
  let current = DOCS[0].key, disposed = false;

  async function load(key) {
    const doc = DOCS.find((d) => d.key === key);
    if (!cache.has(key)) {
      try {
        const r = await fetch(new URL(`../../${doc.file}`, import.meta.url));
        if (!r.ok) throw Error(String(r.status));
        cache.set(key, await r.text());
      } catch (e) {
        // A release that did not ship the file should say so plainly rather
        // than render an empty page that looks like there is nothing to say.
        cache.set(key, `# ${doc.label} unavailable\n\n\`${doc.file}\` could not be fetched (${e.message}). `
          + 'It is in the repository; this build did not ship it.');
      }
    }
    if (disposed || current !== key) return;
    body.innerHTML = markdown(cache.get(key));
    buildToc();
    applyFind();
    body.scrollTop = 0;
  }

  function buildToc() {
    const hs = [...body.querySelectorAll('h2')];
    toc.innerHTML = hs.map((h, n) => {
      h.id = `nt-${n}`;
      return `<a href="#nt-${n}" data-jump="${n}">${h.textContent}</a>`;
    }).join('');
  }
  toc.addEventListener('click', (e) => {
    const a = e.target.closest('[data-jump]'); if (!a) return;
    e.preventDefault();
    body.querySelector(`#nt-${a.dataset.jump}`)?.scrollIntoView({ block: 'start' });
  });

  // Filtering hides whole SECTIONS rather than lines: a devlog entry read
  // without its context and outcome is a headline, and a headline is what
  // sent somebody looking in the first place.
  function applyFind() {
    const q = find.value.trim().toLowerCase();
    const blocks = [...body.children];
    if (!q) { for (const el of blocks) el.hidden = false; return; }
    let keep = false, any = false;
    for (const el of blocks) {
      if (/^H[12]$/.test(el.tagName)) keep = false;
      if (!keep) {
        // a heading turns its whole run on when the run matches
        let run = [el], k = blocks.indexOf(el) + 1;
        while (k < blocks.length && !/^H[12]$/.test(blocks[k].tagName)) run.push(blocks[k++]);
        keep = run.some((n) => n.textContent.toLowerCase().includes(q));
      }
      el.hidden = !keep;
      any = any || keep;
    }
    if (!any) body.insertAdjacentHTML('afterbegin', '');
  }
  find.addEventListener('input', applyFind);

  root.querySelector('.nt-rail').addEventListener('click', (e) => {
    const b = e.target.closest('[data-doc]'); if (!b) return;
    for (const o of root.querySelectorAll('[data-doc]')) o.classList.toggle('on', o === b);
    current = b.dataset.doc; load(current);
  });

  load(current);
  return { setActive: () => {}, dispose() { disposed = true; } };
}
