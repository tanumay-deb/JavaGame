/* Procedural isometric sprite factory.
   Every building is drawn once into an offscreen canvas and then blitted, so the
   art can be detailed without costing anything per frame. Moving parts (wheels,
   swings, water) are drawn live on top by ANIM handlers in art-rides.js. */

const ART = {};    // art id -> function(g, spec)  static structure
const ANIM = {};   // art id -> function(ctx, x, y, spec, t, b)  moving parts

const _spriteCache = new Map();

/* Build a drawing context for a footprint of w x h tiles with `extra` px of
   headroom above the ground plane. g.P(tx,ty) converts local tile coords into
   canvas pixels; g.C(tx,ty) does the same for the centre of a tile. */
function spriteCtx(w, h, extra) {
  const cw = (w + h) * (TILE_W / 2);
  const ch = (w + h) * (TILE_H / 2) + extra;
  const c = makeCanvas(cw, ch);
  const ctx = c.getContext('2d');
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  const ox = h * (TILE_W / 2), oy = extra;
  const g = {
    c, ctx, w, h, ox, oy, extra,
    P: (tx, ty) => [isoX(tx, ty) + ox, isoY(tx, ty) + oy],
    C: (tx, ty) => [isoX(tx + 0.5, ty + 0.5) + ox, isoY(tx + 0.5, ty + 0.5) + oy]
  };
  g.mid = g.C((w - 1) / 2, (h - 1) / 2);
  return g;
}

