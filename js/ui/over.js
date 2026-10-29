import { h, clear } from './dom.js';
import { getPlayer } from '../rules.js';

export function mountOver(root, session, app) {
  const title = h('h2', { class: 'center' });
  const list = h('ol', { class: 'ranking' });
  const newGameBtn = h('button', {
    class: 'btn primary block',
    onclick: () => session.send({ type: 'backToLobby', seed: Math.floor(Math.random() * 1e9) }),
  }, '⚓ New voyage (back to lobby)');

  root.append(h('div', { class: 'screen' },
    h('h1', {}, '🏆'),
    title,
    h('div', { class: 'card' }, list),
    session.isHost ? newGameBtn : h('p', { class: 'hint center' }, 'Waiting for the captain to start a new voyage…'),
    h('button', { class: 'btn ghost block', onclick: () => app.leave() }, 'Leave')));

  return {
    update(state) {
      const winner = getPlayer(state, state.winner);
      title.textContent = winner ? `${winner.name} rules the seas!` : 'The voyage is over';
      clear(list);
      [...state.players].sort((a, b) => b.gold - a.gold).forEach(p => list.append(h('li', {},
        h('span', { class: 'dot', style: { background: p.color } }),
        h('span', { class: 'grow' }, p.name),
        h('span', {}, `💰 ${p.gold}`))));
    },
    unmount() {},
  };
}
