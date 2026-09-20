/* HUD, build sheet, inspector panels and the statistics modals. */

const CHART = { profit: '#3AA98F', loss: '#D06B4A', visitors: '#5D8FD6', happy: '#B07BD0' };

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
      money: $('hud-money'), happy: $('hud-happy'), visitors: $('hud-visitors'),
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
    const same = this.pending && this.pending.x === ox && this.pending.y === oy
      && this.pending.rot === this.build.rot && this.pending.key === key;
    this.pending = { key, rot: this.build.rot, x: ox, y: oy, w, h, links: [], linkCost: 0 };
    if (!same || !this.pending.linked) this.planLinks();
    this.el.confirm.classList.remove('hidden');
    this.positionConfirm();
  },

  /* Work out the paving that would join the ride's doors to the network, so
     one tap builds the ride and the little bit of path it needs. */
  planLinks() {
    const p = this.pending;
    const item = ITEMS[p.key];
    p.links = []; p.linkCost = 0; p.unlinkable = false;
    if (item.cat !== 'ride') return;
    const seen = new Set();
    for (const door of ['ent', 'ext']) {
      const d = park.rotPoint(item[door][0], item[door][1], item.w, item.h, p.rot);
      const tile = { x: p.x + d[0], y: p.y + d[1] };
      const run = park.linkPathFrom(tile, p.x, p.y, p.w, p.h);
      if (run === null) { p.unlinkable = true; continue; }
      for (const t of run) {
        const k = t.x + ',' + t.y;
        if (seen.has(k)) continue;
        seen.add(k);
        p.links.push(t);
      }
    }
    p.linkCost = p.links.length * ITEMS.gravel.cost;
    p.linked = true;
  },

  pendingCost() {
    const p = this.pending;
    if (!p) return 0;
    return (this.build.moving ? 0 : ITEMS[p.key].cost) + (p.linkCost || 0);
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
    const links = p.links || [];
    if (this.build.moving) {
      if (sim.placeMoved(p.x, p.y, p.rot)) {
        for (const t of links) sim.build('gravel', t.x, t.y, 0);
        this.clearPending();
        this.endMove(false);
      }
      return;
    }
    if (sim.build(p.key, p.x, p.y, p.rot)) {
      let paved = 0;
      for (const t of links) if (sim.build('gravel', t.x, t.y, 0)) paved++;
      if (paved) sim.toast('🛠️ Laid ' + paved + ' path tile' + (paved > 1 ? 's' : '') + ' to the doors');
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
    else if (this.build.moving) tag.textContent = p.linkCost ? 'Move · path ' + money(p.linkCost) : 'Move here';
    else tag.innerHTML = money(ITEMS[p.key].cost) +
      (p.linkCost ? ' <span class="plus">+ ' + money(p.linkCost) + ' path</span>' : '') +
      (p.unlinkable ? ' <span class="plus">· no route</span>' : '');
  },

  /* ------------------------------------------------------------ HUD tick */
  update(dt) {
    this.el.money.textContent = money(sim.money);
    this.el.money.style.color = sim.money < 0 ? CHART.loss : '';
    this.el.happy.textContent = Math.round(sim.avgHappiness()) + '%';
    this.el.visitors.textContent = sim.visitors.length;
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
    const want = sim.toasts.map(t => t.msg).join('|');
    if (box.dataset.k === want) return;
    box.dataset.k = want;
    box.innerHTML = '';
    for (const t of sim.toasts) {
      const d = document.createElement('div');
      d.className = 'toast';
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
    this.modal(h);
  },

  menuModal() {
    const h = '<h2>Menu</h2>'
      + '<div class="btns">'
      + '<button onclick="sim.save()">💾 Save park</button>'
      + '<button onclick="ui.doLoad()">📂 Load park</button>'
      + '<button class="danger" onclick="ui.doNew()">🌱 New park</button>'
      + '</div>'
      + '<h3>Controls</h3>'
      + '<div class="role">Drag to scroll · pinch or scroll wheel to zoom · tap to select · <b>R</b> rotates · '
      + '<b>Space</b> pauses · <b>Esc</b> cancels building · <b>Delete</b> removes what is selected.</div>'
      + '<h3>How it works</h3>'
      + '<div class="role">Visitors walk only on paths. A ride earns money when its IN and OUT tiles touch a path, '
      + 'it has power, and the price is not more than the ride is worth. Rides wear out and break; a repairman fixes them. '
      + 'Wages and upkeep are paid every new moon.</div>'
      + '<h3>About</h3>'
      + '<div class="role">A from-scratch tribute to the 2007 J2ME park builder <i>Prehistoric Fun Park</i> '
      + '(THQ Wireless / Gear Games). No original code or artwork is used — all the artwork here is drawn by code.</div>';
    this.modal(h);
  },

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
    h += this.chartBlock('Visitors each moon', last.visitors + ' people', 'c-vis');
    h += this.chartBlock('Average happiness', last.happiness + '%', 'c-hap');
    h += '<h3>The last months</h3><table class="data"><thead><tr><th>Moon</th><th>Income</th><th>Outlay</th><th>Profit</th><th>Visitors</th><th>Happy</th></tr></thead><tbody>';
    for (const r of s.slice(-8)) {
      h += '<tr><td>' + r.month + '</td><td>' + money(r.income) + '</td><td>' + money(r.outlay) + '</td>'
        + '<td style="color:' + (r.profit < 0 ? CHART.loss : CHART.profit) + '">' + money(r.profit) + '</td>'
        + '<td>' + r.visitors + '</td><td>' + r.happiness + '%</td></tr>';
    }
    h += '</tbody></table>';
    this.modal(h);
    requestAnimationFrame(() => {
      this.barChart(document.getElementById('c-profit'), s.map(r => r.profit), true);
      this.barChart(document.getElementById('c-vis'), s.map(r => r.visitors), false, CHART.visitors);
      this.lineChart(document.getElementById('c-hap'), s.map(r => r.happiness));
    });
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
