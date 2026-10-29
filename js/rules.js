import { generateMap, ISLAND_TYPES } from './map.js';
import { randInt, pick, d6 } from './rng.js';

export const MAX_PLAYERS = 6;
export const COLORS = ['#c0392b', '#2e86de', '#27ae60', '#8e44ad', '#e67e22', '#f1c40f'];
export const DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]];
export const DIR_NAMES = ['North', 'East', 'South', 'West'];
export const AP_PER_TURN = 3;
export const BASE_MP = 6;
export const NAV_MP = 2;
export const MAX_NAV_BONUS = 2;
export const TURN_COST = 1;
export const STEP_COST = { tail: 2, side: 3, head: 6 };
export const FOOD_PRICE = 1;
export const REPAIR_PRICE = 2;
export const UPGRADE_COST = [10, 20, 30];
export const FIRE_RANGE = 2;
export const BOARD_STEAL = 3;

export const CREW = {
  sailor: { name: 'Sailor', cost: 3, desc: 'Mans a cannon. First to desert when food runs out.' },
  gunner: { name: 'Gunner', cost: 6, desc: 'Cannons hit 1 easier (best 2+). Also mans a cannon.' },
  navigator: { name: 'Navigator', cost: 6, desc: `+${NAV_MP} move points (max ${MAX_NAV_BONUS} count).` },
  carpenter: { name: 'Carpenter', cost: 6, desc: 'Repairs 1 HP at the start of your turn.' },
  boarder: { name: 'Boarder', cost: 6, desc: `Board an adjacent ship and steal ${BOARD_STEAL} gold each.` },
};

export const UPGRADES = {
  hull: { name: 'Hull', desc: '+4 max HP (and repairs 4).' },
  cannons: { name: 'Cannons', desc: '+1 cannon (needs crew to fire).' },
  quarters: { name: 'Quarters', desc: '+2 crew capacity.' },
  galley: { name: 'Food Corner', desc: '+8 food storage.' },
};

export const inBounds = (map, x, y) => x >= 0 && y >= 0 && x < map.cols && y < map.rows;
export const tileIndex = (map, x, y) => y * map.cols + x;
export const tileAt = (map, x, y) => (map && inBounds(map, x, y) ? map.tiles[tileIndex(map, x, y)] : null);
export const cellName = (x, y) => String.fromCharCode(65 + x) + (y + 1);
export const crewCount = p => Object.values(p.crew).reduce((a, b) => a + b, 0);
export const getPlayer = (s, id) => s.players.find(p => p.id === id);
export const currentPlayer = s => (s.turn ? s.players[s.turn.idx] : null);
export const turnLeft = h => (h + 3) % 4;
export const turnRight = h => (h + 1) % 4;
export const maxMp = p => BASE_MP + NAV_MP * Math.min(MAX_NAV_BONUS, p.crew.navigator);
export const hitNeed = p => Math.max(2, 4 - p.crew.gunner);
export const shotsFor = p => Math.min(p.cannons, crewCount(p));
export const isInFog = (s, p) => tileAt(s.map, p.x, p.y)?.type === 'fog';
export const chebyshev = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));

export function windRelation(heading, wind) {
  if (heading === wind) return 'tail';
  if ((heading + 2) % 4 === wind) return 'head';
  return 'side';
}
export const stepCost = (heading, wind) => STEP_COST[windRelation(heading, wind)];

export function describeOffset(fromX, fromY, toX, toY) {
  const parts = [];
  const dy = toY - fromY;
  const dx = toX - fromX;
  if (dy < 0) parts.push(`${-dy} north`);
  if (dy > 0) parts.push(`${dy} south`);
  if (dx > 0) parts.push(`${dx} east`);
  if (dx < 0) parts.push(`${-dx} west`);
  return parts.length ? parts.join(', ') : 'nowhere (stay put)';
}

