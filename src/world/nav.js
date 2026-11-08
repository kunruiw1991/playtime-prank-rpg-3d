// Fast 1-block grid A* pathfinder (<= 2.0 ms) and zero-dead-tap walkable clamping (owner: lucky-world).

export const NAV_MIN = -36;
export const NAV_MAX = 36;
export const NAV_SPAN = NAV_MAX - NAV_MIN + 1; // 73
const NAV_TOTAL = NAV_SPAN * NAV_SPAN; // 5329

// Precompute Euclidean-sorted spiral offsets for instant nearest-walkable lookup
const SPIRAL_OFFSETS = (() => {
  const list = [];
  const maxR = 46;
  for (let dz = -maxR; dz <= maxR; dz++) {
    for (let dx = -maxR; dx <= maxR; dx++) {
      const d2 = dx * dx + dz * dz;
      if (d2 <= maxR * maxR) {
        list.push({ dx, dz, d2 });
      }
    }
  }
  list.sort((a, b) => a.d2 - b.d2);
  return list;
})();

const DIRS_8 = [
  { dx: 1, dz: 0, cost: 1.0 },
  { dx: -1, dz: 0, cost: 1.0 },
  { dx: 0, dz: 1, cost: 1.0 },
  { dx: 0, dz: -1, cost: 1.0 },
  { dx: 1, dz: 1, cost: Math.SQRT2 },
  { dx: 1, dz: -1, cost: Math.SQRT2 },
  { dx: -1, dz: 1, cost: Math.SQRT2 },
  { dx: -1, dz: -1, cost: Math.SQRT2 },
];

