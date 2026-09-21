/* HUD, build sheet, inspector panels and the statistics modals. */

const CHART = { profit: '#3AA98F', loss: '#D06B4A', visitors: '#5D8FD6', happy: '#B07BD0' };
const WARN = '#E8A53C';      /* reserved for a state, never for a series */
/* Mood runs bad-to-good, so it is a diverging scale: two hues with a neutral
   in the middle, never a rainbow and never a hue at the midpoint. */
/* Validated: adjacent steps clear the normal-vision floor (18.1) and the CVD
   floor (13.6). The midpoint reads grey and the poles sit outside the
   categorical lightness band on purpose — that is what makes it diverging
   rather than a set of categories. Every band is labelled anyway. */
const MOOD_BANDS = ['#0E7A66', '#6ED3A4', '#8E8E88', '#F0A868', '#C4453A'];

const ui = {
  build: { key: null, rot: 0 },
  pending: null,          /* a spot picked out, waiting for the green tick */
  landMode: false,
  demolishMode: false,
  tab: 'path',
  el: {},
  lastInspect: 0,

  init() {
    const $ = id => document.getElementById(id);
    this.el = {
      money: $('hud-money'), happy: $('hud-happy'), visitors: $('hud-visitors'), staff: $('hud-staff'),
      rating: $('hud-rating'), month: $('hud-month'), moon: $('moon'),
      toasts: $('toasts'), inspector: $('inspector'), sheet: $('sheet'),
      tabs: $('sheet-tabs'), cards: $('sheet-cards'), modal: $('modal'), modalBody: $('modal-body'),
      buildbar: $('buildbar'), buildbarName: $('buildbar-name'), dock: $('dock'),
      confirm: $('confirm'), yes: $('confirm-yes'), no: $('confirm-no'),
      rot: $('confirm-rot'), tag: $('confirm-tag')
    };

    this.el.yes.addEventListener('click', () => this.confirmPlace());
    this.el.no.addEventListener('click', () => this.cancelPlacement());
    this.el.rot.addEventListener('click', () => this.rotate());

    $('speeds').addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      const s = +b.dataset.speed;
      sim.paused = s === 0;
      if (s > 0) sim.speed = s;
      for (const x of $('speeds').children) x.classList.toggle('on', +x.dataset.speed === (sim.paused ? 0 : sim.speed));
    });

    $('btn-build').addEventListener('click', () => this.toggleSheet());
    $('btn-staff').addEventListener('click', () => this.staffModal());
    $('btn-stats').addEventListener('click', () => this.statsModal());
    $('btn-goals').addEventListener('click', () => this.goalsModal());
    $('btn-menu').addEventListener('click', () => this.menuModal());
    const happyChip = this.el.happy.parentElement;
    if (happyChip) {
      happyChip.classList.add('tappable');
      happyChip.addEventListener('click', () => this.moodModal());
    }
    $('btn-rotate').addEventListener('click', () => this.rotate());
    $('btn-cancel-build').addEventListener('click', () => {
      if (this.demolishMode) this.stopDemolish();
      else if (this.landMode) this.stopLand();
      else if (this.build.moving) this.endMove(true);
      else this.setBuild(null);
    });

    document.addEventListener('click', e => {
      const c = e.target.closest('[data-close]');
      if (c) this.close(c.dataset.close);
      /* one listener for every button in the game rather than dozens */
      if (e.target.closest('button, .card, .tab')) audio.play('tap');
    });

    this.buildTabs();
    this.selectTab('path');
  },

  close(id) {
    document.getElementById(id).classList.add('hidden');
    if (id === 'sheet') document.getElementById('btn-build').classList.remove('on');
  },

  /* ------------------------------------------------------------ build UI */
  toggleSheet() {
    if (this.landMode) this.stopLand();
    if (this.demolishMode) this.stopDemolish();
    const s = this.el.sheet;
    const open = s.classList.contains('hidden');
    s.classList.toggle('hidden', !open);
    document.getElementById('btn-build').classList.toggle('on', open);
    if (open) this.renderCards();
  },

  buildTabs() {
    this.el.tabs.innerHTML = '';
    for (const t of BUILD_TABS) {
      const b = document.createElement('button');
      b.textContent = t.label;
      b.onclick = () => this.selectTab(t.id);
      b.dataset.tab = t.id;
      this.el.tabs.appendChild(b);
    }
  },

  selectTab(id) {
    this.tab = id;
    for (const b of this.el.tabs.children) b.classList.toggle('on', b.dataset.tab === id);
    if (id === 'land') { this.startLand(); return; }
    if (id === 'clear') { this.startDemolish(); return; }
    this.stopDemolish();
    this.renderCards();
  },

  /* --------------------------------------------------------- demolish */
  startDemolish() {
    this.setBuild(null);
    this.stopLand();
    this.demolishMode = true;
    this.close('sheet');
    this.el.buildbar.classList.remove('hidden');
    document.getElementById('btn-rotate').classList.add('hidden');
    this.el.buildbarName.textContent = '💥 Demolish · tap to clear';
    sim.toast('Tap a ride, shop or path to clear it. Half the cost comes back.');
  },

  stopDemolish() {
    if (!this.demolishMode) return;
    this.demolishMode = false;
    document.getElementById('btn-rotate').classList.remove('hidden');
    this.el.buildbar.classList.add('hidden');
    if (this.tab === 'clear') this.tab = 'path';
    for (const b of this.el.tabs.children) b.classList.toggle('on', b.dataset.tab === this.tab);
  },

  demolishAt(tx, ty) {
    if (!sim.demolishAt(tx, ty)) return;
    sim.puff(tx + 0.5, ty + 0.5, 5);
  },

  /* ------------------------------------------------------------- land */
  startLand() {
    this.setBuild(null);
    this.stopDemolish();
    this.landMode = true;
    this.close('sheet');
    this.el.buildbar.classList.remove('hidden');
    document.getElementById('btn-rotate').classList.add('hidden');
    this.landLabel();
    sim.toast('Tap a marked plot to buy it and clear the forest.');
  },

  landLabel() {
    this.el.buildbarName.textContent = 'Land · ' + money(park.plotPrice()) + ' a plot';
  },

  stopLand() {
    this.landMode = false;
    document.getElementById('btn-rotate').classList.remove('hidden');
    this.el.buildbar.classList.add('hidden');
    if (this.tab === 'land') this.tab = 'path';
    for (const b of this.el.tabs.children) b.classList.toggle('on', b.dataset.tab === this.tab);
  },

  buyPlotAt(tx, ty) {
    const p = park.plotOf(tx, ty);
    if (!park.plotForSale(p.px, p.py)) return;
    if (sim.buyLand(p.px, p.py)) this.landLabel();
  },

  renderCards() {
    const tab = BUILD_TABS.find(t => t.id === this.tab);
    const box = this.el.cards;
    box.innerHTML = '';
    for (const key of tab.items) {
      const item = ITEMS[key];
      const card = document.createElement('button');
      card.className = 'card';
      const locked = !sim.isUnlocked(key);
      const poor = sim.money < item.cost;
      if (locked) card.classList.add('locked');
      if (poor) card.classList.add('poor');
      if (this.build.key === key) card.classList.add('on');

      const cv = document.createElement('canvas');
      cv.width = 240; cv.height = 112;
      card.appendChild(cv);

      const row1 = document.createElement('div');
      row1.className = 'row1';
      const nm = document.createElement('div');
      nm.className = 'nm'; nm.textContent = item.name;
      const pr = document.createElement('div');
      pr.className = 'price'; pr.textContent = money(item.cost);
      row1.appendChild(nm); row1.appendChild(pr);
      card.appendChild(row1);

      const chips = document.createElement('div');
      chips.className = 'chips';
      const chip = (text, cls) => {
        const c = document.createElement('span');
        c.className = 'chip2' + (cls ? ' ' + cls : '');
        c.textContent = text;
        chips.appendChild(c);
      };
      if (item.cat === 'ride') {
        chip('★ ' + item.rating + '/10', 'rt');
        chip('👥 ' + item.cap);
        chip('🎟 ' + money(item.fee));
        if (item.power) chip('⚡ power', 'pw');
      } else if (item.cat === 'engine') {
        chip('⚡ ' + item.radius + ' tiles', 'pw');
        chip('🦕 rider', 'st');
      } else if (item.cat === 'path') {
        chip(item.comfort > 0.4 ? 'comfy' : 'cheap');
        chip('per tile');
      } else {
        if (item.need) chip(NEED_INFO[item.need].icon + ' ' + NEED_INFO[item.need].label);
        if (item.price) chip('🎟 ' + money(item.price));
        if (item.beauty) chip('🌿 +' + item.beauty);
        if (item.rest) chip('💤 rest');
        if (item.sign) chip('🧭 signs');
      }
      if (item.worker) chip('👷 ' + STAFF[item.worker].name, 'st');
      card.appendChild(chips);

      if (locked) {
        const l = document.createElement('div');
        l.className = 'lock';
        l.innerHTML = '<span class="big">🔒</span><span class="txt">invented at moon ' + item.unlock + '</span>';
        card.appendChild(l);
      }
      if (!locked) card.addEventListener('pointerdown', e => this.startTrayDrag(e, key));
      box.appendChild(card);
      this.thumb(cv, key);
    }
  },

  /* draw the real sprite into a card so the menu shows what you get */
  thumb(cv, key) {
    const item = ITEMS[key];
    const ctx = cv.getContext('2d');
    ctx.clearRect(0, 0, cv.width, cv.height);
    if (item.cat === 'path') {
      const g = makeCanvas(TILE_W * 2, TILE_H * 2);
      const c2 = g.getContext('2d');
      for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) {
        diamond(c2, TILE_W / 2 + isoX(x, y), TILE_H + isoY(x, y), TILE_W, TILE_H);
        c2.fillStyle = item.ground === GROUND.STONE ? PALETTE.stone : PALETTE.gravel;
        c2.fill();
        c2.strokeStyle = 'rgba(0,0,0,.18)'; c2.lineWidth = 1; c2.stroke();
      }
      const s = Math.min(cv.width / g.width, cv.height / g.height) * 0.9;
      ctx.drawImage(g, (cv.width - g.width * s) / 2, (cv.height - g.height * s) / 2, g.width * s, g.height * s);
      return;
    }
    const prev = getPreview(key);
    const bb = prev.bounds;
    const s = Math.min(cv.width / bb.w, cv.height / bb.h) * 0.94;
    ctx.drawImage(prev.c, bb.x, bb.y, bb.w, bb.h,
      (cv.width - bb.w * s) / 2, (cv.height - bb.h * s) / 2, bb.w * s, bb.h * s);
  },

  /* pick the building up and carry it to a new spot */
  startMove() {
    const b = sim.selected;
    if (!b || !b.item) return;
    if (!sim.startMove(b)) return;
    this.select(null);
    this.landMode = false;
    this.build.key = sim.moving.key;
    this.build.rot = sim.moving.rot;
    this.build.moving = true;
    this.el.buildbar.classList.remove('hidden');
    document.getElementById('btn-rotate').classList.remove('hidden');
    this.el.buildbarName.textContent = 'Moving ' + ITEMS[this.build.key].name;
    this.close('sheet');
  },

  endMove(cancelled) {
    if (cancelled && sim.moving) sim.cancelMove();
    this.build.moving = false;
    this.build.key = null;
    this.clearPending();
    this.el.buildbar.classList.add('hidden');
    this.renderCards();
  },

  /* long-press on the map picks a building up and carries it */
  grab(b, tx, ty) {
    if (!b || !b.item || this.build.key || this.landMode) return false;
    if (!sim.startMove(b)) return false;
    this.select(null);
    this.build.key = sim.moving.key;
    this.build.rot = sim.moving.rot;
    this.build.moving = true;
    this.el.buildbar.classList.remove('hidden');
    document.getElementById('btn-rotate').classList.remove('hidden');
    this.el.buildbarName.textContent = 'Moving ' + ITEMS[this.build.key].name;
    this.setPending(tx, ty);
    if (navigator.vibrate) { try { navigator.vibrate(18); } catch (e) { /* ignore */ } }
    return true;
  },

  setBuild(key) {
    if (this.build.moving) this.endMove(true);
    if (key) { this.stopLand(); this.stopDemolish(); }
    this.clearPending();
    this.build.key = key;
    this.build.rot = 0;
    const on = !!key;
    this.el.buildbar.classList.toggle('hidden', !on);
    if (on) {
      this.el.buildbarName.textContent = ITEMS[key].name + ' · ' + money(ITEMS[key].cost);
      sim.selected = null;
      this.el.inspector.classList.add('hidden');
    }
    this.renderCards();
  },

  rotate() {
    if (!this.build.key) return;
    this.build.rot = (this.build.rot + 1) % 4;
    if (this.pending) this.setPending(this.pending.x, this.pending.y);
  },

  /* ------------------------------------------------- confirm a placement */
  /* Picking a spot does not build anything: it parks a ghost there with a
     tick and a cross either side of it, so nothing is built by a stray tap. */
  setPending(x, y) {
    const key = this.build.key;
    if (!key) return;
    const item = ITEMS[key];
    const [w, h] = park.rotDims(item, this.build.rot);
    /* the footprint sits under the finger, not down and to the right of it */
    const ox = clamp(x - ((w - 1) >> 1), 0, GRID_W - w);
    const oy = clamp(y - ((h - 1) >> 1), 0, GRID_H - h);
    this.pending = { key, rot: this.build.rot, x: ox, y: oy, w, h };
    this.el.confirm.classList.remove('hidden');
    this.positionConfirm();
  },

  pendingCost() {
    const p = this.pending;
    if (!p) return 0;
    return this.build.moving ? 0 : ITEMS[p.key].cost;
  },

  clearPending() {
    this.pending = null;
    this.el.confirm.classList.add('hidden');
  },

  /* the red cross drops whatever is in hand, rather than just moving it */
  cancelPlacement() {
    this.clearPending();
    if (this.build.moving) this.endMove(true);      /* a carried building goes back */
    else this.setBuild(null);
  },

  /* pull an item straight out of the tray and onto the map */
  startTrayDrag(e, key) {
    if (!sim.isUnlocked(key)) return;
    this.trayDrag = { key, id: e.pointerId, x0: e.clientX, y0: e.clientY, live: false, touch: e.pointerType === 'touch' };
  },

  trayDragMove(e) {
    const d = this.trayDrag;
    if (!d || e.pointerId !== d.id) return false;
    const dx = e.clientX - d.x0, dy = e.clientY - d.y0;
    if (!d.live) {
      if (Math.hypot(dx, dy) < 14) return false;
      d.live = true;
      this.setBuild(d.key);
      this.close('sheet');
    }
    const r = renderer.canvas.getBoundingClientRect();
    const lift = d.touch ? 74 : 0;          /* keep the ghost out from under the thumb */
    const t = renderer.screenToTile(e.clientX - r.left, e.clientY - r.top - lift);
    renderer.hover = t;
    this.setPending(t.x, t.y);
    return true;
  },

  trayDragEnd(e) {
    const d = this.trayDrag;
    this.trayDrag = null;
    if (d && !d.live) { this.setBuild(d.key); if (window.innerWidth < 760) this.close('sheet'); }
    return !!(d && d.live);
  },

  pendingOk() {
    const p = this.pending;
    if (!p) return false;
    if (!park.canPlace(p.key, p.x, p.y, p.rot).ok) return false;
    return sim.money >= this.pendingCost();
  },

  confirmPlace() {
    const p = this.pending;
    if (!p) return;
    if (!this.pendingOk()) {
      const why = park.canPlace(p.key, p.x, p.y, p.rot);
      sim.toast(why.ok ? 'Not enough money for a ' + ITEMS[p.key].name : why.why);
      return;
    }
    if (this.build.moving) {
      if (sim.placeMoved(p.x, p.y, p.rot)) { this.clearPending(); this.endMove(false); }
      return;
    }
    if (sim.build(p.key, p.x, p.y, p.rot)) {
      const placed = park.buildingAt(p.x, p.y);
      this.clearPending();
      this.setBuild(null);
      /* open its panel so the price can be set straight away */
      if (placed && (placed.item.cat === 'ride' || placed.item.cat === 'stall')) this.select(placed);
    }
  },

  /* keep the controls pinned around the ghost: cancel and confirm either
     side, rotate below, and the price above it */
  positionConfirm() {
    const p = this.pending;
    if (!p) return;
    const [wx, wy] = [isoX(p.x + p.w / 2, p.y + p.h / 2), isoY(p.x + p.w / 2, p.y + p.h / 2)];
    const [sx, sy] = renderer.worldToScreen(wx, wy);
    const spread = Math.max(64, (p.w + p.h) * (TILE_W / 4) * view.zoom + 44);
    const drop = Math.max(46, (p.w + p.h) * (TILE_H / 4) * view.zoom + 40);
    const top = clamp(sy, 84, renderer.H - 120);
    this.el.no.style.left = clamp(sx - spread, 40, renderer.W - 40) + 'px';
    this.el.no.style.top = top + 'px';
    this.el.yes.style.left = clamp(sx + spread, 40, renderer.W - 40) + 'px';
    this.el.yes.style.top = top + 'px';
    const canRot = !ITEMS[p.key].w || ITEMS[p.key].w !== ITEMS[p.key].h || ITEMS[p.key].cat === 'ride';
    this.el.rot.classList.toggle('hidden', !canRot);
    this.el.rot.style.left = clamp(sx, 34, renderer.W - 34) + 'px';
    this.el.rot.style.top = clamp(top + drop, 84, renderer.H - 84) + 'px';

    const ok = this.pendingOk();
    const why = park.canPlace(p.key, p.x, p.y, p.rot);
    this.el.yes.classList.toggle('muted', !ok);
    this.el.yes.title = ok ? 'Build here' : (why.why || 'Not enough money');

    const tag = this.el.tag;
    tag.style.left = clamp(sx, 60, renderer.W - 60) + 'px';
    tag.style.top = clamp(top - drop - 10, 62, renderer.H - 60) + 'px';
    tag.classList.toggle('bad', !ok);
    if (!why.ok) tag.textContent = why.why;
    else if (this.build.moving) tag.textContent = 'Move here';
    else tag.textContent = money(ITEMS[p.key].cost);
  },

  /* ------------------------------------------------------------ HUD tick */
  update(dt) {
    /* a narrow phone cannot hold both a six-figure balance and the speed
       buttons, so the balance is abbreviated there */
    this.el.money.textContent = renderer.W <= 620 ? moneyShort(sim.money) : money(sim.money);
    this.el.money.style.color = sim.money < 0 ? CHART.loss : '';
    this.el.happy.textContent = Math.round(sim.avgHappiness()) + '%';
    this.el.visitors.textContent = sim.visitors.length;
    this.el.staff.textContent = sim.staff.length;
    this.el.rating.textContent = Math.round(park.rating(sim.avgHappiness()));
    this.el.month.textContent = 'Moon ' + (sim.month + 1);
    this.drawMoon();
    this.renderToasts();
    if (this.pending) this.positionConfirm();
    if (sim.selected && performance.now() - this.lastInspect > 250) this.renderInspector();
  },

  drawMoon() {
    const c = this.el.moon, ctx = c.getContext('2d');
    const p = (sim.time % MONTH_SECONDS) / MONTH_SECONDS;
    ctx.clearRect(0, 0, c.width, c.height);
    const cx = c.width / 2, cy = c.height / 2, r = 11;
    ctx.fillStyle = '#2a2318';
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, r - 1, 0, Math.PI * 2); ctx.clip();
    ctx.fillStyle = '#efe3c2';
    ctx.beginPath(); ctx.arc(cx, cy, r - 1, 0, Math.PI * 2); ctx.fill();
    /* shadow disc slides across to show the phase */
    ctx.fillStyle = '#17130d';
    const off = (p * 2 - 1) * (r * 2.1);
    ctx.beginPath(); ctx.arc(cx + off, cy, r - 1, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    ctx.fillStyle = 'rgba(0,0,0,.18)';
    ctx.beginPath(); ctx.arc(cx - 3, cy - 3, 2, 0, Math.PI * 2); ctx.arc(cx + 3, cy + 2, 1.6, 0, Math.PI * 2); ctx.fill();
  },

  renderToasts() {
    const box = this.el.toasts;
    const want = sim.toasts.map(t => t.kind + t.msg).join('|');
    if (box.dataset.k === want) return;
    box.dataset.k = want;
    box.innerHTML = '';
    for (const t of sim.toasts) {
      const d = document.createElement('div');
      d.className = 'toast' + (t.kind ? ' ' + t.kind : '');
      d.textContent = t.msg;
      box.appendChild(d);
    }
  },

  /* --------------------------------------------------------- inspector */
  select(target) {
    sim.selected = target;
    if (!target) { this.el.inspector.classList.add('hidden'); return; }
    this.renderInspector();
    this.el.inspector.classList.remove('hidden');
  },

  bar(v, max, col) {
    const p = clamp(v / max * 100, 0, 100);
    return '<div class="bar"><i style="width:' + p.toFixed(0) + '%;background:' + col + '"></i></div>';
  },

  needColor(v) { return v > 60 ? '#3aa98f' : v > 30 ? '#e8a53c' : '#d06b4a'; },

  renderInspector() {
    this.lastInspect = performance.now();
    const s = sim.selected;
    if (!s) { this.el.inspector.classList.add('hidden'); return; }
    let html = '<button class="close-x" onclick="ui.select(null)">✕</button>';
    if (s.kind === 'visitor') html += this.visitorHtml(s);
    else if (s.kind === 'staff') html += this.staffHtml(s);
    else html += this.buildingHtml(s);
    this.el.inspector.innerHTML = html;
    /* drawn straight away: waiting a frame leaves the panel blank for one */
    const cv = this.el.inspector.querySelector('#ins-thumb');
    if (cv && s.item) this.thumb(cv, s.key);
  },

  visitorHtml(v) {
    const mood = v.happiness > 66 ? 'happy' : v.happiness > 33 ? 'so-so' : 'miserable';
    let h = '<h3>Visitor #' + v.id + '</h3><div class="role">Feeling ' + mood + '</div>';
    h += '<div class="thought">“' + v.thought + '”</div>';
    h += '<div class="row"><span class="k">Happiness</span><span class="v">' + Math.round(v.happiness) + '%</span></div>';
    h += this.bar(v.happiness, 100, this.needColor(v.happiness));
    h += '<div class="row"><span class="k">Money left</span><span class="v">' + money(v.money) + '</span></div>';
    h += '<div class="row"><span class="k">Spent here</span><span class="v">' + money(v.spent) + '</span></div>';
    h += '<div class="row"><span class="k">Rides taken</span><span class="v">' + v.rides + '</span></div>';
    h += '<div class="needs">';
    for (const k of ['hunger', 'thirst', 'bladder', 'energy', 'joy', 'health']) {
      const n = NEED_INFO[k];
      h += '<div class="need">' + n.icon + ' ' + n.label + this.bar(v.needs[k], 100, this.needColor(v.needs[k])) + '</div>';
    }
    h += '</div>';
    h += '<div class="btns"><button onclick="ui.follow()">🎯 Follow</button></div>';
    return h;
  },

  staffHtml(s) {
    const b = s.assigned ? park.buildings.get(s.assigned) : null;
    let h = '<h3>' + s.def.name + '</h3><div class="role">' + s.def.desc + '</div>';
    h += '<div class="thought">“' + s.thought + '”</div>';
    h += '<div class="row"><span class="k">Wage each moon</span><span class="v">' + money(s.def.salary) + '</span></div>';
    h += '<div class="row"><span class="k">Posted at</span><span class="v">' + (b ? b.item.name : '—') + '</span></div>';
    h += '<div class="btns"><button onclick="ui.follow()">🎯 Follow</button>'
      + '<button class="danger" onclick="ui.fireSelected()">Fire</button></div>';
    return h;
  },

  /* a small picture of the thing, drawn into the panel header */
  headThumb() { return '<canvas id="ins-thumb" width="204" height="156"></canvas>'; },

  stars(n) {
    const full = Math.round(n / 2);
    return '<span class="stars">' + '★'.repeat(full) + '<span style="opacity:.3">' + '★'.repeat(5 - full) + '</span></span>';
  },

  meter(label, value, text, col) {
    return '<div class="meter"><div class="lab"><span>' + label + '</span><b>' + text + '</b></div>'
      + this.bar(value, 100, col) + '</div>';
  },

  buildingHtml(b) {
    const it = b.item;
    const flags = [];
    if (it.power && !b.powered) flags.push('<span class="tag bad">no power</span>');
    if (it.worker && !b.worker) flags.push('<span class="tag warn">needs a ' + STAFF[it.worker].name + '</span>');
    if (b.brokeDown) flags.push('<span class="tag bad">broken down</span>');
    if (it.cat === 'ride' && !park.reachable(b)) {
      const missing = park.accessTiles(b.ent).length ? 'exit' : 'entrance';
      flags.push('<span class="tag warn">no path at the ' + missing + '</span>');
    }
    if (!b.open) flags.push('<span class="tag">closed</span>');
    if (!flags.length) flags.push('<span class="tag ok">running</span>');

    let h = '<div class="ins-head">' + this.headThumb(b) + '<div class="t"><h3>' + it.name + '</h3>'
      + '<div class="role">' + (it.cat === 'ride' ? this.stars(it.rating) + ' · seats ' + it.cap
        : (it.desc || it.cat)) + '</div></div></div>';
    h += '<div style="margin:2px 0 6px">' + flags.join(' ') + '</div>';

    if (it.cat === 'ride') {
      const qPct = clamp(b.queue.length / Math.max(1, it.cap * 2) * 100, 0, 100);
      h += '<div class="meters">'
        + this.meter('Condition', b.condition, Math.round(b.condition) + '%', this.needColor(b.condition))
        + this.meter('Queue', qPct, b.queue.length + ' waiting', qPct > 80 ? '#d06b4a' : '#5d8fd6')
        + '</div>';
      h += '<div class="price-row"><div><div class="lab">Ticket price</div>'
        + '<div class="val">' + money(b.fee) + '</div>'
        + '<div class="hint ' + this.valueClass(b) + '">' + this.valueText(b) + '</div></div>'
        + '<div class="stepper big"><button onclick="ui.price(-1)">−</button>'
        + '<button onclick="ui.price(1)">+</button></div></div>';
      h += '<div class="row"><span class="k">Riders so far</span><span class="v">' + b.visits + '</span></div>';
      h += '<div class="row"><span class="k">Taken</span><span class="v">' + money(b.earned) + '</span></div>';
      h += '<div class="row"><span class="k">Upkeep each moon</span><span class="v">' + money(it.upkeep) + '</span></div>';
      h += '<div class="btns"><button onclick="ui.toggleOpen()">' + (b.open ? '⛔ Close' : '▶ Open') + '</button>'
        + '<button onclick="ui.startMove()">✥ Move</button>'
        + '<button class="danger" onclick="ui.sellSelected()">Sell ' + money(Math.round(it.cost * 0.5)) + '</button></div>';
      if (!park.reachable(b)) h += '<div class="btns"><button onclick="ui.connectSelected()">🛠️ Lay a path to the doors</button></div>';
    } else if (it.cat === 'stall' || (it.cat === 'service' && it.price)) {
      h += '<div class="price-row"><div><div class="lab">Price</div>'
        + '<div class="val">' + money(b.fee) + '</div>'
        + '<div class="hint ' + this.valueClass(b) + '">' + this.valueText(b) + '</div></div>'
        + '<div class="stepper big"><button onclick="ui.price(-1)">−</button>'
        + '<button onclick="ui.price(1)">+</button></div></div>';
      h += '<div class="row"><span class="k">Served</span><span class="v">' + b.visits + '</span></div>';
      h += '<div class="row"><span class="k">Taken</span><span class="v">' + money(b.earned) + '</span></div>';
      h += '<div class="btns"><button onclick="ui.startMove()">✥ Move</button>'
        + '<button class="danger" onclick="ui.sellSelected()">Sell ' + money(Math.round(it.cost * 0.5)) + '</button></div>';
    } else if (b.key === 'gate') {
      h += '<div class="price-row"><div><div class="lab">Entrance fee</div>'
        + '<div class="val">' + money(sim.entranceFee) + '</div>'
        + '<div class="hint">A high fee keeps poorer visitors away</div></div>'
        + '<div class="stepper big"><button onclick="ui.fee(-1)">−</button>'
        + '<button onclick="ui.fee(1)">+</button></div></div>';
      h += '<div class="btns"><button onclick="ui.startMove()">✥ Move</button>'
        + '<button class="danger" onclick="ui.sellSelected()">Sell</button></div>';
    } else if (it.cat === 'engine') {
      const powered = park.list('ride').filter(r => r.item.power && r.powered).length;
      h += '<div class="row"><span class="k">Dino rider</span><span class="v">' + (b.worker ? 'on the wheel' : 'none!') + '</span></div>';
      h += '<div class="row"><span class="k">Powered rides</span><span class="v">' + powered + '</span></div>';
      h += '<div class="row"><span class="k">Reach</span><span class="v">' + it.radius + ' tiles</span></div>';
      h += '<div class="btns"><button onclick="ui.startMove()">✥ Move</button>'
        + '<button class="danger" onclick="ui.sellSelected()">Sell</button></div>';
    } else {
      if (it.beauty) h += '<div class="row"><span class="k">Beauty</span><span class="v">+' + it.beauty + '</span></div>';
      h += '<div class="btns"><button onclick="ui.startMove()">✥ Move</button>'
        + '<button class="danger" onclick="ui.sellSelected()">Sell ' + money(Math.round(it.cost * 0.5)) + '</button></div>';
    }
    return h;
  },

  /* is the ticket good value for what the ride is worth? */
  valueClass(b) {
    const worth = sim.fairPrice(b);
    if (b.fee <= worth * 0.85) return 'good';
    if (b.fee <= worth * 1.25) return 'fair';
    return 'steep';
  },
  valueText(b) {
    const worth = sim.fairPrice(b);
    const c = this.valueClass(b);
    if (c === 'good') return 'Good value · worth ' + money(worth);
    if (c === 'fair') return 'About right · worth ' + money(worth);
    return 'Steep · only worth ' + money(worth);
  },

  /* lay the missing path from the panel */
  connectSelected() {
    const b = sim.selected;
    if (!b || !b.item || b.item.cat !== 'ride') return;
    let laid = 0, cost = 0;
    for (const door of [b.ent, b.ext]) {
      const run = park.linkPathFrom(door, b.x, b.y, b.w, b.h);
      if (!run || !run.length) continue;
      for (const t of run) if (sim.build('gravel', t.x, t.y, 0)) { laid++; cost += ITEMS.gravel.cost; }
    }
    if (laid) sim.toast('🛠️ Laid ' + laid + ' path tiles for ' + money(cost));
    else sim.toast('No room to lay a path to the doors');
    this.renderInspector();
  },

  follow() {
    const s = sim.selected;
    if (s) renderer.centerOn(s.x, s.y);
  },
  price(d) {
    const b = sim.selected;
    if (!b || !b.item) return;
    b.fee = clamp(b.fee + d, 0, 40);
    this.renderInspector();
  },
  fee(d) { sim.entranceFee = clamp(sim.entranceFee + d, 0, 30); this.renderInspector(); },
  toggleOpen() { const b = sim.selected; if (b) { b.open = !b.open; this.renderInspector(); } },
  sellSelected() { const b = sim.selected; if (b && b.item) { sim.sell(b); this.select(null); } },
  fireSelected() { const s = sim.selected; if (s && s.kind === 'staff') { sim.fire(s); this.select(null); } },

  /* ------------------------------------------------------------- modals */
  modal(html) {
    this.el.modalBody.innerHTML = html;
    this.el.modal.classList.remove('hidden');
  },

  staffModal() {
    let h = '<h2>Staff</h2><h3>Hire</h3><div class="cards" style="padding:0;grid-template-columns:repeat(auto-fill,minmax(150px,1fr))">';
    for (const role in STAFF) {
      const d = STAFF[role];
      h += '<button class="card" onclick="ui.hire(\'' + role + '\')">'
        + '<div class="nm">' + d.name + '</div>'
        + '<div class="price">' + money(d.salary) + ' / moon</div>'
        + '<div class="meta">' + d.desc + '</div></button>';
    }
    h += '</div><h3>On the payroll (' + sim.staff.length + ')</h3>';
    if (!sim.staff.length) h += '<div class="role">Nobody yet. Stalls and treadmills do not run themselves.</div>';
    for (const s of sim.staff) {
      const b = s.assigned ? park.buildings.get(s.assigned) : null;
      h += '<div class="staff-row"><span class="dot" style="background:' + s.def.color + '"></span>'
        + '<span class="nm">' + s.def.name + '<div class="sub">' + (b ? 'at the ' + b.item.name : s.thought) + '</div></span>'
        + '<button onclick="ui.fireById(' + s.id + ')" class="tag bad" style="cursor:pointer">Fire</button></div>';
    }
    const total = sim.staff.reduce((a, s) => a + s.def.salary, 0);
    h += '<div class="row" style="margin-top:8px"><span class="k">Wages each moon</span><span class="v">' + money(total) + '</span></div>';
    this.modal(h);
  },

  hire(role) { sim.hire(role); this.staffModal(); },
  fireById(id) { const s = sim.staff.find(x => x.id === id); if (s) { sim.fire(s); this.staffModal(); } },

  goalsModal() {
    const st = sim.objectiveState();
    let h = '<h2>Objectives</h2><div class="role">Meet all four and the tribe makes you chief.</div>';
    for (const o of OBJECTIVES) {
      const v = st[o.id], done = v >= o.target;
      h += '<div class="goal"><span>' + (done ? '✅' : '⬜') + '</span><span style="min-width:112px">' + o.label + '</span>'
        + this.bar(v, o.target, done ? CHART.profit : '#e8a53c')
        + '<span class="n">' + Math.round(v) + ' / ' + o.target + '</span></div>';
    }
    h += '<h3>Park</h3>';
    h += '<div class="row"><span class="k">Rides built</span><span class="v">' + park.list('ride').length + '</span></div>';
    h += '<div class="row"><span class="k">Shops & services</span><span class="v">' + (park.list('stall').length + park.list('service').length) + '</span></div>';
    h += '<div class="row"><span class="k">Path tiles</span><span class="v">' + park.pathTiles() + '</span></div>';
    h += '<div class="row"><span class="k">Land owned</span><span class="v">' + park.plotsBought + ' plots · next ' + money(park.plotPrice()) + '</span></div>';
    h += '<div class="row"><span class="k">Earned all time</span><span class="v">' + money(sim.totalEarned) + '</span></div>';
    h += '<div class="row"><span class="k">Fights broken out</span><span class="v">' + sim.fights + '</span></div>';

    const tips = advice.top(4);
    h += '<h3>Making them happier</h3>';
    if (!tips.length) h += '<div class="role">Nothing is going wrong that I can see — the park is running well.</div>';
    else h += '<div class="tips-list">' + tips.map(t =>
      '<div class="tip-row' + (t.score >= 70 ? ' hot' : '') + '"><span class="b">'
      + (t.score >= 70 ? '⚠️' : '💡') + '</span><span>' + t.text + '</span></div>').join('') + '</div>';
    this.modal(h);
  },

  /* The park's mood, broken out. Happiness is one number per visitor, so the
     bands below are cuts of that number — and each cut is a threshold the game
     itself already acts on, rather than a round number picked for the table. */
  moodModal() {
    const vs = sim.visitors.filter(v => v.state !== 'waiting');
    let h = '<h2>How the tribe feels</h2>';
    if (!vs.length) {
      h += '<div class="role">Nobody is in the park yet.</div>';
      this.modal(h);
      return;
    }
    const bands = [
      { k: 'Delighted', icon: '\u{1F600}', min: 75, note: 'smiling as they walk' },
      { k: 'Happy', icon: '\u{1F642}', min: 55, note: 'enjoying themselves' },
      { k: 'Content', icon: '\u{1F610}', min: 30, note: 'nothing to complain of' },
      { k: 'Fed up', icon: '\u{1F620}', min: FIGHT_AT, note: 'scowling, close to leaving' },
      { k: 'Furious', icon: '\u{1F621}', min: -1, note: 'angry enough to start a fight' }
    ];
    const counts = bands.map(() => 0);
    for (const v of vs) {
      for (let i = 0; i < bands.length; i++) if (v.happiness >= bands[i].min) { counts[i]++; break; }
    }
    h += '<div class="chart"><div class="ct"><span>Average happiness</span><b>'
      + Math.round(sim.avgHappiness()) + '%</b></div></div>';
    h += '<table class="data perf mood"><tbody>';
    for (let i = 0; i < bands.length; i++) {
      const pct = Math.round((counts[i] / vs.length) * 100);
      h += '<tr><td>' + bands[i].icon + ' ' + bands[i].k
        + '<span class="sub">' + bands[i].note + '</span></td>'
        + '<td class="num"><div class="perfbar"><i style="width:' + pct + '%;background:'
        + MOOD_BANDS[i] + '"></i></div><b>' + counts[i] + '</b></td>'
        + '<td class="num">' + pct + '%</td></tr>';
    }
    h += '</tbody></table>';

    /* Where the mood actually comes from. Every row is a term of the sum the
       simulation runs, averaged over everyone in the park, so the player can
       see which lever is slack rather than guessing at it. */
    const parts = [
      { k: 'needs',   cap: 100 * NEED_WEIGHT, label: 'Fed, watered and rested', how: 'stalls close to the paths' },
      { k: 'pretty',  cap: BEAUTY_CAP,        label: 'Something to look at',    how: 'decor along the routes' },
      { k: 'thrill',  cap: RIDE_LIFT,         label: 'Rides they have been on', how: 'more rides, shorter queues' },
      { k: 'content', cap: CONTENT_LIFT,      label: 'Nothing nagging them',    how: 'enough stalls to keep up' },
      { k: 'lit',     cap: LIGHT_CHEER,       label: 'Standing in torchlight',  how: 'torches along the paths' },
      { k: 'comfy',   cap: 6.5 * 0.6,         label: 'Comfortable underfoot',   how: 'stone instead of gravel' }
    ];
    const withParts = vs.filter(v => v.moodParts);
    if (withParts.length) {
      h += '<h3>Where the mood comes from</h3>';
      h += '<table class="data perf"><tbody>';
      for (const p of parts) {
        let sum = 0;
        for (const v of withParts) sum += v.moodParts[p.k] || 0;
        const val = sum / withParts.length;
        const pct = Math.round(clamp(val / p.cap, 0, 1) * 100);
        h += '<tr><td>' + p.label + '<span class="sub">' + p.how + '</span></td>'
          + '<td class="num"><div class="perfbar"><i style="width:' + pct + '%;background:'
          + (pct >= 66 ? MOOD_BANDS[1] : pct >= 33 ? MOOD_BANDS[2] : MOOD_BANDS[3]) + '"></i></div>'
          + '<b>' + val.toFixed(1) + '</b></td>'
          + '<td class="num">of ' + p.cap.toFixed(0) + '</td></tr>';
      }
      h += '</tbody></table>';
    }

    /* what is actually pulling it down, counted rather than guessed */
    const need = { hunger: 0, thirst: 0, bladder: 0, energy: 0, joy: 0, health: 0 };
    let queueing = 0, fighting = 0;
    for (const v of vs) {
      for (const k in need) if (v.needs[k] < (k === 'joy' ? 45 : 30)) need[k]++;
      if (v.state === 'queue') queueing++;
      if (v.fightT > 0) fighting++;
    }
    const gripes = Object.keys(need).map(k => ({ k, n: need[k] }))
      .filter(g => g.n > 0).sort((a, b) => b.n - a.n);
    h += '<h3>What is bothering them</h3>';
    if (!gripes.length && !fighting) {
      h += '<div class="role">Nothing much — everybody is fed, watered and entertained.</div>';
    } else {
      h += '<table class="data perf"><tbody>';
      for (const g of gripes) {
        const info = NEED_INFO[g.k];
        const pct = Math.round((g.n / vs.length) * 100);
        h += '<tr><td>' + (info ? info.icon + ' ' + info.label : g.k) + '</td>'
          + '<td class="num"><div class="perfbar"><i style="width:' + pct + '%;background:'
          + CHART.loss + '"></i></div><b>' + g.n + '</b></td>'
          + '<td class="num">' + pct + '%</td></tr>';
      }
      h += '</tbody></table>';
    }
    h += '<div class="role">' + queueing + ' queueing'
      + (fighting ? ' \u00b7 ' + fighting + ' fighting' : '') + '.</div>';

    const tips = advice.top(4);
    h += '<h3>What would help</h3>';
    h += tips.length
      ? '<ul class="tips">' + tips.map(t => '<li>' + t.text + '</li>').join('') + '</ul>'
      : '<div class="role">The park is running well — nothing to fix right now.</div>';
    this.modal(h);
  },

  /* The park you actually built. Winning used to be a toast and some confetti,
     which is a thin reward for an hour's work — this is the record of it, and
     the game carries on afterwards. Reachable again from the Menu. */
  winModal() {
    const st = sim.objectiveState();
    const moons = sim.wonAt || sim.month;
    /* A grade off the two things that are genuinely hard: getting there
       quickly, and keeping the tribe happy while you did. */
    const speed = clamp(1 - (moons - 8) / 26, 0, 1);
    const mood = clamp((sim.peakHappy - 55) / 35, 0, 1);
    const score = speed * 0.5 + mood * 0.5;
    const grade = score > 0.8 ? ['Great Chief', 'the valley will tell stories about this one']
      : score > 0.6 ? ['Chief', 'a park the tribe is proud of']
      : score > 0.38 ? ['Elder', 'it took a while, but it works']
      : ['Keeper of the Gate', 'the park stands — that is the main thing'];

    let h = '<h2>\u{1F3C6} ' + grade[0] + '</h2>';
    h += '<div class="role">Every objective met in <b>' + moons + ' moon' + (moons === 1 ? '' : 's')
      + '</b> \u00b7 ' + grade[1] + '.</div>';

    const rows = [
      ['Guests through the gate', sim.guests.toLocaleString('en-US')],
      ['Biggest crowd at once', sim.peakCrowd],
      ['Happiest the tribe got', Math.round(sim.peakHappy) + '%'],
      ['Best park rating', Math.round(sim.peakRating)],
      ['Earned all time', money(sim.totalEarned)],
      ['Left in the pot', money(sim.money)],
      ['Land owned', park.plotsBought + ' plot' + (park.plotsBought === 1 ? '' : 's')],
      ['Rides built', park.list('ride').length],
      ['Shops and services', park.list('stall').length + park.list('service').length],
      ['On the payroll', sim.staff.length],
      ['Fights broken out', sim.fights]
    ];
    h += '<h3>The park at a glance</h3>';
    for (const [k, v] of rows)
      h += '<div class="row"><span class="k">' + k + '</span><span class="v">' + v + '</span></div>';

    /* whichever attraction the visitors actually loved, and whichever paid */
    let loved = null, richest = null;
    for (const b of park.buildings.values()) {
      const c = b.item.cat;
      if (c !== 'ride' && c !== 'stall' && c !== 'service') continue;
      if (!b.visits) continue;
      if (!loved || b.visits > loved.visits) loved = b;
      if (!richest || (b.earned || 0) > (richest.earned || 0)) richest = b;
    }
    if (loved || richest) {
      h += '<h3>Pick of the park</h3>';
      if (loved) h += '<div class="row"><span class="k">Most ridden</span><span class="v">'
        + loved.item.name + ' \u00b7 ' + loved.visits.toLocaleString('en-US') + ' times</span></div>';
      if (richest) h += '<div class="row"><span class="k">Best earner</span><span class="v">'
        + richest.item.name + ' \u00b7 ' + money(richest.earned || 0) + '</span></div>';
    }

    /* the shape of the money, moon by moon */
    const hist = sim.stats.slice(-18);
    if (hist.length > 1) {
      h += this.chartBlock('Profit, moon by moon', money(hist[hist.length - 1].profit), 'c-won');
      h += '<div class="legend"><span><i style="background:' + CHART.profit + '"></i>profit</span>'
        + '<span><i style="background:' + CHART.loss + '"></i>loss</span></div>';
    }
    h += '<div class="btns"><button class="primary" data-close="modal">Keep playing</button></div>';
    this.modal(h);
    if (hist.length > 1)
      requestAnimationFrame(() => this.barChart(document.getElementById('c-won'), hist.map(r => r.profit), true));
  },

  menuModal() {
    const h = '<h2>Menu <span class="ver">v' + VERSION + '</span></h2>'
      + '<div class="btns">'
      + '<button onclick="sim.save()">💾 Quick save</button>'
      + '<button onclick="ui.doLoad()">📂 Quick load</button>'
      + '<button onclick="ui.slotsModal()">🗄 Saved parks</button>'
      + '<button class="danger" onclick="ui.doNew()">🌱 New park</button>'
      + (sim.won ? '<button onclick="ui.winModal()">🏆 Park record</button>' : '')
      + '</div>'
      + '<div class="role">Quick save keeps one park, the one the Continue button opens. '
      + 'Saved parks keeps three more by name, and can write the park to a file.</div>'
      + '<h3>Sound</h3>'
      + '<div class="btns"><button onclick="ui.toggleSound()">'
      + (audio.on ? '🔊 Sound is on' : '🔇 Sound is off') + '</button></div>'
      + '<div class="role">Every sound is synthesised as it plays — there are no sound files, '
      + 'the same way there are no picture files.</div>'
      + '<h3>Controls</h3>'
      + '<div class="role">Drag to scroll · pinch or scroll wheel to zoom · tap to select · <b>R</b> rotates · '
      + '<b>Space</b> pauses · <b>Esc</b> cancels building · <b>Delete</b> removes what is selected.</div>'
      + '<h3>How it works</h3>'
      + '<div class="role">Visitors walk only on paths. A ride earns money when its IN and OUT tiles touch a path, '
      + 'it has power, and the price is not more than the ride is worth. Rides wear out and break; a repairman fixes them. '
      + 'Wages and upkeep are paid every new moon.</div>'
      + '<h3>About</h3>'
      + '<div class="role">A from-scratch tribute to the 2007 J2ME park builder <i>Prehistoric Fun Park</i> '
      + '(THQ Wireless / Gear Games). No original code or artwork is used — all the artwork here is drawn by code.</div>'
      + '<div class="role">Version ' + VERSION + '</div>';
    this.modal(h);
  },

  /* ------------------------------------------------------- saved parks */
  /* One localStorage key meant one park, and clearing site data lost it. */
  slotsModal() {
    let h = '<h2>Saved parks</h2>';
    h += '<div class="role">Three slots, kept in this browser. '
      + 'Clearing site data clears them, so keep anything you care about as a file.</div>';
    h += '<table class="data slots"><tbody>';
    for (let n = 1; n <= SLOTS; n++) {
      const info = sim.slotInfo(n);
      const when = info && info.savedAt
        ? new Date(info.savedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
          + ' ' + new Date(info.savedAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
        : '';
      h += '<tr><td><b>' + (info ? (info.won ? '\u{1F3C6} ' : '') + info.name : 'Slot ' + n + ' \u2014 empty') + '</b>'
        + '<span class="sub">' + (info
          ? (info.broken ? 'damaged' : 'moon ' + info.month + ' \u00b7 ' + money(info.money) + ' \u00b7 '
             + info.rides + ' ride' + (info.rides === 1 ? '' : 's') + (when ? ' \u00b7 ' + when : ''))
          : 'nothing saved here yet') + '</span></td>'
        + '<td class="num"><button class="tag" onclick="ui.slotSave(' + n + ')">Save</button>'
        + (info ? ' <button class="tag" onclick="ui.slotLoad(' + n + ')">Load</button>'
                + ' <button class="tag bad" onclick="ui.slotDelete(' + n + ')">Delete</button>' : '')
        + '</td></tr>';
    }
    h += '</tbody></table>';
    h += '<h3>As a file</h3>';
    h += '<div class="role">A file survives cleared site data, and opens on another device.</div>';
    h += '<div class="btns"><button onclick="ui.exportSave()">\u2B07 Save to file</button>'
      + '<button onclick="ui.importSave()">\u2B06 Open a file</button></div>';
    this.modal(h);
  },

  slotSave(n) {
    const info = sim.slotInfo(n);
    if (info && !confirm('Slot ' + n + ' holds "' + info.name + '". Write over it?')) return;
    const name = prompt('Call this park:', info ? info.name : 'Park ' + n);
    if (name === null) return;
    if (sim.saveTo(n, name)) this.slotsModal();
  },

  slotLoad(n) {
    if (!confirm('Open this park? Anything unsaved in the current one is lost.')) return;
    if (sim.loadFrom(n)) { renderer.centerOn(park.gate.x, park.gate.y - 5); this.close('modal'); }
  },

  slotDelete(n) {
    const info = sim.slotInfo(n);
    if (!confirm('Delete "' + (info ? info.name : 'slot ' + n) + '"? This cannot be undone.')) return;
    sim.deleteSlot(n);
    this.slotsModal();
  },

  exportSave() {
    try {
      const blob = new Blob([sim.exportText()], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'prehistoric-fun-park-moon-' + sim.month + '.json';
      document.body.appendChild(a);
      a.click();
      a.remove();
      /* the browser needs the url to outlive the click */
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      sim.toast('\u2B07 Park written to a file');
    } catch (e) { sim.toast('Could not write the file'); }
  },

  importSave() {
    const inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = 'application/json,.json';
    inp.style.display = 'none';
    inp.onchange = () => {
      const f = inp.files && inp.files[0];
      inp.remove();
      if (!f) return;
      const r = new FileReader();
      r.onload = () => {
        if (sim.importText(String(r.result))) {
          renderer.centerOn(park.gate.x, park.gate.y - 5);
          this.close('modal');
        }
      };
      r.onerror = () => sim.toast('Could not read that file');
      r.readAsText(f);
    };
    document.body.appendChild(inp);
    inp.click();
  },

  toggleSound() { audio.setOn(!audio.on); this.menuModal(); },

  doNew() { if (confirm('Start a brand new park? The current one is lost.')) { sim.newGame(); renderer.centerOn(park.gate.x, park.gate.y - 5); this.close('modal'); } },
  doLoad() { if (sim.load()) { renderer.centerOn(park.gate.x, park.gate.y - 5); this.close('modal'); } },

  /* ------------------------------------------------------------- charts */
  statsModal() {
    const s = sim.stats;
    let h = '<h2>Statistics</h2>';
    if (!s.length) {
      h += '<div class="role">Nothing yet — the first figures arrive at the next new moon.</div>';
      this.modal(h);
      return;
    }
    const last = s[s.length - 1];
    h += this.chartBlock('Profit each moon', money(last.profit), 'c-profit');
    h += '<div class="legend"><span><i style="background:' + CHART.profit + '"></i>profit</span>'
      + '<span><i style="background:' + CHART.loss + '"></i>loss</span></div>';
    h += this.chartBlock('Visitors each moon',
      sim.visitors.length + ' of ' + sim.maxVisitors(), 'c-vis');
    h += '<div class="role">The park holds more people as you buy more land.</div>';
    h += this.chartBlock('Average happiness', last.happiness + '%', 'c-hap');
    h += '<h3>The last months</h3><table class="data"><thead><tr><th>Moon</th><th>Income</th><th>Outlay</th><th>Profit</th><th>Visitors</th><th>Happy</th></tr></thead><tbody>';
    for (const r of s.slice(-8)) {
      h += '<tr><td>' + r.month + '</td><td>' + money(r.income) + '</td><td>' + money(r.outlay) + '</td>'
        + '<td style="color:' + (r.profit < 0 ? CHART.loss : CHART.profit) + '">' + money(r.profit) + '</td>'
        + '<td>' + r.visitors + '</td><td>' + r.happiness + '%</td></tr>';
    }
    h += '</tbody></table>';
    h += this.attractionTable();
    this.modal(h);
    requestAnimationFrame(() => {
      this.barChart(document.getElementById('c-profit'), s.map(r => r.profit), true);
      this.barChart(document.getElementById('c-vis'), s.map(r => r.visitors), false, CHART.visitors);
      this.lineChart(document.getElementById('c-hap'), s.map(r => r.happiness));
    });
  },

  /* How each attraction is doing, worst-to-best decided by what it has taken
     this moon. One measure, so one hue: the bars are a magnitude, not a set of
     categories, and the state is spelled out rather than left to a colour. */
  attractionTable() {
    const rows = [];
    for (const b of park.buildings.values()) {
      const c = b.item.cat;
      if (c !== 'ride' && c !== 'stall' && c !== 'service') continue;
      if (c === 'service' && !b.item.need) continue;          /* the ticket office */
      const took = Math.max(0, (b.earned || 0) - (b.earnedMark || 0));
      const served = Math.max(0, (b.visits || 0) - (b.visitsMark || 0));
      let state = 'Running', tone = CHART.profit;
      if (c === 'ride') {
        if (!park.reachable(b)) { state = 'No path'; tone = CHART.loss; }
        else if (b.item.power && !b.powered) { state = 'No power'; tone = CHART.loss; }
        else if (b.brokeDown) { state = 'Broken'; tone = CHART.loss; }
        else if (!b.open) { state = 'Closed'; tone = WARN; }
      } else {
        state = 'Open';
        if (b.item.worker && !b.worker) { state = 'No staff'; tone = CHART.loss; }
        else if (!b.open) { state = 'Closed'; tone = WARN; }
      }
      /* how full it runs: riders taken against the seats it has offered */
      let full = null;
      if (c === 'ride' && b.cycle > 0) full = Math.round(100 * b.visits / (b.cycle * b.item.cap));
      rows.push({ name: b.item.name, took, served, fee: b.fee, state, tone,
                  queue: b.queue ? b.queue.length : 0, full, ride: c === 'ride',
                  last: b.moonEarned || 0 });
    }
    if (!rows.length) return '';
    rows.sort((a, b) => b.took - a.took || b.served - a.served);
    const top = Math.max(1, rows[0].took);

    let h = '<h3>How each attraction is doing</h3>'
      + '<div class="role">Taken so far this moon, most first.</div>'
      + '<table class="data perf"><thead><tr><th>Attraction</th><th>Taken</th>'
      + '<th>Used</th><th>Price</th><th>Queue</th><th>State</th></tr></thead><tbody>';
    for (const r of rows) {
      const pct = Math.round((r.took / top) * 100);
      const hint = r.ride && r.full !== null ? r.name + ' runs ' + r.full + '% full' : r.name;
      h += '<tr title="' + hint + (r.last ? ' \u00b7 last moon ' + money(r.last) : '') + '">'
        + '<td>' + r.name + (r.ride && r.full !== null
            ? '<span class="sub">' + r.full + '% full</span>' : '') + '</td>'
        + '<td class="num"><div class="perfbar"><i style="width:' + pct + '%"></i></div>'
        + '<b>' + money(r.took) + '</b></td>'
        + '<td class="num">' + r.served + '</td>'
        + '<td class="num">' + (r.fee ? money(r.fee) : 'free') + '</td>'
        + '<td class="num">' + (r.ride ? r.queue : '\u2014') + '</td>'
        + '<td style="color:' + r.tone + '">' + r.state + '</td></tr>';
    }
    return h + '</tbody></table>';
  },

  chartBlock(title, headline, id) {
    return '<div class="chart"><div class="ct"><span>' + title + '</span><b>' + headline + '</b></div>'
      + '<canvas id="' + id + '"></canvas></div>';
  },

  fitCanvas(cv) {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const r = cv.getBoundingClientRect();
    cv.width = Math.max(1, Math.round(r.width * dpr));
    cv.height = Math.max(1, Math.round(r.height * dpr));
    const ctx = cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx, w: r.width, h: r.height };
  },

  /* bars grow from a zero baseline; sign is shown by direction as well as hue */
  barChart(cv, data, diverging, color) {
    if (!cv) return;
    const { ctx, w, h } = this.fitCanvas(cv);
    ctx.clearRect(0, 0, w, h);
    const pad = { l: 2, r: 2, t: 8, b: 14 };
    const iw = w - pad.l - pad.r, ih = h - pad.t - pad.b;
    const maxV = Math.max(1, ...data.map(v => Math.abs(v)));
    const zeroY = diverging && Math.min(...data) < 0 ? pad.t + ih / 2 : pad.t + ih;
    const scale = diverging && Math.min(...data) < 0 ? (ih / 2) / maxV : ih / maxV;
    const n = data.length;
    const bw = Math.max(3, iw / n - 2);

    ctx.strokeStyle = 'rgba(255,255,255,.14)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(pad.l, zeroY + .5); ctx.lineTo(w - pad.r, zeroY + .5); ctx.stroke();

    data.forEach((v, i) => {
      const x = pad.l + i * (iw / n) + 1;
      const len = Math.abs(v) * scale;
      const up = v >= 0;
      const y = up ? zeroY - len : zeroY;
      ctx.fillStyle = color || (up ? CHART.profit : CHART.loss);
      const drawLen = Math.max(4, len);            /* keep small months visible */
      const r = Math.min(4, bw / 2, drawLen / 2);
      roundRect(ctx, x, up ? zeroY - drawLen : zeroY, bw, drawLen, r);
      ctx.fill();
    });

    /* direct label on the most recent value only */
    const lastV = data[data.length - 1];
    ctx.fillStyle = 'rgba(243,233,216,.8)';
    ctx.font = '10px ui-sans-serif, system-ui, sans-serif';
    ctx.textAlign = 'right'; ctx.textBaseline = 'alphabetic';
    ctx.fillText(Math.round(lastV).toLocaleString('en-US'), w - pad.r, h - 3);
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(243,233,216,.45)';
    ctx.fillText('moon ' + (sim.month - data.length + 1) + ' → ' + sim.month, pad.l, h - 3);
  },

  lineChart(cv, data) {
    if (!cv) return;
    const { ctx, w, h } = this.fitCanvas(cv);
    ctx.clearRect(0, 0, w, h);
    const pad = { l: 2, r: 20, t: 10, b: 14 };
    const iw = w - pad.l - pad.r, ih = h - pad.t - pad.b;
    const X = i => pad.l + (data.length === 1 ? iw / 2 : (i / (data.length - 1)) * iw);
    const Y = v => pad.t + ih - (clamp(v, 0, 100) / 100) * ih;

    ctx.strokeStyle = 'rgba(255,255,255,.12)';
    ctx.setLineDash([3, 4]); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(pad.l, Y(50)); ctx.lineTo(w - pad.r, Y(50)); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(243,233,216,.4)';
    ctx.font = '9px ui-sans-serif, system-ui, sans-serif';
    ctx.fillText('50%', pad.l + 2, Y(50) - 3);

    ctx.strokeStyle = CHART.happy;
    ctx.lineWidth = 2; ctx.lineJoin = 'round';
    ctx.beginPath();
    data.forEach((v, i) => i ? ctx.lineTo(X(i), Y(v)) : ctx.moveTo(X(i), Y(v)));
    ctx.stroke();

    const li = data.length - 1;
    ctx.fillStyle = CHART.happy;
    ctx.beginPath(); ctx.arc(X(li), Y(data[li]), 4.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(243,233,216,.85)';
    ctx.font = '10px ui-sans-serif, system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(data[li] + '%', w - pad.r, Y(data[li]) - 8);
    ctx.textAlign = 'left';
  }
};
