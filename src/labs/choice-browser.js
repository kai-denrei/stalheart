// Progressive enhancement of existing controls. The select remains the value
// owner; one real change event reaches the lab's existing controller/validator.
export function mountChoiceBrowser(root, { minimum = 8 } = {}) {
  const controls = new Map();
  const dialog = document.createElement('dialog');
  dialog.className = 'lab-choice-dialog';
  dialog.setAttribute('aria-label', 'Choose a lab setting');
  dialog.innerHTML = '<header><h2></h2><button type="button" data-close aria-label="Close choices">Close</button></header><input type="search" aria-label="Filter choices" placeholder="Search by name or number…"><p role="status" aria-live="polite"></p><div class="lab-choice-results"></div>';
  document.body.append(dialog);
  const heading = dialog.querySelector('h2'), search = dialog.querySelector('input');
  const status = dialog.querySelector('[role=status]'), results = dialog.querySelector('.lab-choice-results');
  let current = null;
  function name(select) {
    const labelled = select.getAttribute('aria-labelledby');
    return (labelled ? labelled.split(/\s+/).map(id => document.getElementById(id)?.textContent || '').join(' ') : '')
      || select.getAttribute('aria-label')
      || select.closest('label')?.childNodes[0]?.textContent?.trim()
      || 'Choose a setting';
  }
  function render() {
    if (!current) return;
    const select = current;
    const words = search.value.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
    const options = [...select.options].filter(option => !option.hidden && !option.parentElement.hidden);
    results.replaceChildren();
    for (const option of options) {
      const group = option.parentElement.tagName === 'OPTGROUP' ? option.parentElement.label : '';
      const label = group ? `${group} — ${option.textContent}` : option.textContent;
      if (!words.every(word => label.toLocaleLowerCase().includes(word))) continue;
      const button = document.createElement('button');
      button.type = 'button'; button.textContent = label;
      button.disabled = select.disabled || option.disabled || option.parentElement.disabled === true;
      button.setAttribute('aria-pressed', String(option.selected));
      button.onclick = () => {
        if (!select.isConnected || select.disabled || button.disabled) return;
        select.selectedIndex = option.index;
        select.dispatchEvent(new Event('change', { bubbles: true }));
        controls.get(select)?.sync();
        dialog.close();
      };
      results.append(button);
    }
    const count = results.childElementCount;
    status.textContent = count ? `${count} of ${options.length} choices` : 'No matches. Try another name or number.';
  }
  search.addEventListener('input', render);
  dialog.querySelector('[data-close]').onclick = () => dialog.close();
  dialog.addEventListener('close', () => {
    // Native close events are queued: an older close must not clear a picker
    // that the user has already reopened.
    if (dialog.open) return;
    const button = controls.get(current)?.button; current = null; button?.focus();
  });
  // Keep scene keyboard shortcuts away from typing and dialog navigation.
  for (const event of ['keydown', 'keyup']) dialog.addEventListener(event, e => {
    e.stopPropagation();
    if (event !== 'keydown') return;
    const buttons = [...results.querySelectorAll('button:not(:disabled)')];
    if (e.key === 'Escape') {
      e.preventDefault(); dialog.close();
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const index = buttons.indexOf(document.activeElement);
      const next = index < 0 ? (e.key === 'ArrowDown' ? 0 : buttons.length - 1)
        : (index + (e.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length;
      buttons[next]?.focus();
    } else if (e.key === 'Enter' && e.target === search) {
      e.preventDefault(); buttons[0]?.click();
    }
  });
  function enhance(select) {
    if (controls.has(select) || select.multiple || select.size > 1) return;
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'lab-choice-trigger';
    button.setAttribute('aria-haspopup', 'dialog');
    const sync = () => {
      const enabled = select.options.length >= minimum;
      select.classList.toggle('lab-choice-native', enabled);
      button.hidden = !enabled;
      button.disabled = select.disabled;
      const label = select.selectedOptions[0]?.textContent || 'Choose…';
      if (button.textContent !== label) button.textContent = label;
      button.setAttribute('aria-label', `${name(select)}: ${label}. Browse choices`);
      if (current === select) {
        if (!enabled || select.disabled) dialog.close();
        else { heading.textContent = name(select); render(); }
      }
    };
    button.onclick = () => {
      current = select; heading.textContent = name(select); search.value = '';
      render(); dialog.showModal(); search.focus();
    };
    select.after(button);
    select.addEventListener('change', sync);
    const observer = new MutationObserver(sync);
    observer.observe(select, { childList: true, subtree: true, characterData: true, attributes: true,
      attributeFilter: ['disabled', 'label', 'hidden', 'selected', 'aria-label', 'aria-labelledby'] });
    // lil-gui updates this display when presets change programmatically.
    const display = select.parentElement.querySelector('.display');
    if (display) observer.observe(display, { childList: true, subtree: true, characterData: true });
    controls.set(select, { button, sync, dispose() {
      observer.disconnect(); select.removeEventListener('change', sync);
      select.classList.remove('lab-choice-native'); button.remove();
    } });
    sync();
  }
  function scan(node) {
    if (node.nodeType !== 1) return;
    if (node.matches('select')) enhance(node);
    node.querySelectorAll('select').forEach(enhance);
  }
  scan(root);
  const observer = new MutationObserver(records => {
    for (const record of records) for (const node of record.addedNodes) scan(node);
    for (const [select, control] of controls) if (!root.contains(select)) {
      if (current === select) dialog.close();
      control.dispose(); controls.delete(select);
    }
  });
  observer.observe(root, { childList: true, subtree: true });
  return { dispose() {
    observer.disconnect();
    for (const control of controls.values()) control.dispose();
    controls.clear(); current = null; dialog.remove();
  } };
}
