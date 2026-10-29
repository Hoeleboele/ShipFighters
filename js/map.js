import { hashString, mulberry32, randInt } from './rng.js';

export const ISLAND_TYPES = ['port', 'mission', 'treasure', 'mystery'];

export function generateMap(cols, rows, seedStr) {
  const rng = mulberry32(hashString(seedStr));
  const tiles = Array.from({ length: cols * rows }, () => ({ type: 'sea' }));
  // The bottom two rows stay open sea so the line-up has room to sail off.
  const featureRows = Math.max(1, rows - 2);
  const area = cols * featureRows;
  const islands = [];

  const isSea = (x, y) => tiles[y * cols + x].type === 'sea';

  function place(type, count, minIslandDist) {
    for (let n = 0; n < count; n++) {
      for (let attempt = 0; attempt < 80; attempt++) {
        const x = randInt(rng, 0, cols - 1);
        const y = randInt(rng, 0, featureRows - 1);
        if (!isSea(x, y)) continue;
        if (islands.some(p => Math.max(Math.abs(p.x - x), Math.abs(p.y - y)) < minIslandDist)) continue;
        tiles[y * cols + x] = { type };
        if (ISLAND_TYPES.includes(type)) islands.push({ x, y });
        break;
      }
    }
  }

  function placeFog(clusters) {
    for (let n = 0; n < clusters; n++) {
      let x = randInt(rng, 0, cols - 1);
      let y = randInt(rng, 0, featureRows - 1);
      const size = randInt(rng, 2, 3);
      let placed = 0;
      for (let k = 0; k < 12 && placed < size; k++) {
        if (isSea(x, y)) {
          tiles[y * cols + x] = { type: 'fog' };
          placed++;
        }
        x = Math.min(cols - 1, Math.max(0, x + randInt(rng, -1, 1)));
        y = Math.min(featureRows - 1, Math.max(0, y + randInt(rng, -1, 1)));
      }
    }
  }

  place('port', Math.max(2, Math.round(area / 40)), 3);
  place('mission', Math.max(2, Math.round(area / 45)), 3);
  place('treasure', Math.max(2, Math.round(area / 24)), 2);
  place('mystery', Math.max(2, Math.round(area / 24)), 2);
  place('reef', Math.max(2, Math.round(area / 16)), 1);
  place('storm', Math.max(1, Math.round(area / 30)), 1);
  placeFog(Math.max(1, Math.round(area / 50)));

  return { cols, rows, tiles };
}
