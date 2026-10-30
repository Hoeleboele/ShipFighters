(function (WHQ) {
  'use strict';

  const { esc } = WHQ.util;
  const { storage, ui, share } = WHQ;
  const LARGE_QR_CHARS = 1500;

  WHQ.ui.screens.share = async function (el, id) {
    const faction = storage.getFaction(id);
    const head = ui.header('Share faction', '#/factions');
    if (!faction) {
      el.innerHTML = head + ui.empty('Faction not found.');
      return;
    }
    el.innerHTML = head + '<p class="muted center">Preparing scroll&hellip;</p>';

    const url = share.shareUrl(await share.encodeFaction(faction));
    const svg = share.qrSvg(url);
    if (!el.isConnected) return;

    el.innerHTML = `${head}
      <article class="card center">
        <h2>${esc(faction.name)}</h2>
        ${svg
          ? `<div class="qr">${svg}</div>
             <p>Scan with the other player's camera to open Wargame HQ and import this faction.</p>
             ${url.length > LARGE_QR_CHARS ? '<p class="muted">Large faction: turn up screen brightness, or send the link instead.</p>' : ''}`
          : '<ul class="errors"><li>This faction is too large for a QR code. Send the link instead.</li></ul>'}
        ${location.protocol === 'file:' ? '<ul class="errors"><li>Opened from a local file: the link only works on this device. Share from the hosted site.</li></ul>' : ''}
        <textarea class="link" readonly rows="3">${esc(url)}</textarea>
        <div class="actions">
          <button class="btn primary" data-a="copy">Copy link</button>
          ${navigator.share ? '<button class="btn" data-a="native">Share&hellip;</button>' : ''}
        </div>
        <p class="muted">Importing replaces all factions and armies on the receiving device.</p>
      </article>`;

    el.addEventListener('click', async (ev) => {
      const btn = ev.target.closest('[data-a]');
      if (!btn) return;
      try {
        if (btn.dataset.a === 'copy') {
          await navigator.clipboard.writeText(url);
          ui.toast('Link copied');
        } else if (btn.dataset.a === 'native') {
          await navigator.share({ title: `Wargame HQ - ${faction.name}`, url });
        }
      } catch {
        el.querySelector('textarea.link').select();
      }
    });
  };

  WHQ.ui.screens.import = function (el) {
    const head = ui.header('Import faction', '#/factions');
    let incoming = null;

    function showForm(message) {
      el.innerHTML = `${head}
        <section class="form">
          <label class="field"><span>Paste a share link</span><textarea id="import-link" rows="4"></textarea></label>
          ${message ? `<ul class="errors"><li>${esc(message)}</li></ul>` : ''}
          <button class="btn primary" data-a="read">Read link</button>
        </section>`;
    }

    function showPreview() {
      el.innerHTML = `${head}
        <article class="card center">
          <h2>${esc(incoming.name || 'Unnamed faction')}</h2>
          <p class="muted">${incoming.units.length} units &middot; ${incoming.buildings.length} buildings</p>
          <ul class="errors"><li>Importing replaces ALL your factions and armies on this device.</li></ul>
          <div class="actions">
            <button class="btn" data-go="#/menu">Cancel</button>
            <button class="btn primary" data-a="confirm">Replace my data</button>
          </div>
        </article>`;
    }

    async function load(data) {
      el.innerHTML = head + '<p class="muted center">Reading scroll&hellip;</p>';
      try {
        incoming = await share.decodeFaction(data);
        showPreview();
      } catch (e) {
        showForm(e.message);
      }
    }

    el.addEventListener('click', (ev) => {
      const btn = ev.target.closest('[data-a]');
      if (!btn) return;
      if (btn.dataset.a === 'read') {
        load(share.extractData(el.querySelector('#import-link').value));
      } else if (btn.dataset.a === 'confirm' && incoming) {
        storage.replaceAllWith(incoming);
        ui.toast('Faction imported');
        ui.go('#/menu');
      }
    });

    const pending = ui.pendingImport;
    ui.pendingImport = null;
    if (pending) load(pending);
    else showForm();
  };
})(window.WHQ = window.WHQ || {});
