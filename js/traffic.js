/* The road outside the park: carts, wagons and mammoth buses bring visitors to
   the gateway and carry them home again. Nothing on wheels comes inside. */

const VEHICLES = {
  cart:   { name: 'Dino cart',    cap: 3,  speed: 2.6, len: 26 },
  wagon:  { name: 'Hide wagon',   cap: 6,  speed: 2.1, len: 34 },
  mammoth:{ name: 'Mammoth bus',  cap: 10, speed: 1.7, len: 46 }
};

const traffic = {
  vehicles: [],
  pending: 0,          /* visitors waiting for a lift to the park */
  leaving: [],         /* visitors standing at the road waiting to go home */
  gap: 0,

  reset() { this.vehicles.length = 0; this.pending = 0; this.leaving.length = 0; this.gap = 0; },

  dropX() { return park.gate.x + 0.5; },

  update(dt) {
    this.gap -= dt;
    if (this.pending > 0 && this.gap <= 0 && this.vehicles.length < 7) {
      const type = this.pending >= 8 ? 'mammoth' : this.pending >= 4 ? 'wagon' : 'cart';
      const def = VEHICLES[type];
      const take = Math.min(def.cap, this.pending);
      this.pending -= take;
      this.vehicles.push(this.make(type, take));
      this.gap = rnd(1.1, 2.6);
    }
    for (let i = this.vehicles.length - 1; i >= 0; i--) {
      const v = this.vehicles[i];
      this.step(v, dt);
      if (v.done) this.vehicles.splice(i, 1);
    }
  },

  make(type, load) {
    const dir = chance(0.5) ? 1 : -1;
    return {
      type, def: VEHICLES[type], dir, load,
      x: dir > 0 ? -MARGIN - 3 : GRID_W + MARGIN + 3,
      y: ROAD_Y + (dir > 0 ? 0.55 : 1.45),
      state: 'in', timer: 0, bob: rnd(0, 6), done: false,
      tone: pick(['#8a5a33', '#7a6a45', '#94603f', '#6f5b3e'])
    };
  },

  step(v, dt) {
    /* vehicles already at the stop hold the space, so the rest queue behind */
    let ahead = 0;
    for (const o of this.vehicles) if (o !== v && o.state === 'stopped' && o.dir === v.dir) ahead++;
    const stop = this.dropX() - v.dir * (0.4 + ahead * 1.9);
    if (v.state === 'in') {
      v.x += v.def.speed * v.dir * dt;
      if ((v.dir > 0 && v.x >= stop) || (v.dir < 0 && v.x <= stop)) {
        v.x = stop; v.state = 'stopped'; v.timer = 0.4;
      }
    } else if (v.state === 'stopped') {
      v.timer -= dt;
      if (v.timer <= 0) {
        if (v.load > 0) {
          v.load--;
          sim.arrive(v.x + rnd(-0.3, 0.3), v.y - 0.3);
          v.timer = 0.34;
        } else if (this.leaving.length) {
          /* fill up with people going home */
          const p = this.leaving.pop();
          if (p && !p.dead) { p.dead = true; sim.visitorLeft(p); }
          v.timer = 0.3;
        } else {
          v.state = 'out';
        }
      }
    } else {
      v.x += v.def.speed * v.dir * dt;
      if (v.x < -MARGIN - 5 || v.x > GRID_W + MARGIN + 5) v.done = true;
    }
  },

  /* a visitor who has walked out to the road waits here for a ride */
  waitForRide(v) {
    if (this.leaving.indexOf(v) < 0) this.leaving.push(v);
    /* if nothing is due along soon, they walk home on foot */
    if (this.leaving.length > 14) {
      const p = this.leaving.shift();
      if (p && !p.dead) { p.dead = true; sim.visitorLeft(p); }
    }
  }
};

/* ------------------------------------------------------------------ art */
function wheel(ctx, x, y, r, phase) {
  ctx.fillStyle = '#5b452c';
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#7d6647';
  ctx.beginPath(); ctx.arc(x, y, r * 0.72, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#4a3823'; ctx.lineWidth = 1.4;
  for (let i = 0; i < 5; i++) {
    const a = phase + (i / 5) * Math.PI * 2;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * r * 0.72, y + Math.sin(a) * r * 0.72); ctx.stroke();
  }
  ctx.fillStyle = '#3f3020';
  ctx.beginPath(); ctx.arc(x, y, r * 0.2, 0, Math.PI * 2); ctx.fill();
}

