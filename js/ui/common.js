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
        ['ATK', unit.attack],
        ['DEF', unit.defense],
        ['DOD', unit.dodge],
        ['RNG', WHQ.model.rangeLabel(unit.range)],
      ];
      return `<dl class="stats">${stats
        .map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`)
        .join('')}</dl>`;
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
