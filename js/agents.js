/* Visitors and staff. Visitors walk only on paths, carry needs and money, queue
   for rides, and can be selected to inspect exactly what they are up to. */

const VIS_SPEED = 1.15;          // tiles per second
const NEED_DECAY = { hunger: 0.85, thirst: 1.0, bladder: 0.7, energy: 0.5, joy: 0.95, health: 0 };

let _agentId = 1;

/* Every pose of every look is baked into its own canvas, so picking colours
   freely would open a wardrobe of over a thousand outfits and grow that cache
   without bound across a long session — and canvas memory never shows up in
   the JS heap, so the tab just dies. The crowd draws from a fixed wardrobe
   instead, which is ample variety at the size a visitor is actually drawn. */
const HAT_TONES = ['#c9a24a', '#8a5a33', '#c94f4f'];
const LOOKS = (() => {
  const out = [];
  for (let i = 0; i < 32; i++) out.push({
    cloth: CLOTH_TONES[i % CLOTH_TONES.length],
    skin: SKIN_TONES[(i * 3) % SKIN_TONES.length],
    hair: HAIR_TONES[(i * 2) % HAIR_TONES.length],
    hat: i % 4 === 0 ? HAT_TONES[i % HAT_TONES.length] : null,
    kid: i % 5 === 0
  });
  return out;
})();

/* a copy, because staff overwrite the clothing on theirs */
function makeLook() { return Object.assign({}, pick(LOOKS)); }

/* ====================================================================== */
function Visitor(x, y) {
  this.id = _agentId++;
  this.kind = 'visitor';
  this.x = x; this.y = y;
  this.tx = x; this.ty = y;
  this.path = null; this.pi = 0;
  this.state = 'idle';
  this.target = null;
  this.timer = 0;
  this.needs = { hunger: rnd(60, 100), thirst: rnd(60, 100), bladder: rnd(70, 100), energy: rnd(70, 100), health: 100, joy: rnd(25, 55) };
  this.money = Math.round(rnd(55, 165));
  this.startMoney = this.money;
  this.happiness = rnd(58, 78);
  this.look = makeLook();
  this.speed = VIS_SPEED * rnd(0.85, 1.15) * (this.look.kid ? 1.1 : 1);
  /* which side of the path this one keeps to, so crowds spread out */
  this.lane = rnd(-0.3, 0.3);
  this.thought = 'Just arrived';
  this.rides = 0;
  this.spent = 0;
  this.age = 0;
  this.queuedFor = null;
  this.queueTime = 0;
  this.fightT = 0;
  this.bubble = null;
  this.bubbleT = 0;
}

Visitor.prototype.say = function (icon, secs) { this.bubble = icon; this.bubbleT = secs || 2.5; };

/* give back whatever this visitor was holding before they disappear */
Visitor.prototype.release = function () {
  if (this.restBench) {
    this.restBench.sitters = Math.max(0, (this.restBench.sitters || 1) - 1);
    this.restBench = null;
  }
  if (this.queuedFor) {
    const q = this.queuedFor.queue, i = q.indexOf(this);
    if (i >= 0) q.splice(i, 1);
    this.queuedFor = null;
  }
};

/* walk in from the road through the gateway; only then does normal life start */
Visitor.prototype.enterPark = function () {
  const g = park.gate;
  this.path = [
    { x: g.x + rnd(-0.3, 0.3), y: ROAD_Y - 0.6 },
    { x: g.x, y: GRID_H - 0.5 },
    { x: g.x, y: g.y }
  ];
  this.pi = 0;
  this.state = 'walk';
  this.target = null;
  this.thought = 'Just arrived at the park';
  this.say('🎟️');
};

/* out through the gateway and back to the road to wait for a lift */
Visitor.prototype.exitToRoad = function () {
  const g = park.gate;
  this.path = [
    { x: g.x, y: GRID_H - 0.5 },
    { x: g.x + rnd(-1.6, 1.6), y: ROAD_Y - 0.7 }
  ];
  this.pi = 0;
  this.state = 'departing';
  this.target = null;
};

