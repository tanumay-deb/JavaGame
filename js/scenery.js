/* The world the park sits in: procedural terrain beyond the fence, forests,
   boulders, reed beds, a smoking volcano — and the palisade around the park. */

/* ---------------------------------------------------------- wild terrain */
/* Deterministic, so the landscape is identical every session and can be baked. */
function wildTerrain(x, y) {
  /* the track that brings visitors, and the forecourt in front of the gateway */
  if (y === ROAD_Y || y === ROAD_Y + 1) return GROUND.ROAD;
  if (y >= GRID_H && y < ROAD_Y && Math.abs(x - park.gate.x) <= 2) return GROUND.ROAD;

  /* a lake off the north-west shoulder of the valley */
  const lx = -5, ly = 8;
  const wobble = (fbm(x * 0.17, y * 0.17) - 0.5) * 11 + (fbm(x * 0.055 + 9, y * 0.055 + 2) - 0.5) * 9;
  const d = Math.hypot((x - lx) * 0.72, (y - ly) * 1.05) + wobble;
  if (d < 7.5) return GROUND.WATER;
  if (d < 9.5) return GROUND.SAND;
  /* a second pool to the south-east */
  const w2 = (fbm(x * 0.19 + 5, y * 0.19 + 8) - 0.5) * 9;
  const d2 = Math.hypot((x - (GRID_W + 5)) * 0.9, (y - (GRID_H + 1)) * 0.8) + w2;
  if (d2 < 5.5) return GROUND.WATER;
  if (d2 < 7.5) return GROUND.SAND;
  /* A river running out of the lake and away south, so the two pieces of
     water in the valley belong to each other instead of being two puddles. */
  const bend = Math.sin(y * 0.13) * 5.5 + (fbm(y * 0.09 + 31, 4) - 0.5) * 7;
  const bank = Math.abs(x - (-6 + (y - 8) * 0.30 + bend));
  if (y > 6 && bank < 1.7) return GROUND.WATER;
  if (y > 6 && bank < 2.9) return GROUND.SAND;

  /* dry sandy patches */
  if (fbm(x * 0.09 + 11, y * 0.09 + 7) > 0.66) return GROUND.SAND;
  return GROUND.GRASS;
}

/* How damp a tile is, 0 parched to 1 sodden. The ground painter shades moss
   and scrub off this same field, so the things that grow on a tile agree with
   the colour of it. */
function dampness(x, y) {
  const raw = fbm(x * 0.045 + 61, y * 0.045 + 23) * 0.7 + fbm(x * 0.17 + 5, y * 0.17 + 44) * 0.3;
  return clamp(1 - ((raw - 0.5) * 3.2 + 0.5), 0, 1);
}

/* how thick the forest stands on a tile nobody owns (0..1) */
function forestDensity(x, y) {
  const n = fbm(x * 0.11 + 3, y * 0.11 + 5);
  /* Stretched like the rest of the noise, then pushed up. The valley should
     read as woodland with clearings in it, not a lawn with the odd tree: the
     old figure left the land beyond the fence nearly bare. */
  let d = clamp((n - 0.5) * 2.4 + 0.66, 0, 1);
  /* thin it out along the road and around the gateway so arrivals are visible */
  const roadGap = Math.abs(y - (ROAD_Y + 0.5));
  if (roadGap < 4.5) d *= clamp((roadGap - 2.2) / 2.3, 0, 1);
  if (Math.abs(x - park.gate.x) < 5 && y > GRID_H - 1 && y < ROAD_Y + 3) d *= 0.25;
  return d;
}

