export const PEER_PREFIX = 'shipfighter-';
export const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const CODE_RE = new RegExp(`^[${CODE_CHARS}]{4}$`);

export function randomCode() {
  return Array.from(crypto.getRandomValues(new Uint32Array(4)), n => CODE_CHARS[n % CODE_CHARS.length]).join('');
}

export function randomId() {
  return Array.from(crypto.getRandomValues(new Uint8Array(12)), b => b.toString(16).padStart(2, '0')).join('');
}

export function emitter() {
  const handlers = {};
  return {
    on(evt, cb) { (handlers[evt] ||= []).push(cb); },
    emit(evt, data) { (handlers[evt] || []).forEach(cb => cb(data)); },
  };
}

export function peerAvailable() {
  return typeof window.Peer === 'function';
}

export function openHostPeer(code) {
  return new Promise((resolve, reject) => {
    if (!peerAvailable()) {
      reject(new Error('The networking library failed to load. Check your internet connection.'));
      return;
    }
    const peer = new window.Peer(PEER_PREFIX + code, { debug: 1 });
    const onError = err => {
      peer.off('open', onOpen);
      peer.destroy();
      reject(err);
    };
    const onOpen = () => {
      peer.off('error', onError);
      peer.on('error', err => console.warn('Host peer error', err));
      // Losing the broker only blocks new joins; existing data channels stay up.
      peer.on('disconnected', () => {
        if (!peer.destroyed) setTimeout(() => !peer.destroyed && peer.disconnected && peer.reconnect(), 2000);
      });
      resolve(peer);
    };
    peer.once('open', onOpen);
    peer.once('error', onError);
  });
}
