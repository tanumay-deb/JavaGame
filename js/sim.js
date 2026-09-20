/* Game state: clock, money, ride cycles, visitor flow, statistics, save/load. */

const SAVE_KEY = 'prehistoric-fun-park-save-v1';

const sim = {
  money: 6000,
  time: 0,               // seconds of game time since the park opened
  month: 0,
  speed: 1,
  paused: false,
  entranceFee: 0,
  visitors: [],
  staff: [],
  effects: [],
  toasts: [],
  stats: [],             // one record per finished month
  unlocked: new Set(),
  selected: null,
  spawnAcc: 0,
  monthIncome: 0,
  monthOutlay: 0,
  totalEarned: 0,
  won: false,
  fights: 0,
  fightCool: 0,      /* seconds before tempers can flare again */

  /* ------------------------------------------------------------- setup */
  newGame() {
    park.reset();
    if (typeof scenery !== 'undefined') scenery.build();
    this.money = 6000; this.time = 0; this.month = 0; this.speed = 1; this.paused = false;
    this.entranceFee = 0;
    this.visitors.length = 0; this.staff.length = 0; this.effects.length = 0;
    this.stats.length = 0; this.toasts.length = 0;
    this.unlocked = new Set();
    this.selected = null; this.monthIncome = 0; this.monthOutlay = 0; this.totalEarned = 0;
    this.won = false; this.fights = 0; this.fightCool = 0;
    traffic.reset();
    if (typeof advice !== 'undefined') advice.reset();
    this.refreshUnlocks(true);
    this.toast('🦴 Welcome to your park! Lay a path, then build a ride.');
  },

  refreshUnlocks(silent) {
    for (const key in ITEMS) {
      if (this.unlocked.has(key)) continue;
      if ((ITEMS[key].unlock || 0) <= this.month) {
        this.unlocked.add(key);
        if (!silent) this.toast('💡 New invention: ' + ITEMS[key].name + '!');
      }
    }
  },

  isUnlocked(key) { return this.unlocked.has(key); },

  /* ------------------------------------------------------------ money */
  income(amount, b, x, y) {
    this.money += amount;
    this.monthIncome += amount;
    this.totalEarned += amount;
    if (x !== undefined) this.effect(x, y, '+' + money(amount), '#ffe08a');
  },
  spend(amount) { this.money -= amount; this.monthOutlay += amount; },
  /* Cash back from selling something you own. It belongs in the month's books
     — otherwise the Stats page shows a loss that never happened — but not in
     what the park has earned from its visitors. */
  refund(amount) { this.money += amount; this.monthIncome += amount; },
  fairPrice(b) { return b.item.fee !== undefined ? b.item.fee : (b.item.price || 0); },

  /* --------------------------------------------------------- feedback */
  toast(msg, kind) {
    this.toasts.push({ msg, kind: kind || '', t: kind === 'tip' ? 7 : 4.5 });
    if (this.toasts.length > 4) this.toasts.shift();
  },
  effect(x, y, text, color) {
    this.effects.push({ x, y, text, color, life: 1.6, max: 1.6, type: 'text' });
  },
  puff(x, y, n) {
    if (this.effects.length > 220) return;
    for (let i = 0; i < (n || 7); i++)
      this.effects.push({ x, y, vx: rnd(-0.5, 0.5), vy: rnd(-0.6, -0.1), life: 0.7, max: 0.7, type: 'dust', r: rnd(2, 5) });
  },

  /* ------------------------------------------------------------- loop */
  update(dtReal) {
    if (this.paused) { this.decayToasts(dtReal); return; }
    const dt = dtReal * this.speed;
    const prevMonth = Math.floor(this.time / MONTH_SECONDS);
    this.time += dt;
    const nowMonth = Math.floor(this.time / MONTH_SECONDS);
    if (nowMonth !== prevMonth) this.endOfMonth();

    this.updateRides(dt);
    this.updateAgents(dt);
    this.spawn(dt);
    traffic.update(dt);
    this.updateEffects(dt);
    this.decayToasts(dtReal);
    advice.tick(dtReal);
    this.checkObjectives();
  },

  decayToasts(dt) {
    for (let i = this.toasts.length - 1; i >= 0; i--) {
      this.toasts[i].t -= dt;
      if (this.toasts[i].t <= 0) this.toasts.splice(i, 1);
    }
  },

  updateEffects(dt) {
    for (let i = this.effects.length - 1; i >= 0; i--) {
      const e = this.effects[i];
      e.life -= dt;
      if (e.type === 'dust') { e.x += (e.vx || 0) * dt; e.y += (e.vy || 0) * dt; }
      if (e.life <= 0) this.effects.splice(i, 1);
    }
  },

  updateRides(dt) {
    for (const b of park.buildings.values()) {
      if (b.item.cat !== 'ride') continue;

      /* How hard the ride is working, and the angle that follows from it. A
         ride used to animate straight off the wall clock, so it ran at full
         speed forever whether or not anybody was on it. Now it winds up when
         a car loads and coasts down as the cycle ends, and its moving parts
         are driven by this instead of by the time of day. */
      const dur = b.item.dur || 1;
      const through = b.timer > 0 ? clamp(1 - b.timer / dur, 0, 1) : 0;
      const wanted = b.timer > 0 && b.powered && !b.brokeDown
        ? Math.max(0, Math.min(1, through / 0.16, (1 - through) / 0.2)) : 0;
      b.run = lerp(b.run || 0, wanted, 1 - Math.exp(-dt * 3.2));
      if (b.run < 0.001) b.run = 0;
      b.spin = (b.spin || 0) + b.run * dt;
      b.through = through;

      if (b.timer > 0) {
        b.timer -= dt;
        if (b.timer <= 0) this.unload(b);
        continue;
      }
      if (!b.open || !b.powered || b.brokeDown) continue;
      if (!b.queue.length) continue;
      /* load the queue */
      const take = Math.min(b.item.cap, b.queue.length);
      b.riders = b.queue.splice(0, take);
      for (const v of b.riders) {
        v.state = 'riding';
        v.queuedFor = null;
        v.money -= b.fee; v.spent += b.fee;
        b.earned += b.fee; b.visits++;
        this.income(b.fee, b, b.x + b.w / 2, b.y + b.h / 2);
      }
      b.timer = b.item.dur;
      b.cycle++;
      b.condition = clamp(b.condition - rnd(0.5, 1.6), 0, 100);
      if (b.condition < 62 && chance((62 - b.condition) / 100 * 0.22)) {
        b.brokeDown = true;
        this.toast('⚠️ The ' + b.item.name + ' has broken down!');
      }
    }
    /* wear on stalls too */
    for (const b of park.buildings.values()) {
      if (b.item.cat === 'stall' || b.item.cat === 'engine') b.condition = clamp(b.condition - dt * 0.15, 0, 100);
    }
  },

  unload(b) {
    const exit = park.accessTiles(b.ext)[0] || park.accessTiles(b.ent)[0] || park.nearestPath(b.x, b.y)
      || { x: park.gate.x, y: park.gate.y };
    for (const v of b.riders) {
      v.x = exit.x; v.y = exit.y;
      v.state = 'idle'; v.timer = rnd(0.2, 0.9);
      v.path = null; v.target = null;
      v.needs.joy = clamp(v.needs.joy + b.item.rating * 9, 0, 100);
      v.needs.energy = clamp(v.needs.energy - 4, 0, 100);
      const value = b.item.rating * 1.15 - b.fee;   /* good value cheers people up */
      v.happiness = clamp(v.happiness + 9 + value * 1.5, 0, 100);
      v.rides++;
      v.ridden = v.ridden || {};
      v.ridden[b.id] = (v.ridden[b.id] || 0) + 1;
      v.thought = 'That was fun!';
      v.say(value > 0 ? '😀' : '😐');
    }
    b.riders = [];
  },

  updateAgents(dt) {
    for (let i = this.visitors.length - 1; i >= 0; i--) {
      const v = this.visitors[i];
      v.update(dt);
      if (v.dead) { v.release(); this.visitors.splice(i, 1); }
    }
    for (const s of this.staff) s.update(dt);
    this.maybeFight(dt);
  },

  /* A brawl used to feed itself: the shock it gave bystanders was enough to
     push them under the threshold that starts the next one, so one scuffle
     cascaded until every visitor in the park was permanently fighting — and a
     fighter is frozen, so the park could never recover. Three things break the
     loop: tempers cool between brawls, the shock cannot on its own drop a
     bystander below the threshold, and a pair calms down afterwards. */
  maybeFight(dt) {
    this.fightCool -= dt;
    if (this.fightCool > 0) return;
    if (!chance(dt * 0.35)) return;
    const angry = this.visitors.filter(v => v.happiness < FIGHT_AT && v.state !== 'riding' && v.fightT <= 0);
    if (angry.length < 2) return;
    const a = pick(angry);
    const b = angry.find(o => o !== a && dist2(o.x, o.y, a.x, a.y) < 4);
    if (!b) return;
    const guarded = this.staff.some(s => s.role === 'guard' && dist2(s.x, s.y, a.x, a.y) < 36);
    if (guarded) return;
    this.fightCool = 6;
    a.fightT = b.fightT = 3.5;
    a.state = b.state = 'fight';
    a.needs.health = clamp(a.needs.health - rnd(30, 55), 0, 100);
    b.needs.health = clamp(b.needs.health - rnd(30, 55), 0, 100);
    a.say('💢', 3.5); b.say('💢', 3.5);
    this.fights++;
    this.toast('💢 A fight broke out! Hire a guard.');
    for (const v of this.visitors) {
      if (v === a || v === b || v.fightT > 0) continue;
      if (dist2(v.x, v.y, a.x, a.y) >= 25) continue;
      v.happiness = clamp(Math.max(v.happiness - 12, FIGHT_AT + 2), 0, 100);
    }
  },

  /* ---------------------------------------------------------- visitors */
  avgHappiness() {
    if (!this.visitors.length) return 50;
    let s = 0;
    for (const v of this.visitors) s += v.happiness;
    return s / this.visitors.length;
  },

  nightCycle: false,     /* nights are switched off for now — always daylight */

  dayLight() {
    if (!this.nightCycle) return 1;
    /* one day/night cycle per month, like the moon icon in the original */
    const p = (this.time % MONTH_SECONDS) / MONTH_SECONDS;
    const u = Math.abs(p - 0.5) / 0.5;          // 1 at noon, 0 at midnight
    return clamp((u - 0.22) / 0.34, 0, 1);
  },

  /* How many people the park can hold. A small clearing and the whole valley
     used to take the same 150; the land you own is the room you have, so the
     crowd grows with it — the nine plots you start on come out about where
     the old fixed cap was. The ceiling of 320 is measured, not guessed: on a
     phone the frame rate is flat from 160 to 320 because most of the crowd is
     culled off screen anyway, and a desktop window showing far more of the
     park still holds 51fps with 320 of them in. */
  maxVisitors() {
    return Math.min(320, Math.round(70 + park.plotsBought * 9));
  },

  spawn(dt) {
    const rating = park.rating(this.avgHappiness());
    const gateOpen = park.isPath(park.gate.x, park.gate.y);
    if (!gateOpen) return;
    const perMonth = rating * 0.95 * (0.35 + 0.65 * this.dayLight());
    if (perMonth <= 0) return;
    const cap = this.maxVisitors();
    this.spawnAcc += dt * (perMonth / MONTH_SECONDS);
    while (this.spawnAcc >= 1) {
      this.spawnAcc -= 1;
      if (this.visitors.length + traffic.pending >= cap) break;
      traffic.pending++;        /* they still have to be driven here */
    }
  },

  /* a vehicle has set someone down on the road outside the gateway */
  arrive(x, y) {
    if (this.visitors.length >= this.maxVisitors()) return;
    const v = new Visitor(x, y);
    if (this.entranceFee > 0) {
      if (v.money < this.entranceFee * 3) return;       /* too dear, they stay on board */
      v.money -= this.entranceFee;
      this.income(this.entranceFee, null, x, y);
      v.happiness -= this.entranceFee * 0.35;
    }
    v.enterPark();
    this.visitors.push(v);
  },

  visitorLeft(v) {
    if (this.selected === v) this.selected = null;
  },

  /* ------------------------------------------------------------ month */
  endOfMonth() {
    this.month++;
    let salaries = 0;
    for (const s of this.staff) salaries += s.def.salary;
    let upkeep = 0;
    for (const b of park.buildings.values()) upkeep += b.item.upkeep || 0;
    this.spend(salaries + upkeep);

    /* what each attraction took and served this moon, so the Stats page can
       rank them rather than only showing money since it was built */
    for (const b of park.buildings.values()) {
      b.moonEarned = (b.earned || 0) - (b.earnedMark || 0);
      b.moonVisits = (b.visits || 0) - (b.visitsMark || 0);
      b.earnedMark = b.earned || 0;
      b.visitsMark = b.visits || 0;
    }

    const income = Math.round(this.monthIncome);
    const outlay = Math.round(this.monthOutlay);   // build costs + wages + upkeep
    this.stats.push({
      month: this.month,
      income, outlay,
      profit: income - outlay,
      visitors: this.visitors.length,
      happiness: Math.round(this.avgHappiness()),
      rating: Math.round(park.rating(this.avgHappiness()))
    });
    if (this.stats.length > 24) this.stats.shift();

    this.monthIncome = 0; this.monthOutlay = 0;
    this.refreshUnlocks(false);
    this.toast('🌙 New moon — wages ' + money(salaries) + ', upkeep ' + money(upkeep));
    if (this.money < 0) this.toast('❗ You are in debt. Raise prices or cut staff.');
    this.autoSave();
  },

  /* -------------------------------------------------------- objectives */
  objectiveState() {
    const rides = park.list('ride').filter(b => b.powered && !b.brokeDown && park.reachable(b));
    return {
      cash: Math.max(0, Math.round(this.money)),
      visitors: this.visitors.length,
      happiness: Math.round(this.avgHappiness()),
      rides: rides.length,
      land: park.plotsBought
    };
  },

  checkObjectives() {
    if (this.won) return;
    const s = this.objectiveState();
    if (OBJECTIVES.every(o => s[o.id] >= o.target)) {
      this.won = true;
      this.toast('🏆 Objectives complete — your tribe made you chief!');
      for (let i = 0; i < 40; i++)
        this.effects.push({ x: park.gate.x + rnd(-6, 6), y: park.gate.y - rnd(0, 8), vx: rnd(-1, 1), vy: rnd(-1.6, -0.4), life: rnd(1, 2), max: 2, type: 'spark', r: rnd(2, 4), color: pick(['#ffd54a', '#ff7b54', '#6fe3c1', '#8ab6ff']) });
    }
  },

  /* ------------------------------------------------------------- staff */
  hire(role) {
    const def = STAFF[role];
    if (this.money < def.salary) { this.toast('Not enough money to hire a ' + def.name); return null; }
    this.spend(def.salary);
    const s = new Staff(role, park.gate.x, park.gate.y);
    this.staff.push(s);
    this.toast('🧑 Hired a ' + def.name + ' (' + money(def.salary) + ' per moon)');
    park.recomputePower();
    return s;
  },

  fire(s) {
    const i = this.staff.indexOf(s);
    if (i < 0) return;
    this.staff.splice(i, 1);
    if (s.assigned) {
      const b = park.buildings.get(s.assigned);
      if (b) b.worker = null;
    }
    if (this.selected === s) this.selected = null;
    park.recomputePower();
    this.toast('Fired the ' + s.def.name);
  },

  staffFor(b) { return this.staff.find(s => s.assigned === b.id) || null; },

  /* --------------------------------------------------------------- land */
  buyLand(px, py) {
    if (!park.plotForSale(px, py)) return false;
    const price = park.plotPrice();
    if (this.money < price) { this.toast('That plot costs ' + money(price)); return false; }
    this.spend(price);
    park.buyPlot(px, py);
    scenery.build();
    this.toast('🌄 Bought a plot of land for ' + money(price));
    for (let i = 0; i < 10; i++)
      this.puff(px * PLOT + rnd(0, PLOT), py * PLOT + rnd(0, PLOT), 2);
    return true;
  },

  /* -------------------------------------------------------------- build */
  build(key, x, y, rot) {
    const item = ITEMS[key];
    const check = park.canPlace(key, x, y, rot);
    if (!check.ok) { this.toast(check.why); return false; }
    if (this.money < item.cost) { this.toast('Not enough money for a ' + item.name); return false; }
    this.spend(item.cost);
    const b = park.place(key, x, y, rot);
    /* a puff of dust for a building; paving a tile is too frequent to warrant one */
    if (item.cat !== 'path') this.puff(x + ((item.w || 1) / 2), y + ((item.h || 1) / 2));
    if (b && b.item.worker && !this.staff.some(s => !s.assigned && s.role === b.item.worker))
      this.toast('The ' + item.name + ' needs a ' + STAFF[b.item.worker].name);
    if (b && b.item.power && !b.powered)
      this.toast('The ' + item.name + ' has no power — build a Dino Treadmill nearby');
    /* an unemployed worker may now have a job */
    for (const s of this.staff) if (!s.assigned && s.role !== 'guard' && s.role !== 'repairman' && s.state === 'idle') s.station();
    return true;
  },

  /* let go of everyone who was queueing for, riding or working at a building */
  release(b) {
    for (const v of this.visitors) {
      if (v.queuedFor === b) { v.queuedFor = null; v.state = 'idle'; v.timer = 0.3; }
      if (v.target && v.target.b === b) { v.target = null; v.path = null; v.state = 'idle'; v.timer = 0.3; }
      if (b.riders && b.riders.includes(v)) { v.state = 'idle'; v.timer = 0.3; v.x = b.x; v.y = b.y; }
      if (v.restBench === b) { v.restBench = null; v.state = 'idle'; v.timer = 0.2; }
    }
    for (const s of this.staff) if (s.assigned === b.id) { s.assigned = null; s.state = 'idle'; s.timer = 0.2; }
    if (b.riders) b.riders.length = 0;
    if (b.queue) b.queue.length = 0;
  },

  /* ---------------------------------------------------- moving a building */
  moving: null,

  startMove(b) {
    if (this.moving) return false;
    this.moving = {
      key: b.key, rot: b.rot, fee: b.fee, open: b.open, condition: b.condition,
      brokeDown: b.brokeDown, earned: b.earned, visits: b.visits,
      from: { x: b.x, y: b.y, rot: b.rot }
    };
    this.release(b);
    if (this.selected === b) this.selected = null;
    park.demolish(b);
    this.toast('Pick a new spot for the ' + ITEMS[this.moving.key].name);
    return true;
  },

  placeMoved(x, y, rot) {
    const m = this.moving;
    if (!m) return false;
    const chk = park.canPlace(m.key, x, y, rot);
    if (!chk.ok) { this.toast(chk.why); return false; }
    const b = park.place(m.key, x, y, rot);
    b.fee = m.fee; b.open = m.open; b.condition = m.condition;
    b.brokeDown = m.brokeDown; b.earned = m.earned; b.visits = m.visits;
    this.moving = null;
    this.puff(x + b.w / 2, y + b.h / 2);
    for (const s of this.staff) if (!s.assigned && s.role !== 'guard' && s.role !== 'repairman' && s.state === 'idle') s.station();
    park.recomputePower();
    this.toast('Moved the ' + b.item.name);
    return true;
  },

  cancelMove() {
    const m = this.moving;
    if (!m) return;
    this.moving = null;
    const b = park.place(m.key, m.from.x, m.from.y, m.from.rot);
    if (b) {
      b.fee = m.fee; b.open = m.open; b.condition = m.condition;
      b.brokeDown = m.brokeDown; b.earned = m.earned; b.visits = m.visits;
    }
    for (const s of this.staff) if (!s.assigned && s.state === 'idle') s.station();
    park.recomputePower();
  },

  /* the demolish tool: a building, or a tile of paving */
  demolishAt(x, y) {
    const b = park.buildingAt(x, y);
    if (b) { this.sell(b); return true; }
    const g = park.groundAt(x, y);
    if (g === GROUND.GRAVEL || g === GROUND.STONE) {
      const cost = (g === GROUND.STONE ? ITEMS.stone.cost : ITEMS.gravel.cost);
      if (park.clearPath(x, y)) { this.refund(Math.round(cost * 0.5)); return true; }
    }
    return false;
  },

  sell(b) {
    const refund = Math.round(b.item.cost * 0.5);
    this.release(b);
    if (this.selected === b) this.selected = null;
    park.demolish(b);
    this.refund(refund);
    this.puff(b.x + b.w / 2, b.y + b.h / 2);
    this.toast('Sold the ' + b.item.name + ' for ' + money(refund));
  },

  /* --------------------------------------------------------- save/load */
  serialize() {
    return {
      v: 1,
      money: this.money, time: this.time, month: this.month, fee: this.entranceFee,
      totalEarned: this.totalEarned, stats: this.stats, won: this.won,
      ground: Array.from(park.ground),
      plots: Array.from(park.plots),
      buildings: Array.from(park.buildings.values()).map(b => ({
        key: b.key, x: b.x, y: b.y, rot: b.rot, fee: b.fee, open: b.open,
        condition: b.condition, broke: b.brokeDown, earned: b.earned, visits: b.visits,
        cycle: b.cycle, earnedMark: b.earnedMark, visitsMark: b.visitsMark,
        moonEarned: b.moonEarned, moonVisits: b.moonVisits
      })),
      staff: this.staff.map(s => s.role)
    };
  },

  save() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(this.serialize()));
      this.toast('💾 Park saved');
      return true;
    } catch (e) { this.toast('Could not save (storage blocked)'); return false; }
  },

  autoSave() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(this.serialize())); } catch (e) { /* ignore */ }
  },

  hasSave() {
    try { return !!localStorage.getItem(SAVE_KEY); } catch (e) { return false; }
  },

  load() {
    let raw;
    try { raw = localStorage.getItem(SAVE_KEY); } catch (e) { raw = null; }
    if (!raw) { this.toast('No saved park found'); return false; }
    let d;
    try { d = JSON.parse(raw); } catch (e) { this.toast('Saved park is damaged'); return false; }
    this.newGame();
    this.money = d.money; this.time = d.time || 0; this.month = d.month || 0;
    this.entranceFee = d.fee || 0; this.totalEarned = d.totalEarned || 0;
    this.stats = d.stats || []; this.won = !!d.won;
    if (d.plots) {
      park.plots.fill(0); park.plotsBought = 0;
      for (let i = 0; i < park.plots.length && i < d.plots.length; i++) {
        park.plots[i] = d.plots[i];
        if (d.plots[i]) park.plotsBought++;
      }
    }
    if (d.ground) for (let i = 0; i < park.ground.length && i < d.ground.length; i++) park.ground[i] = d.ground[i];
    park.buildings.clear(); park.occ.fill(-1); park.nextId = 1;
    for (const s of d.buildings || []) {
      const b = park.place(s.key, s.x, s.y, s.rot);
      if (!b) continue;
      b.fee = s.fee; b.open = s.open; b.condition = s.condition;
      b.brokeDown = s.broke; b.earned = s.earned || 0; b.visits = s.visits || 0;
      b.cycle = s.cycle || 0;
      b.earnedMark = s.earnedMark || 0; b.visitsMark = s.visitsMark || 0;
      b.moonEarned = s.moonEarned || 0; b.moonVisits = s.moonVisits || 0;
    }
    for (const role of d.staff || []) {
      const s = new Staff(role, park.gate.x, park.gate.y);
      this.staff.push(s);
    }
    this.refreshUnlocks(true);
    park.recomputePower();
    park.version++;
    park.fullRebuild = true;
    scenery.build();
    this.toast('📂 Park loaded');
    return true;
  }
};
