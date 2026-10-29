let lock = null;
let video = null;
let wanted = false;
const listeners = [];

const notify = () => listeners.forEach(cb => cb());
export const onAwakeChange = cb => listeners.push(cb);
export const isAwake = () => !!lock || (!!video && !video.paused);

export function keepAwake() {
  if (!wanted) {
    wanted = true;
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') reacquire();
    });
  }
  return reacquire();
}

export async function reacquire() {
  if (!wanted || lock) return;
  if ('wakeLock' in navigator) {
    try {
      lock = await navigator.wakeLock.request('screen');
      lock.addEventListener('release', () => {
        lock = null;
        notify();
      });
      notify();
      return;
    } catch {
      // Denied or unsupported in this context; fall through to the video trick.
    }
  }
  playFallbackVideo();
}

// Older browsers keep the screen on while a video plays inline.
function playFallbackVideo() {
  if (!video) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 2;
    const ctx = canvas.getContext('2d');
    if (!canvas.captureStream) return;
    let flip = false;
    setInterval(() => {
      flip = !flip;
      ctx.fillStyle = flip ? '#000' : '#010101';
      ctx.fillRect(0, 0, 2, 2);
    }, 1000);
    video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.setAttribute('playsinline', '');
    video.setAttribute('aria-hidden', 'true');
    Object.assign(video.style, { position: 'fixed', width: '1px', height: '1px', opacity: '0.01', pointerEvents: 'none', bottom: '0', left: '0' });
    video.srcObject = canvas.captureStream(1);
    video.addEventListener('play', notify);
    video.addEventListener('pause', notify);
    document.body.append(video);
  }
  video.play().catch(() => notify());
}
