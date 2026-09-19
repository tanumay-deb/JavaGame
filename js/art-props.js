/* Artwork for stalls, services, the dino treadmill and scenery. */

/* generic stone-age hut used by most stalls: log walls, thatch roof, counter */
function hutArt(w, h, opts) {
  const g = spriteCtx(w, h, opts.extra || 46), ctx = g.ctx;
  pad(g, opts.pad || '#a4906a', shade(opts.pad || '#a4906a', -.2));
  const [cx, cy] = g.mid;
  const bw = TILE_W * (w * 0.42 + h * 0.42) * 0.5, bh = TILE_H * (w * 0.42 + h * 0.42) * 0.5;
  const wallH = opts.wallH || 20;
  isoBox(ctx, cx, cy, bw * 1.5, bh * 1.5, wallH, shade(opts.wall, .05), shade(opts.wall, -.28), shade(opts.wall, -.12));
  /* log seams */
  ctx.strokeStyle = 'rgba(0,0,0,.18)'; ctx.lineWidth = 1;
  for (let i = 1; i < 3; i++) {
    const yy = cy - (wallH * i) / 3;
    ctx.beginPath(); ctx.moveTo(cx - bw * 0.75, yy - bh * 0.1); ctx.lineTo(cx, yy + bh * 0.65); ctx.lineTo(cx + bw * 0.75, yy - bh * 0.1); ctx.stroke();
  }
  thatchRoof(ctx, cx, cy - wallH, bw * 0.95, bh * 0.8, opts.peak || 22, opts.roof || PALETTE.thatch);
  /* counter facing the viewer, under a striped hide awning */
  if (opts.counter) {
    const cyy = cy - wallH * 0.5;
    if (opts.awning) {
      const aw = bw * 0.72;
      for (let i = 0; i < 5; i++) {
        ctx.fillStyle = i % 2 ? opts.awning[0] : opts.awning[1];
        ctx.beginPath();
        ctx.moveTo(cx - aw + (i * 2 * aw) / 5, cyy - 13);
        ctx.lineTo(cx - aw + ((i + 1) * 2 * aw) / 5, cyy - 13);
        ctx.lineTo(cx - aw + ((i + 1) * 2 * aw) / 5, cyy - 5);
        ctx.lineTo(cx - aw + (i * 2 * aw) / 5, cyy - 5);
        ctx.closePath(); ctx.fill();
      }
      ctx.fillStyle = 'rgba(0,0,0,.18)';
      ctx.fillRect(cx - aw, cyy - 6, aw * 2, 2);
      ctx.strokeStyle = PALETTE.woodDark; ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx - aw + 2, cyy - 5); ctx.lineTo(cx - aw + 2, cyy + 6);
      ctx.moveTo(cx + aw - 2, cyy - 5); ctx.lineTo(cx + aw - 2, cyy + 6);
      ctx.stroke();
    }
    ctx.fillStyle = shade(PALETTE.wood, .12);
    roundRect(ctx, cx - bw * 0.55, cyy, bw * 1.1, 8, 2); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,.28)';
    ctx.fillRect(cx - bw * 0.55, cyy + 6, bw * 1.1, 2);
    /* goods laid out on the counter */
    if (opts.goods) for (let i = 0; i < 3; i++) opts.goods(ctx, cx + (i - 1) * 11, cyy - 1);
  }
  /* a sign hung from the ridge of the roof */
  if (opts.emblem) {
    const peak = opts.peak || 22;
    const sy = cy - wallH - peak - 6;
    ctx.strokeStyle = '#6b5233'; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(cx, cy - wallH - peak + 2); ctx.lineTo(cx, sy - 2); ctx.stroke();
    ctx.fillStyle = 'rgba(0,0,0,.3)';
    ctx.beginPath(); ctx.ellipse(cx, sy + 1.5, 9, 9, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = opts.emblemBg || '#f0e2bd';
    ctx.beginPath(); ctx.ellipse(cx, sy, 8.5, 8.5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#6b5233'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.ellipse(cx, sy, 8.5, 8.5, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(opts.emblem, cx, sy + 0.5);
  }
  return g;
}

const goodsMeat = (ctx, x, y) => {
  ctx.fillStyle = '#b5563f';
  ctx.beginPath(); ctx.ellipse(x, y - 3, 4, 3, 0.3, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = PALETTE.bone; ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.moveTo(x + 3, y - 1); ctx.lineTo(x + 6, y + 1); ctx.stroke();
};
const goodsCup = (ctx, x, y) => {
  ctx.fillStyle = '#e0c9a0';
  ctx.beginPath(); ctx.moveTo(x - 3, y - 7); ctx.lineTo(x + 3, y - 7); ctx.lineTo(x + 2, y); ctx.lineTo(x - 2, y); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#5fb0d8';
  ctx.beginPath(); ctx.ellipse(x, y - 7, 3, 1.4, 0, 0, Math.PI * 2); ctx.fill();
};
const goodsPot = (ctx, x, y) => {
  ctx.fillStyle = '#6b5a45';
  ctx.beginPath(); ctx.ellipse(x, y - 3, 4.5, 3.4, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#c98f5e';
  ctx.beginPath(); ctx.ellipse(x, y - 4.5, 4.5, 2, 0, 0, Math.PI * 2); ctx.fill();
};

ART.snack   = (w, h) => hutArt(w, h, { wall: '#9b6b40', roof: PALETTE.thatch, counter: true, emblem: '🍖',
                                       awning: ['#c44a3f', '#f0dcae'], goods: goodsMeat });
ART.drinks  = (w, h) => hutArt(w, h, { wall: '#4f8a86', roof: '#d0b45e', counter: true, emblem: '🥤', peak: 18,
                                       awning: ['#3f7d9b', '#f0dcae'], goods: goodsCup });
ART.balloon = (w, h) => hutArt(w, h, { wall: '#a8567e', roof: '#e2c15c', counter: true, emblem: '🎈', peak: 18,
                                       awning: ['#a8567e', '#f0dcae'] });
ART.toilet  = (w, h) => hutArt(w, h, { wall: '#8e8778', roof: '#b3a279', emblem: '🚻', peak: 16, wallH: 24 });
ART.aid     = (w, h) => hutArt(w, h, { wall: '#7f6aa8', roof: '#e0d6b4', emblem: '🌿', peak: 18, counter: true,
                                       goods: goodsPot });
ART.gate    = (w, h) => hutArt(w, h, { wall: '#8a6a45', roof: '#c2953f', counter: true, emblem: '🎟️', peak: 18,
                                       awning: ['#c2953f', '#f0dcae'] });

ART.cafe = function (w, h) {
  const g = hutArt(w, h, { wall: '#8b5e3c', roof: PALETTE.thatch, counter: true, emblem: '🍲', extra: 56, wallH: 26, peak: 26,
                           awning: ['#8a5a33', '#f0dcae'], goods: goodsPot });
  const ctx = g.ctx, [cx, cy] = g.mid;
  /* outdoor tables */
  const t1 = g.C(0.1, h - 0.6);
  ctx.fillStyle = PALETTE.woodDark;
  ctx.beginPath(); ctx.ellipse(t1[0], t1[1] - 10, 9, 5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillRect(t1[0] - 1.5, t1[1] - 10, 3, 10);
  ctx.fillStyle = 'rgba(0,0,0,.2)';
  ctx.beginPath(); ctx.ellipse(t1[0], t1[1] + 1, 9, 4, 0, 0, Math.PI * 2); ctx.fill();
  g.smoke = [cx + 6, cy - 46];
  return g;
};
ANIM.cafe = function (ctx, sx, sy, g, t, b) {
  if (!b.worker) return;
  for (let i = 0; i < 3; i++) {
    const ph = (t * 0.5 + i / 3) % 1;
    ctx.save();
    ctx.globalAlpha = (1 - ph) * 0.4;
    ctx.fillStyle = '#d8d8d8';
    ctx.beginPath();
    ctx.arc(g.smoke[0] + sx + Math.sin(ph * 5 + i) * 5, g.smoke[1] + sy - ph * 26, 3 + ph * 5, 0, Math.PI * 2);
    ctx.fill(); ctx.restore();
  }
};
ANIM.balloon = function (ctx, sx, sy, g, t, b) {
  if (!b.worker) return;
  const [cx, cy] = [g.mid[0] + sx, g.mid[1] + sy];
  const cols = ['#e05a5a', '#5a8fe0', '#e0c25a', '#6fd06f'];
  for (let i = 0; i < 4; i++) {
    const a = t * 0.6 + i * 1.7;
    const bx = cx + Math.sin(a) * 9 + (i - 1.5) * 6, by = cy - 40 + Math.cos(a * 1.3) * 3;
    ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(bx, by + 6); ctx.lineTo(cx, cy - 20); ctx.stroke();
    ctx.fillStyle = cols[i];
    ctx.beginPath(); ctx.ellipse(bx, by, 5, 6, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.45)';
    ctx.beginPath(); ctx.ellipse(bx - 1.6, by - 2, 1.4, 2, 0, 0, Math.PI * 2); ctx.fill();
  }
};

/* ------------------------------------------------------- dino treadmill */
ART.engine = function (w, h) {
  const g = spriteCtx(w, h, 66), ctx = g.ctx;
  pad(g, '#a2865c', '#7a6441');
  const [cx, cy] = g.mid;
  /* timber deck */
  isoBox(ctx, cx, cy, TILE_W * 1.25, TILE_H * 1.25, 10, '#a3835a', '#6a5335', '#82663f');
  /* the treadmill drum the dinosaur walks on */
  ctx.fillStyle = '#6f5636';
  roundRect(ctx, cx - 24, cy - 26, 48, 18, 6); ctx.fill();
  ctx.fillStyle = '#8a6b43';
  roundRect(ctx, cx - 24, cy - 26, 48, 6, 3); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.lineWidth = 1;
  for (let i = -3; i <= 3; i++) {
    ctx.beginPath(); ctx.moveTo(cx + i * 6, cy - 26); ctx.lineTo(cx + i * 6, cy - 8); ctx.stroke();
  }
  /* drive shaft across to the wheel */
  ctx.strokeStyle = '#5f4a2e'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(cx + 20, cy - 20); ctx.lineTo(cx + 30, cy - 24); ctx.stroke();
  /* wheel frame */
  g.wheel = [cx + 34, cy - 26];
  ctx.fillStyle = '#5f4a2e';
  ctx.fillRect(g.wheel[0] - 2.5, g.wheel[1], 5, 26);
  ctx.fillStyle = '#c9a86a';
  ctx.beginPath(); ctx.arc(g.wheel[0], g.wheel[1], 5, 0, Math.PI * 2); ctx.fill();
  g.dino = [cx - 2, cy - 26];
  return g;
};
ANIM.engine = function (ctx, sx, sy, g, t, b) {
  const wx = g.wheel[0] + sx, wy = g.wheel[1] + sy;
  const spin = b.worker ? t * 2.0 : 0;
  ctx.save(); ctx.translate(wx, wy); ctx.rotate(spin);
  ctx.strokeStyle = '#b08a4e'; ctx.lineWidth = 3;
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * 15, Math.sin(a) * 15); ctx.stroke();
  }
  ctx.strokeStyle = '#8a6a44'; ctx.lineWidth = 3.5;
  ctx.beginPath(); ctx.arc(0, 0, 15, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,.25)'; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.arc(0, 0, 15, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();
  /* the dinosaur plodding along on the spot */
  const bob = b.worker ? Math.abs(Math.sin(t * 4)) * 3 : 0;
  ctx.save();
  ctx.translate(g.dino[0] + sx, g.dino[1] + sy - bob);
  ctx.scale(1.35, 1.35);
  drawDinoMount(ctx, 0, 0, '#c2604a');
  ctx.restore();
  if (!b.worker) {
    ctx.font = '13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('💤', g.dino[0] + sx + 16, g.dino[1] + sy - 20);
  }
};

/* --------------------------------------------------------------- scenery */
ART.palm = function () {
  const g = spriteCtx(1, 1, 60), ctx = g.ctx;
  const [cx, cy] = g.mid;
  blob(ctx, cx + 3, cy + 2, 11, 5, .18);
  ctx.strokeStyle = '#8a6a44'; ctx.lineWidth = 5;
  ctx.beginPath(); ctx.moveTo(cx, cy); ctx.quadraticCurveTo(cx - 4, cy - 24, cx + 2, cy - 42); ctx.stroke();
  ctx.strokeStyle = shade('#8a6a44', -.2); ctx.lineWidth = 1;
  for (let i = 0; i < 5; i++) { const yy = cy - 6 - i * 7; ctx.beginPath(); ctx.moveTo(cx - 3, yy); ctx.lineTo(cx + 3, yy - 1); ctx.stroke(); }
  const fronds = 7;
  for (let i = 0; i < fronds; i++) {
    const a = (i / fronds) * Math.PI * 2;
    const ex = cx + 2 + Math.cos(a) * 20, ey = cy - 42 + Math.sin(a) * 9;
    ctx.strokeStyle = i % 2 ? '#4f9a46' : '#3f8138'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(cx + 2, cy - 42); ctx.quadraticCurveTo((cx + ex) / 2, ey - 10, ex, ey); ctx.stroke();
  }
  ctx.fillStyle = '#b5772f';
  ctx.beginPath(); ctx.arc(cx + 4, cy - 39, 3, 0, Math.PI * 2); ctx.arc(cx - 2, cy - 37, 2.6, 0, Math.PI * 2); ctx.fill();
  return g;
};

ART.bush = function () {
  const g = spriteCtx(1, 1, 30), ctx = g.ctx;
  const [cx, cy] = g.mid;
  blob(ctx, cx + 2, cy + 2, 10, 4, .16);
  for (const p of [[-6, -6, 8], [6, -5, 7], [0, -12, 9], [-2, -4, 8]]) {
    ctx.fillStyle = p[2] > 8 ? '#4c9440' : '#3f7d36';
    ctx.beginPath(); ctx.ellipse(cx + p[0], cy + p[1], p[2], p[2] * 0.8, 0, 0, Math.PI * 2); ctx.fill();
  }
  ctx.fillStyle = 'rgba(255,255,255,.12)';
  ctx.beginPath(); ctx.ellipse(cx - 3, cy - 14, 4, 3, 0, 0, Math.PI * 2); ctx.fill();
  return g;
};

ART.flowers = function () {
  const g = spriteCtx(1, 1, 24), ctx = g.ctx;
  const [cx, cy] = g.mid;
  ctx.fillStyle = '#3f7d36';
  ctx.beginPath(); ctx.ellipse(cx, cy - 2, 12, 6, 0, 0, Math.PI * 2); ctx.fill();
  const cols = ['#e8556d', '#f0c04a', '#d98ae0', '#f2f2f2'];
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + 0.6;
    const fx = cx + Math.cos(a) * 8, fy = cy - 3 + Math.sin(a) * 4;
    ctx.strokeStyle = '#3f7d36'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(fx, fy); ctx.lineTo(fx, fy - 5); ctx.stroke();
    ctx.fillStyle = cols[i % cols.length];
    ctx.beginPath(); ctx.arc(fx, fy - 6, 2.6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff2a8';
    ctx.beginPath(); ctx.arc(fx, fy - 6, 1, 0, Math.PI * 2); ctx.fill();
  }
  return g;
};

ART.rock = function () {
  const g = spriteCtx(1, 1, 30), ctx = g.ctx;
  const [cx, cy] = g.mid;
  blob(ctx, cx + 2, cy + 2, 12, 5, .2);
  ctx.fillStyle = PALETTE.rock;
  ctx.beginPath();
  ctx.moveTo(cx - 13, cy + 2); ctx.lineTo(cx - 7, cy - 13); ctx.lineTo(cx + 4, cy - 16);
  ctx.lineTo(cx + 13, cy - 4); ctx.lineTo(cx + 8, cy + 3); ctx.closePath(); ctx.fill();
  ctx.fillStyle = shade(PALETTE.rock, .18);
  ctx.beginPath(); ctx.moveTo(cx - 7, cy - 13); ctx.lineTo(cx + 4, cy - 16); ctx.lineTo(cx + 1, cy - 7); ctx.closePath(); ctx.fill();
  ctx.fillStyle = PALETTE.rockDark;
  ctx.beginPath(); ctx.moveTo(cx + 4, cy - 16); ctx.lineTo(cx + 13, cy - 4); ctx.lineTo(cx + 6, cy - 3); ctx.closePath(); ctx.fill();
  return g;
};

ART.bench = function () {
  const g = spriteCtx(1, 1, 28), ctx = g.ctx;
  const [cx, cy] = g.mid;
  blob(ctx, cx, cy + 2, 13, 5, .16);
  ctx.fillStyle = PALETTE.woodDark;
  ctx.fillRect(cx - 12, cy - 6, 3, 8); ctx.fillRect(cx + 9, cy - 6, 3, 8);
  ctx.fillStyle = PALETTE.wood;
  roundRect(ctx, cx - 15, cy - 9, 30, 5, 2); ctx.fill();
  ctx.fillStyle = shade(PALETTE.wood, .15);
  roundRect(ctx, cx - 15, cy - 17, 30, 4, 2); ctx.fill();
  ctx.fillStyle = shade(PALETTE.wood, -.25);
  ctx.fillRect(cx - 15, cy - 5, 30, 1.5);
  return g;
};

ART.sign = function () {
  const g = spriteCtx(1, 1, 40), ctx = g.ctx;
  const [cx, cy] = g.mid;
  blob(ctx, cx, cy + 2, 8, 4, .16);
  ctx.fillStyle = PALETTE.woodDark; ctx.fillRect(cx - 2, cy - 26, 4, 26);
  const arrows = [['#c9a24a', -22, -10], ['#9b7b3c', -14, 12]];
  for (const a of arrows) {
    ctx.fillStyle = a[0];
    ctx.beginPath();
    ctx.moveTo(cx + a[2] > cx ? cx : cx - 14, cy + a[1]);
    ctx.lineTo(cx + 14, cy + a[1]); ctx.lineTo(cx + 19, cy + a[1] + 4); ctx.lineTo(cx + 14, cy + a[1] + 8);
    ctx.lineTo(cx - 14, cy + a[1] + 8); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,.25)';
    ctx.fillRect(cx - 10, cy + a[1] + 3, 16, 1.5);
  }
  return g;
};

ART.torch = function () {
  const g = spriteCtx(1, 1, 44), ctx = g.ctx;
  const [cx, cy] = g.mid;
  blob(ctx, cx, cy + 2, 7, 3.5, .18);
  ctx.fillStyle = PALETTE.rockDark;
  ctx.beginPath(); ctx.ellipse(cx, cy, 7, 3.5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = PALETTE.woodDark; ctx.fillRect(cx - 2.5, cy - 28, 5, 28);
  ctx.fillStyle = '#5a4630';
  ctx.beginPath(); ctx.ellipse(cx, cy - 28, 5, 3, 0, 0, Math.PI * 2); ctx.fill();
  g.flame = [cx, cy - 28];
  return g;
};
ANIM.torch = function (ctx, sx, sy, g, t) { drawFlame(ctx, g.flame[0] + sx, g.flame[1] + sy, t); };

ART.fountain = function (w, h) {
  const g = spriteCtx(w, h, 44), ctx = g.ctx;
  pad(g, '#8d8470', '#6d6555');
  const [cx, cy] = g.mid;
  ctx.fillStyle = PALETTE.rockDark;
  ctx.beginPath(); ctx.ellipse(cx, cy, TILE_W * 0.62, TILE_H * 0.62, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#211d1a';
  ctx.beginPath(); ctx.ellipse(cx, cy - 2, TILE_W * 0.52, TILE_H * 0.52, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.08)';
  ctx.beginPath(); ctx.ellipse(cx - 8, cy - 5, 9, 4, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = PALETTE.rock;
  ctx.beginPath(); ctx.moveTo(cx - 7, cy - 4); ctx.lineTo(cx - 3, cy - 22); ctx.lineTo(cx + 3, cy - 22); ctx.lineTo(cx + 7, cy - 4); ctx.closePath(); ctx.fill();
  g.spout = [cx, cy - 22];
  return g;
};
ANIM.fountain = function (ctx, sx, sy, g, t) {
  const x = g.spout[0] + sx, y = g.spout[1] + sy;
  ctx.save(); ctx.globalAlpha = .75; ctx.fillStyle = '#2b2622';
  for (let i = 0; i < 9; i++) {
    const ph = (t * 0.9 + i / 9) % 1;
    const a = (i / 9) * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(x + Math.cos(a) * ph * 15, y + ph * ph * 22 - 8 + Math.sin(a) * ph * 6, 2.4 * (1 - ph * .5), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
};

/* the park gate, drawn once at the entrance tile */
ART.parkgate = function () {
  const g = spriteCtx(3, 1, 64), ctx = g.ctx;
  const l = g.C(0, 0), r = g.C(2, 0), c = g.C(1, 0);
  post(g, 0, 0, 44, 5, PALETTE.wood);
  post(g, 2, 0, 44, 5, PALETTE.wood);
  ctx.fillStyle = PALETTE.hide;
  ctx.beginPath();
  ctx.moveTo(l[0], l[1] - 44); ctx.lineTo(r[0], r[1] - 44);
  ctx.lineTo(r[0], r[1] - 26); ctx.quadraticCurveTo(c[0], c[1] - 34, l[0], l[1] - 26);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = shade(PALETTE.hide, -.3); ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = '#5b3a22';
  ctx.font = 'bold 13px Georgia, serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('FUN PARK', c[0], c[1] - 37);
  skull(ctx, l[0], l[1] - 50, 7);
  skull(ctx, r[0], r[1] - 50, 7);
  return g;
};
