(function (WHQ) {
  'use strict';

  const PREFIX = 'wargamehq:';

  function read(key, fallback) {
    try {
      const raw = localStorage.getItem(PREFIX + key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch {
      return fallback;
    }
  }

  function write(key, value) {
    if (value === null || value === undefined) localStorage.removeItem(PREFIX + key);
    else localStorage.setItem(PREFIX + key, JSON.stringify(value));
  }

  const storage = {
    getFactions() {
      return read('factions', []);
    },

    getFaction(id) {
      return storage.getFactions().find((f) => f.id === id) || null;
    },

    upsertFaction(faction) {
      const factions = storage.getFactions();
      const i = factions.findIndex((f) => f.id === faction.id);
      if (i >= 0) factions[i] = faction;
      else factions.push(faction);
      write('factions', factions);

      const armies = storage.getArmies().map((a) => (a.factionId === faction.id ? WHQ.model.pruneArmy(a, faction) : a));
      write('armies', armies);
    },

    deleteFaction(id) {
      write('factions', storage.getFactions().filter((f) => f.id !== id));
      write('armies', storage.getArmies().filter((a) => a.factionId !== id));
      if (storage.getSelectedFactionId() === id) storage.setSelectedFactionId(null);
    },

    getArmies() {
      return read('armies', []);
    },

    getArmiesFor(factionId) {
      return storage.getArmies().filter((a) => a.factionId === factionId);
    },

    getArmy(id) {
      return storage.getArmies().find((a) => a.id === id) || null;
    },

    upsertArmy(army) {
      const armies = storage.getArmies();
      const i = armies.findIndex((a) => a.id === army.id);
      if (i >= 0) armies[i] = army;
      else armies.push(army);
      write('armies', armies);
    },

    deleteArmy(id) {
      write('armies', storage.getArmies().filter((a) => a.id !== id));
    },

    getSelectedFactionId() {
      return read('selectedFactionId', null);
    },

    setSelectedFactionId(id) {
      write('selectedFactionId', id);
    },

    getSelectedFaction() {
      const id = storage.getSelectedFactionId();
      return id ? storage.getFaction(id) : null;
    },

    getGame() {
      return read('game', null);
    },

    saveGame(game) {
      write('game', game);
    },

    clearGame() {
      write('game', null);
    },

    // Importing a shared faction replaces the whole local set.
    replaceAllWith(faction) {
      write('factions', [faction]);
      write('armies', []);
      storage.setSelectedFactionId(faction.id);
    },
  };

  WHQ.storage = storage;
})(window.WHQ = window.WHQ || {});
