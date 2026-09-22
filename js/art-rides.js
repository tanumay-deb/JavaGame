/* Isometric artwork for the rides: static structure (ART) + moving parts (ANIM).
   Everything is drawn with canvas primitives — no bitmaps, no borrowed assets. */

const SAND = '#d2b786', SAND_E = '#a69168';
const WOOD = '#805638', WOOD_D = '#533925', WOOD_L = '#a37544';

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
  const g = spriteCtx(w, h, 40), ctx = g.ctx;
  pad(g, SAND, SAND_E);
  const [cx, cy] = g.mid;

  /* the ground is worn into a hollow at each end, where feet land all day */
  for (const s of [-1, 1]) {
    ctx.fillStyle = 'rgba(122,98,64,.30)';
    ctx.beginPath(); ctx.ellipse(cx + s * 34, cy + 7, 15, 6.5, 0, 0, Math.PI * 2); ctx.fill();
    /* and a scatter of straw to land on — separate stalks, not a slab */
    ctx.lineWidth = 0.9;
    for (let i = 0; i < 14; i++) {
      const a = (hash2(i, s + 3) - 0.5) * 2.4;
      const r = 5 + hash2(i + 7, s) * 6;
      const ox = cx + s * 34 + (hash2(i + 2, s + 1) - 0.5) * 18;
      const oy = cy + 6 + (hash2(i + 5, s + 2) - 0.5) * 5;
      ctx.strokeStyle = i % 3 ? 'rgba(186,158,88,.55)' : 'rgba(210,186,120,.5)';
      ctx.beginPath();
      ctx.moveTo(ox, oy);
      ctx.lineTo(ox + Math.cos(a) * r, oy + Math.sin(a) * r * 0.42);
      ctx.stroke();
    }
  }

  /* a trestle, not a log: two legs lashed to a cross-piece on a stone footing */
  ctx.fillStyle = 'rgba(0,0,0,.20)';
  ctx.beginPath(); ctx.ellipse(cx, cy + 5, 20, 8, 0, 0, Math.PI * 2); ctx.fill();
  isoBox(ctx, cx, cy + 1, TILE_W * 0.40, TILE_H * 0.40, 4, PALETTE.rock, shade(PALETTE.rockDark, -0.12), PALETTE.rockDark);
  for (const s of [-1, 1]) {
    ctx.strokeStyle = shade(WOOD, -0.2); ctx.lineWidth = 5.5;
    ctx.beginPath(); ctx.moveTo(cx + s * 9, cy - 3); ctx.lineTo(cx + s * 1.5, cy - 15); ctx.stroke();
    ctx.strokeStyle = shade(WOOD, 0.14); ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(cx + s * 9 - 1.2, cy - 3); ctx.lineTo(cx + s * 1.5 - 1.2, cy - 15); ctx.stroke();
  }
  /* the pivot: a bone roller bound into the fork */
  ctx.strokeStyle = '#b39d6b'; ctx.lineWidth = 2.2;
  for (let i = -1; i <= 1; i++) {
    ctx.beginPath();
    ctx.moveTo(cx - 6, cy - 12 + i * 2.6); ctx.lineTo(cx + 6, cy - 13 + i * 2.6);
    ctx.stroke();
  }
  ctx.fillStyle = PALETTE.bone;
  ctx.beginPath(); ctx.ellipse(cx, cy - 15, 5, 3.4, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = PALETTE.boneDark;
  ctx.beginPath(); ctx.ellipse(cx, cy - 14.4, 2.2, 1.5, 0, 0, Math.PI * 2); ctx.fill();
  g.pivot = [cx, cy - 15];
  return g;
};
ANIM.seesaw = function (ctx, sx, sy, g, t, b) {
  const cx = g.pivot[0] + sx, cy = g.pivot[1] + sy;
  const busy = b.riders && b.riders.length;
  const a = Math.sin(rideT(b, 2.6)) * 0.34 * rideRun(b) + Math.sin(t * 0.7) * 0.03;
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(a);

  /* the plank, with grain and a lit top edge */
  beam(ctx, -36, 0, 36, 0, 8, WOOD_L);
  ctx.strokeStyle = 'rgba(60,38,18,.45)'; ctx.lineWidth = 0.9;
  for (const u of [-0.7, -0.25, 0.3, 0.72]) {
    ctx.beginPath(); ctx.moveTo(u * 34 - 5, -1.2); ctx.lineTo(u * 34 + 6, -0.8); ctx.stroke();
  }
  for (const s of [-1, 1]) {
    /* a hide pad to sit on */
    ctx.fillStyle = shade(PALETTE.hide, -0.18);
    roundRect(ctx, s * 31 - 8, -8.5, 16, 7, 3); ctx.fill();
    ctx.fillStyle = PALETTE.hide;
    roundRect(ctx, s * 31 - 8, -9.5, 16, 6, 3); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.18)';
    ctx.fillRect(s * 31 - 7, -9, 14, 1.4);
    /* a carved bone grip to hold on to */
    ctx.strokeStyle = WOOD_D; ctx.lineWidth = 2.6;
    ctx.beginPath(); ctx.moveTo(s * 20, -3); ctx.lineTo(s * 20, -13); ctx.stroke();
    ctx.fillStyle = PALETTE.boneDark;
    ctx.beginPath(); ctx.ellipse(s * 20, -13.4, 2.4, 1.8, 0, 0, Math.PI * 2); ctx.fill();
  }
  /* a carved beast's head on the front end, because somebody had the time */
  ctx.fillStyle = '#558748';
  ctx.beginPath();
  ctx.moveTo(-35, -5); ctx.lineTo(-44, -5.5); ctx.lineTo(-46, -2.5);
  ctx.lineTo(-43, -0.5); ctx.lineTo(-35, 0.5);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#6aa555';
  ctx.beginPath();
  ctx.moveTo(-35, -5); ctx.lineTo(-44, -5.5); ctx.lineTo(-44.5, -3.8); ctx.lineTo(-35, -3.4);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#111622';
  ctx.beginPath(); ctx.arc(-40.5, -3.6, 0.85, 0, Math.PI * 2); ctx.fill();

  if (busy) {
    drawMiniPerson(ctx, -31, -8, CLOTH_TONES[1], b.riders && b.riders[0]);
    drawMiniPerson(ctx, 31, -8, CLOTH_TONES[3], b.riders && b.riders[1]);
  }
  ctx.restore();
};

