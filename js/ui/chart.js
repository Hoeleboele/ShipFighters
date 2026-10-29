import { h, clear, svg, esc, openModal } from './dom.js';
import { getPlayer, isInFog, cellName } from '../rules.js';
import { SVG_DEFS, tileSvg, shipSvg, TILE_INFO } from '../art.js';
import { missionText } from './pawn.js';

function renderChart(svgEl, state, me) {
  const { cols, rows, tiles } = state.map;
  const target = me.mission?.stage === 'go' ? me.mission.target : null;
  const parts = [SVG_DEFS];
  tiles.forEach((tile, i) => {
    const x = (i % cols) * 100;
    const y = Math.floor(i / cols) * 200;
    const seen = me.seen[i] === '1';
    parts.push(`<g transform="translate(${x} ${y})">${seen ? tileSvg(tile) : '<rect width="100" height="200" fill="#d9c08e" stroke="#b39a66"/>'}</g>`);
    parts.push(`<text x="${x + 6}" y="${y + 18}" font-size="16" fill="${seen ? '#ffffffcc' : '#8a6a3a'}">${cellName(i % cols, Math.floor(i / cols))}</text>`);
    if (i === target) parts.push(`<rect x="${x + 5}" y="${y + 5}" width="90" height="190" fill="none" stroke="#c62828" stroke-width="8" stroke-dasharray="16 10"/>`);
  });
  for (const p of state.players) {
    if (p.id !== me.id && isInFog(state, p)) continue;
    const cx = p.x * 100 + 50;
    const cy = p.y * 200 + 100;
    parts.push(`<g transform="translate(${cx} ${cy}) rotate(${p.heading * 90}) scale(${p.heading % 2 ? 0.5 : 0.7}) translate(-50 -100)">${shipSvg(p.color, p.cannons)}</g>`);
    parts.push(`<text x="${cx}" y="${cy + 92}" font-size="18" text-anchor="middle" fill="#fff" stroke="#000" stroke-width="4" paint-order="stroke">${esc(p.name)}</text>`);
  }
  svgEl.setAttribute('viewBox', `0 0 ${cols * 100} ${rows * 200}`);
  svgEl.innerHTML = parts.join('');
}

export function openChart(ctx) {
  const { session } = ctx;
  const modal = openModal("🗺 Captain's chart", { onClose: () => { ctx.overlay = null; } });
  const chart = svg({ class: 'chart' });
  const info = h('div', {});
  const log = h('ol', { class: 'log', reversed: true });

  modal.body.append(
    h('p', { class: 'hint' }, 'North (row 1) is the side the phone tops pointed to during the line-up. Only explored spaces are shown.'),
    h('div', { class: 'chart-wrap' }, chart),
    info,
    h('div', { class: 'legend' }, Object.values(TILE_INFO).map(t => h('div', {}, `${t.icon} ${t.name}: ${t.desc}`))),
    h('h3', {}, "Ship's log"),
    log,
    h('button', { class: 'btn ghost block', onclick: () => ctx.app.leave() }, 'Leave game'));

  function refresh() {
    const state = ctx.state;
    if (state.phase !== 'playing') {
      modal.close();
      return;
    }
    const me = getPlayer(state, session.myId);
    renderChart(chart, state, me);
    clear(info).append(
      h('p', {}, missionText(state, me)),
      h('p', { class: 'hint' }, `Round ${state.round}. Crew: ${Object.entries(me.crew).filter(([, n]) => n > 0).map(([k, n]) => `${n} ${k}`).join(', ') || 'none'}.`));
    clear(log);
    [...state.log].reverse().slice(0, 25).forEach(line => log.append(h('li', {}, line)));
  }

  ctx.overlay = { update: refresh, close: () => modal.close() };
  refresh();
}
