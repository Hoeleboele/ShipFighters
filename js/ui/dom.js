const SVG_NS = 'http://www.w3.org/2000/svg';

export function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k in el) el[k] = v;
    else el.setAttribute(k, v);
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : String(c));
  }
  return el;
}

export function svg(attrs = {}) {
  const el = document.createElementNS(SVG_NS, 'svg');
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
}

// Only ever pass trusted, generated markup here; player text must go through esc().
export function svgFromMarkup(markup, attrs) {
  const el = svg(attrs);
  el.innerHTML = markup;
  return el;
}

export const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function clear(el) {
  el.replaceChildren();
  return el;
}

let activeModal = null;

export function openModal(title, { onClose } = {}) {
  activeModal?.close();
  const root = document.getElementById('overlay');
  const body = h('div', { class: 'modal-body' });
  let closed = false;
  const modal = {
    body,
    close() {
      if (closed) return;
      closed = true;
      if (activeModal === modal) {
        activeModal = null;
        root.hidden = true;
        root.replaceChildren();
      }
      onClose?.();
    },
  };
  const box = h('div', { class: 'modal' },
    h('div', { class: 'modal-head' }, h('h2', {}, title), h('button', { class: 'btn small ghost', onclick: () => modal.close(), 'aria-label': 'Close' }, '✕')),
    body);
  root.replaceChildren(box);
  root.hidden = false;
  root.onclick = e => { if (e.target === root) modal.close(); };
  activeModal = modal;
  return modal;
}

export const closeModal = () => activeModal?.close();
