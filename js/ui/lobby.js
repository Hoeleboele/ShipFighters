import { h, clear } from './dom.js';
import { toast } from './events.js';

export function mountLobby(root, session, app) {
  const isHost = session.isHost;
  const playersEl = h('ul', { class: 'players' });
  const shareUrl = `${location.origin}${location.pathname}?room=${session.code}`;
  const startBtn = h('button', { class: 'btn primary block', onclick: () => session.send({ type: 'startLineup', solo: app.debug }) }, '⛵ Gather the fleet');
  const waitEl = h('p', { class: 'hint center' });

  const num = (min, max) => h('input', { type: 'number', min, max, inputmode: 'numeric', onchange: sendSettings });
  const colsIn = num(6, 26);
  const rowsIn = num(4, 20);
  const goalIn = num(30, 500);

  function sendSettings() {
    session.send({ type: 'settings', cols: colsIn.value, rows: rowsIn.value, goldGoal: goalIn.value });
  }

  async function share() {
    try {
      if (navigator.share) await navigator.share({ title: 'ShipFighter', text: `Join my pirate fleet! Room ${session.code}`, url: shareUrl });
      else {
        await navigator.clipboard.writeText(shareUrl);
        toast('Link copied!');
      }
    } catch {
      // User cancelled the share sheet.
    }
  }

  const settingsCard = h('div', { class: 'card' },
    h('h3', {}, 'Voyage settings'),
    h('div', { class: 'settings-grid' },
      h('div', {}, h('label', {}, 'Columns'), colsIn),
      h('div', {}, h('label', {}, 'Rows'), rowsIn),
      h('div', {}, h('label', {}, 'Gold goal'), goalIn)),
    h('p', { class: 'hint' }, 'One space ≈ one phone (taller than wide). Example: a 160 × 90 cm table fits about 20 columns × 5 rows. Columns are letters A, B, C…; row 1 is the far (North) edge.'));

  root.append(h('div', { class: 'screen' },
    h('h2', { class: 'center' }, 'Harbour lobby'),
    h('div', { class: 'card center' },
      h('p', { class: 'hint' }, 'Room code'),
      h('p', { class: 'room-code' }, session.code),
      h('button', { class: 'btn small', onclick: share }, '🔗 Share invite link')),
    h('div', { class: 'card' }, h('h3', {}, 'Fleet (2–6 ships)'), playersEl),
    isHost && settingsCard,
    isHost ? startBtn : waitEl,
    h('button', { class: 'btn ghost block', onclick: () => app.leave() }, 'Leave room')));

  return {
    update(state) {
      clear(playersEl);
      state.players.forEach((p, i) => {
        playersEl.append(h('li', {},
          h('span', { class: 'dot', style: { background: p.color } }),
          h('span', { class: 'grow' }, p.name, p.id === session.myId ? ' (you)' : ''),
          i === 0 && h('span', { class: 'tag' }, 'captain'),
          !p.connected && h('span', { class: 'tag off' }, 'offline'),
          isHost && p.id !== session.myId && h('button', { class: 'btn small ghost', 'aria-label': `Remove ${p.name}`, onclick: () => session.send({ type: 'kick', target: p.id }) }, '✕')));
      });
      if (isHost) {
        for (const [input, value] of [[colsIn, state.settings.cols], [rowsIn, state.settings.rows], [goalIn, state.settings.goldGoal]]) {
          if (document.activeElement !== input) input.value = value;
        }
        const enough = state.players.length >= 2 || app.debug;
        startBtn.disabled = !enough;
        startBtn.textContent = enough ? '⛵ Gather the fleet' : 'Waiting for at least 2 ships…';
      } else {
        waitEl.textContent = `Map ${state.settings.cols} × ${state.settings.rows}, gold goal ${state.settings.goldGoal}. Waiting for the captain to start…`;
      }
    },
    unmount() {},
  };
}
