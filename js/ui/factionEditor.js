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

    const draft = isNew ? model.newFaction() : model.normalizeFaction(clone(existing));
    const open = new Set();
    let activeTab = 'abilities';
    const TARGET_OF = { units: 'unit', weapons: 'weapon', buildings: 'building' };
    const TARGET_LABEL = { unit: ['Unit', 'units'], weapon: ['Weapon', 'weapons'], building: ['Building', 'buildings'] };

    function sharedPicker(kind, i, item) {
      const options = draft.abilities.filter((a) => a.target === TARGET_OF[kind]);
      if (!options.length) return '';
      return `<fieldset class="eligible">
        <legend>Shared abilities</legend>
        ${options.map((a) => `
          <label class="check"><input type="checkbox" data-shared="${kind}" data-i="${i}" value="${esc(a.id)}" ${item.sharedAbilityIds.includes(a.id) ? 'checked' : ''}><span>${esc(a.name || 'Unnamed ability')}</span></label>`).join('')}
      </fieldset>`;
    }

    // e.g. "1 unit", "3 weapons"
    function usageLabel(a) {
      const used = model.sharedAbilityUsage(draft, a.id);
      const plural = TARGET_LABEL[a.target][1];
      return `${used} ${used === 1 ? plural.slice(0, -1) : plural}`;
    }

    function sharedAbilityCard(a, i) {
      return `<details class="card" data-id="${esc(a.id)}" ${open.has(a.id) ? 'open' : ''}>
        <summary><span data-title="abilities.${i}">${esc(a.name || 'Unnamed ability')}</span> <span class="muted">(${TARGET_LABEL[a.target][0]})</span></summary>
        ${field('Name', `abilities.${i}.name`, a.name)}
        <label class="field"><span>Text</span><textarea data-bind="abilities.${i}.text" maxlength="1000" rows="2" placeholder="What does it do?">${esc(a.text)}</textarea></label>
        <label class="field"><span>Target</span>
          <select data-target-of="${i}">
            ${model.ABILITY_TARGETS.map((t) => `<option value="${t}" ${a.target === t ? 'selected' : ''}>${TARGET_LABEL[t][0]}</option>`).join('')}
          </select>
        </label>
        <p class="muted">Used by ${usageLabel(a)}</p>
        <button class="btn small danger" data-a="del-shared" data-i="${i}">Delete ability</button>
      </details>`;
    }

    function removeSharedEverywhere(id) {
      for (const list of [draft.units, draft.weapons, draft.buildings]) {
        list.forEach((x) => (x.sharedAbilityIds = x.sharedAbilityIds.filter((s) => s !== id)));
      }
    }

    function rangeFields(kind, i, range) {
      const ranged = range !== 'melee';
      return `<label class="field"><span>Range</span>
          <select data-range="${i}" data-kind="${kind}">
            <option value="melee" ${ranged ? '' : 'selected'}>Melee</option>
            <option value="ranged" ${ranged ? 'selected' : ''}>Ranged</option>
          </select>
        </label>
        ${ranged ? numField('Distance', `${kind}.${i}.range`, range, 0, 9999) : ''}`;
    }

    function weaponCard(w, i) {
      return `<details class="card" data-id="${esc(w.id)}" ${open.has(w.id) ? 'open' : ''}>
        <summary><span data-title="weapons.${i}">${esc(w.name || 'Unnamed weapon')}</span></summary>
        ${field('Name', `weapons.${i}.name`, w.name)}
        <div class="grid">
          ${numField('Hit (X+ on D6)', `weapons.${i}.hit`, w.hit, 2, 6)}
          ${field('Attacks (3, D6, 2D6, D3+1)', `weapons.${i}.attacks`, w.attacks, 'type="text" maxlength="12"')}
          ${rangeFields('weapons', i, w.range)}
          ${numField('AP', `weapons.${i}.ap`, w.ap, 0, 99)}
        </div>
        ${sharedPicker('weapons', i, w)}
        ${abilitiesEditor('weapons', i, w.abilities)}
        <button class="btn small danger" data-a="del-weapon" data-i="${i}">Delete weapon</button>
      </details>`;
    }

    function weaponPicker(u, i) {
      if (!draft.weapons.length) return '<p class="muted">Add weapons first.</p>';
      const name = (id) => {
        const w = model.findWeapon(draft, id);
        return w ? w.name || 'Unnamed weapon' : 'Unknown';
      };
      return `<ul class="chips">
          ${u.weaponIds.map((id, j) => `<li>${esc(name(id))} <button class="chip-x" data-a="unequip" data-i="${i}" data-j="${j}" aria-label="Remove">&times;</button></li>`).join('')}
        </ul>
        ${u.weaponIds.length < model.MAX_WEAPONS_PER_UNIT ? `
          <select data-equip="${i}">
            <option value="">+ Equip weapon&hellip;</option>
            ${draft.weapons.map((w) => `<option value="${esc(w.id)}">${esc(w.name || 'Unnamed weapon')} (${esc(ui.weaponSummary(w))})</option>`).join('')}
          </select>` : ''}`;
    }

    function unitCard(u, i) {
      return `<details class="card" data-id="${esc(u.id)}" ${open.has(u.id) ? 'open' : ''}>
        <summary><span data-title="units.${i}">${esc(u.name || 'Unnamed unit')}</span></summary>
        ${field('Name', `units.${i}.name`, u.name)}
        <div class="grid">
          ${numField('Health', `units.${i}.health`, u.health, 0, 9999)}
          ${numField('Defense', `units.${i}.defense`, u.defense, 0, 9999)}
          ${numField('Dodge', `units.${i}.dodge`, u.dodge, 0, 9999)}
          ${numField('Speed', `units.${i}.speed`, u.speed, 0, 9999)}
          ${numField('Supply', `units.${i}.supply`, u.supply, 0, 99)}
        </div>
        <fieldset class="eligible">
          <legend>Weapons</legend>
          ${weaponPicker(u, i)}
        </fieldset>
        ${sharedPicker('units', i, u)}
        ${abilitiesEditor('units', i, u.abilities)}
        <button class="btn small danger" data-a="del-unit" data-i="${i}">Delete unit</button>
      </details>`;
    }

    function buildingCard(b, i) {
      const isHq = draft.hqBuildingIds.includes(b.id);
      return `<details class="card" data-id="${esc(b.id)}" ${open.has(b.id) ? 'open' : ''}>
        <summary><span data-title="buildings.${i}">${esc(b.name || 'Unnamed building')}</span>${isHq ? ' <span class="badge gold">HQ</span>' : ''}</summary>
        ${field('Name', `buildings.${i}.name`, b.name)}
        <div class="grid">
          ${numField('Cost', `buildings.${i}.cost`, b.cost, 0, 99999)}
          ${numField('Generation', `buildings.${i}.generation`, b.generation, 0, 99)}
          ${numField('Supply bonus', `buildings.${i}.supplyBonus`, b.supplyBonus, 0, 99)}
          ${numField('Units (0-3)', `buildings.${i}.units`, b.units, 0, model.MAX_UNITS_PER_BUILDING)}
          <label class="field check"><input type="checkbox" data-hq value="${esc(b.id)}" ${isHq ? 'checked' : ''}><span>HQ (an army picks one)</span></label>
        </div>
        <fieldset class="eligible">
          <legend>Units this building can field</legend>
          ${draft.units.length ? draft.units.map((u) => `
            <label class="check"><input type="checkbox" data-eligible="${i}" value="${esc(u.id)}" ${b.eligibleUnitIds.includes(u.id) ? 'checked' : ''}><span>${esc(u.name || 'Unnamed unit')}</span></label>`).join('') : '<p class="muted">Add units first.</p>'}
        </fieldset>
        ${sharedPicker('buildings', i, b)}
        ${abilitiesEditor('buildings', i, b.abilities)}
        <button class="btn small danger" data-a="del-building" data-i="${i}">Delete building</button>
      </details>`;
    }

    const TABS = [
      ['abilities', 'Abilities', () => draft.abilities.length],
      ['weapons', 'Weapons', () => draft.weapons.length],
      ['units', 'Units', () => draft.units.length],
      ['buildings', 'Buildings', () => draft.buildings.length],
    ];

    function tabContent() {
      switch (activeTab) {
        case 'weapons':
          return `<section class="list">${draft.weapons.map(weaponCard).join('')}</section>
            <button class="btn" data-a="add-weapon">+ Add weapon</button>`;
        case 'units':
          return `<section class="list">${draft.units.map(unitCard).join('')}</section>
            <button class="btn" data-a="add-unit">+ Add unit</button>`;
        case 'buildings':
          return `<section class="list">${draft.buildings.map(buildingCard).join('')}</section>
            <button class="btn" data-a="add-building">+ Add building</button>`;
        default:
          return `<p class="muted">Write an ability once and tick it on any unit, weapon or building it targets.</p>
            <section class="list">${draft.abilities.map(sharedAbilityCard).join('')}</section>
            <button class="btn" data-a="add-shared">+ Add shared ability</button>`;
      }
    }

    function render() {
      el.innerHTML = `
        ${ui.header(isNew ? 'Create faction' : 'Edit faction', '#/factions')}
        <section class="form">
          ${field('Faction name', 'name', draft.name)}
        </section>
        <div class="tabs" role="tablist">
          ${TABS.map(([key, label, count]) => `<button role="tab" class="${activeTab === key ? 'active' : ''}" aria-selected="${activeTab === key}" data-tab="${key}">${label} (${count()})</button>`).join('')}
        </div>
        ${tabContent()}
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
        draft[t.dataset.kind][+t.dataset.range].range = t.value === 'melee' ? 'melee' : 1;
        render();
      } else if (t.dataset.targetOf !== undefined) {
        const a = draft.abilities[+t.dataset.targetOf];
        const used = model.sharedAbilityUsage(draft, a.id);
        if (used && !confirm(`"${a.name}" is used by ${usageLabel(a)}. Changing the target removes it from them. Continue?`)) {
          t.value = a.target;
          return;
        }
        removeSharedEverywhere(a.id);
        a.target = t.value;
        render();
      } else if (t.dataset.shared !== undefined) {
        const item = draft[t.dataset.shared][+t.dataset.i];
        item.sharedAbilityIds = t.checked
          ? [...item.sharedAbilityIds, t.value]
          : item.sharedAbilityIds.filter((x) => x !== t.value);
        render();
      } else if (t.dataset.equip !== undefined) {
        if (!t.value) return;
        const u = draft.units[+t.dataset.equip];
        if (u.weaponIds.length < model.MAX_WEAPONS_PER_UNIT) u.weaponIds.push(t.value);
        render();
      } else if (t.dataset.hq !== undefined) {
        draft.hqBuildingIds = t.checked
          ? [...draft.hqBuildingIds, t.value]
          : draft.hqBuildingIds.filter((x) => x !== t.value);
        render();
      } else if (t.dataset.eligible !== undefined) {
        const b = draft.buildings[+t.dataset.eligible];
        b.eligibleUnitIds = t.checked
          ? [...b.eligibleUnitIds, t.value]
          : b.eligibleUnitIds.filter((x) => x !== t.value);
      }
    });

    el.addEventListener('click', (ev) => {
      const tab = ev.target.closest('[data-tab]');
      if (tab) {
        activeTab = tab.dataset.tab;
        render();
        return;
      }
      const btn = ev.target.closest('[data-a]');
      if (!btn) return;
      const i = +btn.dataset.i;
      switch (btn.dataset.a) {
        case 'add-shared': {
          const a = model.newSharedAbility('unit');
          draft.abilities.push(a);
          open.add(a.id);
          break;
        }
        case 'del-shared': {
          const a = draft.abilities[i];
          const used = model.sharedAbilityUsage(draft, a.id);
          if (!confirm(`Delete shared ability "${a.name}"?${used ? ` It is removed from ${usageLabel(a)}.` : ''}`)) return;
          draft.abilities.splice(i, 1);
          removeSharedEverywhere(a.id);
          break;
        }
        case 'add-weapon': {
          const w = model.newWeapon();
          draft.weapons.push(w);
          open.add(w.id);
          break;
        }
        case 'del-weapon': {
          const w = draft.weapons[i];
          if (!confirm(`Delete weapon "${w.name}"? It is removed from every unit that carries it.`)) return;
          draft.weapons.splice(i, 1);
          draft.units.forEach((u) => (u.weaponIds = u.weaponIds.filter((x) => x !== w.id)));
          break;
        }
        case 'unequip':
          draft.units[i].weaponIds.splice(+btn.dataset.j, 1);
          break;
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
          if (!draft.buildings.length) draft.hqBuildingIds = [b.id];
          draft.buildings.push(b);
          open.add(b.id);
          break;
        }
        case 'del-building': {
          const b = draft.buildings[i];
          if (!confirm(`Delete building "${b.name}"?`)) return;
          draft.buildings.splice(i, 1);
          draft.hqBuildingIds = draft.hqBuildingIds.filter((x) => x !== b.id);
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
      ui.toast(faction.buildings.length && !faction.hqBuildingIds.length ? 'Saved - mark a building as HQ to play' : 'Faction saved');
      ui.go('#/factions');
    }

    render();
  };
})(window.WHQ = window.WHQ || {});
