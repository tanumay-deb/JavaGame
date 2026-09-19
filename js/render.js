/* Isometric renderer: cached ground layer, depth-sorted entities, animated
   ride parts, particle effects and a day/night lighting pass. */

const view = { x: 0, y: 0, zoom: 1, minZoom: 0.45, maxZoom: 1.9 };

const renderer = {
  canvas: null, ctx: null, W: 0, H: 0, dpr: 1,
  groundCanvas: null, groundVersion: -1,
  gox: GRID_H * (TILE_W / 2), goy: 0,
  hover: { x: -1, y: -1 },
  time: 0,

  init(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.resize();
    this.centerOn(park.gate.x, park.gate.y - 5);
  },

  resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const r = this.canvas.getBoundingClientRect();
    this.dpr = dpr;
    this.W = r.width; this.H = r.height;
    this.canvas.width = Math.round(r.width * dpr);
    this.canvas.height = Math.round(r.height * dpr);
  },

  centerOn(tx, ty) { view.x = isoX(tx, ty); view.y = isoY(tx, ty); },

  clampView() {
    const maxX = GRID_W * TILE_W / 2 + 200, minX = -GRID_H * TILE_W / 2 - 200;
    view.x = clamp(view.x, minX, maxX);
    view.y = clamp(view.y, -120, (GRID_W + GRID_H) * TILE_H / 2 + 120);
    view.zoom = clamp(view.zoom, view.minZoom, view.maxZoom);
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
  tileFade(x, y) {
    const d = Math.hypot(isoX(x + .5, y + .5) - isoX(GRID_W / 2, GRID_H / 2),
                        (isoY(x + .5, y + .5) - isoY(GRID_W / 2, GRID_H / 2)) * 2);
    const t = clamp((d - TILE_W * 8) / (TILE_W * 12), 0, 1);
    return t * 0.30;
  },

  drawTile(ctx, x, y) {
    const g = park.ground[park.idx(x, y)];
    const cx = isoX(x + 0.5, y + 0.5), cy = isoY(x + 0.5, y + 0.5);
    const n = hash2(x, y);
    let col;
    if (g === GROUND.GRASS) {
      /* low-frequency patches over per-tile variation so the lawn is not flat */
      const patch = hash2(Math.floor(x / 4), Math.floor(y / 4));
      const base = PALETTE.grass[Math.floor(n * PALETTE.grass.length)];
      col = mixColor(base, PALETTE.grassAlt[Math.floor(patch * PALETTE.grassAlt.length)], 0.35 + patch * 0.3);
    } else if (g === GROUND.SAND) col = mixColor(PALETTE.sand, '#c2ad78', n);
    else if (g === GROUND.WATER) col = mixColor(PALETTE.water, '#286c9b', n);
    else col = g === GROUND.STONE ? PALETTE.stone : PALETTE.gravel;

    diamond(ctx, cx, cy, TILE_W, TILE_H);
    ctx.fillStyle = col;
    ctx.fill();

    if (g === GROUND.GRASS) {
      const m = hash2(y * 3 + 1, x * 5 + 2);
      if (n > 0.42) {
        const gx = cx + (n - 0.5) * 26, gy = cy + (m - 0.5) * 12;
        ctx.lineWidth = 1.4;
        ctx.strokeStyle = shade(col, 0.22);
        ctx.beginPath();
        ctx.moveTo(gx, gy); ctx.lineTo(gx - 2.5, gy - 5);
        ctx.moveTo(gx, gy); ctx.lineTo(gx + 1, gy - 6);
        ctx.stroke();
        ctx.strokeStyle = shade(col, -0.22);
        ctx.beginPath();
        ctx.moveTo(gx + 1, gy); ctx.lineTo(gx + 4, gy - 4);
        ctx.stroke();
      }
      if (m > 0.955) {
        const sx2 = cx + (n - 0.5) * 20, sy2 = cy + (m - 0.5) * 8;
        if (n > 0.5) {
          ctx.fillStyle = '#9aa0a6';
          ctx.beginPath(); ctx.ellipse(sx2, sy2, 3, 2, 0, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = 'rgba(255,255,255,.25)';
          ctx.beginPath(); ctx.ellipse(sx2 - .6, sy2 - .8, 1.4, .9, 0, 0, Math.PI * 2); ctx.fill();
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
        const ng = park.groundAt(x + d[0], y + d[1]);
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
    } else if (g === GROUND.WATER) {
      ctx.fillStyle = 'rgba(0,0,0,.18)';
      diamond(ctx, cx, cy - 1, TILE_W, TILE_H); ctx.fill();
      ctx.fillStyle = col; diamond(ctx, cx, cy, TILE_W - 2, TILE_H - 1); ctx.fill();
    }

    const fade = this.tileFade(x, y);
    if (fade > 0.004) {
      ctx.fillStyle = 'rgba(12,22,8,' + fade.toFixed(3) + ')';
      diamond(ctx, cx, cy, TILE_W, TILE_H); ctx.fill();
    }
  },

  groundCtx() {
    const w = (GRID_W + GRID_H) * (TILE_W / 2);
    const h = (GRID_W + GRID_H) * (TILE_H / 2) + 8;
    if (!this.groundCanvas) this.groundCanvas = makeCanvas(w, h);
    return this.groundCanvas.getContext('2d');
  },

  buildGround() {
    const ctx = this.groundCtx();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.groundCanvas.width, this.groundCanvas.height);
    ctx.setTransform(1, 0, 0, 1, this.gox, this.goy);
    for (let y = 0; y < GRID_H; y++)
      for (let x = 0; x < GRID_W; x++) this.drawTile(ctx, x, y);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    park.dirty.length = 0;
    park.fullRebuild = false;
    this.groundVersion = park.version;
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
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.groundVersion = park.version;
  },

  /* -------------------------------------------------------------- frame */
  draw(dt, build) {
    const ctx = this.ctx;
    this.time += dt;
    const t = this.time;
    if (park.fullRebuild || !this.groundCanvas) this.buildGround();
    else if (park.dirty.length) this.patchGround();

    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    /* sky */
    const light = sim.dayLight();
    const skyTop = mixColor('#0d1630', '#8fd0e8', light);
    const skyBot = mixColor('#1d2a44', '#b9dcb0', light);
    const sky = ctx.createLinearGradient(0, 0, 0, this.H);
    sky.addColorStop(0, skyTop); sky.addColorStop(1, skyBot);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, this.W, this.H);

    /* world transform */
    ctx.save();
    ctx.translate(this.W / 2, this.H / 2);
    ctx.scale(view.zoom, view.zoom);
    ctx.translate(-view.x, -view.y);

    ctx.drawImage(this.groundCanvas, -this.gox, -this.goy);
    this.drawWater(ctx, t);
    this.drawMarkers(ctx);
    if (build && build.key) this.drawGhost(ctx, build);
    this.drawEntities(ctx, t, dt);
    this.drawEffects(ctx);
    ctx.restore();

    this.drawLighting(ctx, light, t);
    this.drawLabels(ctx);
  },

  /* animated shimmer on the pond */
  drawWater(ctx, t) {
    ctx.save();
    ctx.globalAlpha = 0.5;
    for (let y = 0; y < GRID_H; y++) for (let x = 0; x < GRID_W; x++) {
      if (park.ground[park.idx(x, y)] !== GROUND.WATER) continue;
      const cx = isoX(x + 0.5, y + 0.5), cy = isoY(x + 0.5, y + 0.5);
      const p = hash2(x, y);
      const a = Math.sin(t * 1.4 + p * 7) * 0.5 + 0.5;
      ctx.fillStyle = PALETTE.waterLite;
      ctx.globalAlpha = 0.12 + a * 0.22;
      ctx.beginPath();
      ctx.ellipse(cx + Math.sin(t * 0.8 + p * 5) * 6, cy, 11 + a * 5, 4, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  },

  /* entrance / exit chevrons and the hovered tile */
  drawMarkers(ctx) {
    for (const b of park.buildings.values()) {
      if (b.item.cat !== 'ride') continue;
      for (const [tile, col, label] of [[b.ent, '#5fd06a', 'IN'], [b.ext, '#e06a5f', 'OUT']]) {
        for (const a of park.accessTiles(tile)) {
          const cx = isoX(a.x + 0.5, a.y + 0.5), cy = isoY(a.x + 0.5, a.y + 0.5);
          ctx.save();
          ctx.globalAlpha = 0.85;
          ctx.fillStyle = col;
          diamond(ctx, cx, cy, TILE_W * 0.42, TILE_H * 0.42);
          ctx.fill();
          ctx.fillStyle = 'rgba(0,0,0,.65)';
          ctx.font = 'bold 8px system-ui, sans-serif';
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText(label, cx, cy + 1);
          ctx.restore();
          break;
        }
      }
    }
    const h = this.hover;
    if (h.x >= 0 && park.inBounds(h.x, h.y)) {
      const cx = isoX(h.x + 0.5, h.y + 0.5), cy = isoY(h.x + 0.5, h.y + 0.5);
      ctx.save();
      ctx.strokeStyle = 'rgba(255,255,255,.75)';
      ctx.lineWidth = 2;
      diamond(ctx, cx, cy, TILE_W - 4, TILE_H - 2);
      ctx.stroke();
      ctx.restore();
    }
  },

  /* translucent preview of what is about to be built */
  drawGhost(ctx, build) {
    const item = ITEMS[build.key];
    const h = this.hover;
    if (!park.inBounds(h.x, h.y)) return;
    const ok = park.canPlace(build.key, h.x, h.y, build.rot).ok && sim.money >= item.cost;
    const [w, hh] = park.rotDims(item, build.rot);

    ctx.save();
    ctx.globalAlpha = 0.45;
    ctx.fillStyle = ok ? 'rgba(110,235,120,.55)' : 'rgba(240,90,80,.55)';
    for (let dy = 0; dy < (item.cat === 'path' ? 1 : hh); dy++)
      for (let dx = 0; dx < (item.cat === 'path' ? 1 : w); dx++) {
        const cx = isoX(h.x + dx + 0.5, h.y + dy + 0.5), cy = isoY(h.x + dx + 0.5, h.y + dy + 0.5);
        diamond(ctx, cx, cy, TILE_W - 3, TILE_H - 1.5);
        ctx.fill();
      }
    ctx.restore();

    if (item.cat !== 'path') {
      const spr = getSprite(item.art, w, hh, build.rot);
      ctx.save();
      ctx.globalAlpha = ok ? 0.75 : 0.4;
      ctx.drawImage(spr.c, isoX(h.x, h.y) - spr.ox, isoY(h.x, h.y) - spr.oy);
      ctx.restore();
    }

    /* show where the entrance and exit will land, and whether a path reaches them */
    if (item.cat === 'ride') {
      const e = park.rotPoint(item.ent[0], item.ent[1], item.w, item.h, build.rot);
      const x2 = park.rotPoint(item.ext[0], item.ext[1], item.w, item.h, build.rot);
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
  drawEntities(ctx, t, dt) {
    const list = [];
    for (const b of park.buildings.values()) list.push({ d: b.x + b.y + (b.w + b.h) * 0.5, b });
    for (const v of sim.visitors) if (v.state !== 'riding') list.push({ d: v.x + v.y + 0.6, v });
    for (const s of sim.staff) list.push({ d: s.x + s.y + 0.6, s });
    list.push({ d: park.gate.x + park.gate.y + 0.2, gate: true });
    list.sort((a, b) => a.d - b.d);

    for (const e of list) {
      if (e.gate) {
        const spr = getSprite('parkgate', 3, 1, 0);
        ctx.drawImage(spr.c, isoX(park.gate.x - 1, park.gate.y + 1) - spr.ox, isoY(park.gate.x - 1, park.gate.y + 1) - spr.oy);
      } else if (e.b) this.drawBuilding(ctx, e.b, t);
      else this.drawPerson(ctx, e.v || e.s, t);
    }
  },

  drawBuilding(ctx, b, t) {
    const spr = getSprite(b.item.art, b.w, b.h, b.rot);
    const sx = isoX(b.x, b.y) - spr.ox, sy = isoY(b.x, b.y) - spr.oy;
    /* contact shadow */
    const [mx, my] = [isoX(b.x + b.w / 2, b.y + b.h / 2), isoY(b.x + b.w / 2, b.y + b.h / 2)];
    blob(ctx, mx, my, TILE_W * 0.42 * Math.max(b.w, b.h), TILE_H * 0.4 * Math.max(b.w, b.h), 0.16);

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

    /* queue */
    if (b.queue && b.queue.length) {
      const a = park.accessTiles(b.ent)[0];
      if (a) {
        ctx.save();
        ctx.font = 'bold 9px system-ui, sans-serif';
        ctx.textAlign = 'center';
        const qx = isoX(a.x + 0.5, a.y + 0.5), qy = isoY(a.x + 0.5, a.y + 0.5);
        ctx.fillStyle = 'rgba(0,0,0,.45)';
        roundRect(ctx, qx - 12, qy - 34, 24, 12, 6); ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.fillText('⏳' + b.queue.length, qx, qy - 25);
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

  drawPerson(ctx, p, t) {
    let ox = 0, oy = 0;
    if (p.state === 'queue' && p.queuedFor) {
      const qi = p.queuedFor.queue.indexOf(p);
      ox = (qi % 3) * 5 - 5; oy = Math.floor(qi / 3) * 4;
    }
    const cx = isoX(p.x + 0.5, p.y + 0.5) + ox;
    const cy = isoY(p.x + 0.5, p.y + 0.5) + oy;
    const walking = p.state === 'walk' || p.state === 'leaving';
    const bob = walking ? Math.abs(Math.sin(t * 7 + p.id)) * 2 : 0;
    const k = p.look.kid ? 0.78 : 1;
    const H = 18 * k;

    blob(ctx, cx, cy + 1, 6 * k, 3 * k, 0.22);

    if (sim.selected === p) {
      ctx.save();
      ctx.strokeStyle = '#ffe27a'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(cx, cy + 1, 11, 6, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#ffe27a';
      const ax = cx, ay = cy - H - 16 - Math.sin(t * 4) * 2;
      ctx.beginPath(); ctx.moveTo(ax - 5, ay); ctx.lineTo(ax + 5, ay); ctx.lineTo(ax, ay + 7); ctx.closePath(); ctx.fill();
      ctx.restore();
    }

    const legPh = walking ? Math.sin(t * 9 + p.id) : 0;
    ctx.fillStyle = shade(p.look.skin, -0.25);
    ctx.fillRect(cx - 3.5, cy - 6 * k - bob, 2.6, 6 * k + legPh);
    ctx.fillRect(cx + 1, cy - 6 * k - bob, 2.6, 6 * k - legPh);

    /* body */
    const bodyY = cy - H - bob;
    ctx.fillStyle = p.look.cloth;
    roundRect(ctx, cx - 5 * k, bodyY + 3, 10 * k, 11 * k, 3.5); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,.18)';
    roundRect(ctx, cx - 5 * k, bodyY + 10 * k, 10 * k, 4 * k, 2); ctx.fill();
    /* fur trim */
    ctx.fillStyle = 'rgba(255,255,255,.22)';
    ctx.fillRect(cx - 5 * k, bodyY + 3, 10 * k, 1.6);
    /* arms */
    ctx.strokeStyle = p.look.skin; ctx.lineWidth = 2.4 * k; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx - 5 * k, bodyY + 6); ctx.lineTo(cx - 7 * k, bodyY + 11 - legPh * 1.5);
    ctx.moveTo(cx + 5 * k, bodyY + 6); ctx.lineTo(cx + 7 * k, bodyY + 11 + legPh * 1.5);
    ctx.stroke();
    /* head */
    ctx.fillStyle = p.look.skin;
    ctx.beginPath(); ctx.arc(cx, bodyY - 1, 4.6 * k, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = p.look.hair;
    ctx.beginPath(); ctx.arc(cx, bodyY - 2.6, 4.6 * k, Math.PI * 1.05, Math.PI * 2.0); ctx.fill();
    if (p.look.hat) {
      ctx.fillStyle = p.look.hat;
      ctx.beginPath(); ctx.ellipse(cx, bodyY - 5.5, 6 * k, 2.2 * k, 0, 0, Math.PI * 2); ctx.fill();
    }
    /* eyes */
    ctx.fillStyle = '#2a2018';
    ctx.beginPath();
    ctx.arc(cx - 1.6, bodyY - 1.4, 0.75, 0, Math.PI * 2);
    ctx.arc(cx + 1.6, bodyY - 1.4, 0.75, 0, Math.PI * 2);
    ctx.fill();

    if (p.kind === 'staff') {
      /* a small coloured disc with the trade on it reads better than a name */
      const by2 = bodyY - 11;
      ctx.fillStyle = 'rgba(0,0,0,.3)';
      ctx.beginPath(); ctx.arc(cx, by2 + 1, 7, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = p.def.color;
      ctx.beginPath(); ctx.arc(cx, by2, 7, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(cx, by2, 7, 0, Math.PI * 2); ctx.stroke();
      ctx.font = '9px system-ui, sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(STAFF_ICON[p.role] || '•', cx, by2 + 0.5);
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
      ctx.font = (14 * s) + 'px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('💢', cx, bodyY - 12);
    } else if (p.bubble) {
      ctx.save();
      ctx.fillStyle = 'rgba(255,255,255,.92)';
      ctx.beginPath(); ctx.ellipse(cx, bodyY - 14, 9, 7.5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.moveTo(cx - 3, bodyY - 8); ctx.lineTo(cx + 2, bodyY - 8); ctx.lineTo(cx, bodyY - 4); ctx.closePath(); ctx.fill();
      ctx.font = '10px system-ui, sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(p.bubble, cx, bodyY - 14);
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

  /* night tint plus warm pools of light around torches and huts */
  drawLighting(ctx, light, t) {
    const dark = 1 - light;
    if (dark < 0.04) return;
    ctx.save();
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.fillStyle = 'rgba(26,34,72,' + (dark * 0.50).toFixed(3) + ')';
    ctx.fillRect(0, 0, this.W, this.H);

    ctx.globalCompositeOperation = 'lighter';
    const lights = [];
    for (const b of park.buildings.values()) {
      if (b.item.light) lights.push([b.x + 0.5, b.y + 0.5, 100, 0.75]);
      else if (b.item.cat === 'stall' && b.worker) lights.push([b.x + b.w / 2, b.y + b.h / 2, 78, 0.5]);
      else if (b.item.cat === 'ride' && b.powered && b.open) lights.push([b.x + b.w / 2, b.y + b.h / 2, 95, 0.45]);
    }
    lights.push([park.gate.x + 0.5, park.gate.y + 0.5, 88, 0.55]);
    for (const L of lights) {
      const [sx, sy] = this.worldToScreen(isoX(L[0], L[1]), isoY(L[0], L[1]));
      const r = L[2] * view.zoom * (0.95 + Math.sin(t * 2.5 + L[0]) * 0.05);
      if (sx < -r || sy < -r || sx > this.W + r || sy > this.H + r) continue;
      const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, r);
      g.addColorStop(0, 'rgba(255,190,110,' + (L[3] * dark).toFixed(3) + ')');
      g.addColorStop(1, 'rgba(255,170,90,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(sx, sy, r, 0, Math.PI * 2); ctx.fill();
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
      ctx.fillStyle = g === GROUND.WATER ? '#2f7fb5' : g === GROUND.SAND ? '#d9c48a' : g === GROUND.STONE ? '#b9bcc4' : '#b39a6c';
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
