/* Artwork for stalls, services, the dino treadmill and scenery. */

/* generic stone-age hut used by most stalls: log walls, thatch roof, counter */
function hutArt(w, h, opts) {
  const g = spriteCtx(w, h, opts.extra || 60), ctx = g.ctx;
  pad(g, opts.pad || '#a6926c', shade(opts.pad || '#a6926c', -.2));
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
  /* whatever makes this shop itself rather than a generic hut */
  if (opts.detail) opts.detail(ctx, g, cx, cy, bw, bh, wallH);

  /* A painted board hung from a crossbar. It used to be a pale disc floating
     over the roof, which is exactly what a visitor's thought looks like — a
     board on two ropes reads as a shop sign instead. */
  if (opts.emblem) {
    const peak = opts.peak || 22;
    const bwid = 26, bhig = 17;
    const top = cy - wallH - peak - bhig - 6;
    ctx.strokeStyle = '#5f4c37'; ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy - wallH - peak + 4); ctx.lineTo(cx, top - 6);
    ctx.moveTo(cx - bwid / 2 - 3, top - 6); ctx.lineTo(cx + bwid / 2 + 3, top - 6);
    ctx.stroke();
    ctx.lineWidth = 1.1;
    for (const rx of [cx - bwid / 2 + 4, cx + bwid / 2 - 4]) {
      ctx.beginPath(); ctx.moveTo(rx, top - 6); ctx.lineTo(rx, top + 1); ctx.stroke();
    }
    ctx.fillStyle = 'rgba(0,0,0,.3)';
    roundRect(ctx, cx - bwid / 2 + 1.5, top + 2.5, bwid, bhig, 3); ctx.fill();
    ctx.fillStyle = opts.emblemBg || '#f2dba7';
    roundRect(ctx, cx - bwid / 2, top, bwid, bhig, 3); ctx.fill();
    ctx.strokeStyle = '#5f4c37'; ctx.lineWidth = 1.5;
    roundRect(ctx, cx - bwid / 2, top, bwid, bhig, 3); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.32)';
    ctx.fillRect(cx - bwid / 2 + 2, top + 1.6, bwid - 4, 2.2);
    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(opts.emblem, cx, top + bhig / 2 + 0.5);
  }
  return g;
}

/* ------------------------------------------------- what tells shops apart */
/* a spit of meat over coals, off to one side of the snack bar */
function detailSpit(ctx, g, cx, cy, bw) {
  const x = cx - bw * 0.95, y = cy + 4;
  ctx.fillStyle = '#2d292c';
  ctx.beginPath(); ctx.ellipse(x, y, 8, 4, 0, 0, Math.PI * 2); ctx.fill();
  for (let i = 0; i < 4; i++) {
    ctx.fillStyle = i % 2 ? '#d16a38' : '#eca74e';
    ctx.beginPath(); ctx.ellipse(x - 4 + i * 2.6, y - 0.5, 1.6, 1, 0, 0, Math.PI * 2); ctx.fill();
  }
  ctx.strokeStyle = '#735539'; ctx.lineWidth = 1.8;
  for (const px of [x - 7, x + 7]) {
    ctx.beginPath(); ctx.moveTo(px, y - 1); ctx.lineTo(px, y - 13); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(px - 2.5, y - 16); ctx.lineTo(px, y - 13); ctx.lineTo(px + 2.5, y - 16); ctx.stroke();
  }
  ctx.strokeStyle = PALETTE.bone; ctx.lineWidth = 1.4;
  ctx.beginPath(); ctx.moveTo(x - 9, y - 13); ctx.lineTo(x + 9, y - 13); ctx.stroke();
  for (const mx of [-4, 1]) {
    ctx.fillStyle = '#9f503e';
    ctx.beginPath(); ctx.ellipse(x + mx, y - 12, 3.4, 2.6, 0.2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,220,180,.25)';
    ctx.beginPath(); ctx.ellipse(x + mx - 0.8, y - 13, 1.6, 1, 0.2, 0, Math.PI * 2); ctx.fill();
  }
  g.spit = [x, y - 16];
}

