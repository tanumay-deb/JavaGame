/* The park grid: terrain, buildings, placement rules, power and path finding. */

const park = {
  ground: new Uint8Array(GRID_W * GRID_H),
  occ: new Int32Array(GRID_W * GRID_H).fill(-1),
  buildings: new Map(),
  nextId: 1,
  version: 0,          // bumps whenever the grid changes (invalidates caches)
  dirty: [],           // tiles whose ground needs redrawing (incremental bake)
  fullRebuild: true,   // set when the whole map changed (new game / load)
  gate: { x: 17, y: GRID_H - 2 },
  plots: new Uint8Array(PLOTS_X * PLOTS_Y),
  plotsBought: 0,

  idx(x, y) { return y * GRID_W + x; },
  touch(x, y) { this.dirty.push(x, y); this.version++; },
  inBounds(x, y) { return x >= 0 && y >= 0 && x < GRID_W && y < GRID_H; },
  groundAt(x, y) { return this.owns(x, y) ? this.ground[this.idx(x, y)] : GROUND.WATER; },

  /* ---------------------------------------------------------- land plots */
  plotIdx(px, py) { return py * PLOTS_X + px; },
  plotOf(x, y) { return { px: Math.floor(x / PLOT), py: Math.floor(y / PLOT) }; },
  ownsPlot(px, py) {
    return px >= 0 && py >= 0 && px < PLOTS_X && py < PLOTS_Y && !!this.plots[this.plotIdx(px, py)];
  },
  owns(x, y) {
    if (!this.inBounds(x, y)) return false;
    const p = this.plotOf(x, y);
    return this.ownsPlot(p.px, p.py);
  },
  /* a plot can be bought once it touches land you already own */
  plotForSale(px, py) {
    if (!this.inBounds(px * PLOT, py * PLOT) || this.ownsPlot(px, py)) return false;
    return this.ownsPlot(px - 1, py) || this.ownsPlot(px + 1, py)
        || this.ownsPlot(px, py - 1) || this.ownsPlot(px, py + 1);
  },
  plotPrice() { return PLOT_BASE + PLOT_STEP * Math.max(0, this.plotsBought - START_PLOTS); },
  buyPlot(px, py) {
    this.plots[this.plotIdx(px, py)] = 1;
    this.plotsBought++;
    for (let y = py * PLOT; y < (py + 1) * PLOT; y++)
      for (let x = px * PLOT; x < (px + 1) * PLOT; x++) this.ground[this.idx(x, y)] = GROUND.GRASS;
    this.version++;
    this.fullRebuild = true;
  },

  /* terrain for drawing: inside the park it is the grid, outside it is the
     procedural landscape the park sits in */
  terrainAt(x, y) {
    return this.owns(x, y) ? this.ground[this.idx(x, y)] : wildTerrain(x, y);
  },
  buildingAt(x, y) {
    if (!this.inBounds(x, y)) return null;
    const id = this.occ[this.idx(x, y)];
    return id < 0 ? null : this.buildings.get(id);
  },
  isPath(x, y) {
    if (!this.owns(x, y)) return false;
    const g = this.ground[this.idx(x, y)];
    return (g === GROUND.GRAVEL || g === GROUND.STONE) && this.occ[this.idx(x, y)] < 0;
  },

  reset() {
    this.ground.fill(GROUND.GRASS);
    this.occ.fill(-1);
    this.buildings.clear();
    this.nextId = 1;
    /* you start with a small clearing by the road and buy the valley later */
    this.plots.fill(0);
    this.plotsBought = 0;
    /* a three-by-three clearing around the gateway, wide enough to lay a
       proper avenue and put rides either side of it before buying more */
    const g = this.plotOf(this.gate.x, this.gate.y);
    for (let dy = -2; dy <= 0; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const px = g.px + dx, py = g.py + dy;
        if (px < 0 || py < 0 || px >= PLOTS_X || py >= PLOTS_Y) continue;
        if (this.plots[this.plotIdx(px, py)]) continue;
        this.plots[this.plotIdx(px, py)] = 1;
        this.plotsBought++;
      }
    }
    /* the entrance path runs from the gateway to the edge of the clearing */
    for (let y = this.gate.y - 3; y <= GRID_H - 1; y++)
      for (let x = this.gate.x - 1; x <= this.gate.x + 1; x++)
        if (this.inBounds(x, y)) this.ground[this.idx(x, y)] = GROUND.GRAVEL;
    /* a natural pond with a ragged shoreline, so the map is not a blank sheet */
    const px = 8, py = 10;
    for (let y = -5; y <= 5; y++) for (let x = -6; x <= 6; x++) {
      const tx = px + x, ty = py + y;
      if (!this.inBounds(tx, ty)) continue;
      const d = Math.hypot(x * 0.78, y * 1.15) + (fbm(tx * 0.3, ty * 0.3) - 0.5) * 2.6;
      if (d < 3.1) this.ground[this.idx(tx, ty)] = GROUND.WATER;
      else if (d < 4.2) this.ground[this.idx(tx, ty)] = GROUND.SAND;
    }
    this.version++;
    this.fullRebuild = true;
  },

  rotDims(item, rot) {
    const w = item.w || 1, h = item.h || 1;
    return (rot % 2) ? [h, w] : [w, h];
  },

  /* local footprint coords -> offsets inside the rotated footprint */
  rotPoint(lx, ly, w, h, rot) {
    switch (rot % 4) {
      case 1: return [h - 1 - ly, lx];
      case 2: return [w - 1 - lx, h - 1 - ly];
      case 3: return [ly, w - 1 - lx];
      default: return [lx, ly];
    }
  },

  canPlace(key, x, y, rot) {
    const item = ITEMS[key];
    if (!item) return { ok: false, why: 'unknown' };
    if (item.cat === 'path') {
      if (!this.inBounds(x, y)) return { ok: false, why: 'Outside the park' };
      if (!this.owns(x, y)) return { ok: false, why: 'You do not own this land yet' };
      if (this.buildingAt(x, y)) return { ok: false, why: 'Something is built here' };
      if (this.groundAt(x, y) === GROUND.WATER) return { ok: false, why: 'Cannot pave water' };
      if (this.groundAt(x, y) === item.ground) return { ok: false, why: 'Already paved' };
      return { ok: true };
    }
    const [w, h] = this.rotDims(item, rot);
    for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) {
      const tx = x + dx, ty = y + dy;
      if (!this.inBounds(tx, ty)) return { ok: false, why: 'Outside the park' };
      if (!this.owns(tx, ty)) return { ok: false, why: 'You do not own this land yet' };
      if (this.buildingAt(tx, ty)) return { ok: false, why: 'Something is built here' };
      const g = this.groundAt(tx, ty);
      if (g === GROUND.WATER) return { ok: false, why: 'Cannot build on water' };
      if (g === GROUND.GRAVEL || g === GROUND.STONE) return { ok: false, why: 'A path is in the way' };
    }
    return { ok: true };
  },

  place(key, x, y, rot) {
    const item = ITEMS[key];
    if (item.cat === 'path') {
      this.ground[this.idx(x, y)] = item.ground;
      this.touch(x, y);
      return null;
    }
    const [w, h] = this.rotDims(item, rot);
    const b = {
      id: this.nextId++, key, item, x, y, rot, w, h,
      open: true, powered: !item.power, condition: 100, worker: null,
      queue: [], riders: [], timer: 0, cycle: 0,
      fee: item.fee !== undefined ? item.fee : (item.price || 0),
      earned: 0, visits: 0, brokeDown: false, since: 0
    };
    if (item.cat === 'ride') {
      const e = this.rotPoint(item.ent[0], item.ent[1], item.w, item.h, rot);
      const x2 = this.rotPoint(item.ext[0], item.ext[1], item.w, item.h, rot);
      b.ent = { x: x + e[0], y: y + e[1] };
      b.ext = { x: x + x2[0], y: y + x2[1] };
    } else {
      b.ent = { x, y };
      b.ext = { x, y };
    }
    for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) this.occ[this.idx(x + dx, y + dy)] = b.id;
    this.buildings.set(b.id, b);
    this.version++;
    this.recomputePower();
    return b;
  },

  demolish(b) {
    if (!b) return;
    for (let dy = 0; dy < b.h; dy++) for (let dx = 0; dx < b.w; dx++) {
      const i = this.idx(b.x + dx, b.y + dy);
      if (this.occ[i] === b.id) this.occ[i] = -1;
    }
    this.buildings.delete(b.id);
    this.version++;
    this.recomputePower();
  },

  clearPath(x, y) {
    const g = this.groundAt(x, y);
    if (g === GROUND.GRAVEL || g === GROUND.STONE) {
      this.ground[this.idx(x, y)] = GROUND.GRASS;
      this.touch(x, y);
      return true;
    }
    return false;
  },

  /* ------------------------------------------------------------- power */
  recomputePower() {
    const engines = [];
    for (const b of this.buildings.values()) if (b.item.cat === 'engine') engines.push(b);
    for (const b of this.buildings.values()) {
      if (!b.item.power) { b.powered = true; continue; }
      b.powered = engines.some(e => {
        if (!e.worker) return false;
        const r = e.item.radius;
        for (let dy = 0; dy < b.h; dy++) for (let dx = 0; dx < b.w; dx++) {
          const cx = b.x + dx, cy = b.y + dy;
          const ex = clamp(cx, e.x, e.x + e.w - 1), ey = clamp(cy, e.y, e.y + e.h - 1);
          if (Math.max(Math.abs(cx - ex), Math.abs(cy - ey)) <= r) return true;
        }
        return false;
      });
    }
  },

  /* tiles a visitor can stand on to use `t` (a building's entrance tile) */
  accessTiles(t) {
    const out = [];
    for (const d of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const x = t.x + d[0], y = t.y + d[1];
      if (this.isPath(x, y)) out.push({ x, y });
    }
    return out;
  },

  reachable(b) { return this.accessTiles(b.ent).length > 0 && this.accessTiles(b.ext).length > 0; },

  /* Where the queue for a ride forms: from the tile outside its entrance,
     running back along whichever path leads furthest away from the ride. */
  queueLine(b) {
    if (b._qv === this.version && b._q !== undefined) return b._q;
    b._qv = this.version;
    b._q = null;
    const start = this.accessTiles(b.ent)[0];
    if (start) {
      let best = null;
      for (const d of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        /* never run the queue back through the ride itself */
        const nx = start.x + d[0], ny = start.y + d[1];
        if (nx >= b.x && nx < b.x + b.w && ny >= b.y && ny < b.y + b.h) continue;
        let n = 0;
        while (n < 9 && this.isPath(start.x + d[0] * (n + 1), start.y + d[1] * (n + 1))) n++;
        if (!best || n > best.len) best = { dx: d[0], dy: d[1], len: n };
      }
      if (best) b._q = { x: start.x, y: start.y, dx: best.dx, dy: best.dy, len: best.len };
    }
    return b._q;
  },

  /* the spot the i-th person in the queue should stand */
  queueSlot(b, i) {
    const l = this.queueLine(b);
    if (!l) return null;
    const t = Math.min(i * 0.52, l.len + 0.4);
    return { x: l.x + l.dx * t, y: l.y + l.dy * t };
  },

  /* The shortest run of paving that would join `door` to the existing path
     network, ignoring the footprint the building is about to occupy.
     [] means it is already connected, null means there is no way through. */
  linkPathFrom(door, bx, by, w, h) {
    const inFoot = (x, y) => x >= bx && y >= by && x < bx + w && y < by + h;
    const free = (x, y) => this.inBounds(x, y) && this.owns(x, y) && !inFoot(x, y)
      && !this.buildingAt(x, y) && this.ground[this.idx(x, y)] !== GROUND.WATER;
    const paved = (x, y) => free(x, y) &&
      (this.ground[this.idx(x, y)] === GROUND.GRAVEL || this.ground[this.idx(x, y)] === GROUND.STONE);
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    const prev = new Map();
    const q = [];
    for (const d of dirs) {
      const x = door.x + d[0], y = door.y + d[1];
      if (!free(x, y)) continue;
      if (paved(x, y)) return [];
      const k = x + ',' + y;
      if (prev.has(k)) continue;
      prev.set(k, null);
      q.push([x, y]);
    }
    let head = 0;
    while (head < q.length && head < 900) {
      const [cx, cy] = q[head++];
      for (const d of dirs) {
        const x = cx + d[0], y = cy + d[1], k = x + ',' + y;
        if (prev.has(k) || !free(x, y)) continue;
        prev.set(k, [cx, cy]);
        if (paved(x, y)) {
          const out = [];
          let cur = [cx, cy];
          while (cur) { out.push({ x: cur[0], y: cur[1] }); cur = prev.get(cur[0] + ',' + cur[1]); }
          return out.reverse();
        }
        q.push([x, y]);
      }
    }
    return null;
  },

  /* closest walkable tile to a point — a safety net so riders are never
     set down inside a building with no way out */
  nearestPath(x, y) {
    for (let r = 1; r < 12; r++) {
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        if (this.isPath(x + dx, y + dy)) return { x: x + dx, y: y + dy };
      }
    }
    return null;
  },

  /* BFS across path tiles. `goals` is a Set of "x,y" keys. Returns tile array. */
  findPath(sx, sy, goals) {
    if (!goals || goals.size === 0) return null;
    if (goals.has(sx + ',' + sy)) return [{ x: sx, y: sy }];
    const start = this.idx(sx, sy);
    const prev = new Int32Array(GRID_W * GRID_H).fill(-2);
    const q = [start];
    prev[start] = -1;
    let head = 0;
    while (head < q.length) {
      const cur = q[head++];
      const cx = cur % GRID_W, cy = (cur / GRID_W) | 0;
      for (const d of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = cx + d[0], ny = cy + d[1];
        if (!this.inBounds(nx, ny)) continue;
        const ni = this.idx(nx, ny);
        if (prev[ni] !== -2 || !this.isPath(nx, ny)) continue;
        prev[ni] = cur;
        if (goals.has(nx + ',' + ny)) {
          const out = [];
          let n = ni;
          while (n !== -1) { out.push({ x: n % GRID_W, y: (n / GRID_W) | 0 }); n = prev[n]; }
          out.reverse();
          return out;
        }
        q.push(ni);
      }
    }
    return null;
  },

  /* scenery quality around a tile: decor nearby makes visitors happier */
  beautyAt(x, y) {
    let s = 0;
    for (const b of this.buildings.values()) {
      if (!b.item.beauty) continue;
      const dx = Math.abs(b.x - x), dy = Math.abs(b.y - y);
      if (dx < 5 && dy < 5) s += b.item.beauty * (1 - Math.max(dx, dy) / 5);
    }
    return Math.min(20, s);
  },

  /* Signposts, cached until something is built or knocked down. A visitor who
     can see one sets off for what they need sooner, because they know where
     it is — which is the whole point of a signpost, and until now the flag on
     the item was read by nothing at all. */
  signTiles() {
    if (this._signVer === this.version && this._signs) return this._signs;
    const out = [];
    for (const b of this.buildings.values())
      if (b.item.sign) out.push({ x: b.x + b.w / 2, y: b.y + b.h / 2 });
    this._signs = out; this._signVer = this.version;
    return out;
  },
  signNear(x, y) {
    const signs = this.signTiles();
    for (const sgn of signs) if (Math.abs(sgn.x - x) <= SIGN_RANGE && Math.abs(sgn.y - y) <= SIGN_RANGE) return true;
    return false;
  },

  /* how pleasant the ground here is to stand on, straight off the path item.
     Looked up from a table built once, not by scanning the catalogue for every
     visitor on every frame. */
  comfortAt(x, y) { return GROUND_COMFORT[this.groundAt(x, y)] || 0; },

  countOf(pred) {
    let n = 0;
    for (const b of this.buildings.values()) if (pred(b)) n++;
    return n;
  },

  list(cat) {
    const out = [];
    for (const b of this.buildings.values()) if (b.item.cat === cat) out.push(b);
    return out;
  },

  pathTiles() {
    let n = 0;
    for (let y = 0; y < GRID_H; y++) for (let x = 0; x < GRID_W; x++) if (this.isPath(x, y)) n++;
    return n;
  },

  /* park rating drives how many visitors turn up (see help text of the original:
     size, variety and number of rides, comfort and average happiness) */
  rating(avgHappy) {
    const rides = this.list('ride').filter(b => b.open && b.powered && !b.brokeDown && this.reachable(b));
    const variety = new Set(rides.map(b => b.key)).size;
    const quality = rides.reduce((s, b) => s + b.item.rating, 0);
    const comfort = this.countOf(b => b.item.rest) * 1.5
      + this.countOf(b => b.key === 'toilet') * 4
      + this.countOf(b => b.item.cat === 'stall') * 2
      + this.countOf(b => b.item.beauty) * 0.6;
    const size = Math.min(30, this.pathTiles() * 0.25);
    return clamp(quality * 1.6 + variety * 4 + comfort + size + (avgHappy - 50) * 0.35, 0, 999);
  }
};
