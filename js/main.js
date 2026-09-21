/* Boot, input (mouse, touch, keyboard) and the frame loop. */

(function () {
  const canvas = document.getElementById('game');
  let dragging = false, dragged = false, painting = false;
  let pressTimer = null, pressAt = null, dragMove = false;
  let positioning = false, lastDragPt = null;
  const TOUCH_LIFT = 74;            /* how far above the finger the ghost sits */

  /* tile under a pointer, lifted clear of the finger on touch */
  function ghostTile(p, touch) {
    return renderer.screenToTile(p.x, p.y - (touch ? TOUCH_LIFT : 0));
  }
  let lastPt = { x: 0, y: 0 };
  const pointers = new Map();
  let pinchDist = 0, pinchZoom = 1, pinchMid = null;

  /* ------------------------------------------------------------- picking */
  function worldOf(p) { return renderer.screenToTile(p.x, p.y); }

  function pickPerson(sx, sy) {
    let best = null, bestD = 26 * 26;
    const all = sim.visitors.concat(sim.staff);
    for (const p of all) {
      if (p.state === 'riding') continue;
      const [x, y] = renderer.worldToScreen(isoX(p.x + 0.5, p.y + 0.5), isoY(p.x + 0.5, p.y + 0.5));
      const d = dist2(sx, sy, x, y - 10 * view.zoom);
      if (d < bestD) { bestD = d; best = p; }
    }
    return best;
  }

  function tap(sx, sy) {
    const t = renderer.screenToTile(sx, sy);
    if (ui.demolishMode) { ui.demolishAt(t.x, t.y); return; }
    if (ui.landMode) { ui.buyPlotAt(t.x, t.y); return; }
    if (ui.build.key) { placeAt(t); return; }
    const person = pickPerson(sx, sy);
    if (person) { ui.select(person); return; }
    const b = park.buildingAt(t.x, t.y);
    ui.select(b || null);
  }

  function placeAt(t) {
    if (!park.inBounds(t.x, t.y)) return;
    const key = ui.build.key;
    if (!key) return;
    /* paths are painted straight down; everything else is parked as a ghost
       with a tick and a cross, so nothing gets built by accident */
    if (!ui.build.moving && ITEMS[key].cat === 'path') {
      if (sim.build(key, t.x, t.y, ui.build.rot)) ui.renderCards();
      return;
    }
    ui.setPending(t.x, t.y);
  }

  function cancelPress() {
    if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; }
    pressAt = null;
  }

  /* -------------------------------------------------------------- input */
  function localPt(e) {
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  canvas.addEventListener('pointerdown', e => {
    try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* synthetic or stale pointer */ }
    const p = localPt(e);
    pointers.set(e.pointerId, p);
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinchDist = Math.hypot(a.x - b.x, a.y - b.y);
      pinchZoom = view.zoom;
      pinchMid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      dragging = false; painting = false;
      return;
    }
    dragging = true; dragged = false;
    lastPt = p;
    renderer.hover = renderer.screenToTile(p.x, p.y);
    /* an item in hand: dragging slides it around the map instead of panning */
    if (ui.build.key && ITEMS[ui.build.key].cat !== 'path') {
      positioning = true;
      lastDragPt = { x: p.x, y: p.y, touch: e.pointerType === 'touch' };
      const t = ghostTile(p, lastDragPt.touch);
      renderer.hover = t;
      ui.setPending(t.x, t.y);
      canvas.classList.add('dragging');
      return;
    }
    /* drag-paint paths */
    if (ui.build.key && !ui.build.moving && ITEMS[ui.build.key].cat === 'path') {
      painting = true;
      placeAt(renderer.hover);
    } else if (ui.demolishMode) {
      /* dragging clears a run of paving */
      painting = 'clear';
      ui.demolishAt(renderer.hover.x, renderer.hover.y);
    } else if (!ui.build.key && !ui.landMode) {
      /* hold on a building to pick it up and carry it */
      const t = renderer.hover;
      const b = park.buildingAt(t.x, t.y);
      if (b) {
        pressAt = { x: p.x, y: p.y };
        pressTimer = setTimeout(() => {
          pressTimer = null;
          if (ui.grab(b, t.x, t.y)) { dragMove = true; dragged = true; painting = false; }
        }, 420);
      }
    }
    canvas.classList.add('dragging');
  });

  canvas.addEventListener('pointermove', e => {
    const p = localPt(e);
    if (pointers.has(e.pointerId)) pointers.set(e.pointerId, p);
    renderer.hover = renderer.screenToTile(p.x, p.y);

    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      if (pinchDist > 0) {
        const before = renderer.screenToTile(mid.x, mid.y);
        view.zoom = clamp(pinchZoom * (d / pinchDist), view.minZoom, view.maxZoom);
        const after = renderer.screenToTile(mid.x, mid.y);
        /* keep the point between the fingers under them, and pan with them */
        view.x += isoX(before.fx, before.fy) - isoX(after.fx, after.fy);
        view.y += isoY(before.fx, before.fy) - isoY(after.fx, after.fy);
        if (pinchMid) { view.x -= (mid.x - pinchMid.x) / view.zoom; view.y -= (mid.y - pinchMid.y) / view.zoom; }
        renderer.clampView();
      }
      pinchMid = mid;
      return;
    }
    if (pressAt && (Math.abs(p.x - pressAt.x) + Math.abs(p.y - pressAt.y) > 12)) cancelPress();
    if (positioning) {
      lastDragPt = { x: p.x, y: p.y, touch: e.pointerType === 'touch' };
      const t = ghostTile(p, lastDragPt.touch);
      renderer.hover = t;
      ui.setPending(t.x, t.y);
      dragged = true;
      return;
    }
    if (dragMove) {
      /* carrying a building: the ghost follows the finger, the map stays put */
      lastDragPt = { x: p.x, y: p.y, touch: e.pointerType === 'touch' };
      const t = ghostTile(p, lastDragPt.touch);
      renderer.hover = t;
      ui.setPending(t.x, t.y);
      return;
    }
    if (!dragging) return;
    const dx = p.x - lastPt.x, dy = p.y - lastPt.y;
    if (Math.abs(dx) + Math.abs(dy) > 3) dragged = true;
    if (painting === 'clear') {
      const t = renderer.hover;
      if (!park.buildingAt(t.x, t.y)) ui.demolishAt(t.x, t.y);   /* drag clears paving only */
    } else if (painting) {
      placeAt(renderer.hover);
    } else {
      view.x -= dx / view.zoom;
      view.y -= dy / view.zoom;
      renderer.clampView();
    }
    lastPt = p;
  });

  function endPointer(e) {
    const p = localPt(e);
    cancelPress();
    if (positioning) {
      positioning = false; dragging = false; lastDragPt = null;
      pointers.delete(e.pointerId);
      canvas.classList.remove('dragging');
      return;
    }
    if (dragMove) {
      /* dropped: the tick and cross are showing, so leave them to decide */
      dragMove = false; dragging = false; painting = false; lastDragPt = null;
      pointers.delete(e.pointerId);
      canvas.classList.remove('dragging');
      return;
    }
    const wasPinching = pointers.size >= 2;
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinchDist = 0;
    if (wasPinching) {
      /* one finger left after a pinch: carry on panning from where it is,
         and never treat the lift as a tap */
      const rest = [...pointers.values()][0];
      if (rest) { lastPt = rest; dragging = true; dragged = true; }
      else { dragging = false; painting = false; }
      canvas.classList.remove('dragging');
      return;
    }
    if (dragging && !dragged && !painting) tap(p.x, p.y);
    dragging = false; painting = false;
    canvas.classList.remove('dragging');
  }
  canvas.addEventListener('pointerup', endPointer);
  canvas.addEventListener('pointercancel', endPointer);
  canvas.addEventListener('contextmenu', e => { e.preventDefault(); ui.cancelPlacement(); });
  /* belt and braces against the browser's own long-press behaviour */
  canvas.addEventListener('touchstart', e => { if (e.touches.length === 1) e.preventDefault(); }, { passive: false });
  canvas.addEventListener('selectstart', e => e.preventDefault());

  canvas.addEventListener('wheel', e => {
    e.preventDefault();
    const p = localPt(e);
    const before = renderer.screenToTile(p.x, p.y);
    view.zoom = clamp(view.zoom * (e.deltaY < 0 ? 1.12 : 0.89), view.minZoom, view.maxZoom);
    const after = renderer.screenToTile(p.x, p.y);
    view.x += isoX(before.fx, before.fy) - isoX(after.fx, after.fy);
    view.y += isoY(before.fx, before.fy) - isoY(after.fx, after.fy);
    renderer.clampView();
  }, { passive: false });

  window.addEventListener('keydown', e => {
    const k = e.key.toLowerCase();
    const pan = 60 / view.zoom;
    if (k === 'arrowleft' || k === 'a') { view.x -= pan; }
    else if (k === 'arrowright' || k === 'd') { view.x += pan; }
    else if (k === 'arrowup' || k === 'w') { view.y -= pan; }
    else if (k === 'arrowdown' || k === 's') { view.y += pan; }
    else if (k === 'r') ui.rotate();
    else if (k === 'escape') { ui.cancelPlacement(); ui.stopLand(); ui.stopDemolish(); ui.select(null); ui.close('modal'); ui.close('sheet'); }
    else if (k === 'enter') { if (ui.pending) ui.confirmPlace(); }
    else if (k === 'b') ui.toggleSheet();
    else if (k === ' ') { e.preventDefault(); sim.paused = !sim.paused; syncSpeedButtons(); }
    else if (k === 'delete' || k === 'backspace') {
      const s = sim.selected;
      if (s && s.item) sim.sell(s);
      else if (s && s.kind === 'staff') sim.fire(s);
      ui.select(null);
    }
    else if (k === '+' || k === '=') { view.zoom = clamp(view.zoom * 1.15, view.minZoom, view.maxZoom); }
    else if (k === '-') { view.zoom = clamp(view.zoom / 1.15, view.minZoom, view.maxZoom); }
    else return;
    renderer.clampView();
  });

  function syncSpeedButtons() {
    for (const x of document.getElementById('speeds').children)
      x.classList.toggle('on', +x.dataset.speed === (sim.paused ? 0 : sim.speed));
  }

  document.addEventListener('pointermove', e => {
    if (!ui.trayDrag) return;
    if (ui.trayDragMove(e)) {
      lastDragPt = { x: e.clientX - canvas.getBoundingClientRect().left,
                     y: e.clientY - canvas.getBoundingClientRect().top,
                     touch: e.pointerType === 'touch' };
      e.preventDefault();
    }
  }, { passive: false });
  document.addEventListener('pointerup', e => {
    if (!ui.trayDrag) return;
    ui.trayDragEnd(e);
    lastDragPt = null;
  });
  document.addEventListener('pointercancel', e => { if (ui.trayDrag) { ui.trayDragEnd(e); lastDragPt = null; } });

  /* scroll the map when the ghost is dragged against the edge of the screen */
  function edgePan(dt) {
    if (!lastDragPt || !ui.pending) return;
    const m = 78, speed = 520;
    let dx = 0, dy = 0;
    if (lastDragPt.x < m) dx = -(m - lastDragPt.x) / m;
    else if (lastDragPt.x > renderer.W - m) dx = (lastDragPt.x - (renderer.W - m)) / m;
    if (lastDragPt.y < m + 40) dy = -((m + 40) - lastDragPt.y) / m;
    else if (lastDragPt.y > renderer.H - m - 40) dy = (lastDragPt.y - (renderer.H - m - 40)) / m;
    if (!dx && !dy) return;
    view.x += dx * speed * dt / view.zoom;
    view.y += dy * speed * dt / view.zoom;
    renderer.clampView();
    const t = ghostTile(lastDragPt, lastDragPt.touch);
    renderer.hover = t;
    ui.setPending(t.x, t.y);
  }

  window.addEventListener('resize', () => renderer.resize());
  window.addEventListener('orientationchange', () => setTimeout(() => renderer.resize(), 120));
  document.addEventListener('visibilitychange', () => { if (document.hidden) sim.autoSave(); });

  /* --------------------------------------------------------------- boot */
  function start(loadSave) {
    document.getElementById('intro').classList.add('hidden');
    if (loadSave) sim.load(); else sim.newGame();
    renderer.centerOn(park.gate.x, park.gate.y - 5);
    syncSpeedButtons();
  }

  document.getElementById('btn-start').addEventListener('click', () => start(false));
  const cont = document.getElementById('btn-continue');
  cont.addEventListener('click', () => start(true));

  /* A browser will not let a page make a sound until somebody has touched it.
     The two buttons that open a park are the first real gesture there is. */
  for (const id of ['btn-start', 'btn-continue'])
    document.getElementById(id).addEventListener('click', () => audio.start(), { once: true });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) audio.resume(); });

  audio.load();
  sim.newGame();
  scenery.build();
  renderer.init(canvas);
  ui.init();
  if (!sim.hasSave()) cont.setAttribute('disabled', '');

  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    sim.update(dt);
    edgePan(dt);
    renderer.draw(dt, ui.build);
    ui.update(dt);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  /* expose a couple of helpers for the console / tests */
  window.game = { sim, park, ui, renderer, view };
})();