/* gourd jars and a dripping tap for the juice hut */
function detailGourds(ctx, g, cx, cy, bw) {
  const x = cx - bw * 0.9, y = cy + 5;
  for (const [ox, oy, r] of [[0, 0, 5], [8, -1, 4], [4, -7, 4.2]]) {
    ctx.fillStyle = '#957a44';
    ctx.beginPath(); ctx.ellipse(x + ox, y + oy, r, r * 0.85, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#b99c59';
    ctx.beginPath(); ctx.ellipse(x + ox - r * 0.3, y + oy - r * 0.35, r * 0.45, r * 0.32, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#52432e';
    ctx.fillRect(x + ox - 1, y + oy - r - 1.5, 2, 2.5);
  }
  g.tap = [cx + bw * 0.5, cy - 12];
}

/* a plank door with a bone handle, and no counter — it is a privy */
function detailDoor(ctx, g, cx, cy, bw, bh, wallH) {
  const dw = bw * 0.44, dh = wallH * 0.82;
  ctx.fillStyle = '#534e49';
  roundRect(ctx, cx - dw / 2, cy - dh - 1, dw, dh, 1.5); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,.3)'; ctx.lineWidth = 0.9;
  for (let i = 1; i < 3; i++) {
    ctx.beginPath();
    ctx.moveTo(cx - dw / 2 + (dw * i) / 3, cy - dh - 1);
    ctx.lineTo(cx - dw / 2 + (dw * i) / 3, cy - 1);
    ctx.stroke();
  }
  ctx.fillStyle = PALETTE.bone;
  ctx.beginPath(); ctx.ellipse(cx + dw * 0.28, cy - dh * 0.5, 1.6, 1.6, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.14)';
  roundRect(ctx, cx - dw / 2, cy - dh - 1, dw * 0.3, dh, 1.5); ctx.fill();
}

/* bundles of herbs drying under the eaves of the aid post */
function detailHerbs(ctx, g, cx, cy, bw, bh, wallH) {
  for (let i = 0; i < 3; i++) {
    const x = cx + (i - 1) * bw * 0.45, y = cy - wallH - 2;
    ctx.strokeStyle = '#867855'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + 4); ctx.stroke();
    ctx.strokeStyle = i % 2 ? '#699257' : '#517d4a'; ctx.lineWidth = 1.5;
    for (let k = -1; k <= 1; k++) {
      ctx.beginPath();
      ctx.moveTo(x, y + 4); ctx.lineTo(x + k * 2.4, y + 10);
      ctx.stroke();
    }
    ctx.fillStyle = '#cfb77c';
    ctx.fillRect(x - 2, y + 3.4, 4, 1.6);
  }
}