/* -------------------------------------------------------------- trampoline */
ART.trampoline = function (w, h) {
  const g = spriteCtx(w, h, 44), ctx = g.ctx;
  pad(g, SAND, SAND_E);
  const [cx, cy] = g.mid;
  const rx = TILE_W * 0.56, ry = TILE_H * 0.60, H = 17;

  ctx.fillStyle = 'rgba(0,0,0,.20)';
  ctx.beginPath(); ctx.ellipse(cx, cy + 6, rx + 8, ry + 5, 0, 0, Math.PI * 2); ctx.fill();

  /* Four posts on stone footings, lashed rather than bolted. Each one stands
     on the ground under the point of the rim it holds up, so its top meets the
     frame rather than sticking out above it. */
  const posts = [[-0.86, 0], [0.86, 0], [0, -0.92], [0, 0.92]];
  for (const d of posts) {
    const px = cx + d[0] * rx, py = cy + d[1] * ry;
    ctx.fillStyle = PALETTE.rockDark;
    ctx.beginPath(); ctx.ellipse(px, py + 1, 7, 3.4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = shade(WOOD, -0.25); ctx.fillRect(px - 3, py - H, 6, H);
    ctx.fillStyle = WOOD; ctx.fillRect(px - 3, py - H, 4, H);
    ctx.fillStyle = shade(WOOD, 0.2); ctx.fillRect(px - 3, py - H, 1.4, H);
    ctx.strokeStyle = '#b39d6b'; ctx.lineWidth = 1.5;
    for (const yy of [py - H + 4, py - H + 7]) {
      ctx.beginPath(); ctx.moveTo(px - 3.4, yy); ctx.lineTo(px + 3.4, yy - 0.8); ctx.stroke();
    }
  }

  /* The mat first — a stitched hide with a spiral daubed on it. Filling the
     frame as a whole ellipse and insetting the mat left a broad white band
     that read as a plate rather than a rim, so the rim is stroked on top. */
  ctx.fillStyle = shade(PALETTE.hide, -0.46);
  ctx.beginPath(); ctx.ellipse(cx, cy - H + 2.5, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = shade(PALETTE.hide, -0.32);
  ctx.beginPath(); ctx.ellipse(cx, cy - H, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(232,226,207,.4)'; ctx.lineWidth = 1.2;
  ctx.beginPath();
  for (let i = 0; i <= 34; i++) {
    const a = i * 0.42, r = i / 34;
    const sxp = cx + Math.cos(a) * (rx - 5) * r, syp = cy - H + Math.sin(a) * (ry - 3.5) * r;
    i ? ctx.lineTo(sxp, syp) : ctx.moveTo(sxp, syp);
  }
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,.09)';
  ctx.beginPath(); ctx.ellipse(cx - 7, cy - H - 3, rx * 0.32, ry * 0.24, -0.3, 0, Math.PI * 2); ctx.fill();

  /* twisted sinew lacing the mat to the rim */
  ctx.strokeStyle = 'rgba(157,138,102,.85)'; ctx.lineWidth = 1.2;
  for (let i = 0; i < 20; i++) {
    const a = (i / 20) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * (rx - 4), cy - H + Math.sin(a) * (ry - 2.5));
    ctx.lineTo(cx + Math.cos(a) * (rx + 2.5), cy - H + Math.sin(a) * (ry + 1.8));
    ctx.stroke();
  }

  /* the rim itself: a hoop of lashed bone, two strokes thick */
  ctx.strokeStyle = PALETTE.boneDark; ctx.lineWidth = 4.4;
  ctx.beginPath(); ctx.ellipse(cx, cy - H + 1, rx + 1.5, ry + 1, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = PALETTE.bone; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.ellipse(cx, cy - H, rx + 1.5, ry + 1, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = 'rgba(120,108,84,.55)'; ctx.lineWidth = 1.4;
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.3;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * (rx - 1), cy - H + Math.sin(a) * (ry - 1) - 2.6);
    ctx.lineTo(cx + Math.cos(a) * (rx + 3), cy - H + Math.sin(a) * (ry + 2) + 2.6);
    ctx.stroke();
  }

  /* a log to step up on */
  const step = g.C((w - 1) / 2, h - 0.35);
  ctx.fillStyle = shade(WOOD, -0.3);
  roundRect(ctx, step[0] - 13, step[1] - 5, 26, 7, 3.2); ctx.fill();
  ctx.fillStyle = WOOD;
  roundRect(ctx, step[0] - 13, step[1] - 7, 26, 6, 3); ctx.fill();
  ctx.fillStyle = shade(WOOD, 0.18);
  ctx.fillRect(step[0] - 12, step[1] - 6.5, 24, 1.6);

  g.matY = cy - H;
  return g;
};
ANIM.trampoline = function (ctx, sx, sy, g, t, b) {
  if (!b.riders || !b.riders.length) return;
  const cx = g.mid[0] + sx, cy = g.matY + sy;
  for (let i = 0; i < Math.min(3, b.riders.length); i++) {
    const phase = rideT(b, 4.2) + i * 2.1;
    const hop = Math.abs(Math.sin(phase)) * 26 * rideRun(b);
    const x = cx + (i - 1) * 14;
    /* the mat gives under them as they land */
    if (hop < 3) {
      ctx.strokeStyle = 'rgba(70,46,26,.45)'; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.ellipse(x, cy + 2, 11, 4, 0, 0.15, Math.PI - 0.15); ctx.stroke();
    }
    blob(ctx, x, cy + 1, 7 - hop * 0.09, 3.2, 0.22);
    drawMiniPerson(ctx, x, cy - hop, CLOTH_TONES[i % CLOTH_TONES.length], b.riders && b.riders[i]);
  }
};

/* ------------------------------------------------------------------- swing */
ART.swing = function (w, h) {
  const g = spriteCtx(w, h, 66), ctx = g.ctx;
  pad(g, SAND, SAND_E);
  const [cx, cy] = g.mid;
  const H = 46;

  /* the ground is scuffed where feet drag */
  ctx.fillStyle = 'rgba(126,102,66,.16)';
  for (const s of [-1, 1]) {
    ctx.beginPath(); ctx.ellipse(cx + s * 14, cy + 8, 14, 5, 0, 0, Math.PI * 2); ctx.fill();
  }

  /* two A-frames, four legs, on stone pads */
  const legs = [];
  for (const s of [-1, 1]) {
    const foot = g.C((w - 1) / 2 + s * 0.7, (h - 1) / 2 + s * 0.7);
    const foot2 = g.C((w - 1) / 2 + s * 0.7, (h - 1) / 2 - s * 0.7);
    legs.push(foot, foot2);
    for (const f of [foot, foot2]) {
      ctx.fillStyle = PALETTE.rockDark;
      ctx.beginPath(); ctx.ellipse(f[0], f[1] + 1, 8, 4, 0, 0, Math.PI * 2); ctx.fill();
    }
    beam(ctx, foot[0], foot[1], cx + s * 5, cy - H, 6, WOOD);
    beam(ctx, foot2[0], foot2[1], cx + s * 5, cy - H, 6, WOOD);
    /* a collar tie across the A, lashed at both ends */
    const m1 = [lerp(foot[0], cx + s * 5, 0.42), lerp(foot[1], cy - H, 0.42)];
    const m2 = [lerp(foot2[0], cx + s * 5, 0.42), lerp(foot2[1], cy - H, 0.42)];
    ctx.strokeStyle = shade(WOOD, -0.25); ctx.lineWidth = 3.4;
    ctx.beginPath(); ctx.moveTo(m1[0], m1[1]); ctx.lineTo(m2[0], m2[1]); ctx.stroke();
    ctx.strokeStyle = '#b39d6b'; ctx.lineWidth = 1.7;
    for (const m of [m1, m2]) {
      ctx.beginPath(); ctx.moveTo(m[0] - 4, m[1] - 1); ctx.lineTo(m[0] + 4, m[1] + 1); ctx.stroke();
    }
  }

  /* the ridge beam the seats hang from */
  beam(ctx, cx - 28, cy - H, cx + 28, cy - H, 8, WOOD_L);
  ctx.strokeStyle = '#b39d6b'; ctx.lineWidth = 2;
  for (const s of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(cx + s * 5 - 6, cy - H - 2 + i * 2.4);
      ctx.lineTo(cx + s * 5 + 6, cy - H - 3 + i * 2.4);
      ctx.stroke();
    }
  }
  /* a row of little hide pennants along it */
  for (let i = -2; i <= 2; i++) {
    ctx.fillStyle = CLOTH_TONES[(i + 2) % CLOTH_TONES.length];
    ctx.beginPath();
    ctx.moveTo(cx + i * 11, cy - H - 4);
    ctx.lineTo(cx + i * 11 + 5, cy - H - 9);
    ctx.lineTo(cx + i * 11 - 1.5, cy - H - 9.5);
    ctx.closePath(); ctx.fill();
  }
  skull(ctx, cx, cy - H - 7, 6.5);

  /* a log to climb on to the seats from */
  const step = g.C((w - 1) / 2, h - 0.4);
  ctx.fillStyle = shade(WOOD, -0.3);
  roundRect(ctx, step[0] - 12, step[1] - 4, 24, 6, 3); ctx.fill();
  ctx.fillStyle = WOOD;
  roundRect(ctx, step[0] - 12, step[1] - 6, 24, 5.5, 2.8); ctx.fill();

  g.barY = cy - H;
  return g;
};
ANIM.swing = function (ctx, sx, sy, g, t, b) {
  const cx = g.mid[0] + sx, barY = g.barY + sy;
  const run = b.riders && b.riders.length ? 1 : 0.16;
  for (let i = 0; i < 2; i++) {
    const ax = cx - 14 + i * 28, ay = barY + 3;
    const a = Math.sin(rideT(b, 2.4) + i * Math.PI) * 0.52 * run;
    const len = 30;
    const ex = ax + Math.sin(a) * len, ey = ay + Math.cos(a) * len;
    /* twisted hide rope, two strands */
    ctx.strokeStyle = '#776750'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(ax - 5, ay); ctx.lineTo(ex - 5, ey); ctx.moveTo(ax + 5, ay); ctx.lineTo(ex + 5, ey); ctx.stroke();
    ctx.strokeStyle = 'rgba(200,178,134,.55)'; ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.moveTo(ax - 5.6, ay); ctx.lineTo(ex - 5.6, ey); ctx.moveTo(ax + 4.4, ay); ctx.lineTo(ex + 4.4, ey); ctx.stroke();
    /* a carved plank seat with a hide pad on it */
    ctx.save();
    ctx.translate(ex, ey); ctx.rotate(-a * 0.35);
    ctx.fillStyle = WOOD_D;
    roundRect(ctx, -9, 0, 18, 5, 2); ctx.fill();
    ctx.fillStyle = shade(PALETTE.hide, -0.1);
    roundRect(ctx, -8, -1.5, 16, 3.4, 1.6); ctx.fill();
    ctx.restore();
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
    ctx.fillStyle = mixColor(PALETTE.rock, '#fcf7ea', 0.45); /* the top */
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
  gr.addColorStop(0, mixColor(PALETTE.rock, '#fff9eb', 0.4));
  gr.addColorStop(0.5, mixColor(PALETTE.rock, '#eeebe1', 0.2));
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
    drawMiniPerson(ctx, x, y, '#e0c152', b.riders[i]);
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
    for (const [r, col] of [[8.5, '#f4e4be'], [6, '#bb483e'], [3.4, '#f4e4be'], [1.6, '#bb483e']]) {
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
  ctx.fillStyle = '#bb483e';
  ctx.beginPath();
  ctx.moveTo(bk[0] - 12, bk[1] - 34); ctx.lineTo(bk[0] + 8, bk[1] - 30);
  ctx.lineTo(bk[0] + 8, bk[1] - 24); ctx.lineTo(bk[0] - 12, bk[1] - 28);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#f4e4be';
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
  ctx.fillStyle = '#967a49';
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
  ctx.fillStyle = '#a8875d';
  ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
  /* radial planks */
  ctx.strokeStyle = 'rgba(0,0,0,.15)'; ctx.lineWidth = 1.2;
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a) * rx, cy + Math.sin(a) * ry); ctx.stroke();
  }
  ctx.fillStyle = '#c7a575';
  ctx.beginPath(); ctx.ellipse(cx, cy, rx * 0.34, ry * 0.34, 0, 0, Math.PI * 2); ctx.fill();
  /* painted rim */
  ctx.strokeStyle = '#bc4d43'; ctx.lineWidth = 3;
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
    ctx.strokeStyle = '#e0ce8c'; ctx.lineWidth = 2.2;
    ctx.beginPath(); ctx.moveTo(m.x, m.y - 56); ctx.lineTo(m.x, m.y - 4 + bob); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 0.9;
    ctx.beginPath(); ctx.moveTo(m.x - 0.8, m.y - 56); ctx.lineTo(m.x - 0.8, m.y - 4 + bob); ctx.stroke();
    blob(ctx, m.x, m.y + 2, 8, 3.5, 0.14);
    drawDinoMount(ctx, m.x, m.y + bob, CLOTH_TONES[m.i % 7]);
  }
  canopy(ctx, cx, cy - 62, TILE_W * 0.92, TILE_H * 0.92, 20, '#bc4d43', '#fae2ad');
  ctx.strokeStyle = '#e7d153'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(cx, cy - 82); ctx.lineTo(cx, cy - 62); ctx.stroke();
  ctx.fillStyle = '#e7d153';
  ctx.beginPath(); ctx.arc(cx, cy - 84, 4, 0, Math.PI * 2); ctx.fill();
  /* bunting round the rim */
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 + spin * 0.2;
    const bx = cx + Math.cos(a) * TILE_W * 0.9, by = cy - 60 + Math.sin(a) * TILE_H * 0.9;
    ctx.fillStyle = i % 2 ? '#fae2ad' : '#bc4d43';
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
  ctx.fillStyle = '#aa966a';
  ctx.beginPath(); ctx.ellipse(0, 0, 9, 7, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#766648'; ctx.lineWidth = 1.5;
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
  ctx.strokeStyle = '#76674c'; ctx.lineWidth = 1.4;
  ctx.beginPath(); ctx.moveTo(26, -4); ctx.lineTo(32, -6); ctx.moveTo(26, 4); ctx.lineTo(32, 6); ctx.stroke();
  ctx.fillStyle = PALETTE.rockDark;
  ctx.beginPath(); ctx.arc(-20, 0, 8, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = shade(PALETTE.rockDark, 0.2);
  ctx.beginPath(); ctx.arc(-22, -2, 3, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  if (run && ph > 0.3 && ph < 0.8) {
    const f = (ph - 0.3) / 0.5;
    drawMiniPerson(ctx, px + 22 + f * 62, py - 16 - Math.sin(f * Math.PI) * 44, '#d2654f', b.riders && b.riders[0]);
  }
};

/* ------------------------------------------------------------ ferris wheel */
ART.ferris = function (w, h) {
  const g = spriteCtx(w, h, 132), ctx = g.ctx;
  pad(g, SAND, SAND_E);
  const [cx, cy] = g.mid;
  const R = 48, hubY = cy - R - 18;
  g.hub = [cx, hubY]; g.R = R;

  ctx.fillStyle = 'rgba(0,0,0,.20)';
  ctx.beginPath(); ctx.ellipse(cx, cy + 6, 46, 19, 0, 0, Math.PI * 2); ctx.fill();

  /* Two trestles rather than four bare poles, each pair braced into a triangle
     and footed on stone — the wheel is the heaviest thing in the park and it
     used to look like it was balanced on sticks. */
  const corners = [[-1.0, -1.0], [1.0, -1.0], [-1.0, 1.0], [1.0, 1.0]];
  const feet = corners.map(c => g.C((w - 1) / 2 + c[0], (h - 1) / 2 + c[1]));
  for (const f of feet) {
    ctx.fillStyle = PALETTE.rockDark;
    ctx.beginPath(); ctx.ellipse(f[0], f[1] + 1, 10, 5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = PALETTE.rock;
    ctx.beginPath(); ctx.ellipse(f[0], f[1] - 1, 9, 4.4, 0, 0, Math.PI * 2); ctx.fill();
  }
  for (const f of feet) beam(ctx, f[0], f[1] - 2, cx, hubY, 6, WOOD);
  /* cross-braces between each pair, and a tie across the whole frame */
  ctx.strokeStyle = shade(WOOD, -0.28); ctx.lineWidth = 3.4;
  for (const [a, b2] of [[0, 1], [2, 3], [0, 2], [1, 3]]) {
    for (const u of [0.42, 0.72]) {
      ctx.beginPath();
      ctx.moveTo(lerp(feet[a][0], cx, u), lerp(feet[a][1], hubY, u));
      ctx.lineTo(lerp(feet[b2][0], cx, u), lerp(feet[b2][1], hubY, u));
      ctx.stroke();
    }
  }
  /* bindings where the braces cross the legs */
  ctx.strokeStyle = '#b39d6b'; ctx.lineWidth = 1.7;
  for (const f of feet) {
    for (const u of [0.42, 0.72]) {
      const bx = lerp(f[0], cx, u), by = lerp(f[1], hubY, u);
      ctx.beginPath(); ctx.moveTo(bx - 4, by + 1); ctx.lineTo(bx + 4, by - 1); ctx.stroke();
    }
  }

  /* The boarding deck. Kept to one tile and drawn as a box with its planking
     following the diamond: laying the planks as straight lines across it put
     their ends outside the deck, which read as spilled sticks. */
  const plat = g.C(0.3, h - 0.65);
  isoBox(ctx, plat[0], plat[1], TILE_W * 0.62, TILE_H * 0.62, 8, '#997952', '#503d26', '#705534');
  ctx.save();
  ctx.beginPath();
  diamond(ctx, plat[0], plat[1] - 8, TILE_W * 0.62, TILE_H * 0.62);
  ctx.clip();
  ctx.strokeStyle = 'rgba(95,68,32,.55)'; ctx.lineWidth = 1;
  for (let i = -3; i <= 3; i++) {
    ctx.beginPath();
    ctx.moveTo(plat[0] - 24 + i * 5, plat[1] - 8 + i * 2.6 - 12);
    ctx.lineTo(plat[0] + 8 + i * 5, plat[1] - 8 + i * 2.6 + 4);
    ctx.stroke();
  }
  ctx.restore();
  /* a step up from the path */
  ctx.fillStyle = shade('#997952', -0.16);
  roundRect(ctx, plat[0] - 12, plat[1] + 1, 24, 4, 1.8); ctx.fill();
  /* a rail along the back of it */
  ctx.strokeStyle = WOOD_D; ctx.lineWidth = 2.2;
  for (const u of [0, 0.5, 1]) {
    const px = lerp(plat[0] - 17, plat[0] + 1, u), py = lerp(plat[1] - 17, plat[1] - 26, u);
    ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px, py + 11); ctx.stroke();
  }
  ctx.strokeStyle = WOOD; ctx.lineWidth = 2.4;
  ctx.beginPath(); ctx.moveTo(plat[0] - 17, plat[1] - 17); ctx.lineTo(plat[0] + 1, plat[1] - 26); ctx.stroke();

  /* the ticket booth at the foot */
  const bo = g.C(w - 0.75, h - 0.4);
  isoBox(ctx, bo[0], bo[1], TILE_W * 0.46, TILE_H * 0.46, 16, WOOD_L, WOOD_D, WOOD);
  thatchRoof(ctx, bo[0], bo[1] - 16, 16, 6, 11, PALETTE.thatch);
  ctx.fillStyle = '#bc4d43';
  roundRect(ctx, bo[0] - 11, bo[1] - 12, 22, 7, 2); ctx.fill();
  ctx.fillStyle = 'rgba(240,220,174,.85)';
  for (let i = 0; i < 3; i++) ctx.fillRect(bo[0] - 7 + i * 5, bo[1] - 9.5, 3, 1.6);

  return g;
};
ANIM.ferris = function (ctx, sx, sy, g, t, b) {
  const hx = g.hub[0] + sx, hy = g.hub[1] + sy, R = g.R;
  const spin = rideT(b, 0.48);
  const N = 8;

  /* the rim: two hoops with lattice between them, so it reads as built rather
     than drawn — a single circle looked like a hoop of wire */
  ctx.strokeStyle = shade('#cead6d', -0.3); ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(hx, hy, R + 3, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = '#cead6d'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(hx, hy, R - 4, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = 'rgba(160,134,86,.85)'; ctx.lineWidth = 1.4;
  for (let i = 0; i < 24; i++) {
    const a0 = spin * 0.5 + (i / 24) * Math.PI * 2, a1 = a0 + Math.PI / 24;
    ctx.beginPath();
    ctx.moveTo(hx + Math.cos(a0) * (R + 3), hy + Math.sin(a0) * (R + 3));
    ctx.lineTo(hx + Math.cos(a1) * (R - 4), hy + Math.sin(a1) * (R - 4));
    ctx.stroke();
  }

  /* spokes, paired either side of the hub */
  for (let i = 0; i < N; i++) {
    const a = spin + (i / N) * Math.PI * 2;
    const ca = Math.cos(a), sa = Math.sin(a);
    ctx.strokeStyle = 'rgba(122,100,64,.9)'; ctx.lineWidth = 2.6;
    ctx.beginPath(); ctx.moveTo(hx - sa * 4, hy + ca * 4); ctx.lineTo(hx + ca * R, hy + sa * R); ctx.stroke();
    ctx.strokeStyle = 'rgba(232,214,168,.8)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(hx - sa * 4 - 1, hy + ca * 4); ctx.lineTo(hx + ca * R - 1, hy + sa * R); ctx.stroke();
  }

  /* the hub: a bone bearing in a timber housing */
  ctx.fillStyle = shade(WOOD, -0.35);
  ctx.beginPath(); ctx.arc(hx, hy, 10, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = WOOD;
  ctx.beginPath(); ctx.arc(hx, hy, 8, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = PALETTE.bone;
  ctx.beginPath(); ctx.arc(hx, hy, 5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = PALETTE.boneDark;
  ctx.beginPath(); ctx.arc(hx, hy, 2.2, 0, Math.PI * 2); ctx.fill();
  /* the pegs that drive it, turning with the wheel */
  ctx.fillStyle = shade(WOOD, 0.25);
  for (let i = 0; i < 4; i++) {
    const a = spin * 1 + i * Math.PI / 2;
    ctx.beginPath(); ctx.arc(hx + Math.cos(a) * 6.6, hy + Math.sin(a) * 6.6, 1.5, 0, Math.PI * 2); ctx.fill();
  }

  /* the gondolas: baskets slung from a yoke, hanging level whatever the wheel does */
  for (let i = 0; i < N; i++) {
    const a = spin + (i / N) * Math.PI * 2;
    const gx = hx + Math.cos(a) * R, gy = hy + Math.sin(a) * R;
    ctx.strokeStyle = '#897a5e'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(gx - 6, gy); ctx.lineTo(gx - 6, gy + 7); ctx.moveTo(gx + 6, gy); ctx.lineTo(gx + 6, gy + 7); ctx.stroke();
    ctx.strokeStyle = PALETTE.boneDark; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(gx - 7, gy + 7); ctx.lineTo(gx + 7, gy + 7); ctx.stroke();

    const col = CLOTH_TONES[i % CLOTH_TONES.length];
    /* a woven basket: dark underside, banded sides, a hide rim */
    ctx.fillStyle = shade(col, -0.42);
    roundRect(ctx, gx - 9, gy + 13, 18, 5, 2.2); ctx.fill();
    ctx.fillStyle = col;
    roundRect(ctx, gx - 9, gy + 7, 18, 10, 3.2); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,.22)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(gx - 9, gy + 11); ctx.lineTo(gx + 9, gy + 11); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.24)';
    ctx.fillRect(gx - 9, gy + 7, 18, 2.2);
    ctx.fillStyle = shade(PALETTE.hide, -0.1);
    roundRect(ctx, gx - 10, gy + 6, 20, 2.6, 1.3); ctx.fill();

    if (b.riders && b.riders.length > i) {
      const who = b.riders[i];
      if (who && who.look) {
        const spr = getPerson(who.look, PERSON_SIT), k = 0.55;
        ctx.drawImage(spr.c, gx - spr.ox * k, gy + 9 - spr.oy * k, spr.w * k, spr.h * k);
      } else {
        ctx.fillStyle = SKIN_TONES[i % SKIN_TONES.length];
        ctx.beginPath(); ctx.arc(gx, gy + 4.5, 2.6, 0, Math.PI * 2); ctx.fill();
      }
    }
  }
};

/* ------------------------------------------------------------ haunted cave */
ART.cave = function (w, h, rot) {
  const g = spriteCtx(w, h, 104), ctx = g.ctx;
  pad(g, '#786e5d', '#534c45');
  const [cx, cy] = g.mid;
  /* The mouth goes in the middle of the mound's front face. It used to be put
     at the middle of the front row of tiles, which in this projection is a
     long way to the left of the middle of the mound, so the cave looked like
     it had a door in its side. */
  const front = [cx, cy + 24];

  /* The mound, in faceted planes so it reads as rock. More facets than before,
     and the seams between them are drawn, which is what makes it read as stone
     rather than a grey hill. */
  const facets = [
    { p: [[-1.28, 0.2], [-0.95, -0.62], [-0.45, -0.88], [-0.2, 0.25]], c: '#8f9499' },
    { p: [[-0.2, 0.25], [-0.45, -0.88], [0.08, -1.08], [0.3, 0.22]], c: '#7a8088' },
    { p: [[0.3, 0.22], [0.08, -1.08], [0.66, -0.86], [1.0, 0.2]], c: '#676e76' },
    { p: [[1.0, 0.2], [0.66, -0.86], [1.05, -0.5], [1.3, 0.18]], c: '#59606a' },
    { p: [[-0.45, -0.88], [-0.22, -1.3], [0.2, -1.32], [0.08, -1.08]], c: '#a8abad' },
    { p: [[0.08, -1.08], [0.2, -1.32], [0.62, -1.05], [0.66, -0.86]], c: '#8a8f95' }
  ];
  for (const f of facets) {
    ctx.fillStyle = f.c;
    ctx.beginPath();
    f.p.forEach((q, i) => {
      const x = cx + q[0] * TILE_W * 0.92, y = cy + 24 + q[1] * 52;
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    });
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(48,52,58,.35)'; ctx.lineWidth = 1;
    ctx.stroke();
  }
  /* moss in the shaded seams */
  ctx.fillStyle = 'rgba(88,134,68,.4)';
  for (const m of [[-40, -18, 17, 7, -0.3], [34, -8, 13, 5.5, 0.25], [-8, -40, 11, 4.5, 0.1]]) {
    ctx.beginPath(); ctx.ellipse(cx + m[0], cy + m[1], m[2], m[3], m[4], 0, Math.PI * 2); ctx.fill();
  }

  /* a row of hand prints daubed on the rock, which is what the tribe would do */
  ctx.fillStyle = 'rgba(196,74,63,.5)';
  for (let i = 0; i < 4; i++) {
    const hx2 = cx - 48 + i * 12, hy2 = cy - 12 - (i % 2) * 9;
    ctx.beginPath(); ctx.ellipse(hx2, hy2, 2.6, 3.2, 0, 0, Math.PI * 2); ctx.fill();
    for (let f = 0; f < 4; f++) {
      const a = -2.3 + f * 0.42;
      ctx.beginPath();
      ctx.ellipse(hx2 + Math.cos(a) * 3.4, hy2 + Math.sin(a) * 3.8, 0.8, 1.7, a + Math.PI / 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /* the entrance, cut back into the mound */
  const ex = front[0], ey = front[1] - 2;
  ctx.fillStyle = '#323031';
  ctx.beginPath(); ctx.ellipse(ex, ey - 17, 28, 30, 0, Math.PI, 0); ctx.rect(ex - 28, ey - 17, 56, 17); ctx.fill();
  const gr = ctx.createRadialGradient(ex, ey - 12, 2, ex, ey - 12, 34);
  gr.addColorStop(0, '#000'); gr.addColorStop(0.7, '#080c15'); gr.addColorStop(1, '#16171f');
  ctx.fillStyle = gr;
  ctx.beginPath(); ctx.ellipse(ex, ey - 15, 22, 24, 0, Math.PI, 0); ctx.rect(ex - 22, ey - 15, 44, 15); ctx.fill();

  /* a rib arch round the mouth, with vertebrae along it */
  ctx.strokeStyle = PALETTE.boneDark; ctx.lineWidth = 5;
  ctx.beginPath(); ctx.ellipse(ex, ey - 14, 29, 28, 0, Math.PI * 1.03, Math.PI * 1.97); ctx.stroke();
  ctx.strokeStyle = PALETTE.bone; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.ellipse(ex, ey - 15, 29, 28, 0, Math.PI * 1.03, Math.PI * 1.97); ctx.stroke();
  for (let i = 0; i <= 8; i++) {
    const a = Math.PI * 1.03 + (i / 8) * (Math.PI * 0.94);
    ctx.fillStyle = PALETTE.bone;
    ctx.beginPath();
    ctx.ellipse(ex + Math.cos(a) * 29, ey - 15 + Math.sin(a) * 28, 3.4, 2.4, a, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = PALETTE.boneDark;
    ctx.beginPath();
    ctx.ellipse(ex + Math.cos(a) * 29, ey - 15 + Math.sin(a) * 28, 1.4, 1, a, 0, Math.PI * 2);
    ctx.fill();
  }

  /* stalactite teeth hanging in the mouth, and a few rising from the floor */
  ctx.fillStyle = PALETTE.bone;
  for (let i = -3; i <= 3; i++) {
    const tx = ex + i * 6.4, hgt = 8 + (i % 2 ? 5 : 0);
    ctx.beginPath(); ctx.moveTo(tx - 3, ey - 32); ctx.lineTo(tx + 3, ey - 32); ctx.lineTo(tx, ey - 32 + hgt); ctx.closePath(); ctx.fill();
  }
  ctx.fillStyle = PALETTE.boneDark;
  for (const i of [-2, 1]) {
    const tx = ex + i * 8;
    ctx.beginPath(); ctx.moveTo(tx - 2.4, ey - 1); ctx.lineTo(tx + 2.4, ey - 1); ctx.lineTo(tx, ey - 8); ctx.closePath(); ctx.fill();
  }

  /* hide strips hung across the opening, so you cannot see what is inside */
  for (let i = -2; i <= 2; i++) {
    ctx.fillStyle = i % 2 ? 'rgba(122,88,58,.9)' : 'rgba(150,110,72,.9)';
    ctx.beginPath();
    ctx.moveTo(ex + i * 8 - 4, ey - 30);
    ctx.lineTo(ex + i * 8 + 4, ey - 30);
    ctx.lineTo(ex + i * 8 + 3, ey - 16 - (i % 2 ? 3 : 0));
    ctx.lineTo(ex + i * 8 - 3, ey - 18 - (i % 2 ? 3 : 0));
    ctx.closePath(); ctx.fill();
  }

  /* boulders at the feet and a scatter of loose rock */
  for (const bx of [-1.35, 1.35]) {
    const px = cx + bx * TILE_W * 0.92, py = cy + 26;
    ctx.fillStyle = PALETTE.rockDark;
    ctx.beginPath(); ctx.ellipse(px, py + 2, 14, 8, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = PALETTE.rock;
    ctx.beginPath(); ctx.ellipse(px, py, 13, 8, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = shade(PALETTE.rock, 0.18);
    ctx.beginPath(); ctx.ellipse(px - 2, py - 3, 7, 4, 0, 0, Math.PI * 2); ctx.fill();
  }

  /* torches either side of the mouth, on proper brackets */
  g.torches = [[ex - 37, ey - 4], [ex + 37, ey - 4]];
  for (const tp of g.torches) {
    ctx.fillStyle = PALETTE.rockDark;
    ctx.beginPath(); ctx.ellipse(tp[0], tp[1], 7, 3.4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = shade(WOOD, -0.3); ctx.fillRect(tp[0] - 3, tp[1] - 28, 6, 28);
    ctx.fillStyle = WOOD; ctx.fillRect(tp[0] - 3, tp[1] - 28, 4, 28);
    ctx.strokeStyle = '#b39d6b'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(tp[0] - 4, tp[1] - 24); ctx.lineTo(tp[0] + 4, tp[1] - 25); ctx.stroke();
    ctx.fillStyle = PALETTE.boneDark;
    ctx.beginPath(); ctx.ellipse(tp[0], tp[1] - 28, 5, 2.6, 0, 0, Math.PI * 2); ctx.fill();
  }

  g.mouth = [ex, ey - 13];
  return g;
};
ANIM.cave = function (ctx, sx, sy, g, t, b) {
  for (const tp of g.torches) drawFlame(ctx, tp[0] + sx, tp[1] - 28 + sy, t);
  const lit = b.powered && b.open;
  const mx = g.mouth[0] + sx, my = g.mouth[1] + sy;
  if (!lit) return;

  /* Firelight from inside, as a gradient that fades out. A flat ellipse of
     orange at a low alpha painted a disc over the curtain instead of looking
     like light coming through it. */
  const glow = 0.30 + Math.sin(t * 3) * 0.10;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const gr = ctx.createRadialGradient(mx, my + 4, 1, mx, my + 4, 22);
  gr.addColorStop(0, 'rgba(255,136,60,' + glow.toFixed(3) + ')');
  gr.addColorStop(0.55, 'rgba(226,96,40,' + (glow * 0.4).toFixed(3) + ')');
  gr.addColorStop(1, 'rgba(180,70,30,0)');
  ctx.fillStyle = gr;
  ctx.beginPath(); ctx.ellipse(mx, my + 4, 22, 20, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();

  if (b.riders && b.riders.length) {
    /* a pair of eyes blinks in the dark, and shifts about */
    const blink = Math.sin(t * 1.7) > 0.72;
    const wob = Math.sin(t * 0.9) * 3;
    if (!blink) {
      ctx.fillStyle = '#fcdf71';
      ctx.beginPath();
      ctx.arc(mx - 5 + wob, my - 4, 2.1, 0, Math.PI * 2);
      ctx.arc(mx + 5 + wob, my - 4, 2.1, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#191312';
      ctx.beginPath();
      ctx.arc(mx - 5 + wob, my - 4, 0.9, 0, Math.PI * 2);
      ctx.arc(mx + 5 + wob, my - 4, 0.9, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /* bats over the mound, only while the ride is running */
  ctx.strokeStyle = 'rgba(38,32,28,.75)'; ctx.lineWidth = 1.4;
  for (let i = 0; i < 3; i++) {
    const a = t * (0.6 + i * 0.13) + i * 2.1;
    const bxp = mx + Math.cos(a) * (30 + i * 9);
    const byp = my - 62 - i * 8 + Math.sin(a * 1.7) * 5;
    const flap = Math.sin(t * 11 + i) * 2.4;
    ctx.beginPath();
    ctx.moveTo(bxp - 4, byp + flap); ctx.quadraticCurveTo(bxp - 2, byp - 1.5, bxp, byp);
    ctx.quadraticCurveTo(bxp + 2, byp - 1.5, bxp + 4, byp + flap);
    ctx.stroke();
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
    mixColor(PALETTE.rock, '#f4f1e6', 0.3), shade(PALETTE.rockDark, -0.1), PALETTE.rockDark);

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
  ctx.strokeStyle = '#b39d6b'; ctx.lineWidth = 1.8;
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
  ctx.fillStyle = '#c45452';
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
  ctx.strokeStyle = '#625544'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(x, g.topY + sy - 14); ctx.lineTo(x, y); ctx.stroke();
  /* the car: a bench slung under the mast with a bar across the riders' laps */
  ctx.fillStyle = shade('#ae5743', -0.35);
  roundRect(ctx, x - 17, y + 9, 34, 6, 2); ctx.fill();
  if (run) {
    const n = Math.min(3, b.riders.length);
    for (let i = 0; i < n; i++)
      drawMiniPerson(ctx, x - (n - 1) * 5.5 + i * 11, y + 4, CLOTH_TONES[i % 7], b.riders[i]);
  }
  ctx.fillStyle = '#ae5743';
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
  const g = spriteCtx(w, h, 120), ctx = g.ctx;
  pad(g, '#7b8668', '#55604d');
  const top = g.C(w - 0.75, 0.45), bot = g.C(0.85, h - 1.15);
  const H = 74;

  /* the splash pool, behind everything else */
  ctx.fillStyle = shade(PALETTE.water, -0.42);
  ctx.beginPath(); ctx.ellipse(bot[0], bot[1] + 4, 38, 19, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = shade(PALETTE.water, -0.12);
  ctx.beginPath(); ctx.ellipse(bot[0], bot[1], 36, 17, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = PALETTE.water;
  ctx.beginPath(); ctx.ellipse(bot[0], bot[1] - 1, 33, 15, 0, 0, Math.PI * 2); ctx.fill();
  /* light on the water, in bands rather than one ring */
  ctx.strokeStyle = 'rgba(214,240,252,.35)'; ctx.lineWidth = 1.4;
  for (const r of [0.42, 0.68, 0.88]) {
    ctx.beginPath();
    ctx.ellipse(bot[0] - 3, bot[1] - 2, 33 * r, 15 * r, 0, Math.PI * 0.15, Math.PI * 0.85);
    ctx.stroke();
  }
  /* rocks and reeds round the rim */
  for (const a of [2.2, 3.1, 3.9, 5.1, 5.9]) {
    const rx2 = bot[0] + Math.cos(a) * 36, ry2 = bot[1] + Math.sin(a) * 17;
    ctx.fillStyle = PALETTE.rockDark;
    ctx.beginPath(); ctx.ellipse(rx2, ry2 + 1.5, 9, 5.5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = PALETTE.rock;
    ctx.beginPath(); ctx.ellipse(rx2, ry2, 8.5, 5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = shade(PALETTE.rock, 0.2);
    ctx.beginPath(); ctx.ellipse(rx2 - 1.5, ry2 - 2, 4.4, 2.6, 0, 0, Math.PI * 2); ctx.fill();
  }
  ctx.strokeStyle = '#568249'; ctx.lineWidth = 1.5;
  for (let i = 0; i < 9; i++) {
    const a = 2.5 + i * 0.36;
    const rx2 = bot[0] + Math.cos(a) * 33, ry2 = bot[1] + Math.sin(a) * 15;
    ctx.beginPath();
    ctx.moveTo(rx2, ry2);
    ctx.quadraticCurveTo(rx2 + 2, ry2 - 7, rx2 + 5, ry2 - 12);
    ctx.stroke();
  }

  /* the tower: a stone footing, a timber shaft, a thatched launch house */
  ctx.fillStyle = 'rgba(0,0,0,.20)';
  ctx.beginPath(); ctx.ellipse(top[0], top[1] + 4, 28, 12, 0, 0, Math.PI * 2); ctx.fill();
  isoBox(ctx, top[0], top[1], TILE_W * 0.78, TILE_H * 0.78, 9, PALETTE.rock,
    shade(PALETTE.rockDark, -0.14), PALETTE.rockDark);
  isoBox(ctx, top[0], top[1] - 9, TILE_W * 0.60, TILE_H * 0.60, H - 18, WOOD_L, WOOD_D, WOOD);
  /* horizontal bands, so the shaft reads as stacked timber */
  ctx.strokeStyle = 'rgba(70,44,20,.45)'; ctx.lineWidth = 1;
  for (let i = 1; i < 6; i++) {
    const yy = top[1] - 9 - (H - 18) * (i / 6);
    ctx.beginPath(); ctx.moveTo(top[0] - 19, yy); ctx.lineTo(top[0] + 19, yy); ctx.stroke();
  }
  /* a ladder up the near face */
  ctx.strokeStyle = WOOD; ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.moveTo(top[0] + 11, top[1] - 4); ctx.lineTo(top[0] + 11, top[1] - H + 2);
  ctx.moveTo(top[0] + 21, top[1] - 8); ctx.lineTo(top[0] + 21, top[1] - H - 2);
  ctx.stroke();
  ctx.strokeStyle = WOOD_D; ctx.lineWidth = 1.8;
  for (let i = 0; i < 8; i++) {
    const yy = top[1] - 8 - i * 8;
    ctx.beginPath(); ctx.moveTo(top[0] + 11, yy); ctx.lineTo(top[0] + 21, yy - 3); ctx.stroke();
  }
  /* the launch house */
  const hy = top[1] - H + 4;
  isoBox(ctx, top[0], hy, TILE_W * 0.66, TILE_H * 0.66, 14, shade(WOOD_L, 0.1), WOOD_D, WOOD);
  thatchRoof(ctx, top[0], hy - 14, 21, 8, 13, PALETTE.thatch);
  skull(ctx, top[0], hy - 24, 6);

  /* trestle bents under the flume, braced */
  for (let i = 1; i <= 4; i++) {
    const f = i / 5;
    const px = lerp(top[0], bot[0], f), py = lerp(top[1], bot[1], f);
    const hh = lerp(H - 8, 10, f);
    ctx.strokeStyle = shade(WOOD, -0.2); ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(px - 10, py); ctx.lineTo(px - 5, py - hh);
    ctx.moveTo(px + 10, py); ctx.lineTo(px + 5, py - hh);
    ctx.stroke();
    ctx.strokeStyle = WOOD_D; ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(px - 8, py - hh * 0.35); ctx.lineTo(px + 8, py - hh * 0.35);
    ctx.moveTo(px - 8, py - hh * 0.35); ctx.lineTo(px + 7, py - hh * 0.8);
    ctx.moveTo(px + 8, py - hh * 0.35); ctx.lineTo(px - 7, py - hh * 0.8);
    ctx.stroke();
  }

  /* The flume: a hollowed log, so an outer trough, the water inside it, and a
     lip along each side. Drawn as one long quad rather than a line, because a
     line has no inside. */
  const ax = top[0], ay = top[1] - H + 16, bx = bot[0], by = bot[1] - 5;
  ctx.fillStyle = shade(WOOD, -0.34);
  ctx.beginPath();
  ctx.moveTo(ax - 15, ay + 2); ctx.lineTo(ax + 13, ay + 9);
  ctx.lineTo(bx + 18, by + 8); ctx.lineTo(bx - 13, by - 1);
  ctx.closePath(); ctx.fill();
  /* water */
  ctx.fillStyle = 'rgba(86,176,220,.95)';
  ctx.beginPath();
  ctx.moveTo(ax - 10, ay + 4); ctx.lineTo(ax + 8, ay + 8);
  ctx.lineTo(bx + 12, by + 4); ctx.lineTo(bx - 8, by - 1);
  ctx.closePath(); ctx.fill();
  /* streaks running down it */
  ctx.strokeStyle = 'rgba(232,248,255,.4)'; ctx.lineWidth = 1.2;
  for (const u of [-0.4, 0, 0.45]) {
    ctx.beginPath();
    ctx.moveTo(ax - 1 + u * 8, ay + 6 + u * 2);
    ctx.lineTo(bx + 2 + u * 9, by + 1.5 + u * 2.5);
    ctx.stroke();
  }
  /* the lips, lit along the top */
  ctx.strokeStyle = WOOD_L; ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(ax - 15, ay + 2); ctx.lineTo(bx - 13, by - 1);
  ctx.moveTo(ax + 13, ay + 9); ctx.lineTo(bx + 18, by + 8);
  ctx.stroke();
  ctx.strokeStyle = shade(WOOD_L, 0.22); ctx.lineWidth = 1.1;
  ctx.beginPath();
  ctx.moveTo(ax - 15, ay + 1); ctx.lineTo(bx - 13, by - 2);
  ctx.stroke();

  g.rideA = [ax - 1, ay + 3]; g.rideB = [bx + 2, by - 2]; g.pool = [bot[0], bot[1] - 1];
  return g;
};
ANIM.chute = function (ctx, sx, sy, g, t, b) {
  /* the water always runs; only the boat waits for the ride to open */
  const px0 = g.pool[0] + sx, py0 = g.pool[1] + sy;
  ctx.fillStyle = 'rgba(232,248,255,.35)';
  for (let i = 0; i < 4; i++) {
    const u = ((t * 0.5 + i * 0.25) % 1);
    const x = lerp(g.rideA[0], g.rideB[0], u) + sx, y = lerp(g.rideA[1], g.rideB[1], u) + sy;
    ctx.fillRect(x - 5, y - 1 + Math.sin(t * 9 + i) * 1.2, 9, 1.6);
  }

  if (!(b.powered && b.open)) return;
  const p = rideT(b, 0.45) % 1;
  const x = lerp(g.rideA[0], g.rideB[0], p) + sx, y = lerp(g.rideA[1], g.rideB[1], p) + sy;

  /* a hollowed log boat with a carved prow */
  ctx.fillStyle = '#4d3125';
  roundRect(ctx, x - 13, y - 6, 26, 10, 4.5); ctx.fill();
  ctx.fillStyle = '#6c452f';
  roundRect(ctx, x - 13, y - 8, 26, 9, 4); ctx.fill();
  ctx.fillStyle = '#39251e';
  roundRect(ctx, x - 10, y - 7.5, 20, 4, 2); ctx.fill();
  ctx.fillStyle = '#805638';
  ctx.beginPath();
  ctx.moveTo(x + 12, y - 7); ctx.lineTo(x + 19, y - 11); ctx.lineTo(x + 14, y - 2);
  ctx.closePath(); ctx.fill();
  for (let i = 0; i < 2; i++) {
    const who = b.riders && b.riders[i];
    if (who && who.look) {
      const spr = getPerson(who.look, PERSON_SIT), k = 0.52;
      ctx.drawImage(spr.c, x - 5 + i * 9 - spr.ox * k, y - 6 - spr.oy * k, spr.w * k, spr.h * k);
    } else {
      ctx.fillStyle = CLOTH_TONES[i + 1];
      roundRect(ctx, x - 7 + i * 9, y - 13, 6.5, 7, 2.4); ctx.fill();
      ctx.fillStyle = SKIN_TONES[i + 1];
      ctx.beginPath(); ctx.arc(x - 3.8 + i * 9, y - 14.5, 2.8, 0, Math.PI * 2); ctx.fill();
    }
  }

  /* spray thrown up behind it */
  ctx.fillStyle = 'rgba(214,240,252,.75)';
  for (let i = 0; i < 5; i++)
    ctx.fillRect(x - 14 - i * 4, y - 3 + Math.sin(t * 20 + i) * 2.4, 3, 2);

  /* the landing */
  if (p > 0.80) {
    const f = (p - 0.80) / 0.20;
    ctx.save();
    ctx.globalAlpha = 1 - f;
    ctx.fillStyle = '#f3f9f2';
    for (let i = 0; i < 12; i++) {
      const a = Math.PI + (i / 11) * Math.PI;
      ctx.beginPath();
      ctx.arc(px0 + Math.cos(a) * f * 38, py0 + Math.sin(a) * f * 20 - 8 - Math.sin(f * Math.PI) * 10,
        4.5 - f * 3, 0, Math.PI * 2);
      ctx.fill();
    }
    /* and a ring spreading out on the pool */
    ctx.strokeStyle = 'rgba(232,248,255,.6)'; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.ellipse(px0, py0, 8 + f * 26, 4 + f * 12, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  }
};

/* --------------------------------------------------------- roller coaster */
function coasterTrack(g, w, h) {
  const ctrl = [
    [0.7, h - 0.6, 0], [2.6, h - 0.45, 3], [w - 0.8, h - 1.0, 12],
    [w - 0.35, h / 2 - 0.2, 34], [w - 1.1, 0.45, 58], [w / 2, 0.15, 66],
    [1.2, 0.5, 42], [0.3, h / 2, 15]
  ];
  return spline(ctrl, 9).map(p => {
    const c = g.C(p[0], p[1]);
    return { x: c[0], y: c[1] - p[2], z: p[2], gy: c[1], d: p[0] + p[1] };
  });
}
ART.coaster = function (w, h) {
  const g = spriteCtx(w, h, 126), ctx = g.ctx;
  pad(g, SAND, SAND_E);
  const pts = coasterTrack(g, w, h);
  g.track = pts;
  const n = pts.length;

  /* Back to front, so the track weaves over and under itself correctly. */
  const segs = [];
  for (let i = 0; i < n; i++) segs.push({ a: pts[i], b: pts[(i + 1) % n], i, d: pts[i].d });
  segs.sort((p, q) => p.d - q.d);

  for (const sg of segs) {
    const a = sg.a, b2 = sg.b;
    /* A bent under the track rather than a single stick: two splayed legs with
       a cap and a cross-brace, every third segment where it is high enough. */
    if (a.z > 6 && Math.round((a.d * 7) % 3) === 0) {
      const spread = 3 + a.z * 0.06;
      ctx.strokeStyle = shade(WOOD, -0.26); ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(a.x - 2, a.y + 2); ctx.lineTo(a.x - spread - 2, a.gy);
      ctx.moveTo(a.x + 2, a.y + 2); ctx.lineTo(a.x + spread + 2, a.gy);
      ctx.stroke();
      ctx.strokeStyle = WOOD_D; ctx.lineWidth = 1.5;
      for (const u of [0.42, 0.75]) {
        ctx.beginPath();
        ctx.moveTo(lerp(a.x - 2, a.x - spread - 2, u), lerp(a.y + 2, a.gy, u));
        ctx.lineTo(lerp(a.x + 2, a.x + spread + 2, u), lerp(a.y + 2, a.gy, u));
        ctx.stroke();
      }
      /* a stone pad under each foot */
      ctx.fillStyle = 'rgba(0,0,0,.16)';
      ctx.beginPath(); ctx.ellipse(a.x, a.gy + 1, spread + 5, 3.4, 0, 0, Math.PI * 2); ctx.fill();
    }

    /* sleepers, then two rails on top of them */
    ctx.strokeStyle = shade(WOOD_D, -0.12); ctx.lineWidth = 8;
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b2.x, b2.y); ctx.stroke();
    ctx.strokeStyle = 'rgba(58,36,16,.5)'; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(a.x, a.y - 3.4); ctx.lineTo(a.x, a.y + 3.4); ctx.stroke();
    ctx.strokeStyle = shade(WOOD_L, 0.14); ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(a.x, a.y - 2.6); ctx.lineTo(b2.x, b2.y - 2.6); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(a.x, a.y + 2.6); ctx.lineTo(b2.x, b2.y + 2.6); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,240,208,.35)'; ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.moveTo(a.x, a.y - 3.3); ctx.lineTo(b2.x, b2.y - 3.3); ctx.stroke();

    /* ratchet teeth up the climb, so the lift hill reads as one */
    if (b2.z > a.z + 1.1) {
      ctx.strokeStyle = PALETTE.boneDark; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(a.x - 1, a.y + 1.4); ctx.lineTo(a.x + 1, a.y - 1.4); ctx.stroke();
    }
  }

  /* the station: a decked platform under a thatched canopy, with a queue rail */
  const st = g.C(1.15, h - 0.85);
  isoBox(ctx, st[0], st[1] + 4, TILE_W * 0.88, TILE_H * 0.88, 8, '#997952', '#503d26', '#705534');
  ctx.save();
  ctx.beginPath(); diamond(ctx, st[0], st[1] - 4, TILE_W * 0.88, TILE_H * 0.88); ctx.clip();
  ctx.strokeStyle = 'rgba(95,68,32,.5)'; ctx.lineWidth = 1;
  for (let i = -5; i <= 5; i++) {
    ctx.beginPath();
    ctx.moveTo(st[0] - 28 + i * 5, st[1] - 4 + i * 2.5 - 15);
    ctx.lineTo(st[0] + 2 + i * 5, st[1] - 4 + i * 2.5 + 0);
    ctx.stroke();
  }
  ctx.restore();
  /* the queue rail along the front */
  ctx.strokeStyle = WOOD_D; ctx.lineWidth = 2;
  for (let i = 0; i <= 3; i++) {
    const px = st[0] - 20 + i * 10, py = st[1] + 4 + i * 5;
    ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px, py - 10); ctx.stroke();
  }
  ctx.strokeStyle = WOOD; ctx.lineWidth = 2.2;
  ctx.beginPath(); ctx.moveTo(st[0] - 20, st[1] - 6); ctx.lineTo(st[0] + 10, st[1] + 9); ctx.stroke();
  /* posts and canopy over the boarding point */
  for (const s of [-1, 1]) {
    ctx.strokeStyle = shade(WOOD, -0.2); ctx.lineWidth = 3.2;
    ctx.beginPath(); ctx.moveTo(st[0] + s * 19, st[1] + 1); ctx.lineTo(st[0] + s * 19, st[1] - 22); ctx.stroke();
  }
  thatchRoof(ctx, st[0], st[1] - 22, 24, 9, 13, PALETTE.thatch);
  /* a painted board on the canopy, not floating above it */
  ctx.strokeStyle = WOOD_D; ctx.lineWidth = 2.2;
  ctx.beginPath(); ctx.moveTo(st[0] - 11, st[1] - 30); ctx.lineTo(st[0] - 11, st[1] - 23); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(st[0] + 11, st[1] - 30); ctx.lineTo(st[0] + 11, st[1] - 23); ctx.stroke();
  ctx.fillStyle = shade('#bc4d43', -0.3);
  roundRect(ctx, st[0] - 16, st[1] - 41, 32, 12, 3.2); ctx.fill();
  ctx.fillStyle = '#bc4d43';
  roundRect(ctx, st[0] - 16, st[1] - 42.5, 32, 11, 3); ctx.fill();
  /* a daubed run of track rather than a word, since the tribe has no writing */
  ctx.strokeStyle = 'rgba(240,220,174,.85)'; ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(st[0] - 11, st[1] - 34);
  ctx.quadraticCurveTo(st[0] - 4, st[1] - 43, st[0] + 2, st[1] - 36);
  ctx.quadraticCurveTo(st[0] + 7, st[1] - 30, st[0] + 11, st[1] - 39);
  ctx.stroke();

  return g;
};
ANIM.coaster = function (ctx, sx, sy, g, t, b) {
  if (!(b.powered && b.open)) return;
  const pts = g.track, n = pts.length;
  const head = rideT(b, 0.095) % 1;
  /* four cars, drawn back to front so the train overlaps itself correctly */
  for (let c = 3; c >= 0; c--) {
    const u = (head - c * 0.019 + 1) % 1;
    const f = u * n, i = Math.floor(f), fr = f - i;
    const a = pts[i % n], p2 = pts[(i + 1) % n];
    const x = lerp(a.x, p2.x, fr) + sx, y = lerp(a.y, p2.y, fr) + sy;
    const ang = Math.atan2(p2.y - a.y, p2.x - a.x);
    ctx.save();
    ctx.translate(x, y); ctx.rotate(ang * 0.35);
    /* a hollowed log car with a bone bar across the riders */
    const col = c === 0 ? '#c0493f' : '#e0a33c';
    ctx.fillStyle = shade(col, -0.42);
    roundRect(ctx, -10, -4, 20, 6, 2.4); ctx.fill();
    ctx.fillStyle = col;
    roundRect(ctx, -10, -11, 20, 10, 3.4); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.26)';
    ctx.fillRect(-10, -11, 20, 2.2);
    ctx.fillStyle = 'rgba(0,0,0,.26)';
    ctx.fillRect(-10, -4.5, 20, 2.4);
    /* wheels */
    ctx.fillStyle = '#3a2c25';
    ctx.beginPath(); ctx.arc(-6, 2, 2.1, 0, Math.PI * 2); ctx.arc(6, 2, 2.1, 0, Math.PI * 2); ctx.fill();
    /* riders, arms up */
    for (let r = 0; r < 2; r++) {
      const px = -4 + r * 8;
      ctx.fillStyle = SKIN_TONES[(c + r) % SKIN_TONES.length];
      ctx.beginPath(); ctx.arc(px, -14, 2.8, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = HAIR_TONES[(c + r) % HAIR_TONES.length];
      ctx.beginPath(); ctx.arc(px, -15, 2.8, Math.PI * 1.05, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = SKIN_TONES[(c + r) % SKIN_TONES.length]; ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(px - 2.4, -12.5); ctx.lineTo(px - 4.5, -18);
      ctx.moveTo(px + 2.4, -12.5); ctx.lineTo(px + 4.5, -18);
      ctx.stroke();
    }
    ctx.strokeStyle = PALETTE.boneDark; ctx.lineWidth = 1.8;
    ctx.beginPath(); ctx.moveTo(-8, -11.5); ctx.lineTo(8, -11.5); ctx.stroke();
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
  ctx.fillStyle = '#558748';
  ctx.beginPath(); ctx.moveTo(x - 9, y - 10); ctx.lineTo(x - 16, y - 17); ctx.lineTo(x - 8, y - 13); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#6aa555';
  roundRect(ctx, x - 9, y - 13, 18, 10, 4.5); ctx.fill();
  ctx.beginPath(); ctx.arc(x + 9, y - 17, 5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#87c36a';
  roundRect(ctx, x - 7, y - 13, 14, 3, 1.5); ctx.fill();
  ctx.fillStyle = '#222731';
  ctx.beginPath(); ctx.arc(x + 11, y - 18, 1.1, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#426d3c';
  ctx.fillRect(x - 6, y - 4, 3.2, 5); ctx.fillRect(x + 3, y - 4, 3.2, 5);
  drawMiniPerson(ctx, x, y - 13, cloth);
}
function drawFlame(ctx, x, y, t) {
  const s = 1 + Math.sin(t * 9 + x) * 0.18;
  ctx.save();
  ctx.globalAlpha = 0.35;
  ctx.fillStyle = '#f7a24c';
  ctx.beginPath(); ctx.ellipse(x, y - 4 * s, 7 * s, 9 * s, 0, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 0.95;
  ctx.fillStyle = '#f7a24c';
  ctx.beginPath(); ctx.ellipse(x, y - 4 * s, 3.4 * s, 6 * s, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#ffe183';
  ctx.beginPath(); ctx.ellipse(x, y - 3 * s, 1.8 * s, 3.4 * s, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}