const scenery = {
  props: [],
  built: false,

  /* Rebuilt whenever the park's borders change: everything nobody owns is
     wild country, and a palisade runs along the edge of the land you do own. */
  build() {
    this.props.length = 0;
    /* What stands in a wood depends on how wet the ground under it is. */
    const wet = ['conifer', 'broadleaf', 'fernclump', 'fernclump', 'mushroom', 'logfall', 'broadleaf'];
    const mid = ['conifer', 'conifer', 'broadleaf', 'fernclump', 'logfall', 'deadwood'];
    const dry = ['conifer', 'tallgrass', 'bigrock', 'tallgrass', 'cycad', 'deadwood'];
    for (let y = -WILD; y < GRID_H + WILD; y++) {
      for (let x = -WILD; x < GRID_W + WILD; x++) {
        if (park.owns(x, y)) continue;
        const g = wildTerrain(x, y);
        if (g === GROUND.ROAD) continue;
        const h = hash2(x * 31 + 7, y * 17 + 3);
        if (g === GROUND.WATER) {
          if (h > 0.93) this.props.push({ x: x + 0.5, y: y + 0.5, art: 'reeds', s: 0.9 + h * 0.3 });
          continue;
        }
        if (g === GROUND.SAND) {
          /* the water's edge: reeds, the odd cycad, a boulder */
          /* the shore: palms leaning over the sand, reeds, driftwood, rocks */
          if (h > 0.80) {
            const k = h > 0.975 ? 'bigrock' : h > 0.93 ? 'palm' : h > 0.89 ? 'cycad'
              : h > 0.85 ? 'reeds' : 'tallgrass';
            this.props.push({
              x: x + 0.15 + hash2(x * 3, y * 5) * 0.7,
              y: y + 0.15 + hash2(y * 3, x * 5) * 0.7,
              art: k, s: 0.75 + h * 0.6
            });
          }
          continue;
        }
        const damp = dampness(x, y);
        const dens = forestDensity(x, y);
        const jitter = (k, sc) => this.props.push({
          x: x + 0.25 + hash2(x, y) * 0.5,
          y: y + 0.25 + hash2(y, x) * 0.5,
          art: k, s: sc
        });
        if (h < dens) {
          /* More than one to a tile where the wood is thick, so the canopy
             closes up and the trees overlap instead of standing in a grid,
             and a wide spread of sizes so it does not read as an orchard. */
          const set = damp > 0.58 ? wet : (damp < 0.4 ? dry : mid);
          const many = dens > 0.78 ? 3 : (dens > 0.56 ? 2 : 1);
          for (let i = 0; i < many; i++) {
            const a = hash2(x * 17 + i * 101, y * 23 + i * 57);
            const b2 = hash2(y * 37 + i * 13, x * 11 + i * 71);
            this.props.push({
              x: x + 0.12 + a * 0.76,
              y: y + 0.12 + b2 * 0.76,
              art: set[Math.floor(hash2(y * 13 + i * 7 + 1, x * 29 + i * 3 + 5) * set.length)],
              s: 0.62 + hash2(x + 3 + i * 9, y + 9 + i * 5) * 0.95
            });
          }
        } else {
          /* open ground between the stands of trees, which used to be bare */
          const o = hash2(x * 7 + 19, y * 41 + 13);
          if (damp > 0.7 && o > 0.96) jitter('mushroom', 0.7 + o * 0.4);
          else if (damp < 0.3 && o > 0.994) jitter('monolith', 0.9 + o * 0.3);
          else if (o > 0.93) jitter('tallgrass', 0.75 + o * 0.5);
          else if (o > 0.88) jitter('blossom', 0.7 + o * 0.45);
          else if (o > 0.865) jitter('logfall', 0.8);
          else if (o > 0.84) jitter('fernclump', 0.8 + o * 0.3);
          else if (h > 0.972) {
            /* boulders lie about in groups, not one to a field */
            const n2 = 2 + Math.floor(hash2(x * 5 + 3, y * 9 + 1) * 3);
            for (let i = 0; i < n2; i++) {
              const a = hash2(x * 31 + i * 17, y * 13 + i * 29);
              const b2 = hash2(y * 19 + i * 23, x * 7 + i * 41);
              this.props.push({
                x: x + 0.1 + a * 0.8, y: y + 0.1 + b2 * 0.8,
                art: i === 0 ? 'bigrock' : 'rock',
                s: (i === 0 ? 1.0 : 0.7) + a * 0.6
              });
            }
          }
        }
      }
    }
    /* The road outside: lamps down both verges, and cars left on the near one
       either side of the gateway, the way the design sheet has it. All of it
       is static, so it bakes into the ground sheet and costs nothing to draw. */
    const gx = park.gate.x;
    for (let x = gx - 26; x <= gx + 26; x += 5) {
      if (Math.abs(x - gx) < 3) continue;                 /* keep the gateway clear */
      this.props.push({ x: x + 0.5, y: ROAD_Y - 0.6, art: 'lamppost', s: 1 });
      this.props.push({ x: x + 2.5, y: ROAD_Y + 2.6, art: 'lamppost', s: 1 });
    }
    for (let i = 0; i < 16; i++) {
      const x = gx - 13 + i * 1.75;
      if (Math.abs(x - gx) < 3.2) continue;               /* nobody parks across the gate */
      this.props.push({ x: x, y: ROAD_Y - 1.1, art: 'parked' + (i % 4), s: 0.9 + (i % 3) * 0.06 });
    }

    /* a volcano brooding over the valley, with foothills */
    this.props.push({ x: -5.5, y: -9.5, art: 'volcano', s: 1.15, anim: true });
    for (const [hx, hy, hs] of [[-7.5, -5.5, 1.6], [0.5, -8.5, 1.4], [-9.5, -1.5, 1.3], [4.5, -9.5, 1.2]])
      this.props.push({ x: hx, y: hy, art: 'bigrock', s: hs });

    this.fenceOwnedEdge();

    for (const p of this.props) {
      p.d = p.x + p.y;
      p.wx = isoX(p.x, p.y);
      p.wy = isoY(p.x, p.y);
    }
    this.props.sort((a, b) => a.d - b.d);
    this.built = true;
  },

  /* The props are sorted by depth, so the band of them the camera can see is a
     contiguous slice. Walking all of them every frame cost more than drawing
     them once the valley was properly wooded. */
  firstAtDepth(d) {
    const a = this.props;
    let lo = 0, hi = a.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (a[mid].d < d) lo = mid + 1; else hi = mid;
    }
    return lo;
  },

  /* palisade along every edge where owned land meets wild land */
  fenceOwnedEdge() {
    const gate = park.gate;
    for (let y = 0; y < GRID_H; y++) {
      for (let x = 0; x < GRID_W; x++) {
        if (!park.owns(x, y)) continue;
        /* the gateway itself stays open */
        const atGate = Math.abs(x - gate.x) <= 1 && y === GRID_H - 1;
        if (!park.owns(x, y - 1)) this.props.push({ x: x + 0.5, y: y, art: 'fenceX', s: 1 });
        if (!park.owns(x, y + 1) && !atGate) this.props.push({ x: x + 0.5, y: y + 1, art: 'fenceX', s: 1 });
        if (!park.owns(x - 1, y)) this.props.push({ x: x, y: y + 0.5, art: 'fenceY', s: 1 });
        if (!park.owns(x + 1, y)) this.props.push({ x: x + 1, y: y + 0.5, art: 'fenceY', s: 1 });
      }
    }
  }
};

