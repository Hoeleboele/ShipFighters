import { h, clear, openModal } from './dom.js';
import { getPlayer, currentPlayer, tileAt, crewCount, CREW, UPGRADES, UPGRADE_COST, FOOD_PRICE, REPAIR_PRICE } from '../rules.js';

export function openShop(ctx) {
  const { session } = ctx;
  const send = intent => session.send(intent);
  const modal = openModal('⚓ Port Town market', { onClose: () => { ctx.overlay = null; } });

  const row = (title, desc, price, enabled, onclick) => h('div', { class: 'shop-row' },
    h('div', { class: 'grow' }, h('div', {}, h('b', {}, title)), desc && h('div', { class: 'desc' }, desc)),
    h('button', { class: 'btn small gold', disabled: !enabled, onclick }, price));

  function refresh() {
    const state = ctx.state;
    const me = getPlayer(state, session.myId);
    if (currentPlayer(state)?.id !== me.id || tileAt(state.map, me.x, me.y)?.type !== 'port') {
      modal.close();
      return;
    }
    const ap = state.turn.ap;
    const canAct = ap > 0;
    const repairAmt = Math.min(me.maxHp - me.hp, Math.floor(me.gold / REPAIR_PRICE));
    const foodAmt = Math.min(me.foodCap - me.food, Math.floor(me.gold / FOOD_PRICE));
    const roomAboard = crewCount(me) < me.crewCap;

    clear(modal.body).append(
      h('p', { class: 'hint' }, `💰 ${me.gold} gold · ⚡ ${ap} AP left · every purchase costs 1 AP`),
      h('h3', {}, 'Shipwright & supplies'),
      row(`Repair hull (❤ ${me.hp}/${me.maxHp})`, `${REPAIR_PRICE} gold per HP`, `+${repairAmt} HP · ${repairAmt * REPAIR_PRICE}g`, canAct && repairAmt > 0, () => send({ type: 'repair' })),
      row(`Fill food (🍖 ${me.food}/${me.foodCap})`, `${FOOD_PRICE} gold each. Crew eats ${crewCount(me)} per round.`, `+${foodAmt} · ${foodAmt * FOOD_PRICE}g`, canAct && foodAmt > 0, () => send({ type: 'buyFood' })),
      h('h3', {}, `Tavern: hire crew (👥 ${crewCount(me)}/${me.crewCap})`),
      ...Object.entries(CREW).map(([key, c]) => row(`${c.name} (aboard: ${me.crew[key]})`, c.desc, `${c.cost}g`, canAct && roomAboard && me.gold >= c.cost, () => send({ type: 'hire', crew: key }))),
      h('h3', {}, 'Upgrades'),
      ...Object.entries(UPGRADES).map(([key, u]) => {
        const level = me.levels[key];
        const maxed = level >= UPGRADE_COST.length;
        const cost = UPGRADE_COST[level];
        return row(`${u.name} (level ${level}/${UPGRADE_COST.length})`, u.desc, maxed ? 'max' : `${cost}g`, canAct && !maxed && me.gold >= cost, () => send({ type: 'upgrade', kind: key }));
      }));
  }

  ctx.overlay = { update: refresh, close: () => modal.close() };
  refresh();
}
