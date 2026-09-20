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
  /* dry sandy patches */
  if (fbm(x * 0.09 + 11, y * 0.09 + 7) > 0.66) return GROUND.SAND;
  return GROUND.GRASS;
}

/* how thick the forest stands on a tile nobody owns (0..1) */
function forestDensity(x, y) {
  const n = fbm(x * 0.11 + 3, y * 0.11 + 5);
  let d = clamp(n * 1.7 - 0.42, 0, 1);
  /* thin it out along the road and around the gateway so arrivals are visible */
  const roadGap = Math.abs(y - (ROAD_Y + 0.5));
  if (roadGap < 3) d *= clamp((roadGap - 1) / 2, 0, 1);
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
    const kinds = ['conifer', 'conifer', 'broadleaf', 'fernclump', 'bigrock', 'deadwood'];
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
          if (h > 0.9) this.props.push({ x: x + 0.5, y: y + 0.5, art: h > 0.96 ? 'bigrock' : 'reeds', s: 0.85 });
          continue;
        }
        const dens = forestDensity(x, y);
        if (h < dens * 0.9) {
          const k = kinds[Math.floor(hash2(y * 13 + 1, x * 29 + 5) * kinds.length)];
          this.props.push({
            x: x + 0.25 + hash2(x, y) * 0.5,
            y: y + 0.25 + hash2(y, x) * 0.5,
            art: k, s: 0.8 + hash2(x + 3, y + 9) * 0.5
          });
        } else if (h > 0.985) {
          this.props.push({ x: x + 0.5, y: y + 0.5, art: 'bigrock', s: 0.8 });
        }
      }
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
