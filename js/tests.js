import { applyIntent, createState, planPath, getPlayer, fireTargets, maxMp, tileIndex } from './rules.js';
import { generateMap } from './map.js';

const results = [];
function test(name, fn) {
  try {
    fn();
    results.push({ name, ok: true });
  } catch (err) {
    results.push({ name, ok: false, msg: err.message });
  }
}
function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'assertion failed');
}
const fixedRng = values => {
  let i = 0;
  return () => values[i++ % values.length];
};

function act(s, pid, intent, opts = {}) {
  const res = applyIntent(s, pid, intent, { rng: () => 0.5, ...opts });
  if (res.error) throw new Error(`${intent.type}: ${res.error}`);
  return res.state;
}

// Two ships on an all-sea 10x6 map, A to move, wind blowing North.
function setup() {
  let s = createState('TEST', 'seed');
  s = act(s, 'A', { type: 'join', name: 'Anna' }, { isHost: true });
  s = act(s, 'B', { type: 'join', name: 'Bob' });
  s = act(s, 'A', { type: 'startLineup' }, { isHost: true });
  s.map.tiles = s.map.tiles.map(() => ({ type: 'sea' }));
  s = act(s, 'A', { type: 'startGame' }, { isHost: true, rng: () => 0 });
  return s;
}
const setTile = (s, x, y, type) => { s.map.tiles[tileIndex(s.map, x, y)] = { type }; };

test('same seed generates the same map', () => {
  const a = JSON.stringify(generateMap(12, 6, 'X'));
  const b = JSON.stringify(generateMap(12, 6, 'X'));
  assert(a === b);
  assert(JSON.stringify(generateMap(12, 6, 'Y')) !== a, 'different seeds should differ');
});

test('start row stays open sea', () => {
  const m = generateMap(12, 6, 'Z');
  for (let x = 0; x < 12; x++) assert(m.tiles[5 * 12 + x].type === 'sea');
});

test('step cost follows the wind (tail 2, side 3, head 6)', () => {
  const s = setup();
  const a = getPlayer(s, 'A');
  s.wind = 0;
  assert(planPath(s, a, ['F']).cost === 2, 'tailwind');
  s.wind = 1;
  assert(planPath(s, a, ['F']).cost === 3, 'side wind');
  s.wind = 2;
  assert(planPath(s, a, ['F']).cost === 6, 'headwind');
});

test('turning alone is rejected', () => {
  const s = setup();
  assert(planPath(s, getPlayer(s, 'A'), ['L']).error);
});

test('two turns in a row are rejected', () => {
  const s = setup();
  assert(planPath(s, getPlayer(s, 'A'), ['F', 'L', 'L', 'F']).error);
});

test('turn, forward, turn is accepted and costs MP', () => {
  const s = setup();
  s.wind = 1;
  const plan = planPath(s, getPlayer(s, 'A'), ['R', 'F', 'R']);
  assert(!plan.error, plan.error);
  assert(plan.cost === 1 + 2 + 1, `cost ${plan.cost}`);
});

test('turning after an earlier forward step is allowed', () => {
  let s = setup();
  s.wind = 0;
  s = act(s, 'A', { type: 'sail', steps: ['F'] });
  assert(!planPath(s, getPlayer(s, 'A'), ['L']).error);
});

test('unused MP resets next turn', () => {
  let s = setup();
  s = act(s, 'A', { type: 'sail', steps: ['F'] });
  s = act(s, 'A', { type: 'endTurn' });
  s = act(s, 'B', { type: 'endTurn' });
  assert(s.turn.mp === maxMp(getPlayer(s, 'A')));
});

test('a 3rd navigator adds no MP', () => {
  const s = setup();
  const a = getPlayer(s, 'A');
  a.crew.navigator = 2;
  const two = maxMp(a);
  a.crew.navigator = 3;
  assert(maxMp(a) === two && two === 10);
});

