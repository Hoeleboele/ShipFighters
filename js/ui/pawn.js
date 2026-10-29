import { h, clear, esc } from './dom.js';
import { SVG_DEFS, tileSvg, shipSvg, TILE_INFO } from '../art.js';
import { DIRS, DIR_NAMES, tileAt, tileIndex, cellName, crewCount, isInFog, windRelation, STEP_COST } from '../rules.js';

export const ARROWS = ['⬆', '➡', '⬇', '⬅'];
const WIND_LABEL = { tail: 'wind behind', side: 'side wind', head: 'headwind' };

// Ship-relative 3x3 view: screen top is always the bow, so the picture matches the phone on the table.
export function renderBoard(svgEl, state, me) {
  const f = DIRS[me.heading];
  const r = DIRS[(me.heading + 1) % 4];
  const parts = [SVG_DEFS];
  const shipParts = [];
  const target = me.mission?.stage === 'go' ? me.mission.target : null;

  for (let sy = -1; sy <= 1; sy++) {
    for (let sx = -1; sx <= 1; sx++) {
      const wx = me.x + r[0] * sx - f[0] * sy;
      const wy = me.y + r[1] * sx - f[1] * sy;
      const ox = (sx + 1) * 100;
      const oy = (sy + 1) * 200;
      const tile = tileAt(state.map, wx, wy);
      parts.push(`<g transform="translate(${ox} ${oy})">${tileSvg(tile)}</g>`);
      if (tile && target === tileIndex(state.map, wx, wy)) {
        parts.push(`<rect x="${ox + 4}" y="${oy + 4}" width="92" height="192" fill="none" stroke="#ffd54f" stroke-width="5" stroke-dasharray="12 8"/>`);
      }
      if (tile && !(sx === 0 && sy === 0)) {
        parts.push(`<text x="${ox + 6}" y="${oy + 16}" font-size="12" fill="#ffffffaa">${cellName(wx, wy)}</text>`);
      }

      const others = state.players.filter(q => q.id !== me.id && q.x === wx && q.y === wy && !isInFog(state, q));
      const center = sx === 0 && sy === 0;
      others.forEach((q, k) => {
        const rot = ((q.heading - me.heading + 4) % 4) * 90;
        const scale = center || others.length > 1 ? 0.4 : 0.55;
        const cx = ox + (center ? (k % 2 ? 82 : 18) : 50 + (others.length > 1 ? (k % 2 ? 22 : -22) : 0));
        const cy = oy + (center ? 40 + 60 * Math.floor(k / 2) : 100 + (others.length > 1 ? 50 * Math.floor(k / 2) - 25 : 0));
        shipParts.push(`<g transform="translate(${cx} ${cy}) rotate(${rot}) scale(${scale}) translate(-50 -100)">${shipSvg(q.color, q.cannons)}</g>
          <text x="${cx}" y="${cy + 58}" font-size="13" text-anchor="middle" fill="#fff" stroke="#000" stroke-width="3" paint-order="stroke">${esc(q.name)}</text>`);
      });
    }
  }

  parts.push(`<g stroke="#ffffff40" stroke-width="2"><line x1="100" y1="0" x2="100" y2="600"/><line x1="200" y1="0" x2="200" y2="600"/><line x1="0" y1="200" x2="300" y2="200"/><line x1="0" y1="400" x2="300" y2="400"/></g>`);
  parts.push(...shipParts);
  parts.push(`<g transform="translate(150 300) scale(0.92) translate(-50 -100)">${shipSvg(me.color, me.cannons)}</g>`);
  if (isInFog(state, me)) parts.push(`<text x="150" y="395" font-size="14" text-anchor="middle" fill="#fff" stroke="#000" stroke-width="3" paint-order="stroke">hidden in fog</text>`);

  const labelStyle = 'font-size="13" font-weight="bold" fill="#fff" stroke="#000" stroke-width="3" paint-order="stroke" text-anchor="middle"';
  parts.push(`<text x="150" y="208" ${labelStyle}>BOW</text>`);
  parts.push(`<text ${labelStyle} transform="translate(108 300) rotate(-90)">PORT</text>`);
  parts.push(`<text ${labelStyle} transform="translate(192 300) rotate(90)">STARBOARD</text>`);

  const windRot = ((state.wind - me.heading + 4) % 4) * 90;
  parts.push(`<g transform="translate(262 556)"><circle r="30" fill="#000a" stroke="#fff" stroke-width="2"/>
    <g transform="rotate(${windRot})"><path d="M0 -22 l10 16 h-6 v18 h-8 v-18 h-6z" fill="#e3f2fd"/></g>
    <text y="44" font-size="12" text-anchor="middle" fill="#fff" stroke="#000" stroke-width="3" paint-order="stroke">wind</text></g>`);

  svgEl.innerHTML = parts.join('');
}

export function renderHud(el, state, me) {
  clear(el);
  const rel = windRelation(me.heading, state.wind);
  const tile = tileAt(state.map, me.x, me.y);
  el.append(
    h('span', { class: 'name' }, h('span', { class: 'dot', style: { background: me.color } }), me.name),
    h('span', { class: 'stat' }, `❤ ${me.hp}/${me.maxHp}`),
    h('span', { class: 'stat' }, `💰 ${me.gold}/${state.settings.goldGoal}`),
    h('span', { class: 'stat' }, `🍖 ${me.food}/${me.foodCap} (−${crewCount(me)}/round)`),
    h('span', { class: 'stat' }, `👥 ${crewCount(me)}/${me.crewCap}`),
    h('span', { class: 'stat' }, `💣 ${me.cannons}`),
    h('span', { class: 'stat' }, `📍 ${cellName(me.x, me.y)} ${ARROWS[me.heading]} ${DIR_NAMES[me.heading]}`),
    h('span', { class: 'stat' }, `🌬 ${ARROWS[state.wind]} ${WIND_LABEL[rel]} (${STEP_COST[rel]} MP/space)`),
    tile && tile.type !== 'sea' && h('span', { class: 'stat' }, `${TILE_INFO[tile.type].icon} ${TILE_INFO[tile.type].name}`),
    me.skip > 0 && h('span', { class: 'stat' }, '🛠 skips next turn'),
    h('span', { class: 'mission' }, missionText(state, me)));
}

export function missionText(state, me) {
  if (!me.mission) return '📜 No mission. Visit a Mission Port to take one.';
  if (me.mission.stage === 'return') return `📜 Mission done! Return to any Mission Port for ${me.mission.reward} gold.`;
  const tx = me.mission.target % state.map.cols;
  const ty = Math.floor(me.mission.target / state.map.cols);
  return `📜 Mission: sail to ${cellName(tx, ty)} (${TILE_INFO[state.map.tiles[me.mission.target].type].name}) for ${me.mission.reward} gold.`;
}
