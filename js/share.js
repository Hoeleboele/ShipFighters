(function (WHQ) {
  'use strict';

  const MAX_PAYLOAD_CHARS = 20000;
  const MAX_JSON_CHARS = 2000000;
  const IMPORT_KEY = 'import=';

  function toBase64Url(bytes) {
    let bin = '';
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  function fromBase64Url(text) {
    let b64 = text.replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4) b64 += '=';
    return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  }

  // Prefix marks the format: 'z' = deflate-raw, 'j' = plain JSON (no CompressionStream support).
  async function pack(json) {
    if (typeof CompressionStream === 'undefined') {
      return 'j' + toBase64Url(new TextEncoder().encode(json));
    }
    const stream = new Blob([json]).stream().pipeThrough(new CompressionStream('deflate-raw'));
    const bytes = new Uint8Array(await new Response(stream).arrayBuffer());
    return 'z' + toBase64Url(bytes);
  }

  async function unpack(data) {
    if (!data || data.length > MAX_PAYLOAD_CHARS) throw new Error('Share data is missing or too large');
    const bytes = fromBase64Url(data.slice(1));
    let json;
    if (data[0] === 'j') {
      json = new TextDecoder().decode(bytes);
    } else if (data[0] === 'z') {
      if (typeof DecompressionStream === 'undefined') throw new Error('This browser cannot read compressed share data');
      const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
      json = await new Response(stream).text();
    } else {
      throw new Error('Unknown share format');
    }
    if (json.length > MAX_JSON_CHARS) throw new Error('Share data is too large');
    return json;
  }

  async function encodeFaction(faction) {
    return pack(JSON.stringify({ v: 1, type: 'faction', faction }));
  }

  async function decodeFaction(data) {
    let payload;
    try {
      payload = JSON.parse(await unpack(data));
    } catch (e) {
      throw new Error(e instanceof SyntaxError ? 'Share data is corrupt' : e.message);
    }
    if (!payload || payload.type !== 'faction') throw new Error('Share data does not contain a faction');
    return WHQ.model.normalizeFaction(payload.faction);
  }

  // Accepts a full share link or just the encoded data.
  function extractData(text) {
    const trimmed = String(text || '').trim();
    const i = trimmed.indexOf(IMPORT_KEY);
    return i >= 0 ? trimmed.slice(i + IMPORT_KEY.length) : trimmed;
  }

  function shareUrl(data) {
    return location.href.split('#')[0] + '#' + IMPORT_KEY + data;
  }

  function qrSvg(text) {
    try {
      const qr = window.qrcode(0, 'L');
      qr.addData(text);
      qr.make();
      return qr.createSvgTag({ cellSize: 4, margin: 16, scalable: true, alt: 'Faction share QR code' });
    } catch {
      return null;
    }
  }

  WHQ.share = { IMPORT_KEY, encodeFaction, decodeFaction, extractData, shareUrl, qrSvg };
})(window.WHQ = window.WHQ || {});