Visitor.prototype.goalSet = function (tiles) {
  const s = new Set();
  for (const t of tiles) s.add(t.x + ',' + t.y);
  return s;
};

Visitor.prototype.walkTo = function (tiles, state, target) {
  const p = park.findPath(Math.round(this.x), Math.round(this.y), this.goalSet(tiles));
  if (!p) return false;
  this.path = p; this.pi = 0;
  this.state = state || 'walk';
  this.target = target || null;
  return true;
};

/* pick the most pressing thing to do */
Visitor.prototype.decide = function () {
  const n = this.needs;
  /* out of money or thoroughly fed up -> go home */
  const doneForToday = this.needs.joy > 85 && this.rides > 2 && this.age > 110;
  if (this.money < 3 || this.happiness < 12 || this.age > 240 || doneForToday) {
    this.thought = this.money < 3 ? 'No money left, going home'
      : doneForToday ? 'What a day! Time to go home'
      : this.happiness < 12 ? 'Had enough of this place' : 'Time to head home';
    this.say(this.money < 3 ? '💸' : this.happiness < 12 ? '😠' : '👋');
    return this.leave();
  }
  /* A visitor in sight of a signpost knows where things are, so they set off
     before they are desperate — which matters, because everything keeps
     draining while they walk. */
  const guide = park.signNear(this.x, this.y) ? SIGN_LIFT : 0;
  const order = [
    { k: 'bladder', lim: 32 + guide }, { k: 'health', lim: 55 }, { k: 'thirst', lim: 30 + guide },
    { k: 'hunger', lim: 30 + guide }, { k: 'energy', lim: 28 + guide }, { k: 'joy', lim: 60 }
  ].filter(o => n[o.k] < o.lim).sort((a, b) => n[a.k] - n[b.k]);

  for (const o of order) {
    if (o.k === 'joy') { if (this.seekRide()) return; continue; }
    if (o.k === 'energy') { if (this.seekRest()) return; continue; }
    if (this.seekNeed(o.k)) return;
  }
  if (this.seekRide()) return;
  this.wander();
};

Visitor.prototype.seekNeed = function (need) {
  let best = null, bestD = 1e9;
  for (const b of park.buildings.values()) {
    if (b.item.need !== need || !b.open) continue;
    if (b.item.worker && !b.worker) continue;
    /* b.fee, not item.price: the price is set per stall and item.price is the
       catalogue default shared by every stall of the kind */
    if (b.fee > this.money) continue;
    const d = dist2(this.x, this.y, b.x + b.w / 2, b.y + b.h / 2);
    if (d < bestD) { bestD = d; best = b; }
  }
  if (!best) {
    if (need === 'bladder' && chance(0.02)) { this.thought = 'Where is the toilet?!'; this.say('🚻'); }
    return false;
  }
  const acc = park.accessTiles(best.ent);
  if (!acc.length || !this.walkTo(acc, 'walk', { b: best, kind: 'use' })) return false;
  this.thought = 'Off to the ' + best.item.name;
  this.say(NEED_INFO[need] ? NEED_INFO[need].icon : '🙂');
  return true;
};

Visitor.prototype.seekRest = function () {
  let best = null, bestD = 1e9;
  for (const b of park.buildings.values()) {
    if (!b.item.rest) continue;
    if ((b.sitters || 0) >= 2) continue;        /* a bench seats two */
    const d = dist2(this.x, this.y, b.x, b.y);
    if (d < bestD) { bestD = d; best = b; }
  }
  if (!best) return false;
  const acc = park.accessTiles(best.ent);
  if (!acc.length || !this.walkTo(acc, 'walk', { b: best, kind: 'rest' })) return false;
  best.sitters = (best.sitters || 0) + 1;
  this.thought = 'Need to sit down';
  this.say('💤');
  return true;
};

