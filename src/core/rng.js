// Deterministic seeded Mulberry32 PRNG (owner: lucky-director).
// Ensures identical seeds produce bit-exact Lucky Drops, Roulette Chest spins, and F10 child-bot runs.

export function createRng(seed = 2026) {
  let s = (Number(seed) >>> 0) || 1;

  function next() {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  function range(min, max) {
    return min + (max - min) * next();
  }

  function int(min, maxInclusive) {
    return Math.floor(min + (maxInclusive - min + 1) * next());
  }

  function pick(arr) {
    if (!arr || arr.length === 0) return null;
    return arr[Math.floor(next() * arr.length)];
  }

  function weightedPick(items, weightFn = (x) => x.weight ?? 1) {
    if (!items || items.length === 0) return null;
    let total = 0;
    for (const item of items) {
      total += Math.max(0, Number(weightFn(item)) || 0);
    }
    if (total <= 0) return items[0];
    let r = next() * total;
    for (const item of items) {
      r -= Math.max(0, Number(weightFn(item)) || 0);
      if (r <= 0) return item;
    }
    return items[items.length - 1];
  }

  function getState() {
    return s >>> 0;
  }

  function setState(nextState) {
    s = (Number(nextState) >>> 0) || 1;
  }

  return { next, range, int, pick, weightedPick, getState, setState };
}