export function fireTargets(s, p, side) {
  const dir = side === 'port' ? turnLeft(p.heading) : turnRight(p.heading);
  const out = [];
  for (let d = 1; d <= FIRE_RANGE; d++) {
    const x = p.x + DIRS[dir][0] * d;
    const y = p.y + DIRS[dir][1] * d;
    for (const q of s.players) {
      if (q.id !== p.id && q.x === x && q.y === y && !isInFog(s, q)) out.push(q);
    }
  }
  return out;
}

export const boardTargets = (s, p) => s.players.filter(q => q.id !== p.id && chebyshev(p, q) <= 1);

export function planPath(s, p, steps) {
  let x = p.x;
  let y = p.y;
  let h = p.heading;
  let cost = 0;
  let last = s.turn?.lastStep ?? null;
  let hasForward = false;
  for (const st of steps) {
    if (st === 'F') {
      cost += stepCost(h, s.wind);
      x += DIRS[h][0];
      y += DIRS[h][1];
      if (!inBounds(s.map, x, y)) return { error: 'That course sails off the edge of the map.', cost };
      hasForward = true;
    } else {
      if (last === 'L' || last === 'R') return { error: 'Sail forward at least 1 space between turns.', cost };
      cost += TURN_COST;
      h = st === 'L' ? turnLeft(h) : turnRight(h);
    }
    last = st;
  }
  if (!hasForward && s.turn?.lastStep !== 'F') {
    return { error: 'A ship cannot turn on the spot. Sail forward before or after turning.', cost };
  }
  return { cost, x, y, heading: h };
}

export function createState(code, seed) {
  return {
    code,
    seed,
    phase: 'lobby',
    settings: { cols: 12, rows: 6, goldGoal: 100 },
    map: null,
    players: [],
    turn: null,
    wind: 0,
    round: 0,
    log: [],
    winner: null,
  };
}

function newPlayer(id, name, color) {
  return {
    id, name, color,
    connected: true,
    calibrated: false,
    x: 0, y: 0, heading: 0,
    hp: 10, maxHp: 10,
    cannons: 2,
    crewCap: 4,
    crew: { sailor: 3, gunner: 0, navigator: 0, carpenter: 0, boarder: 0 },
    food: 10, foodCap: 12,
    gold: 10,
    levels: { hull: 0, cannons: 0, quarters: 0, galley: 0 },
    mission: null,
    skip: 0,
    seen: '',
  };
}

const cleanName = name => String(name ?? '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 16) || 'Pirate';
const clampInt = (v, lo, hi, d) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d;
};

function markSeen(s, p) {
  const arr = p.seen.split('');
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (inBounds(s.map, p.x + dx, p.y + dy)) arr[tileIndex(s.map, p.x + dx, p.y + dy)] = '1';
    }
  }
  p.seen = arr.join('');
}

function checkWin(s, p, ctx) {
  if (s.phase === 'playing' && p.gold >= s.settings.goldGoal) {
    s.phase = 'over';
    s.winner = p.id;
    ctx.events.push({ kind: 'win', pid: p.id, text: `🏆 ${p.name} reached ${s.settings.goldGoal} gold and rules the seas!` });
  }
}

function nearestPort(s, x, y) {
  let best = null;
  s.map.tiles.forEach((t, i) => {
    if (t.type !== 'port') return;
    const px = i % s.map.cols;
    const py = Math.floor(i / s.map.cols);
    const d = Math.abs(px - x) + Math.abs(py - y);
    if (!best || d < best.d) best = { x: px, y: py, d };
  });
  return best || { x, y: s.map.rows - 1 };
}

function sink(s, p, attacker, ctx) {
  const lost = Math.floor(p.gold / 2);
  p.gold -= lost;
  if (attacker) attacker.gold += lost;
  const port = nearestPort(s, p.x, p.y);
  const move = describeOffset(p.x, p.y, port.x, port.y);
  p.x = port.x;
  p.y = port.y;
  p.hp = p.maxHp;
  p.skip = 1;
  markSeen(s, p);
  const by = attacker ? ` by ${attacker.name}` : '';
  const loot = attacker ? `${attacker.name} plunders ${lost} gold` : `${lost} gold sinks to the bottom`;
  ctx.events.push({
    kind: 'sunk', pid: p.id,
    text: `💥 ${p.name} was sunk${by}! ${loot}. Respawn at Port ${cellName(port.x, port.y)}: move the phone ${move}. Skips next turn.`,
  });
  if (attacker) checkWin(s, attacker, ctx);
}

