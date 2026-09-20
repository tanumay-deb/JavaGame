/* The park advisor: looks at what is actually wrong and says so, now and then.
   Every tip names a real thing in this park, not a general hint. */

const advice = {
  gap: 22,            /* seconds before the first tip */
  recent: {},         /* key -> game time it was last said, so it is not repeated */
  lastKey: null,

  /* one pass over the park, gathering what the rules need */
  survey() {
    const vs = sim.visitors.filter(v => v.state !== 'waiting');
    const s = {
      n: vs.length,
      happy: sim.avgHappiness(),
      needy: { hunger: 0, thirst: 0, bladder: 0, energy: 0, joy: 0, health: 0 },
      queue: 0, seats: 0,
      rides: park.list('ride'),
      stalls: park.list('stall').concat(park.list('service')),
      decor: park.list('decor')
    };
    for (const v of vs) {
      for (const k in s.needy) if (v.needs[k] < (k === 'joy' ? 45 : 30)) s.needy[k]++;
    }
    for (const r of s.rides) { s.queue += r.queue.length; s.seats += r.item.cap; }
    s.working = s.rides.filter(r => r.open && r.powered && !r.brokeDown && park.reachable(r));
    s.kinds = new Set(s.working.map(r => r.key)).size;
    s.provides = need => s.stalls.some(b => b.item.need === need && (!b.item.worker || b.worker));
    s.share = k => (s.n ? s.needy[k] / s.n : 0);
    s.hasStaff = role => sim.staff.some(x => x.role === role);
    return s;
  },

  /* every rule that currently applies, worst first */
  rules() {
    const s = this.survey();
    const out = [];
    const add = (key, score, text) => out.push({ key, score, text });

    for (const r of s.rides) {
      if (!park.reachable(r)) {
        const which = park.accessTiles(r.ent).length ? 'exit' : 'entrance';
        add('path-' + r.id, 95, 'Nobody can use the ' + r.item.name + ' — its ' + which + ' has no path beside it.');
      } else if (r.item.power && !r.powered) {
        add('power-' + r.id, 88, 'The ' + r.item.name + ' has no power. A Dino Treadmill within '
          + ITEMS.engine.radius + ' tiles, with a rider on it, will turn it.');
      } else if (r.brokeDown) {
        add('broken-' + r.id, this.hasRepairman() ? 45 : 80,
          this.hasRepairman() ? 'The ' + r.item.name + ' is broken; your repairman is on the way.'
            : 'The ' + r.item.name + ' has broken down. Hire a repairman before the queue gives up.');
      }
    }
    for (const b of s.stalls) {
      if (b.item.worker && !b.worker) add('staff-' + b.id, 78,
        'The ' + b.item.name + ' is standing idle — it needs a ' + STAFF[b.item.worker].name + '.');
    }

    if (s.n > 4) {
      if (s.share('bladder') > 0.2) add('toilet', 74, s.provides('bladder')
        ? Math.round(s.share('bladder') * 100) + '% of your visitors are queueing for the toilet. Another Toilet Hut would help.'
        : Math.round(s.share('bladder') * 100) + '% of your visitors need the toilet and there is nowhere to go. Build a Toilet Hut.');
      if (s.share('thirst') > 0.25) add('drink', 68, s.provides('thirst')
        ? 'People are thirsty faster than your stalls can serve them — build another Juice Hut.'
        : 'People are thirsty. A Juice Hut with a salesman will fix that, and earn on every cup.');
      if (s.share('hunger') > 0.25) add('food', 66, s.provides('hunger')
        ? 'Your food stalls cannot keep up — build another Snack Bar.'
        : 'People are hungry. A Snack Bar with a salesman keeps them here longer.');
      if (s.share('energy') > 0.3 && park.countOf(b => b.item.rest) < Math.ceil(s.n / 25))
        add('bench', 52, 'Tired visitors get cross. Put a few benches along the busy paths.');
      if (s.share('joy') > 0.4 && s.kinds < 4)
        add('variety', 62, 'Visitors are bored of the same rides. A different kind of ride lifts the whole park.');
    }

    if (s.seats && s.queue > s.seats * 2)
      add('queues', 58, 'Queues are long: ' + s.queue + ' people waiting for ' + s.seats
        + ' seats. Build another ride, or charge a little more on the busiest one.');

    for (const r of s.working.concat(s.stalls)) {
      const worth = sim.fairPrice(r);
      if (!worth || r.visits <= 6) continue;
      if (r.fee > worth * 1.35)
        add('price-' + r.id, 56, 'Visitors think the ' + r.item.name + ' is dear at ' + money(r.fee)
          + '. It is worth about ' + money(worth) + ' to them.');
      else if (r.fee < worth * 0.7 && r.visits > 20)
        add('cheap-' + r.id, 34, 'The ' + r.item.name + ' is busy at ' + money(r.fee)
          + '. Visitors would still pay about ' + money(worth) + '.');
    }

    if (sim.fights > 0 && !s.hasStaff('guard'))
      add('guard', 60, 'Fights have broken out ' + sim.fights + ' time' + (sim.fights > 1 ? 's' : '')
        + '. A guard on patrol stops them before they spoil the mood nearby.');
    if (s.needy.health > 2 && !park.list('service').some(b => b.key === 'aid' && b.worker))
      add('aid', 58, 'Some visitors got hurt in the scuffles. An Aid Post with a shaman patches them up.');
    if (s.n > 6 && s.decor.length < Math.ceil(park.pathTiles() / 12))
      add('beauty', 44, 'A bare park is a dull one. Palms, flowers and torches along the paths lift the mood.');
    if (s.n > 8 && park.countOf(b => b.key === 'stone') === 0 && sim.money > 2000
        && !park.list('path').length)
      add('stone', 30, 'Stone paths are more comfortable underfoot than gravel — worth it on the busy routes.');
    if (sim.entranceFee > 8 && s.n < 20)
      add('fee', 40, 'An entrance fee of ' + money(sim.entranceFee) + ' is turning people away at the gate.');

    out.sort((a, b) => b.score - a.score);
    return out;
  },

  hasRepairman() { return sim.staff.some(s => s.role === 'repairman'); },

  /* the three worth showing in the objectives panel */
  top(n) { return this.rules().slice(0, n || 3); },

  tick(dtReal) {
    this.gap -= dtReal;
    if (this.gap > 0) return;
    const happy = sim.avgHappiness();
    const list = this.rules();
    /* nothing pressing and everyone is content: stay quiet */
    const pick = list.find(r => (sim.time - (this.recent[r.key] || -999)) > 240 && r.key !== this.lastKey);
    if (!pick || (happy > 82 && pick.score < 70)) { this.gap = 40; return; }
    this.recent[pick.key] = sim.time;
    this.lastKey = pick.key;
    sim.toast('💡 ' + pick.text, 'tip');
    this.gap = pick.score > 70 ? 45 : 70;
  },

  reset() { this.gap = 22; this.recent = {}; this.lastKey = null; }
};