const goodsMeat = (ctx, x, y) => {
  ctx.fillStyle = '#ae5743';
  ctx.beginPath(); ctx.ellipse(x, y - 3, 4, 3, 0.3, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = PALETTE.bone; ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.moveTo(x + 3, y - 1); ctx.lineTo(x + 6, y + 1); ctx.stroke();
};
const goodsCup = (ctx, x, y) => {
  ctx.fillStyle = '#ead0a0';
  ctx.beginPath(); ctx.moveTo(x - 3, y - 7); ctx.lineTo(x + 3, y - 7); ctx.lineTo(x + 2, y); ctx.lineTo(x - 2, y); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#69b3d4';
  ctx.beginPath(); ctx.ellipse(x, y - 7, 3, 1.4, 0, 0, Math.PI * 2); ctx.fill();
};
const goodsPot = (ctx, x, y) => {
  ctx.fillStyle = '#625547';
  ctx.beginPath(); ctx.ellipse(x, y - 3, 4.5, 3.4, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#cb9362';
  ctx.beginPath(); ctx.ellipse(x, y - 4.5, 4.5, 2, 0, 0, Math.PI * 2); ctx.fill();
};

ART.snack   = (w, h) => hutArt(w, h, { wall: '#956944', roof: PALETTE.thatch, counter: true, emblem: '🍖',
                                       awning: ['#bc4d43', '#fae2ad'], goods: goodsMeat, detail: detailSpit,
                                       emblemBg: '#efc08d' });
ART.drinks  = (w, h) => hutArt(w, h, { wall: '#4e8786', roof: '#d3b763', counter: true, emblem: '🥤', peak: 26,
                                       awning: ['#3f7997', '#fae2ad'], goods: goodsCup, detail: detailGourds,
                                       emblemBg: '#a4d7c2' });
ART.balloon = (w, h) => hutArt(w, h, { wall: '#a4577d', roof: '#e4c463', counter: true, emblem: '🎈', peak: 18,
                                       awning: ['#a4577d', '#fae2ad'] });
ART.toilet  = (w, h) => hutArt(w, h, { wall: '#8f8879', roof: '#b8a67b', emblem: '🚻', peak: 14, wallH: 30,
                                       detail: detailDoor, emblemBg: '#d6dad8' });
ART.aid     = (w, h) => hutArt(w, h, { wall: '#806ba4', roof: '#ecddb2', emblem: '🌿', peak: 18, counter: true,
                                       goods: goodsPot, detail: detailHerbs, emblemBg: '#dcc7e4' });
ART.gate    = (w, h) => hutArt(w, h, { wall: '#836748', roof: '#c09645', counter: true, emblem: '🎟️', peak: 18,
                                       awning: ['#c09645', '#fae2ad'] });

ART.cafe = function (w, h) {
  const g = hutArt(w, h, { wall: '#825b40', roof: PALETTE.thatch, counter: true, emblem: '🍲', extra: 56, wallH: 26, peak: 26,
                           awning: ['#805638', '#fae2ad'], goods: goodsPot });
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
    ctx.fillStyle = '#e6e0d4';
    ctx.beginPath();
    ctx.arc(g.smoke[0] + sx + Math.sin(ph * 5 + i) * 5, g.smoke[1] + sy - ph * 26, 3 + ph * 5, 0, Math.PI * 2);
    ctx.fill(); ctx.restore();
  }
};
/* smoke curling off the spit, and the coals breathing under it */
ANIM.snack = function (ctx, sx, sy, g, t, b) {
  if (!g.spit) return;
  const [x0, y0] = g.spit;
  const x = sx + x0, y = sy + y0;
  ctx.save();
  for (let i = 0; i < 4; i++) {
    const p = ((t * 0.42 + i * 0.25) % 1);
    ctx.globalAlpha = (1 - p) * 0.3;
    ctx.fillStyle = '#e5dac3';
    const r = 2 + p * 5.5;
    ctx.beginPath();
    ctx.ellipse(x + Math.sin(p * 4 + i) * 4.5, y - p * 26, r, r * 0.8, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 0.3 + Math.sin(t * 3) * 0.12;
  ctx.fillStyle = '#f7a04c';
  ctx.beginPath(); ctx.ellipse(x, y + 16, 7, 3, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
};

/* a dribble from the tap into a waiting cup */
ANIM.drinks = function (ctx, sx, sy, g, t, b) {
  if (!g.tap) return;
  const [x0, y0] = g.tap;
  const p = (t * 1.3) % 1;
  ctx.save();
  ctx.globalAlpha = 1 - p * 0.8;
  ctx.fillStyle = '#8ecee3';
  ctx.beginPath();
  ctx.ellipse(sx + x0, sy + y0 + p * 11, 1.3, 2 + p, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
};

ANIM.balloon = function (ctx, sx, sy, g, t, b) {
  if (!b.worker) return;
  const [cx, cy] = [g.mid[0] + sx, g.mid[1] + sy];
  const cols = ['#dd635f', '#6593d8', '#e2c461', '#70cc64'];
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
  pad(g, '#a1875f', '#726044');
  const [cx, cy] = g.mid;
  /* timber deck */
  isoBox(ctx, cx, cy, TILE_W * 1.25, TILE_H * 1.25, 10, '#a2845d', '#5f4d38', '#7a6242');
  /* the treadmill drum the dinosaur walks on */
  ctx.fillStyle = '#645039';
  roundRect(ctx, cx - 24, cy - 26, 48, 18, 6); ctx.fill();
  ctx.fillStyle = '#836846';
  roundRect(ctx, cx - 24, cy - 26, 48, 6, 3); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.lineWidth = 1;
  for (let i = -3; i <= 3; i++) {
    ctx.beginPath(); ctx.moveTo(cx + i * 6, cy - 26); ctx.lineTo(cx + i * 6, cy - 8); ctx.stroke();
  }
  /* drive shaft across to the wheel */
  ctx.strokeStyle = '#524332'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(cx + 20, cy - 20); ctx.lineTo(cx + 30, cy - 24); ctx.stroke();
  /* wheel frame */
  g.wheel = [cx + 34, cy - 26];
  ctx.fillStyle = '#524332';
  ctx.fillRect(g.wheel[0] - 2.5, g.wheel[1], 5, 26);
  ctx.fillStyle = '#cdac6d';
  ctx.beginPath(); ctx.arc(g.wheel[0], g.wheel[1], 5, 0, Math.PI * 2); ctx.fill();
  g.dino = [cx - 2, cy - 26];
  return g;
};
ANIM.engine = function (ctx, sx, sy, g, t, b) {
  const wx = g.wheel[0] + sx, wy = g.wheel[1] + sy;
  const spin = b.worker ? t * 2.0 : 0;
  ctx.save(); ctx.translate(wx, wy); ctx.rotate(spin);
  ctx.strokeStyle = '#af8b52'; ctx.lineWidth = 3;
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * 15, Math.sin(a) * 15); ctx.stroke();
  }
  ctx.strokeStyle = '#836747'; ctx.lineWidth = 3.5;
  ctx.beginPath(); ctx.arc(0, 0, 15, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,.25)'; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.arc(0, 0, 15, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();
  /* the dinosaur plodding along on the spot */
  const bob = b.worker ? Math.abs(Math.sin(t * 4)) * 3 : 0;
  ctx.save();
  ctx.translate(g.dino[0] + sx, g.dino[1] + sy - bob);
  ctx.scale(1.35, 1.35);
  drawDinoMount(ctx, 0, 0, '#be634e');
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
  ctx.strokeStyle = '#836747'; ctx.lineWidth = 5;
  ctx.beginPath(); ctx.moveTo(cx, cy); ctx.quadraticCurveTo(cx - 4, cy - 24, cx + 2, cy - 42); ctx.stroke();
  ctx.strokeStyle = shade('#836747', -.2); ctx.lineWidth = 1;
  for (let i = 0; i < 5; i++) { const yy = cy - 6 - i * 7; ctx.beginPath(); ctx.moveTo(cx - 3, yy); ctx.lineTo(cx + 3, yy - 1); ctx.stroke(); }
  const fronds = 7;
  for (let i = 0; i < fronds; i++) {
    const a = (i / fronds) * Math.PI * 2;
    const ex = cx + 2 + Math.cos(a) * 20, ey = cy - 42 + Math.sin(a) * 9;
    ctx.strokeStyle = i % 2 ? '#4c8c46' : '#3a7139'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(cx + 2, cy - 42); ctx.quadraticCurveTo((cx + ex) / 2, ey - 10, ex, ey); ctx.stroke();
  }
  ctx.fillStyle = '#ae7636';
  ctx.beginPath(); ctx.arc(cx + 4, cy - 39, 3, 0, Math.PI * 2); ctx.arc(cx - 2, cy - 37, 2.6, 0, Math.PI * 2); ctx.fill();
  return g;
};

ART.bush = function () {
  const g = spriteCtx(1, 1, 30), ctx = g.ctx;
  const [cx, cy] = g.mid;
  blob(ctx, cx + 2, cy + 2, 10, 4, .16);
  for (const p of [[-6, -6, 8], [6, -5, 7], [0, -12, 9], [-2, -4, 8]]) {
    ctx.fillStyle = p[2] > 8 ? '#488540' : '#396d37';
    ctx.beginPath(); ctx.ellipse(cx + p[0], cy + p[1], p[2], p[2] * 0.8, 0, 0, Math.PI * 2); ctx.fill();
  }
  ctx.fillStyle = 'rgba(255,255,255,.12)';
  ctx.beginPath(); ctx.ellipse(cx - 3, cy - 14, 4, 3, 0, 0, Math.PI * 2); ctx.fill();
  return g;
};

ART.flowers = function () {
  const g = spriteCtx(1, 1, 24), ctx = g.ctx;
  const [cx, cy] = g.mid;
  ctx.fillStyle = '#396d37';
  ctx.beginPath(); ctx.ellipse(cx, cy - 2, 12, 6, 0, 0, Math.PI * 2); ctx.fill();
  const cols = ['#e46071', '#eec155', '#e193dc', '#fff8e8'];
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + 0.6;
    const fx = cx + Math.cos(a) * 8, fy = cy - 3 + Math.sin(a) * 4;
    ctx.strokeStyle = '#396d37'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(fx, fy); ctx.lineTo(fx, fy - 5); ctx.stroke();
    ctx.fillStyle = cols[i % cols.length];
    ctx.beginPath(); ctx.arc(fx, fy - 6, 2.6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff3aa';
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

/* A bench for two: a slatted seat on stone blocks with a low back, laid along
   the tile so the people sitting on it have somewhere to put their weight. */
ART.bench = function () {
  const g = spriteCtx(1, 1, 30), ctx = g.ctx;
  const [cx, cy] = g.mid;
  const W = 19, D = 7;            /* half length, and how deep the seat is */
  blob(ctx, cx, cy + 3, 19, 7, .16);

  /* stone blocks holding it up */
  for (const sx of [-W + 4, W - 4]) {
    ctx.fillStyle = '#8b8378';
    roundRect(ctx, cx + sx - 3, cy - 5, 6, 8, 1.5); ctx.fill();
    ctx.fillStyle = '#a99f8d';
    roundRect(ctx, cx + sx - 3, cy - 5, 2.4, 8, 1.2); ctx.fill();
  }

  /* the seat, given thickness by a darker front edge */
  ctx.fillStyle = shade(PALETTE.wood, -0.34);
  roundRect(ctx, cx - W, cy - 7, W * 2, 4.5, 1.6); ctx.fill();
  ctx.fillStyle = PALETTE.wood;
  roundRect(ctx, cx - W, cy - 10, W * 2, D, 2); ctx.fill();
  ctx.strokeStyle = shade(PALETTE.wood, -0.22); ctx.lineWidth = 0.9;
  for (const f of [0.34, 0.68]) {
    ctx.beginPath();
    ctx.moveTo(cx - W + 1, cy - 10 + D * f); ctx.lineTo(cx + W - 1, cy - 10 + D * f);
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(255,248,232,.22)';
  roundRect(ctx, cx - W, cy - 10, W * 2, 1.6, 0.8); ctx.fill();

  /* uprights and a two-slat back */
  ctx.fillStyle = PALETTE.woodDark;
  for (const sx of [-W + 3, W - 3]) ctx.fillRect(cx + sx - 1.4, cy - 21, 2.8, 12);
  for (const by of [-21, -16]) {
    ctx.fillStyle = shade(PALETTE.wood, by === -21 ? 0.18 : 0.06);
    roundRect(ctx, cx - W + 1, cy + by, W * 2 - 2, 3.4, 1.4); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,.16)';
    ctx.fillRect(cx - W + 1, cy + by + 2.6, W * 2 - 2, 0.9);
  }
  return g;
};

ART.sign = function () {
  const g = spriteCtx(1, 1, 40), ctx = g.ctx;
  const [cx, cy] = g.mid;
  blob(ctx, cx, cy + 2, 8, 4, .16);
  ctx.fillStyle = PALETTE.woodDark; ctx.fillRect(cx - 2, cy - 26, 4, 26);
  const arrows = [['#c9a450', -22, -10], ['#957941', -14, 12]];
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
  ctx.fillStyle = '#4d3f33';
  ctx.beginPath(); ctx.ellipse(cx, cy - 28, 5, 3, 0, 0, Math.PI * 2); ctx.fill();
  g.flame = [cx, cy - 28];
  return g;
};
ANIM.torch = function (ctx, sx, sy, g, t) { drawFlame(ctx, g.flame[0] + sx, g.flame[1] + sy, t); };

ART.fountain = function (w, h) {
  const g = spriteCtx(w, h, 44), ctx = g.ctx;
  pad(g, '#8d8471', '#666156');
  const [cx, cy] = g.mid;
  ctx.fillStyle = PALETTE.rockDark;
  ctx.beginPath(); ctx.ellipse(cx, cy, TILE_W * 0.62, TILE_H * 0.62, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#13161e';
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
  ctx.save(); ctx.globalAlpha = .75; ctx.fillStyle = '#1d1e25';
  for (let i = 0; i < 9; i++) {
    const ph = (t * 0.9 + i / 9) % 1;
    const a = (i / 9) * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(x + Math.cos(a) * ph * 15, y + ph * ph * 22 - 8 + Math.sin(a) * ph * 6, 2.4 * (1 - ph * .5), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
};

/* The main gateway: two carved totems, a lintel with the park's banner, a pair
   of ticket booths and torches. Visitors walk in under it from the road. */
ART.parkgate = function () {
  /* five tiles of canvas so the booths and banner are not clipped; the posts
     themselves stand on the middle three, which is the gap in the palisade */
  const g = spriteCtx(5, 1, 130), ctx = g.ctx;
  const l = g.C(1, 0), r = g.C(3, 0), c = g.C(2, 0);
  const H = 82;

  /* stone threshold across the opening */
  ctx.fillStyle = '#b8af9c';
  ctx.beginPath();
  ctx.moveTo(l[0] - 6, l[1] + 4); ctx.lineTo(r[0] + 6, r[1] + 4);
  ctx.lineTo(r[0] + 2, r[1] + 12); ctx.lineTo(l[0] - 2, l[1] + 12);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,.18)'; ctx.lineWidth = 1;
  for (let i = 1; i < 5; i++) {
    const x = lerp(l[0], r[0], i / 5);
    ctx.beginPath(); ctx.moveTo(x, l[1] + 4); ctx.lineTo(x - 2, l[1] + 12); ctx.stroke();
  }

  /* ticket booths just outside each totem */
  for (const [bx, by] of [[l[0] - 40, l[1] - 14], [r[0] + 40, r[1] + 22]]) {
    isoBox(ctx, bx, by, TILE_W * 0.52, TILE_H * 0.52, 20, '#956944', '#513b2c', '#714f36');
    thatchRoof(ctx, bx, by - 20, 20, 7, 13, PALETTE.thatch);
    ctx.fillStyle = shade(PALETTE.wood, .12);
    roundRect(ctx, bx - 13, by - 12, 26, 6, 2); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,.25)';
    ctx.fillRect(bx - 13, by - 7, 26, 2);
  }

  /* totem posts */
  for (const p of [l, r]) {
    ctx.fillStyle = PALETTE.woodDark;
    ctx.fillRect(p[0] - 9, p[1] - H, 18, H);
    ctx.fillStyle = shade(PALETTE.wood, .16);
    ctx.fillRect(p[0] - 9, p[1] - H, 6, H);
    ctx.fillStyle = 'rgba(0,0,0,.25)';
    ctx.fillRect(p[0] + 4, p[1] - H, 5, H);
    /* carved bands */
    ctx.strokeStyle = 'rgba(0,0,0,.3)'; ctx.lineWidth = 2;
    for (let i = 1; i < 5; i++) {
      const yy = p[1] - (H * i) / 5;
      ctx.beginPath(); ctx.moveTo(p[0] - 9, yy); ctx.lineTo(p[0] + 9, yy); ctx.stroke();
    }
    ctx.fillStyle = '#c9a450';
    for (let i = 0; i < 4; i++) {
      const yy = p[1] - 10 - i * 17;
      ctx.beginPath();
      ctx.moveTo(p[0] - 5, yy); ctx.lineTo(p[0], yy - 6); ctx.lineTo(p[0] + 5, yy); ctx.closePath(); ctx.fill();
    }
    /* base stones */
    ctx.fillStyle = PALETTE.rock;
    ctx.beginPath(); ctx.ellipse(p[0], p[1] + 2, 15, 7, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = shade(PALETTE.rock, -.2);
    ctx.beginPath(); ctx.ellipse(p[0], p[1] + 5, 15, 5, 0, 0, Math.PI * 2); ctx.fill();
    skull(ctx, p[0], p[1] - H - 12, 11);
  }

  /* lintel and banner */
  ctx.fillStyle = PALETTE.wood;
  ctx.fillRect(l[0] - 12, l[1] - H - 2, (r[0] - l[0]) + 24, 13);
  ctx.fillStyle = shade(PALETTE.wood, .18);
  ctx.fillRect(l[0] - 12, l[1] - H - 2, (r[0] - l[0]) + 24, 4);
  ctx.fillStyle = shade(PALETTE.wood, -.3);
  ctx.fillRect(l[0] - 12, l[1] - H + 8, (r[0] - l[0]) + 24, 3);

  ctx.fillStyle = PALETTE.hide;
  ctx.beginPath();
  ctx.moveTo(l[0] - 14, l[1] - H + 11);
  ctx.lineTo(r[0] + 14, r[1] - H + 11);
  ctx.lineTo(r[0] + 14, r[1] - H + 32);
  ctx.quadraticCurveTo(c[0], c[1] - H + 42, l[0] - 14, l[1] - H + 32);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = shade(PALETTE.hide, -.32); ctx.lineWidth = 2; ctx.stroke();
  /* the banner hangs across the diagonal, so write the name along it */
  ctx.save();
  ctx.translate(c[0], c[1] - H + 24);
  ctx.rotate(Math.atan2((r[1] - l[1]), (r[0] - l[0])));
  ctx.fillStyle = '#4b3327';
  ctx.font = 'bold 13px Georgia, serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('FUN PARK', 0, 0);
  ctx.restore();

  /* bunting between the totems */
  ctx.strokeStyle = '#857152'; ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(l[0], l[1] - H - 8);
  ctx.quadraticCurveTo(c[0], c[1] - H + 2, r[0], r[1] - H - 8);
  ctx.stroke();
  for (let i = 1; i < 6; i++) {
    const f = i / 6;
    const bx = lerp(l[0], r[0], f);
    const by = lerp(l[1] - H - 8, r[1] - H - 8, f) + Math.sin(f * Math.PI) * 10;
    ctx.fillStyle = i % 2 ? '#bc4d43' : '#f2dda7';
    ctx.beginPath();
    ctx.moveTo(bx - 4, by); ctx.lineTo(bx + 4, by); ctx.lineTo(bx, by + 8); ctx.closePath(); ctx.fill();
  }

  g.torches = [[l[0] - 16, l[1] + 2], [r[0] + 16, r[1] + 2]];
  for (const tp of g.torches) {
    ctx.fillStyle = PALETTE.woodDark;
    ctx.fillRect(tp[0] - 2.5, tp[1] - 30, 5, 30);
    ctx.fillStyle = PALETTE.rockDark;
    ctx.beginPath(); ctx.ellipse(tp[0], tp[1], 6, 3, 0, 0, Math.PI * 2); ctx.fill();
  }
  return g;
};
ANIM.parkgate = function (ctx, sx, sy, g, t) {
  for (const tp of g.torches) drawFlame(ctx, tp[0] + sx, tp[1] - 30 + sy, t);
};