function damage(s, target, amount, attacker, ctx) {
  if (amount <= 0) return false;
  target.hp -= amount;
  if (target.hp > 0) return false;
  sink(s, target, attacker, ctx);
  return true;
}

const MYSTERIES = [
  (s, p, rng) => { const g = randInt(rng, 8, 15); p.gold += g; return `dug up a buried chest with ${g} gold!`; },
  (s, p) => { const f = Math.min(6, p.foodCap - p.food); p.food += f; return `found wild fruit (+${f} food).`; },
  (s, p) => {
    if (crewCount(p) < p.crewCap) { p.crew.sailor++; return 'rescued a castaway who joins as a Sailor.'; }
    return 'met a castaway, but there was no room aboard.';
  },
  (s, p) => { const before = p.hp; p.hp = Math.max(1, p.hp - 2); return `touched a cursed idol (-${before - p.hp} HP).`; },
  (s) => { s.turn.mp += 3; return 'caught a magical breeze (+3 move points).'; },
  (s, p) => { const lost = Math.min(p.gold, 5); p.gold -= lost; return `was robbed by island thieves (-${lost} gold).`; },
];

function enterTile(s, p, ctx) {
  const here = tileIndex(s.map, p.x, p.y);
  const t = s.map.tiles[here];
  if (p.mission?.stage === 'go' && p.mission.target === here) {
    p.mission.stage = 'return';
    ctx.events.push({ kind: 'mission', pid: p.id, text: `📜 ${p.name} completed the mission task! Return to any Mission Port for ${p.mission.reward} gold.` });
  }
  switch (t.type) {
    case 'reef':
      ctx.events.push({ kind: 'hazard', pid: p.id, text: `🪨 ${p.name} ran onto a reef (-1 HP) and stopped.` });
      return damage(s, p, 1, null, ctx) ? 'sunk' : 'stop';
    case 'storm': {
      const roll = d6(ctx.rng);
      if (roll <= 3) {
        ctx.events.push({ kind: 'hazard', pid: p.id, text: `⛈ ${p.name} is battered by the storm (rolled ${roll}, -2 HP).` });
        if (damage(s, p, 2, null, ctx)) return 'sunk';
      } else {
        ctx.events.push({ kind: 'hazard', pid: p.id, text: `⛈ ${p.name} rides out the storm (rolled ${roll}).` });
      }
      return null;
    }
    case 'treasure':
      if (!t.looted) {
        t.looted = true;
        const g = randInt(ctx.rng, 10, 20);
        p.gold += g;
        ctx.events.push({ kind: 'gold', pid: p.id, text: `💰 ${p.name} found treasure: ${g} gold!` });
        checkWin(s, p, ctx);
      }
      return null;
    case 'mystery':
      if (!t.used) {
        t.used = true;
        const text = pick(ctx.rng, MYSTERIES)(s, p, ctx.rng);
        ctx.events.push({ kind: 'mystery', pid: p.id, text: `❓ ${p.name} ${text}` });
        checkWin(s, p, ctx);
      }
      return null;
    default:
      return null;
  }
}

function beginTurn(s, i, ctx) {
  const p = s.players[i];
  s.turn = { idx: i, ap: AP_PER_TURN, mp: maxMp(p), lastStep: null };
  const heal = Math.min(p.crew.carpenter, p.maxHp - p.hp);
  if (heal > 0) {
    p.hp += heal;
    ctx.events.push({ kind: 'info', pid: p.id, text: `🔨 ${p.name}'s carpenters repair ${heal} HP.` });
  }
  ctx.events.push({ kind: 'turn', pid: p.id, text: `⚓ ${p.name}'s turn.` });
}

