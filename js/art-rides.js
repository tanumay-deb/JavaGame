/* Isometric artwork for the rides: static structure (ART) + moving parts (ANIM).
   Everything is drawn with canvas primitives — no bitmaps, no borrowed assets. */

const SAND = '#cbb184', SAND_E = '#a58f66';
const WOOD = '#8a5a33', WOOD_D = '#63401f', WOOD_L = '#a8763f';

/* ---------------------------------------------------------------- helpers */

/* a horizontal beam between two points with a lit top edge */
function beam(ctx, x1, y1, x2, y2, w, col) {
  ctx.strokeStyle = shade(col, -0.25); ctx.lineWidth = w;
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  ctx.strokeStyle = shade(col, 0.15); ctx.lineWidth = Math.max(1, w * 0.35);
  ctx.beginPath(); ctx.moveTo(x1, y1 - w * 0.3); ctx.lineTo(x2, y2 - w * 0.3); ctx.stroke();
}

/* closed Catmull-Rom sampling — used for the coaster track */
function spline(pts, samples) {
  const out = [], n = pts.length;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
    for (let s = 0; s < samples; s++) {
      const t = s / samples, t2 = t * t, t3 = t2 * t;
      const f = (a, b, c, d) => 0.5 * ((2 * b) + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1]), f(p0[2], p1[2], p2[2], p3[2])]);
    }
  }
  return out;
}

/* ------------------------------------------------------------------ seesaw */
/* A ride's own clock. It advances only while the ride is actually running, so
   every moving part winds up with the ride and coasts to a stop with it
   instead of turning forever off the time of day. */
const rideT = (b, k) => ((b && b.spin) || 0) * (k || 1);
const rideRun = (b) => (b && b.run !== undefined ? b.run : 1);

ART.seesaw = function (w, h) {
  const g = spriteCtx(w, h, 30), ctx = g.ctx;
  pad(g, SAND, SAND_E);
  const [cx, cy] = g.mid;
  /* a fat log as the fulcrum */
  ctx.fillStyle = WOOD_D;
  roundRect(ctx, cx - 10, cy - 12, 20, 12, 5); ctx.fill();
  ctx.fillStyle = WOOD;
  ctx.beginPath(); ctx.ellipse(cx - 10, cy - 6, 4, 6, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = shade(WOOD, 0.2);
  ctx.beginPath(); ctx.ellipse(cx - 10, cy - 6, 2, 3, 0, 0, Math.PI * 2); ctx.fill();
  blob(ctx, cx, cy + 2, 22, 8, 0.15);
  return g;
};
ANIM.seesaw = function (ctx, sx, sy, g, t, b) {
  const cx = g.mid[0] + sx, cy = g.mid[1] + sy;
  const busy = b.riders && b.riders.length;
  const a = Math.sin(rideT(b, 2.6)) * 0.34 * rideRun(b) + Math.sin(t * 0.7) * 0.03;
  ctx.save(); ctx.translate(cx, cy - 13); ctx.rotate(a);
  beam(ctx, -34, 0, 34, 0, 8, WOOD);
  for (const s of [-1, 1]) {
    ctx.fillStyle = PALETTE.hide;
    roundRect(ctx, s * 32 - 7, -9, 14, 6, 2); ctx.fill();
    ctx.strokeStyle = WOOD_D; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(s * 22, -3); ctx.lineTo(s * 22, -12); ctx.stroke();
  }
  if (busy) {
    drawMiniPerson(ctx, -32, -9, CLOTH_TONES[1], b.riders && b.riders[0]);
    drawMiniPerson(ctx, 32, -9, CLOTH_TONES[3], b.riders && b.riders[1]);
  }
  ctx.restore();
};

/* -------------------------------------------------------------- trampoline */
ART.trampoline = function (w, h) {
  const g = spriteCtx(w, h, 34), ctx = g.ctx;
  pad(g, SAND, SAND_E);
  const [cx, cy] = g.mid;
  const rx = TILE_W * 0.54, ry = TILE_H * 0.58, H = 15;
  for (const d of [[-0.8, 0], [0.8, 0], [0, -0.8], [0, 0.8]]) {
    const px = cx + d[0] * rx, py = cy + d[1] * ry * 1.6;
    ctx.strokeStyle = WOOD_D; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px, py - H); ctx.stroke();
  }
  /* bone frame */
  ctx.fillStyle = PALETTE.boneDark;
  ctx.beginPath(); ctx.ellipse(cx, cy - H, rx + 4, ry + 3, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = PALETTE.bone;
  ctx.beginPath(); ctx.ellipse(cx, cy - H - 1.5, rx + 4, ry + 3, 0, 0, Math.PI * 2); ctx.fill();
  /* springs */
  ctx.strokeStyle = '#8d949c'; ctx.lineWidth = 1.4;
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * (rx + 2), cy - H - 1 + Math.sin(a) * (ry + 1.5));
    ctx.lineTo(cx + Math.cos(a) * (rx - 5), cy - H - 1 + Math.sin(a) * (ry - 4));
    ctx.stroke();
  }
  /* mat */
  ctx.fillStyle = '#2f3c46';
  ctx.beginPath(); ctx.ellipse(cx, cy - H - 1, rx - 5, ry - 4, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.10)';
  ctx.beginPath(); ctx.ellipse(cx - 6, cy - H - 5, rx * 0.4, ry * 0.32, -0.3, 0, Math.PI * 2); ctx.fill();
  return g;
};
ANIM.trampoline = function (ctx, sx, sy, g, t, b) {
  if (!b.riders || !b.riders.length) return;
  const cx = g.mid[0] + sx, cy = g.mid[1] + sy;
  for (let i = 0; i < Math.min(3, b.riders.length); i++) {
    const hop = Math.abs(Math.sin(rideT(b, 4.2) + i * 2.1)) * 24 * rideRun(b);
    blob(ctx, cx + (i - 1) * 14, cy - 15, 6 - hop * 0.08, 3, 0.2);
    drawMiniPerson(ctx, cx + (i - 1) * 14, cy - 16 - hop, CLOTH_TONES[i % CLOTH_TONES.length], b.riders && b.riders[i]);
  }
};

/* ------------------------------------------------------------------- swing */
ART.swing = function (w, h) {
  const g = spriteCtx(w, h, 58), ctx = g.ctx;
  pad(g, SAND, SAND_E);
  const [cx, cy] = g.mid;
  const H = 44;
  for (const s of [-1, 1]) {
    const foot = g.C((w - 1) / 2 + s * 0.62, (h - 1) / 2 + s * 0.62);
    const foot2 = g.C((w - 1) / 2 + s * 0.62, (h - 1) / 2 - s * 0.62);
    beam(ctx, foot[0], foot[1], cx + s * 5, cy - H, 5, WOOD);
    beam(ctx, foot2[0], foot2[1], cx + s * 5, cy - H, 5, WOOD);
    ctx.strokeStyle = WOOD_D; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo((foot[0] + cx) / 2, (foot[1] + cy - H) / 2); ctx.lineTo((foot2[0] + cx) / 2, (foot2[1] + cy - H) / 2); ctx.stroke();
  }
  beam(ctx, cx - 26, cy - H, cx + 26, cy - H, 7, WOOD_L);
  /* a little hide pennant on top */
  ctx.fillStyle = '#c94f4f';
  ctx.beginPath(); ctx.moveTo(cx, cy - H - 4); ctx.lineTo(cx + 13, cy - H - 10); ctx.lineTo(cx, cy - H - 15); ctx.closePath(); ctx.fill();
  return g;
};
ANIM.swing = function (ctx, sx, sy, g, t, b) {
  const cx = g.mid[0] + sx, cy = g.mid[1] + sy;
  const run = b.riders && b.riders.length ? 1 : 0.18;
  for (let i = 0; i < 2; i++) {
    const ax = cx - 14 + i * 28, ay = cy - 43;
    const a = Math.sin(rideT(b, 2.4) + i * Math.PI) * 0.5 * run;
    const len = 28;
    const ex = ax + Math.sin(a) * len, ey = ay + Math.cos(a) * len;
    ctx.strokeStyle = '#6d5b45'; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(ax - 4, ay); ctx.lineTo(ex - 4, ey); ctx.moveTo(ax + 4, ay); ctx.lineTo(ex + 4, ey); ctx.stroke();
    ctx.fillStyle = WOOD;
    roundRect(ctx, ex - 8, ey, 16, 4.5, 2); ctx.fill();
    if (b.riders && b.riders.length > i) drawMiniPerson(ctx, ex, ey - 1, CLOTH_TONES[(i + 2) % 7], b.riders[i]);
  }
};

