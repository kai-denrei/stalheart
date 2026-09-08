// A single hover card per GUI. It does not take focus away from editing controls.
let nextHelpId = 0;
export function mountControlHelp(gui, descriptions) {
  const card = document.createElement('aside');
  card.className = 'lab-control-help'; card.id = `lab-control-help-${++nextHelpId}`;
  card.setAttribute('role', 'tooltip'); card.hidden = true;
  const heading = document.createElement('strong'), text = document.createElement('p');
  card.append(heading, text); document.body.append(card);
  const cleanup = [];
  let current = null, timer = 0, overCard = false;
  function listen(target, event, fn, options) {
    target.addEventListener(event, fn, options);
    cleanup.push(() => target.removeEventListener(event, fn, options));
  }
  function hide() { clearTimeout(timer); card.hidden = true; current = null; overCard = false; }
  function place() {
    if (!current) return;
    const anchor = current.label.getBoundingClientRect(), box = card.getBoundingClientRect();
    const left = anchor.left >= box.width + 16 ? anchor.left - box.width - 8 : anchor.right + 8;
    card.style.left = `${Math.max(8, Math.min(innerWidth - box.width - 8, left))}px`;
    card.style.top = `${Math.max(8, Math.min(innerHeight - box.height - 8, anchor.top))}px`;
  }
  function show(entry) {
    clearTimeout(timer); current = entry;
    heading.textContent = entry.title; text.textContent = entry.description;
    card.hidden = false; place();
  }
  function leave() {
    clearTimeout(timer);
    timer = setTimeout(() => {
      if (!overCard && current && !current.label.matches(':hover') && document.activeElement !== current.label) hide();
    }, 180);
  }
  for (const controller of gui.controllersRecursive()) {
    const description = descriptions[controller.property];
    if (!description) throw Error(`Missing lab help: ${controller.property}`);
    const label = controller.$name.closest('button') || controller.$name;
    const title = controller.parent === gui ? controller._name : `${controller.parent._title} / ${controller._name}`;
    const entry = { label, title, description };
    const oldTabIndex = label.getAttribute('tabindex'), oldDescription = label.getAttribute('aria-describedby');
    if (label.tagName !== 'BUTTON') label.tabIndex = 0;
    label.classList.add('lab-help-label'); label.dataset.helpKey = controller.property;
    // A persistent description is available to assistive tech even when the card is closed.
    const accessible = document.createElement('span'); accessible.hidden = true;
    accessible.id = `${card.id}-${controller.property}`; accessible.textContent = description;
    gui.domElement.append(accessible);
    label.setAttribute('aria-describedby', [oldDescription, accessible.id].filter(Boolean).join(' '));
    listen(label, 'pointerenter', () => show(entry));
    listen(label, 'pointerleave', leave);
    listen(label, 'focus', () => show(entry));
    listen(label, 'blur', leave);
    listen(label, 'click', e => { if(label.tagName !== 'BUTTON'){e.preventDefault();label.focus();} show(entry); });
    listen(label, 'keydown', e => {
      if (label.tagName !== 'BUTTON' && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); show(entry); }
    });
    cleanup.push(() => {
      accessible.remove(); label.classList.remove('lab-help-label'); delete label.dataset.helpKey;
      if (oldTabIndex === null) label.removeAttribute('tabindex'); else label.setAttribute('tabindex', oldTabIndex);
      if (oldDescription === null) label.removeAttribute('aria-describedby'); else label.setAttribute('aria-describedby', oldDescription);
    });
  }
  listen(card, 'pointerenter', () => { overCard = true; clearTimeout(timer); });
  listen(card, 'pointerleave', () => { overCard = false; leave(); });
  listen(document, 'pointerdown', e => { if(current && !card.contains(e.target) && !current.label.contains(e.target)) hide(); }, true);
  listen(document, 'keydown', e => {
    if (!card.hidden && e.key === 'Escape') { hide(); e.preventDefault(); e.stopPropagation(); }
  }, true);
  listen(window, 'scroll', hide, true);
  listen(window, 'resize', place);
  return { dispose() { hide(); for(const dispose of cleanup)dispose(); card.remove(); } };
}