function desert(p, rng) {
  if (p.crew.sailor > 0) { p.crew.sailor--; return 'sailor'; }
  const types = Object.keys(p.crew).filter(k => p.crew[k] > 0);
  if (!types.length) return null;
  const t = pick(rng, types);
  p.crew[t]--;
  return t;
}

function endRound(s, ctx) {
  s.round++;
  for (const p of s.players) {
    const need = crewCount(p);
    if (p.food >= need) {
      p.food -= need;
    } else {
      p.food = 0;
      const lost = desert(p, ctx.rng);
      if (lost) ctx.events.push({ kind: 'hazard', pid: p.id, text: `🍖 ${p.name} ran out of food: a ${CREW[lost].name} deserted!` });
    }
  }
  if (ctx.rng() < 1 / 3) {
    s.wind = (s.wind + (ctx.rng() < 0.5 ? 1 : 3)) % 4;
    ctx.events.push({ kind: 'wind', text: `🌬 The wind shifts: now blowing ${DIR_NAMES[s.wind]}.` });
  }
  ctx.events.push({ kind: 'info', text: `Round ${s.round} begins.` });
}

function advanceTurn(s, ctx) {
  let i = s.turn.idx;
  for (let guard = 0; guard < s.players.length * 3; guard++) {
    i++;
    if (i >= s.players.length) {
      i = 0;
      endRound(s, ctx);
    }
    const p = s.players[i];
    if (p.skip > 0) {
      p.skip--;
      ctx.events.push({ kind: 'info', pid: p.id, text: `${p.name} is patching up the wreck and skips this turn.` });
      continue;
    }
    beginTurn(s, i, ctx);
    return;
  }
  beginTurn(s, i, ctx);
}

function requireTurn(s, pid) {
  if (s.phase !== 'playing') return 'The game is not running.';
  if (currentPlayer(s)?.id !== pid) return 'It is not your turn.';
  return null;
}
const requireAp = s => (s.turn.ap < 1 ? 'No action points left this turn.' : null);
const requireTile = (s, p, type, msg) => (tileAt(s.map, p.x, p.y)?.type !== type ? msg : null);
const requirePort = (s, p) => requireTile(s, p, 'port', 'You must be docked at a Port Town.');

