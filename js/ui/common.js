(function (WHQ) {
  'use strict';

  const { esc } = WHQ.util;
  let toastTimer = null;

  WHQ.ui = {
    screens: {},

    go(hash) {
      if (location.hash === hash) window.dispatchEvent(new HashChangeEvent('hashchange'));
      else location.hash = hash;
    },

    toast(message) {
      const el = document.getElementById('toast');
      el.textContent = message;
      el.classList.add('show');
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
    },

    header(title, back) {
      return `<header class="bar">
        ${back ? `<a class="back" href="${back}" aria-label="Back">&#8592;</a>` : ''}
        <h1>${esc(title)}</h1>
      </header>`;
    },

    statline(unit) {
      const stats = [
        ['HP', unit.health],
        ['DEF', unit.defense],
        ['DOD', unit.dodge],
        ['SPD', Number.isFinite(unit.speed) ? unit.speed : WHQ.model.DEFAULT_UNIT_SPEED],
        ['SUP', Number.isFinite(unit.supply) ? unit.supply : WHQ.model.DEFAULT_UNIT_SUPPLY],
      ];
      return `<dl class="stats">${stats
        .map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`)
        .join('')}</dl>`;
    },

    weaponSummary(w) {
      return `${w.hit}+ · A${w.attacks} · ${WHQ.model.rangeLabel(w.range)} · AP${w.ap}`;
    },

    weapons(faction, unit) {
      const list = WHQ.model.unitWeapons(faction, unit);
      if (!list.length) return '<p class="muted weapons-none">No weapons</p>';
      return `<table class="weapons">
        <thead><tr><th>Weapon</th><th>Hit</th><th>A</th><th>Rng</th><th>AP</th></tr></thead>
        <tbody>${list.map(({ weapon: w, count }) => {
          const abilities = WHQ.model.allAbilities(faction, w);
          return `
          <tr>
            <td>${count > 1 ? `${count}&times; ` : ''}${esc(w.name || 'Weapon')}</td>
            <td>${w.hit}+</td>
            <td>${esc(w.attacks)}</td>
            <td>${esc(WHQ.model.rangeLabel(w.range))}</td>
            <td>${w.ap}</td>
          </tr>
          ${abilities.length ? `<tr class="weapon-abilities"><td colspan="5">${WHQ.ui.abilities(abilities)}</td></tr>` : ''}`;
        }).join('')}
        </tbody>
      </table>`;
    },

    abilities(list) {
      if (!list || !list.length) return '';
      return `<ul class="abilities">${list
        .map((a) => `<li><strong>${esc(a.name || 'Ability')}</strong>${a.text ? ` &ndash; ${esc(a.text)}` : ''}</li>`)
        .join('')}</ul>`;
    },

    empty(text, actionHtml) {
      return `<div class="empty"><p>${esc(text)}</p>${actionHtml || ''}</div>`;
    },
  };
})(window.WHQ = window.WHQ || {});