test('reef deals 1 damage and stops movement', () => {
  let s = setup();
  s.wind = 0;
  const a = getPlayer(s, 'A');
  setTile(s, a.x, a.y - 1, 'reef');
  s = act(s, 'A', { type: 'sail', steps: ['F', 'F'] });
  const a2 = getPlayer(s, 'A');
  assert(a2.hp === 9 && a2.y === a.y - 1, `hp ${a2.hp} y ${a2.y}`);
});

test('storm roll 1-3 deals 2 damage', () => {
  let s = setup();
  s.wind = 0;
  const a = getPlayer(s, 'A');
  setTile(s, a.x, a.y - 1, 'storm');
  s = act(s, 'A', { type: 'sail', steps: ['F'] }, { rng: () => 0 });
  assert(getPlayer(s, 'A').hp === 8);
});

test('ships in fog cannot be fired at but can be boarded', () => {
  let s = setup();
  const a = getPlayer(s, 'A');
  const b = getPlayer(s, 'B');
  // B is directly starboard of A after line-up.
  assert(fireTargets(s, a, 'starboard').some(q => q.id === 'B'), 'B in range');
  setTile(s, b.x, b.y, 'fog');
  assert(!fireTargets(s, a, 'starboard').length, 'fog hides B');
  a.crew.boarder = 1;
  s = act(s, 'A', { type: 'board', target: 'B' });
  assert(getPlayer(s, 'A').gold === 13);
});

test('cannons only fire to the sides', () => {
  const s = setup();
  const a = getPlayer(s, 'A');
  assert(!fireTargets(s, a, 'port').length);
  getPlayer(s, 'B').x = a.x;
  getPlayer(s, 'B').y = a.y - 1;
  assert(!fireTargets(s, a, 'starboard').length, 'bow is not a broadside');
});

test('sinking respawns, gives half gold to the attacker, skips a turn', () => {
  let s = setup();
  const b = getPlayer(s, 'B');
  b.hp = 1;
  b.gold = 20;
  setTile(s, 0, 0, 'port');
  s = act(s, 'A', { type: 'fire', side: 'starboard', target: 'B' }, { rng: () => 0.99 });
  const a2 = getPlayer(s, 'A');
  const b2 = getPlayer(s, 'B');
  assert(a2.gold === 20 && b2.gold === 10, `gold ${a2.gold}/${b2.gold}`);
  assert(b2.x === 0 && b2.y === 0 && b2.hp === b2.maxHp && b2.skip === 1);
  s = act(s, 'A', { type: 'endTurn' });
  assert(s.turn.idx === 0, 'B was skipped');
});

test('starving crew deserts', () => {
  let s = setup();
  getPlayer(s, 'A').food = 0;
  s = act(s, 'A', { type: 'endTurn' });
  s = act(s, 'B', { type: 'endTurn' });
  assert(getPlayer(s, 'A').crew.sailor === 2);
});

test('reaching the gold goal ends the game', () => {
  let s = setup();
  const a = getPlayer(s, 'A');
  a.gold = 99;
  a.crew.boarder = 1;
  s = act(s, 'A', { type: 'board', target: 'B' });
  assert(s.phase === 'over' && s.winner === 'A');
});

test('only the current player may act', () => {
  const s = setup();
  assert(applyIntent(s, 'B', { type: 'endTurn' }).error);
});

test('fixed rng helper is deterministic', () => {
  const r = fixedRng([0.1, 0.2]);
  assert(r() === 0.1 && r() === 0.2 && r() === 0.1);
});

const out = document.getElementById('results');
const failed = results.filter(r => !r.ok).length;
out.innerHTML = '';
const head = document.createElement('h2');
head.textContent = failed ? `${failed} of ${results.length} failed` : `All ${results.length} tests passed`;
head.style.color = failed ? '#a8322a' : '#2e7d32';
out.append(head);
for (const r of results) {
  const li = document.createElement('li');
  li.textContent = `${r.ok ? '✔' : '✘'} ${r.name}${r.ok ? '' : ` — ${r.msg}`}`;
  li.style.color = r.ok ? '#2e7d32' : '#a8322a';
  out.append(li);
}
console.log(results);
