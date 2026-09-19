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
function getSprite(art, w, h, rot) {
  const key = art + '|' + w + 'x' + h + '|' + (rot || 0);
  let s = _spriteCache.get(key);
  if (s) return s;
  const fn = ART[art] || ART.fallback;
  s = fn(w, h, rot || 0);
  _spriteCache.set(key, s);
  return s;
}

ART.fallback = function (w, h) {
  const g = spriteCtx(w, h, 26);
  pad(g, '#8a7a5c', '#6d6046');
  isoBox(g.ctx, g.mid[0], g.mid[1], TILE_W * 0.7, TILE_H * 0.7, 22, '#c0705a', '#7d4536', '#9a5644');
  return g;
};
