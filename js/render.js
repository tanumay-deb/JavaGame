/* Isometric renderer: cached ground layer, depth-sorted entities, animated
   ride parts, particle effects and a day/night lighting pass. */

const view = { x: 0, y: 0, zoom: 1, minZoom: 0.45, maxZoom: 1.9 };

/* The sun is behind the camera to the north-west: shadows lean away from it,
   forward and to the right, flattened onto the ground. */
const SUN = { lx: 0.54, ly: 0.30, alpha: 0.26 };
const SWAYS = { conifer: 0.010, broadleaf: 0.016, palm: 0.020, fernclump: 0.024, reeds: 0.030, bush: 0.014 };

const renderer = {
  canvas: null, ctx: null, W: 0, H: 0, dpr: 1,
  rich: true,        /* the finishing passes are on while the frame has room */
  groundCanvas: null, groundVersion: -1,
  /* The baked ground covers the land you own plus a ring of wild country, and
     grows with the park instead of always covering the whole valley. */
  RING: 8,
  rect: { x0: 0, y0: 0, x1: GRID_W, y1: GRID_H },
  gox: 0, goy: 0,
  waterTiles: [],
  waterShore: [],
  fadeIn: 400, fadeOut: 900,
  fadeCx: 0, fadeCy: 0,
  hover: { x: -1, y: -1 },
  time: 0,

  init(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.resize();
    /* a phone gets a closer view, so people and rides stay legible and tappable */
    view.maxZoom = this.W < 900 ? 2.4 : 2.0;
    view.zoom = this.W < 520 ? 1.3 : this.W < 900 ? 1.15 : 1;
    this.clampView();
    view.zoom = Math.max(view.zoom, view.minZoom);
    this.centerOn(park.gate.x, park.gate.y - 4);
  },

  resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const r = this.canvas.getBoundingClientRect();
    this.dpr = dpr;
    this.W = r.width; this.H = r.height;
    this.canvas.width = Math.round(r.width * dpr);
    this.canvas.height = Math.round(r.height * dpr);
  },

  centerOn(tx, ty) { view.x = isoX(tx, ty); view.y = isoY(tx, ty); this.clampView(); },

  clampView() {
    const b = this.camBounds();
    const bw = b.maxX - b.minX, bh = b.maxY - b.minY;
    /* you cannot zoom out past the point where the park fills the screen */
    view.minZoom = clamp(Math.max(this.W / bw, this.H / bh), 0.4, 1.7);
    view.zoom = clamp(view.zoom, view.minZoom, view.maxZoom);
    const hw = this.W / 2 / view.zoom, hh = this.H / 2 / view.zoom;
    view.x = bw <= hw * 2 ? (b.minX + b.maxX) / 2 : clamp(view.x, b.minX + hw, b.maxX - hw);
    view.y = bh <= hh * 2 ? (b.minY + b.maxY) / 2 : clamp(view.y, b.minY + hh, b.maxY - hh);
  },

  screenToTile(sx, sy) {
    const wx = (sx - this.W / 2) / view.zoom + view.x;
    const wy = (sy - this.H / 2) / view.zoom + view.y;
    const t = unIso(wx, wy);
    return { x: Math.floor(t.x), y: Math.floor(t.y), fx: t.x, fy: t.y };
  },

  worldToScreen(wx, wy) {
    return [(wx - view.x) * view.zoom + this.W / 2, (wy - view.y) * view.zoom + this.H / 2];
  },

  /* --------------------------------------------------------- ground bake */
  /* how much the distance-fade darkens a tile (baked, so it is free at runtime) */
  /* the land is drawn solid to its edge; the camera simply cannot travel far
     enough to put that edge on screen */
  tileFade() { return 0; },

  /* the two world-space corners of one edge of a tile, pulled `inset` of the
     way toward the tile centre (0 = on the edge, 0.5 = at the middle) */
  tileEdge(x, y, dx, dy, inset) {
    const c = (tx, ty) => [isoX(tx, ty), isoY(tx, ty)];
    let a, b;
    if (dx === 1) { a = c(x + 1, y); b = c(x + 1, y + 1); }
    else if (dx === -1) { a = c(x, y); b = c(x, y + 1); }
    else if (dy === 1) { a = c(x, y + 1); b = c(x + 1, y + 1); }
    else { a = c(x, y); b = c(x + 1, y); }
    const mid = [isoX(x + 0.5, y + 0.5), isoY(x + 0.5, y + 0.5)];
    const pull = (p) => [lerp(p[0], mid[0], inset), lerp(p[1], mid[1], inset)];
    return [pull(a), pull(b)];
  },

  /* a stroke along part of a tile edge — used for kerbs and road markings */
  edgeStroke(ctx, x, y, dx, dy, inset, from, to, width, color, round) {
    const [a, b] = this.tileEdge(x, y, dx, dy, inset);
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = round ? 'round' : 'butt';
    ctx.beginPath();
    ctx.moveTo(lerp(a[0], b[0], from), lerp(a[1], b[1], from));
    ctx.lineTo(lerp(a[0], b[0], to), lerp(a[1], b[1], to));
    ctx.stroke();
  },

  drawTile(ctx, x, y) {
    const g = park.terrainAt(x, y);
    const cx = isoX(x + 0.5, y + 0.5), cy = isoY(x + 0.5, y + 0.5);
    const n = hash2(x, y);
    let col, roll = 0;
    if (g === GROUND.GRASS) {
      /* Two continuous noise fields rather than a random colour per tile: the
         green then drifts across the map instead of showing the seam of every
         diamond. Bleached meadow over the rises, deeper green in the hollows. */
      /* fbm clusters hard around the middle, so stretch it out or none of the
         meadow ever reads as dry or as shaded */
      const raw = fbm(x * 0.085 + 17, y * 0.085 + 29) * 0.62 + fbm(x * 0.21 + 5, y * 0.21 + 41) * 0.38;
      roll = clamp((raw - 0.5) * 3.4 + 0.5, 0, 1);
      const fine = fbm(x * 0.36 + 3, y * 0.36 + 11);
      let base = mixColor(PALETTE.grass[1], PALETTE.grassAlt[3], fine);
      base = roll > 0.52
        ? mixColor(base, PALETTE.grassDry, Math.min(1, (roll - 0.52) * 1.9))
        : mixColor(base, PALETTE.grassDeep, Math.min(1, (0.52 - roll) * 1.7));
      /* Mown in squares, the way a groundsman runs a roller up and back: the
         chequer is what you read first, the noise underneath keeps it from
         looking like graph paper. */
      col = mixColor(base, (x + y) % 2 === 0 ? PALETTE.grassPale : PALETTE.grassRich, 0.55);
    } else if (g === GROUND.SAND) col = mixColor(PALETTE.sand, '#c2ad78', n);
    else if (g === GROUND.WATER) col = mixColor(PALETTE.water, '#286c9b', n);
    else col = g === GROUND.STONE ? PALETTE.stone : PALETTE.gravel;

    diamond(ctx, cx, cy, TILE_W, TILE_H);
    ctx.fillStyle = col;
    ctx.fill();
    /* Stroking the same diamond in the same colour covers the half-pixel the
       fill antialiases away, which otherwise shows as a grid of pale seams.
       Paving and tarmac already overlap their neighbours, so they skip it. */
    if (g === GROUND.GRASS || g === GROUND.WATER || g === GROUND.SAND) {
      ctx.strokeStyle = col; ctx.lineWidth = 1; ctx.stroke();
    }

    if (g === GROUND.GRASS) {
      const m = hash2(y * 3 + 1, x * 5 + 2);
      /* tufts: more of them where the ground is damp, all leaning downwind */
      const tufts = roll < 0.44 ? 3 : roll < 0.62 ? 2 : 1;
      ctx.lineWidth = 1.4;
      for (let i = 0; i < tufts; i++) {
        const h1 = hash2(x * 13 + i * 7, y * 19 + i * 3);
        const h2 = hash2(x * 23 + i * 5, y * 11 + i * 9);
        if (h1 < 0.3) continue;
        const gx = cx + (h1 - 0.5) * 40, gy = cy + (h2 - 0.5) * 18;
        const lean = 1.1 + h2 * 1.4;
        ctx.strokeStyle = shade(col, 0.26);
        ctx.beginPath();
        ctx.moveTo(gx, gy); ctx.lineTo(gx - 2.5 + lean, gy - 5);
        ctx.moveTo(gx, gy); ctx.lineTo(gx + 0.6 + lean, gy - 6.4);
        ctx.stroke();
        ctx.strokeStyle = shade(col, -0.26);
        ctx.beginPath();
        ctx.moveTo(gx + 1, gy); ctx.lineTo(gx + 3.4 + lean, gy - 3.6);
        ctx.stroke();
      }
      /* trodden earth where the grass meets a path */
      for (const d of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const ng = park.terrainAt(x + d[0], y + d[1]);
        if (ng !== GROUND.GRAVEL && ng !== GROUND.STONE) continue;
        ctx.save();
        diamond(ctx, cx, cy, TILE_W, TILE_H); ctx.clip();
        ctx.fillStyle = 'rgba(150,126,84,.30)';
        const ex = cx + (d[0] - d[1]) * TILE_W * 0.42, ey = cy + (d[0] + d[1]) * TILE_H * 0.42;
        diamond(ctx, ex, ey, TILE_W * 1.06, TILE_H * 1.06);
        ctx.fill();
        ctx.restore();
      }

      /* dry ground showing through where the meadow is most bleached */
      if (roll > 0.72) {
        ctx.save();
        diamond(ctx, cx, cy, TILE_W, TILE_H); ctx.clip();
        ctx.fillStyle = 'rgba(164,148,96,' + Math.min(0.34, (roll - 0.72) * 1.5).toFixed(3) + ')';
        for (let i = 0; i < 3; i++) {
          const h1 = hash2(x * 29 + i, y * 37 + i), h2 = hash2(x * 41 + i, y * 17 + i);
          ctx.beginPath();
          ctx.ellipse(cx + (h1 - 0.5) * 44, cy + (h2 - 0.5) * 20, 7 + h1 * 8, 3.5 + h2 * 3, 0, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }

      /* painted undergrowth — flat, so buildings can still go on top */
      const patch = fbm(x * 0.21 + 17, y * 0.21 + 23);
      if (patch > 0.5) {
        const a = (patch - 0.5) / 0.5;
        ctx.save();
        diamond(ctx, cx, cy, TILE_W, TILE_H); ctx.clip();
        ctx.fillStyle = shade(col, -0.16);
        ctx.globalAlpha = 0.5 + a * 0.4;
        for (let i = 0; i < 4; i++) {
          const h1 = hash2(x * 5 + i, y * 9 + i), h2 = hash2(x * 11 + i, y * 3 + i);
          ctx.beginPath();
          ctx.ellipse(cx + (h1 - 0.5) * 40, cy + (h2 - 0.5) * 18, 6 + h1 * 6, 3 + h2 * 3, 0, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }
      if (m > 0.972) {
        const sx2 = cx + (n - 0.5) * 20, sy2 = cy + (m - 0.5) * 8;
        if (n > 0.5) {
          /* a weathered stone, half sunk in the turf rather than sitting on it */
          ctx.fillStyle = mixColor('#8d9298', col, 0.3);
          ctx.beginPath(); ctx.ellipse(sx2, sy2, 2.4, 1.5, 0, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = 'rgba(255,255,255,.16)';
          ctx.beginPath(); ctx.ellipse(sx2 - .5, sy2 - .6, 1.1, .7, 0, 0, Math.PI * 2); ctx.fill();
        } else {
          ctx.fillStyle = n > 0.3 ? '#e8d24a' : '#e8556d';
          for (let f = 0; f < 3; f++) {
            ctx.beginPath();
            ctx.arc(sx2 + (f - 1) * 3.5, sy2 - (f === 1 ? 2 : 0), 1.7, 0, Math.PI * 2); ctx.fill();
          }
        }
      }
    } else if (g === GROUND.GRAVEL || g === GROUND.STONE) {
      ctx.fillStyle = 'rgba(0,0,0,.10)';
      for (let i = 0; i < 5; i++) {
        const a = hash2(x * 7 + i, y * 13 + i), b2 = hash2(x * 3 + i, y * 5 + i);
        ctx.beginPath();
        ctx.ellipse(cx + (a - 0.5) * 34, cy + (b2 - 0.5) * 17, 1.6, 1, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      if (g === GROUND.STONE) {
        ctx.strokeStyle = 'rgba(255,255,255,.18)'; ctx.lineWidth = 1;
        diamond(ctx, cx, cy, TILE_W - 8, TILE_H - 4); ctx.stroke();
      }
      /* soften the join where paving meets grass */
      for (const d of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const ng = park.terrainAt(x + d[0], y + d[1]);
        if (ng === GROUND.GRAVEL || ng === GROUND.STONE) continue;
        ctx.save();
        ctx.beginPath();
        diamond(ctx, cx, cy, TILE_W, TILE_H); ctx.clip();
        ctx.fillStyle = 'rgba(70,55,30,.22)';
        const ex = cx + d[0] * TILE_W * 0.32 - d[1] * TILE_W * 0.32;
        const ey = cy + d[0] * TILE_H * 0.32 + d[1] * TILE_H * 0.32;
        diamond(ctx, ex, ey, TILE_W, TILE_H);
        ctx.fill();
        ctx.restore();
      }
    } else if (g === GROUND.ROAD) {
      const isRoad = (tx, ty) => park.terrainAt(tx, ty) === GROUND.ROAD;
      const n = isRoad(x, y - 1), so = isRoad(x, y + 1), e = isRoad(x + 1, y), w = isRoad(x - 1, y);

      /* tarmac — drawn a shade oversized so no seam shows between tiles */
      ctx.fillStyle = '#3b3e44';
      diamond(ctx, cx, cy, TILE_W + 1.5, TILE_H + 1); ctx.fill();
      ctx.save();
      diamond(ctx, cx, cy, TILE_W, TILE_H); ctx.clip();
      /* aggregate: a little light and dark grit so it is not flat black */
      for (let i = 0; i < 14; i++) {
        const a = hash2(x * 17 + i, y * 23 + i), b2 = hash2(x * 11 + i, y * 7 + i);
        ctx.fillStyle = i % 3 ? 'rgba(255,255,255,.055)' : 'rgba(0,0,0,.22)';
        ctx.beginPath();
        ctx.ellipse(cx + (a - 0.5) * 56, cy + (b2 - 0.5) * 26, 1.5, 0.9, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      /* faint worn wheel tracks along the direction of travel */
      ctx.globalAlpha = 0.5;
      const along = (e || w) ? 1 : 0;
      for (const off of [-0.22, 0.22]) {
        ctx.strokeStyle = 'rgba(180,182,188,.13)';
        ctx.lineWidth = 7;
        ctx.beginPath();
        if (along) {
          ctx.moveTo(isoX(x, y + 0.5 + off), isoY(x, y + 0.5 + off));
          ctx.lineTo(isoX(x + 1, y + 0.5 + off), isoY(x + 1, y + 0.5 + off));
        } else {
          ctx.moveTo(isoX(x + 0.5 + off, y), isoY(x + 0.5 + off, y));
          ctx.lineTo(isoX(x + 0.5 + off, y + 1), isoY(x + 0.5 + off, y + 1));
        }
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      ctx.restore();

      /* kerb and a strip of worn verge wherever the tarmac meets open ground */
      for (const [dx, dy, has] of [[0, -1, n], [0, 1, so], [1, 0, e], [-1, 0, w]]) {
        if (has) continue;
        this.edgeStroke(ctx, x, y, dx, dy, 0.03, 0, 1, 5, '#8e9299');
        this.edgeStroke(ctx, x, y, dx, dy, 0.10, 0, 1, 2, 'rgba(0,0,0,.28)');
        this.edgeStroke(ctx, x, y, dx, dy, 0.17, 0.05, 0.95, 2.2, 'rgba(236,236,230,.75)');
      }

      /* centre line: dashes down the middle of a two-lane carriageway */
      const twoLane = (e || w) && (n !== so);
      if (twoLane) {
        const dir = so ? 1 : -1;                    /* the lane divider side */
        this.edgeStroke(ctx, x, y, 0, dir, 0.015, 0.18, 0.72, 2.6, 'rgba(240,236,214,.85)', true);
      }
      /* the apron in front of the gateway gets a crossing instead */
      if ((n || so) && !e && !w) {
        ctx.save();
        diamond(ctx, cx, cy, TILE_W, TILE_H); ctx.clip();
        ctx.strokeStyle = 'rgba(238,238,230,.7)';
        ctx.lineWidth = 5;
        for (let i = 0; i < 4; i++) {
          const f = 0.18 + i * 0.22;
          ctx.beginPath();
          ctx.moveTo(isoX(x + f, y), isoY(x + f, y));
          ctx.lineTo(isoX(x + f, y + 1), isoY(x + f, y + 1));
          ctx.stroke();
        }
        ctx.restore();
      }
    } else if (g === GROUND.WATER) {
      /* deeper where the tile is surrounded by water, shallow near the bank */
      let open = 0;
      const sides = [[1, 0], [-1, 0], [0, 1], [0, -1]];
      for (const d of sides) if (park.terrainAt(x + d[0], y + d[1]) === GROUND.WATER) open++;
      ctx.fillStyle = mixColor('#3f92c4', '#1d5e8c', open / 4);
      diamond(ctx, cx, cy, TILE_W, TILE_H); ctx.fill();
      /* a pale shallow band on each side that meets land, which hides the
         staircase edge tiles make on a diagonal shore */
      ctx.save();
      diamond(ctx, cx, cy, TILE_W, TILE_H); ctx.clip();
      for (const d of sides) {
        if (park.terrainAt(x + d[0], y + d[1]) === GROUND.WATER) continue;
        const ex = cx + (d[0] - d[1]) * TILE_W * 0.3, ey = cy + (d[0] + d[1]) * TILE_H * 0.3;
        ctx.fillStyle = 'rgba(146,203,226,.55)';
        diamond(ctx, ex, ey, TILE_W * 0.98, TILE_H * 0.98); ctx.fill();
        ctx.fillStyle = 'rgba(226,214,176,.5)';
        const fx = cx + (d[0] - d[1]) * TILE_W * 0.44, fy = cy + (d[0] + d[1]) * TILE_H * 0.44;
        diamond(ctx, fx, fy, TILE_W * 0.9, TILE_H * 0.9); ctx.fill();
      }
      ctx.restore();
    } else if (g === GROUND.SAND) {
      /* damp sand where the beach meets the water */
      for (const d of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        if (park.terrainAt(x + d[0], y + d[1]) !== GROUND.WATER) continue;
        ctx.save();
        diamond(ctx, cx, cy, TILE_W, TILE_H); ctx.clip();
        ctx.fillStyle = 'rgba(150,128,86,.42)';
        const ex = cx + (d[0] - d[1]) * TILE_W * 0.34, ey = cy + (d[0] + d[1]) * TILE_H * 0.34;
        diamond(ctx, ex, ey, TILE_W, TILE_H); ctx.fill();
        ctx.restore();
      }
    }

    const fade = this.tileFade(x, y);
    if (fade > 0.004) {
      ctx.fillStyle = 'rgba(12,22,8,' + fade.toFixed(3) + ')';
      diamond(ctx, cx, cy, TILE_W, TILE_H); ctx.fill();
    }
  },

  groundCtx() {
    const r = this.rect;
    const w = ((r.x1 - r.x0) + (r.y1 - r.y0)) * (TILE_W / 2);
    const h = ((r.x1 - r.x0) + (r.y1 - r.y0)) * (TILE_H / 2) + 8;
    if (!this.groundCanvas || this.groundCanvas.width !== Math.ceil(w) || this.groundCanvas.height !== Math.ceil(h))
      this.groundCanvas = makeCanvas(w, h);
    return this.groundCanvas.getContext('2d');
  },

  buildGround() {
    const r = this.computeRect();
    const ctx = this.groundCtx();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.groundCanvas.width, this.groundCanvas.height);
    ctx.setTransform(1, 0, 0, 1, this.gox, this.goy);
    this.waterTiles.length = 0;
    this.waterShore.length = 0;
    /* The sheet is the bounding box of a diamond, so its four corners would be
       left empty and the camera could find sky in them. Walk a wider range of
       tiles and keep whatever lands on the sheet, so open country reaches into
       every corner. */
    const gw = this.groundCanvas.width, gh = this.groundCanvas.height;
    const ex = Math.ceil((r.y1 - r.y0) / 2) + 2, ey = Math.ceil((r.x1 - r.x0) / 2) + 2;
    for (let y = r.y0 - ey; y < r.y1 + ey; y++)
      for (let x = r.x0 - ex; x < r.x1 + ex; x++) {
        const px = isoX(x + 0.5, y + 0.5) + this.gox, py = isoY(x + 0.5, y + 0.5) + this.goy;
        if (px < -TILE_W || px > gw + TILE_W || py < -TILE_H || py > gh + TILE_H) continue;
        this.drawTile(ctx, x, y);
        if (park.terrainAt(x, y) !== GROUND.WATER) continue;
        this.waterTiles.push(x, y);
        for (const d of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          if (park.terrainAt(x + d[0], y + d[1]) === GROUND.WATER) continue;
          this.waterShore.push(x, y, d[0], d[1]);
        }
      }
    this.bakePropShadows(ctx);
    /* a soft shaft of sunlight from the north-west, so big flat areas of grass
       are not one dead colour */
    ctx.save();
    ctx.globalCompositeOperation = 'source-atop';
    const sun = ctx.createLinearGradient(
      this.fadeCx - this.fadeOut, this.fadeCy - this.fadeOut * 0.6,
      this.fadeCx + this.fadeOut, this.fadeCy + this.fadeOut * 0.6);
    sun.addColorStop(0, 'rgba(255,246,214,.16)');
    sun.addColorStop(0.5, 'rgba(255,246,214,.03)');
    sun.addColorStop(1, 'rgba(20,40,20,.10)');
    ctx.fillStyle = sun;
    ctx.fillRect(-this.gox, -this.goy, this.groundCanvas.width, this.groundCanvas.height);
    ctx.restore();

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    park.dirty.length = 0;
    park.fullRebuild = false;
    this.groundVersion = park.version;
  },

  edgeAlpha() { return 1; },

  /* how far the camera may roam: the land you own plus a little of the country
     around it, and always the road at the bottom */
  camBounds() {
    let x0 = GRID_W, y0 = GRID_H, x1 = 0, y1 = 0, any = false;
    for (let py = 0; py < PLOTS_Y; py++) for (let px = 0; px < PLOTS_X; px++) {
      if (!park.ownsPlot(px, py)) continue;
      any = true;
      x0 = Math.min(x0, px * PLOT); y0 = Math.min(y0, py * PLOT);
      x1 = Math.max(x1, (px + 1) * PLOT); y1 = Math.max(y1, (py + 1) * PLOT);
    }
    if (!any) { x0 = park.gate.x - PLOT; y0 = park.gate.y - PLOT; x1 = park.gate.x + PLOT; y1 = GRID_H; }
    const pad = 3;
    x0 -= pad; y0 -= pad; x1 += pad;
    y1 = Math.max(y1 + pad, ROAD_Y + 2.5);
    return {
      minX: isoX(x0, y1), maxX: isoX(x1, y0),
      minY: isoY(x0, y0), maxY: isoY(x1, y1)
    };
  },

  /* the tile rectangle worth drawing: owned land plus a ring of wild country */
  computeRect() {
    let x0 = GRID_W, y0 = GRID_H, x1 = 0, y1 = 0, any = false;
    for (let py = 0; py < PLOTS_Y; py++) for (let px = 0; px < PLOTS_X; px++) {
      if (!park.ownsPlot(px, py)) continue;
      any = true;
      x0 = Math.min(x0, px * PLOT); y0 = Math.min(y0, py * PLOT);
      x1 = Math.max(x1, (px + 1) * PLOT); y1 = Math.max(y1, (py + 1) * PLOT);
    }
    if (!any) { x0 = park.gate.x - PLOT; y0 = park.gate.y - PLOT; x1 = park.gate.x + PLOT; y1 = GRID_H; }
    /* always keep the road and its verge in view below the park */
    const r = this.RING;
    const rect = {
      x0: Math.max(-MARGIN, x0 - r), y0: Math.max(-MARGIN, y0 - r),
      x1: Math.min(GRID_W + MARGIN, x1 + r), y1: Math.min(GRID_H + MARGIN, Math.max(y1 + r, ROAD_Y + 3))
    };
    this.rect = rect;
    this.gox = (rect.y1 - rect.x0) * (TILE_W / 2);
    this.goy = -(rect.x0 + rect.y0) * (TILE_H / 2);
    /* fade from the middle of the land you own out into the ring */
    this.fadeCx = isoX((x0 + x1) / 2, (y0 + y1) / 2);
    this.fadeCy = isoY((x0 + x1) / 2, (y0 + y1) / 2);
    /* the baked area is a diamond; fade out before its nearest edge so the land
       never ends on a hard line */
    const unit = Math.hypot(TILE_W / 2, 1.45 * TILE_H / 2);
    const rw = rect.x1 - rect.x0, rh = rect.y1 - rect.y0;
    this.fadeOut = (Math.min(rw, rh) / 2) * unit * 0.97;
    this.fadeIn = Math.max(TILE_W * 1.5, this.fadeOut - r * 0.85 * unit);
    return rect;
  },

  /* Scenery never moves, so its shadows go into the baked ground instead of
     being projected every frame. */
  bakePropShadows(ctx, near) {
    if (!scenery.built) return;
    const r = this.rect;
    ctx.save();
    ctx.globalAlpha = SUN.alpha;
    for (const p of scenery.props) {
      if (p.art === 'volcano') continue;
      if (p.x < r.x0 - 2 || p.x > r.x1 + 2 || p.y < r.y0 - 2 || p.y > r.y1 + 2) continue;
      if (near && Math.abs(p.x - near.x) + Math.abs(p.y - near.y) > 4) continue;
      const spr = p.spr || (p.spr = getSprite(p.art, 1, 1, 0));
      const sil = spriteSilhouette(spr, '#0b1408');
      const sc = p.s || 1;
      const gy = p.wy;
      ctx.save();
      ctx.transform(1, 0, -SUN.lx, -SUN.ly, SUN.lx * gy, gy * (1 + SUN.ly));
      ctx.drawImage(sil, p.wx - spr.ox * sc, p.wy - spr.oy * sc, sil.width * sc, sil.height * sc);
      ctx.restore();
    }
    ctx.restore();
  },

  /* repaint only the tiles that changed (plus their neighbours, whose edge
     shading depends on them) — keeps path painting smooth on a phone */
  patchGround() {
    const ctx = this.groundCtx();
    const done = new Set();
    const blocks = [];
    for (let i = 0; i < park.dirty.length; i += 2) {
      const bx = park.dirty[i], by = park.dirty[i + 1];
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const x = bx + dx, y = by + dy;
        if (!park.inBounds(x, y)) continue;
        const k = y * GRID_W + x;
        if (done.has(k)) continue;
        done.add(k);
        blocks.push([x, y]);
      }
    }
    park.dirty.length = 0;
    ctx.setTransform(1, 0, 0, 1, this.gox, this.goy);
    /* clear each tile's diamond, then repaint it */
    for (const [x, y] of blocks) {
      const cx = isoX(x + 0.5, y + 0.5), cy = isoY(x + 0.5, y + 0.5);
      ctx.save();
      diamond(ctx, cx, cy, TILE_W + 1, TILE_H + 1);
      ctx.clip();
      ctx.clearRect(cx - TILE_W, cy - TILE_H, TILE_W * 2, TILE_H * 2);
      ctx.restore();
    }
    for (const [x, y] of blocks) this.drawTile(ctx, x, y);
    /* scenery shadows that fall across the repainted tiles have to go back */
    for (const [x, y] of blocks) this.bakePropShadows(ctx, { x, y });
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.groundVersion = park.version;
  },

  /* -------------------------------------------------------------- frame */
  draw(dt, build) {
    const ctx = this.ctx;
    this.time += dt;
    const t = this.time;

    /* A long-window average of real frame time, used to decide whether this
       device can afford the finishing passes. */
    const now = performance.now();
    if (this._lastFrame) {
      const ft = Math.min(200, now - this._lastFrame);
      this._ft = this._ft ? this._ft * 0.94 + ft * 0.06 : ft;
    }
    this._lastFrame = now;
    if (this.rich) { if (this._ft > 32) this.rich = false; }
    else if (this._ft < 22) this.rich = true;
    if (park.fullRebuild || !this.groundCanvas) this.buildGround();
    else if (park.dirty.length) this.patchGround();
    this.clampView();

    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    /* sky — the gradient objects are rebuilt only when the light or the
       window changes, not sixty times a second */
    const light = sim.dayLight();
    const key = this.W + 'x' + this.H + '|' + light.toFixed(2);
    if (this._gradKey !== key) {
      this._gradKey = key;
      const sky = ctx.createLinearGradient(0, 0, 0, this.H);
      sky.addColorStop(0, mixColor('#0d1630', '#8fd0e8', light));
      sky.addColorStop(1, mixColor('#1d2a44', '#b9dcb0', light));
      this._sky = sky;
      const g = ctx.createLinearGradient(0, 0, this.W * 0.9, this.H);
      g.addColorStop(0, 'rgba(255,226,168,.15)');
      g.addColorStop(0.5, 'rgba(255,255,255,0)');
      g.addColorStop(1, 'rgba(46,78,128,.14)');
      this._grade = g;
      const v = ctx.createRadialGradient(this.W / 2, this.H * 0.5, Math.min(this.W, this.H) * 0.45,
                                         this.W / 2, this.H * 0.5, Math.max(this.W, this.H) * 0.85);
      v.addColorStop(0, 'rgba(0,0,0,0)');
      v.addColorStop(1, 'rgba(18,14,8,.13)');
      this._vig = v;
      /* Grade and vignette are flattened into one picture so the finished
         frame is blended once rather than filled twice with live gradients. */
      const ov = makeCanvas(this.W, this.H);
      const oc = ov.getContext('2d');
      oc.fillStyle = g; oc.fillRect(0, 0, this.W, this.H);
      oc.fillStyle = v; oc.fillRect(0, 0, this.W, this.H);
      this._overlay = ov;
    }
    /* The baked ground is opaque right into the corners of its sheet, so when
       it covers the viewport the sky and the ridges behind it are painted for
       nothing — and at tablet resolution those are two of the most expensive
       passes in the frame. */
    const vb = this.viewBounds(0);
    const covered = this.groundCanvas
      && -this.gox <= vb.l && this.groundCanvas.width - this.gox >= vb.r
      && -this.goy <= vb.t && this.groundCanvas.height - this.goy >= vb.b;
    if (!covered) {
      ctx.fillStyle = this._sky;
      ctx.fillRect(0, 0, this.W, this.H);
      this.drawHorizon(ctx, light);
    }

    /* world transform */
    ctx.save();
    ctx.translate(this.W / 2, this.H / 2);
    ctx.scale(view.zoom, view.zoom);
    ctx.translate(-view.x, -view.y);

    /* Only the part of the baked ground that is actually on screen: blitting
       the whole sheet (several thousand pixels across) every frame was costing
       far more than everything drawn on top of it. */
    const gb = this.viewBounds(TILE_W);
    const gsx = clamp(Math.floor(gb.l + this.gox), 0, this.groundCanvas.width);
    const gsy = clamp(Math.floor(gb.t + this.goy), 0, this.groundCanvas.height);
    const gex = clamp(Math.ceil(gb.r + this.gox), 0, this.groundCanvas.width);
    const gey = clamp(Math.ceil(gb.b + this.goy), 0, this.groundCanvas.height);
    if (gex > gsx && gey > gsy)
      ctx.drawImage(this.groundCanvas, gsx, gsy, gex - gsx, gey - gsy,
        gsx - this.gox, gsy - this.goy, gex - gsx, gey - gsy);
    this.drawWater(ctx, t);
    this.drawMarkers(ctx);
    if (build && build.key) this.drawGhost(ctx, build);
    this.drawEntities(ctx, t, dt);
    if (ui.landMode) this.drawLand(ctx);
    this.drawEffects(ctx);
    ctx.restore();

    this.drawLighting(ctx, light, t);
    this.gradePass(ctx);
    this.drawBirds(ctx, t);
    this.drawLabels(ctx);
  },

  /* Distant ridges behind the world, parallaxed against the camera so the
     valley feels like it continues past the edge of the land. */
  drawHorizon(ctx, light) {
    const layers = [
      { amp: 34, base: 0.40, seed: 2.3, par: 0.035, col: mixColor('#243049', '#b3cddc', light) },
      { amp: 26, base: 0.46, seed: 7.1, par: 0.065, col: mixColor('#28374a', '#a2c1b8', light) },
      { amp: 20, base: 0.52, seed: 4.7, par: 0.10, col: mixColor('#2b3a3a', '#8fb493', light) }
    ];
    for (const L of layers) {
      const yBase = this.H * L.base - (view.y - 600) * L.par * view.zoom;
      const xOff = -view.x * L.par * view.zoom;
      ctx.beginPath();
      ctx.moveTo(-10, this.H + 10);
      for (let sx = -10; sx <= this.W + 10; sx += 14) {
        const u = (sx + xOff) * 0.0016 + L.seed;
        const h = (noise2(u * 3, L.seed) * 0.6 + noise2(u * 7.5, L.seed + 3) * 0.4);
        ctx.lineTo(sx, yBase - h * L.amp * 2 + L.amp);
      }
      ctx.lineTo(this.W + 10, this.H + 10);
      ctx.closePath();
      ctx.fillStyle = L.col;
      ctx.fill();
    }
  },

  /* animated shimmer on every stretch of water, park or wild */
  drawWater(ctx, t) {
    const b = this.viewBounds(90);
    ctx.save();

    /* the swell, one fill per visible tile */
    ctx.fillStyle = PALETTE.waterLite;
    for (let i = 0; i < this.waterTiles.length; i += 2) {
      const x = this.waterTiles[i], y = this.waterTiles[i + 1];
      const cx = isoX(x + 0.5, y + 0.5), cy = isoY(x + 0.5, y + 0.5);
      if (cx < b.l || cx > b.r || cy < b.t || cy > b.b) continue;
      const swell = Math.sin(t * 0.9 + (x + y) * 0.55) * 0.5 + 0.5;
      ctx.globalAlpha = 0.09 + swell * 0.12;
      diamond(ctx, cx, cy - 1 + swell * 1.5, TILE_W * 0.95, TILE_H * 0.95);
      ctx.fill();
    }

    /* glints, batched into one path */
    ctx.globalAlpha = 0.2;
    ctx.fillStyle = '#dff2fb';
    ctx.beginPath();
    for (let i = 0; i < this.waterTiles.length; i += 2) {
      const x = this.waterTiles[i], y = this.waterTiles[i + 1];
      const cx = isoX(x + 0.5, y + 0.5), cy = isoY(x + 0.5, y + 0.5);
      if (cx < b.l || cx > b.r || cy < b.t || cy > b.b) continue;
      const p = hash2(x, y);
      const a = Math.sin(t * 1.4 + p * 7) * 0.5 + 0.5;
      ellipseSub(ctx, cx + Math.sin(t * 0.8 + p * 5) * 7, cy - 1, 7 + a * 5, 2.2, 0);
    }
    ctx.fill();

    /* foam washing against the shore — small enough to stay inside its tile,
       so no clipping is needed */
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = '#f2fbff';
    ctx.beginPath();
    for (let i = 0; i < this.waterShore.length; i += 4) {
      const x = this.waterShore[i], y = this.waterShore[i + 1];
      const dx = this.waterShore[i + 2], dy = this.waterShore[i + 3];
      const cx = isoX(x + 0.5, y + 0.5), cy = isoY(x + 0.5, y + 0.5);
      if (cx < b.l || cx > b.r || cy < b.t || cy > b.b) continue;
      const wash = 0.5 + Math.sin(t * 1.1 + (x * 3 + y * 5)) * 0.5;
      const ex = cx + (dx - dy) * TILE_W * (0.2 + wash * 0.03);
      const ey = cy + (dx + dy) * TILE_H * (0.2 + wash * 0.03);
      ellipseSub(ctx, ex, ey, TILE_W * 0.2, TILE_H * (0.16 + wash * 0.05), (dx - dy) > 0 ? -0.46 : 0.46);
    }
    ctx.fill();
    ctx.restore();
  },

  /* the visible rectangle in world (iso pixel) space, grown by `pad` */
  viewBounds(pad) {
    pad = pad || 0;
    const hw = this.W / 2 / view.zoom + pad, hh = this.H / 2 / view.zoom + pad;
    return { l: view.x - hw, r: view.x + hw, t: view.y - hh, b: view.y + hh };
  },

  /* plots of land: what you own, what is for sale and what it costs */
  drawLand(ctx) {
    const price = park.plotPrice();
    for (let py = 0; py < PLOTS_Y; py++) {
      for (let px = 0; px < PLOTS_X; px++) {
        const owned = park.ownsPlot(px, py);
        const sale = park.plotForSale(px, py);
        if (!owned && !sale) continue;
        const x0 = px * PLOT, y0 = py * PLOT;
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(...this.pt(x0, y0));
        ctx.lineTo(...this.pt(x0 + PLOT, y0));
        ctx.lineTo(...this.pt(x0 + PLOT, y0 + PLOT));
        ctx.lineTo(...this.pt(x0, y0 + PLOT));
        ctx.closePath();
        if (sale) {
          const afford = sim.money >= price;
          ctx.fillStyle = afford ? 'rgba(90,210,120,.22)' : 'rgba(220,110,80,.20)';
          ctx.fill();
          ctx.strokeStyle = afford ? 'rgba(120,235,150,.9)' : 'rgba(230,140,110,.8)';
          ctx.lineWidth = 2.5;
          ctx.setLineDash([9, 6]);
          ctx.stroke();
          ctx.setLineDash([]);
          const c = this.pt(x0 + PLOT / 2, y0 + PLOT / 2);
          ctx.font = 'bold 13px system-ui, sans-serif';
          const label = money(price);
          const w = ctx.measureText(label).width + 20;
          ctx.fillStyle = 'rgba(20,16,12,.82)';
          roundRect(ctx, c[0] - w / 2, c[1] - 13, w, 24, 11); ctx.fill();
          ctx.fillStyle = afford ? '#bff0c8' : '#f0b9a6';
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText(label, c[0], c[1]);
        } else {
          ctx.strokeStyle = 'rgba(255,255,255,.22)';
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
        ctx.restore();
      }
    }
  },

  pt(tx, ty) { return [isoX(tx, ty), isoY(tx, ty)]; },

  /* entrance / exit chevrons and the hovered tile */
  drawMarkers(ctx) {
    for (const b of park.buildings.values()) {
      if (b.item.cat !== 'ride') continue;
      /* Once a ride is wired up its doors are just clutter, so the badges are
         kept for the cases where they tell you something: a door with no path
         beside it, and whatever ride you have selected. */
      const wired = park.reachable(b);
      if (wired && sim.selected !== b) continue;
      for (const [tile, col, label] of [[b.ent, '#5fd06a', 'IN'], [b.ext, '#e06a5f', 'OUT']]) {
        const access = park.accessTiles(tile);
        /* with no path beside it, mark the doorway itself so you can see where
           the missing connection has to go */
        const a = access[0] || tile;
        const linked = access.length > 0;
        const cx = isoX(a.x + 0.5, a.y + 0.5), cy = isoY(a.x + 0.5, a.y + 0.5);
        ctx.save();
        ctx.globalAlpha = linked ? 0.85 : 1;
        ctx.fillStyle = col;
        diamond(ctx, cx, cy, TILE_W * (linked ? 0.42 : 0.6), TILE_H * (linked ? 0.42 : 0.6));
        ctx.fill();
        if (!linked) {
          ctx.strokeStyle = '#fff';
          ctx.lineWidth = 2;
          ctx.setLineDash([5, 4]);
          diamond(ctx, cx, cy, TILE_W * 0.86, TILE_H * 0.86);
          ctx.stroke();
          ctx.setLineDash([]);
        }
        ctx.fillStyle = 'rgba(0,0,0,.7)';
        ctx.font = 'bold ' + (linked ? 8 : 9) + 'px system-ui, sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(linked ? label : label + '?', cx, cy + 1);
        ctx.restore();
      }
    }
    const h = this.hover;
    if (!park.inBounds(h.x, h.y)) return;
    if (ui.demolishMode) {
      const b = park.buildingAt(h.x, h.y);
      const tiles = [];
      if (b) { for (let dy = 0; dy < b.h; dy++) for (let dx = 0; dx < b.w; dx++) tiles.push([b.x + dx, b.y + dy]); }
      else if (park.isPath(h.x, h.y)) tiles.push([h.x, h.y]);
      ctx.save();
      ctx.fillStyle = 'rgba(230,90,70,.45)';
      ctx.strokeStyle = 'rgba(255,150,130,.95)';
      ctx.lineWidth = 2;
      for (const [tx, ty] of tiles) {
        const cx = isoX(tx + 0.5, ty + 0.5), cy = isoY(tx + 0.5, ty + 0.5);
        diamond(ctx, cx, cy, TILE_W - 3, TILE_H - 1.5);
        ctx.fill(); ctx.stroke();
      }
      ctx.restore();
      return;
    }
    if (ui.landMode) {
      const p = park.plotOf(h.x, h.y);
      if (!park.plotForSale(p.px, p.py)) return;
      const x0 = p.px * PLOT, y0 = p.py * PLOT;
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(...this.pt(x0, y0));
      ctx.lineTo(...this.pt(x0 + PLOT, y0));
      ctx.lineTo(...this.pt(x0 + PLOT, y0 + PLOT));
      ctx.lineTo(...this.pt(x0, y0 + PLOT));
      ctx.closePath();
      ctx.fillStyle = 'rgba(255,255,255,.12)';
      ctx.fill();
      ctx.restore();
      return;
    }
    const cx = isoX(h.x + 0.5, h.y + 0.5), cy = isoY(h.x + 0.5, h.y + 0.5);
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,.75)';
    ctx.lineWidth = 2;
    diamond(ctx, cx, cy, TILE_W - 4, TILE_H - 2);
    ctx.stroke();
    ctx.restore();
  },

  /* translucent preview of what is about to be built */
  drawGhost(ctx, build) {
    const item = ITEMS[build.key];
    const pend = ui.pending;
    const h = pend ? { x: pend.x, y: pend.y } : this.hover;
    const rot = pend ? pend.rot : build.rot;
    if (!park.inBounds(h.x, h.y)) return;
    const ok = park.canPlace(build.key, h.x, h.y, rot).ok && (build.moving || sim.money >= item.cost);
    const [w, hh] = park.rotDims(item, rot);

    const pulse = pend ? 0.55 + Math.sin(this.time * 4) * 0.16 : 0.45;
    ctx.save();
    ctx.globalAlpha = pulse;
    ctx.fillStyle = ok ? 'rgba(110,235,120,.55)' : 'rgba(240,90,80,.55)';
    const fw = item.cat === 'path' ? 1 : w, fh = item.cat === 'path' ? 1 : hh;
    for (let dy = 0; dy < fh; dy++)
      for (let dx = 0; dx < fw; dx++) {
        const cx = isoX(h.x + dx + 0.5, h.y + dy + 0.5), cy = isoY(h.x + dx + 0.5, h.y + dy + 0.5);
        diamond(ctx, cx, cy, TILE_W - 3, TILE_H - 1.5);
        ctx.fill();
      }
    /* a bright outline round the whole footprint so the spot is unmistakable */
    ctx.globalAlpha = 1;
    ctx.strokeStyle = ok ? 'rgba(150,255,165,.95)' : 'rgba(255,140,120,.95)';
    ctx.lineWidth = pend ? 3 : 2;
    ctx.beginPath();
    ctx.moveTo(isoX(h.x, h.y), isoY(h.x, h.y));
    ctx.lineTo(isoX(h.x + fw, h.y), isoY(h.x + fw, h.y));
    ctx.lineTo(isoX(h.x + fw, h.y + fh), isoY(h.x + fw, h.y + fh));
    ctx.lineTo(isoX(h.x, h.y + fh), isoY(h.x, h.y + fh));
    ctx.closePath();
    ctx.stroke();
    ctx.restore();

    if (item.cat !== 'path') {
      const spr = getSprite(item.art, w, hh, rot, item);
      const gx = isoX(h.x, h.y) - spr.ox, gy = isoY(h.x, h.y) - spr.oy;
      ctx.save();
      ctx.globalAlpha = ok ? 0.8 : 0.42;
      ctx.drawImage(spr.c, gx, gy);
      const anim = ANIM[item.art];
      if (anim) anim(ctx, gx, gy, spr, this.time, GHOST_BUILDING);
      ctx.restore();
    }

    /* show where the entrance and exit will land, and whether a path reaches them */
    if (item.cat === 'ride') {
      const e = park.rotPoint(item.ent[0], item.ent[1], item.w, item.h, rot);
      const x2 = park.rotPoint(item.ext[0], item.ext[1], item.w, item.h, rot);
      const doors = [[h.x + e[0], h.y + e[1], '#5fd06a', 'IN'], [h.x + x2[0], h.y + x2[1], '#e06a5f', 'OUT']];
      for (const [dx, dy, col, label] of doors) {
        const linked = park.accessTiles({ x: dx, y: dy }).length > 0;
        const cx = isoX(dx + 0.5, dy + 0.5), cy = isoY(dx + 0.5, dy + 0.5);
        ctx.save();
        ctx.fillStyle = col;
        ctx.globalAlpha = 0.95;
        diamond(ctx, cx, cy, TILE_W * 0.66, TILE_H * 0.66);
        ctx.fill();
        if (!linked) {
          ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.setLineDash([4, 3]);
          diamond(ctx, cx, cy, TILE_W * 0.9, TILE_H * 0.9); ctx.stroke();
          ctx.setLineDash([]);
        }
        ctx.fillStyle = 'rgba(0,0,0,.7)';
        ctx.font = 'bold 9px system-ui, sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(linked ? label : label + '?', cx, cy + 1);
        ctx.restore();
      }
    }
    /* power radius while placing a treadmill */
    if (item.radius) {
      ctx.save();
      ctx.strokeStyle = 'rgba(120,220,255,.8)';
      ctx.setLineDash([6, 5]); ctx.lineWidth = 2;
      const r = item.radius;
      ctx.beginPath();
      const pts = [[h.x - r, h.y - r], [h.x + w + r, h.y - r], [h.x + w + r, h.y + hh + r], [h.x - r, h.y + hh + r]];
      pts.forEach((p, i) => {
        const X = isoX(p[0], p[1]), Y = isoY(p[0], p[1]);
        i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y);
      });
      ctx.closePath(); ctx.stroke();
      ctx.restore();
    }
  },

  /* ------------------------------------------------------------ entities */
  /* Scenery is static and already sorted by depth, so it is merged into the
     dynamic list rather than re-sorted every frame. */
  drawEntities(ctx, t, dt) {
    const list = [];
    const bounds = this.viewBounds(220);
    /* Anything off screen is skipped before it reaches the depth sort — in a
       busy park most of the crowd is outside the view at any moment. */
    const near = this.viewBounds(70);
    const onScreen = (x, y, b) => {
      const wx = isoX(x, y), wy = isoY(x, y);
      return wx > b.l && wx < b.r && wy > b.t && wy < b.b;
    };
    for (const b of park.buildings.values())
      if (onScreen(b.x + b.w / 2, b.y + b.h / 2, bounds)) list.push({ d: b.x + b.y + (b.w + b.h) * 0.5, b });
    for (const v of sim.visitors)
      if (v.state !== 'riding' && onScreen(v.x + 0.5, v.y + 0.5, near))
        /* somebody on a bench has to sort after the bench, or the backrest is
           painted over them and they look as though they are standing behind it */
        list.push({ d: v.x + v.y + (v.restBench && v.state === 'resting' ? 1.4 : 0.6), v });
    for (const s of sim.staff)
      if (onScreen(s.x + 0.5, s.y + 0.5, near)) list.push({ d: s.x + s.y + 0.6, s });
    for (const v of traffic.vehicles)
      if (onScreen(v.x + 0.5, v.y + 0.5, near)) list.push({ d: v.x + v.y + 0.5, veh: v });
    if (onScreen(park.gate.x + 0.5, GRID_H - 0.5, bounds)) list.push({ d: park.gate.x + GRID_H - 1.4, gate: true });
    list.sort((a, b) => a.d - b.d);

    const props = scenery.props;

    /* Shadows first, so nothing is ever drawn underneath one. Scenery shadows
       are already baked into the ground; the crowd goes into a single path. */
    ctx.save();
    ctx.globalAlpha = SUN.alpha;
    ctx.fillStyle = '#0b1408';
    ctx.beginPath();
    for (const e of list) {
      if (e.v || e.s) this.personShadowPath(ctx, e.v || e.s);
      else if (e.veh) this.vehicleShadowPath(ctx, e.veh);
    }
    ctx.fill();
    for (const e of list) {
      if (e.b) this.spriteShadow(ctx, getSprite(e.b.item.art, e.b.w, e.b.h, e.b.rot, e.b.item),
        isoX(e.b.x, e.b.y), isoY(e.b.x, e.b.y), isoY(e.b.x + e.b.w / 2, e.b.y + e.b.h / 2));
      else if (e.gate) {
        const g = getSprite('parkgate', 5, 1, 0);
        this.spriteShadow(ctx, g, isoX(park.gate.x - 2, GRID_H - 1), isoY(park.gate.x - 2, GRID_H - 1),
          isoY(park.gate.x + 0.5, GRID_H - 0.5));
      }
    }
    ctx.restore();

    let pi = 0;
    for (const e of list) {
      while (pi < props.length && props[pi].d <= e.d) this.drawProp(ctx, props[pi++], t, bounds);
      if (e.gate) {
        const spr = getSprite('parkgate', 5, 1, 0);
        const gx = isoX(park.gate.x - 2, GRID_H - 1) - spr.ox, gy = isoY(park.gate.x - 2, GRID_H - 1) - spr.oy;
        ctx.drawImage(spr.c, gx, gy);
        ANIM.parkgate(ctx, gx, gy, spr, t);
      } else if (e.veh) drawVehicle(ctx, e.veh, t);
      else if (e.b) this.drawBuilding(ctx, e.b, t);
      else this.drawPerson(ctx, e.v || e.s, t);
    }
    while (pi < props.length) this.drawProp(ctx, props[pi++], t, bounds);
  },

  /* project a sprite flat onto the ground, leaning away from the sun */
  spriteShadow(ctx, spr, sx, sy, groundY) {
    const sil = spriteSilhouette(spr, '#0b1408');
    ctx.save();
    ctx.transform(1, 0, -SUN.lx, -SUN.ly, SUN.lx * groundY, groundY * (1 + SUN.ly));
    ctx.drawImage(sil, sx, sy);
    ctx.restore();
  },

  vehicleShadowPath(ctx, v) {
    const cx = isoX(v.x + 0.5, v.y + 0.5), cy = isoY(v.x + 0.5, v.y + 0.5);
    ellipseSub(ctx, cx + 7, cy + 2, v.def.len * 0.62, v.type === 'bus' ? 7 : 6, -0.46);
  },

  /* the cast shadow plus a tight contact patch under the feet, as one path so
     the whole crowd costs a single fill */
  personShadowPath(ctx, p) {
    if (p.state === 'resting' && p.restBench) return;   /* the bench casts it */
    let px = p.x, py = p.y;
    if (p.qx !== undefined) { px = p.qx; py = p.qy; }
    const k = p.look && p.look.kid ? 0.8 : 1;
    const cx = isoX(px + 0.5, py + 0.5), cy = isoY(px + 0.5, py + 0.5);
    ellipseSub(ctx, cx + 5.5 * k, cy + 1.4, 9.5 * k, 3 * k, -0.46);
    ellipseSub(ctx, cx, cy + 1, 4.6 * k, 2.2 * k, 0);
  },

  drawProp(ctx, p, t, b) {
    if (p.wx < b.l || p.wx > b.r || p.wy < b.t || p.wy > b.b) return;
    if (p.alphaGen !== this.fadeGen) { p.alpha = this.edgeAlpha(p.wx, p.wy); p.alphaGen = this.fadeGen; }
    if (p.alpha < 0.02) return;
    const spr = p.spr || (p.spr = getSprite(p.art, p.art === 'volcano' ? 9 : 1, p.art === 'volcano' ? 9 : 1, 0));
    const s = p.s || 1;
    const x = p.wx - spr.ox * s, y = p.wy - spr.oy * s;
    const dim = p.alpha < 1;
    const sway = SWAYS[p.art];
    if (dim || sway) ctx.save();
    if (dim) ctx.globalAlpha = p.alpha;
    if (sway) {
      /* lean about the foot of the trunk, so the crown moves and the base does not */
      if (p.phase === undefined) p.phase = hash2(Math.round(p.x * 7), Math.round(p.y * 7)) * 6.28;
      ctx.translate(p.wx, p.wy);
      ctx.rotate(Math.sin(t * 0.7 + p.phase) * sway + Math.sin(t * 1.9 + p.phase * 1.7) * sway * 0.35);
      ctx.translate(-p.wx, -p.wy);
    }
    if (s === 1) ctx.drawImage(spr.c, x, y);
    else ctx.drawImage(spr.c, x, y, spr.c.width * s, spr.c.height * s);
    const anim = p.anim && ANIM[p.art];
    if (anim) anim(ctx, x, y, spr, t, p);
    if (dim || sway) ctx.restore();
  },

  drawBuilding(ctx, b, t) {
    const spr = getSprite(b.item.art, b.w, b.h, b.rot, b.item);
    const sx = isoX(b.x, b.y) - spr.ox, sy = isoY(b.x, b.y) - spr.oy;
    /* a tight contact shade where it meets the ground; the long shadow is
       drawn in the shadow pass */
    const [mx, my] = [isoX(b.x + b.w / 2, b.y + b.h / 2), isoY(b.x + b.w / 2, b.y + b.h / 2)];
    blob(ctx, mx, my, TILE_W * 0.34 * Math.max(b.w, b.h), TILE_H * 0.32 * Math.max(b.w, b.h), 0.13);

    if (sim.selected === b) {
      ctx.save();
      ctx.shadowColor = '#ffe27a'; ctx.shadowBlur = 18;
      ctx.drawImage(spr.c, sx, sy);
      ctx.restore();
    }
    ctx.drawImage(spr.c, sx, sy);
    const anim = ANIM[b.item.art];
    if (anim) anim(ctx, sx, sy, spr, t, b);

    /* status badges */
    const bx = mx, by = my - (spr.extra * 0.45) - 14;
    if (b.brokeDown) this.badge(ctx, bx, by, '🔧', '#e0574a', t);
    else if (b.item.power && !b.powered) this.badge(ctx, bx, by, '⚡', '#e0a33c', t);
    else if (b.item.worker && !b.worker) this.badge(ctx, bx, by, '🙋', '#4aa3e0', t);
    else if (!b.open) this.badge(ctx, bx, by, '⛔', '#999', t);
    else if (b.item.cat === 'ride' && !park.reachable(b)) this.badge(ctx, bx, by, '🚧', '#e0a33c', t);

    /* the queue: a roped-off lane, and a counter over the entrance */
    if (b.queue && b.queue.length) {
      const l = park.queueLine(b);
      if (l) {
        const runs = Math.min(l.len + 0.5, Math.max(1, b.queue.length * 0.52));
        ctx.save();
        ctx.globalAlpha = 0.85;
        for (const side of [-0.32, 0.32]) {
          const px0 = l.x + 0.5 - l.dy * side, py0 = l.y + 0.5 + l.dx * side;
          ctx.strokeStyle = 'rgba(214,190,130,.85)';
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.moveTo(isoX(px0, py0), isoY(px0, py0) - 8);
          ctx.lineTo(isoX(px0 + l.dx * runs, py0 + l.dy * runs), isoY(px0 + l.dx * runs, py0 + l.dy * runs) - 8);
          ctx.stroke();
          for (let i = 0; i <= Math.ceil(runs); i += 1) {
            const qx = px0 + l.dx * i, qy = py0 + l.dy * i;
            const sx2 = isoX(qx, qy), sy2 = isoY(qx, qy);
            ctx.fillStyle = PALETTE.woodDark;
            ctx.fillRect(sx2 - 1.3, sy2 - 10, 2.6, 10);
            ctx.fillStyle = shade(PALETTE.wood, .2);
            ctx.fillRect(sx2 - 1.3, sy2 - 10, 1, 10);
          }
        }
        ctx.restore();
      }
      const a = park.accessTiles(b.ent)[0];
      if (a) {
        ctx.save();
        ctx.font = 'bold 9px system-ui, sans-serif';
        ctx.textAlign = 'center';
        const qx = isoX(a.x + 0.5, a.y + 0.5), qy = isoY(a.x + 0.5, a.y + 0.5);
        ctx.fillStyle = 'rgba(0,0,0,.5)';
        roundRect(ctx, qx - 13, qy - 36, 26, 13, 6); ctx.fill();
        ctx.fillStyle = b.queue.length > b.item.cap * 1.5 ? '#f0b9a6' : '#fff';
        ctx.fillText('⏳' + b.queue.length, qx, qy - 26.5);
        ctx.restore();
      }
    }
  },

  badge(ctx, x, y, icon, col, t) {
    const bob = Math.sin(t * 3) * 2;
    ctx.save();
    ctx.globalAlpha = 0.95;
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.arc(x, y + bob, 10, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,.25)';
    ctx.beginPath(); ctx.arc(x, y + bob + 2, 10, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.arc(x, y + bob, 10, 0, Math.PI * 2); ctx.fill();
    ctx.font = '11px system-ui, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(icon, x, y + bob + 1);
    ctx.restore();
  },

  /* The body itself is a cached sprite; only the things that change with the
     person's state — mood, badge, selection, speech — are drawn live. */
  drawPerson(ctx, p, t) {
    let px = p.x, py = p.y, ox = 0;
    if (p.state === 'queue' && p.queuedFor) {
      const qi = p.queuedFor.queue.indexOf(p);
      const slot = park.queueSlot(p.queuedFor, qi);
      if (slot) {
        /* ease into place so the line shuffles forward rather than snapping */
        p.qx = p.qx === undefined ? p.x : lerp(p.qx, slot.x, 0.12);
        p.qy = p.qy === undefined ? p.y : lerp(p.qy, slot.y, 0.12);
        px = p.qx; py = p.qy;
        ox = (qi % 2) * 7 - 3.5;        /* two abreast, so long queues stay short */
      }
    } else { p.qx = undefined; p.qy = undefined; }
    const cx = isoX(px + 0.5, py + 0.5) + ox;
    const cy = isoY(px + 0.5, py + 0.5);
    const walking = p.state === 'walk' || p.state === 'leaving';
    const k = p.look.kid ? 0.78 : 1;
    const H = 18 * k;

    if (p.kind === 'staff') {
      /* a ring under the feet in the trade's colour — at a glance this is what
         separates staff from the crowd, long before the badge is legible */
      ctx.save();
      ctx.strokeStyle = p.def.color; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(cx, cy + 2, 10, 5, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 0.9;
      ctx.beginPath(); ctx.ellipse(cx, cy + 2, 10, 5, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }

    if (sim.selected === p) {
      ctx.save();
      ctx.strokeStyle = '#ffe27a'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(cx, cy + 1, 11, 6, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }

    const seated = p.state === 'resting' && p.restBench;
    const frame = seated ? PERSON_SIT
      : walking ? (((t * 1.45 + p.id * 0.37) * PERSON_FRAMES | 0) % PERSON_FRAMES) : PERSON_FRAMES;
    const spr = getPerson(p.look, frame);
    /* a seated figure sits up on the bench slats rather than on the ground */
    const lift = seated ? 7.5 : 0;
    ctx.drawImage(spr.c, cx - spr.ox, cy - spr.oy - lift, spr.w, spr.h);

    const bob = walking ? Math.abs(Math.sin(frame / PERSON_FRAMES * Math.PI * 2)) * 2 : 0;
    const bodyY = cy - (seated ? 14 * k : H) - bob - lift;

    if (sim.selected === p) {
      ctx.fillStyle = '#ffe27a';
      const ax = cx, ay = cy - H - 16 - Math.sin(t * 4) * 2;
      ctx.beginPath(); ctx.moveTo(ax - 5, ay); ctx.lineTo(ax + 5, ay); ctx.lineTo(ax, ay + 7); ctx.closePath(); ctx.fill();
    }

    if (p.kind === 'staff') {
      /* A square tag, not a disc: a round pale thing over someone's head is
         what a visitor's thought looks like, and the two were being confused.
         The ring on the ground carries the same colour for a wider view. */
      const by2 = bodyY - 12;
      ctx.fillStyle = p.def.color;
      roundRect(ctx, cx - 7.5, by2 - 7, 15, 14, 3.5); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.lineWidth = 1.2;
      roundRect(ctx, cx - 7.5, by2 - 7, 15, 14, 3.5); ctx.stroke();
      drawGlyph(ctx, STAFF_ICON[p.role] || '\u2022', 12, cx, by2 + 0.5, 0.8);
      if (sim.selected === p) {
        ctx.font = 'bold 9px system-ui, sans-serif';
        ctx.fillStyle = 'rgba(0,0,0,.55)';
        const tw = ctx.measureText(p.def.name).width + 8;
        roundRect(ctx, cx - tw / 2, cy + 3, tw, 11, 5); ctx.fill();
        ctx.fillStyle = '#ffe9b8';
        ctx.fillText(p.def.name, cx, cy + 9);
      }
    } else {
      /* mood pip */
      const m = p.happiness;
      ctx.fillStyle = m > 66 ? '#5fd06a' : m > 33 ? '#e8c44a' : '#e0574a';
      ctx.beginPath(); ctx.arc(cx + 7 * k, bodyY + 2, 2.2, 0, Math.PI * 2); ctx.fill();
    }

    if (p.fightT > 0) {
      const s = 1 + Math.sin(t * 22) * 0.2;
      drawGlyph(ctx, '\ud83d\udca2', 16, cx, bodyY - 12, s * 0.9);
    } else if (p.bubble) {
      ctx.save();
      ctx.fillStyle = 'rgba(255,255,255,.92)';
      ctx.beginPath(); ctx.ellipse(cx, bodyY - 14, 9, 7.5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.moveTo(cx - 3, bodyY - 8); ctx.lineTo(cx + 2, bodyY - 8); ctx.lineTo(cx, bodyY - 4); ctx.closePath(); ctx.fill();
      drawGlyph(ctx, p.bubble, 12, cx, bodyY - 14, 0.78);
      ctx.restore();
    }
  },

  drawEffects(ctx) {
    for (const e of sim.effects) {
      const f = e.life / e.max;
      const cx = isoX(e.x + 0.5, e.y + 0.5), cy = isoY(e.x + 0.5, e.y + 0.5);
      ctx.save();
      ctx.globalAlpha = clamp(f, 0, 1);
      if (e.type === 'text') {
        ctx.font = 'bold 11px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,.55)';
        ctx.strokeText(e.text, cx, cy - 26 - (1 - f) * 22);
        ctx.fillStyle = e.color || '#fff';
        ctx.fillText(e.text, cx, cy - 26 - (1 - f) * 22);
      } else if (e.type === 'dust') {
        ctx.fillStyle = 'rgba(214,198,160,.8)';
        ctx.beginPath(); ctx.arc(cx, cy - 6, e.r * (1.4 - f * 0.4), 0, Math.PI * 2); ctx.fill();
      } else {
        ctx.fillStyle = e.color || '#ffd54a';
        ctx.beginPath(); ctx.arc(cx, cy - 20 - (1 - f) * 30, e.r, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    }
  },

  /* Night tint plus warm pools of light. A torch burns whatever the hour, so
     its pool is drawn in daylight too — tighter and much fainter, but there,
     which is the point: a lit path is something you can see you have built.
     Huts and rides only glow once it is actually dark. */
  drawLighting(ctx, light, t) {
    const dark = 1 - light;
    const night = dark >= 0.04;
    const lamps = park.litTiles();
    if (!night && !lamps.length) return;

    const lights = [];
    if (night) {
      for (const b of park.buildings.values()) {
        if (b.item.light) lights.push([b.x + 0.5, b.y + 0.5, 100, 0.75 * dark]);
        else if (b.item.cat === 'stall' && b.worker) lights.push([b.x + b.w / 2, b.y + b.h / 2, 78, 0.5 * dark]);
        else if (b.item.cat === 'ride' && b.powered && b.open) lights.push([b.x + b.w / 2, b.y + b.h / 2, 95, 0.45 * dark]);
      }
      lights.push([park.gate.x + 0.5, park.gate.y + 0.5, 88, 0.55 * dark]);
    } else {
      for (const l of lamps) lights.push([l.x, l.y, 62, 0.17]);
    }

    ctx.save();
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    if (night) {
      ctx.fillStyle = 'rgba(26,34,72,' + (dark * 0.50).toFixed(3) + ')';
      ctx.fillRect(0, 0, this.W, this.H);
    }
    ctx.globalCompositeOperation = 'lighter';
    for (const L of lights) {
      const [sx, sy] = this.worldToScreen(isoX(L[0], L[1]), isoY(L[0], L[1]));
      const r = L[2] * view.zoom * (0.95 + Math.sin(t * 2.5 + L[0]) * 0.05);
      if (sx < -r || sy < -r || sx > this.W + r || sy > this.H + r) continue;
      const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, r);
      g.addColorStop(0, 'rgba(255,190,110,' + L[3].toFixed(3) + ')');
      g.addColorStop(1, 'rgba(255,170,90,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(sx, sy, r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  },

  /* A light grade over the finished frame: sun-warmed highlights on the
     north-west side, cool shade to the south-east, and the faintest vignette
     so the middle of the screen reads first. */
  gradePass(ctx) {
    /* One alpha blend over every pixel on the screen: cheap on a desktop,
       a third of the budget on a high-resolution tablet. It is the first
       thing to go when the frame cannot afford it. */
    if (!this._overlay || !this.rich) return;
    ctx.save();
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.drawImage(this._overlay, 0, 0, this.W, this.H);
    ctx.restore();
  },

  /* a few birds wheeling over the park, purely for company */
  drawBirds(ctx, t) {
    ctx.save();
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.strokeStyle = 'rgba(40,40,50,.45)';
    ctx.lineCap = 'round';
    for (let i = 0; i < 5; i++) {
      const sp = 0.05 + i * 0.012;
      const a = t * sp + i * 1.7;
      const rx = 260 + i * 70, ry = 90 + i * 22;
      const wx = this.fadeCx + Math.cos(a) * rx;
      const wy = this.fadeCy - 260 - i * 30 + Math.sin(a) * ry;
      const [sx, sy] = this.worldToScreen(wx, wy);
      if (sx < -30 || sy < -30 || sx > this.W + 30 || sy > this.H + 30) continue;
      const flap = Math.sin(t * 6 + i * 2) * 3;
      const s = 4 + i * 0.6;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(sx - s, sy + flap);
      ctx.quadraticCurveTo(sx - s * 0.4, sy - 2, sx, sy);
      ctx.quadraticCurveTo(sx + s * 0.4, sy - 2, sx + s, sy + flap);
      ctx.stroke();
    }
    ctx.restore();
  },

  /* floating name label for whatever is selected */
  drawLabels(ctx) {
    const sel = sim.selected;
    if (!sel || !sel.item) return;
    const [sx, sy] = this.worldToScreen(isoX(sel.x + sel.w / 2, sel.y + sel.h / 2), isoY(sel.x + sel.w / 2, sel.y + sel.h / 2));
    ctx.save();
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.font = 'bold 12px system-ui, sans-serif';
    const text = sel.item.name;
    const w = ctx.measureText(text).width + 16;
    ctx.fillStyle = 'rgba(20,16,12,.8)';
    roundRect(ctx, sx - w / 2, sy - 52, w, 20, 9); ctx.fill();
    ctx.fillStyle = '#ffe9b8';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(text, sx, sy - 42);
    ctx.restore();
  },

  /* small overview map used by the UI panel */
  drawMinimap(c) {
    const ctx = c.getContext('2d');
    const s = Math.min(c.width / GRID_W, c.height / GRID_H);
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.fillStyle = '#2f4a22';
    ctx.fillRect(0, 0, c.width, c.height);
    for (let y = 0; y < GRID_H; y++) for (let x = 0; x < GRID_W; x++) {
      const g = park.ground[park.idx(x, y)];
      if (g === GROUND.GRASS) continue;
      ctx.fillStyle = g === GROUND.WATER ? '#2f7fb5' : g === GROUND.SAND ? '#d9c48a'
        : g === GROUND.STONE ? '#b9bcc4' : g === GROUND.ROAD ? '#3b3e44' : '#b39a6c';
      ctx.fillRect(x * s, y * s, s, s);
    }
    for (const b of park.buildings.values()) {
      ctx.fillStyle = b.item.cat === 'ride' ? '#e0574a' : b.item.cat === 'stall' ? '#e0a33c'
        : b.item.cat === 'engine' ? '#4aa3e0' : b.item.cat === 'service' ? '#9b7be0' : '#5fd06a';
      ctx.fillRect(b.x * s, b.y * s, b.w * s, b.h * s);
    }
    ctx.fillStyle = '#fff';
    for (const v of sim.visitors) ctx.fillRect(v.x * s, v.y * s, 1.5, 1.5);
    /* viewport box */
    const tl = this.screenToTile(0, 0), br = this.screenToTile(this.W, this.H);
    ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.lineWidth = 1;
    ctx.strokeRect(tl.fx * s, tl.fy * s, (br.fx - tl.fx) * s, (br.fy - tl.fy) * s);
  }
};
