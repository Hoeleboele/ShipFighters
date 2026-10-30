(function (WHQ) {
  'use strict';

  const { ui } = WHQ;

  const routes = [
    [/^#\/(menu)?$/, 'menu'],
    [/^#\/factions$/, 'factions'],
    [/^#\/faction\/([a-z0-9]+)$/i, 'factionEditor'],
    [/^#\/armies$/, 'armies'],
    [/^#\/army\/([a-z0-9]+)$/i, 'armyBuilder'],
    [/^#\/play$/, 'play'],
    [/^#\/game$/, 'game'],
    [/^#\/share\/([a-z0-9]+)$/i, 'share'],
    [/^#\/import$/, 'import'],
  ];

  function route() {
    let hash = location.hash || '#/menu';

    // Share links arrive as #import=<data>; stash the data and show the import screen.
    if (hash.startsWith('#' + WHQ.share.IMPORT_KEY)) {
      ui.pendingImport = hash.slice(1 + WHQ.share.IMPORT_KEY.length);
      hash = '#/import';
      history.replaceState(null, '', hash);
    }

    let screen = 'menu';
    let param;
    for (const [re, name] of routes) {
      const m = hash.match(re);
      if (m) {
        screen = name;
        param = m[1];
        break;
      }
    }

    const app = document.getElementById('app');
    const el = document.createElement('div');
    el.className = `screen screen-${screen}`;
    app.replaceChildren(el);
    window.scrollTo(0, 0);
    ui.screens[screen](el, param);
  }

  document.addEventListener('click', (ev) => {
    const target = ev.target.closest('[data-go]');
    if (target && !target.disabled) ui.go(target.dataset.go);
  });

  window.addEventListener('hashchange', route);
  route();
})(window.WHQ = window.WHQ || {});
