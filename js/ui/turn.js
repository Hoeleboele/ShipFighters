import { h, clear, openModal } from './dom.js';
import { AP_PER_TURN, currentPlayer, fireTargets, boardTargets, tileAt, shotsFor } from '../rules.js';
import { openSail } from './sail.js';
import { openShop } from './shop.js';
import { openChart } from './chart.js';

function pickTarget(title, targets, onPick) {
  const modal = openModal(title);
  targets.forEach(q => modal.body.append(h('button', {
    class: 'btn block',
    style: { marginBottom: '8px' },
    onclick: () => { modal.close(); onPick(q); },
  }, h('span', { class: 'dot', style: { background: q.color } }), `${q.name} (❤ ${q.hp}, 💰 ${q.gold})`)));
}

function chooseAndSend(title, targets, send) {
  if (targets.length === 1) send(targets[0]);
  else pickTarget(title, targets, send);
}

export function renderTurnBar(bar, state, me, ctx) {
  const cur = currentPlayer(state);
  const send = intent => ctx.session.send(intent);
  const chartBtn = h('button', { class: 'btn', onclick: () => openChart(ctx) }, '🗺 Chart');
  clear(bar);

  if (cur.id !== me.id) {
    bar.append(
      h('div', { class: 'waiting' }, h('span', { class: 'dot', style: { background: cur.color } }), `${cur.name}'s turn`, !cur.connected && ' (offline)'),
      h('div', { class: 'actions' },
        chartBtn,
        ctx.session.isHost && !cur.connected && h('button', {
          class: 'btn danger',
          onclick: () => confirm(`Skip ${cur.name}'s turn?`) && send({ type: 'forceEndTurn' }),
        }, `Skip ${cur.name}`)));
    return;
  }

  const { ap, mp } = state.turn;
  const noAp = ap < 1;
  const portTargets = fireTargets(state, me, 'port');
  const starTargets = fireTargets(state, me, 'starboard');
  const canShoot = shotsFor(me) > 0;
  const boards = me.crew.boarder > 0 ? boardTargets(state, me) : [];
  const tileType = tileAt(state.map, me.x, me.y)?.type;

  const fire = (side, targets) => chooseAndSend(`Fire ${side}`, targets, q => send({ type: 'fire', side, target: q.id }));

  let missionBtn = null;
  if (tileType === 'mission') {
    if (!me.mission) missionBtn = h('button', { class: 'btn gold', onclick: () => send({ type: 'takeMission' }) }, '📜 Take mission');
    else if (me.mission.stage === 'return') missionBtn = h('button', { class: 'btn gold', onclick: () => send({ type: 'collectMission' }) }, `💰 Collect ${me.mission.reward}`);
  }

  bar.append(
    h('div', { class: 'turn-status' },
      h('span', {}, `⚡ AP ${'●'.repeat(ap)}${'○'.repeat(Math.max(0, AP_PER_TURN - ap))}`),
      h('span', {}, `⛵ MP ${mp}`)),
    h('div', { class: 'actions' },
      h('button', { class: 'btn primary', disabled: mp < 1, onclick: () => openSail(ctx) }, '⛵ Sail'),
      h('button', { class: 'btn', disabled: noAp || !canShoot || !portTargets.length, onclick: () => fire('port', portTargets) }, `◀ Fire port${portTargets.length ? ` (${portTargets.length})` : ''}`),
      h('button', { class: 'btn', disabled: noAp || !canShoot || !starTargets.length, onclick: () => fire('starboard', starTargets) }, `Fire starboard${starTargets.length ? ` (${starTargets.length})` : ''} ▶`),
      me.crew.boarder > 0 && h('button', {
        class: 'btn', disabled: noAp || !boards.length,
        onclick: () => chooseAndSend('Board which ship?', boards, q => send({ type: 'board', target: q.id })),
      }, '🏴‍☠️ Board'),
      tileType === 'port' && h('button', { class: 'btn gold', onclick: () => openShop(ctx) }, '⚓ Market'),
      missionBtn,
      chartBtn,
      h('button', { class: 'btn danger', onclick: () => send({ type: 'endTurn' }) }, '⏭ End turn')));
}
