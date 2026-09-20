/* Small helpers shared by the whole game. */

const clamp = (v, a, b) => v < a ? a : (v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const dist2 = (ax, ay, bx, by) => { const dx = ax - bx, dy = ay - by; return dx * dx + dy * dy; };
const rnd = (a = 1, b) => b === undefined ? Math.random() * a : a + Math.random() * (b - a);
const rndInt = (a, b) => Math.floor(rnd(a, b + 1));
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const chance = p => Math.random() < p;
const money = n => (n < 0 ? '-$' : '$') + Math.abs(Math.round(n)).toLocaleString('en-US');

/* deterministic per-tile noise so grass texture does not crawl */
function hash2(x, y) {
  let h = x * 374761393 + y * 668265263;
  h = (h ^ (h >> 13)) * 1274126177;
  return ((h ^ (h >> 16)) >>> 0) / 4294967295;
}

/* smooth value noise built on hash2 — used for the landscape beyond the park */
function noise2(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  return lerp(lerp(hash2(xi, yi), hash2(xi + 1, yi), u),
              lerp(hash2(xi, yi + 1), hash2(xi + 1, yi + 1), u), v);
}
function fbm(x, y) {
  return noise2(x, y) * 0.55 + noise2(x * 2.1, y * 2.1) * 0.3 + noise2(x * 4.3, y * 4.3) * 0.15;
}

/* ------------------------------------------------------- iso projection */
function isoX(tx, ty) { return (tx - ty) * (TILE_W / 2); }
function isoY(tx, ty) { return (tx + ty) * (TILE_H / 2); }

/* world (iso px) -> fractional tile coords */
function unIso(wx, wy) {
  const a = wx / (TILE_W / 2), b = wy / (TILE_H / 2);
  return { x: (b + a) / 2, y: (b - a) / 2 };
}

/* --------------------------------------------------------------- colour */
function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  if (amt >= 0) { r += (255 - r) * amt; g += (255 - g) * amt; b += (255 - b) * amt; }
  else { r *= (1 + amt); g *= (1 + amt); b *= (1 + amt); }
  return '#' + [r, g, b].map(v => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, '0')).join('');
}

function mixColor(a, b, t) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const r = lerp((pa >> 16) & 255, (pb >> 16) & 255, t);
  const g = lerp((pa >> 8) & 255, (pb >> 8) & 255, t);
  const bl = lerp(pa & 255, pb & 255, t);
  return '#' + [r, g, bl].map(v => Math.round(v).toString(16).padStart(2, '0')).join('');
}

/* ------------------------------------------------------------ 2d canvas */
function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w));
  c.height = Math.max(1, Math.ceil(h));
  return c;
}

/* draw a filled iso diamond centred on (cx,cy) */
function diamond(ctx, cx, cy, w, h) {
  ctx.beginPath();
  ctx.moveTo(cx, cy - h / 2);
  ctx.lineTo(cx + w / 2, cy);
  ctx.lineTo(cx, cy + h / 2);
  ctx.lineTo(cx - w / 2, cy);
  ctx.closePath();
}

/* an iso box: top face + two visible side faces. (cx,cy) = centre of base. */
function isoBox(ctx, cx, cy, tw, th, height, topCol, leftCol, rightCol) {
  const topY = cy - height;
  ctx.fillStyle = leftCol;
  ctx.beginPath();
  ctx.moveTo(cx - tw / 2, cy - th / 2 + th / 2);
  ctx.lineTo(cx, cy + th / 2);
  ctx.lineTo(cx, cy + th / 2 - height);
  ctx.lineTo(cx - tw / 2, cy - height);
  ctx.closePath(); ctx.fill();

  ctx.fillStyle = rightCol;
  ctx.beginPath();
  ctx.moveTo(cx + tw / 2, cy);
  ctx.lineTo(cx, cy + th / 2);
  ctx.lineTo(cx, cy + th / 2 - height);
  ctx.lineTo(cx + tw / 2, cy - height);
  ctx.closePath(); ctx.fill();

  ctx.fillStyle = topCol;
  diamond(ctx, cx, topY, tw, th);
  ctx.fill();
}

/* soft elliptical shadow */
function blob(ctx, cx, cy, rx, ry, alpha) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/* An ellipse as its own subpath. Without the moveTo, canvas joins it to
   whatever is already in the path with a straight line — which, when a whole
   batch of them is filled at once, paints huge wedges across the map. */
function ellipseSub(ctx, cx, cy, rx, ry, rot) {
  rot = rot || 0;
  ctx.moveTo(cx + Math.cos(rot) * rx, cy + Math.sin(rot) * rx);
  ctx.ellipse(cx, cy, rx, ry, rot, 0, Math.PI * 2);
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
