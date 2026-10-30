(function (WHQ) {
  'use strict';

  const BASE_CP = 3;
  const MAX_HISTORY = 30;
  const { clone, uid } = WHQ.util;
  const { findBuilding } = WHQ.model;

  function entryOf(state, entryId) {
    return state.army.entries.find((e) => e.id === entryId) || null;
  }

  function buildingOf(state, entryId) {
    const b = state.buildings.find((x) => x.entryId === entryId);
    if (!b) throw new Error('Unknown building');
    return b;
  }

  function unitOf(state, instanceId) {
    const u = state.units.find((x) => x.id === instanceId);
    if (!u) throw new Error('Unknown unit');
    return u;
  }

  function cpFor(state) {
    return state.buildings
      .filter((b) => b.built)
      .reduce((sum, b) => sum + (findBuilding(state.faction, b.buildingId)?.generation || 0), BASE_CP);
  }

  function spend(state) {
    if (state.cp < 1) throw new Error('No command points left');
    state.cp -= 1;
  }

  function slotOccupant(state, entryId, slot) {
    return state.units.find((u) => !u.dead && u.entryId === entryId && u.slot === slot) || null;
  }

  // Only mutable fields are snapshotted; faction/army never change during a game.
  function snapshot(state) {
    return clone({ round: state.round, cp: state.cp, buildings: state.buildings, units: state.units });
  }

  function act(state, mutate) {
    const next = { ...state, ...snapshot(state) };
    mutate(next);
    next.history = state.history.concat([snapshot(state)]).slice(-MAX_HISTORY);
    return next;
  }

  function newGame(faction, army) {
    const state = {
      faction: clone(faction),
      army: clone(army),
      round: 1,
      cp: 0,
      buildings: army.entries.map((e) => ({
        entryId: e.id,
        buildingId: e.buildingId,
        built: e.buildingId === faction.hqBuildingId,
        exhausted: false,
      })),
      units: [],
      history: [],
    };
    state.cp = cpFor(state);
    return state;
  }

  function activateUnit(state, instanceId) {
    return act(state, (s) => {
      const u = unitOf(s, instanceId);
      if (u.dead) throw new Error('Unit is dead');
      if (u.activated) throw new Error('Unit already activated this round');
      spend(s);
      u.activated = true;
    });
  }

  function build(state, entryId) {
    return act(state, (s) => {
      const b = buildingOf(s, entryId);
      if (b.built) throw new Error('Already built');
      spend(s);
      b.built = true;
    });
  }

  function useAbility(state, entryId) {
    return act(state, (s) => {
      const b = buildingOf(s, entryId);
      const def = findBuilding(s.faction, b.buildingId);
      if (!b.built) throw new Error('Building is not built');
      if (!def || def.abilities.length === 0) throw new Error('Building has no ability');
      if (b.exhausted) throw new Error('Building is exhausted this round');
      spend(s);
      b.exhausted = true;
    });
  }

  function createUnit(state, entryId, slot) {
    return act(state, (s) => {
      const b = buildingOf(s, entryId);
      const entry = entryOf(s, entryId);
      if (!b.built) throw new Error('Building is not built');
      const unitId = entry && entry.unitPicks[slot];
      if (!unitId) throw new Error('No unit in that slot');
      if (slotOccupant(s, entryId, slot)) throw new Error('That unit is already on the table');
      spend(s);
      s.units.push({ id: uid(), entryId, slot, unitId, activated: false, dead: false });
    });
  }

  function killUnit(state, instanceId) {
    return act(state, (s) => {
      const u = unitOf(s, instanceId);
      if (u.dead) throw new Error('Unit is already dead');
      u.dead = true;
    });
  }

  function nextRound(state) {
    return act(state, (s) => {
      s.round += 1;
      s.cp = cpFor(s);
      s.buildings.forEach((b) => (b.exhausted = false));
      s.units.forEach((u) => (u.activated = false));
    });
  }

  function undo(state) {
    if (!state.history.length) throw new Error('Nothing to undo');
    const prev = state.history[state.history.length - 1];
    return { ...state, ...clone(prev), history: state.history.slice(0, -1) };
  }

  WHQ.game = {
    BASE_CP,
    newGame,
    cpFor,
    slotOccupant,
    entryOf,
    activateUnit,
    build,
    useAbility,
    createUnit,
    killUnit,
    nextRound,
    undo,
  };
})(window.WHQ = window.WHQ || {});
