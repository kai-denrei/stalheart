import { SENTRIES } from '../content/sentries.js';

export function mountSentryRadial({ select, current, onOpen = () => {}, onClose = () => {} }) {
  const dialog = document.createElement('dialog');
  dialog.className = 'sentry-radial'; dialog.setAttribute('aria-label', 'Choose a Sentry for all towers');
  const close = document.createElement('button'); close.type = 'button';
  close.className = 'sentry-radial-center'; close.textContent = 'All towers\nClose';
  close.setAttribute('aria-label','Close Sentry selection'); close.onclick = () => dialog.close();
  dialog.append(close);
  const buttons = SENTRIES.map((s, i) => {
    const button = document.createElement('button'); button.type = 'button';
    button.className = 'sentry-radial-item'; button.dataset.sentryChoice = s.key;
    button.textContent = s.label;
    const angle = -Math.PI / 2 + i * Math.PI / 4;
    button.style.left = `${50 + 34 * Math.cos(angle)}%`;
    button.style.top = `${50 + 34 * Math.sin(angle)}%`;
    button.onclick = () => { select(s.model); dialog.close(); };
    dialog.append(button); return button;
  });
  let returnFocus = null;
  dialog.addEventListener('close', () => { onClose(); returnFocus?.focus(); });
  dialog.addEventListener('click', e => { if (e.target === dialog) dialog.close(); });
  for(const event of ['keydown','keyup'])dialog.addEventListener(event,e=>{
    e.stopPropagation(); if(event==='keyup')return;
    if(e.key==='Escape'){e.preventDefault();dialog.close();}
    else if(/^[1-8]$/.test(e.key)){e.preventDefault();buttons[Number(e.key)-1].click();}
    else if(['ArrowRight','ArrowDown','ArrowLeft','ArrowUp'].includes(e.key)){
      e.preventDefault();const i=buttons.indexOf(document.activeElement),step=['ArrowRight','ArrowDown'].includes(e.key)?1:-1;
      buttons[(i+step+8)%8].focus();
    }
  });
  document.body.append(dialog);
  return {
    get open() { return dialog.open; },
    show(x, y, focus) {
      if(dialog.open)return;
      returnFocus=focus;
      const size=Math.min(360,innerWidth-16,innerHeight-16);
      dialog.style.width=`${size}px`;dialog.style.height=`${size}px`;
      dialog.style.left=`${Math.max(8,Math.min(innerWidth-size-8,x-size/2))}px`;
      dialog.style.top=`${Math.max(8,Math.min(innerHeight-size-8,y-size/2))}px`;
      for(const [i,s] of SENTRIES.entries())buttons[i].setAttribute('aria-pressed',String(s.model===current()));
      onOpen();dialog.showModal();(buttons.find(b=>b.getAttribute('aria-pressed')==='true')||buttons[0]).focus();
    },
    dispose() { if(dialog.open)dialog.close();dialog.remove(); },
  };
}
