(function (WHQ) {
  'use strict';

  const { esc } = WHQ.util;
  const { storage, ui, model, game: rules } = WHQ;

  let activeTab = 'base';
  const openUnits = new Set();

  WHQ.ui.screens.game = function (el) {
    let state = storage.getGame();
    if (!state) {
      el.innerHTML = ui.header('Battle', '#/menu') +
        ui.empty('No battle in progress.', '<button class="btn primary" data-go="#/play">Start</button>');
      return;
    }

    const cpBtn = (label, action, attrs, disabled) =>
      `<button class="btn small primary" data-a="${action}" ${attrs} ${disabled || state.cp < 1 ? 'disabled' : ''}>${label} <span class="cost">1 CP</span></button>`;

    function buildingCard(b) {
      const def = model.findBuilding(state.faction, b.buildingId);
      const entry = rules.entryOf(state, b.entryId);
      if (!def || !entry) return '';
      const isHq = def.id === state.faction.hqBuildingId;
      const status = !b.built ? ['Unbuilt', 'red'] : b.exhausted ? ['Exhausted', 'grey'] : ['Ready', 'green'];
      return `<article class="card building ${b.built ? '' : 'unbuilt'} ${b.exhausted ? 'exhausted' : ''}">
        <div class="card-head">
          <h3>${esc(def.name)} ${isHq ? '<span class="badge gold">HQ</span>' : ''}</h3>
          <span class="badge ${status[1]}">${status[0]}</span>
        </div>
        ${def.generation ? `<p class="muted">Generates +${def.generation} CP per round</p>` : ''}
        ${ui.abilities(def.abilities)}
        <div class="actions">
          ${!b.built ? cpBtn('Build', 'build', `data-entry="${esc(b.entryId)}"`) : ''}
          ${b.built && def.abilities.length ? cpBtn('Use ability', 'ability', `data-entry="${esc(b.entryId)}"`, b.exhausted) : ''}
        </div>
        ${entry.unitPicks.length ? `<ul class="slots">${entry.unitPicks.map((uid, slot) => {
          const unit = model.findUnit(state.faction, uid);
          const onTable = rules.slotOccupant(state, b.entryId, slot);
          return `<li>
            <span>${esc(unit ? unit.name : 'Unknown')}</span>
            ${onTable ? '<span class="badge green">On the field</span>'
              : b.built ? cpBtn('Create', 'create', `data-entry="${esc(b.entryId)}" data-slot="${slot}"`)
              : '<span class="muted">Build first</span>'}
          </li>`;
        }).join('')}</ul>` : ''}
      </article>`;
    }

    function originName(u) {
      const origin = state.buildings.find((b) => b.entryId === u.entryId);
      const bDef = origin && model.findBuilding(state.faction, origin.buildingId);
      return bDef ? bDef.name : '';
    }

    function groupByType(units) {
      const groups = new Map();
      for (const u of units) {
        if (!groups.has(u.unitId)) groups.set(u.unitId, []);
        groups.get(u.unitId).push(u);
      }
      return [...groups.entries()];
    }

    function unitGroupCard([unitId, units]) {
      const def = model.findUnit(state.faction, unitId);
      if (!def) return '';
      const ready = units.filter((u) => !u.activated);
      return `<article class="card unit compact ${ready.length ? '' : 'exhausted'}">
        <div class="card-head">
          <h3>${esc(def.name)} <span class="count">&times;${units.length}</span></h3>
          <span class="muted">${ready.length} ready</span>
        </div>
        ${ui.statline(def)}
        ${ui.abilities(def.abilities)}
        <div class="actions">
          ${ready.length ? cpBtn('Activate one', 'activate', `data-unit="${esc(ready[0].id)}"`) : '<span class="badge grey">All activated</span>'}
        </div>
        <details class="instances" data-unit-card="${esc(unitId)}" ${openUnits.has(unitId) ? 'open' : ''}>
          <summary>Individual units</summary>
          <ul class="slots">${units.map((u) => `<li>
            <span>${esc(originName(u))} ${u.activated ? '<span class="badge grey">Activated</span>' : ''}</span>
            <button class="btn small danger" data-a="kill" data-unit="${esc(u.id)}">Slain</button>
          </li>`).join('')}</ul>
        </details>
      </article>`;
    }

    function fallenList(units) {
      return `<ul class="slots">${groupByType(units).map(([unitId, list]) => {
        const def = model.findUnit(state.faction, unitId);
        return `<li><span>${esc(def ? def.name : 'Unknown')}</span><span class="count">&times;${list.length}</span></li>`;
      }).join('')}</ul>`;
    }

    function render() {
      const alive = state.units.filter((u) => !u.dead);
      const dead = state.units.filter((u) => u.dead);
      el.innerHTML = `
        <header class="bar game-bar">
          <a class="back" href="#/menu" aria-label="Menu">&#8592;</a>
          <div class="round">Round ${state.round}</div>
          <div class="cp" aria-label="Command points"><span>${state.cp}</span> CP</div>
        </header>
        <p class="muted center">${esc(state.army.name)} &middot; ${esc(state.faction.name)}</p>
        <div class="controls">
          <button class="btn small" data-a="undo" ${state.history.length ? '' : 'disabled'}>Undo</button>
          <button class="btn small primary" data-a="next">Next round</button>
          <button class="btn small danger" data-a="end">End battle</button>
        </div>
        <div class="tabs" role="tablist">
          <button role="tab" class="${activeTab === 'base' ? 'active' : ''}" data-tab="base">Base</button>
          <button role="tab" class="${activeTab === 'units' ? 'active' : ''}" data-tab="units">Units (${alive.length})</button>
        </div>
        <section class="list">
          ${activeTab === 'base'
            ? state.buildings.map(buildingCard).join('')
            : (alive.length ? groupByType(alive).map(unitGroupCard).join('') : ui.empty('No units on the field. Create them from your buildings.'))
              + (dead.length ? `<details class="fallen"><summary>Fallen (${dead.length})</summary>${fallenList(dead)}</details>` : '')}
        </section>`;
    }

    function run(fn) {
      try {
        state = fn(state);
        storage.saveGame(state);
        render();
      } catch (e) {
        ui.toast(e.message);
      }
    }

    el.addEventListener('toggle', (ev) => {
      const id = ev.target.dataset && ev.target.dataset.unitCard;
      if (!id) return;
      if (ev.target.open) openUnits.add(id);
      else openUnits.delete(id);
    }, true);

    el.addEventListener('click', (ev) => {
      const tab = ev.target.closest('[data-tab]');
      if (tab) {
        activeTab = tab.dataset.tab;
        render();
        return;
      }
      const btn = ev.target.closest('[data-a]');
      if (!btn) return;
      const d = btn.dataset;
      switch (d.a) {
        case 'build': run((s) => rules.build(s, d.entry)); break;
        case 'ability': run((s) => rules.useAbility(s, d.entry)); break;
        case 'create': run((s) => rules.createUnit(s, d.entry, +d.slot)); break;
        case 'activate': run((s) => rules.activateUnit(s, d.unit)); break;
        case 'kill': run((s) => rules.killUnit(s, d.unit)); break;
        case 'undo': run(rules.undo); break;
        case 'next':
          if (state.cp > 0 && !confirm(`You still have ${state.cp} CP. Start the next round?`)) return;
          run(rules.nextRound);
          break;
        case 'end':
          if (!confirm('End this battle?')) return;
          storage.clearGame();
          ui.go('#/menu');
          break;
      }
    });

    render();
  };
})(window.WHQ = window.WHQ || {});
