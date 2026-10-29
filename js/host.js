import { createState, applyIntent, getPlayer } from './rules.js';
import { openHostPeer, emitter, randomId } from './net.js';

const SAVE_KEY = 'sf-host';

export function loadHostSave() {
  try {
    const saved = JSON.parse(localStorage.getItem(SAVE_KEY));
    return saved?.code && saved?.state ? saved : null;
  } catch {
    return null;
  }
}

export const clearHostSave = () => localStorage.removeItem(SAVE_KEY);

export async function startHost({ code, me, savedState }) {
  const peer = await openHostPeer(code);
  const em = emitter();
  const conns = new Map();

  const session = {
    isHost: true,
    myId: me.id,
    code,
    connected: true,
    state: savedState || createState(code, randomId().slice(0, 8)),
    on: em.on,
    send(intent) {
      const err = apply(me.id, intent);
      if (err) em.emit('error', err);
    },
    close() {
      for (const c of conns.values()) c.close();
      peer.destroy();
    },
  };

  if (savedState) {
    session.state.players.forEach(p => { p.connected = p.id === me.id; });
  } else {
    apply(me.id, { type: 'join', name: me.name, color: me.color });
  }
  persist();

  function persist() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({ code, myId: me.id, state: session.state }));
    } catch {
      // Storage full or blocked: the game still works, it just can't resume.
    }
  }

  function apply(pid, intent, opts = {}) {
    const res = applyIntent(session.state, pid, intent, { ...opts, isHost: pid === me.id });
    if (res.error) return res.error;
    session.state = res.state;
    persist();
    dropRemovedPlayers();
    for (const c of conns.values()) if (c.open) c.send({ t: 'state', state: session.state });
    em.emit('state', session.state);
    if (res.events.length) {
      for (const c of conns.values()) if (c.open) c.send({ t: 'events', events: res.events });
      em.emit('events', res.events);
    }
    return null;
  }

  function dropRemovedPlayers() {
    for (const [pid, c] of conns) {
      if (!getPlayer(session.state, pid)) {
        conns.delete(pid);
        c.pid = null;
        c.send({ t: 'error', msg: 'You were removed from the room.', fatal: true });
        setTimeout(() => c.close(), 500);
      }
    }
  }

  function onData(conn, msg) {
    if (!msg || typeof msg !== 'object') return;
    if (msg.t === 'ping') {
      conn.send({ t: 'pong' });
      return;
    }
    if (msg.t === 'hello') {
      const pid = typeof msg.pid === 'string' ? msg.pid.slice(0, 40) : '';
      if (!pid || pid === me.id) {
        conn.send({ t: 'error', msg: 'Invalid player.', fatal: true });
        return;
      }
      const old = conns.get(pid);
      if (old && old !== conn) {
        old.pid = null;
        old.close();
      }
      conn.pid = pid;
      conns.set(pid, conn);
      const err = apply(pid, { type: 'join', name: msg.name, color: msg.color });
      if (err) {
        conns.delete(pid);
        conn.pid = null;
        conn.send({ t: 'error', msg: err, fatal: true });
        setTimeout(() => conn.close(), 500);
      }
      return;
    }
    if (msg.t === 'intent' && conn.pid) {
      const err = apply(conn.pid, msg.intent);
      if (err) conn.send({ t: 'error', msg: err });
    }
  }

  function onClose(conn) {
    if (!conn.pid || conns.get(conn.pid) !== conn) return;
    conns.delete(conn.pid);
    apply(conn.pid, { type: 'presence', connected: false }, { system: true });
  }

  peer.on('connection', conn => {
    conn.on('data', msg => onData(conn, msg));
    conn.on('close', () => onClose(conn));
    conn.on('error', () => onClose(conn));
  });

  return session;
}