function drawBeast(ctx, x, y, s, col, t, kind) {
  const step = Math.sin(t * 7 + x) * 2.2;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  /* legs */
  ctx.fillStyle = shade(col, -0.25);
  ctx.fillRect(-7, -6, 4.2, 8 + step * 0.4);
  ctx.fillRect(3, -6, 4.2, 8 - step * 0.4);
  /* body */
  ctx.fillStyle = col;
  roundRect(ctx, -11, -18, 24, 14, 6); ctx.fill();
  if (kind === 'mammoth') {
    ctx.fillStyle = shade(col, 0.12);
    roundRect(ctx, -12, -21, 26, 8, 5); ctx.fill();
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.arc(14, -16, 8, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = shade(col, -0.2);
    ctx.beginPath(); ctx.ellipse(11, -18, 5, 6, 0.3, 0, Math.PI * 2); ctx.fill();
    /* trunk and tusks */
    ctx.strokeStyle = col; ctx.lineWidth = 3.4; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(19, -14); ctx.quadraticCurveTo(24, -8, 21, -3); ctx.stroke();
    ctx.strokeStyle = PALETTE.bone; ctx.lineWidth = 2.4;
    ctx.beginPath(); ctx.moveTo(18, -12); ctx.quadraticCurveTo(25, -12, 26, -17); ctx.stroke();
  } else {
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.arc(14, -19, 6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = shade(col, 0.15);
    roundRect(ctx, -10, -19, 20, 4, 2); ctx.fill();
    ctx.fillStyle = shade(col, -0.3);
    ctx.beginPath(); ctx.moveTo(-11, -14); ctx.lineTo(-19, -18); ctx.lineTo(-11, -10); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#2f2f2f';
    ctx.beginPath(); ctx.arc(16, -20, 1.2, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

function drawVehicle(ctx, v, t) {
  const cx = isoX(v.x + 0.5, v.y + 0.5), cy = isoY(v.x + 0.5, v.y + 0.5);
  const moving = v.state !== 'stopped';
  const phase = moving ? v.x * 1.4 : 0;
  const bounce = moving ? Math.sin(t * 9 + v.bob) * 0.8 : 0;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(1.15, 1.15);
  if (v.dir < 0) ctx.scale(-1, 1);          /* mirror for the other direction */
  blob(ctx, 0, 2, v.def.len * 0.55, 6, 0.18);
  ctx.translate(0, bounce);

  if (v.type === 'mammoth') {
    drawBeast(ctx, -18, 0, 1.5, '#7b5a48', moving ? t : 0, 'mammoth');
    /* carriage on its back */
    ctx.fillStyle = '#6f4b2c';
    roundRect(ctx, 2, -34, 34, 15, 4); ctx.fill();
    ctx.fillStyle = '#8a5f38';
    roundRect(ctx, 2, -34, 34, 5, 3); ctx.fill();
    for (let i = 0; i < 3; i++) {
      ctx.fillStyle = CLOTH_TONES[(i + Math.floor(v.bob)) % CLOTH_TONES.length];
      roundRect(ctx, 7 + i * 10, -43, 7, 9, 3); ctx.fill();
      ctx.fillStyle = SKIN_TONES[(i + 1) % SKIN_TONES.length];
      ctx.beginPath(); ctx.arc(10.5 + i * 10, -45, 3, 0, Math.PI * 2); ctx.fill();
    }
    /* canopy */
    ctx.fillStyle = '#c9a24a';
    ctx.beginPath();
    ctx.moveTo(0, -46); ctx.lineTo(38, -46); ctx.lineTo(34, -52); ctx.lineTo(4, -52);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#6f4b2c'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(3, -46); ctx.lineTo(3, -34); ctx.moveTo(35, -46); ctx.lineTo(35, -34); ctx.stroke();
  } else {
    const long = v.type === 'wagon';
    drawBeast(ctx, -22, 0, long ? 1.2 : 1.05, '#6fae5a', moving ? t : 0, 'dino');
    /* shaft */
    ctx.strokeStyle = '#7d6647'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(-18, -8); ctx.lineTo(-2, -12); ctx.stroke();
    /* body */
    const w = long ? 36 : 26;
    ctx.fillStyle = v.tone;
    roundRect(ctx, -2, -22, w, 14, 4); ctx.fill();
    ctx.fillStyle = shade(v.tone, 0.18);
    roundRect(ctx, -2, -22, w, 4.5, 3); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,.22)';
    ctx.fillRect(-2, -12, w, 3);
    if (long) {
      /* hide canopy over the back */
      ctx.fillStyle = '#d8c8a0';
      ctx.beginPath();
      ctx.moveTo(6, -22); ctx.quadraticCurveTo(20, -40, 34, -22);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,.18)'; ctx.lineWidth = 1.2;
      for (let i = 1; i < 4; i++) {
        const px = 6 + i * 7;
        ctx.beginPath(); ctx.moveTo(px, -22); ctx.lineTo(px, -22 - (10 - Math.abs(i - 2) * 3)); ctx.stroke();
      }
    }
    const seats = long ? 3 : 2;
    for (let i = 0; i < seats; i++) {
      if (i >= v.load + 1 && v.state === 'out') break;
      ctx.fillStyle = CLOTH_TONES[(i + Math.floor(v.bob)) % CLOTH_TONES.length];
      roundRect(ctx, 3 + i * 9, -30, 6.5, 9, 3); ctx.fill();
      ctx.fillStyle = SKIN_TONES[(i + 2) % SKIN_TONES.length];
      ctx.beginPath(); ctx.arc(6.2 + i * 9, -32, 2.8, 0, Math.PI * 2); ctx.fill();
    }
    wheel(ctx, 4, -6, 6.5, phase);
    if (long) wheel(ctx, 28, -6, 6.5, phase);
  }
  ctx.restore();
}
