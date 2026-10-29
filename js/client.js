import { PEER_PREFIX, emitter, peerAvailable } from './net.js';

export function startClient({ code, me }) {
  const em = emitter();
  let peer = null;
  let conn = null;
  let retry = 0;
  let timer = null;
  let stopped = false;
  let lastSeen = 0;

  const session = {
    isHost: false,
    myId: me.id,
    code,
    connected: false,
    state: null,
    on: em.on,
    send(intent) {
      if (conn?.open) conn.send({ t: 'intent', intent });
      else em.emit('error', 'Not connected to the captain. Reconnecting…');
    },
    close,
  };

  function setStatus(connected, text) {
    session.connected = connected;
    em.emit('status', { connected, text });
  }

  function ensurePeer() {
    if (stopped) return;
    if (!peerAvailable()) {
      setStatus(false, 'The networking library failed to load.');
      schedule();
      return;
    }
    if (peer && peer.open && !peer.disconnected) {
      openConn();
      return;
    }
    peer?.destroy();
    peer = new window.Peer({ debug: 1 });
    const p = peer;
    p.on('open', () => p === peer && openConn());
    p.on('error', err => {
      if (p !== peer) return;
      setStatus(false, err.type === 'peer-unavailable' ? `Room ${code} not found. Is the captain online?` : `Connection trouble (${err.type}).`);
      schedule();
    });
  }

  function openConn() {
    const old = conn;
    conn = null;
    try { old?.close(); } catch { /* already closed */ }
    const c = peer.connect(PEER_PREFIX + code, { reliable: true, serialization: 'json' });
    conn = c;
    const openTimeout = setTimeout(() => {
      if (!c.open && c === conn) {
        try { c.close(); } catch { /* ignore */ }
        schedule();
      }
    }, 8000);
    c.on('open', () => {
      clearTimeout(openTimeout);
      retry = 0;
      lastSeen = Date.now();
      setStatus(true, 'Connected');
      c.send({ t: 'hello', pid: me.id, name: me.name, color: me.color });
    });
    c.on('data', msg => {
      if (c !== conn) return;
      lastSeen = Date.now();
      onMessage(msg);
    });
    c.on('close', () => c === conn && schedule());
    c.on('error', () => c === conn && schedule());
  }

  function schedule() {
    if (stopped || timer) return;
    if (session.connected) setStatus(false, 'Lost the captain. Reconnecting…');
    const delay = Math.min(10000, 1000 * 2 ** retry++);
    timer = setTimeout(() => {
      timer = null;
      ensurePeer();
    }, delay);
  }

  function onMessage(msg) {
    if (!msg || typeof msg !== 'object') return;
    if (msg.t === 'state' && msg.state) {
      session.state = msg.state;
      em.emit('state', msg.state);
    } else if (msg.t === 'events' && Array.isArray(msg.events)) {
      em.emit('events', msg.events);
    } else if (msg.t === 'error') {
      if (msg.fatal) {
        close();
        em.emit('fatal', String(msg.msg));
      } else {
        em.emit('error', String(msg.msg));
      }
    }
  }

  const pingTimer = setInterval(() => {
    if (!conn?.open) return;
    conn.send({ t: 'ping' });
    if (Date.now() - lastSeen > 10000) {
      const c = conn;
      conn = null;
      try { c.close(); } catch { /* ignore */ }
      schedule();
    }
  }, 3000);

  function onVisible() {
    if (document.visibilityState !== 'visible' || stopped || conn?.open) return;
    clearTimeout(timer);
    timer = null;
    retry = 0;
    ensurePeer();
  }
  document.addEventListener('visibilitychange', onVisible);

  function close() {
    stopped = true;
    clearInterval(pingTimer);
    clearTimeout(timer);
    document.removeEventListener('visibilitychange', onVisible);
    try { conn?.close(); } catch { /* ignore */ }
    peer?.destroy();
  }

  setStatus(false, `Searching for room ${code}…`);
  ensurePeer();
  return session;
}
