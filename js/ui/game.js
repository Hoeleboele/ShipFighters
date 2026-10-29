import { h, svg } from './dom.js';
import { getPlayer, currentPlayer } from '../rules.js';
import { renderBoard, renderHud } from './pawn.js';
import { renderTurnBar } from './turn.js';

export function mountGame(root, session, app) {
  const hud = h('div', { class: 'hud' });
  const board = svg({ viewBox: '0 0 300 600', preserveAspectRatio: 'xMidYMid meet', class: 'board', role: 'img', 'aria-label': 'Your ship and the 8 spaces around it' });
  const bar = h('div', { class: 'turnbar' });
  const wrap = h('div', { class: 'game' }, hud, h('div', { class: 'board-wrap' }, board), bar);
  root.append(wrap);

  // Shared with overlays so they can refresh on every state update.
  const ctx = { session, app, state: null, overlay: null };
  let wasMyTurn = false;

  return {
    update(state) {
      ctx.state = state;
      const me = getPlayer(state, session.myId);
      const myTurn = currentPlayer(state)?.id === me.id;
      if (myTurn && !wasMyTurn) navigator.vibrate?.([200, 100, 200]);
      wasMyTurn = myTurn;
      wrap.classList.toggle('my-turn', myTurn);
      renderHud(hud, state, me);
      renderBoard(board, state, me);
      renderTurnBar(bar, state, me, ctx);
      ctx.overlay?.update(state);
    },
    unmount() {
      ctx.overlay?.close();
    },
  };
}
