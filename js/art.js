// SVG art drawn in a 100x200 box (one grid space, bow pointing up).

const safeColor = c => (/^#[0-9a-f]{6}$/i.test(c) ? c : '#888888');

export const SVG_DEFS = `<defs>
  <linearGradient id="sf-sea" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1f7896"/><stop offset="1" stop-color="#145069"/></linearGradient>
  <linearGradient id="sf-storm" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2c3440"/><stop offset="1" stop-color="#14202b"/></linearGradient>
  <pattern id="sf-edge" width="20" height="20" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="20" height="20" fill="#120c06"/><rect width="10" height="20" fill="#24180c"/></pattern>
</defs>`;

export const TILE_INFO = {
  sea: { name: 'Open sea', icon: '🌊', desc: 'Nothing but waves.' },
  port: { name: 'Port Town', icon: '⚓', desc: 'Market: repairs, food, crew and upgrades.' },
  mission: { name: 'Mission Port', icon: '📜', desc: 'Take missions and collect their rewards.' },
  treasure: { name: 'Treasure Island', icon: '❌', desc: 'First ship to land finds gold.' },
  mystery: { name: 'Mystery Island', icon: '❓', desc: 'Something strange happens once.' },
  reef: { name: 'Reef', icon: '🪨', desc: '-1 HP and your movement stops.' },
  fog: { name: 'Fog Bank', icon: '🌫', desc: 'Hidden from cannons and other players.' },
  storm: { name: 'Storm', icon: '⛈', desc: '50% chance of -2 HP when entered.' },
};

const WAVES = `<g stroke="#ffffff55" stroke-width="3" fill="none" stroke-linecap="round">
  <path d="M12 40 q8 -7 16 0 t16 0"/><path d="M58 150 q8 -7 16 0 t16 0"/><path d="M20 182 q8 -7 16 0"/>
</g>`;

const ISLAND = `<ellipse cx="50" cy="100" rx="40" ry="64" fill="#ecd69c"/>
<ellipse cx="50" cy="100" rx="30" ry="52" fill="#5f9e4a"/>
<circle cx="38" cy="78" r="10" fill="#3f7f34"/><circle cx="63" cy="124" r="12" fill="#3f7f34"/>`;

const icon = (ch, y = 104, size = 36) => `<text x="50" y="${y}" font-size="${size}" text-anchor="middle" dominant-baseline="middle">${ch}</text>`;

export function tileSvg(tile) {
  const sea = `<rect width="100" height="200" fill="url(#sf-sea)"/>${WAVES}`;
  switch (tile?.type) {
    case 'port':
      return `${sea}${ISLAND}<rect x="34" y="88" width="14" height="14" fill="#b5651d"/><rect x="52" y="96" width="14" height="14" fill="#a0522d"/>
        <rect x="46" y="150" width="8" height="40" fill="#6b4226"/>${icon('⚓', 60, 30)}`;
    case 'mission':
      return `${sea}${ISLAND}<line x1="50" y1="70" x2="50" y2="125" stroke="#3b2412" stroke-width="4"/><path d="M50 70 l26 9 l-26 9z" fill="#fff"/>${icon('📜', 140, 30)}`;
    case 'treasure':
      return `${sea}${ISLAND}${tile.looted ? icon('🕳', 104, 30) : `<g stroke="#b71c1c" stroke-width="8" stroke-linecap="round"><line x1="36" y1="86" x2="64" y2="116"/><line x1="64" y1="86" x2="36" y2="116"/></g>`}`;
    case 'mystery':
      return `${sea}${ISLAND}${tile.used ? '' : `<text x="50" y="108" font-size="56" font-weight="bold" text-anchor="middle" dominant-baseline="middle" fill="#fff3c4" stroke="#3b2412" stroke-width="2">?</text>`}`;
    case 'reef':
      return `${sea}<g fill="#6d6d6d" stroke="#3a3a3a" stroke-width="2">
        <path d="M20 70 l14 -16 l12 10 l-4 18z"/><path d="M52 110 l18 -14 l12 16 l-10 14z"/><path d="M28 140 l10 -10 l12 8 l-6 12z"/></g>
        <g fill="none" stroke="#e0f7fa" stroke-width="2" opacity=".8"><circle cx="36" cy="68" r="22"/><circle cx="66" cy="112" r="24"/></g>`;
    case 'fog':
      return `${sea}<g fill="#e8eef1" opacity=".75"><ellipse cx="30" cy="50" rx="40" ry="26"/><ellipse cx="72" cy="100" rx="42" ry="30"/><ellipse cx="34" cy="158" rx="44" ry="28"/></g>`;
    case 'storm':
      return `<rect width="100" height="200" fill="url(#sf-storm)"/>${WAVES}
        <g fill="#56606b"><ellipse cx="40" cy="60" rx="34" ry="18"/><ellipse cx="62" cy="52" rx="28" ry="16"/></g>
        <path d="M54 76 l-14 34 h12 l-8 30 l24 -42 h-12 l10 -22z" fill="#ffd54f"/>`;
    case 'sea':
      return sea;
    default:
      return `<rect width="100" height="200" fill="url(#sf-edge)"/>`;
  }
}

export function shipSvg(color, cannons = 2) {
  const c = safeColor(color);
  const pairs = Math.min(4, Math.max(1, Math.ceil(Number(cannons) / 2) || 1));
  let guns = '';
  for (let i = 0; i < pairs; i++) {
    const y = 92 + i * 20;
    guns += `<rect x="12" y="${y}" width="14" height="7" rx="2" fill="#1b1b1b"/><rect x="74" y="${y}" width="14" height="7" rx="2" fill="#1b1b1b"/>`;
  }
  return `<g>
    <path d="M50 10 C82 44 84 122 75 182 Q50 196 25 182 C16 122 18 44 50 10 Z" fill="#6b4226" stroke="#2b1a0e" stroke-width="3"/>
    <path d="M50 26 C72 56 72 122 66 172 Q50 180 34 172 C28 122 28 56 50 26 Z" fill="#a8763f"/>
    <g stroke="#8a5a2b" stroke-width="1.5"><line x1="40" y1="40" x2="40" y2="174"/><line x1="50" y1="30" x2="50" y2="178"/><line x1="60" y1="40" x2="60" y2="174"/></g>
    ${guns}
    <rect x="18" y="60" width="64" height="16" rx="8" fill="#f3ead2" stroke="${c}" stroke-width="5"/>
    <rect x="12" y="116" width="76" height="18" rx="9" fill="#f3ead2" stroke="${c}" stroke-width="5"/>
    <circle cx="50" cy="68" r="5" fill="#3b2412"/><circle cx="50" cy="125" r="5" fill="#3b2412"/>
    <path d="M50 150 l18 6 l-18 6z" fill="${c}" stroke="#2b1a0e" stroke-width="1"/>
  </g>`;
}

export function shipIcon(color, size = 60) {
  return `<svg viewBox="0 0 100 200" width="${size / 2}" height="${size}" aria-hidden="true">${shipSvg(color)}</svg>`;
}
