import { h, svgFromMarkup } from './dom.js';
import { COLORS } from '../rules.js';
import { CODE_RE } from '../net.js';
import { shipSvg } from '../art.js';

export function mountStart(root, { profile, prefillCode, savedHost, message, onCreate, onJoin, onResume }) {
  let color = COLORS.includes(profile.color) ? profile.color : COLORS[0];
  const nameInput = h('input', { type: 'text', maxlength: 16, placeholder: 'Captain name', value: profile.name || '' });
  const codeInput = h('input', { type: 'text', class: 'code-input', maxlength: 4, placeholder: 'CODE', value: prefillCode || '', autocapitalize: 'characters', autocomplete: 'off' });
  const errorEl = h('p', { class: 'error' }, message || '');
  const hero = svgFromMarkup(shipSvg(color), { viewBox: '0 0 100 200', class: 'hero' });

  const swatches = h('div', { class: 'swatches' }, COLORS.map(c => h('button', {
    class: `swatch${c === color ? ' selected' : ''}`,
    style: { background: c },
    'aria-label': `Colour ${c}`,
    onclick: e => {
      color = c;
      swatches.querySelectorAll('.swatch').forEach(s => s.classList.remove('selected'));
      e.currentTarget.classList.add('selected');
      hero.innerHTML = shipSvg(color);
    },
  })));

  const readProfile = () => {
    const name = nameInput.value.trim().slice(0, 16);
    if (!name) {
      errorEl.textContent = 'Every captain needs a name.';
      nameInput.focus();
      return null;
    }
    return { name, color };
  };

  const create = () => {
    const p = readProfile();
    if (p) onCreate(p);
  };
  const join = () => {
    const p = readProfile();
    if (!p) return;
    const code = codeInput.value.trim().toUpperCase();
    if (!CODE_RE.test(code)) {
      errorEl.textContent = 'Room codes are 4 letters/numbers.';
      return;
    }
    onJoin(code, p);
  };
  const resume = () => {
    const p = readProfile();
    if (p) onResume(p);
  };

  root.append(h('div', { class: 'screen' },
    h('h1', {}, 'ShipFighter'),
    hero,
    h('p', { class: 'center hint' }, 'Your phone is your pirate ship. Put it on the table and sail!'),
    errorEl,
    !window.isSecureContext && h('p', { class: 'error' }, 'Open this page over HTTPS, otherwise motion sensors and screen wake lock are blocked.'),
    h('div', { class: 'card' },
      h('label', {}, 'Captain name'), nameInput,
      h('label', {}, 'Ship colour'), swatches),
    h('div', { class: 'card stack' },
      h('h3', {}, 'Host a new voyage'),
      h('button', { class: 'btn primary block', onclick: create }, '🏴‍☠️ Create room'),
      savedHost && h('button', { class: 'btn block', onclick: resume }, `↻ Resume hosting room ${savedHost.code}`)),
    h('div', { class: 'card stack' },
      h('h3', {}, 'Join a voyage'),
      codeInput,
      h('button', { class: 'btn gold block', onclick: join }, '⚓ Join room')),
    h('details', { class: 'card' },
      h('summary', {}, 'How to play'),
      h('ul', {},
        h('li', {}, 'One player creates a room; others join with the 4-character code.'),
        h('li', {}, 'Line up all phones side by side; their tops point "North".'),
        h('li', {}, 'Each phone is a ship on a grid of phone-sized spaces. The screen shows the 8 spaces around it.'),
        h('li', {}, 'On your turn: 3 action points (fire, board, shop) and move points to sail.'),
        h('li', {}, 'Ships only sail forward. Turning 90° costs 1 move point. Wind changes the cost per space: behind 2, side 3, against 6.'),
        h('li', {}, 'Physically move your phone, then confirm the course on screen.'),
        h('li', {}, 'Cannons only fire from the sides (port/starboard), up to 2 spaces.'),
        h('li', {}, 'First to the gold goal wins!')))));

  return { update() {}, unmount() {} };
}