/* ------------------------------------------------------------- artwork */

/* A lamp on the road outside, with the pool of light it throws baked in.
   Scenery is not a building, so the lighting pass never sees it. */
ART.lamppost = function () {
  const g = spriteCtx(1, 1, 76), ctx = g.ctx;
  const [cx, cy] = g.mid;
  const H = 46;
  /* the light on the ground first, so everything else sits in it */
  const pool = ctx.createRadialGradient(cx, cy, 1, cx, cy, 34);
  pool.addColorStop(0, 'rgba(255,214,140,.30)');
  pool.addColorStop(0.55, 'rgba(255,198,110,.12)');
  pool.addColorStop(1, 'rgba(255,190,100,0)');
  ctx.fillStyle = pool;
  ctx.beginPath(); ctx.ellipse(cx, cy, 34, 17, 0, 0, Math.PI * 2); ctx.fill();
  blob(ctx, cx + 1, cy + 1, 5, 2.4, .25);
  /* the post */
  ctx.fillStyle = '#2f3338'; ctx.fillRect(cx - 2.2, cy - H, 4.4, H);
  ctx.fillStyle = '#41464d'; ctx.fillRect(cx - 2.2, cy - H, 1.8, H);
  ctx.fillStyle = '#23262a';
  ctx.beginPath(); ctx.ellipse(cx, cy, 5.5, 2.6, 0, 0, Math.PI * 2); ctx.fill();
  /* the arm and the head */
  ctx.strokeStyle = '#2f3338'; ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(cx, cy - H);
  ctx.quadraticCurveTo(cx + 7, cy - H - 5, cx + 12, cy - H - 3);
  ctx.stroke();
  ctx.fillStyle = '#23262a';
  roundRect(ctx, cx + 8, cy - H - 4, 10, 4.5, 2); ctx.fill();
  ctx.fillStyle = '#ffe9b0';
  roundRect(ctx, cx + 9, cy - H - 1.5, 8, 2.6, 1.3); ctx.fill();
  /* the glow around the head */
  const hg = ctx.createRadialGradient(cx + 13, cy - H - 1, 0, cx + 13, cy - H - 1, 13);
  hg.addColorStop(0, 'rgba(255,224,150,.5)');
  hg.addColorStop(1, 'rgba(255,214,130,0)');
  ctx.fillStyle = hg;
  ctx.beginPath(); ctx.arc(cx + 13, cy - H - 1, 13, 0, Math.PI * 2); ctx.fill();
  return g;
};

/* Cars left on the verge outside the gate. Four bodies so a row of them is
   not the same car repeated; scenery art is cached by name, so the colour
   cannot vary per instance the way a moving vehicle's does. */