const HANDLERS = {
  join(s, pid, intent, ctx) {
    const name = cleanName(intent.name);
    const existing = getPlayer(s, pid);
    if (existing) {
      if (!existing.connected) ctx.events.push({ kind: 'info', text: `${existing.name} is back aboard.` });
      existing.connected = true;
      if (s.phase === 'lobby') existing.name = name;
      return null;
    }
    if (s.phase !== 'lobby') return 'This voyage has already set sail.';
    if (s.players.length >= MAX_PLAYERS) return `The fleet is full (${MAX_PLAYERS} ships).`;
    const taken = new Set(s.players.map(p => p.color));
    const color = COLORS.includes(intent.color) && !taken.has(intent.color) ? intent.color : COLORS.find(c => !taken.has(c));
    s.players.push(newPlayer(pid, name, color));
    ctx.events.push({ kind: 'info', text: `${name} joined the fleet.` });
    return null;
  },

  presence(s, pid, intent, ctx) {
    if (!ctx.system) return 'Not allowed.';
    const p = getPlayer(s, pid);
    if (!p || p.connected === !!intent.connected) return null;
    p.connected = !!intent.connected;
    ctx.events.push({ kind: 'info', text: `${p.name} ${p.connected ? 'reconnected' : 'lost connection'}.` });
    return null;
  },

  kick(s, pid, intent, ctx) {
    if (!ctx.isHost) return 'Only the captain can do that.';
    if (s.phase !== 'lobby') return 'Players can only be removed in the lobby.';
    const p = getPlayer(s, intent.target);
    if (!p || p.id === pid) return 'Unknown player.';
    s.players = s.players.filter(q => q.id !== p.id);
    ctx.events.push({ kind: 'info', text: `${p.name} left the fleet.` });
    return null;
  },

  settings(s, pid, intent, ctx) {
    if (!ctx.isHost) return 'Only the captain can change settings.';
    if (s.phase !== 'lobby') return 'Settings are locked.';
    s.settings = {
      cols: clampInt(intent.cols, 6, 26, s.settings.cols),
      rows: clampInt(intent.rows, 4, 20, s.settings.rows),
      goldGoal: clampInt(intent.goldGoal, 30, 500, s.settings.goldGoal),
    };
    return null;
  },

  startLineup(s, pid, intent, ctx) {
    if (!ctx.isHost) return 'Only the captain can start.';
    if (s.phase !== 'lobby') return 'Already started.';
    if (s.players.length < 2 && !intent.solo) return 'You need at least 2 ships.';
    const { cols, rows } = s.settings;
    if (s.players.length > cols) return 'The map is too narrow for the line-up.';
    s.map = generateMap(cols, rows, `${s.code}:${s.seed}`);
    const startX = Math.floor((cols - s.players.length) / 2);
    s.players = s.players.map((p, i) => {
      const fresh = newPlayer(p.id, p.name, p.color);
      fresh.connected = p.connected;
      fresh.x = startX + i;
      fresh.y = rows - 1;
      fresh.seen = '0'.repeat(cols * rows);
      return fresh;
    });
    s.players.forEach(p => markSeen(s, p));
    s.phase = 'lineup';
    return null;
  },

  calibrated(s, pid) {
    if (s.phase !== 'lineup') return 'Not in the line-up.';
    const p = getPlayer(s, pid);
    if (!p) return 'Unknown player.';
    p.calibrated = true;
    return null;
  },

  startGame(s, pid, intent, ctx) {
    if (!ctx.isHost) return 'Only the captain can start.';
    if (s.phase !== 'lineup') return 'Not in the line-up.';
    s.phase = 'playing';
    s.round = 1;
    s.wind = Math.floor(ctx.rng() * 4);
    ctx.events.push({ kind: 'wind', text: `⛵ Set sail! The wind blows ${DIR_NAMES[s.wind]}.` });
    beginTurn(s, 0, ctx);
    return null;
  },

  sail(s, pid, intent, ctx) {
    const err = requireTurn(s, pid);
    if (err) return err;
    const p = currentPlayer(s);
    const steps = intent.steps;
    if (!Array.isArray(steps) || steps.length === 0 || steps.length > 40 || steps.some(x => x !== 'F' && x !== 'L' && x !== 'R')) {
      return 'Plot a course first.';
    }
    const plan = planPath(s, p, steps);
    if (plan.error) return plan.error;
    if (plan.cost > s.turn.mp) return `Not enough move points: the course costs ${plan.cost}, you have ${s.turn.mp}.`;
    for (const st of steps) {
      if (st === 'F') {
        s.turn.mp -= stepCost(p.heading, s.wind);
        p.x += DIRS[p.heading][0];
        p.y += DIRS[p.heading][1];
        s.turn.lastStep = 'F';
        markSeen(s, p);
        const result = enterTile(s, p, ctx);
        if (result === 'sunk') {
          if (s.phase === 'playing') advanceTurn(s, ctx);
          return null;
        }
        if (result === 'stop' || s.phase !== 'playing') break;
      } else {
        s.turn.mp -= TURN_COST;
        p.heading = st === 'L' ? turnLeft(p.heading) : turnRight(p.heading);
        s.turn.lastStep = st;
      }
    }
    ctx.events.push({ kind: 'move', pid, text: `⛵ ${p.name} sailed to ${cellName(p.x, p.y)}, facing ${DIR_NAMES[p.heading]}.` });
    return null;
  },

  fire(s, pid, intent, ctx) {
    const err = requireTurn(s, pid) || requireAp(s);
    if (err) return err;
    const p = currentPlayer(s);
    if (intent.side !== 'port' && intent.side !== 'starboard') return 'Choose port or starboard.';
    const victim = fireTargets(s, p, intent.side).find(q => q.id === intent.target);
    if (!victim) return 'No enemy ship in range on that side.';
    const shots = shotsFor(p);
    if (shots < 1) return 'You have no crew to man the cannons.';
    const need = hitNeed(p);
    const rolls = Array.from({ length: shots }, () => d6(ctx.rng));
    const hits = rolls.filter(r => r >= need).length;
    s.turn.ap--;
    ctx.events.push({
      kind: 'fire', pid, target: victim.id,
      text: `💣 ${p.name} fires ${shots} cannon${shots > 1 ? 's' : ''} at ${victim.name}: rolled ${rolls.join(' ')} (need ${need}+) → ${hits} hit${hits === 1 ? '' : 's'}.`,
    });
    damage(s, victim, hits, p, ctx);
    return null;
  },

  board(s, pid, intent, ctx) {
    const err = requireTurn(s, pid) || requireAp(s);
    if (err) return err;
    const p = currentPlayer(s);
    if (p.crew.boarder < 1) return 'You need at least one Boarder.';
    const victim = boardTargets(s, p).find(q => q.id === intent.target);
    if (!victim) return 'No ship close enough to board.';
    const stolen = Math.min(victim.gold, BOARD_STEAL * p.crew.boarder);
    victim.gold -= stolen;
    p.gold += stolen;
    s.turn.ap--;
    ctx.events.push({ kind: 'board', pid, target: victim.id, text: `🏴‍☠️ ${p.name} boarded ${victim.name} and stole ${stolen} gold!` });
    checkWin(s, p, ctx);
    return null;
  },

  hire(s, pid, intent, ctx) {
    const p = getPlayer(s, pid);
    const err = requireTurn(s, pid) || requireAp(s) || requirePort(s, p);
    if (err) return err;
    const info = CREW[intent.crew];
    if (!info) return 'Unknown crew type.';
    if (crewCount(p) >= p.crewCap) return 'No room aboard. Upgrade your Quarters.';
    if (p.gold < info.cost) return 'Not enough gold.';
    p.gold -= info.cost;
    p.crew[intent.crew]++;
    s.turn.ap--;
    ctx.events.push({ kind: 'shop', pid, text: `${p.name} hired a ${info.name}.` });
    return null;
  },

  upgrade(s, pid, intent, ctx) {
    const p = getPlayer(s, pid);
    const err = requireTurn(s, pid) || requireAp(s) || requirePort(s, p);
    if (err) return err;
    const info = UPGRADES[intent.kind];
    if (!info) return 'Unknown upgrade.';
    const level = p.levels[intent.kind];
    if (level >= UPGRADE_COST.length) return 'Already fully upgraded.';
    const cost = UPGRADE_COST[level];
    if (p.gold < cost) return 'Not enough gold.';
    p.gold -= cost;
    p.levels[intent.kind]++;
    if (intent.kind === 'hull') { p.maxHp += 4; p.hp += 4; }
    if (intent.kind === 'cannons') p.cannons++;
    if (intent.kind === 'quarters') p.crewCap += 2;
    if (intent.kind === 'galley') p.foodCap += 8;
    s.turn.ap--;
    ctx.events.push({ kind: 'shop', pid, text: `${p.name} upgraded ${info.name} to level ${level + 1}.` });
    return null;
  },

  buyFood(s, pid, intent, ctx) {
    const p = getPlayer(s, pid);
    const err = requireTurn(s, pid) || requireAp(s) || requirePort(s, p);
    if (err) return err;
    const amount = Math.min(p.foodCap - p.food, Math.floor(p.gold / FOOD_PRICE));
    if (amount <= 0) return p.food >= p.foodCap ? 'Food storage is full.' : 'Not enough gold.';
    p.food += amount;
    p.gold -= amount * FOOD_PRICE;
    s.turn.ap--;
    ctx.events.push({ kind: 'shop', pid, text: `${p.name} bought ${amount} food.` });
    return null;
  },

  repair(s, pid, intent, ctx) {
    const p = getPlayer(s, pid);
    const err = requireTurn(s, pid) || requireAp(s) || requirePort(s, p);
    if (err) return err;
    const amount = Math.min(p.maxHp - p.hp, Math.floor(p.gold / REPAIR_PRICE));
    if (amount <= 0) return p.hp >= p.maxHp ? 'Your ship is in perfect shape.' : 'Not enough gold.';
    p.hp += amount;
    p.gold -= amount * REPAIR_PRICE;
    s.turn.ap--;
    ctx.events.push({ kind: 'shop', pid, text: `${p.name} repaired ${amount} HP.` });
    return null;
  },

  takeMission(s, pid, intent, ctx) {
    const p = getPlayer(s, pid);
    const err = requireTurn(s, pid) || requireTile(s, p, 'mission', 'You must be at a Mission Port.');
    if (err) return err;
    if (p.mission) return 'You already have a mission.';
    const here = tileIndex(s.map, p.x, p.y);
    const candidates = [];
    s.map.tiles.forEach((t, i) => {
      if (i === here || !ISLAND_TYPES.includes(t.type)) return;
      const d = Math.abs((i % s.map.cols) - p.x) + Math.abs(Math.floor(i / s.map.cols) - p.y);
      candidates.push({ i, d });
    });
    if (!candidates.length) return 'No destinations on this map.';
    const far = candidates.filter(c => c.d >= 3);
    const choice = pick(ctx.rng, far.length ? far : candidates);
    p.mission = { target: choice.i, stage: 'go', reward: 10 + 2 * choice.d };
    const tx = choice.i % s.map.cols;
    const ty = Math.floor(choice.i / s.map.cols);
    ctx.events.push({ kind: 'mission', pid, text: `📜 ${p.name} accepted a mission to ${cellName(tx, ty)} for ${p.mission.reward} gold.` });
    return null;
  },

  collectMission(s, pid, intent, ctx) {
    const p = getPlayer(s, pid);
    const err = requireTurn(s, pid) || requireTile(s, p, 'mission', 'You must be at a Mission Port.');
    if (err) return err;
    if (p.mission?.stage !== 'return') return 'Nothing to collect yet.';
    p.gold += p.mission.reward;
    ctx.events.push({ kind: 'gold', pid, text: `💰 ${p.name} collected ${p.mission.reward} gold for a mission.` });
    p.mission = null;
    checkWin(s, p, ctx);
    return null;
  },

  endTurn(s, pid, intent, ctx) {
    const err = requireTurn(s, pid);
    if (err) return err;
    advanceTurn(s, ctx);
    return null;
  },

  forceEndTurn(s, pid, intent, ctx) {
    if (!ctx.isHost) return 'Only the captain can do that.';
    if (s.phase !== 'playing') return 'The game is not running.';
    ctx.events.push({ kind: 'info', text: `The captain skipped ${currentPlayer(s).name}'s turn.` });
    advanceTurn(s, ctx);
    return null;
  },

  backToLobby(s, pid, intent, ctx) {
    if (!ctx.isHost) return 'Only the captain can do that.';
    s.phase = 'lobby';
    s.map = null;
    s.turn = null;
    s.winner = null;
    s.round = 0;
    s.log = [];
    s.seed = String(intent.seed ?? Date.now()).slice(0, 16);
    s.players = s.players.map(p => Object.assign(newPlayer(p.id, p.name, p.color), { connected: p.connected }));
    return null;
  },
};

export function applyIntent(state, pid, intent, opts = {}) {
  if (!intent || typeof intent.type !== 'string' || !Object.hasOwn(HANDLERS, intent.type)) return { error: 'Unknown order.' };
  const s = structuredClone(state);
  const ctx = { rng: opts.rng || Math.random, isHost: !!opts.isHost, system: !!opts.system, events: [] };
  const error = HANDLERS[intent.type](s, pid, intent, ctx);
  if (error) return { error };
  s.log = s.log.concat(ctx.events.map(e => e.text)).slice(-40);
  return { state: s, events: ctx.events };
}