/* -------------------------------------------------------------- stone slide */
ART.slide = function (w, h, rot) {
  const g = spriteCtx(w, h, 78), ctx = g.ctx;
  pad(g, SAND, SAND_E);
  const top = g.C(0.5, (h - 1) / 2), bot = g.C(w - 0.7, (h - 1) / 2);
  const H = 52;

  /* A hewn rock stack rather than a smooth grey tower: each slab is a rough
     polygon with its own lean, so the silhouette reads as quarried stone. */
  const slab = (x, y, rw, rh, hh, seed) => {
    const j = (n) => (hash2(seed, n) - 0.5) * 4;
    const pts = [
      [x - rw + j(1), y + j(2)], [x + j(3), y - rh + j(4)],
      [x + rw + j(5), y + j(6)], [x + j(7), y + rh + j(8)]
    ];
    ctx.fillStyle = shade(PALETTE.rockDark, -0.34);          /* the side in shade */
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    ctx.lineTo(pts[3][0], pts[3][1]);
    ctx.lineTo(pts[2][0], pts[2][1]);
    ctx.lineTo(pts[2][0], pts[2][1] + hh);
    ctx.lineTo(pts[3][0], pts[3][1] + hh);
    ctx.lineTo(pts[0][0], pts[0][1] + hh);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = PALETTE.rock;                            /* the lit face */
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    ctx.lineTo(pts[3][0], pts[3][1]);
    ctx.lineTo(pts[3][0], pts[3][1] + hh);
    ctx.lineTo(pts[0][0], pts[0][1] + hh);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = mixColor(PALETTE.rock, '#eef1f4', 0.45); /* the top */
    ctx.beginPath();
    for (let i = 0; i < 4; i++) ctx[i ? 'lineTo' : 'moveTo'](pts[i][0], pts[i][1]);
    ctx.closePath(); ctx.fill();
    /* a couple of chisel marks, so it is not a flat colour */
    ctx.strokeStyle = 'rgba(0,0,0,.13)'; ctx.lineWidth = 1;
    for (let i = 0; i < 2; i++) {
      const u = 0.3 + i * 0.35;
      ctx.beginPath();
      ctx.moveTo(x - rw * 0.7, y + hh * u + 2); ctx.lineTo(x + rw * 0.2, y + hh * u + rh * 0.5);
      ctx.stroke();
    }
  };
  /* the stair goes in first so the tower stands in front of it */
  /* a timber stair lashed up the back */
  for (let i = 0; i < 6; i++) {
    const sx0 = top[0] - 34 + i * 3, sy0 = top[1] - 2 - i * 8.6;
    ctx.fillStyle = shade(WOOD, -0.2);
    ctx.beginPath();
    ctx.moveTo(sx0, sy0); ctx.lineTo(sx0 + 15, sy0 + 7);
    ctx.lineTo(sx0 + 15, sy0 + 3); ctx.lineTo(sx0, sy0 - 4);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = WOOD_L;
    ctx.beginPath();
    ctx.moveTo(sx0, sy0 - 4); ctx.lineTo(sx0 + 15, sy0 + 3);
    ctx.lineTo(sx0 + 15, sy0 + 1); ctx.lineTo(sx0, sy0 - 6);
    ctx.closePath(); ctx.fill();
  }
  /* the tower itself, stacked from the ground up so each slab sits on the last */
  for (let i = 0; i <= 3; i++)
    slab(top[0], top[1] - i * 12, TILE_W * (0.46 - i * 0.035), TILE_H * (0.46 - i * 0.035), 14, i + 1);

  /* the chute: a worn stone trough with raised lips and a polished centre */
  const ax = top[0] + 8, ay = top[1] - H - 6, bx = bot[0] + 4, by = bot[1] - 4;
  ctx.fillStyle = shade(PALETTE.rockDark, -0.1);
  ctx.beginPath();
  ctx.moveTo(ax - 10, ay); ctx.lineTo(ax + 11, ay + 6); ctx.lineTo(bx + 13, by + 2); ctx.lineTo(bx - 10, by - 6);
  ctx.closePath(); ctx.fill();
  const gr = ctx.createLinearGradient(ax, ay, bx, by);
  gr.addColorStop(0, mixColor(PALETTE.rock, '#f2f4f6', 0.4));
  gr.addColorStop(0.5, mixColor(PALETTE.rock, '#e0e4e8', 0.2));
  gr.addColorStop(1, PALETTE.rock);
  ctx.fillStyle = gr;
  ctx.beginPath();
  ctx.moveTo(ax - 6, ay + 1); ctx.lineTo(ax + 6, ay + 4); ctx.lineTo(bx + 8, by - 1); ctx.lineTo(bx - 7, by - 5);
  ctx.closePath(); ctx.fill();
  /* the polish down the middle where everyone slides */
  ctx.fillStyle = 'rgba(255,255,255,.3)';
  ctx.beginPath();
  ctx.moveTo(ax - 2, ay + 2); ctx.lineTo(ax + 2, ay + 3); ctx.lineTo(bx + 3, by - 2); ctx.lineTo(bx - 2, by - 3.5);
  ctx.closePath(); ctx.fill();
  /* raised lips */
  ctx.strokeStyle = shade(PALETTE.rockDark, -0.28); ctx.lineWidth = 2.6;
  ctx.beginPath(); ctx.moveTo(ax - 8, ay); ctx.lineTo(bx - 9, by - 5); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(ax + 10, ay + 5); ctx.lineTo(bx + 11, by + 1); ctx.stroke();

  /* landing pit, raked sand with a few pebbles */
  ctx.fillStyle = shade(SAND, 0.18);
  ctx.beginPath(); ctx.ellipse(bx + 9, by + 7, 22, 11, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = shade(SAND, -0.12);
  for (let i = 0; i < 7; i++) {
    const a2 = hash2(i * 5 + 1, 9) * 6.28, r2 = 5 + hash2(i, 3) * 14;
    ctx.beginPath();
    ctx.ellipse(bx + 9 + Math.cos(a2) * r2, by + 7 + Math.sin(a2) * r2 * 0.5, 1.6, 1, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  g.slideA = [ax, ay - 2]; g.slideB = [bx + 6, by];
  return g;
};
ANIM.slide = function (ctx, sx, sy, g, t, b) {
  const n = b.riders ? b.riders.length : 0;
  if (!n) return;
  /* the whole car goes down one after another, not just one rider forever */
  for (let i = 0; i < Math.min(3, n); i++) {
    const p = (rideT(b, 0.62) - i * 0.26) % 1;
    if (p < 0 || p > 1) continue;
    const x = lerp(g.slideA[0], g.slideB[0], p) + sx;
    const y = lerp(g.slideA[1], g.slideB[1], p) + sy;
    drawMiniPerson(ctx, x, y, '#e0c04a', b.riders[i]);
    if (p > 0.88) {
      ctx.fillStyle = 'rgba(214,198,160,.6)';
      for (let k = 0; k < 4; k++)
        ctx.fillRect(x + Math.sin(t * 11 + k) * 9, y + 1 + (k % 3), 2.2, 2.2);
    }
  }
};

/* ---------------------------------------------------------- throwing range */
ART.range = function (w, h) {
  const g = spriteCtx(w, h, 56), ctx = g.ctx;
  pad(g, SAND, SAND_E);

  /* a stop-net of hide behind the targets, so stray rocks do not fly off */
  const f1 = g.C(w - 0.3, -0.4), f2 = g.C(w - 0.3, h - 0.6);
  ctx.strokeStyle = WOOD_D; ctx.lineWidth = 3.5;
  for (let i = 0; i <= 5; i++) {
    const x = lerp(f1[0], f2[0], i / 5), y = lerp(f1[1], f2[1], i / 5);
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - 30); ctx.stroke();
  }
  ctx.fillStyle = 'rgba(122,98,66,.55)';
  ctx.beginPath();
  ctx.moveTo(f1[0], f1[1] - 28); ctx.lineTo(f2[0], f2[1] - 28);
  ctx.lineTo(f2[0], f2[1] - 6); ctx.lineTo(f1[0], f1[1] - 6);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(70,56,36,.5)'; ctx.lineWidth = 1;
  for (let i = 1; i < 8; i++) {
    const u = i / 8;
    ctx.beginPath();
    ctx.moveTo(lerp(f1[0], f2[0], u), lerp(f1[1], f2[1], u) - 28);
    ctx.lineTo(lerp(f1[0], f2[0], u), lerp(f1[1], f2[1], u) - 6);
    ctx.stroke();
  }
  beam(ctx, f1[0], f1[1] - 28, f2[0], f2[1] - 28, 4.5, WOOD);

  /* three painted targets on straw bales, each with a skull on top */
  for (let i = 0; i < 3; i++) {
    const ty = i * (h - 1) / 2;
    const [x, y] = g.C(w - 0.78, ty);
    ctx.fillStyle = 'rgba(0,0,0,.2)';
    ctx.beginPath(); ctx.ellipse(x, y + 2, 13, 5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = PALETTE.thatch;
    roundRect(ctx, x - 12, y - 13, 24, 13, 4); ctx.fill();
    ctx.fillStyle = shade(PALETTE.thatch, 0.14);
    roundRect(ctx, x - 12, y - 13, 24, 3.5, 2); ctx.fill();
    ctx.strokeStyle = PALETTE.thatchDark; ctx.lineWidth = 1;
    for (let sgn = -1; sgn <= 1; sgn++) {
      ctx.beginPath(); ctx.moveTo(x + sgn * 6, y - 12); ctx.lineTo(x + sgn * 6, y - 1); ctx.stroke();
    }
    /* the painted rings that make it a target rather than a bale */
    const ry = y - 6.5;
    for (const [r, col] of [[8.5, '#e8ddc2'], [6, '#c4453a'], [3.4, '#e8ddc2'], [1.6, '#c4453a']]) {
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.ellipse(x, ry, r, r * 0.62, 0, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = WOOD_D; ctx.fillRect(x - 1.6, y - 26, 3.2, 13);
    skull(ctx, x, y - 31, 7.5);
  }

  /* the throwing booth: a counter under a hide canopy, with rocks to hand */
  const bk = g.C(0.55, (h - 1) / 2);
  ctx.strokeStyle = WOOD_D; ctx.lineWidth = 3;
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(bk[0] - 4, bk[1] + s * 13); ctx.lineTo(bk[0] - 4, bk[1] + s * 13 - 26);
    ctx.stroke();
  }
  ctx.fillStyle = '#c4453a';
  ctx.beginPath();
  ctx.moveTo(bk[0] - 12, bk[1] - 34); ctx.lineTo(bk[0] + 8, bk[1] - 30);
  ctx.lineTo(bk[0] + 8, bk[1] - 24); ctx.lineTo(bk[0] - 12, bk[1] - 28);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#e8ddc2';
  ctx.beginPath();
  ctx.moveTo(bk[0] - 12, bk[1] - 28); ctx.lineTo(bk[0] + 8, bk[1] - 24);
  ctx.lineTo(bk[0] + 8, bk[1] - 21); ctx.lineTo(bk[0] - 12, bk[1] - 25);
  ctx.closePath(); ctx.fill();
  /* counter */
  ctx.fillStyle = shade(WOOD, -0.3);
  roundRect(ctx, bk[0] - 12, bk[1] - 8, 20, 9, 2); ctx.fill();
  ctx.fillStyle = WOOD_L;
  roundRect(ctx, bk[0] - 13, bk[1] - 13, 22, 6, 2); ctx.fill();
  /* a basket of throwing rocks on the counter */
  ctx.fillStyle = '#9b7b45';
  roundRect(ctx, bk[0] - 9, bk[1] - 19, 14, 7, 3); ctx.fill();
  ctx.fillStyle = PALETTE.rockDark;
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.arc(bk[0] - 6 + i * 3.4, bk[1] - 20 - (i % 2) * 1.6, 2.6, 0, Math.PI * 2);
    ctx.fill();
  }
  /* the line they throw from */
  const a = g.C(0.95, -0.2), c = g.C(0.95, h - 0.8);
  ctx.strokeStyle = 'rgba(255,255,255,.4)'; ctx.setLineDash([5, 4]); ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(c[0], c[1]); ctx.stroke(); ctx.setLineDash([]);

  g.throwFrom = [bk[0] + 4, bk[1] - 20]; g.throwTo = g.C(w - 0.78, (h - 1) / 2);
  return g;
};
ANIM.range = function (ctx, sx, sy, g, t, b) {
  if (!b.riders || !b.riders.length) return;
  const p = rideT(b, 1.25) % 1;
  const x = lerp(g.throwFrom[0], g.throwTo[0], p) + sx;
  const y = lerp(g.throwFrom[1], g.throwTo[1] - 28, p) - Math.sin(p * Math.PI) * 16 + sy;
  ctx.fillStyle = PALETTE.rockDark;
  ctx.beginPath(); ctx.arc(x, y, 3.2, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.3)';
  ctx.beginPath(); ctx.arc(x - 1, y - 1, 1.2, 0, Math.PI * 2); ctx.fill();
};

/* ---------------------------------------------------------------- carousel */
ART.carousel = function (w, h) {
  const g = spriteCtx(w, h, 80), ctx = g.ctx;
  pad(g, SAND, SAND_E);
  const [cx, cy] = g.mid;
  const rx = TILE_W * 0.95, ry = TILE_H * 0.95;
  /* plinth */
  ctx.fillStyle = shade(WOOD_D, -0.15);
  ctx.beginPath(); ctx.ellipse(cx, cy + 4, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#a8865a';
  ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
  /* radial planks */
  ctx.strokeStyle = 'rgba(0,0,0,.15)'; ctx.lineWidth = 1.2;
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a) * rx, cy + Math.sin(a) * ry); ctx.stroke();
  }
  ctx.fillStyle = '#c2a173';
  ctx.beginPath(); ctx.ellipse(cx, cy, rx * 0.34, ry * 0.34, 0, 0, Math.PI * 2); ctx.fill();
  /* painted rim */
  ctx.strokeStyle = '#c44a3f'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.ellipse(cx, cy, rx - 2, ry - 1.5, 0, 0, Math.PI * 2); ctx.stroke();
  /* centre pole */
  ctx.fillStyle = WOOD_D; ctx.fillRect(cx - 4.5, cy - 62, 9, 62);
  ctx.fillStyle = shade(WOOD, 0.2); ctx.fillRect(cx - 4.5, cy - 62, 3, 62);
  return g;
};
ANIM.carousel = function (ctx, sx, sy, g, t, b) {
  const cx = g.mid[0] + sx, cy = g.mid[1] + sy;
  const spin = rideT(b, 0.95);
  const R = TILE_W * 0.66, RY = TILE_H * 0.66, n = 6;
  const mounts = [];
  for (let i = 0; i < n; i++) {
    const a = spin + (i / n) * Math.PI * 2;
    mounts.push({ a, x: cx + Math.cos(a) * R, y: cy + Math.sin(a) * RY, i });
  }
  mounts.sort((p, q) => p.y - q.y);
  for (const m of mounts) {
    const bob = Math.sin(spin * 3 + m.i) * 5;
    ctx.strokeStyle = '#d8c98a'; ctx.lineWidth = 2.2;
    ctx.beginPath(); ctx.moveTo(m.x, m.y - 56); ctx.lineTo(m.x, m.y - 4 + bob); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 0.9;
    ctx.beginPath(); ctx.moveTo(m.x - 0.8, m.y - 56); ctx.lineTo(m.x - 0.8, m.y - 4 + bob); ctx.stroke();
    blob(ctx, m.x, m.y + 2, 8, 3.5, 0.14);
    drawDinoMount(ctx, m.x, m.y + bob, CLOTH_TONES[m.i % 7]);
  }
  canopy(ctx, cx, cy - 62, TILE_W * 0.92, TILE_H * 0.92, 20, '#c44a3f', '#f0dcae');
  ctx.strokeStyle = '#e8d24a'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(cx, cy - 82); ctx.lineTo(cx, cy - 62); ctx.stroke();
  ctx.fillStyle = '#e8d24a';
  ctx.beginPath(); ctx.arc(cx, cy - 84, 4, 0, Math.PI * 2); ctx.fill();
  /* bunting round the rim */
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 + spin * 0.2;
    const bx = cx + Math.cos(a) * TILE_W * 0.9, by = cy - 60 + Math.sin(a) * TILE_H * 0.9;
    ctx.fillStyle = i % 2 ? '#f0dcae' : '#c44a3f';
    ctx.beginPath(); ctx.moveTo(bx - 3, by); ctx.lineTo(bx + 3, by); ctx.lineTo(bx, by + 6); ctx.closePath(); ctx.fill();
  }
};