const PARKED_TONES = ['#c9453a', '#3f6fb5', '#e0a33c', '#4f9d6a'];
PARKED_TONES.forEach((col, i) => {
  ART['parked' + i] = function () {
    const g = spriteCtx(1, 1, 34), ctx = g.ctx;
    const [cx, cy] = g.mid;
    const L = 34, H = 11;
    blob(ctx, cx, cy + 1, L * 0.46, 5, .26);
    /* wheels */
    ctx.fillStyle = '#1d1f22';
    for (const wx of [-L * 0.3, L * 0.3]) {
      ctx.beginPath(); ctx.ellipse(cx + wx, cy - 2, 4, 3.4, 0, 0, Math.PI * 2); ctx.fill();
    }
    /* body, then the cabin sitting on it */
    ctx.fillStyle = shade(col, -0.3);
    roundRect(ctx, cx - L / 2, cy - H, L, H, 4); ctx.fill();
    ctx.fillStyle = col;
    roundRect(ctx, cx - L / 2, cy - H - 2, L, H, 4); ctx.fill();
    ctx.fillStyle = shade(col, 0.2);
    roundRect(ctx, cx - L / 2 + 1, cy - H - 2, L - 2, 3, 1.5); ctx.fill();
    ctx.fillStyle = shade(col, -0.12);
    roundRect(ctx, cx - L * 0.28, cy - H - 9, L * 0.56, 8, 3); ctx.fill();
    /* glass */
    ctx.fillStyle = 'rgba(180,214,236,.85)';
    roundRect(ctx, cx - L * 0.24, cy - H - 7.5, L * 0.22, 5, 1.5); ctx.fill();
    roundRect(ctx, cx + L * 0.02, cy - H - 7.5, L * 0.22, 5, 1.5); ctx.fill();
    /* lamps */
    ctx.fillStyle = '#ffe9b0';
    ctx.beginPath(); ctx.ellipse(cx + L / 2 - 1.5, cy - H + 2, 1.6, 1.8, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#c14a3c';
    ctx.beginPath(); ctx.ellipse(cx - L / 2 + 1.5, cy - H + 2, 1.4, 1.7, 0, 0, Math.PI * 2); ctx.fill();
    return g;
  };
});



/* Giant fungi. The valley is damp under the trees and things grow large in it. */
ART.mushroom = function () {
  const g = spriteCtx(1, 1, 54), ctx = g.ctx;
  const [cx, cy] = g.mid;
  blob(ctx, cx + 1, cy + 1, 13, 6, .2);
  const caps = [[-7, 0, 9, 13, '#b5453a'], [6, -2, 7, 10, '#c9573f'], [-1, -3, 11, 17, '#a63c33']];
  for (const [dx, dy, rh, rw, col] of caps) {
    const bx = cx + dx, by = cy + dy;
    const h = rw * 1.5;
    /* stalk */
    ctx.fillStyle = '#e4d9bd';
    ctx.beginPath();
    ctx.moveTo(bx - rw * 0.22, by);
    ctx.quadraticCurveTo(bx - rw * 0.15, by - h * 0.6, bx - rw * 0.18, by - h);
    ctx.lineTo(bx + rw * 0.18, by - h);
    ctx.quadraticCurveTo(bx + rw * 0.15, by - h * 0.6, bx + rw * 0.22, by);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(120,104,72,.35)';
    ctx.fillRect(bx + rw * 0.05, by - h, rw * 0.17, h);
    /* the gills under the cap */
    ctx.fillStyle = '#cbbb96';
    ctx.beginPath(); ctx.ellipse(bx, by - h + 2, rw, rh * 0.34, 0, 0, Math.PI * 2); ctx.fill();
    /* cap */
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.ellipse(bx, by - h, rw, rh, 0, Math.PI, 0);
    ctx.quadraticCurveTo(bx, by - h + rh * 0.55, bx - rw, by - h);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.16)';
    ctx.beginPath(); ctx.ellipse(bx - rw * 0.3, by - h - rh * 0.34, rw * 0.4, rh * 0.28, -0.3, 0, Math.PI * 2); ctx.fill();
    /* spots */
    ctx.fillStyle = 'rgba(244,236,214,.85)';
    for (let i = 0; i < 4; i++) {
      const a = -2.7 + i * 0.62;
      ctx.beginPath();
      ctx.ellipse(bx + Math.cos(a) * rw * 0.55, by - h + Math.sin(a) * rh * 0.5, 1.5, 1.1, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  return g;
};

/* A cycad: a squat scaly trunk under a crown of stiff fronds. */
ART.cycad = function () {
  const g = spriteCtx(1, 1, 62), ctx = g.ctx;
  const [cx, cy] = g.mid;
  blob(ctx, cx + 1, cy + 1, 14, 6, .2);
  const H = 15;
  ctx.fillStyle = '#6b5334';
  ctx.beginPath();
  ctx.moveTo(cx - 6, cy); ctx.lineTo(cx - 4.5, cy - H); ctx.lineTo(cx + 4.5, cy - H); ctx.lineTo(cx + 6, cy);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(40,28,14,.32)';
  ctx.beginPath();
  ctx.moveTo(cx + 1.5, cy); ctx.lineTo(cx + 1, cy - H); ctx.lineTo(cx + 4.5, cy - H); ctx.lineTo(cx + 6, cy);
  ctx.closePath(); ctx.fill();
  /* the diamond scars where old fronds came away */
  ctx.strokeStyle = 'rgba(30,20,10,.35)'; ctx.lineWidth = 1;
  for (let i = 0; i < 4; i++) {
    const yy = cy - 2.5 - i * 3.4;
    ctx.beginPath(); ctx.moveTo(cx - 5, yy); ctx.lineTo(cx + 5, yy - 0.6); ctx.stroke();
  }
  /* The crown. Sweeping the angle over half a circle sent every frond
     upwards and the thing looked like a feather duster; they go all the way
     round now, flattened for the projection, and droop at the tip. Back ones
     first so the front ones overlap them. */
  const crownY = cy - H - 1;
  const fronds = [];
  for (let i = 0; i < 13; i++) {
    const a = (i / 13) * Math.PI * 2 + 0.35;
    const len = 18 + ((i * 7) % 6);
    fronds.push({ a, len, ex: cx + Math.cos(a) * len, ey: crownY + Math.sin(a) * len * 0.42 + 3 });
  }
  fronds.sort((p, q) => p.ey - q.ey);
  /* Each frond is a filled blade, not a stroked line. Every sprite gets a rim
     light drawn behind it and offset, which on a line only a few pixels wide
     is most of what you see — the first version of these came out white. */
  for (let i = 0; i < fronds.length; i++) {
    const f = fronds[i];
    const shadeF = f.ey < crownY ? -0.2 : 0.05;        /* the far side sits in its own shade */
    const mx = lerp(cx, f.ex, 0.55), my = lerp(crownY, f.ey, 0.45) - 7;
    ctx.fillStyle = shade(i % 2 ? '#3e7a3a' : '#4b8c42', shadeF);
    ctx.beginPath();
    ctx.moveTo(cx, crownY - 1);
    ctx.quadraticCurveTo(mx, my - 3.4, f.ex, f.ey);
    ctx.quadraticCurveTo(mx, my + 3.4, cx, crownY + 2);
    ctx.closePath();
    ctx.fill();
    /* the midrib, and notches so it reads as a pinnate leaf */
    ctx.strokeStyle = 'rgba(24,46,20,.4)'; ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.moveTo(cx, crownY);
    ctx.quadraticCurveTo(mx, my, f.ex, f.ey);
    ctx.stroke();
    for (let k = 1; k <= 3; k++) {
      const u = k / 4;
      const px = lerp(cx, f.ex, u), py = lerp(crownY, f.ey, u) - 5.5 * (1 - Math.abs(u - 0.5) * 1.6);
      ctx.beginPath(); ctx.moveTo(px, py - 2.6); ctx.lineTo(px, py + 2.6); ctx.stroke();
    }
  }
  ctx.fillStyle = '#7a6a3e';
  ctx.beginPath(); ctx.ellipse(cx, cy - H - 1, 4.5, 3, 0, 0, Math.PI * 2); ctx.fill();
  return g;
};

/* A fallen trunk going back to the soil: moss along the top, brackets on the side. */
ART.logfall = function () {
  const g = spriteCtx(1, 1, 34), ctx = g.ctx;
  const [cx, cy] = g.mid;
  blob(ctx, cx, cy + 2, 22, 7, .22);
  ctx.fillStyle = '#5c432a';
  roundRect(ctx, cx - 22, cy - 9, 44, 11, 5); ctx.fill();
  ctx.fillStyle = '#6d5133';
  roundRect(ctx, cx - 22, cy - 11, 44, 8, 4); ctx.fill();
  /* moss along the upper side */
  ctx.fillStyle = '#4e7a3a';
  for (let i = 0; i < 9; i++) {
    const px = cx - 19 + i * 5;
    ctx.beginPath(); ctx.ellipse(px, cy - 11 + ((i * 3) % 2), 3.4, 2, 0, 0, Math.PI * 2); ctx.fill();
  }
  /* the cut end, with rings */
  ctx.fillStyle = '#8a6a44';
  ctx.beginPath(); ctx.ellipse(cx - 22, cy - 5.5, 3.2, 5.5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(70,48,26,.5)'; ctx.lineWidth = 0.8;
  for (const r of [0.35, 0.68]) {
    ctx.beginPath(); ctx.ellipse(cx - 22, cy - 5.5, 3.2 * r, 5.5 * r, 0, 0, Math.PI * 2); ctx.stroke();
  }
  /* bracket fungi */
  ctx.fillStyle = '#d8c48a';
  for (const [dx, dy] of [[-6, -3], [7, -1], [14, -4]]) {
    ctx.beginPath(); ctx.ellipse(cx + dx, cy + dy, 4, 1.9, -0.2, Math.PI, 0); ctx.fill();
  }
  return g;
};

/* A clump of grass nobody has ever cut, gone to seed. */
ART.tallgrass = function () {
  const g = spriteCtx(1, 1, 46), ctx = g.ctx;
  const [cx, cy] = g.mid;
  blob(ctx, cx, cy + 1, 12, 5, .16);
  /* filled blades rather than strokes, so the rim light edges them instead of
     swallowing them */
  for (let i = 0; i < 14; i++) {
    const t = i / 13;
    const lean = (t - 0.5) * 16;
    const h = 20 + ((i * 11) % 9);
    const bx = cx + lean * 0.25, ex = cx + lean * 1.4, ey = cy - h;
    const w = 2.2;
    ctx.fillStyle = i % 3 === 0 ? '#7f9a44' : (i % 3 === 1 ? '#6d8a38' : '#93a650');
    ctx.beginPath();
    ctx.moveTo(bx - w, cy);
    ctx.quadraticCurveTo(cx + lean * 0.7 - w * 0.5, cy - h * 0.6, ex, ey);
    ctx.quadraticCurveTo(cx + lean * 0.7 + w * 0.6, cy - h * 0.6, bx + w, cy);
    ctx.closePath();
    ctx.fill();
    /* a seed head on the taller ones */
    if (i % 4 === 1) {
      ctx.fillStyle = '#bfa968';
      ctx.beginPath(); ctx.ellipse(ex, ey - 2, 2, 4.4, lean * 0.02, 0, Math.PI * 2); ctx.fill();
    }
  }
  return g;
};

/* Stones somebody stood on end a very long time ago. */
ART.monolith = function () {
  const g = spriteCtx(1, 1, 72), ctx = g.ctx;
  const [cx, cy] = g.mid;
  blob(ctx, cx + 2, cy + 2, 20, 8, .24);
  const stones = [[-12, 30, 9, 0.06], [6, 42, 11, -0.04], [17, 22, 7, 0.14]];
  for (const [dx, h, w, tilt] of stones) {
    ctx.save();
    ctx.translate(cx + dx, cy);
    ctx.rotate(tilt);
    ctx.fillStyle = shade(PALETTE.rockDark, -0.1);
    ctx.beginPath();
    ctx.moveTo(-w * 0.5, 0); ctx.lineTo(-w * 0.42, -h); ctx.lineTo(w * 0.4, -h * 0.94); ctx.lineTo(w * 0.5, 0);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = PALETTE.rock;
    ctx.beginPath();
    ctx.moveTo(-w * 0.5, 0); ctx.lineTo(-w * 0.42, -h); ctx.lineTo(w * 0.05, -h * 0.97); ctx.lineTo(w * 0.02, 0);
    ctx.closePath(); ctx.fill();
    /* weathering, and lichen low down where the damp sits */
    ctx.strokeStyle = 'rgba(60,64,68,.3)'; ctx.lineWidth = 1;
    for (let i = 1; i < 4; i++) {
      const yy = -h * (i / 4);
      ctx.beginPath(); ctx.moveTo(-w * 0.45, yy); ctx.lineTo(w * 0.3, yy + 1.5); ctx.stroke();
    }
    ctx.fillStyle = 'rgba(150,170,110,.35)';
    ctx.beginPath(); ctx.ellipse(-w * 0.1, -h * 0.18, w * 0.3, h * 0.12, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  return g;
};

/* A shrub in flower. */
ART.blossom = function () {
  const g = spriteCtx(1, 1, 40), ctx = g.ctx;
  const [cx, cy] = g.mid;
  blob(ctx, cx + 1, cy + 1, 13, 5, .18);
  ctx.fillStyle = '#3f6b33';
  for (const [dx, dy, r] of [[-7, -7, 9], [6, -6, 8], [0, -13, 9], [-2, -4, 10]]) {
    ctx.beginPath(); ctx.ellipse(cx + dx, cy + dy, r, r * 0.82, 0, 0, Math.PI * 2); ctx.fill();
  }
  ctx.fillStyle = '#4d8040';
  for (const [dx, dy, r] of [[-8, -9, 6], [5, -8, 5.5], [-1, -15, 6]]) {
    ctx.beginPath(); ctx.ellipse(cx + dx, cy + dy, r, r * 0.8, 0, 0, Math.PI * 2); ctx.fill();
  }
  /* the flowers, in two tones so it does not read as one flat blob */
  for (let i = 0; i < 16; i++) {
    const a = i * 2.39;                       /* a rough phyllotaxis, so they spread evenly */
    const rr = 3 + (i / 16) * 10;
    const px = cx + Math.cos(a) * rr, py = cy - 8 + Math.sin(a) * rr * 0.75;
    ctx.fillStyle = i % 3 === 0 ? '#e9d7e8' : (i % 3 === 1 ? '#d8a8cf' : '#f0e4c0');
    ctx.beginPath(); ctx.arc(px, py, 1.9, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(190,140,70,.7)';
    ctx.beginPath(); ctx.arc(px, py, 0.7, 0, Math.PI * 2); ctx.fill();
  }
  return g;
};


ART.conifer = function () {
  const g = spriteCtx(1, 1, 76), ctx = g.ctx;
  const [cx, cy] = g.mid;
  blob(ctx, cx + 2, cy + 1, 11, 5, .2);
  ctx.fillStyle = '#5b4228';
  ctx.fillRect(cx - 3, cy - 16, 6, 16);
  const tiers = [[0, 20, 20], [-14, 16, 17], [-27, 12, 13], [-38, 8, 9]];
  for (let i = 0; i < tiers.length; i++) {
    const [dy, rw, hh] = tiers[i];
    const top = cy - 18 + dy - hh;
    ctx.fillStyle = ['#2f6b39', '#357740', '#3b8247', '#418d4d'][i];
    ctx.beginPath();
    ctx.moveTo(cx, top);
    ctx.lineTo(cx + rw, cy - 14 + dy);
    ctx.quadraticCurveTo(cx, cy - 10 + dy, cx - rw, cy - 14 + dy);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.09)';
    ctx.beginPath();
    ctx.moveTo(cx, top); ctx.lineTo(cx - rw, cy - 14 + dy); ctx.lineTo(cx - rw * 0.2, cy - 12 + dy);
    ctx.closePath(); ctx.fill();
  }
  return g;
};

ART.broadleaf = function () {
  const g = spriteCtx(1, 1, 70), ctx = g.ctx;
  const [cx, cy] = g.mid;
  blob(ctx, cx + 3, cy + 1, 13, 6, .2);
  ctx.strokeStyle = '#6b4a2a'; ctx.lineWidth = 6; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(cx, cy); ctx.quadraticCurveTo(cx - 3, cy - 20, cx + 1, cy - 32); ctx.stroke();
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(cx - 1, cy - 24); ctx.lineTo(cx - 10, cy - 32);
  ctx.moveTo(cx + 1, cy - 28); ctx.lineTo(cx + 10, cy - 35); ctx.stroke();
  const puffs = [[0, -46, 17], [-13, -38, 12], [13, -40, 13], [-6, -52, 11], [8, -52, 10]];
  for (const [dx, dy, r] of puffs) {
    ctx.fillStyle = dy < -46 ? '#5aa04c' : '#468a3d';
    ctx.beginPath(); ctx.ellipse(cx + dx, cy + dy, r, r * 0.82, 0, 0, Math.PI * 2); ctx.fill();
  }
  ctx.fillStyle = 'rgba(255,255,255,.13)';
  ctx.beginPath(); ctx.ellipse(cx - 6, cy - 54, 8, 5, -0.3, 0, Math.PI * 2); ctx.fill();
  return g;
};

ART.fernclump = function () {
  const g = spriteCtx(1, 1, 34), ctx = g.ctx;
  const [cx, cy] = g.mid;
  blob(ctx, cx, cy + 1, 11, 4.5, .16);
  for (let i = 0; i < 7; i++) {
    const a = -Math.PI / 2 + (i - 3) * 0.42;
    const len = 16 + (i % 3) * 5;
    ctx.strokeStyle = i % 2 ? '#3f8138' : '#4d9a42';
    ctx.lineWidth = 3.4;
    ctx.beginPath();
    ctx.moveTo(cx, cy - 1);
    ctx.quadraticCurveTo(cx + Math.cos(a) * len * 0.6, cy - 4 + Math.sin(a) * len * 0.6,
                         cx + Math.cos(a) * len, cy - 2 + Math.sin(a) * len * 0.8);
    ctx.stroke();
  }
  return g;
};

ART.bigrock = function () {
  const g = spriteCtx(1, 1, 40), ctx = g.ctx;
  const [cx, cy] = g.mid;
  blob(ctx, cx + 2, cy + 2, 16, 7, .22);
  ctx.fillStyle = '#868d95';
  ctx.beginPath();
  ctx.moveTo(cx - 17, cy + 3); ctx.lineTo(cx - 10, cy - 18); ctx.lineTo(cx + 3, cy - 24);
  ctx.lineTo(cx + 16, cy - 8); ctx.lineTo(cx + 12, cy + 4); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#a2a9b1';
  ctx.beginPath(); ctx.moveTo(cx - 10, cy - 18); ctx.lineTo(cx + 3, cy - 24); ctx.lineTo(cx - 1, cy - 11); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#6a7179';
  ctx.beginPath(); ctx.moveTo(cx + 3, cy - 24); ctx.lineTo(cx + 16, cy - 8); ctx.lineTo(cx + 5, cy - 6); ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(90,140,70,.4)';
  ctx.beginPath(); ctx.ellipse(cx - 6, cy - 2, 7, 3, 0, 0, Math.PI * 2); ctx.fill();
  return g;
};

ART.deadwood = function () {
  const g = spriteCtx(1, 1, 44), ctx = g.ctx;
  const [cx, cy] = g.mid;
  blob(ctx, cx + 2, cy + 1, 10, 4, .18);
  ctx.strokeStyle = '#8b7355'; ctx.lineWidth = 5; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + 3, cy - 26); ctx.stroke();
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(cx + 2, cy - 16); ctx.lineTo(cx - 9, cy - 24);
  ctx.moveTo(cx + 3, cy - 21); ctx.lineTo(cx + 13, cy - 26);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,.12)';
  ctx.fillRect(cx - 1, cy - 26, 1.6, 26);
  return g;
};

ART.reeds = function () {
  const g = spriteCtx(1, 1, 30), ctx = g.ctx;
  const [cx, cy] = g.mid;
  for (let i = 0; i < 9; i++) {
    const dx = (i - 4) * 3.2, len = 12 + (i % 4) * 5;
    ctx.strokeStyle = i % 2 ? '#7a9b4a' : '#93b25c';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(cx + dx, cy + 2);
    ctx.quadraticCurveTo(cx + dx + 2, cy - len * 0.6, cx + dx + 5, cy - len);
    ctx.stroke();
    if (i % 3 === 0) {
      ctx.fillStyle = '#7a5a33';
      ctx.beginPath(); ctx.ellipse(cx + dx + 5, cy - len, 1.8, 3.6, 0.3, 0, Math.PI * 2); ctx.fill();
    }
  }
  return g;
};

ART.volcano = function () {
  const g = spriteCtx(9, 9, 240), ctx = g.ctx;
  const [cx, cy] = g.mid;
  const H = 208, W = TILE_W * 2.9;

  /* silhouette: a cone with a notched shoulder on each side */
  const outline = () => {
    ctx.beginPath();
    ctx.moveTo(cx - W, cy + 12);
    ctx.lineTo(cx - W * 0.66, cy - H * 0.30);
    ctx.lineTo(cx - W * 0.52, cy - H * 0.36);
    ctx.lineTo(cx - W * 0.33, cy - H * 0.70);
    ctx.lineTo(cx - 26, cy - H);
    ctx.lineTo(cx + 26, cy - H + 4);
    ctx.lineTo(cx + W * 0.36, cy - H * 0.66);
    ctx.lineTo(cx + W * 0.49, cy - H * 0.40);
    ctx.lineTo(cx + W * 0.70, cy - H * 0.26);
    ctx.closePath();
  };
  const grd = ctx.createLinearGradient(cx - W, cy - H * 0.2, cx + W, cy - H * 0.9);
  grd.addColorStop(0, '#6f6a63'); grd.addColorStop(0.45, '#5d564e'); grd.addColorStop(1, '#433d37');
  ctx.fillStyle = grd;
  outline(); ctx.fill();

  /* lit western flank */
  ctx.save();
  outline(); ctx.clip();
  ctx.fillStyle = 'rgba(255,240,215,.13)';
  ctx.beginPath();
  ctx.moveTo(cx - W, cy + 12); ctx.lineTo(cx - 20, cy - H);
  ctx.lineTo(cx - 2, cy - H + 6); ctx.lineTo(cx - W * 0.45, cy + 12);
  ctx.closePath(); ctx.fill();
  /* erosion gullies */
  ctx.strokeStyle = 'rgba(0,0,0,.20)'; ctx.lineWidth = 2.4;
  for (let i = -5; i <= 5; i++) {
    ctx.beginPath();
    ctx.moveTo(cx + i * 5, cy - H + 10);
    ctx.quadraticCurveTo(cx + i * 20, cy - H * 0.5, cx + i * 30, cy + 12);
    ctx.stroke();
  }
  /* scree at the foot */
  ctx.fillStyle = 'rgba(120,110,98,.55)';
  ctx.beginPath();
  ctx.moveTo(cx - W, cy + 12); ctx.quadraticCurveTo(cx, cy - 34, cx + W, cy + 12);
  ctx.closePath(); ctx.fill();
  /* lava streaks */
  ctx.strokeStyle = 'rgba(206,74,32,.8)'; ctx.lineWidth = 3.2;
  ctx.beginPath();
  ctx.moveTo(cx - 13, cy - H + 8); ctx.quadraticCurveTo(cx - 40, cy - H * 0.55, cx - 34, cy - H * 0.2);
  ctx.moveTo(cx + 15, cy - H + 8); ctx.quadraticCurveTo(cx + 46, cy - H * 0.5, cx + 54, cy - H * 0.12);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,170,70,.55)'; ctx.lineWidth = 1.3;
  ctx.beginPath();
  ctx.moveTo(cx - 13, cy - H + 8); ctx.quadraticCurveTo(cx - 40, cy - H * 0.55, cx - 34, cy - H * 0.2);
  ctx.stroke();
  ctx.restore();

  /* crater */
  ctx.fillStyle = '#332d28';
  ctx.beginPath(); ctx.ellipse(cx, cy - H + 2, 27, 8, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#b03c1c';
  ctx.beginPath(); ctx.ellipse(cx, cy - H + 3, 19, 5.4, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#f2a83f';
  ctx.beginPath(); ctx.ellipse(cx, cy - H + 3, 10, 3, 0, 0, Math.PI * 2); ctx.fill();

  /* forest skirt */
  for (let i = -5; i <= 5; i++) {
    const px = cx + i * 24 + (i % 2) * 9, py = cy + 12 + Math.abs(i) * 1.2;
    ctx.fillStyle = i % 2 ? '#2b6134' : '#31703b';
    ctx.beginPath();
    ctx.moveTo(px, py - 24); ctx.lineTo(px + 9, py); ctx.lineTo(px - 9, py); ctx.closePath(); ctx.fill();
  }
  /* distance haze over the whole mass */
  ctx.globalCompositeOperation = 'source-atop';
  ctx.fillStyle = 'rgba(150,180,205,.22)';
  ctx.fillRect(0, 0, g.c.width, g.c.height);
  ctx.globalCompositeOperation = 'source-over';

  g.crater = [cx, cy - H + 2];
  return g;
};
ANIM.volcano = function (ctx, sx, sy, g, t) {
  const x = g.crater[0] + sx, y = g.crater[1] + sy;
  ctx.save();
  for (let i = 0; i < 7; i++) {
    const ph = (t * 0.08 + i / 7) % 1;
    const r = 12 + ph * 46;
    ctx.globalAlpha = (1 - ph) * 0.32;
    ctx.fillStyle = '#b8b0a6';
    ctx.beginPath();
    ctx.arc(x + Math.sin(ph * 3 + i) * ph * 40, y - 10 - ph * 120, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 0.45 + Math.sin(t * 2) * 0.12;
  ctx.fillStyle = '#ff7a3c';
  ctx.beginPath(); ctx.ellipse(x, y, 12, 3.6, 0, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 0.18 + Math.sin(t * 2) * 0.06;
  ctx.beginPath(); ctx.ellipse(x, y - 4, 26, 12, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
};

/* One bay of the park palisade. Two versions, because a fence has to run along
   the isometric axis it sits on: fenceX along +x (down-right), fenceY along +y. */
function fenceBay(dx, dy) {
  const g = spriteCtx(1, 1, 38), ctx = g.ctx;
  const [cx, cy] = g.mid;
  const ax = dx * TILE_W / 2, ay = dy * TILE_H / 2;     // half a tile along the run
  const H = 19;
  ctx.save();
  blob(ctx, cx, cy + 1, 15, 5, .13);
  /* rails first, then the stakes on top */
  ctx.strokeStyle = '#7d6647'; ctx.lineWidth = 2.6;
  for (const h of [H - 5, H - 12]) {
    ctx.beginPath();
    ctx.moveTo(cx - ax, cy - ay - h); ctx.lineTo(cx + ax, cy + ay - h);
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(255,255,255,.16)'; ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cx - ax, cy - ay - H + 4); ctx.lineTo(cx + ax, cy + ay - H + 4);
  ctx.stroke();
  for (const f of [-0.62, 0.62]) {
    const px = cx + ax * f, py = cy + ay * f;
    ctx.fillStyle = PALETTE.woodDark;
    ctx.fillRect(px - 2.2, py - H, 4.4, H);
    ctx.fillStyle = shade(PALETTE.wood, .16);
    ctx.fillRect(px - 2.2, py - H, 1.7, H);
    ctx.fillStyle = shade(PALETTE.wood, -.4);
    ctx.beginPath();
    ctx.moveTo(px - 2.2, py - H); ctx.lineTo(px, py - H - 3.5); ctx.lineTo(px + 2.2, py - H);
    ctx.closePath(); ctx.fill();
  }
  ctx.restore();
  return g;
}
ART.fenceX = () => fenceBay(1, 1);
ART.fenceY = () => fenceBay(-1, 1);
