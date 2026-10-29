import { h, clear, closeModal } from './ui/dom.js';
import { toast, showEvents } from './ui/events.js';
import { mountStart } from './ui/start.js';
import { mountLobby } from './ui/lobby.js';
import { mountLineup } from './ui/lineup.js';
import { mountGame } from './ui/game.js';
import { mountOver } from './ui/over.js';
import { startHost, loadHostSave } from './host.js';
import { startClient } from './client.js';
import { randomCode, randomId } from './net.js';
import { getPlayer } from './rules.js';
import { enableSensors } from './sensors.js';
import { keepAwake, isAwake, onAwakeChange, reacquire } from './wakelock.js';

const PID_KEY = 'sf-pid';
const PROFILE_KEY = 'sf-profile';
const CLIENT_KEY = 'sf-client';
const SCREENS = { lobby: mountLobby, lineup: mountLineup, playing: mountGame, over: mountOver };

const appEl = document.getElementById('app');
const banner = document.getElementById('banner');
const params = new URLSearchParams(location.search);

let session = null;
let screen = null;
let screenPhase = null;
let connStatus = null;

const app = {
  debug: params.has('debug'),
  leave() {
    const msg = session?.isHost
      ? 'Leave? The room closes for everyone (you can resume it from the start screen).'
      : 'Leave this voyage?';
    if (!confirm(msg)) return;
    if (session && !session.isHost) localStorage.removeItem(CLIENT_KEY);
    showStart();
  },
};

function playerId() {
  let id = localStorage.getItem(PID_KEY);
  if (!id) {
    id = randomId();
    localStorage.setItem(PID_KEY, id);
  }
  return id;
}

function loadJson(key) {
  try {
    return JSON.parse(localStorage.getItem(key)) || null;
  } catch {
    return null;
  }
}

// Sensor permission and wake lock both need to start inside the tap handler.
function prepareDevice(profile) {
  enableSensors();
  keepAwake();
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
}

function closeSession() {
  closeModal();
  screen?.unmount();
  screen = null;
  screenPhase = null;
  session?.close();
  session = null;
  connStatus = null;
  updateBanner();
}

function showStart(message = '') {
  closeSession();
  clear(appEl);
  mountStart(appEl, {
    profile: loadJson(PROFILE_KEY) || {},
    prefillCode: params.get('room') || loadJson(CLIENT_KEY)?.code || '',
    savedHost: loadHostSave(),
    message,
    onCreate: createRoom,
    onJoin: joinRoom,
    onResume: resumeHost,
  });
}

function showBusy(text, cancellable) {
  clear(appEl).append(h('div', { class: 'screen center' },
    h('h2', {}, text),
    h('p', { id: 'busy-status', class: 'hint' }, connStatus?.text || ''),
    cancellable && h('button', { class: 'btn', onclick: () => showStart() }, 'Cancel')));
}

const wait = ms => new Promise(r => setTimeout(r, ms));
const errorText = err => (err?.type ? `Connection error (${err.type}). Check your internet and try again.` : err?.message || String(err));

async function createRoom(profile) {
  prepareDevice(profile);
  closeSession();
  showBusy('Raising the flag…');
  const me = { id: playerId(), ...profile };
  for (let i = 0; i < 4; i++) {
    try {
      session = await startHost({ code: randomCode(), me });
      attach();
      return;
    } catch (err) {
      if (err?.type !== 'unavailable-id') {
        showStart(errorText(err));
        return;
      }
    }
  }
  showStart('Could not reserve a room code. Try again.');
}

async function resumeHost(profile) {
  prepareDevice(profile);
  const saved = loadHostSave();
  if (!saved) {
    showStart('No saved game found.');
    return;
  }
  closeSession();
  showBusy(`Reopening room ${saved.code}…`);
  const me = { id: playerId(), ...profile };
  // The broker can hold an old peer id for a short while after a reload.
  for (let i = 0; i < 6; i++) {
    try {
      session = await startHost({ code: saved.code, me, savedState: saved.state });
      attach();
      return;
    } catch (err) {
      if (err?.type !== 'unavailable-id') {
        showStart(errorText(err));
        return;
      }
      await wait(5000);
    }
  }
  showStart(`Room ${saved.code} is still in use. Wait a minute and try again.`);
}

function joinRoom(code, profile) {
  prepareDevice(profile);
  closeSession();
  localStorage.setItem(CLIENT_KEY, JSON.stringify({ code }));
  session = startClient({ code, me: { id: playerId(), ...profile } });
  showBusy(`Searching for room ${code}…`, true);
  attach();
}

function attach() {
  const s = session;
  s.on('state', state => s === session && render(state));
  s.on('events', events => s === session && showEvents(events, s.myId));
  s.on('error', msg => s === session && toast(msg, 'error'));
  s.on('status', st => {
    if (s !== session) return;
    connStatus = st;
    updateBanner();
    const el = document.getElementById('busy-status');
    if (el) el.textContent = st.text;
  });
  s.on('fatal', msg => {
    if (s !== session) return;
    localStorage.removeItem(CLIENT_KEY);
    showStart(msg);
  });
  if (s.state) render(s.state);
}

function render(state) {
  if (!getPlayer(state, session.myId)) {
    showStart('You are not part of this voyage.');
    return;
  }
  if (state.phase !== screenPhase) {
    closeModal();
    screen?.unmount();
    clear(appEl);
    screen = SCREENS[state.phase](appEl, session, app);
    screenPhase = state.phase;
  }
  screen.update(state);
}

function updateBanner() {
  const msgs = [];
  if (session && !session.isHost && connStatus && !connStatus.connected && screenPhase) msgs.push(`⚠ ${connStatus.text}`);
  if (session && !isAwake()) msgs.push('💤 Screen may sleep: tap here to keep it awake');
  banner.hidden = !msgs.length;
  banner.textContent = msgs.join('  ·  ');
}

banner.addEventListener('click', () => reacquire());
onAwakeChange(updateBanner);
window.addEventListener('beforeunload', e => {
  if (session && screenPhase && screenPhase !== 'lobby') e.preventDefault();
});

showStart();
