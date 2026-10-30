(function (WHQ) {
  'use strict';

  const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

  WHQ.util = {
    uid() {
      return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    },

    esc(value) {
      return String(value == null ? '' : value).replace(/[&<>"']/g, (c) => ESC[c]);
    },

    clone(obj) {
      return JSON.parse(JSON.stringify(obj));
    },

    int(value, min, max, fallback) {
      if (value === '' || value === null || value === undefined) return fallback;
      const n = Number(value);
      if (!Number.isFinite(n)) return fallback;
      return Math.min(max, Math.max(min, Math.round(n)));
    },

    str(value, max) {
      return typeof value === 'string' ? value.slice(0, max) : '';
    },
  };
})(window.WHQ = window.WHQ || {});