Visitor.prototype.seekRide = function () {
  const options = [];
  for (const b of park.buildings.values()) {
    if (b.item.cat !== 'ride' || !b.open || !b.powered || b.brokeDown) continue;
    if (!park.reachable(b)) continue;          /* needs a path at the exit too */
    if (b.fee > this.money) continue;
    if (b.queue.length >= b.item.cap * 2) continue;
    const d = Math.sqrt(dist2(this.x, this.y, b.x + b.w / 2, b.y + b.h / 2));
    /* value = excitement, minus price pain, minus how far it is, minus the queue */
    const v = b.item.rating * 10 - b.fee * 2.2 - d * 0.6 - b.queue.length * 1.6
      - (this.ridden && this.ridden[b.id] ? this.ridden[b.id] * 6 : 0);
    options.push({ b, v });
  }
  if (!options.length) {
    if (chance(0.015)) { this.thought = 'Nothing to ride here...'; this.say('🥱'); }
    return false;
  }
  options.sort((a, b) => b.v - a.v);
  const chosen = options[Math.min(options.length - 1, rndInt(0, 1))].b;
  const acc = park.accessTiles(chosen.ent);
  if (!acc.length || !this.walkTo(acc, 'walk', { b: chosen, kind: 'ride' })) return false;
  this.thought = 'Going on the ' + chosen.item.name;
  this.say('🎢');
  return true;
};

Visitor.prototype.wander = function () {
  const tiles = [];
  for (let i = 0; i < 24; i++) {
    const x = rndInt(0, GRID_W - 1), y = rndInt(0, GRID_H - 1);
    if (park.isPath(x, y)) tiles.push({ x, y });
  }
  if (!tiles.length || !this.walkTo([pick(tiles)], 'walk', null)) { this.state = 'idle'; this.timer = 1; }
  else this.thought = 'Having a look around';
};

Visitor.prototype.leave = function () {
  const g = [{ x: park.gate.x, y: park.gate.y }];
  this.state = 'leaving';
  this.target = null;
  if (!this.walkTo(g, 'leaving', null)) this.exitToRoad();
};

Visitor.prototype.arrive = function () {
  const t = this.target;
  this.path = null;
  if (this.state === 'leaving') { this.exitToRoad(); return; }
  if (this.state === 'departing') {
    this.state = 'waiting';
    this.thought = 'Waiting for a ride home';
    this.say('🚏', 6);
    traffic.waitForRide(this);
    return;
  }
  if (!t) { this.state = 'idle'; this.timer = rnd(0.5, 2); return; }
  const b = t.b;
  if (!park.buildings.has(b.id)) { this.state = 'idle'; this.timer = 0.5; return; }

  if (t.kind === 'use') {
    const price = b.fee || 0;
    if (price > this.money) { this.state = 'idle'; this.timer = 1; return; }
    this.money -= price; this.spent += price;
    sim.income(price, b, this.x, this.y);
    b.earned += price; b.visits++;
    this.needs[b.item.need] = Math.min(100, this.needs[b.item.need] + b.item.gain);
    if (b.key === 'cafe') { this.needs.thirst = Math.min(100, this.needs.thirst + 60); this.needs.energy = Math.min(100, this.needs.energy + 40); }
    /* price fairness: a fair price pleases, a rip-off annoys */
    const fair = b.item.cat === 'service' ? 0 : (price - sim.fairPrice(b)) * 1.6;
    this.happiness = clamp(this.happiness + 7 - fair, 0, 100);
    this.state = 'using'; this.timer = rnd(1.4, 2.6);
    this.thought = 'Enjoying the ' + b.item.name;
    this.say(NEED_INFO[b.item.need] ? NEED_INFO[b.item.need].icon : '🙂');
    return;
  }
  if (t.kind === 'rest') {
    this.state = 'resting'; this.timer = rnd(4, 8);
    this.thought = 'Resting on a bench';
    this.restBench = b;
    /* sit on the bench itself, not beside it, so an occupied bench looks
       occupied; two can share one, one at each end */
    /* the drawing adds the half tile, so these are the tile's own coordinates */
    this.seatSide = b.sitters >= 2 ? 0.26 : -0.26;
    this.x = b.x + this.seatSide;
    this.y = b.y;
    this.path = null;
    return;
  }
  if (t.kind === 'ride') {
    if (!b.open || b.brokeDown || !b.powered) { this.state = 'idle'; this.timer = 1; this.happiness -= 4; this.say('😕'); return; }
    b.queue.push(this);
    this.queuedFor = b; this.queueTime = 0;
    this.state = 'queue';
    this.thought = 'Queueing for the ' + b.item.name;
    return;
  }
  this.state = 'idle'; this.timer = 1;
};

