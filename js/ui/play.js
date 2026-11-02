(function (WHQ) {
  'use strict';

  const { esc } = WHQ.util;
  const { storage, ui, army: rules } = WHQ;

  WHQ.ui.screens.play = function (el) {
    const faction = storage.getSelectedFaction();
    if (!faction) {
      el.innerHTML = ui.header('Start battle', '#/menu') +
        ui.empty('Select a faction first.', '<button class="btn primary" data-go="#/factions">Select faction</button>');
      return;
    }

    const game = storage.getGame();
    const armies = storage.getArmiesFor(faction.id);

    el.innerHTML = `
      ${ui.header('Start battle', '#/menu')}
      ${game ? `<article class="card notice">
        <p>A battle with <strong>${esc(game.army.name)}</strong> is in progress (round ${game.round}). Starting a new one ends it.</p>
        <button class="btn primary" data-go="#/game">Continue battle</button>
      </article>` : ''}
      <div class="grid">
        <label class="field"><span>Starting CP</span><input id="start-cp" type="number" inputmode="numeric" min="0" max="99" value="${WHQ.game.BASE_CP}"></label>
        <label class="field"><span>CP per round</span><input id="round-cp" type="number" inputmode="numeric" min="0" max="99" value="${WHQ.game.BASE_CP}"></label>
      </div>
      <p class="muted center">Choose an army of <strong>${esc(faction.name)}</strong></p>
      <section class="list">
        ${armies.length ? armies.map((a) => {
          const errors = rules.validate(a, faction);
          return `<article class="card">
            <div class="card-head">
              <h2>${esc(a.name)}</h2>
              <span class="muted">${rules.cost(a, faction)} / ${a.budget} pts &middot; ${Number.isFinite(a.supply) ? a.supply : WHQ.model.DEFAULT_ARMY_SUPPLY} supply</span>
            </div>
            ${errors.length
              ? `<ul class="errors">${errors.map((e) => `<li>${esc(e)}</li>`).join('')}</ul>
                 <button class="btn small" data-go="#/army/${esc(a.id)}">Fix army</button>`
              : `<button class="btn primary" data-a="start" data-id="${esc(a.id)}">To battle!</button>`}
          </article>`;
        }).join('') : ui.empty('No armies yet.', '<button class="btn primary" data-go="#/army/new">Create army</button>')}
      </section>`;

    el.addEventListener('click', (ev) => {
      const btn = ev.target.closest('[data-a="start"]');
      if (!btn) return;
      const army = storage.getArmy(btn.dataset.id);
      if (!army) return;
      if (game && !confirm('End the current battle and start a new one?')) return;
      storage.saveGame(WHQ.game.newGame(faction, army, {
        startCp: el.querySelector('#start-cp').value,
        cpPerRound: el.querySelector('#round-cp').value,
      }));
      ui.go('#/game');
    });
  };
})(window.WHQ = window.WHQ || {});
