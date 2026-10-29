import { h, clear } from './dom.js';
import { cellName, getPlayer } from '../rules.js';
import { calibrateNorth, hasCompass } from '../sensors.js';
import { toast } from './events.js';

export function mountLineup(root, session) {
  const meCard = h('div', { class: 'lineup-me' });
  const orderEl = h('div', { class: 'lineup-order' });
  const statusEl = h('ul', { class: 'players' });
  const calibrateBtn = h('button', { class: 'btn primary block', onclick: calibrate }, '🧭 My phone is in place');
  const startBtn = h('button', { class: 'btn gold block', onclick: start }, '⛵ Set sail!');
  let allReady = false;

  function calibrate() {
    if (!calibrateNorth()) toast(hasCompass() ? 'Compass not ready, try again.' : 'No compass found: turns will need manual input.', 'error');
    session.send({ type: 'calibrated' });
  }

  function start() {
    if (!allReady && !confirm('Not every ship is calibrated yet. Set sail anyway?')) return;
    session.send({ type: 'startGame' });
  }

  root.append(h('div', { class: 'screen' },
    h('h2', { class: 'center' }, 'Line up the fleet'),
    meCard,
    h('div', { class: 'card' },
      h('ol', {},
        h('li', {}, 'Lay all phones flat, side by side, along your edge of the table in the order below (left to right).'),
        h('li', {}, 'Point every phone top the same way: away from you. That direction is North for the whole game.'),
        h('li', {}, 'Keep the phone still and tap the button.')),
      orderEl),
    calibrateBtn,
    h('div', { class: 'card' }, h('h3', {}, 'Ready?'), statusEl),
    session.isHost && startBtn));

  return {
    update(state) {
      const me = getPlayer(state, session.myId);
      const idx = state.players.indexOf(me);
      const left = state.players[idx - 1];
      const right = state.players[idx + 1];
      clear(meCard);
      meCard.style.background = me.color;
      meCard.append(
        h('div', { class: 'lineup-arrow' }, '⬆ North ⬆'),
        h('div', { class: 'big' }, `#${idx + 1}`),
        h('div', {}, me.name, ` · start ${cellName(me.x, me.y)}`),
        h('div', { class: 'hint' }, left ? `◀ ${left.name} on your left` : '◀ left end', ' · ', right ? `${right.name} on your right ▶` : 'right end ▶'));

      clear(orderEl);
      state.players.forEach((p, i) => orderEl.append(h('div', { class: `slot${p.id === me.id ? ' me' : ''}`, style: { background: p.color } }, i + 1)));

      clear(statusEl);
      state.players.forEach(p => statusEl.append(h('li', {},
        h('span', { class: 'dot', style: { background: p.color } }),
        h('span', { class: 'grow' }, p.name),
        p.calibrated ? h('span', { class: 'tag ok' }, 'ready') : h('span', { class: 'tag' }, 'placing…'))));

      calibrateBtn.textContent = me.calibrated ? '🧭 Recalibrate' : '🧭 My phone is in place';
      allReady = state.players.every(p => p.calibrated);
      startBtn.textContent = allReady ? '⛵ Set sail!' : '⛵ Set sail (waiting for ships…)';
    },
    unmount() {},
  };
}
