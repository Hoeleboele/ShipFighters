(function (WHQ) {
  'use strict';

  const { esc, clone } = WHQ.util;
  const { storage, ui, model } = WHQ;

  function field(label, path, value, attrs) {
    return `<label class="field"><span>${label}</span><input data-bind="${path}" value="${esc(value)}" ${attrs || 'type="text" maxlength="80"'}></label>`;
  }

  function numField(label, path, value, min, max) {
    return field(label, path, value, `type="number" inputmode="numeric" min="${min}" max="${max}"`);
  }

  function abilitiesEditor(kind, i, list) {
    return `<div class="abilities-edit">
      <h3>Special abilities</h3>
      ${list.map((a, j) => `
        <div class="ability-row">
          <input data-bind="${kind}.${i}.abilities.${j}.name" value="${esc(a.name)}" maxlength="80" placeholder="Ability name">
          <textarea data-bind="${kind}.${i}.abilities.${j}.text" maxlength="1000" rows="2" placeholder="What does it do?">${esc(a.text)}</textarea>
          <button class="btn small danger" data-a="del-ability" data-kind="${kind}" data-i="${i}" data-j="${j}">Remove ability</button>
        </div>`).join('')}
      <button class="btn small" data-a="add-ability" data-kind="${kind}" data-i="${i}">+ Add ability</button>
    </div>`;
  }

  WHQ.ui.screens.factionEditor = function (el, id) {
    const isNew = id === 'new';
    const existing = isNew ? null : storage.getFaction(id);
    if (!isNew && !existing) {
      el.innerHTML = ui.header('Edit faction', '#/factions') + ui.empty('Faction not found.');
      return;
    }

    const draft = isNew ? model.newFaction() : clone(existing);
    const open = new Set();

    function unitCard(u, i) {
      const ranged = u.range !== 'melee';
      return `<details class="card" data-id="${esc(u.id)}" ${open.has(u.id) ? 'open' : ''}>
        <summary><span data-title="units.${i}">${esc(u.name || 'Unnamed unit')}</span></summary>
        ${field('Name', `units.${i}.name`, u.name)}
        <div class="grid">
          ${numField('Health', `units.${i}.health`, u.health, 0, 9999)}
          ${numField('Attack', `units.${i}.attack`, u.attack, 0, 9999)}
          ${numField('Defense', `units.${i}.defense`, u.defense, 0, 9999)}
          ${numField('Dodge', `units.${i}.dodge`, u.dodge, 0, 9999)}
          <label class="field"><span>Range</span>
            <select data-range="${i}">
              <option value="melee" ${ranged ? '' : 'selected'}>Melee</option>
              <option value="ranged" ${ranged ? 'selected' : ''}>Ranged</option>
            </select>
          </label>
          ${ranged ? numField('Distance', `units.${i}.range`, u.range, 0, 9999) : ''}
        </div>
        ${abilitiesEditor('units', i, u.abilities)}
        <button class="btn small danger" data-a="del-unit" data-i="${i}">Delete unit</button>
      </details>`;
    }

    function buildingCard(b, i) {
      const isHq = draft.hqBuildingId === b.id;
      return `<details class="card" data-id="${esc(b.id)}" ${open.has(b.id) ? 'open' : ''}>
        <summary><span data-title="buildings.${i}">${esc(b.name || 'Unnamed building')}</span>${isHq ? ' <span class="badge gold">HQ</span>' : ''}</summary>
        ${field('Name', `buildings.${i}.name`, b.name)}
        <div class="grid">
          ${numField('Cost', `buildings.${i}.cost`, b.cost, 0, 99999)}
          ${numField('Generation', `buildings.${i}.generation`, b.generation, 0, 99)}
          ${numField('Units (0-3)', `buildings.${i}.units`, b.units, 0, model.MAX_UNITS_PER_BUILDING)}
          <label class="field check"><input type="radio" name="hq" value="${esc(b.id)}" ${isHq ? 'checked' : ''}><span>Faction HQ</span></label>
        </div>
        <fieldset class="eligible">
          <legend>Units this building can field</legend>
          ${draft.units.length ? draft.units.map((u) => `
            <label class="check"><input type="checkbox" data-eligible="${i}" value="${esc(u.id)}" ${b.eligibleUnitIds.includes(u.id) ? 'checked' : ''}><span>${esc(u.name || 'Unnamed unit')}</span></label>`).join('') : '<p class="muted">Add units first.</p>'}
        </fieldset>
        ${abilitiesEditor('buildings', i, b.abilities)}
        <button class="btn small danger" data-a="del-building" data-i="${i}">Delete building</button>
      </details>`;
    }

    function render() {
      el.innerHTML = `
        ${ui.header(isNew ? 'Create faction' : 'Edit faction', '#/factions')}
        <section class="form">
          ${field('Faction name', 'name', draft.name)}
        </section>
        <h2 class="section">Units</h2>
        <section class="list">${draft.units.map(unitCard).join('')}</section>
        <button class="btn" data-a="add-unit">+ Add unit</button>
        <h2 class="section">Buildings</h2>
        <section class="list">${draft.buildings.map(buildingCard).join('')}</section>
        <button class="btn" data-a="add-building">+ Add building</button>
        <div class="savebar">
          <button class="btn" data-go="#/factions">Cancel</button>
          <button class="btn primary" data-a="save">Save faction</button>
        </div>`;
    }

    el.addEventListener('toggle', (ev) => {
      const id = ev.target.dataset && ev.target.dataset.id;
      if (!id) return;
      if (ev.target.open) open.add(id);
      else open.delete(id);
    }, true);

    el.addEventListener('input', (ev) => {
      const t = ev.target;
      const path = t.dataset.bind;
      if (!path) return;
      const keys = path.split('.');
      let target = draft;
      for (const k of keys.slice(0, -1)) target = target[k];
      // Raw strings are stored; normalizeFaction converts numbers on save.
      target[keys[keys.length - 1]] = t.value;
      if (keys.length === 3 && keys[2] === 'name') {
        const title = el.querySelector(`[data-title="${keys[0]}.${keys[1]}"]`);
        if (title) title.textContent = t.value || 'Unnamed';
      }
    });

    el.addEventListener('change', (ev) => {
      const t = ev.target;
      if (t.dataset.range !== undefined) {
        draft.units[+t.dataset.range].range = t.value === 'melee' ? 'melee' : 1;
        render();
      } else if (t.name === 'hq') {
        draft.hqBuildingId = t.value;
        render();
      } else if (t.dataset.eligible !== undefined) {
        const b = draft.buildings[+t.dataset.eligible];
        b.eligibleUnitIds = t.checked
          ? [...b.eligibleUnitIds, t.value]
          : b.eligibleUnitIds.filter((x) => x !== t.value);
      }
    });

    el.addEventListener('click', (ev) => {
      const btn = ev.target.closest('[data-a]');
      if (!btn) return;
      const i = +btn.dataset.i;
      switch (btn.dataset.a) {
        case 'add-unit': {
          const u = model.newUnit();
          draft.units.push(u);
          open.add(u.id);
          break;
        }
        case 'del-unit': {
          const u = draft.units[i];
          if (!confirm(`Delete unit "${u.name}"?`)) return;
          draft.units.splice(i, 1);
          draft.buildings.forEach((b) => (b.eligibleUnitIds = b.eligibleUnitIds.filter((x) => x !== u.id)));
          break;
        }
        case 'add-building': {
          const b = model.newBuilding();
          if (!draft.buildings.length) draft.hqBuildingId = b.id;
          draft.buildings.push(b);
          open.add(b.id);
          break;
        }
        case 'del-building': {
          const b = draft.buildings[i];
          if (!confirm(`Delete building "${b.name}"?`)) return;
          draft.buildings.splice(i, 1);
          if (draft.hqBuildingId === b.id) draft.hqBuildingId = null;
          break;
        }
        case 'add-ability':
          draft[btn.dataset.kind][i].abilities.push({ name: '', text: '' });
          break;
        case 'del-ability':
          draft[btn.dataset.kind][i].abilities.splice(+btn.dataset.j, 1);
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
      const faction = model.normalizeFaction(draft);
      if (!faction.name.trim()) {
        ui.toast('Give your faction a name');
        return;
      }
      storage.upsertFaction(faction);
      if (!storage.getSelectedFactionId()) storage.setSelectedFactionId(faction.id);
      ui.toast(faction.buildings.length && !faction.hqBuildingId ? 'Saved - mark a building as HQ to play' : 'Faction saved');
      ui.go('#/factions');
    }

    render();
  };
})(window.WHQ = window.WHQ || {});
