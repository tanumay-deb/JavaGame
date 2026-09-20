/* Procedural isometric sprite factory.
   Every building is drawn once into an offscreen canvas and then blitted, so the
   art can be detailed without costing anything per frame. Moving parts (wheels,
   swings, water) are drawn live on top by ANIM handlers in art-rides.js. */

const ART = {};    // art id -> function(g, spec)  static structure
const ANIM = {};   // art id -> function(ctx, x, y, spec, t, b)  moving parts

const _spriteCache = new Map();

/* a stand-in building so a ghost can show its moving parts before it exists */
const GHOST_BUILDING = { powered: true, open: true, riders: [{}, {}], worker: 1, queue: [], spinPhase: 0 };

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

/* The tight box of non-transparent pixels in a sprite, worked out once, so a
   thumbnail can crop away the headroom the artwork leaves for tall rides. */
function spriteBounds(spr) {
  if (spr.bounds) return spr.bounds;
  const w = spr.c.width, h = spr.c.height;
  let x0 = w, y0 = h, x1 = 0, y1 = 0;
  try {
    const d = spr.c.getContext('2d').getImageData(0, 0, w, h).data;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (d[(y * w + x) * 4 + 3] < 12) continue;
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  } catch (e) { /* fall back to the whole canvas */ }
  if (x1 < x0 || y1 < y0) { x0 = 0; y0 = 0; x1 = w - 1; y1 = h - 1; }
  spr.bounds = { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
  return spr.bounds;
}

/* A flat silhouette of a sprite in one colour, cached per colour. Used for
   cast shadows and for the warm rim light along each sprite's sunward edge. */
function spriteSilhouette(spr, colour) {
  spr._sil = spr._sil || {};
  if (spr._sil[colour]) return spr._sil[colour];
  const c = makeCanvas(spr.c.width, spr.c.height);
  const x = c.getContext('2d');
  x.drawImage(spr.c, 0, 0);
  x.globalCompositeOperation = 'source-in';
  x.fillStyle = colour;
  x.fillRect(0, 0, c.width, c.height);
  spr._sil[colour] = c;
  return c;
}

/* The sun sits behind the camera to the north-west, so every sprite gets a
   sliver of warm light on its upper-left edge and throws its shadow forward. */
function addRimLight(spr, scale, colour) {
  const s = scale || 1;
  const rim = spriteSilhouette(spr, colour || 'rgba(255,241,206,0.9)');
  const ctx = spr.ctx || spr.c.getContext('2d');
  ctx.save();
  ctx.globalCompositeOperation = 'destination-over';
  ctx.drawImage(rim, -1.4 * s, -1.6 * s);
  ctx.restore();
  spr._sil = {};                 /* silhouettes must be re-cut to include the rim */
}

/* A one-off picture of a building for menus and panels: the static sprite with
   its moving parts drawn in, cropped to what is actually painted. */
const _previewCache = new Map();
function getPreview(key) {
  if (_previewCache.has(key)) return _previewCache.get(key);
  const item = ITEMS[key];
  const spr = getSprite(item.art, item.w || 1, item.h || 1, 0, item);
  const pad = 90;
  const c = makeCanvas(spr.c.width + pad * 2, spr.c.height + pad * 2);
  const ctx = c.getContext('2d');
  ctx.translate(pad, pad);
  ctx.drawImage(spr.c, 0, 0);
  const anim = ANIM[item.art];
  if (anim) { try { anim(ctx, 0, 0, spr, 0.75, GHOST_BUILDING); } catch (e) { /* static only */ } }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const prev = { c };
  prev.bounds = spriteBounds(prev);
  _previewCache.set(key, prev);
  return prev;
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
  addRimLight(s);
  _spriteCache.set(key, s);
  return s;
}

ART.fallback = function (w, h) {
  const g = spriteCtx(w, h, 26);
  pad(g, '#8a7a5c', '#6d6046');
  isoBox(g.ctx, g.mid[0], g.mid[1], TILE_W * 0.7, TILE_H * 0.7, 22, '#c0705a', '#7d4536', '#9a5644');
  return g;
};

/* ------------------------------------------------------------- visitors */
/* A person is two dozen little shapes, and a busy park draws sixty of them
   every frame. Each pose is baked once into a small canvas instead, keyed by
   the look — the palettes are short, so the cache stays small. Poses are
   drawn at 2x and blitted at half size so faces stay crisp when zoomed in. */
const PERSON_FRAMES = 8;                 /* one full stride */
const PERSON_SIT = PERSON_FRAMES + 1;    /* the pose for somebody on a bench */
const PERSON_W = 28, PERSON_H = 38;      /* in world pixels */
const PERSON_AX = 14, PERSON_AY = 32;    /* where the feet sit in that box */
const PERSON_SS = 2;
const _personCache = new Map();

/* The tool a staff member carries. Held in the front hand, so it reads as a
   trade from across the park even when the badge is too small to make out. */
function staffTool(ctx, role, x, y, col) {
  ctx.lineCap = 'round';
  const shaft = (len, lean) => {
    ctx.strokeStyle = '#7d5a35'; ctx.lineWidth = 1.7;
    ctx.beginPath(); ctx.moveTo(x, y + 2); ctx.lineTo(x - lean, y - len); ctx.stroke();
  };
  if (role === 'guard') {                       /* spear */
    shaft(16, 1.5);
    ctx.fillStyle = '#cfd4d8';
    ctx.beginPath();
    ctx.moveTo(x - 1.5, y - 16); ctx.lineTo(x - 4, y - 21); ctx.lineTo(x + 1, y - 20.5);
    ctx.closePath(); ctx.fill();
  } else if (role === 'repairman') {            /* hammer */
    shaft(11, 1);
    ctx.fillStyle = '#9aa0a6';
    roundRect(ctx, x - 4.6, y - 14.5, 7.2, 3.6, 1.2); ctx.fill();
  } else if (role === 'cook') {                 /* ladle */
    shaft(12, 1.2);
    ctx.fillStyle = '#c9c2b2';
    ctx.beginPath(); ctx.ellipse(x - 1.4, y - 13, 3, 2.4, 0.3, 0, Math.PI * 2); ctx.fill();
  } else if (role === 'salesman') {             /* basket of wares */
    ctx.fillStyle = '#a97b45';
    roundRect(ctx, x - 5, y - 4, 9, 6, 1.6); ctx.fill();
    ctx.strokeStyle = '#7d5a35'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.arc(x - 0.5, y - 4, 4.2, Math.PI, 0); ctx.stroke();
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.arc(x - 2.4, y - 3.4, 1.5, 0, Math.PI * 2);
    ctx.moveTo(x + 2.6, y - 3); ctx.arc(x + 1.2, y - 3, 1.4, 0, Math.PI * 2); ctx.fill();
  } else if (role === 'shaman') {               /* gourd staff */
    shaft(18, 1.6);
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.ellipse(x - 2.6, y - 18.5, 2.8, 3.4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#6f9e5a'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(x - 2.6, y - 21); ctx.lineTo(x - 5.4, y - 23.5); ctx.stroke();
  } else {                                      /* rider: a coil of rein */
    ctx.strokeStyle = '#8a6a44'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(x - 1.5, y - 1, 3.4, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(x - 1.5, y - 3.4, 2.4, 0, Math.PI * 2); ctx.stroke();
  }
}

function paintPerson(ctx, look, frame) {
  const k = look.kid ? 0.78 : 1;
  const sitting = frame === PERSON_SIT;
  const H = (sitting ? 14 : 18) * k;
  const walking = frame < PERSON_FRAMES;
  const a = walking ? (frame / PERSON_FRAMES) * Math.PI * 2 : 0;
  const swing = walking ? Math.sin(a) : 0;
  const bob = walking ? Math.abs(Math.sin(a)) * 2 : 0;   /* up on every step */
  const bodyY = -H - bob;
  const hipY = -6 * k - bob;


  const skinDark = shade(look.skin, -0.34);
  const skinMid = shade(look.skin, -0.12);
  const skinLit = shade(look.skin, 0.16);

  /* legs — the trailing one is darker so the stride reads at a glance */
  for (const L of sitting ? [] : [{ x: -3.9, ph: -swing, c: skinDark }, { x: 1.1, ph: swing, c: skinMid }]) {
    const len = Math.max(2.5, 6 * k + L.ph * 1.7);
    ctx.fillStyle = L.c;
    roundRect(ctx, L.x, hipY, 2.8, len, 1.3); ctx.fill();
    ctx.fillStyle = '#6b4a2c';                                  /* hide sandal */
    roundRect(ctx, L.x - 0.7, hipY + len - 1.7, 4.2, 2.5, 1.1); ctx.fill();
  }

  /* back arm, behind the tunic */
  ctx.strokeStyle = skinDark; ctx.lineWidth = 2.5 * k; ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(4.4 * k, bodyY + 6);
  ctx.lineTo(sitting ? 5.2 * k : 6.6 * k, bodyY + (sitting ? 9 : 11) + swing * 1.8);
  ctx.stroke();

  /* tunic — hide, lit from the upper left */
  const tw = 10.4 * k, th = 11.4 * k;
  const gr = ctx.createLinearGradient(-tw / 2, bodyY, tw / 2, bodyY + th);
  gr.addColorStop(0, shade(look.cloth, 0.22));
  gr.addColorStop(0.55, look.cloth);
  gr.addColorStop(1, shade(look.cloth, -0.3));
  ctx.fillStyle = gr;
  roundRect(ctx, -tw / 2, bodyY + 3, tw, th, 3.6); ctx.fill();
  /* ragged hem, the way a cut hide hangs */
  ctx.fillStyle = shade(look.cloth, -0.42);
  ctx.beginPath();
  ctx.moveTo(-tw / 2, bodyY + th + 1);
  for (let i = 0; i <= 4; i++) {
    const fx = -tw / 2 + (tw / 4) * i;
    ctx.lineTo(fx, bodyY + th + 3 + (i % 2 ? 0 : 1.6));
  }
  ctx.lineTo(tw / 2, bodyY + th + 1);
  ctx.closePath(); ctx.fill();
  /* fur collar */
  ctx.fillStyle = 'rgba(255,248,232,.32)';
  roundRect(ctx, -tw / 2, bodyY + 2.2, tw, 2.2, 1.1); ctx.fill();
  ctx.fillStyle = 'rgba(30,20,10,.16)';
  roundRect(ctx, -tw / 2, bodyY + th - 3, tw, 3, 1.4); ctx.fill();

  /* a staff member's tabard, so a uniform reads before the badge does */
  if (look.staff) {
    ctx.fillStyle = shade(look.cloth, -0.34);
    roundRect(ctx, -3.2, bodyY + 3, 6.4, th + 1, 1.6); ctx.fill();
    ctx.fillStyle = 'rgba(255,248,232,.55)';
    ctx.fillRect(-3.2, bodyY + 4.6, 6.4, 1);
    ctx.fillRect(-3.2, bodyY + th - 1.2, 6.4, 1);
  }

  /* Sitting: the thighs come forward out from under the hem and the shins drop
     down the front of the bench. Drawn over the tunic, or the hem hides them
     and the figure just looks short. */
  if (sitting) {
    for (const L of [{ x: -4.2, c: shade(look.skin, -0.3) }, { x: 0.9, c: shade(look.skin, -0.12) }]) {
      ctx.fillStyle = L.c;
      roundRect(ctx, L.x, -9.5 * k, 3.3, 5.2 * k, 1.5); ctx.fill();          /* thigh */
      ctx.fillStyle = shade(L.c, -0.12);
      roundRect(ctx, L.x - 0.2, -5.2 * k, 3.1, 5.4 * k, 1.4); ctx.fill();    /* shin */
      ctx.fillStyle = '#6b4a2c';
      roundRect(ctx, L.x - 0.9, -0.4, 4.4, 2.6, 1.2); ctx.fill();            /* foot */
    }
  }

  /* front arm */
  ctx.strokeStyle = skinMid; ctx.lineWidth = 2.6 * k;
  ctx.beginPath();
  ctx.moveTo(-4.4 * k, bodyY + 6);
  ctx.lineTo(sitting ? -5.4 * k : -6.8 * k, bodyY + (sitting ? 9 : 11) - swing * 1.8);
  ctx.stroke();
  if (look.staff) staffTool(ctx, look.staff, -7.6 * k, bodyY + 11 - swing * 1.8, look.cloth);

  /* neck and head */
  ctx.fillStyle = skinDark;
  ctx.fillRect(-1.6, bodyY + 0.6, 3.2, 3);
  const hy = bodyY - 1.2, hr = 4.7 * k;
  const hg = ctx.createRadialGradient(hy * 0 - hr * 0.4, hy - hr * 0.45, hr * 0.2, 0, hy, hr * 1.25);
  hg.addColorStop(0, skinLit);
  hg.addColorStop(0.62, look.skin);
  hg.addColorStop(1, skinDark);
  ctx.fillStyle = hg;
  ctx.beginPath(); ctx.arc(0, hy, hr, 0, Math.PI * 2); ctx.fill();

  /* hair, swept back over the crown */
  ctx.fillStyle = look.hair;
  ctx.beginPath();
  ctx.arc(0, hy - 1.4, hr, Math.PI * 1.02, Math.PI * 2.02);
  ctx.quadraticCurveTo(hr * 0.9, hy + 1.4, hr * 0.78, hy + 2.2);
  ctx.lineTo(-hr * 0.78, hy + 2.2);
  ctx.quadraticCurveTo(-hr * 0.95, hy + 0.6, -hr, hy - 1.4);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = shade(look.hair, 0.3);
  ctx.beginPath(); ctx.ellipse(-hr * 0.42, hy - hr * 0.72, hr * 0.42, hr * 0.2, -0.5, 0, Math.PI * 2); ctx.fill();

  if (look.staff) {
    /* headband in the trade's colour, with a feather */
    ctx.fillStyle = look.cloth;
    roundRect(ctx, -hr * 1.02, hy - hr * 0.72, hr * 2.04, 2.2, 1); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.3)';
    ctx.fillRect(-hr * 1.02, hy - hr * 0.72, hr * 0.8, 2.2);
    ctx.strokeStyle = shade(look.cloth, 0.3); ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.moveTo(hr * 0.5, hy - hr * 0.7); ctx.lineTo(hr * 1.1, hy - hr * 2.1);
    ctx.stroke();
  } else if (look.hat) {
    ctx.fillStyle = shade(look.hat, -0.25);
    ctx.beginPath(); ctx.ellipse(0, hy - hr * 0.95, 6.4 * k, 2.3 * k, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = look.hat;
    roundRect(ctx, -3.1 * k, hy - hr * 1.75, 6.2 * k, 3 * k, 1.4); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.2)';
    ctx.fillRect(-3.1 * k, hy - hr * 1.75, 2 * k, 3 * k);
  }

  /* face */
  ctx.fillStyle = '#2a2018';
  ctx.beginPath();
  ctx.arc(-1.7 * k, hy + 0.1, 0.78, 0, Math.PI * 2);
  ctx.arc(1.7 * k, hy + 0.1, 0.78, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(214,120,96,.35)';
  ctx.beginPath(); ctx.ellipse(-2.5 * k, hy + 1.6, 1.2, 0.8, 0, 0, Math.PI * 2); ctx.fill();
}

function getPerson(look, frame) {
  const key = look.skin + look.cloth + look.hair + (look.hat || '-') + (look.staff || '-')
    + (look.kid ? 'k' : 'a') + frame;
  let spr = _personCache.get(key);
  if (spr) return spr;
  const c = makeCanvas(PERSON_W * PERSON_SS, PERSON_H * PERSON_SS);
  const ctx = c.getContext('2d');
  ctx.lineJoin = 'round';
  ctx.save();
  ctx.scale(PERSON_SS, PERSON_SS);
  ctx.translate(PERSON_AX, PERSON_AY);
  paintPerson(ctx, look, frame);
  ctx.restore();
  spr = { c, ox: PERSON_AX, oy: PERSON_AY, w: PERSON_W, h: PERSON_H };
  /* a hint of sun on the sunward edge — any more and it reads as white hair */
  addRimLight(spr, 1.5, 'rgba(255,243,216,0.45)');
  /* The wardrobe is fixed, so this never bites today; it is here so that
     widening it later cannot quietly fill the tab with canvases. */
  if (_personCache.size >= 900) _personCache.delete(_personCache.keys().next().value);
  _personCache.set(key, spr);
  return spr;
}