Visitor.prototype.update = function (dt) {
  this.age += dt;
  if (this.bubbleT > 0) { this.bubbleT -= dt; if (this.bubbleT <= 0) this.bubble = null; }

  /* needs drain (not while actually on a ride) */
  if (this.state !== 'riding') {
    for (const k in NEED_DECAY) {
      if (!NEED_DECAY[k]) continue;
      const mult = this.state === 'resting' && k === 'energy' ? -3 : 1;
      this.needs[k] = clamp(this.needs[k] - NEED_DECAY[k] * mult * dt, 0, 100);
    }
  }

  /* happiness follows the needs, the scenery and the path underfoot */
  const n = this.needs;
  const needScore = (n.hunger + n.thirst + n.bladder + n.energy + n.joy + n.health) / 6;
  const pretty = park.beautyAt(Math.round(this.x), Math.round(this.y));
  const comfy = park.groundAt(Math.round(this.x), Math.round(this.y)) === GROUND.STONE ? 4 : 0;
  const queuePain = this.state === 'queue' ? -this.queueTime * 0.55 : 0;
  const goal = clamp(needScore * 0.72 + pretty + comfy + queuePain + 8, 0, 100);
  this.happiness = clamp(lerp(this.happiness, goal, 1 - Math.exp(-dt * 0.55)), 0, 100);
  if (n.bladder < 8 || n.hunger < 8) this.happiness = clamp(this.happiness - dt * 4, 0, 100);

  /* Whatever pulled them off the bench — a fight, going home — gives the seat
     back. Without this the bench silently fills up for good. */
  if (this.restBench && this.state !== 'resting') {
    this.restBench.sitters = Math.max(0, (this.restBench.sitters || 1) - 1);
    this.restBench = null;
  }

  /* fights */
  if (this.fightT > 0) {
    this.fightT -= dt;
    /* having had it out, they are not instantly ready to go again */
    if (this.fightT <= 0) {
      this.state = 'idle'; this.timer = 0.5;
      this.happiness = Math.max(this.happiness, FIGHT_AT + 8);
    }
    return;
  }

  switch (this.state) {
    case 'idle':
      this.timer -= dt;
      if (this.timer <= 0) this.decide();
      break;
    case 'using':
    case 'resting':
      this.timer -= dt;
      if (this.timer <= 0) {
        if (this.restBench) {
          /* a proper sit down does more than give the legs a rest */
          this.happiness = clamp(this.happiness + 7, 0, 100);
          this.restBench.sitters = Math.max(0, (this.restBench.sitters || 1) - 1);
          this.restBench = null;
        }
        this.state = 'idle'; this.timer = rnd(0.2, 0.8);
      }
      break;
    case 'queue':
      this.queueTime += dt;
      if (!this.queuedFor || !park.buildings.has(this.queuedFor.id)) { this.queuedFor = null; this.state = 'idle'; break; }
      if (this.queueTime > 45 || (this.queuedFor.brokeDown && this.queueTime > 6)) {
        const q = this.queuedFor.queue;
        const i = q.indexOf(this); if (i >= 0) q.splice(i, 1);
        this.queuedFor = null; this.state = 'idle'; this.timer = 0.4;
        this.happiness -= 12; this.thought = 'Gave up queueing'; this.say('😤');
      }
      break;
    case 'riding':
    case 'waiting':
      break;
    default:
      this.move(dt);
  }
};

