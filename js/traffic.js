/* The road outside the park: carts, wagons and mammoth buses bring visitors to
   the gateway and carry them home again. Nothing on wheels comes inside. */

const VEHICLES = {
  car: { name: 'Car', cap: 4, speed: 3.0, len: 34 },
  van: { name: 'Minibus', cap: 8, speed: 2.4, len: 44 },
  bus: { name: 'Coach', cap: 16, speed: 1.9, len: 62 }
};

const CAR_COLOURS = ['#c0493f', '#416dad', '#e0a33c', '#f7f1e4', '#323b48', '#4a905d', '#9273bc'];
const BUS_COLOURS = ['#e0a33c', '#c0493f', '#4389b9', '#5a9d56'];

const traffic = {
  vehicles: [],
  pending: 0,          /* visitors waiting for a lift to the park */
  leaving: [],         /* visitors standing at the road waiting to go home */
  gap: 0,

  reset() { this.vehicles.length = 0; this.pending = 0; this.leaving.length = 0; this.gap = 0; },

  dropX() { return park.gate.x + 0.5; },

  update(dt) {
    this.gap -= dt;
    /* A lift is worth sending for people going home, not only for people
       coming in. Without this, anyone who left the park while nobody happened
       to be arriving stood at the roadside for good — and a crowd of stranded,
       miserable visitors is what tips the park into brawling. */
    const demand = Math.max(this.pending, this.leaving.length);
    if (demand > 0 && this.gap <= 0 && this.vehicles.length < 7) {
      const type = demand >= 10 ? 'bus' : demand >= 5 ? 'van' : 'car';
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
      vel: 0, braking: false, settle: 0,
      seats: VEHICLES[type].cap,          /* how many it can carry home */
      tone: pick(type === 'bus' ? BUS_COLOURS : CAR_COLOURS)
    };
  },

  step(v, dt) {
    /* vehicles already at the stop hold the space, so the rest queue behind */
    let ahead = 0;
    for (const o of this.vehicles) if (o !== v && o.state === 'stopped' && o.dir === v.dir) ahead++;
    const stop = this.dropX() - v.dir * (0.4 + ahead * 1.9);
    v.settle = Math.max(0, (v.settle || 0) - dt * 3.2);

    if (v.state === 'in' || v.state === 'out') {
      const cruise = v.def.speed;
      let target = cruise;

      /* slow into the stop rather than arriving at full speed and freezing */
      if (v.state === 'in') {
        const ds = (stop - v.x) * v.dir;
        if (ds <= 0.02) {
          v.x = stop; v.vel = 0; v.state = 'stopped'; v.timer = 0.45;
          v.settle = 1;                       /* the suspension dips as it halts */
          return;
        }
        /* with a floor under it, or the last hand's breadth takes forever */
        target = Math.min(target, cruise * Math.max(0.16, Math.min(1, ds / 2.8)));
      }

      /* and keep off the back of whoever is in front in the same direction */
      let gap = 1e9;
      for (const o of this.vehicles) {
        if (o === v || o.dir !== v.dir) continue;
        const d = (o.x - v.x) * v.dir;
        if (d > 0 && d < gap) gap = d;
      }
      const headway = 1.3 + (v.def.len + 34) / 64;
      if (gap < headway + 1.4) target = Math.min(target, cruise * clamp((gap - headway) / 1.4, 0, 1));

      v.vel = v.vel === undefined ? 0 : v.vel;
      v.braking = target < v.vel - 0.05;
      /* brakes bite harder than the engine pulls away */
      const rate = (target > v.vel ? 2.0 : 5.5) * dt;
      v.vel += clamp(target - v.vel, -rate, rate);
      v.x += v.vel * v.dir * dt;

      if (v.state === 'out' && (v.x < -MARGIN - 5 || v.x > GRID_W + MARGIN + 5)) v.done = true;
      return;
    }

    if (v.state === 'stopped') {
      v.timer -= dt;
      if (v.timer <= 0) {
        if (v.load > 0) {
          v.load--;
          sim.arrive(v.x + rnd(-0.3, 0.3), v.y - 0.3);
          v.timer = 0.34;
        } else if (this.leaving.length && v.seats > 0) {
          /* fill up with people going home, but only to the seats it has */
          v.seats--;
          const p = this.leaving.pop();
          if (p && !p.dead) { p.dead = true; sim.visitorLeft(p); }
          v.timer = 0.3;
        } else {
          v.state = 'out';
          v.settle = 0.6;                     /* and again as it pulls away */
        }
      }
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
  ctx.fillStyle = '#101725';
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#d6d4ce';
  ctx.beginPath(); ctx.arc(x, y, r * 0.52, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#8f9296'; ctx.lineWidth = 1.2;
  for (let i = 0; i < 4; i++) {
    const a = phase + (i / 4) * Math.PI * 2;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * r * 0.5, y + Math.sin(a) * r * 0.5); ctx.stroke();
  }
  ctx.fillStyle = '#565d66';
  ctx.beginPath(); ctx.arc(x, y, r * 0.16, 0, Math.PI * 2); ctx.fill();
}

function windowStrip(ctx, x, y, w, h, r) {
  ctx.fillStyle = '#aedae4';
  roundRect(ctx, x, y, w, h, r || 2); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.45)';
  ctx.beginPath();
  ctx.moveTo(x, y + h); ctx.lineTo(x + w * 0.45, y); ctx.lineTo(x + w * 0.72, y); ctx.lineTo(x + w * 0.22, y + h);
  ctx.closePath(); ctx.fill();
}

function drawVehicle(ctx, v, t) {
  const cx = isoX(v.x + 0.5, v.y + 0.5), cy = isoY(v.x + 0.5, v.y + 0.5);
  const speed = v.vel === undefined ? v.def.speed : v.vel;
  const phase = v.x * 2.2;                /* wheels turn with distance, not time */
  /* the faster it goes the more it jiggles, and it dips on its springs as it
     stops and again as it pulls away */
  const bounce = Math.sin(t * 13 + v.bob) * 0.5 * clamp(speed / v.def.speed, 0, 1)
    + Math.sin((v.settle || 0) * 9) * (v.settle || 0) * 1.4;
  const col = v.tone;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(1.3, 1.3);
  if (v.dir < 0) ctx.scale(-1, 1);        /* mirror for the other direction */
  blob(ctx, 0, 2, v.def.len * 0.5, 6, 0.22);
  ctx.translate(0, bounce);

  /* brake lights, so slowing down reads before the vehicle has stopped */
  if (v.braking || v.state === 'stopped') {
    const L0 = v.def.len;
    ctx.fillStyle = 'rgba(232,70,50,.85)';
    for (const ly of [-9, -15]) {
      ctx.beginPath(); ctx.ellipse(-L0 / 2 - 1, ly, 2.2, 2.6, 0, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = 'rgba(232,70,50,.22)';
    ctx.beginPath(); ctx.ellipse(-L0 / 2 - 4, -12, 7, 7, 0, 0, Math.PI * 2); ctx.fill();
  }

  if (v.type === 'bus') {
    const L = 62, H = 26;
    /* body */
    ctx.fillStyle = col;
    roundRect(ctx, -L / 2, -H - 7, L, H, 6); ctx.fill();
    ctx.fillStyle = shade(col, -0.28);
    roundRect(ctx, -L / 2, -14, L, 7, 3); ctx.fill();
    ctx.fillStyle = shade(col, 0.22);
    roundRect(ctx, -L / 2, -H - 7, L, 4, 3); ctx.fill();
    /* windows */
    for (let i = 0; i < 5; i++) windowStrip(ctx, -L / 2 + 5 + i * 11, -H - 2, 9, 11, 2);
    /* windscreen and door */
    windowStrip(ctx, L / 2 - 9, -H - 2, 7, 11, 2);
    ctx.fillStyle = 'rgba(0,0,0,.25)';
    roundRect(ctx, -L / 2 + 16, -H + 4, 7, 16, 2); ctx.fill();
    /* destination board */
    ctx.fillStyle = '#19202e';
    roundRect(ctx, L / 2 - 20, -H - 5, 15, 5, 2); ctx.fill();
    ctx.fillStyle = '#eec355';
    ctx.font = 'bold 4px system-ui, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('FUN PARK', L / 2 - 12.5, -H - 1.2);
    /* lights */
    ctx.fillStyle = '#ffecaa';
    roundRect(ctx, L / 2 - 3, -13, 3, 4, 1); ctx.fill();
    ctx.fillStyle = '#d05041';
    roundRect(ctx, -L / 2, -13, 3, 4, 1); ctx.fill();
    /* passengers behind the glass */
    for (let i = 0; i < 4; i++) {
      if (v.state === 'out' && i > 1) break;
      ctx.fillStyle = SKIN_TONES[(i + Math.floor(v.bob)) % SKIN_TONES.length];
      ctx.beginPath(); ctx.arc(-L / 2 + 9.5 + i * 11, -H + 4, 2.6, 0, Math.PI * 2); ctx.fill();
    }
    wheel(ctx, -L / 2 + 13, -6, 7, phase);
    wheel(ctx, L / 2 - 14, -6, 7, phase);
  } else if (v.type === 'van') {
    const L = 44, H = 22;
    ctx.fillStyle = col;
    roundRect(ctx, -L / 2, -H - 6, L, H, 5); ctx.fill();
    /* sloped bonnet at the front */
    ctx.beginPath();
    ctx.moveTo(L / 2 - 2, -H - 6 + 6); ctx.lineTo(L / 2 + 6, -12); ctx.lineTo(L / 2 + 6, -6); ctx.lineTo(L / 2 - 2, -6);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = shade(col, 0.2);
    roundRect(ctx, -L / 2, -H - 6, L, 3.5, 3); ctx.fill();
    ctx.fillStyle = shade(col, -0.3);
    roundRect(ctx, -L / 2, -12, L, 6, 2); ctx.fill();
    for (let i = 0; i < 3; i++) windowStrip(ctx, -L / 2 + 5 + i * 11, -H - 1, 9, 9, 2);
    windowStrip(ctx, L / 2 - 6, -H - 1, 7, 8, 2);
    ctx.fillStyle = 'rgba(0,0,0,.22)';
    roundRect(ctx, -2, -H + 3, 6, 13, 2); ctx.fill();
    ctx.fillStyle = '#ffecaa';
    roundRect(ctx, L / 2 + 2, -11, 4, 3.5, 1); ctx.fill();
    ctx.fillStyle = '#d05041';
    roundRect(ctx, -L / 2, -11, 3, 3.5, 1); ctx.fill();
    for (let i = 0; i < 3; i++) {
      if (v.state === 'out' && i > 0) break;
      ctx.fillStyle = SKIN_TONES[(i + 1) % SKIN_TONES.length];
      ctx.beginPath(); ctx.arc(-L / 2 + 9.5 + i * 11, -H + 4, 2.4, 0, Math.PI * 2); ctx.fill();
    }
    wheel(ctx, -L / 2 + 10, -5, 6, phase);
    wheel(ctx, L / 2 - 9, -5, 6, phase);
  } else {
    const L = 34;
    /* lower body */
    ctx.fillStyle = col;
    roundRect(ctx, -L / 2, -13, L, 9, 4); ctx.fill();
    /* cabin */
    ctx.beginPath();
    ctx.moveTo(-L / 2 + 6, -13);
    ctx.lineTo(-L / 2 + 10, -22);
    ctx.lineTo(L / 2 - 10, -22);
    ctx.lineTo(L / 2 - 4, -13);
    ctx.closePath();
    ctx.fillStyle = shade(col, 0.08); ctx.fill();
    /* glass */
    ctx.fillStyle = '#aedae4';
    ctx.beginPath();
    ctx.moveTo(-L / 2 + 8, -13.5); ctx.lineTo(-L / 2 + 11.5, -20.5);
    ctx.lineTo(-1, -20.5); ctx.lineTo(-1, -13.5);
    ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(1, -13.5); ctx.lineTo(1, -20.5); ctx.lineTo(L / 2 - 10.5, -20.5); ctx.lineTo(L / 2 - 5.5, -13.5);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.4)';
    ctx.beginPath();
    ctx.moveTo(2, -13.5); ctx.lineTo(6, -20.5); ctx.lineTo(9, -20.5); ctx.lineTo(5, -13.5);
    ctx.closePath(); ctx.fill();
    /* trim, lights, wheels */
    ctx.fillStyle = shade(col, -0.35);
    roundRect(ctx, -L / 2, -6.5, L, 3, 2); ctx.fill();
    ctx.fillStyle = '#ffecaa';
    roundRect(ctx, L / 2 - 3.5, -11, 3.5, 3, 1); ctx.fill();
    ctx.fillStyle = '#d05041';
    roundRect(ctx, -L / 2, -11, 3, 3, 1); ctx.fill();
    ctx.fillStyle = SKIN_TONES[Math.floor(v.bob) % SKIN_TONES.length];
    ctx.beginPath(); ctx.arc(-4, -17, 2.3, 0, Math.PI * 2); ctx.fill();
    if (v.load > 1) {
      ctx.fillStyle = SKIN_TONES[(Math.floor(v.bob) + 2) % SKIN_TONES.length];
      ctx.beginPath(); ctx.arc(5, -17, 2.3, 0, Math.PI * 2); ctx.fill();
    }
    wheel(ctx, -L / 2 + 8, -4.5, 5.5, phase);
    wheel(ctx, L / 2 - 8, -4.5, 5.5, phase);
  }
  ctx.restore();
}