/* ---------------------------------------------------------------- catapult */
ART.catapult = function (w, h) {
  const g = spriteCtx(w, h, 66), ctx = g.ctx;
  pad(g, SAND, SAND_E);
  const [cx, cy] = g.mid;

  /* landing mound of straw at the far end, with a worn hollow where they land */
  const land = g.C(w - 0.6, (h - 1) / 2);
  ctx.fillStyle = shade(SAND, -0.16);
  ctx.beginPath(); ctx.ellipse(land[0], land[1] + 2, 24, 12, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = PALETTE.thatch;
  ctx.beginPath(); ctx.ellipse(land[0], land[1] - 2, 21, 11, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = shade(PALETTE.thatch, 0.16);
  ctx.beginPath(); ctx.ellipse(land[0] - 4, land[1] - 5, 12, 5, -0.2, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = PALETTE.thatchDark; ctx.lineWidth = 1;
  for (let i = -3; i <= 3; i++) {
    ctx.beginPath();
    ctx.moveTo(land[0] + i * 6, land[1] - 8); ctx.lineTo(land[0] + i * 5.2, land[1] + 6);
    ctx.stroke();
  }

  /* a heavy sledge the whole engine is lashed to, pegged into the ground */
  const base = g.C(0.95, (h - 1) / 2);
  ctx.fillStyle = 'rgba(0,0,0,.2)';
  ctx.beginPath(); ctx.ellipse(base[0], base[1] + 6, 30, 13, 0, 0, Math.PI * 2); ctx.fill();
  isoBox(ctx, base[0], base[1], TILE_W * 0.92, TILE_H * 0.92, 11, WOOD_L, WOOD_D, WOOD);
  ctx.fillStyle = PALETTE.boneDark;
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(base[0] + s * 27, base[1] + 2); ctx.lineTo(base[0] + s * 31, base[1] + 9);
    ctx.lineTo(base[0] + s * 28, base[1] + 10); ctx.lineTo(base[0] + s * 24, base[1] + 3);
    ctx.closePath(); ctx.fill();
  }

  /* two uprights carrying the axle, braced back to the sledge */
  for (const s of [-1, 1]) {
    beam(ctx, base[0] + s * 15, base[1] - 7, base[0] + s * 4, base[1] - 36, 7, WOOD);
    beam(ctx, base[0] + s * 24, base[1] - 2, base[0] + s * 9, base[1] - 24, 4, shade(WOOD, -0.12));
  }
  /* the axle beam across the top */
  beam(ctx, base[0] - 6, base[1] - 36, base[0] + 6, base[1] - 36, 6, WOOD_L);

  /* the twisted rope skein that actually throws the arm */
  ctx.save();
  ctx.translate(base[0], base[1] - 36);
  ctx.fillStyle = '#a89468';
  ctx.beginPath(); ctx.ellipse(0, 0, 9, 7, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#7d6a45'; ctx.lineWidth = 1.5;
  for (let i = -2; i <= 2; i++) {
    ctx.beginPath();
    ctx.moveTo(-8, i * 2.6); ctx.quadraticCurveTo(0, i * 2.6 - 2.5, 8, i * 2.6);
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(255,255,255,.18)';
  ctx.beginPath(); ctx.ellipse(-3, -3, 4, 2.4, -0.3, 0, Math.PI * 2); ctx.fill();
  ctx.restore();

  /* a stop beam the arm slams into */
  beam(ctx, base[0] + 16, base[1] - 26, base[0] + 30, base[1] - 22, 5, WOOD_D);

  g.pivot = [base[0], base[1] - 36];
  return g;
};
ANIM.catapult = function (ctx, sx, sy, g, t, b) {
  const px = g.pivot[0] + sx, py = g.pivot[1] + sy;
  const run = b.powered && b.open && b.riders && b.riders.length;
  const ph = rideT(b, 0.68) % 1;
  const a = run ? (ph < 0.3 ? lerp(0.95, -1.15, ph / 0.3) : lerp(-1.15, 0.95, (ph - 0.3) / 0.7)) : 0.95;
  ctx.save(); ctx.translate(px, py); ctx.rotate(a);
  beam(ctx, -18, 0, 30, 0, 6, WOOD_L);
  ctx.fillStyle = PALETTE.hide;
  ctx.beginPath(); ctx.ellipse(32, 0, 8, 6, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#7d6a4a'; ctx.lineWidth = 1.4;
  ctx.beginPath(); ctx.moveTo(26, -4); ctx.lineTo(32, -6); ctx.moveTo(26, 4); ctx.lineTo(32, 6); ctx.stroke();
  ctx.fillStyle = PALETTE.rockDark;
  ctx.beginPath(); ctx.arc(-20, 0, 8, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = shade(PALETTE.rockDark, 0.2);
  ctx.beginPath(); ctx.arc(-22, -2, 3, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  if (run && ph > 0.3 && ph < 0.8) {
    const f = (ph - 0.3) / 0.5;
    drawMiniPerson(ctx, px + 22 + f * 62, py - 16 - Math.sin(f * Math.PI) * 44, '#d6604a', b.riders && b.riders[0]);
  }
};

/* ------------------------------------------------------------ ferris wheel */
ART.ferris = function (w, h) {
  const g = spriteCtx(w, h, 120), ctx = g.ctx;
  pad(g, SAND, SAND_E);
  const [cx, cy] = g.mid;
  const R = 46, hubY = cy - R - 14;
  g.hub = [cx, hubY]; g.R = R;
  /* four legs from the corners of the pad up to the hub */
  const corners = [[-0.95, -0.95], [0.95, -0.95], [-0.95, 0.95], [0.95, 0.95]];
  for (const c of corners) {
    const p = g.C((w - 1) / 2 + c[0], (h - 1) / 2 + c[1]);
    beam(ctx, p[0], p[1], cx, hubY, 5.5, WOOD);
  }
  /* cross bracing */
  ctx.strokeStyle = WOOD_D; ctx.lineWidth = 3;
  for (const c of corners) {
    const p = g.C((w - 1) / 2 + c[0], (h - 1) / 2 + c[1]);
    ctx.beginPath();
    ctx.moveTo(lerp(p[0], cx, 0.45), lerp(p[1], hubY, 0.45));
    ctx.lineTo(lerp(p[0], cx, 0.75), lerp(p[1], hubY, 0.75));
    ctx.stroke();
  }
  ctx.strokeStyle = WOOD_D; ctx.lineWidth = 3.5;
  const l = g.C((w - 1) / 2 - 0.95, (h - 1) / 2 + 0.95), r = g.C((w - 1) / 2 + 0.95, (h - 1) / 2 - 0.95);
  ctx.beginPath(); ctx.moveTo(lerp(l[0], cx, .5), lerp(l[1], hubY, .5)); ctx.lineTo(lerp(r[0], cx, .5), lerp(r[1], hubY, .5)); ctx.stroke();
  /* ticket booth at the foot */
  const bo = g.C(0.2, h - 0.5);
  isoBox(ctx, bo[0], bo[1], TILE_W * 0.42, TILE_H * 0.42, 14, WOOD_L, WOOD_D, WOOD);
  thatchRoof(ctx, bo[0], bo[1] - 14, 14, 5, 9, PALETTE.thatch);
  return g;
};
ANIM.ferris = function (ctx, sx, sy, g, t, b) {
  const hx = g.hub[0] + sx, hy = g.hub[1] + sy, R = g.R;
  const spin = rideT(b, 0.48);
  ctx.strokeStyle = '#caa96a'; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.arc(hx, hy, R, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = '#8a6a44'; ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.arc(hx, hy, R - 5, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = 'rgba(225,205,155,.75)'; ctx.lineWidth = 1.8;
  for (let i = 0; i < 8; i++) {
    const a = spin + (i / 8) * Math.PI * 2;
    ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(hx + Math.cos(a) * R, hy + Math.sin(a) * R); ctx.stroke();
  }
  ctx.fillStyle = WOOD_D;
  ctx.beginPath(); ctx.arc(hx, hy, 7, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = shade(WOOD, 0.25);
  ctx.beginPath(); ctx.arc(hx - 1.5, hy - 1.5, 3, 0, Math.PI * 2); ctx.fill();
  for (let i = 0; i < 8; i++) {
    const a = spin + (i / 8) * Math.PI * 2;
    const gx = hx + Math.cos(a) * R, gy = hy + Math.sin(a) * R;
    ctx.strokeStyle = '#8c7b5c'; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(gx, gy); ctx.lineTo(gx, gy + 6); ctx.stroke();
    const col = CLOTH_TONES[i % CLOTH_TONES.length];
    ctx.fillStyle = shade(col, -0.35);
    roundRect(ctx, gx - 8, gy + 11, 16, 5, 2); ctx.fill();
    ctx.fillStyle = col;
    roundRect(ctx, gx - 8, gy + 5, 16, 9, 3); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.22)';
    ctx.fillRect(gx - 8, gy + 5, 16, 2);
    if (b.riders && b.riders.length > i) {
      ctx.fillStyle = SKIN_TONES[i % SKIN_TONES.length];
      ctx.beginPath(); ctx.arc(gx, gy + 5, 2.6, 0, Math.PI * 2); ctx.fill();
    }
  }
};

/* ------------------------------------------------------------ haunted cave */
ART.cave = function (w, h, rot) {
  const g = spriteCtx(w, h, 86), ctx = g.ctx;
  pad(g, '#7c705c', '#5d5243');
  const [cx, cy] = g.mid;
  const front = g.C((w - 1) / 2, h - 0.6);
  /* the mound, built from faceted planes so it reads as rock */
  const facets = [
    { p: [[-1.15, 0.15], [-0.7, -0.75], [0.05, -0.95], [0.1, 0.2]], c: '#7f858c' },
    { p: [[0.1, 0.2], [0.05, -0.95], [0.75, -0.7], [1.15, 0.15]], c: '#666c74' },
    { p: [[-0.7, -0.75], [-0.2, -1.15], [0.35, -1.1], [0.05, -0.95]], c: '#949aa1' },
    { p: [[0.05, -0.95], [0.35, -1.1], [0.75, -0.7]], c: '#7a8087' }
  ];
  for (const f of facets) {
    ctx.fillStyle = f.c;
    ctx.beginPath();
    f.p.forEach((q, i) => {
      const x = cx + q[0] * TILE_W * 1.05, y = cy + 8 + q[1] * 46;
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    });
    ctx.closePath(); ctx.fill();
  }
  /* moss */
  ctx.fillStyle = 'rgba(90,140,70,.45)';
  ctx.beginPath(); ctx.ellipse(cx - 30, cy - 26, 16, 7, -0.3, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(cx + 26, cy - 14, 12, 5, 0.25, 0, Math.PI * 2); ctx.fill();
  /* entrance */
  const ex = front[0], ey = front[1] - 2;
  ctx.fillStyle = '#4a4238';
  ctx.beginPath(); ctx.ellipse(ex, ey - 16, 25, 27, 0, Math.PI, 0); ctx.rect(ex - 25, ey - 16, 50, 16); ctx.fill();
  const gr = ctx.createRadialGradient(ex, ey - 12, 2, ex, ey - 12, 30);
  gr.addColorStop(0, '#000'); gr.addColorStop(1, '#241f1a');
  ctx.fillStyle = gr;
  ctx.beginPath(); ctx.ellipse(ex, ey - 14, 20, 22, 0, Math.PI, 0); ctx.rect(ex - 20, ey - 14, 40, 14); ctx.fill();
  /* stalactite teeth */
  ctx.fillStyle = PALETTE.bone;
  for (let i = -3; i <= 3; i++) {
    const tx = ex + i * 6.5, hgt = 7 + (i % 2 ? 4 : 0);
    ctx.beginPath(); ctx.moveTo(tx - 3.2, ey - 30); ctx.lineTo(tx + 3.2, ey - 30); ctx.lineTo(tx, ey - 30 + hgt); ctx.closePath(); ctx.fill();
  }
  /* rib arch */
  ctx.strokeStyle = PALETTE.boneDark; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.ellipse(ex, ey - 14, 27, 26, 0, Math.PI * 1.05, Math.PI * 1.95); ctx.stroke();
  /* boulders at the feet */
  for (const bx of [-1.4, 1.4]) {
    const px = cx + bx * TILE_W * 0.9, py = cy + 10;
    ctx.fillStyle = PALETTE.rock;
    ctx.beginPath(); ctx.ellipse(px, py, 13, 8, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = shade(PALETTE.rock, 0.16);
    ctx.beginPath(); ctx.ellipse(px - 2, py - 3, 7, 4, 0, 0, Math.PI * 2); ctx.fill();
  }
  /* torches */
  g.torches = [[ex - 34, ey - 4], [ex + 34, ey - 4]];
  for (const tp of g.torches) {
    ctx.fillStyle = WOOD_D; ctx.fillRect(tp[0] - 2.5, tp[1] - 26, 5, 26);
    ctx.fillStyle = PALETTE.rockDark;
    ctx.beginPath(); ctx.ellipse(tp[0], tp[1], 6, 3, 0, 0, Math.PI * 2); ctx.fill();
  }
  g.mouth = [ex, ey - 12];
  return g;
};
ANIM.cave = function (ctx, sx, sy, g, t, b) {
  for (const tp of g.torches) drawFlame(ctx, tp[0] + sx, tp[1] - 26 + sy, t);
  const lit = b.powered && b.open;
  if (lit) {
    const glow = 0.25 + Math.sin(t * 3) * 0.12;
    ctx.save();
    ctx.globalAlpha = glow;
    ctx.fillStyle = '#ff7043';
    ctx.beginPath(); ctx.ellipse(g.mouth[0] + sx, g.mouth[1] + sy, 15, 17, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    if (b.riders && b.riders.length) {
      /* a pair of eyes blinks in the dark */
      const blink = Math.sin(t * 1.7) > 0.7;
      if (!blink) {
        ctx.fillStyle = '#ffe066';
        ctx.beginPath();
        ctx.arc(g.mouth[0] + sx - 5, g.mouth[1] + sy - 4, 2, 0, Math.PI * 2);
        ctx.arc(g.mouth[0] + sx + 5, g.mouth[1] + sy - 4, 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
};

/* ------------------------------------------------------------- drop tower */
ART.tower = function (w, h) {
  const g = spriteCtx(w, h, 170), ctx = g.ctx;
  pad(g, SAND, SAND_E);
  const [cx, cy] = g.mid;
  const H = 124;

  /* a stone footing wide enough to look like it holds the thing up */
  ctx.fillStyle = 'rgba(0,0,0,.22)';
  ctx.beginPath(); ctx.ellipse(cx, cy + 5, 40, 17, 0, 0, Math.PI * 2); ctx.fill();
  isoBox(ctx, cx, cy, TILE_W * 1.02, TILE_H * 1.02, 11, PALETTE.rock,
    shade(PALETTE.rockDark, -0.14), PALETTE.rockDark);
  isoBox(ctx, cx, cy - 11, TILE_W * 0.74, TILE_H * 0.74, 7,
    mixColor(PALETTE.rock, '#e6eaee', 0.3), shade(PALETTE.rockDark, -0.1), PALETTE.rockDark);

  /* four legs rather than two, so it reads as a mast and not a ladder */
  const legX = (u, s) => cx + s * lerp(23, 7, u);
  const legY = (u) => cy - 16 - u * (H - 16);
  for (const s of [-1, 1]) {
    ctx.strokeStyle = shade(WOOD, -0.22); ctx.lineWidth = 5.5;
    ctx.beginPath();
    ctx.moveTo(legX(0, s) + s * 5, legY(0) + 3); ctx.lineTo(legX(1, s) + s * 2, legY(1));
    ctx.stroke();
    ctx.strokeStyle = WOOD; ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(legX(0, s), legY(0)); ctx.lineTo(legX(1, s), legY(1));
    ctx.stroke();
    ctx.strokeStyle = shade(WOOD, 0.2); ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(legX(0, s) - 1.4, legY(0)); ctx.lineTo(legX(1, s) - 1.4, legY(1));
    ctx.stroke();
  }
  /* lashed cross-bracing, tighter toward the top */
  ctx.strokeStyle = shade(WOOD, -0.14); ctx.lineWidth = 2.4;
  for (let i = 0; i < 11; i++) {
    const u0 = i / 11, u1 = (i + 1) / 11;
    ctx.beginPath();
    ctx.moveTo(legX(u0, -1), legY(u0)); ctx.lineTo(legX(u1, 1), legY(u1));
    ctx.moveTo(legX(u0, 1), legY(u0)); ctx.lineTo(legX(u1, -1), legY(u1));
    ctx.stroke();
    ctx.strokeStyle = shade(WOOD, -0.3); ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(legX(u1, -1), legY(u1)); ctx.lineTo(legX(u1, 1), legY(u1));
    ctx.stroke();
    ctx.strokeStyle = shade(WOOD, -0.14); ctx.lineWidth = 2.4;
  }
  /* bindings where the braces meet the legs */
  ctx.strokeStyle = '#b09a68'; ctx.lineWidth = 1.8;
  for (let i = 1; i < 11; i += 2) {
    const u = i / 11;
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(legX(u, s) - 3, legY(u)); ctx.lineTo(legX(u, s) + 3, legY(u) - 1);
      ctx.stroke();
    }
  }

  /* headframe: a beam across the top with a bone pulley at each end */
  const topY = cy - 16 - (H - 16);
  beam(ctx, cx - 12, topY - 4, cx + 12, topY - 4, 6, WOOD_L);
  for (const s of [-1, 1]) {
    ctx.fillStyle = PALETTE.bone;
    ctx.beginPath(); ctx.arc(cx + s * 10, topY - 4, 4.2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = PALETTE.boneDark;
    ctx.beginPath(); ctx.arc(cx + s * 10, topY - 4, 1.6, 0, Math.PI * 2); ctx.fill();
  }

  /* guy ropes down to pegs */
  ctx.strokeStyle = 'rgba(150,126,86,.75)'; ctx.lineWidth = 1.5;
  for (const s of [-1, 1]) {
    ctx.beginPath(); ctx.moveTo(cx + s * 9, topY + 2); ctx.lineTo(cx + s * 38, cy + 4); ctx.stroke();
    ctx.fillStyle = WOOD_D; ctx.fillRect(cx + s * 38 - 2, cy, 4, 7);
  }

  skull(ctx, cx, topY - 16, 13);
  ctx.fillStyle = '#c94f4f';
  ctx.beginPath();
  ctx.moveTo(cx + 12, topY - 20); ctx.lineTo(cx + 31, topY - 26); ctx.lineTo(cx + 12, topY - 30);
  ctx.closePath(); ctx.fill();

  g.topY = topY + 22; g.botY = cy - 16; g.cx = cx;
  return g;
};
ANIM.tower = function (ctx, sx, sy, g, t, b) {
  const run = b.powered && b.open && b.riders && b.riders.length;
  const ph = rideT(b, 0.36) % 1;
  let f = run ? (ph < 0.72 ? ph / 0.72 : 1 - (ph - 0.72) / 0.28) : 0;
  f = clamp(f, 0, 1);
  const y = lerp(g.botY, g.topY, f) + sy, x = g.cx + sx;
  ctx.strokeStyle = '#6b5a42'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(x, g.topY + sy - 14); ctx.lineTo(x, y); ctx.stroke();
  /* the car: a bench slung under the mast with a bar across the riders' laps */
  ctx.fillStyle = shade('#b5563f', -0.35);
  roundRect(ctx, x - 17, y + 9, 34, 6, 2); ctx.fill();
  if (run) {
    const n = Math.min(3, b.riders.length);
    for (let i = 0; i < n; i++)
      drawMiniPerson(ctx, x - (n - 1) * 5.5 + i * 11, y + 4, CLOTH_TONES[i % 7], b.riders[i]);
  }
  ctx.fillStyle = '#b5563f';
  roundRect(ctx, x - 17, y + 1, 34, 10, 3); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.22)';
  ctx.fillRect(x - 17, y + 1, 34, 2.4);
  ctx.strokeStyle = PALETTE.boneDark; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(x - 15, y - 2); ctx.lineTo(x + 15, y - 2); ctx.stroke();
  for (const s of [-1, 1]) {
    ctx.beginPath(); ctx.moveTo(x + s * 15, y - 2); ctx.lineTo(x + s * 16, y + 4); ctx.stroke();
  }
};

/* ------------------------------------------------------------ water chute */
ART.chute = function (w, h) {
  const g = spriteCtx(w, h, 96), ctx = g.ctx;
  pad(g, '#86906d', '#646c50');
  const top = g.C(w - 0.7, 0.4), bot = g.C(0.8, h - 1.1);
  const H = 66;
  /* splash pool first, it sits behind the flume */
  ctx.fillStyle = shade(PALETTE.water, -0.3);
  ctx.beginPath(); ctx.ellipse(bot[0], bot[1] + 3, 34, 17, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = PALETTE.water;
  ctx.beginPath(); ctx.ellipse(bot[0], bot[1], 32, 15, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,.3)'; ctx.lineWidth = 1.4;
  ctx.beginPath(); ctx.ellipse(bot[0] - 4, bot[1] - 2, 18, 8, 0, 0, Math.PI * 2); ctx.stroke();
  /* rocks around the pool */
  for (const a of [2.4, 3.6, 5.2]) {
    const rx2 = bot[0] + Math.cos(a) * 34, ry2 = bot[1] + Math.sin(a) * 16;
    ctx.fillStyle = PALETTE.rock;
    ctx.beginPath(); ctx.ellipse(rx2, ry2, 8, 5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = shade(PALETTE.rock, 0.18);
    ctx.beginPath(); ctx.ellipse(rx2 - 1, ry2 - 2, 4, 2.4, 0, 0, Math.PI * 2); ctx.fill();
  }
  /* trestle supports under the flume */
  for (let i = 1; i <= 3; i++) {
    const f = i / 4;
    const px = lerp(top[0], bot[0], f), py = lerp(top[1], bot[1], f);
    const hh = lerp(H, 8, f);
    ctx.strokeStyle = WOOD; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(px - 8, py); ctx.lineTo(px - 5, py - hh); ctx.moveTo(px + 8, py); ctx.lineTo(px + 5, py - hh); ctx.stroke();
    ctx.strokeStyle = WOOD_D; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(px - 7, py - hh * 0.45); ctx.lineTo(px + 7, py - hh * 0.45); ctx.stroke();
  }
  /* tower with a ladder */
  isoBox(ctx, top[0], top[1], TILE_W * 0.62, TILE_H * 0.62, H, WOOD_L, WOOD_D, WOOD);
  ctx.strokeStyle = WOOD_D; ctx.lineWidth = 2;
  for (let i = 0; i < 7; i++) {
    const yy = top[1] - 8 - i * 8;
    ctx.beginPath(); ctx.moveTo(top[0] + 12, yy); ctx.lineTo(top[0] + 22, yy - 2); ctx.stroke();
  }
  ctx.strokeStyle = WOOD; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.moveTo(top[0] + 12, top[1]); ctx.lineTo(top[0] + 12, top[1] - H);
  ctx.moveTo(top[0] + 22, top[1] - 2); ctx.lineTo(top[0] + 22, top[1] - H - 2); ctx.stroke();
  /* the flume itself: walls then water */
  const ax = top[0], ay = top[1] - H, bx = bot[0], by = bot[1] - 4;
  ctx.fillStyle = shade(WOOD, -0.25);
  ctx.beginPath();
  ctx.moveTo(ax - 13, ay + 2); ctx.lineTo(ax + 11, ay + 8); ctx.lineTo(bx + 15, by + 6); ctx.lineTo(bx - 11, by - 2);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(86,176,220,.92)';
  ctx.beginPath();
  ctx.moveTo(ax - 9, ay + 3); ctx.lineTo(ax + 7, ay + 7); ctx.lineTo(bx + 11, by + 3); ctx.lineTo(bx - 7, by - 2);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,.45)'; ctx.lineWidth = 1.4;
  ctx.beginPath(); ctx.moveTo(ax - 2, ay + 5); ctx.lineTo(bx + 1, by + 1); ctx.stroke();
  ctx.strokeStyle = WOOD_L; ctx.lineWidth = 2.6;
  ctx.beginPath(); ctx.moveTo(ax - 13, ay + 2); ctx.lineTo(bx - 11, by - 2); ctx.moveTo(ax + 11, ay + 8); ctx.lineTo(bx + 15, by + 6); ctx.stroke();
  g.rideA = [ax - 1, ay + 2]; g.rideB = [bx + 2, by - 2]; g.pool = [bot[0], bot[1]];
  return g;
};
ANIM.chute = function (ctx, sx, sy, g, t, b) {
  if (!(b.powered && b.open)) return;
  const p = rideT(b, 0.45) % 1;
  const x = lerp(g.rideA[0], g.rideB[0], p) + sx, y = lerp(g.rideA[1], g.rideB[1], p) + sy;
  /* hollowed log boat */
  ctx.fillStyle = '#7a4a2a';
  roundRect(ctx, x - 11, y - 7, 22, 9, 4); ctx.fill();
  ctx.fillStyle = '#5d3720';
  roundRect(ctx, x - 9, y - 7, 18, 3.5, 2); ctx.fill();
  for (let i = 0; i < 2; i++) {
    ctx.fillStyle = CLOTH_TONES[i + 1];
    roundRect(ctx, x - 5 + i * 8, y - 12, 6, 6, 2); ctx.fill();
    ctx.fillStyle = SKIN_TONES[i + 1];
    ctx.beginPath(); ctx.arc(x - 2 + i * 8, y - 13, 2.6, 0, Math.PI * 2); ctx.fill();
  }
  /* spray behind the boat */
  ctx.fillStyle = 'rgba(207,233,247,.75)';
  for (let i = 0; i < 4; i++) ctx.fillRect(x - 12 - i * 4, y - 4 + Math.sin(t * 20 + i) * 2, 3, 2);
  if (p > 0.82) {
    const f = (p - 0.82) / 0.18;
    ctx.save(); ctx.globalAlpha = 1 - f;
    ctx.fillStyle = '#e4f4fd';
    for (let i = 0; i < 9; i++) {
      const a = Math.PI + (i / 8) * Math.PI;
      ctx.beginPath();
      ctx.arc(g.pool[0] + sx + Math.cos(a) * f * 34, g.pool[1] + sy + Math.sin(a) * f * 18 - 6, 4 - f * 2.6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
};

/* --------------------------------------------------------- roller coaster */
function coasterTrack(g, w, h) {
  const ctrl = [
    [0.7, h - 0.6, 0], [2.6, h - 0.45, 2], [w - 0.8, h - 1.0, 10],
    [w - 0.35, h / 2 - 0.2, 30], [w - 1.1, 0.45, 54], [w / 2, 0.15, 62],
    [1.2, 0.5, 40], [0.3, h / 2, 14]
  ];
  return spline(ctrl, 9).map(p => {
    const c = g.C(p[0], p[1]);
    return { x: c[0], y: c[1] - p[2], z: p[2], gy: c[1], d: p[0] + p[1] };
  });
}
ART.coaster = function (w, h) {
  const g = spriteCtx(w, h, 110), ctx = g.ctx;
  pad(g, SAND, SAND_E);
  const pts = coasterTrack(g, w, h);
  g.track = pts;
  const n = pts.length;
  /* draw segment by segment, back to front, so the track weaves correctly */
  const segs = [];
  for (let i = 0; i < n; i++) segs.push({ a: pts[i], b: pts[(i + 1) % n], d: pts[i].d });
  segs.sort((p, q) => p.d - q.d);
  for (const s of segs) {
    /* support post */
    if (s.a.z > 7 && Math.random() < 1) {
      const step = Math.round((s.a.d * 7) % 3);
      if (step === 0) {
        ctx.strokeStyle = shade(WOOD, -0.1); ctx.lineWidth = 3.2;
        ctx.beginPath(); ctx.moveTo(s.a.x, s.a.y + 2); ctx.lineTo(s.a.x, s.a.gy); ctx.stroke();
        ctx.strokeStyle = WOOD_D; ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(s.a.x - 5, s.a.gy - s.a.z * 0.55); ctx.lineTo(s.a.x + 5, s.a.gy - s.a.z * 0.2);
        ctx.moveTo(s.a.x + 5, s.a.gy - s.a.z * 0.55); ctx.lineTo(s.a.x - 5, s.a.gy - s.a.z * 0.2);
        ctx.stroke();
      }
    }
    /* sleepers + two rails */
    ctx.strokeStyle = WOOD_D; ctx.lineWidth = 7;
    ctx.beginPath(); ctx.moveTo(s.a.x, s.a.y); ctx.lineTo(s.b.x, s.b.y); ctx.stroke();
    ctx.strokeStyle = shade(WOOD_L, 0.1); ctx.lineWidth = 1.8;
    ctx.beginPath(); ctx.moveTo(s.a.x, s.a.y - 2.4); ctx.lineTo(s.b.x, s.b.y - 2.4); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(s.a.x, s.a.y + 2.4); ctx.lineTo(s.b.x, s.b.y + 2.4); ctx.stroke();
  }
  /* station with a thatched canopy over the boarding point */
  const st = g.C(1.5, h - 0.55);
  isoBox(ctx, st[0], st[1] + 4, TILE_W * 1.0, TILE_H * 1.0, 7, '#9c7a4f', '#63451f', '#7d5c32');
  for (const s of [-1, 1]) {
    ctx.strokeStyle = WOOD; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(st[0] + s * 22, st[1] + 2); ctx.lineTo(st[0] + s * 22, st[1] - 20); ctx.stroke();
  }
  thatchRoof(ctx, st[0], st[1] - 20, 28, 10, 15, PALETTE.thatch);
  /* a painted sign board */
  ctx.fillStyle = '#c44a3f';
  roundRect(ctx, st[0] - 17, st[1] - 40, 34, 11, 3); ctx.fill();
  ctx.fillStyle = '#f0dcae';
  ctx.font = 'bold 8px system-ui, sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('RIDE', st[0], st[1] - 34);
  return g;
};
ANIM.coaster = function (ctx, sx, sy, g, t, b) {
  if (!(b.powered && b.open)) return;
  const pts = g.track, n = pts.length;
  const head = rideT(b, 0.095) % 1;
  for (let c = 2; c >= 0; c--) {
    const u = (head - c * 0.02 + 1) % 1;
    const f = u * n, i = Math.floor(f), fr = f - i;
    const a = pts[i % n], p2 = pts[(i + 1) % n];
    const x = lerp(a.x, p2.x, fr) + sx, y = lerp(a.y, p2.y, fr) + sy;
    const ang = Math.atan2(p2.y - a.y, p2.x - a.x);
    ctx.save();
    ctx.translate(x, y); ctx.rotate(ang * 0.35);
    ctx.fillStyle = c === 0 ? '#c9453a' : '#e0a33c';
    roundRect(ctx, -9, -10, 18, 10, 3); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,.28)';
    ctx.fillRect(-9, -3, 18, 3);
    ctx.fillStyle = SKIN_TONES[(c + 1) % SKIN_TONES.length];
    ctx.beginPath(); ctx.arc(-3.5, -12, 2.6, 0, Math.PI * 2); ctx.arc(3.5, -12, 2.6, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(-6, -14); ctx.lineTo(-4, -17); ctx.moveTo(5, -14); ctx.lineTo(7, -17); ctx.stroke();
    ctx.restore();
  }
};

/* -------------------------------------------------------------- tiny props */
/* Somebody on a ride. When we know which visitor it is — and on every ride we
   do, because b.riders holds them — draw the same figure that walks around the
   park, so the person who queued is recognisably the person on the ride.
   Anything without a known rider falls back to a plain figure. */
function drawMiniPerson(ctx, x, y, cloth, who) {
  if (who && who.look) {
    const spr = getPerson(who.look, PERSON_SIT);
    const k = 0.84;
    ctx.drawImage(spr.c, x - spr.ox * k, y - spr.oy * k + 3, spr.w * k, spr.h * k);
    return;
  }
  ctx.fillStyle = cloth;
  roundRect(ctx, x - 3.5, y - 9, 7, 9, 2.5); ctx.fill();
  ctx.fillStyle = SKIN_TONES[1];
  ctx.beginPath(); ctx.arc(x, y - 12, 3.4, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = HAIR_TONES[0];
  ctx.beginPath(); ctx.arc(x, y - 13, 3.4, Math.PI * 1.05, Math.PI * 2); ctx.fill();
}
function drawDinoMount(ctx, x, y, cloth) {
  ctx.fillStyle = '#5b9449';
  ctx.beginPath(); ctx.moveTo(x - 9, y - 10); ctx.lineTo(x - 16, y - 17); ctx.lineTo(x - 8, y - 13); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#6fae5a';
  roundRect(ctx, x - 9, y - 13, 18, 10, 4.5); ctx.fill();
  ctx.beginPath(); ctx.arc(x + 9, y - 17, 5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#8ac674';
  roundRect(ctx, x - 7, y - 13, 14, 3, 1.5); ctx.fill();
  ctx.fillStyle = '#2f2f2f';
  ctx.beginPath(); ctx.arc(x + 11, y - 18, 1.1, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#4b7c3c';
  ctx.fillRect(x - 6, y - 4, 3.2, 5); ctx.fillRect(x + 3, y - 4, 3.2, 5);
  drawMiniPerson(ctx, x, y - 13, cloth);
}
function drawFlame(ctx, x, y, t) {
  const s = 1 + Math.sin(t * 9 + x) * 0.18;
  ctx.save();
  ctx.globalAlpha = 0.35;
  ctx.fillStyle = '#ff9d3c';
  ctx.beginPath(); ctx.ellipse(x, y - 4 * s, 7 * s, 9 * s, 0, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 0.95;
  ctx.fillStyle = '#ff9d3c';
  ctx.beginPath(); ctx.ellipse(x, y - 4 * s, 3.4 * s, 6 * s, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#ffe07a';
  ctx.beginPath(); ctx.ellipse(x, y - 3 * s, 1.8 * s, 3.4 * s, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}
