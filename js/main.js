/* Boot, input (mouse, touch, keyboard) and the frame loop. */

(function () {
  const canvas = document.getElementById('game');
  let dragging = false, dragged = false, painting = false;
  let lastPt = { x: 0, y: 0 };
  const pointers = new Map();
  let pinchDist = 0, pinchZoom = 1;

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
    if (ui.build.key) { placeAt(t); return; }
    const person = pickPerson(sx, sy);
    if (person) { ui.select(person); return; }
    const b = park.buildingAt(t.x, t.y);
    ui.select(b || null);
  }

  function placeAt(t) {
    if (!park.inBounds(t.x, t.y)) return;
    const key = ui.build.key;
    if (sim.build(key, t.x, t.y, ui.build.rot)) {
      if (ITEMS[key].cat !== 'path') ui.setBuild(null);   /* one-shot for buildings, keep painting paths */
      else ui.renderCards();
    }
  }

  /* -------------------------------------------------------------- input */
  function localPt(e) {
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  canvas.addEventListener('pointerdown', e => {
    canvas.setPointerCapture(e.pointerId);
    const p = localPt(e);
    pointers.set(e.pointerId, p);
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinchDist = Math.hypot(a.x - b.x, a.y - b.y);
      pinchZoom = view.zoom;
      dragging = false;
      return;
    }
    dragging = true; dragged = false;
    lastPt = p;
    renderer.hover = renderer.screenToTile(p.x, p.y);
    /* drag-paint paths */
    if (ui.build.key && ITEMS[ui.build.key].cat === 'path') {
      painting = true;
      placeAt(renderer.hover);
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
      if (pinchDist > 0) {
        view.zoom = clamp(pinchZoom * (d / pinchDist), view.minZoom, view.maxZoom);
        renderer.clampView();
      }
      return;
    }
    if (!dragging) return;
    const dx = p.x - lastPt.x, dy = p.y - lastPt.y;
    if (Math.abs(dx) + Math.abs(dy) > 3) dragged = true;
    if (painting) {
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
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinchDist = 0;
    if (dragging && !dragged && !painting) tap(p.x, p.y);
    dragging = false; painting = false;
    canvas.classList.remove('dragging');
  }
  canvas.addEventListener('pointerup', endPointer);
  canvas.addEventListener('pointercancel', endPointer);
  canvas.addEventListener('contextmenu', e => { e.preventDefault(); ui.setBuild(null); });

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
    else if (k === 'escape') { ui.setBuild(null); ui.select(null); ui.close('modal'); ui.close('sheet'); }
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

  sim.newGame();
  renderer.init(canvas);
  ui.init();
  if (!sim.hasSave()) cont.setAttribute('disabled', '');

  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    sim.update(dt);
    renderer.draw(dt, ui.build);
    ui.update(dt);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  /* expose a couple of helpers for the console / tests */
  window.game = { sim, park, ui, renderer, view };
})();
