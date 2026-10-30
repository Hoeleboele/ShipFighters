(function (WHQ) {
  'use strict';

  const { esc, clone, int } = WHQ.util;
  const { storage, ui, model, army: rules } = WHQ;

  WHQ.ui.screens.armyBuilder = function (el, id) {
    const isNew = id === 'new';
    const existing = isNew ? null : storage.getArmy(id);
    const faction = isNew ? storage.getSelectedFaction() : existing && storage.getFaction(existing.factionId);

    if (!faction) {
      el.innerHTML = ui.header('Army', '#/armies') +
        ui.empty(isNew ? 'Select a faction first.' : 'Army not found.', '<button class="btn" data-go="#/factions">Factions</button>');
      return;
    }

    const draft = isNew ? model.newArmy(faction.id) : model.pruneArmy(clone(existing), faction);

    el.innerHTML = `
      ${ui.header(isNew ? 'Create army' : 'Edit army', '#/armies')}
      <p class="muted center">Faction: <strong>${esc(faction.name)}</strong></p>
      <section class="form grid">
        <label class="field"><span>Army name</span><input id="army-name" type="text" maxlength="80" value="${esc(draft.name)}"></label>
        <label class="field"><span>Point budget</span><input id="army-budget" type="number" inputmode="numeric" min="0" max="99999" value="${draft.budget}"></label>
      </section>
      <div id="dyn"></div>
      <div class="savebar">
        <button class="btn" data-go="#/armies">Cancel</button>
        <button class="btn primary" data-a="save">Save army</button>
      </div>`;

    const dyn = el.querySelector('#dyn');

    function buildingOption(b) {
      const reason = rules.cannotAdd(draft, faction, b.id);
      const isHq = b.id === faction.hqBuildingId;
      const count = rules.countOf(draft, b.id);
      return `<article class="card compact">
        <div class="card-head">
          <h3>${esc(b.name)} ${isHq ? '<span class="badge gold">HQ</span>' : ''}</h3>
          <span class="muted">${count}/${isHq ? 1 : rules.MAX_SAME_BUILDING}</span>
        </div>
        <p class="muted">Cost ${b.cost} &middot; Generation ${b.generation} &middot; Units ${b.units}</p>
        ${ui.abilities(b.abilities)}
        <button class="btn small ${reason ? '' : 'primary'}" data-a="add" data-id="${esc(b.id)}" ${reason ? 'disabled' : ''}>${reason ? esc(reason) : `Add (${b.cost} pts)`}</button>
      </article>`;
    }

    function entryCard(e, i) {
      const b = model.findBuilding(faction, e.buildingId);
      const eligible = b.eligibleUnitIds.map((uid) => model.findUnit(faction, uid)).filter(Boolean);
      return `<article class="card compact">
        <div class="card-head">
          <h3>${esc(b.name)} ${b.id === faction.hqBuildingId ? '<span class="badge gold">HQ</span>' : ''}</h3>
          <button class="btn small danger" data-a="remove" data-i="${i}">Remove</button>
        </div>
        ${b.units ? `
          <p class="muted">Units: ${e.unitPicks.length}/${b.units}</p>
          <ul class="chips">
            ${e.unitPicks.map((uid, j) => `<li>${esc(model.findUnit(faction, uid).name)}${eligible.length > 1 ? ` <button class="chip-x" data-a="unpick" data-i="${i}" data-j="${j}" aria-label="Remove">&times;</button>` : ''}</li>`).join('')}
          </ul>
          ${e.unitPicks.length < b.units && eligible.length ? `
            <select data-pick="${i}">
              <option value="">+ Add unit&hellip;</option>
              ${eligible.map((u) => `<option value="${esc(u.id)}">${esc(u.name)}</option>`).join('')}
            </select>` : ''}
          ${!eligible.length ? '<p class="muted">This building has no units it can field.</p>' : ''}
        ` : '<p class="muted">No units.</p>'}
      </article>`;
    }

    function render() {
      const used = rules.cost(draft, faction);
      const errors = rules.validate(draft, faction);
      const roster = rules.roster(draft, faction);
      dyn.innerHTML = `
        <div class="points ${used > draft.budget ? 'over' : ''}">
          <span>${used} / ${draft.budget} pts</span>
          <strong>${draft.budget - used} left</strong>
        </div>
        <h2 class="section">Available buildings</h2>
        <section class="list">${faction.buildings.length ? faction.buildings.map(buildingOption).join('') : ui.empty('This faction has no buildings.')}</section>
        <h2 class="section">Your army</h2>
        <section class="list">${draft.entries.length ? draft.entries.map(entryCard).join('') : ui.empty('Add buildings above.')}</section>
        <h2 class="section">Roster</h2>
        <section class="list">${roster.length ? roster.map((r) => `
          <article class="card compact">
            <div class="card-head"><h3>${esc(r.unit.name)}</h3><span class="muted">${esc(r.building.name)}</span></div>
            ${ui.statline(r.unit)}
            ${ui.abilities(r.unit.abilities)}
          </article>`).join('') : ui.empty('No units yet.')}</section>
        ${errors.length ? `<ul class="errors">${errors.map((e) => `<li>${esc(e)}</li>`).join('')}</ul>` : ''}`;
    }

    el.addEventListener('input', (ev) => {
      if (ev.target.id === 'army-name') {
        draft.name = ev.target.value;
        render();
      } else if (ev.target.id === 'army-budget') {
        draft.budget = int(ev.target.value, 0, 99999, 0);
        render();
      }
    });

    el.addEventListener('change', (ev) => {
      const t = ev.target;
      if (t.dataset.pick === undefined || !t.value) return;
      draft.entries[+t.dataset.pick].unitPicks.push(t.value);
      render();
    });

    el.addEventListener('click', (ev) => {
      const btn = ev.target.closest('[data-a]');
      if (!btn) return;
      const i = +btn.dataset.i;
      switch (btn.dataset.a) {
        case 'add':
          if (!rules.cannotAdd(draft, faction, btn.dataset.id)) {
            draft.entries.push(model.newEntry(btn.dataset.id));
            draft.entries = model.pruneArmy(draft, faction).entries;
          }
          break;
        case 'remove':
          draft.entries.splice(i, 1);
          break;
        case 'unpick':
          draft.entries[i].unitPicks.splice(+btn.dataset.j, 1);
          break;
        case 'save':
          save();
          return;
        default:
          return;
      }
      render();
    });

    function save() {
      draft.name = draft.name.trim();
      if (!draft.name) {
        ui.toast('Give your army a name');
        return;
      }
      storage.upsertArmy(draft);
      const errors = rules.validate(draft, faction);
      ui.toast(errors.length ? 'Saved - army is not ready yet' : 'Army saved');
      ui.go('#/armies');
    }

    render();
  };
})(window.WHQ = window.WHQ || {});
