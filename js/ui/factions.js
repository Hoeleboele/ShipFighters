(function (WHQ) {
  'use strict';

  const { esc } = WHQ.util;
  const { storage, ui } = WHQ;

  WHQ.ui.screens.factions = function (el) {
    function render() {
      const factions = storage.getFactions();
      const selectedId = storage.getSelectedFactionId();

      el.innerHTML = `
        ${ui.header('Factions', '#/menu')}
        <section class="list">
          ${factions.length ? factions.map((f) => `
            <article class="card ${f.id === selectedId ? 'selected' : ''}">
              <div class="card-head">
                <h2>${esc(f.name || 'Unnamed faction')}</h2>
                ${f.id === selectedId ? '<span class="badge gold">Selected</span>' : ''}
              </div>
              <p class="muted">${f.units.length} units &middot; ${f.buildings.length} buildings</p>
              <div class="actions">
                ${f.id === selectedId ? '' : `<button class="btn small primary" data-a="select" data-id="${esc(f.id)}">Select</button>`}
                <button class="btn small" data-go="#/faction/${esc(f.id)}">Edit</button>
                <button class="btn small" data-go="#/share/${esc(f.id)}">Share</button>
                <button class="btn small danger" data-a="delete" data-id="${esc(f.id)}">Delete</button>
              </div>
            </article>`).join('') : ui.empty('No factions yet. Forge one or import a shared faction.')}
        </section>
        <div class="actions stack">
          <button class="btn primary" data-go="#/faction/new">Create faction</button>
          <button class="btn" data-go="#/import">Import from link</button>
        </div>`;
    }

    el.addEventListener('click', (ev) => {
      const btn = ev.target.closest('[data-a]');
      if (!btn) return;
      const id = btn.dataset.id;
      if (btn.dataset.a === 'select') {
        storage.setSelectedFactionId(id);
        ui.toast('Faction selected');
        render();
      } else if (btn.dataset.a === 'delete') {
        const f = storage.getFaction(id);
        if (f && confirm(`Delete "${f.name}" and all of its armies?`)) {
          storage.deleteFaction(id);
          render();
        }
      }
    });

    render();
  };
})(window.WHQ = window.WHQ || {});
