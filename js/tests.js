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
      weapons: [
        { id: 'w1', name: 'Sword', hit: 3, attacks: 2, range: 'melee', ap: 1 },
        { id: 'w2', name: 'Bow', hit: 4, attacks: 'D6', range: 18, ap: 0 },
      ],
      units: [
        { id: 'u1', name: 'Knight', health: 3, defense: 3, dodge: 1, supply: 3, weaponIds: ['w1', 'w1', 'w2'] },
        { id: 'u2', name: 'Archer', health: 1, defense: 1, dodge: 2, supply: 1, weaponIds: ['w2'] },
      ],
      buildings: [
        { id: 'hq', name: 'Keep', cost: 30, generation: 1, units: 1, eligibleUnitIds: ['u1'], abilities: [{ name: 'Rally', text: 'x' }] },
        { id: 'b1', name: 'Barracks', cost: 20, generation: 0, units: 3, eligibleUnitIds: ['u1', 'u2'] },
        { id: 'b2', name: 'Farm', cost: 10, generation: 2, supplyBonus: 2, units: 0 },
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
    eq(f.units[1].weaponIds, []);
    eq(f.units[1].supply, 1);
    eq('range' in f.units[1], false);
    assert(f.units[1].id !== f.units[2].id, 'duplicate ids fixed');
    eq(f.buildings[0].units, 3);
    eq(f.buildings[0].supplyBonus, 0);
    eq(f.buildings[0].eligibleUnitIds, ['a']);
    eq(f.hqBuildingId, null);
  });

  test('weapons are sanitised', () => {
    const w = (x) => WHQ.model.normalizeWeapon(x);
    eq(w({ hit: 1 }).hit, 2);
    eq(w({ hit: 9 }).hit, 6);
    eq(w({}).hit, 4);
    eq(w({ attacks: 3 }).attacks, '3');
    eq(w({ attacks: '2d6' }).attacks, '2D6');
    eq(w({ attacks: 'D3+1' }).attacks, 'D3+1');
    eq(w({ attacks: 'abc' }).attacks, '1');
    eq(w({ ap: -2 }).ap, 0);
    eq(w({ range: 'far' }).range, 'melee');
    eq(w({ range: '24' }).range, 24);
  });

  test('unit weapons: unknown ids dropped, duplicates kept, old units get none', () => {
    const f = WHQ.model.normalizeFaction({
      weapons: [{ id: 'w1', name: 'Pistol' }],
      units: [{ id: 'a', weaponIds: ['w1', 'nope', 'w1'] }, { id: 'b', attack: 4, range: 12 }],
    });
    eq(f.units[0].weaponIds, ['w1', 'w1']);
    eq(f.units[1].weaponIds, []);
    eq('attack' in f.units[1], false);
  });

  test('unitWeapons merges duplicates and sorts by range, melee last', () => {
    const { faction } = fixture();
    faction.weapons.push({ id: 'w3', name: 'Pistol', hit: 4, attacks: '1', range: 6, ap: 0, abilities: [] });
    const knight = { weaponIds: ['w1', 'w3', 'w1', 'w2'] };
    eq(WHQ.model.unitWeapons(faction, knight).map((x) => [x.weapon.name, x.count]), [['Bow', 1], ['Pistol', 1], ['Sword', 2]]);
  });

  test('supply defaults', () => {
    eq(WHQ.model.newArmy('f').supply, 7);
    eq(WHQ.model.newUnit().supply, 1);
    eq(WHQ.model.newBuilding().supplyBonus, 0);
    const { faction } = fixture();
    eq(WHQ.model.pruneArmy({ id: 'a', factionId: 'f1', name: 'Old', budget: 100, entries: [] }, faction).supply, 7);
  });

  test('pruneArmy drops removed buildings and units', () => {
    const { faction, army } = fixture();
    army.entries.push({ id: 'e1', buildingId: 'b1', unitPicks: ['u1', 'u2'] });
    army.entries.push({ id: 'e2', buildingId: 'gone', unitPicks: [] });
    faction.buildings[1].units = 1;
    const pruned = WHQ.model.pruneArmy(army, faction);
    eq(pruned.entries.length, 1);
    eq(pruned.entries[0].unitPicks, ['u1']);
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

  test('supply: base plus bonus of built buildings only', () => {
    let s = startGame();
    eq(WHQ.game.supplyFor(s), 7);
    s = WHQ.game.build(s, 'eF');
    eq(WHQ.game.supplyFor(s), 9);
  });

  test('supply: creating units uses supply, short supply blocks without spending CP', () => {
    let s = startGame();
    s = { ...s, army: { ...s.army, supply: 3 } };
    s = WHQ.game.createUnit(s, 'eHq', 0); // Knight, 3 supply
    eq(WHQ.game.supplyUsed(s), 3);
    eq(WHQ.game.supplyLeft(s), 0);
    s = WHQ.game.build(s, 'eB');
    const cp = s.cp;
    throws(() => WHQ.game.createUnit(s, 'eB', 1), 'archer needs 1 supply');
    eq(s.cp, cp);
  });

  test('supply: slain units return supply and undo restores it', () => {
    let s = startGame();
    s = WHQ.game.createUnit(s, 'eHq', 0);
    eq(WHQ.game.supplyLeft(s), 4);
    s = WHQ.game.killUnit(s, s.units[0].id);
    eq(WHQ.game.supplyLeft(s), 7);
    s = WHQ.game.undo(s);
    eq(WHQ.game.supplyLeft(s), 4);
  });

  test('supply left never goes below zero', () => {
    let s = startGame();
    s = WHQ.game.createUnit(s, 'eHq', 0);
    s = { ...s, army: { ...s.army, supply: 0 } };
    eq(WHQ.game.supplyLeft(s), 0);
  });

  test('new game fills supply defaults for old data', () => {
    const { faction, army } = fixture();
    delete army.supply;
    army.entries.push({ id: 'eHq', buildingId: 'hq', unitPicks: ['u1'] });
    const s = WHQ.game.newGame(faction, army);
    eq(s.army.supply, 7);
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
