(function (WHQ) {
  'use strict';

  const tests = [];
  const test = (name, fn) => tests.push({ name, fn });

  function assert(cond, msg) {
    if (!cond) throw new Error(msg || 'Assertion failed');
  }

  function eq(actual, expected, msg) {
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      throw new Error(`${msg || 'Not equal'}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    }
  }

  function throws(fn, msg) {
    try {
      fn();
    } catch {
      return;
    }
    throw new Error(msg || 'Expected an error');
  }

  function fixture() {
    const faction = WHQ.model.normalizeFaction({
      id: 'f1',
      name: 'Iron Court',
      units: [
        { id: 'u1', name: 'Knight', health: 3, attack: 4, defense: 3, dodge: 1, range: 'melee' },
        { id: 'u2', name: 'Archer', health: 1, attack: 2, defense: 1, dodge: 2, range: 12 },
      ],
      buildings: [
        { id: 'hq', name: 'Keep', cost: 30, generation: 1, units: 1, eligibleUnitIds: ['u1'], abilities: [{ name: 'Rally', text: 'x' }] },
        { id: 'b1', name: 'Barracks', cost: 20, generation: 0, units: 3, eligibleUnitIds: ['u1', 'u2'] },
        { id: 'b2', name: 'Farm', cost: 10, generation: 2, units: 0 },
      ],
      hqBuildingId: 'hq',
    });
    const army = WHQ.model.newArmy('f1');
    army.name = 'Vanguard';
    army.budget = 100;
    return { faction, army };
  }

  // --- model ---
  test('normalizeFaction sanitises bad input', () => {
    const f = WHQ.model.normalizeFaction({
      name: 5,
      units: [null, { id: 'a', health: '7', range: 'far' }, { id: 'a' }],
      buildings: [{ units: 9, eligibleUnitIds: ['a', 'missing', 'a'] }],
      hqBuildingId: 'nope',
    });
    eq(f.name, '');
    eq(f.units.length, 3);
    eq(f.units[1].health, 7);
    eq(f.units[1].range, 'melee');
    assert(f.units[1].id !== f.units[2].id, 'duplicate ids fixed');
    eq(f.buildings[0].units, 3);
    eq(f.buildings[0].eligibleUnitIds, ['a']);
    eq(f.hqBuildingId, null);
  });

  test('pruneArmy drops removed buildings and units', () => {
    const { faction, army } = fixture();
    army.entries.push({ id: 'e1', buildingId: 'b1', unitPicks: ['u1', 'u2'] });
    army.entries.push({ id: 'e2', buildingId: 'gone', unitPicks: [] });
    faction.buildings[1].eligibleUnitIds = ['u2'];
    const pruned = WHQ.model.pruneArmy(army, faction);
    eq(pruned.entries.length, 1);
    eq(pruned.entries[0].unitPicks, ['u2']);
  });

  // --- army ---
  test('single eligible unit fills every slot', () => {
    const { faction, army } = fixture();
    faction.buildings[1].eligibleUnitIds = ['u2'];
    army.entries.push({ id: 'e1', buildingId: 'b1', unitPicks: [] });
    eq(WHQ.model.pruneArmy(army, faction).entries[0].unitPicks, ['u2', 'u2', 'u2']);
  });

  test('army cost and budget limit', () => {
    const { faction, army } = fixture();
    army.budget = 50;
    army.entries.push(WHQ.model.newEntry('hq'));
    eq(WHQ.army.cost(army, faction), 30);
    eq(WHQ.army.cannotAdd(army, faction, 'b1'), null);
    army.entries.push(WHQ.model.newEntry('b1'));
    eq(WHQ.army.cannotAdd(army, faction, 'b2'), 'Not enough points');
  });

  test('same building max 3 and only one HQ', () => {
    const { faction, army } = fixture();
    army.entries.push(WHQ.model.newEntry('hq'));
    eq(WHQ.army.cannotAdd(army, faction, 'hq'), 'Only one HQ');
    for (let i = 0; i < 3; i++) army.entries.push(WHQ.model.newEntry('b2'));
    eq(WHQ.army.cannotAdd(army, faction, 'b2'), 'Max 3');
  });

  test('validate requires exactly one HQ and a name', () => {
    const { faction, army } = fixture();
    army.name = '';
    const errors = WHQ.army.validate(army, faction);
    assert(errors.some((e) => e.includes('name')));
    assert(errors.some((e) => e.includes('HQ')));
    army.name = 'A';
    army.entries.push(WHQ.model.newEntry('hq'));
    eq(WHQ.army.validate(army, faction), []);
  });

  test('roster lists picked units, duplicates allowed', () => {
    const { faction, army } = fixture();
    army.entries.push({ id: 'e1', buildingId: 'b1', unitPicks: ['u2', 'u2'] });
    eq(WHQ.army.roster(army, faction).map((r) => r.unit.name), ['Archer', 'Archer']);
  });

  // --- game ---
  function startGame() {
    const { faction, army } = fixture();
    army.entries.push({ id: 'eHq', buildingId: 'hq', unitPicks: ['u1'] });
    army.entries.push({ id: 'eB', buildingId: 'b1', unitPicks: ['u1', 'u2', 'u2'] });
    army.entries.push({ id: 'eF', buildingId: 'b2', unitPicks: [] });
    return WHQ.game.newGame(faction, army);
  }

  test('new game: HQ built, CP = 3 + HQ generation', () => {
    const s = startGame();
    eq(s.round, 1);
    eq(s.cp, 4);
    eq(s.buildings.map((b) => b.built), [true, false, false]);
  });

  test('build, create, activate spend CP', () => {
    let s = startGame();
    s = WHQ.game.build(s, 'eB');
    s = WHQ.game.createUnit(s, 'eB', 1);
    s = WHQ.game.activateUnit(s, s.units[0].id);
    eq(s.cp, 1);
    throws(() => WHQ.game.activateUnit(s, s.units[0].id), 'cannot activate twice');
  });

  test('cannot act without CP', () => {
    let s = startGame();
    s = { ...s, cp: 0 };
    throws(() => WHQ.game.build(s, 'eB'));
  });

  test('create requires built building and free slot', () => {
    let s = startGame();
    throws(() => WHQ.game.createUnit(s, 'eB', 0), 'unbuilt');
    s = WHQ.game.createUnit(s, 'eHq', 0);
    throws(() => WHQ.game.createUnit(s, 'eHq', 0), 'slot taken');
    s = WHQ.game.killUnit(s, s.units[0].id);
    s = WHQ.game.createUnit(s, 'eHq', 0);
    eq(s.units.filter((u) => !u.dead).length, 1);
  });

  test('building ability exhausts until next round', () => {
    let s = startGame();
    s = WHQ.game.useAbility(s, 'eHq');
    throws(() => WHQ.game.useAbility(s, 'eHq'));
    s = WHQ.game.nextRound(s);
    eq(s.buildings[0].exhausted, false);
    throws(() => WHQ.game.useAbility(s, 'eF'), 'unbuilt farm');
  });

  test('next round: CP = 3 + generation of built buildings, resets activation', () => {
    let s = startGame();
    s = WHQ.game.build(s, 'eF');
    s = WHQ.game.createUnit(s, 'eHq', 0);
    s = WHQ.game.activateUnit(s, s.units[0].id);
    s = WHQ.game.nextRound(s);
    eq(s.round, 2);
    eq(s.cp, 3 + 1 + 2);
    eq(s.units[0].activated, false);
  });

  test('undo restores previous state', () => {
    let s = startGame();
    s = WHQ.game.build(s, 'eB');
    s = WHQ.game.undo(s);
    eq(s.cp, 4);
    eq(s.buildings[1].built, false);
    throws(() => WHQ.game.undo(s));
  });

  // --- share ---
  test('share round trip', async () => {
    const { faction } = fixture();
    const data = await WHQ.share.encodeFaction(faction);
    const url = WHQ.share.shareUrl(data);
    eq(WHQ.share.extractData(url), data);
    eq(await WHQ.share.decodeFaction(data), faction);
    assert(WHQ.share.qrSvg(url), 'QR generated');
  });

  test('share rejects garbage', async () => {
    let failed = false;
    try {
      await WHQ.share.decodeFaction('zAAAA');
    } catch {
      failed = true;
    }
    assert(failed);
  });

  async function run() {
    const out = document.getElementById('results');
    let passed = 0;
    for (const t of tests) {
      const li = document.createElement('li');
      li.className = 'card compact';
      try {
        await t.fn();
        passed++;
        li.textContent = 'PASS  ' + t.name;
      } catch (e) {
        li.textContent = `FAIL  ${t.name} - ${e.message}`;
        li.style.borderColor = 'var(--blood)';
      }
      out.appendChild(li);
    }
    const summary = document.getElementById('summary');
    summary.textContent = `${passed} / ${tests.length} passed`;
    document.title = (passed === tests.length ? 'PASS ' : 'FAIL ') + summary.textContent;
  }

  run();
})(window.WHQ = window.WHQ || {});
