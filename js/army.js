(function (WHQ) {
  'use strict';

  const MAX_SAME_BUILDING = 3;
  const { findBuilding, findUnit } = WHQ.model;

  function cost(army, faction) {
    return army.entries.reduce((sum, e) => {
      const b = findBuilding(faction, e.buildingId);
      return sum + (b ? b.cost : 0);
    }, 0);
  }

  function countOf(army, buildingId) {
    return army.entries.filter((e) => e.buildingId === buildingId).length;
  }

  // Returns a reason string when the building cannot be added, otherwise null.
  function cannotAdd(army, faction, buildingId) {
    const b = findBuilding(faction, buildingId);
    if (!b) return 'Unknown building';
    if (buildingId === faction.hqBuildingId && countOf(army, buildingId) >= 1) return 'Only one HQ';
    if (countOf(army, buildingId) >= MAX_SAME_BUILDING) return `Max ${MAX_SAME_BUILDING}`;
    if (cost(army, faction) + b.cost > army.budget) return 'Not enough points';
    return null;
  }

  function validate(army, faction) {
    const errors = [];
    if (!army.name.trim()) errors.push('Army needs a name.');
    const total = cost(army, faction);
    if (total > army.budget) errors.push(`Army costs ${total} but the budget is ${army.budget}.`);

    if (!faction.hqBuildingId) {
      errors.push('The faction has no HQ building. Mark one in the faction editor.');
    } else {
      const hqCount = countOf(army, faction.hqBuildingId);
      if (hqCount !== 1) errors.push('Army must contain exactly one HQ.');
    }

    for (const b of faction.buildings) {
      if (countOf(army, b.id) > MAX_SAME_BUILDING) errors.push(`${b.name} is picked more than ${MAX_SAME_BUILDING} times.`);
    }

    for (const e of army.entries) {
      const b = findBuilding(faction, e.buildingId);
      if (!b) continue;
      if (e.unitPicks.length > b.units) errors.push(`${b.name} has too many units picked.`);
      if (e.unitPicks.some((id) => !b.eligibleUnitIds.includes(id))) errors.push(`${b.name} has a unit it cannot field.`);
    }
    return errors;
  }

  function roster(army, faction) {
    const list = [];
    for (const e of army.entries) {
      const b = findBuilding(faction, e.buildingId);
      if (!b) continue;
      for (const id of e.unitPicks) {
        const unit = findUnit(faction, id);
        if (unit) list.push({ entry: e, building: b, unit });
      }
    }
    return list;
  }

  WHQ.army = { MAX_SAME_BUILDING, cost, countOf, cannotAdd, validate, roster };
})(window.WHQ = window.WHQ || {});
