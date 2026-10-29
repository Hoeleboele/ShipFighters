import { h, clear, openModal } from './dom.js';
import { getPlayer, currentPlayer, planPath, cellName, DIR_NAMES, STEP_COST, TURN_COST, windRelation, DIRS } from '../rules.js';
import { startTracking, stopTracking, hasMotion, physicalHeading } from '../sensors.js';

const STEP_LABEL = { F: '⬆', L: '↶', R: '↷' };
const REL_TEXT = { tail: 'wind behind', side: 'side wind', head: 'against the wind' };

export function openSail(ctx) {
  const { session } = ctx;
  let steps = [];
  let tracking = false;

  const modal = openModal('⛵ Set sail', {
    onClose: () => {
      stopTracking();
      ctx.overlay = null;
    },
  });

  const infoEl = h('div', { class: 'hint' });
  const warnEl = h('p', { class: 'error' });
  const courseEl = h('div', { class: 'course' });
  const summaryEl = h('p', {});
  const errorEl = h('p', { class: 'error' });
  const trackBtn = h('button', { class: 'btn block', onclick: toggleTracking });
  const confirmBtn = h('button', { class: 'btn primary block', onclick: confirmCourse }, '✔ Confirm course');
  const stepBtn = (label, fn) => h('button', { class: 'btn', onclick: fn }, label);

  modal.body.append(
    infoEl,
    warnEl,
    trackBtn,
    courseEl,
    h('div', { class: 'step-buttons' },
      stepBtn('↶ Turn left', () => add('L')),
      stepBtn('⬆ Forward', () => add('F')),
      stepBtn('↷ Turn right', () => add('R')),
      stepBtn('⌫ Undo', () => { halt(); steps.pop(); refresh(); }),
      stepBtn('✖ Clear', () => { halt(); steps = []; refresh(); })),
    summaryEl,
    errorEl,
    confirmBtn);

  function halt() {
    if (!tracking) return;
    const res = stopTracking();
    if (res) steps = res;
    tracking = false;
  }

  function toggleTracking() {
    if (tracking) halt();
    else {
      steps = [];
      tracking = startTracking(onTrack);
    }
    refresh();
  }

  function onTrack(s) {
    if (s.join('') === steps.join('')) return;
    steps = s;
    refresh();
  }

  function add(step) {
    halt();
    steps.push(step);
    refresh();
  }

  function refresh() {
    const state = ctx.state;
    const me = getPlayer(state, session.myId);
    if (currentPlayer(state)?.id !== me.id) {
      modal.close();
      return;
    }
    const mp = state.turn.mp;
    const costs = [0, 1, 2, 3].map(d => `${DIR_NAMES[d]} ${STEP_COST[windRelation(d, state.wind)]}`).join(' · ');
    clear(infoEl).append(
      h('p', {}, `Move points: ${mp}. Forward cost by heading (${REL_TEXT[windRelation(me.heading, state.wind)]} now): ${costs}. Turn 90° = ${TURN_COST}.`),
      h('p', {}, 'Slide your phone forward and rotate it 90° to turn, then tap "Done moving". Fix the course with the buttons if needed.'));

    const phys = physicalHeading();
    warnEl.textContent = phys !== null && phys !== me.heading && !tracking && steps.length === 0
      ? `Your phone seems to point ${DIR_NAMES[phys]}, but your ship faces ${DIR_NAMES[me.heading]}. Check its position.`
      : '';

    trackBtn.hidden = !hasMotion();
    trackBtn.textContent = tracking ? '✋ Done moving' : '📡 Track phone movement';

    clear(courseEl);
    if (!steps.length) courseEl.append(h('span', { class: 'hint' }, tracking ? 'Move your phone…' : 'No course plotted yet.'));
    steps.forEach(s => courseEl.append(h('span', { class: `chip${s === 'F' ? '' : ' turn'}` }, STEP_LABEL[s])));

    const plan = steps.length ? planPath(state, me, steps) : null;
    let error = plan?.error || '';
    if (plan && !error && plan.cost > mp) error = `Course costs ${plan.cost} but you only have ${mp} move points.`;
    errorEl.textContent = error;
    summaryEl.textContent = plan && !plan.error
      ? `Cost ${plan.cost}/${mp} MP → ends at ${cellName(plan.x, plan.y)} facing ${DIR_NAMES[plan.heading]} (${describeMove(me, plan)}).`
      : '';
    confirmBtn.disabled = tracking || !plan || !!error;
  }

  function confirmCourse() {
    session.send({ type: 'sail', steps });
    modal.close();
  }

  ctx.overlay = { update: refresh, close: () => modal.close() };
  if (hasMotion()) tracking = startTracking(onTrack);
  refresh();
}

function describeMove(me, plan) {
  const dx = plan.x - me.x;
  const dy = plan.y - me.y;
  const f = DIRS[me.heading];
  const ahead = dx * f[0] + dy * f[1];
  const right = dx * -f[1] + dy * f[0];
  const parts = [];
  if (ahead) parts.push(`${Math.abs(ahead)} ${ahead > 0 ? 'ahead' : 'back'}`);
  if (right) parts.push(`${Math.abs(right)} to ${right > 0 ? 'starboard' : 'port'}`);
  return parts.join(', ') || 'same space';
}
