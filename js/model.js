(function (WHQ) {
  'use strict';

  const { uid, int, str } = WHQ.util;

  const MAX_UNITS_PER_BUILDING = 3;
  const MAX_WEAPONS_PER_UNIT = 10;
  const DEFAULT_ARMY_SUPPLY = 7;
  const DEFAULT_UNIT_SUPPLY = 1;
  // Plain number or dice with optional modifier: 3, D6, 2D6, D3+1.
  const ATTACKS_RE = /^(\d{1,3}|\d{0,2}D\d{1,3}(\+\d{1,3})?)$/;

  function obj(v) {
    return v && typeof v === 'object' && !Array.isArray(v) ? v : {};
  }

  function arr(v, max) {
    return Array.isArray(v) ? v.slice(0, max) : [];
  }

  function normId(v) {
    return typeof v === 'string' && /^[a-z0-9]{1,40}$/i.test(v) ? v : uid();
  }

  function normAbilities(list) {
    return arr(list, 20).map(obj).map((a) => ({ name: str(a.name, 80), text: str(a.text, 1000) }));
  }

  function normRange(r) {
    if (r === 'melee') return 'melee';
    const n = int(r, 0, 9999, null);
    return n === null ? 'melee' : n;
  }

  // Ensures unique ids so imported data can never contain colliding references.
  function uniqueIds(items) {
    const seen = new Set();
    for (const item of items) {
      while (seen.has(item.id)) item.id = uid();
      seen.add(item.id);
    }
    return items;
  }

  function normAttacks(v) {
    const s = String(typeof v === 'number' ? v : str(v, 12)).replace(/\s+/g, '').toUpperCase();
    return ATTACKS_RE.test(s) ? s : '1';
  }

  function normalizeWeapon(raw) {
    const w = obj(raw);
    return {
      id: normId(w.id),
      name: str(w.name, 80),
      hit: int(w.hit, 2, 6, 4),
      attacks: normAttacks(w.attacks),
      range: normRange(w.range),
      ap: int(w.ap, 0, 99, 0),
      abilities: normAbilities(w.abilities),
    };
  }

  // Duplicate weapon ids are kept: a unit may carry the same weapon more than once.
  function normalizeUnit(raw, weaponIds) {
    const u = obj(raw);
    return {
      id: normId(u.id),
      name: str(u.name, 80),
      health: int(u.health, 0, 9999, 1),
      defense: int(u.defense, 0, 9999, 0),
      dodge: int(u.dodge, 0, 9999, 0),
      supply: int(u.supply, 0, 99, DEFAULT_UNIT_SUPPLY),
      weaponIds: arr(u.weaponIds, 200).filter((id) => weaponIds.has(id)).slice(0, MAX_WEAPONS_PER_UNIT),
      abilities: normAbilities(u.abilities),
    };
  }

  function normalizeBuilding(raw, unitIds) {
    const b = obj(raw);
    return {
      id: normId(b.id),
      name: str(b.name, 80),
      cost: int(b.cost, 0, 99999, 0),
      generation: int(b.generation, 0, 99, 0),
      supplyBonus: int(b.supplyBonus, 0, 99, 0),
      units: int(b.units, 0, MAX_UNITS_PER_BUILDING, 0),
      eligibleUnitIds: [...new Set(arr(b.eligibleUnitIds, 200).filter((id) => unitIds.has(id)))],
      abilities: normAbilities(b.abilities),
    };
  }

  function normalizeFaction(raw) {
    const f = obj(raw);
    const weapons = uniqueIds(arr(f.weapons, 200).map(normalizeWeapon));
    const weaponIds = new Set(weapons.map((w) => w.id));
    const units = uniqueIds(arr(f.units, 200).map((u) => normalizeUnit(u, weaponIds)));
    const unitIds = new Set(units.map((u) => u.id));
    const buildings = uniqueIds(arr(f.buildings, 100).map((b) => normalizeBuilding(b, unitIds)));
    const hqBuildingId = buildings.some((b) => b.id === f.hqBuildingId) ? f.hqBuildingId : null;
    return { id: normId(f.id), name: str(f.name, 80), weapons, units, buildings, hqBuildingId };
  }

  // Sorted longest range first, melee last; duplicates are merged into a count.
  function unitWeapons(faction, unit) {
    const counts = new Map();
    for (const id of unit.weaponIds || []) counts.set(id, (counts.get(id) || 0) + 1);
    const rangeKey = (r) => (r === 'melee' ? -1 : r);
    return [...counts.entries()]
      .map(([id, count]) => ({ weapon: (faction.weapons || []).find((w) => w.id === id), count }))
      .filter((x) => x.weapon)
      .sort((a, b) => rangeKey(b.weapon.range) - rangeKey(a.weapon.range) || a.weapon.name.localeCompare(b.weapon.name));
  }

  // Silently drops entries/picks that reference units or buildings no longer in the faction.
  // Buildings with a single eligible unit always get that unit for every slot.
  function pruneArmy(army, faction) {
    const byId = new Map(faction.buildings.map((b) => [b.id, b]));
    const entries = army.entries
      .filter((e) => byId.has(e.buildingId))
      .map((e) => {
        const b = byId.get(e.buildingId);
        const picks = b.eligibleUnitIds.length === 1
          ? Array(b.units).fill(b.eligibleUnitIds[0])
          : e.unitPicks.filter((id) => b.eligibleUnitIds.includes(id)).slice(0, b.units);
        return { ...e, unitPicks: picks };
      });
    return { ...army, supply: int(army.supply, 0, 999, DEFAULT_ARMY_SUPPLY), entries };
  }

  WHQ.model = {
    MAX_UNITS_PER_BUILDING,
    MAX_WEAPONS_PER_UNIT,
    DEFAULT_ARMY_SUPPLY,
    DEFAULT_UNIT_SUPPLY,

    newWeapon() {
      return { id: uid(), name: 'New weapon', hit: 4, attacks: '1', range: 'melee', ap: 0, abilities: [] };
    },

    newUnit() {
      return { id: uid(), name: 'New unit', health: 1, defense: 0, dodge: 0, supply: DEFAULT_UNIT_SUPPLY, weaponIds: [], abilities: [] };
    },

    newBuilding() {
      return { id: uid(), name: 'New building', cost: 10, generation: 0, supplyBonus: 0, units: 0, eligibleUnitIds: [], abilities: [] };
    },

    newFaction() {
      return { id: uid(), name: '', weapons: [], units: [], buildings: [], hqBuildingId: null };
    },

    newArmy(factionId) {
      return { id: uid(), factionId, name: '', budget: 100, supply: DEFAULT_ARMY_SUPPLY, entries: [] };
    },

    newEntry(buildingId) {
      return { id: uid(), buildingId, unitPicks: [] };
    },

    normalizeFaction,
    normalizeWeapon,
    pruneArmy,
    unitWeapons,

    findWeapon(faction, id) {
      return (faction.weapons || []).find((w) => w.id === id) || null;
    },

    findUnit(faction, id) {
      return faction.units.find((u) => u.id === id) || null;
    },

    findBuilding(faction, id) {
      return faction.buildings.find((b) => b.id === id) || null;
    },

    rangeLabel(range) {
      return range === 'melee' ? 'Melee' : String(range);
    },
  };
})(window.WHQ = window.WHQ || {});
