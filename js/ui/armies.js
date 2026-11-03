(function (WHQ) {
  'use strict';

  const { esc } = WHQ.util;
  const { storage, ui, army: armyRules } = WHQ;

  WHQ.ui.screens.armies = function (el) {
    const faction = storage.getSelectedFaction();

    function render() {
      if (!faction) {
        el.innerHTML = ui.header('Armies', '#/menu') +
          ui.empty('Select a faction first.', '<button class="btn primary" data-go="#/factions">Select faction</button>');
        return;
      }
      const armies = storage.getArmiesFor(faction.id);
      el.innerHTML = `
        ${ui.header('Armies', '#/menu')}
        <p class="muted center">Faction: <strong>${esc(faction.name)}</strong></p>
        <section class="list">
          ${armies.length ? armies.map((a) => {
            const valid = armyRules.validate(a, faction).length === 0;
            return `<article class="card">
              <div class="card-head">
                <h2>${esc(a.name || 'Unnamed army')}</h2>
                <span class="badge ${valid ? 'green' : 'red'}">${valid ? 'Ready' : 'Needs attention'}</span>
              </div>
              <p class="muted">${armyRules.cost(a, faction)} / ${a.budget} points &middot; ${a.entries.length} buildings &middot; ${armyRules.roster(a, faction).length} units</p>
              <div class="actions">
                <button class="btn small" data-go="#/army/${esc(a.id)}">Edit</button>
                <button class="btn small danger" data-a="delete" data-id="${esc(a.id)}">Delete</button>
              </div>
            </article>`;
          }).join('') : ui.empty('No armies for this faction yet.')}
        </section>
        <div class="actions stack">
          <button class="btn primary" data-go="#/army/new">Create army</button>
        </div>`;
    }

    el.addEventListener('click', (ev) => {
      const btn = ev.target.closest('[data-a="delete"]');
      if (!btn) return;
      const a = storage.getArmy(btn.dataset.id);
      if (a && confirm(`Delete army "${a.name}"?`)) {
        storage.deleteArmy(a.id);
        render();
      }
    });

    render();
  };
})(window.WHQ = window.WHQ || {});