/* Everyone used to walk the exact centre line of the path and pivot on the
   spot at every corner, so a crowd moved as one stack of overlapping bodies
   down the middle. Each visitor keeps their own side of the path, and starts
   for the next corner before standing on the current one. */
Visitor.prototype.move = function (dt) {
  if (!this.path) { this.state = 'idle'; this.timer = 0.4; return; }
  let step = this.speed * dt;

  for (let guard = 0; guard < 4; guard++) {
    const node = this.path[this.pi];
    if (!node) { this.arrive(); return; }
    const last = this.pi === this.path.length - 1;

    /* aim a little to one side of the centre line, except at the very last
       node — a queue slot or a doorway has to be hit squarely */
    let tx = node.x, ty = node.y;
    if (!last) {
      const ax = node.x - this.x, ay = node.y - this.y;
      const ad = Math.hypot(ax, ay) || 1;
      tx += (-ay / ad) * this.lane;
      ty += (ax / ad) * this.lane;
    }

    const dx = tx - this.x, dy = ty - this.y;
    const d = Math.hypot(dx, dy);
    /* the corner is taken as soon as it is within reach, not stood upon */
    const reach = last ? step : Math.max(step, 0.3);
    if (d > reach) {
      this.x += (dx / d) * step;
      this.y += (dy / d) * step;
      return;
    }
    if (last) { this.x = node.x; this.y = node.y; }
    else { this.x = tx; this.y = ty; }
    step = Math.max(0, step - d);
    this.pi++;
    if (this.pi >= this.path.length) { this.arrive(); return; }
    if (step <= 0) return;
  }
};

Visitor.prototype.needIcon = function () {
  const n = this.needs;
  if (this.state === 'queue') return '⏳';
  if (n.bladder < 30) return '🚻';
  if (n.health < 55) return '🩹';
  if (n.thirst < 30) return '💧';
  if (n.hunger < 30) return '🍖';
  if (n.energy < 28) return '💤';
  if (this.happiness < 30) return '😠';
  if (this.happiness > 75) return '😀';
  return null;
};

/* ====================================================================== */
function Staff(role, x, y) {
  this.id = _agentId++;
  this.kind = 'staff';
  this.role = role;
  this.def = STAFF[role];
  this.x = x; this.y = y;
  this.path = null; this.pi = 0;
  this.state = 'idle';
  this.timer = 0;
  this.assigned = null;     // building id this worker runs
  this.job = null;          // building being repaired
  this.speed = VIS_SPEED * 1.1;
  this.lane = rnd(-0.22, 0.22);      /* Visitor.move needs one; staff keep tighter */
  /* a narrow slice of the wardrobe, so six trades do not multiply out into
     six times the whole crowd's worth of baked poses */
  this.look = Object.assign({}, LOOKS[rndInt(0, 5)]);
  /* staff are in uniform: the trade's colour, never a child, and a headband
     rather than whatever hat a visitor happened to get */
  this.look.cloth = this.def.color;
  this.look.kid = false;
  this.look.hat = null;
  this.look.staff = role;
  this.thought = 'Looking for work';
  this.bubble = null; this.bubbleT = 0;
}

Staff.prototype.walkTo = Visitor.prototype.walkTo;
Staff.prototype.goalSet = Visitor.prototype.goalSet;
Staff.prototype.move = Visitor.prototype.move;
Staff.prototype.say = Visitor.prototype.say;

