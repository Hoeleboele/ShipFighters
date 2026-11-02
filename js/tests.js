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
      abilities: [
        { id: 's1', name: 'Brave', text: 'Never flees', target: 'unit' },
        { id: 's2', name: 'Rapid fire', text: 'Double attacks at half range', target: 'weapon' },
        { id: 's3', name: 'Fortified', text: '+1 defense nearby', target: 'building' },
      ],
      weapons: [
        { id: 'w1', name: 'Sword', hit: 3, attacks: 2, range: 'melee', ap: 1 },
        { id: 'w2', name: 'Bow', hit: 4, attacks: 'D6', range: 18, ap: 0, sharedAbilityIds: ['s2'] },
      ],
      units: [
        { id: 'u1', name: 'Knight', health: 3, defense: 3, dodge: 1, supply: 3, weaponIds: ['w1', 'w1', 'w2'], sharedAbilityIds: ['s1'], abilities: [{ name: 'Charge', text: 'y' }] },
        { id: 'u2', name: 'Archer', health: 1, defense: 1, dodge: 2, supply: 1, weaponIds: ['w2'] },
      ],
      buildings: [
        { id: 'hq', name: 'Keep', cost: 30, generation: 1, units: 1, eligibleUnitIds: ['u1'], abilities: [{ name: 'Rally', text: 'x' }] },
        { id: 'b1', name: 'Barracks', cost: 20, generation: 0, units: 3, eligibleUnitIds: ['u1', 'u2'] },
        { id: 'b2', name: 'Farm', cost: 10, generation: 2, supplyBonus: 2, units: 0, sharedAbilityIds: ['s3'] },
      ],
      hqBuildingIds: ['hq'],
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
    eq(f.units[1].speed, 6);
    eq('range' in f.units[1], false);
    assert(f.units[1].id !== f.units[2].id, 'duplicate ids fixed');
    eq(f.buildings[0].units, 3);
    eq(f.buildings[0].supplyBonus, 0);
    eq(f.buildings[0].eligibleUnitIds, ['a']);
    eq(f.hqBuildingIds, []);
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

  test('shared abilities: bad target defaults to unit, wrong-target/unknown/duplicate ids dropped', () => {
    const f = WHQ.model.normalizeFaction({
      abilities: [{ id: 'a1', name: 'X', target: 'bogus' }, { id: 'a2', name: 'Y', target: 'weapon' }],
      weapons: [{ id: 'w', sharedAbilityIds: ['a1', 'a2', 'a2'] }],
      units: [{ id: 'u', sharedAbilityIds: ['a1', 'a1', 'a2', 'nope'] }, { id: 'old' }],
      buildings: [{ id: 'b', sharedAbilityIds: ['a1'] }],
    });
    eq(f.abilities[0].target, 'unit');
    eq(f.weapons[0].sharedAbilityIds, ['a2']);
    eq(f.units[0].sharedAbilityIds, ['a1']);
    eq(f.units[1].sharedAbilityIds, []);
    eq(f.buildings[0].sharedAbilityIds, []);
  });

  test('allAbilities lists shared first, then custom; usage is counted', () => {
    const { faction } = fixture();
    eq(WHQ.model.allAbilities(faction, faction.units[0]).map((a) => a.name), ['Brave', 'Charge']);
    eq(WHQ.model.allAbilities(faction, faction.weapons[1]).map((a) => a.name), ['Rapid fire']);
    eq(WHQ.model.sharedAbilityUsage(faction, 's1'), 1);
    eq(WHQ.model.sharedAbilityUsage(faction, 's3'), 1);
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

  test('multiple HQ buildings: army may pick only one of them', () => {
    const { faction, army } = fixture();
    faction.hqBuildingIds = ['hq', 'b1'];
    army.name = 'A';
    army.entries.push(WHQ.model.newEntry('b1'));
    eq(WHQ.army.cannotAdd(army, faction, 'hq'), 'Only one HQ');
    eq(WHQ.army.validate(army, faction), []);
    army.entries.push(WHQ.model.newEntry('hq'));
    assert(WHQ.army.validate(army, faction).some((e) => e.includes('HQ')));
  });

  test('legacy hqBuildingId is migrated', () => {
    const f = WHQ.model.normalizeFaction({ buildings: [{ id: 'k' }], hqBuildingId: 'k' });
    eq(f.hqBuildingIds, ['k']);
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
  function startGame(options) {
    const { faction, army } = fixture();
    army.entries.push({ id: 'eHq', buildingId: 'hq', unitPicks: ['u1'] });
    army.entries.push({ id: 'eB', buildingId: 'b1', unitPicks: ['u1', 'u2', 'u2'] });
    army.entries.push({ id: 'eF', buildingId: 'b2', unitPicks: [] });
    return WHQ.game.newGame(faction, army, options || { startCp: 4, cpPerRound: 1 });
  }

  test('new game: HQ built, CP = chosen starting CP', () => {
    const s = startGame();
    eq(s.round, 1);
    eq(s.cp, 4);
    eq(s.buildings.map((b) => b.built), [true, false, false]);
  });

  test('new game: CP defaults to base CP', () => {
    const s = startGame({});
    eq(s.cp, WHQ.game.BASE_CP);
    eq(s.cpPerRound, WHQ.game.DEFAULT_CP_PER_ROUND);
  });

  test('build, create, activate spend CP', () => {
    let s = startGame();
    s = WHQ.game.build(s, 'eB');
    s = WHQ.game.createUnit(s, 'eB', 1);
    s = WHQ.game.activateUnit(s, s.units[0].id);
    eq(s.cp, 1);
    throws(() => WHQ.game.activateUnit(s, s.units[0].id), 'cannot activate twice');
  });

  test('activateUnits spends 1 CP per ready unit, skipping activated and dead', () => {
    let s = startGame({ startCp: 9, cpPerRound: 1 });
    s = { ...s, army: { ...s.army, supply: 20 } };
    s = WHQ.game.build(s, 'eB');
    s = WHQ.game.createUnit(s, 'eHq', 0);
    s = WHQ.game.createUnit(s, 'eB', 0);
    s = WHQ.game.createUnit(s, 'eB', 1);
    s = WHQ.game.createUnit(s, 'eB', 2);
    s = WHQ.game.activateUnit(s, s.units[0].id);
    s = WHQ.game.killUnit(s, s.units[1].id);
    eq(s.cp, 3);
    s = WHQ.game.activateUnits(s, s.units.map((u) => u.id));
    eq(s.cp, 1);
    eq(s.units.filter((u) => !u.dead).every((u) => u.activated), true);
    eq(s.units[1].activated, false);
    throws(() => WHQ.game.activateUnits(s, s.units.map((u) => u.id)), 'none ready');
  });

  test('activateUnits needs enough CP and undoes in one step', () => {
    let s = startGame();
    s = WHQ.game.createUnit(s, 'eHq', 0);
    s = WHQ.game.build(s, 'eB');
    s = WHQ.game.createUnit(s, 'eB', 0);
    const ids = s.units.map((u) => u.id);
    const short = { ...s, cp: 1 };
    throws(() => WHQ.game.activateUnits(short, ids));
    eq(short.units.some((u) => u.activated), false);
    s = { ...s, cp: 2 };
    s = WHQ.game.activateUnits(s, ids);
    eq(s.cp, 0);
    s = WHQ.game.undo(s);
    eq(s.cp, 2);
    eq(s.units.some((u) => u.activated), false);
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

  test('next round: CP resets to start + per-round increase, buildings do not add CP, resets activation', () => {
    let s = startGame();
    s = WHQ.game.build(s, 'eF');
    s = WHQ.game.createUnit(s, 'eHq', 0);
    s = WHQ.game.activateUnit(s, s.units[0].id);
    s = WHQ.game.nextRound(s);
    eq(s.round, 2);
    eq(s.cp, 5);
    s = WHQ.game.nextRound(s);
    eq(s.cp, 6);
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

  test('building with only a shared ability can use it', () => {
    let s = startGame();
    s = WHQ.game.build(s, 'eF');
    s = WHQ.game.useAbility(s, 'eF');
    eq(s.buildings[2].exhausted, true);
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
