(function (WHQ) {
  'use strict';

  const { uid, int, str } = WHQ.util;

  const MAX_UNITS_PER_BUILDING = 3;

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

  function normalizeUnit(raw) {
    const u = obj(raw);
    return {
      id: normId(u.id),
      name: str(u.name, 80),
      health: int(u.health, 0, 9999, 1),
      attack: int(u.attack, 0, 9999, 0),
      defense: int(u.defense, 0, 9999, 0),
      dodge: int(u.dodge, 0, 9999, 0),
      range: normRange(u.range),
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
      units: int(b.units, 0, MAX_UNITS_PER_BUILDING, 0),
      eligibleUnitIds: [...new Set(arr(b.eligibleUnitIds, 200).filter((id) => unitIds.has(id)))],
      abilities: normAbilities(b.abilities),
    };
  }

  function normalizeFaction(raw) {
    const f = obj(raw);
    const units = uniqueIds(arr(f.units, 200).map(normalizeUnit));
    const unitIds = new Set(units.map((u) => u.id));
    const buildings = uniqueIds(arr(f.buildings, 100).map((b) => normalizeBuilding(b, unitIds)));
    const hqBuildingId = buildings.some((b) => b.id === f.hqBuildingId) ? f.hqBuildingId : null;
    return { id: normId(f.id), name: str(f.name, 80), units, buildings, hqBuildingId };
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
    return { ...army, entries };
  }

  WHQ.model = {
    MAX_UNITS_PER_BUILDING,

    newUnit() {
      return { id: uid(), name: 'New unit', health: 1, attack: 1, defense: 0, dodge: 0, range: 'melee', abilities: [] };
    },

    newBuilding() {
      return { id: uid(), name: 'New building', cost: 10, generation: 0, units: 0, eligibleUnitIds: [], abilities: [] };
    },

    newFaction() {
      return { id: uid(), name: '', units: [], buildings: [], hqBuildingId: null };
    },

    newArmy(factionId) {
      return { id: uid(), factionId, name: '', budget: 100, entries: [] };
    },

    newEntry(buildingId) {
      return { id: uid(), buildingId, unitPicks: [] };
    },

    normalizeFaction,
    pruneArmy,

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
