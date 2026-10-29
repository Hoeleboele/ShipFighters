import { h } from './dom.js';

export function toast(text, kind = 'info', ms = 4000) {
  const root = document.getElementById('toasts');
  const el = h('div', { class: `toast toast-${kind}` }, text);
  root.append(el);
  while (root.children.length > 4) root.firstChild.remove();
  setTimeout(() => el.classList.add('out'), ms);
  setTimeout(() => el.remove(), ms + 450);
}

export function showEvents(events, myId) {
  for (const e of events) {
    const aboutMe = e.pid === myId || e.target === myId;
    toast(e.text, e.kind, aboutMe || e.kind === 'win' ? 6500 : 4000);
    if (e.target === myId && (e.kind === 'fire' || e.kind === 'board')) navigator.vibrate?.([300, 80, 300]);
    if (e.kind === 'sunk' && e.pid === myId) navigator.vibrate?.([600, 150, 600]);
  }
}