Staff.prototype.station = function () {
  /* claim a building that needs this role and has nobody on it */
  for (const b of park.buildings.values()) {
    if (b.item.worker !== this.role || b.worker) continue;
    b.worker = this.id;
    this.assigned = b.id;
    this.thought = 'Working at the ' + b.item.name;
    const acc = park.accessTiles(b.ent);
    if (acc.length) this.walkTo(acc, 'walk', { b, kind: 'post' });
    else { this.x = b.x + b.w / 2; this.y = b.y + b.h / 2; this.state = 'working'; }
    park.recomputePower();
    return true;
  }
  return false;
};

Staff.prototype.update = function (dt) {
  if (this.bubbleT > 0) { this.bubbleT -= dt; if (this.bubbleT <= 0) this.bubble = null; }
  const assigned = this.assigned ? park.buildings.get(this.assigned) : null;
  if (this.assigned && !assigned) { this.assigned = null; this.state = 'idle'; }

  if (this.role === 'repairman') {
    if (this.job && (!park.buildings.has(this.job.id) || !this.job.brokeDown)) { this.job = null; this.state = 'idle'; }
    if (!this.job && this.state !== 'walk') {
      let best = null, bd = 1e9;
      for (const b of park.buildings.values()) {
        if (!b.brokeDown || b.beingFixed) continue;
        const d = dist2(this.x, this.y, b.x, b.y);
        if (d < bd) { bd = d; best = b; }
      }
      if (best) {
        const acc = park.accessTiles(best.ent).concat(park.accessTiles(best.ext));
        if (acc.length && this.walkTo(acc, 'walk', { b: best, kind: 'fix' })) {
          this.job = best; best.beingFixed = true;
          this.thought = 'Off to fix the ' + best.item.name;
          this.say('🔧');
        }
      }
    }
  } else if (!this.assigned && this.role !== 'guard' && this.state === 'idle') {
    if (!this.station()) { this.thought = 'Nothing to do'; this.patrol(); }
  } else if (this.role === 'guard' && this.state === 'idle') {
    this.patrol();
  }

  switch (this.state) {
    case 'idle':
      this.timer -= dt;
      if (this.timer <= 0) { if (this.role === 'guard' || !this.assigned) this.patrol(); else this.timer = 1; }
      break;
    case 'fixing':
      this.timer -= dt;
      if (this.timer <= 0) {
        if (this.job && park.buildings.has(this.job.id)) {
          this.job.brokeDown = false; this.job.condition = 100; this.job.beingFixed = false;
          sim.toast('🔧 ' + this.job.item.name + ' repaired');
        }
        this.job = null; this.state = 'idle'; this.timer = 0.5;
      }
      break;
    case 'working':
      this.timer -= dt;
      if (this.timer <= 0) { this.timer = 2; }
      break;
    default:
      this.move(dt);
  }
};

Staff.prototype.patrol = function () {
  const tiles = [];
  for (let i = 0; i < 20; i++) {
    const x = rndInt(0, GRID_W - 1), y = rndInt(0, GRID_H - 1);
    if (park.isPath(x, y)) tiles.push({ x, y });
  }
  if (tiles.length && this.walkTo([pick(tiles)], 'walk', null)) {
    this.thought = this.role === 'guard' ? 'Keeping order' : 'Walking about';
  } else { this.state = 'idle'; this.timer = 1.5; }
};

Staff.prototype.arrive = function () {
  const t = this.target;
  this.path = null;
  if (!t) { this.state = 'idle'; this.timer = rnd(1, 3); return; }
  if (t.kind === 'fix') {
    this.state = 'fixing'; this.timer = 4;
    this.thought = 'Repairing the ' + t.b.item.name;
  } else if (t.kind === 'post') {
    this.state = 'working'; this.timer = 2;
    this.thought = 'Working at the ' + t.b.item.name;
  } else { this.state = 'idle'; this.timer = 1; }
};