/* ---------------------------------------------------------- ride fencing */
/* A run of fence between two points inside a sprite. */
function fenceRun(ctx, x1, y1, x2, y2, h) {
  h = h || 15;
  ctx.strokeStyle = '#7d6647'; ctx.lineWidth = 2.2;
  for (const d of [h - 4, h - 10]) {
    ctx.beginPath(); ctx.moveTo(x1, y1 - d); ctx.lineTo(x2, y2 - d); ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(255,255,255,.14)'; ctx.lineWidth = 0.9;
  ctx.beginPath(); ctx.moveTo(x1, y1 - h + 3); ctx.lineTo(x2, y2 - h + 3); ctx.stroke();
  for (const f of [0, 1]) {
    const px = lerp(x1, x2, f), py = lerp(y1, y2, f);
    ctx.fillStyle = PALETTE.woodDark;
    ctx.fillRect(px - 1.8, py - h, 3.6, h);
    ctx.fillStyle = shade(PALETTE.wood, 0.18);
    ctx.fillRect(px - 1.8, py - h, 1.4, h);
    ctx.fillStyle = shade(PALETTE.wood, -0.4);
    ctx.beginPath();
    ctx.moveTo(px - 1.8, py - h); ctx.lineTo(px, py - h - 2.6); ctx.lineTo(px + 1.8, py - h);
    ctx.closePath(); ctx.fill();
  }
}

/* Fence the footprint of a ride, leaving the entrance and exit tiles open.
   `side` picks the two edges that belong behind the ride or in front of it. */
function rideFence(g, item, rot, side) {
  const w = g.w, h = g.h;
  const e = park.rotPoint(item.ent[0], item.ent[1], item.w, item.h, rot);
  const x2 = park.rotPoint(item.ext[0], item.ext[1], item.w, item.h, rot);
  const open = (tx, ty, edge) => {
    for (const d of [e, x2]) {
      if (d[0] !== tx || d[1] !== ty) continue;
      if (edge === 'n' && ty === 0) return true;
      if (edge === 's' && ty === h - 1) return true;
      if (edge === 'w' && tx === 0) return true;
      if (edge === 'e' && tx === w - 1) return true;
    }
    return false;
  };
  const ctx = g.ctx;
  if (side === 'back') {
    for (let i = 0; i < w; i++) if (!open(i, 0, 'n')) fenceRun(ctx, ...g.P(i, 0), ...g.P(i + 1, 0));
    for (let j = 0; j < h; j++) if (!open(0, j, 'w')) fenceRun(ctx, ...g.P(0, j), ...g.P(0, j + 1));
  } else {
    for (let i = 0; i < w; i++) if (!open(i, h - 1, 's')) fenceRun(ctx, ...g.P(i, h), ...g.P(i + 1, h));
    for (let j = 0; j < h; j++) if (!open(w - 1, j, 'e')) fenceRun(ctx, ...g.P(w, j), ...g.P(w, j + 1));
  }
}

/* ground pad under a building so it does not float on the grass */
function pad(g, col, edge, inset) {
  const { ctx, w, h } = g;
  inset = inset === undefined ? 0.06 : inset;
  const a = g.P(inset, inset), b = g.P(w - inset, inset), c = g.P(w - inset, h - inset), d = g.P(inset, h - inset);
  ctx.beginPath();
  ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.lineTo(c[0], c[1]); ctx.lineTo(d[0], d[1]);
  ctx.closePath();
  ctx.fillStyle = col; ctx.fill();
  ctx.strokeStyle = edge; ctx.lineWidth = 1.5; ctx.stroke();
  /* the far side of the ride's fence goes down before the ride itself */
  const spec = ART._spec;
  if (spec && spec.item && spec.item.cat === 'ride') rideFence(g, spec.item, spec.rot, 'back');
}

/* a log post standing on the ground plane */
function post(g, tx, ty, height, rad, col) {
  const [x, y] = g.C(tx, ty);
  const ctx = g.ctx;
  ctx.fillStyle = shade(col, -0.35);
  ctx.beginPath(); ctx.ellipse(x, y, rad, rad * 0.5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = col;
  ctx.fillRect(x - rad, y - height, rad * 2, height);
  ctx.fillStyle = shade(col, -0.22);
  ctx.fillRect(x + rad * 0.35, y - height, rad * 0.65, height);
  ctx.fillStyle = shade(col, 0.25);
  ctx.beginPath(); ctx.ellipse(x, y - height, rad, rad * 0.5, 0, 0, Math.PI * 2); ctx.fill();
  return [x, y];
}

/* thatched conical roof centred on (x,y) */
function thatchRoof(ctx, x, y, rw, rh, peak, col) {
  const dark = shade(col, -0.3), lite = shade(col, 0.18);
  ctx.fillStyle = dark;
  ctx.beginPath();
  ctx.moveTo(x - rw, y); ctx.lineTo(x, y + rh); ctx.lineTo(x, y - peak); ctx.closePath(); ctx.fill();
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.moveTo(x + rw, y); ctx.lineTo(x, y + rh); ctx.lineTo(x, y - peak); ctx.closePath(); ctx.fill();
  ctx.fillStyle = lite;
  ctx.beginPath();
  ctx.moveTo(x - rw, y); ctx.lineTo(x, y - rh); ctx.lineTo(x, y - peak); ctx.closePath(); ctx.fill();
  ctx.fillStyle = shade(col, 0.05);
  ctx.beginPath();
  ctx.moveTo(x + rw, y); ctx.lineTo(x, y - rh); ctx.lineTo(x, y - peak); ctx.closePath(); ctx.fill();
  /* straw strokes */
  ctx.strokeStyle = 'rgba(0,0,0,.14)'; ctx.lineWidth = 1;
  for (let i = -3; i <= 3; i++) {
    ctx.beginPath();
    ctx.moveTo(x, y - peak);
    ctx.lineTo(x + (rw * i) / 3, y + (i === 0 ? rh : rh * (1 - Math.abs(i) / 3) * 0.4));
    ctx.stroke();
  }
}

/* hide/cloth canopy with stripes */
function canopy(ctx, x, y, rw, rh, peak, c1, c2) {
  const segs = 8;
  for (let i = 0; i < segs; i++) {
    const a0 = (i / segs) * Math.PI * 2, a1 = ((i + 1) / segs) * Math.PI * 2;
    ctx.fillStyle = i % 2 ? c1 : c2;
    ctx.beginPath();
    ctx.moveTo(x, y - peak);
    ctx.lineTo(x + Math.cos(a0) * rw, y + Math.sin(a0) * rh);
    ctx.lineTo(x + Math.cos(a1) * rw, y + Math.sin(a1) * rh);
    ctx.closePath(); ctx.fill();
  }
  ctx.fillStyle = 'rgba(0,0,0,.18)';
  ctx.beginPath(); ctx.ellipse(x, y, rw, rh, 0, 0, Math.PI); ctx.fill();
}

/* small bone / skull decoration */
function skull(ctx, x, y, s) {
  ctx.fillStyle = PALETTE.bone;
  ctx.beginPath(); ctx.ellipse(x, y, s, s * 0.8, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#5b5340';
  ctx.beginPath(); ctx.ellipse(x - s * 0.35, y - s * 0.1, s * 0.22, s * 0.26, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(x + s * 0.35, y - s * 0.1, s * 0.22, s * 0.26, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = PALETTE.boneDark;
  ctx.fillRect(x - s * 0.3, y + s * 0.45, s * 0.6, s * 0.3);
}

/* cached sprite lookup. rot is baked in so asymmetric art can face the right way */
function getSprite(art, w, h, rot, item) {
  const key = art + '|' + w + 'x' + h + '|' + (rot || 0);
  let s = _spriteCache.get(key);
  if (s) return s;
  const fn = ART[art] || ART.fallback;
  ART._spec = { item, rot: rot || 0 };
  s = fn(w, h, rot || 0);
  if (item && item.cat === 'ride') rideFence(s, item, rot || 0, 'front');
  ART._spec = null;
  _spriteCache.set(key, s);
  return s;
}

ART.fallback = function (w, h) {
  const g = spriteCtx(w, h, 26);
  pad(g, '#8a7a5c', '#6d6046');
  isoBox(g.ctx, g.mid[0], g.mid[1], TILE_W * 0.7, TILE_H * 0.7, 22, '#c0705a', '#7d4536', '#9a5644');
  return g;
};