export function createNavGrid({ staticWalkable, heights, getSurfaceY }) {
  const dynamicBlocked = new Uint8Array(NAV_TOTAL);

  // Reusable A* buffers (zero per-call TypedArray allocations)
  const gScore = new Float32Array(NAV_TOTAL);
  const fScore = new Float32Array(NAV_TOTAL);
  const cameFrom = new Int16Array(NAV_TOTAL);
  const seenTag = new Uint32Array(NAV_TOTAL);
  const closedTag = new Uint32Array(NAV_TOTAL);
  const heapNodes = new Int16Array(NAV_TOTAL);
  const heapPos = new Int16Array(NAV_TOTAL);
  heapPos.fill(-1);
  let currentTag = 1;

  function inBounds(cx, cz) {
    return cx >= NAV_MIN && cx <= NAV_MAX && cz >= NAV_MIN && cz <= NAV_MAX;
  }

  function toIndex(cx, cz) {
    return (cz - NAV_MIN) * NAV_SPAN + (cx - NAV_MIN);
  }

  function fromIndexX(idx) {
    return (idx % NAV_SPAN) + NAV_MIN;
  }

  function fromIndexZ(idx) {
    return Math.floor(idx / NAV_SPAN) + NAV_MIN;
  }

  function isCellPassable(cx, cz, ignoreDynamic = false) {
    if (!inBounds(cx, cz)) return false;
    const idx = toIndex(cx, cz);
    if (staticWalkable[idx] === 0) return false;
    if (!ignoreDynamic && dynamicBlocked[idx] !== 0) return false;
    return true;
  }

  function clearDynamicBlockers() {
    dynamicBlocked.fill(0);
  }

  function setDynamicBlocked(x, z, size = 1, blocked = true) {
    const val = blocked ? 1 : 0;
    if (size <= 1.45) {
      const cx = Math.round(x);
      const cz = Math.round(z);
      if (inBounds(cx, cz)) {
        dynamicBlocked[toIndex(cx, cz)] = val;
      }
      return;
    }
    // Larger blocks (e.g., 2x2x2 Mega Titan block centered at integer x, z)
    const half = size * 0.5 - 0.05;
    const minCx = Math.round(x - half);
    const maxCx = Math.round(x + half);
    const minCz = Math.round(z - half);
    const maxCz = Math.round(z + half);
    for (let cz = minCz; cz <= maxCz; cz++) {
      for (let cx = minCx; cx <= maxCx; cx++) {
        if (inBounds(cx, cz)) {
          dynamicBlocked[toIndex(cx, cz)] = val;
        }
      }
    }
  }

  function clampToWalkable(x, z, opts = {}) {
    const ignoreDynamic = Boolean(opts.ignoreDynamic);
    const fx = Number.isFinite(x) ? x : 0;
    const fz = Number.isFinite(z) ? z : 4.5;
    const clampedFx = Math.max(NAV_MIN, Math.min(NAV_MAX, fx));
    const clampedFz = Math.max(NAV_MIN, Math.min(NAV_MAX, fz));
    const cx0 = Math.round(clampedFx);
    const cz0 = Math.round(clampedFz);

    if (isCellPassable(cx0, cz0, ignoreDynamic)) {
      // Gently keep float point 0.18 away from adjacent non-walkable ocean/prop edges
      let safeX = clampedFx;
      let safeZ = clampedFz;
      const offX = safeX - cx0;
      const offZ = safeZ - cz0;
      if (offX > 0.32 && !isCellPassable(cx0 + 1, cz0, ignoreDynamic)) safeX = cx0 + 0.32;
      if (offX < -0.32 && !isCellPassable(cx0 - 1, cz0, ignoreDynamic)) safeX = cx0 - 0.32;
      if (offZ > 0.32 && !isCellPassable(cx0, cz0 + 1, ignoreDynamic)) safeZ = cz0 + 0.32;
      if (offZ < -0.32 && !isCellPassable(cx0, cz0 - 1, ignoreDynamic)) safeZ = cz0 - 0.32;
      return { x: safeX, y: getSurfaceY(safeX, safeZ), z: safeZ };
    }

    for (let i = 0; i < SPIRAL_OFFSETS.length; i++) {
      const { dx, dz } = SPIRAL_OFFSETS[i];
      const nx = cx0 + dx;
      const nz = cz0 + dz;
      if (isCellPassable(nx, nz, ignoreDynamic)) {
        return { x: nx, y: getSurfaceY(nx, nz), z: nz };
      }
    }

    // Ultimate fallback: Hub Hero Spawn
    return { x: 0, y: 1, z: 4.5 };
  }

  function findApproachCell(tx, tz, sx, sz) {
    const tcx = Math.round(Math.max(NAV_MIN, Math.min(NAV_MAX, tx)));
    const tcz = Math.round(Math.max(NAV_MIN, Math.min(NAV_MAX, tz)));
    if (isCellPassable(tcx, tcz, false)) {
      return { cx: tcx, cz: tcz, exact: true };
    }

    // Find closest passable neighbor cell biased toward start position
    let bestCx = null;
    let bestCz = null;
    let bestScore = Infinity;
    const refH = inBounds(tcx, tcz) && staticWalkable[toIndex(tcx, tcz)] ? heights[toIndex(tcx, tcz)] : null;

    for (let r = 1; r <= 4; r++) {
      for (let dz = -r; dz <= r; dz++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
          const nx = tcx + dx;
          const nz = tcz + dz;
          if (!isCellPassable(nx, nz, false)) continue;
          const nh = heights[toIndex(nx, nz)];
          if (refH !== null && Math.abs(nh - refH) > 1.05) continue;
          const dTarget = Math.hypot(nx - tx, nz - tz);
          const dStart = Math.hypot(nx - sx, nz - sz);
          const score = dTarget * 4.0 + dStart * 0.18;
          if (score < bestScore) {
            bestScore = score;
            bestCx = nx;
            bestCz = nz;
          }
        }
      }
      if (bestCx !== null) {
        return { cx: bestCx, cz: bestCz, exact: false };
      }
    }

    const fallback = clampToWalkable(tx, tz);
    return { cx: Math.round(fallback.x), cz: Math.round(fallback.z), exact: false };
  }

  function canStepBetween(ax, az, bx, bz, startIdx) {
    if (!inBounds(bx, bz)) return false;
    const aIdx = toIndex(ax, az);
    const bIdx = toIndex(bx, bz);
    if (staticWalkable[bIdx] === 0) return false;
    if (bIdx !== startIdx && dynamicBlocked[bIdx] !== 0) return false;
    if (Math.abs(heights[bIdx] - heights[aIdx]) > 1.05) return false;

    const dx = bx - ax;
    const dz = bz - az;
    if (dx !== 0 && dz !== 0) {
      // Diagonal move: require both orthogonal neighbors passable & within step height
      const idx1 = toIndex(ax + dx, az);
      const idx2 = toIndex(ax, az + dz);
      if (staticWalkable[idx1] === 0 || staticWalkable[idx2] === 0) return false;
      if (dynamicBlocked[idx1] !== 0 || dynamicBlocked[idx2] !== 0) return false;
      if (Math.abs(heights[idx1] - heights[aIdx]) > 1.05) return false;
      if (Math.abs(heights[idx2] - heights[aIdx]) > 1.05) return false;
    }
    return true;
  }

  function hasClearLine(x0, z0, x1, z1, startIdx) {
    const dx = x1 - x0;
    const dz = z1 - z0;
    const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) * 2.5));
    let prevCx = Math.round(x0);
    let prevCz = Math.round(z0);
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const fx = x0 + dx * t;
      const fz = z0 + dz * t;
      const cx = Math.round(fx);
      const cz = Math.round(fz);
      if (cx === prevCx && cz === prevCz) continue;
      if (!canStepBetween(prevCx, prevCz, cx, cz, startIdx)) return false;
      prevCx = cx;
      prevCz = cz;
    }
    return true;
  }

  function findPath(sx, sz, tx, tz) {
    const startClamped = clampToWalkable(sx, sz, { ignoreDynamic: true });
    const scx = Math.round(startClamped.x);
    const scz = Math.round(startClamped.z);
    const goal = findApproachCell(tx, tz, sx, sz);
    const gcx = goal.cx;
    const gcz = goal.cz;

    const finalX = goal.exact ? clampToWalkable(tx, tz).x : gcx;
    const finalZ = goal.exact ? clampToWalkable(tx, tz).z : gcz;

    if (scx === gcx && scz === gcz) {
      return [{ x: finalX, y: getSurfaceY(finalX, finalZ), z: finalZ }];
    }

    currentTag = (currentTag + 1) >>> 0;
    if (currentTag === 0) {
      seenTag.fill(0);
      closedTag.fill(0);
      currentTag = 1;
    }
    const tag = currentTag;

    const startIdx = toIndex(scx, scz);
    const goalIdx = toIndex(gcx, gcz);

    // Binary min-heap operations
    let heapSize = 0;
    function swapHeap(i, j) {
      const ni = heapNodes[i];
      const nj = heapNodes[j];
      heapNodes[i] = nj;
      heapNodes[j] = ni;
      heapPos[nj] = i;
      heapPos[ni] = j;
    }
    function siftUp(i) {
      while (i > 0) {
        const p = (i - 1) >> 1;
        if (fScore[heapNodes[i]] < fScore[heapNodes[p]]) {
          swapHeap(i, p);
          i = p;
        } else {
          break;
        }
      }
    }
    function siftDown(i) {
      while (true) {
        let best = i;
        const l = i * 2 + 1;
        const r = l + 1;
        if (l < heapSize && fScore[heapNodes[l]] < fScore[heapNodes[best]]) best = l;
        if (r < heapSize && fScore[heapNodes[r]] < fScore[heapNodes[best]]) best = r;
        if (best !== i) {
          swapHeap(i, best);
          i = best;
        } else {
          break;
        }
      }
    }
    function pushOrDecrease(nodeIdx) {
      const pos = seenTag[nodeIdx] === tag ? heapPos[nodeIdx] : -1;
      if (pos >= 0 && pos < heapSize && heapNodes[pos] === nodeIdx) {
        siftUp(pos);
      } else {
        const idx = heapSize++;
        heapNodes[idx] = nodeIdx;
        heapPos[nodeIdx] = idx;
        siftUp(idx);
      }
    }
    function popMin() {
      const top = heapNodes[0];
      heapPos[top] = -1;
      heapSize--;
      if (heapSize > 0) {
        const last = heapNodes[heapSize];
        heapNodes[0] = last;
        heapPos[last] = 0;
        siftDown(0);
      }
      return top;
    }

    seenTag[startIdx] = tag;
    gScore[startIdx] = 0;
    fScore[startIdx] = Math.hypot(gcx - scx, gcz - scz);
    cameFrom[startIdx] = -1;
    heapNodes[0] = startIdx;
    heapPos[startIdx] = 0;
    heapSize = 1;

    let bestFallbackIdx = startIdx;
    let bestFallbackH = fScore[startIdx];
    let found = false;

    while (heapSize > 0) {
      const currIdx = popMin();
      if (currIdx === goalIdx) {
        found = true;
        break;
      }
      closedTag[currIdx] = tag;

      const cx = fromIndexX(currIdx);
      const cz = fromIndexZ(currIdx);
      const currG = gScore[currIdx];

      for (let d = 0; d < 8; d++) {
        const dir = DIRS_8[d];
        const nx = cx + dir.dx;
        const nz = cz + dir.dz;
        if (!canStepBetween(cx, cz, nx, nz, startIdx)) continue;
        const nIdx = toIndex(nx, nz);
        if (closedTag[nIdx] === tag) continue;

        // Slight step cost bonus for staying on flat paths
        const stepClimb = Math.abs(heights[nIdx] - heights[currIdx]) * 0.15;
        const tentativeG = currG + dir.cost + stepClimb;

        if (seenTag[nIdx] !== tag || tentativeG < gScore[nIdx]) {
          cameFrom[nIdx] = currIdx;
          gScore[nIdx] = tentativeG;
          const h = Math.hypot(gcx - nx, gcz - nz);
          fScore[nIdx] = tentativeG + h * 1.02;
          if (seenTag[nIdx] !== tag) {
            heapPos[nIdx] = -1;
            seenTag[nIdx] = tag;
          }
          pushOrDecrease(nIdx);
          if (h < bestFallbackH) {
            bestFallbackH = h;
            bestFallbackIdx = nIdx;
          }
        }
      }
    }

    const endIdx = found ? goalIdx : bestFallbackIdx;
    const rawCells = [];
    let trace = endIdx;
    let safety = 0;
    while (trace !== -1 && trace !== startIdx && safety < NAV_TOTAL) {
      rawCells.push({ x: fromIndexX(trace), z: fromIndexZ(trace) });
      trace = cameFrom[trace];
      safety++;
    }
    rawCells.reverse();

    if (rawCells.length === 0) {
      return [{ x: finalX, y: getSurfaceY(finalX, finalZ), z: finalZ }];
    }

    // Replace final cell center with smooth exact destination when goal was unblocked
    if (found && goal.exact) {
      rawCells[rawCells.length - 1] = { x: finalX, z: finalZ };
    }

    // String-pulling line-of-sight smoothing for natural diagonal movement
    const pts = [{ x: sx, z: sz }, ...rawCells];
    const smoothed = [];
    let anchor = 0;
    while (anchor < pts.length - 1) {
      let furthest = anchor + 1;
      const maxLookahead = Math.min(pts.length - 1, anchor + 18);
      for (let probe = maxLookahead; probe > anchor + 1; probe--) {
        if (hasClearLine(pts[anchor].x, pts[anchor].z, pts[probe].x, pts[probe].z, startIdx)) {
          furthest = probe;
          break;
        }
      }
      const wp = pts[furthest];
      smoothed.push({ x: wp.x, y: getSurfaceY(wp.x, wp.z), z: wp.z });
      anchor = furthest;
    }

    return smoothed;
  }

  return {
    isCellPassable,
    clearDynamicBlockers,
    setDynamicBlocked,
    clampToWalkable,
    findPath,
  };
}
