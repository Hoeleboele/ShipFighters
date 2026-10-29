// Nominal length of one grid space; only used to turn sensor distance into steps.
const CELL_METERS = 0.16;
const NORTH_KEY = 'sf-north';

let compass = null;
let northOffset = Number(localStorage.getItem(NORTH_KEY)) || 0;
let listening = false;
let tracker = null;

function onOrientation(e) {
  if (typeof e.webkitCompassHeading === 'number') compass = e.webkitCompassHeading;
  else if (typeof e.alpha === 'number') compass = (360 - e.alpha) % 360;
}

// Must be called synchronously inside a user tap (iOS permission rule).
export function enableSensors() {
  const requests = [];
  if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
    requests.push(DeviceOrientationEvent.requestPermission().catch(() => 'denied'));
  }
  if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
    requests.push(DeviceMotionEvent.requestPermission().catch(() => 'denied'));
  }
  return Promise.all(requests).then(() => {
    if (listening) return;
    listening = true;
    const evt = 'ondeviceorientationabsolute' in window ? 'deviceorientationabsolute' : 'deviceorientation';
    window.addEventListener(evt, onOrientation);
  });
}

export const hasCompass = () => compass !== null;
export const hasMotion = () => typeof DeviceMotionEvent !== 'undefined';

export function calibrateNorth() {
  if (compass === null) return false;
  northOffset = compass;
  localStorage.setItem(NORTH_KEY, String(northOffset));
  return true;
}

// Phone heading relative to the line-up direction: 0=N 1=E 2=S 3=W, or null when unknown.
export function physicalHeading() {
  if (compass === null) return null;
  const rel = (compass - northOffset + 360) % 360;
  return Math.round(rel / 90) % 4;
}

export function startTracking(onUpdate) {
  stopTracking();
  if (!hasMotion()) return false;
  const t = { steps: [], dist: 0, v: 0, lastT: null, quiet: 0, base: compass, segH: 0, pending: null, pendingSince: 0 };
  const forward = () => Array(Math.max(0, Math.round(t.dist / CELL_METERS))).fill('F');
  const current = () => [...t.steps, ...forward()];

  function detectTurn(now) {
    if (compass === null) return;
    if (t.base === null) t.base = compass;
    const rel = (compass - t.base + 360) % 360;
    const q = Math.round(rel / 90) % 4;
    const off = Math.abs(rel - Math.round(rel / 90) * 90);
    if (off > 25 || q === t.segH) {
      t.pending = null;
      return;
    }
    if (t.pending !== q) {
      t.pending = q;
      t.pendingSince = now;
      return;
    }
    if (now - t.pendingSince < 0.5) return;
    t.steps.push(...forward());
    t.dist = 0;
    t.v = 0;
    const diff = (q - t.segH + 4) % 4;
    if (diff === 1) t.steps.push('R');
    else if (diff === 3) t.steps.push('L');
    else t.steps.push('R', 'R');
    t.segH = q;
    t.pending = null;
  }

  // Zero-velocity resets while the phone is still keep integration drift in check.
  t.onMotion = e => {
    const a = e.acceleration;
    if (!a || a.y == null) return;
    const now = performance.now() / 1000;
    if (t.lastT === null) {
      t.lastT = now;
      return;
    }
    const dt = Math.min(0.1, now - t.lastT);
    t.lastT = now;
    const ay = Math.abs(a.y) < 0.12 ? 0 : a.y;
    if (Math.hypot(a.x || 0, a.y) < 0.2) {
      t.quiet += dt;
      if (t.quiet > 0.25) t.v = 0;
    } else {
      t.quiet = 0;
    }
    t.v += ay * dt;
    t.dist += Math.abs(t.v) * dt;
    detectTurn(now);
    onUpdate(current());
  };

  window.addEventListener('devicemotion', t.onMotion);
  tracker = { t, current };
  return true;
}

export function stopTracking() {
  if (!tracker) return null;
  window.removeEventListener('devicemotion', tracker.t.onMotion);
  const result = tracker.current();
  tracker = null;
  return result;
}
