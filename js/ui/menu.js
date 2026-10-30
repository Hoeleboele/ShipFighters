(function (WHQ) {
  'use strict';

  const { esc } = WHQ.util;

  WHQ.ui.screens.menu = function (el) {
    const faction = WHQ.storage.getSelectedFaction();
    const hasGame = !!WHQ.storage.getGame();

    el.innerHTML = `
      <section class="menu">
        <div class="crest" aria-hidden="true"></div>
        <h1 class="title">Wargame HQ</h1>
        <p class="subtitle">${faction ? `Banner of <strong>${esc(faction.name)}</strong>` : 'No faction selected'}</p>
        <nav class="menu-buttons">
          ${hasGame ? '<button class="btn primary" data-go="#/game">Continue battle</button>' : ''}
          <button class="btn ${hasGame ? '' : 'primary'}" data-go="#/play">Start</button>
          <button class="btn" data-go="#/factions">Select faction</button>
          <button class="btn" data-go="#/faction/new">Create faction</button>
          <button class="btn" data-go="#/armies">Create army</button>
        </nav>
      </section>`;
  };
})(window.WHQ = window.WHQ || {});
