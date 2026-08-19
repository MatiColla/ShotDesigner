/* ============ Canvas rendering & interaction ============ */
const cv = document.getElementById('stage');
const ctx = cv.getContext('2d');
let bgImage = null, bgImageSrc = null;

function resizeCanvas() {
  const r = cv.parentElement.getBoundingClientRect();
  cv.width = Math.max(50, r.width) * devicePixelRatio;
  cv.height = Math.max(50, r.height) * devicePixelRatio;
  cv.style.width = r.width + 'px';
  cv.style.height = r.height + 'px';
  requestRender();
}
new ResizeObserver(resizeCanvas).observe(document.getElementById('stage-wrap'));

/* world <-> screen (CSS px) */
function w2s(p) {
  const v = State.view;
  return { x: (p.x - v.x) * v.zoom + cv.clientWidth / 2, y: (p.y - v.y) * v.zoom + cv.clientHeight / 2 };
}
function s2w(p) {
  const v = State.view;
  return { x: (p.x - cv.clientWidth / 2) / v.zoom + v.x, y: (p.y - cv.clientHeight / 2) / v.zoom + v.y };
}

const DEG = Math.PI / 180;

function drawScene() {
  const t = State.time;
  ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
  ctx.fillStyle = '#1b1e26';
  ctx.fillRect(0, 0, cv.clientWidth, cv.clientHeight);

  const v = State.view;
  ctx.save();
  ctx.translate(cv.clientWidth / 2, cv.clientHeight / 2);
  ctx.scale(v.zoom, v.zoom);
  ctx.translate(-v.x, -v.y);

  if (!State.rendering) drawGrid();
  drawBackground();

  const live = activeCameraAt(t);
  const ents = State.project.entities;

  const showPaths = State.project.showPaths !== false;
  ents.forEach(e => { if (showPaths && e.visible && e.showPath && e.type !== 'prop' && !(e.type === 'camera' && e.pov)) drawPath(e); });
  ents.forEach(e => { if (e.visible && e.type === 'prop') drawProp(e, t); });
  ents.forEach(e => { if (e.visible && e.type === 'camera') drawFov(e, t, live === e); });
  ents.forEach(e => { if (e.visible && e.type === 'character') drawCharacter(e, t); });
  ents.forEach(e => { if (e.visible && e.type === 'camera') drawCameraBody(e, t, live === e); });

  ctx.restore();
}

function drawGrid() {
  const v = State.view;
  const step = 100;
  const halfW = cv.clientWidth / 2 / v.zoom, halfH = cv.clientHeight / 2 / v.zoom;
  const x0 = Math.floor((v.x - halfW) / step) * step, x1 = v.x + halfW;
  const y0 = Math.floor((v.y - halfH) / step) * step, y1 = v.y + halfH;
  ctx.lineWidth = 1 / v.zoom;
  ctx.strokeStyle = 'rgba(255,255,255,0.05)';
  ctx.beginPath();
  for (let x = x0; x <= x1; x += step) { ctx.moveTo(x, y0); ctx.lineTo(x, y1); }
  for (let y = y0; y <= y1; y += step) { ctx.moveTo(x0, y); ctx.lineTo(x1, y); }
  ctx.stroke();
}

function drawBackground() {
  const bg = State.project.background;
  if (!bg) { bgImage = null; bgImageSrc = null; return; }
  if (bg.src !== bgImageSrc) {
    bgImageSrc = bg.src;
    bgImage = new Image();
    bgImage.src = bg.src;
    bgImage.onload = requestRender;
  }
  if (!bgImage || !bgImage.complete || !bgImage.naturalWidth) return;
  const s = bg.scale || 1;
  const w = bgImage.naturalWidth * s, h = bgImage.naturalHeight * s;
  ctx.globalAlpha = bg.opacity ?? 1;
  ctx.drawImage(bgImage, -w / 2, -h / 2, w, h);
  ctx.globalAlpha = 1;
}

/* ---- movement path with arrows ---- */
function drawPath(e) {
  const kfs = posKfs(e);
  if (kfs.length < 2) return;
  const col = e.type === 'camera' ? '#ffb020' : (e.color || '#7dd3fc');
  const z = State.view.zoom;
  ctx.strokeStyle = col; ctx.fillStyle = col;
  ctx.lineWidth = 2 / z;
  ctx.setLineDash([8 / z, 6 / z]);
  ctx.beginPath();
  ctx.moveTo(kfs[0].x, kfs[0].y);
  for (let i = 1; i < kfs.length; i++) {
    const c = segControl(kfs[i - 1], kfs[i]);
    ctx.quadraticCurveTo(c.x, c.y, kfs[i].x, kfs[i].y);
  }
  ctx.stroke();
  ctx.setLineDash([]);
  for (let i = 1; i < kfs.length; i++) {
    const a = kfs[i - 1], b = kfs[i];
    const c = segControl(a, b);
    const len = Math.hypot(b.x - a.x, b.y - a.y) + Math.hypot(a.bx || 0, a.by || 0);
    if (len > 14) {
      const u = 0.55, g = 1 - u;
      const mx = g * g * a.x + 2 * u * g * c.x + u * u * b.x;
      const my = g * g * a.y + 2 * u * g * c.y + u * u * b.y;
      const ang = Math.atan2(2 * g * (c.y - a.y) + 2 * u * (b.y - c.y),
                             2 * g * (c.x - a.x) + 2 * u * (b.x - c.x));
      const s = 9 / z;
      ctx.save();
      ctx.translate(mx, my); ctx.rotate(ang);
      ctx.beginPath();
      ctx.moveTo(s, 0); ctx.lineTo(-s * 0.7, s * 0.6); ctx.lineTo(-s * 0.7, -s * 0.6);
      ctx.closePath(); ctx.fill();
      ctx.restore();
    }
  }
  ctx.globalAlpha = 0.9;
  kfs.forEach(k => {
    ctx.beginPath();
    ctx.arc(k.x, k.y, 4 / z, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = (11 / z) + 'px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.fillText(k.t + 's', k.x + 7 / z, k.y - 6 / z);
    ctx.fillStyle = col;
  });
  ctx.globalAlpha = 1;
}

/* ---- top-down character ---- */
function drawCharacter(e, t) {
  const p = samplePose(e, t);
  const sel = State.selectedId === e.id;
  const sc = e.scale || 1;
  ctx.save();
  ctx.translate(p.x, p.y);
  if (sel) drawSelRing(26 * sc);
  ctx.rotate((p.rot + 90) * DEG); /* rot 0 = facing +x; body drawn facing up */
  ctx.scale(sc, sc);

  ctx.fillStyle = 'rgba(0,0,0,0.30)';
  ctx.beginPath(); ctx.ellipse(2, 3, 22, 15, 0, 0, Math.PI * 2); ctx.fill();

  const hair = shade(e.skin, -75);
  if (e.gender === 'f') {
    /* dress/skirt flare wider than the narrow shoulders */
    ctx.fillStyle = shade(e.color, -45);
    ctx.beginPath(); ctx.ellipse(0, 3, 18, 17, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.fillStyle = e.color;
    ctx.beginPath(); ctx.ellipse(0, 0, 16, 10.5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.stroke();
    /* arms */
    ctx.fillStyle = e.skin;
    ctx.beginPath(); ctx.arc(-15, 1, 4, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(15, 1, 4, 0, Math.PI * 2); ctx.fill();
    /* long hair: ponytail flowing behind + big mane around the head */
    ctx.fillStyle = hair;
    ctx.beginPath();
    ctx.moveTo(-5.5, 9);
    ctx.quadraticCurveTo(-5, 19, -2.5, 24);
    ctx.lineTo(2.5, 24);
    ctx.quadraticCurveTo(5, 19, 5.5, 9);
    ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.arc(0, 24, 3.4, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(0, 2, 13.5, 13, 0, 0, Math.PI * 2); ctx.fill();
    /* face: only the front visible between the hair */
    ctx.fillStyle = e.skin;
    ctx.beginPath(); ctx.arc(0, -2, 9, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = hair;
    ctx.beginPath(); ctx.arc(0, -2, 9, Math.PI * 0.78, Math.PI * 2.22); ctx.fill();
    /* center part shine */
    ctx.strokeStyle = 'rgba(255,255,255,0.28)'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(0, 2); ctx.lineTo(0, 13); ctx.stroke();
  } else {
    /* broad squared shoulders */
    ctx.fillStyle = e.color;
    ctx.beginPath(); ctx.ellipse(0, 0, 23, 13, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 1.5; ctx.stroke();
    /* shoulder seams to read as jacket */
    ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(-10, -11); ctx.lineTo(-13, 10); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(10, -11); ctx.lineTo(13, 10); ctx.stroke();
    /* arms */
    ctx.fillStyle = e.skin;
    ctx.beginPath(); ctx.arc(-21, 0, 4.5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(21, 0, 4.5, 0, Math.PI * 2); ctx.fill();
    /* head with very short hair (scalp shows through) */
    ctx.fillStyle = e.skin;
    ctx.beginPath(); ctx.arc(0, 0, 10, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = hair;
    ctx.beginPath(); ctx.arc(0, 0.5, 9.2, Math.PI * 0.1, Math.PI * 0.9); ctx.fill();
    ctx.globalAlpha = 0.45;
    ctx.beginPath(); ctx.arc(0, 0.5, 9.2, Math.PI * 0.9, Math.PI * 2.1); ctx.fill();
    ctx.globalAlpha = 1;
  }

  ctx.fillStyle = e.skin;
  ctx.strokeStyle = 'rgba(0,0,0,0.45)'; ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-3.5, -8.5); ctx.lineTo(3.5, -8.5); ctx.lineTo(0, -14.5);
  ctx.closePath(); ctx.fill(); ctx.stroke();
  /* eyes looking forward */
  ctx.fillStyle = 'rgba(20,12,8,0.75)';
  ctx.beginPath(); ctx.arc(-3.6, -5.2, 1.4, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(3.6, -5.2, 1.4, 0, Math.PI * 2); ctx.fill();

  ctx.restore();
  const gsym = e.gender === 'f' ? '♀ ' : '♂ ';
  const gcol = e.gender === 'f' ? '#f9a8d4' : '#93c5fd';
  label(gsym + e.name, p.x, p.y + 36 * sc, sel ? '#fff' : gcol, e);
}

function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) + amt, g = ((n >> 8) & 255) + amt, b = (n & 255) + amt;
  r = Math.max(0, Math.min(255, r)); g = Math.max(0, Math.min(255, g)); b = Math.max(0, Math.min(255, b));
  return 'rgb(' + r + ',' + g + ',' + b + ')';
}

function label(txt, x, y, col, ent) {
  if (State.project.showLabels === false) return;
  if (ent && ent.showLabel === false) return;
  const z = State.view.zoom;
  const size = (ent && ent.labelSize) || 12;
  ctx.font = (size / z) + 'px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const w = ctx.measureText(txt).width;
  const bg = ent && ent.labelBg !== undefined ? ent.labelBg : 'rgba(0,0,0,0.55)';
  if (bg) {
    ctx.fillStyle = bg;
    ctx.fillRect(x - w / 2 - 4 / z, y - (size / 2 + 2) / z, w + 8 / z, (size + 4) / z);
  }
  ctx.fillStyle = (ent && ent.labelColor) || col;
  ctx.fillText(txt, x, y);
  ctx.textAlign = 'start';
  ctx.textBaseline = 'alphabetic';
}

/* ---- cameras ---- */
function hseed(id) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 997;
  return h;
}

/* samplePose + handheld shake (deterministic in t, so scrubbing repeats) */
function cameraPose(e, t) {
  const p = samplePose(e, t);
  const a = e.handheld || 0;
  if (a > 0) {
    const s = hseed(e.id);
    p.rot += (Math.sin(t * 5.3 + s) * 0.5 + Math.sin(t * 9.1 + s * 2.1) * 0.32 +
              Math.sin(t * 15.7 + s * 3.7) * 0.18) * 9 * a;
    p.x += (Math.sin(t * 4.1 + s * 1.3) + Math.sin(t * 11.3 + s * 2.9) * 0.5) * 5 * a;
    p.y += (Math.cos(t * 4.7 + s * 1.7) + Math.cos(t * 10.1 + s * 3.1) * 0.5) * 5 * a;
  }
  return p;
}

function drawFov(e, t, live) {
  const p = cameraPose(e, t);
  const half = (e.fov / 2) * DEG;
  const a = p.rot * DEG;
  ctx.save();
  ctx.translate(p.x, p.y);
  const g = ctx.createRadialGradient(0, 0, 10, 0, 0, e.range);
  g.addColorStop(0, live ? 'rgba(239,68,68,0.30)' : 'rgba(148,163,184,0.16)');
  g.addColorStop(1, live ? 'rgba(239,68,68,0.02)' : 'rgba(148,163,184,0.01)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.arc(0, 0, e.range, a - half, a + half);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = live ? 'rgba(239,68,68,0.6)' : 'rgba(148,163,184,0.35)';
  ctx.lineWidth = 1.5 / State.view.zoom;
  ctx.stroke();
  ctx.restore();
}

function drawCameraBody(e, t, live) {
  const p = cameraPose(e, t);
  const sel = State.selectedId === e.id;
  const col = live ? '#ef4444' : '#94a3b8';
  ctx.save();
  ctx.translate(p.x, p.y);
  if (sel) drawSelRing(e.pov ? 18 : 26);
  ctx.rotate(p.rot * DEG);

  if (e.pov) {
    ctx.fillStyle = live ? 'rgba(239,68,68,0.95)' : 'rgba(148,163,184,0.9)';
    ctx.beginPath();
    ctx.moveTo(16, 0); ctx.lineTo(-2, -8); ctx.lineTo(-2, 8);
    ctx.closePath(); ctx.fill();
  } else {
    ctx.fillStyle = live ? '#7f1d1d' : '#1f2937';
    ctx.strokeStyle = col; ctx.lineWidth = 2;
    roundRect(-16, -10, 26, 20, 4); ctx.fill(); ctx.stroke();
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(10, -6); ctx.lineTo(22, -12); ctx.lineTo(22, 12); ctx.lineTo(10, 6);
    ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.arc(-9, -13, 5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(1, -13, 5, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();

  const povName = e.pov && getEntity(e.pov) ? getEntity(e.pov).name : null;
  const tag = povName ? e.name + ' POV ' + povName : e.name;
  const ly = e.pov ? p.y - 40 : p.y + 34;
  label((live ? 'LIVE ' : '') + tag, p.x, ly, live ? '#f87171' : 'rgba(255,255,255,0.85)', e);
}

function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawProp(e, t) {
  const p = samplePose(e, t);
  ctx.save();
  ctx.translate(p.x, p.y);
  if (State.selectedId === e.id) drawSelRing(Math.max(e.w, e.h) / 2 + 8);
  ctx.rotate(p.rot * DEG);
  ctx.fillStyle = e.color;
  ctx.strokeStyle = 'rgba(0,0,0,0.4)';
  ctx.lineWidth = 2;
  if (e.shape === 'circle') {
    ctx.beginPath(); ctx.arc(0, 0, e.w / 2, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  } else {
    roundRect(-e.w / 2, -e.h / 2, e.w, e.h, 6); ctx.fill(); ctx.stroke();
  }
  ctx.restore();
  label(e.name, p.x, p.y + Math.max(e.h, e.w) / 2 + 16, 'rgba(255,255,255,0.7)', e);
}

function drawSelRing(r) {
  const z = State.view.zoom;
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 2 / z;
  ctx.setLineDash([5 / z, 4 / z]);
  ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.stroke();
  ctx.setLineDash([]);
}

function rotHandlePos(e, t) {
  const p = samplePose(e, t);
  const d = (e.type === 'prop' ? Math.max(e.w, e.h) / 2 + 8 : 26 * (e.scale || 1)) + 24 / State.view.zoom;
  return { x: p.x + Math.cos(p.rot * DEG) * d, y: p.y + Math.sin(p.rot * DEG) * d, cx: p.x, cy: p.y };
}

function drawOverlay() {
  const e = getEntity(State.selectedId);
  if (!e || !e.visible) return;
  if (e.type === 'camera' && e.pov) return;
  const v = State.view;
  ctx.save();
  ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
  ctx.translate(cv.clientWidth / 2, cv.clientHeight / 2);
  ctx.scale(v.zoom, v.zoom);
  ctx.translate(-v.x, -v.y);
  const h = rotHandlePos(e, State.time);
  ctx.strokeStyle = 'rgba(56,189,248,0.6)';
  ctx.lineWidth = 1.5 / v.zoom;
  ctx.beginPath(); ctx.moveTo(h.cx, h.cy); ctx.lineTo(h.x, h.y); ctx.stroke();
  ctx.fillStyle = '#38bdf8';
  ctx.beginPath(); ctx.arc(h.x, h.y, 6 / v.zoom, 0, Math.PI * 2); ctx.fill();
  if (canBend(e)) {
    const sq = 5 / v.zoom;
    const pk = posKfs(e);
    for (let i = 1; i < pk.length; i++) {
      const c = segControl(pk[i - 1], pk[i]);
      const bent = (pk[i - 1].bx || pk[i - 1].by);
      ctx.fillStyle = bent ? '#f59e0b' : 'rgba(245,158,11,0.55)';
      ctx.strokeStyle = 'rgba(0,0,0,0.5)';
      ctx.lineWidth = 1 / v.zoom;
      ctx.fillRect(c.x - sq, c.y - sq, sq * 2, sq * 2);
      ctx.strokeRect(c.x - sq, c.y - sq, sq * 2, sq * 2);
    }
  }
  ctx.restore();
}

/* entity whose selected path segments can be bent with handles */
function canBend(e) {
  return State.project.showPaths !== false && e.visible && e.showPath && e.type !== 'prop' &&
    !(e.type === 'camera' && e.pov) && posKfs(e).length > 1;
}

/* ============ interaction ============ */
let drag = null;

function hitTest(wp) {
  const t = State.time;
  const ents = State.project.entities;
  for (let i = ents.length - 1; i >= 0; i--) {
    const e = ents[i];
    if (!e.visible) continue;
    const p = samplePose(e, t);
    let r = 26;
    if (e.type === 'prop') r = Math.max(e.w, e.h) / 2 + 4;
    if (e.type === 'character') r = 26 * (e.scale || 1);
    if (e.type === 'camera') r = e.pov ? 18 : 28;
    if (Math.hypot(wp.x - p.x, wp.y - p.y) <= r) return e;
  }
  return null;
}

cv.addEventListener('pointerdown', ev => {
  cv.setPointerCapture(ev.pointerId);
  const rect = cv.getBoundingClientRect();
  const sp = { x: ev.clientX - rect.left, y: ev.clientY - rect.top };
  const wp = s2w(sp);

  const selB = getEntity(State.selectedId);
  if (selB && canBend(selB)) {
    const pk = posKfs(selB);
    for (let i = 1; i < pk.length; i++) {
      const c = segControl(pk[i - 1], pk[i]);
      if (Math.hypot(wp.x - c.x, wp.y - c.y) <= 9 / State.view.zoom) {
        if (ev.button === 2) {
          delete pk[i - 1].bx;
          delete pk[i - 1].by;
          scheduleSave(); requestRender();
          return;
        }
        drag = { mode: 'bend', a: pk[i - 1], b: pk[i] };
        return;
      }
    }
  }

  if (ev.button === 1 || ev.button === 2) {
    drag = { mode: 'pan', sx: sp.x, sy: sp.y, vx: State.view.x, vy: State.view.y };
    return;
  }

  const sel = selB;
  if (sel && sel.visible && !(sel.type === 'camera' && sel.pov)) {
    const h = rotHandlePos(sel, State.time);
    if (Math.hypot(wp.x - h.x, wp.y - h.y) <= 12 / State.view.zoom) {
      if (isAutoOrient(sel)) { sel.orient = 'manual'; UI.refresh(); }
      drag = { mode: 'rotate', e: sel };
      return;
    }
  }

  const hit = hitTest(wp);
  if (hit) {
    State.selectedId = hit.id;
    if (State.selectedKf && State.selectedKf.entityId !== hit.id) State.selectedKf = null;
    if (hit.type === 'camera' && hit.pov) {
      drag = null; /* POV cam follows its character */
    } else {
      const p = samplePose(hit, State.time);
      drag = { mode: 'move', e: hit, ox: wp.x - p.x, oy: wp.y - p.y, lx: wp.x, ly: wp.y };
    }
    UI.refresh();
  } else {
    State.selectedId = null;
    drag = { mode: 'pan', sx: sp.x, sy: sp.y, vx: State.view.x, vy: State.view.y };
    UI.refresh();
  }
  requestRender();
});

cv.addEventListener('pointermove', ev => {
  if (!drag) return;
  const rect = cv.getBoundingClientRect();
  const sp = { x: ev.clientX - rect.left, y: ev.clientY - rect.top };
  const wp = s2w(sp);

  if (drag.mode === 'pan') {
    State.view.x = drag.vx - (sp.x - drag.sx) / State.view.zoom;
    State.view.y = drag.vy - (sp.y - drag.sy) / State.view.zoom;
  } else if (drag.mode === 'move') {
    const e = drag.e;
    if (State.autoKey) {
      setKeyframe(e, State.time, { x: wp.x - drag.ox, y: wp.y - drag.oy });
    } else {
      offsetAllKeyframes(e, wp.x - drag.lx, wp.y - drag.ly);
    }
    drag.lx = wp.x; drag.ly = wp.y;
    Timeline.render();
  } else if (drag.mode === 'bend') {
    const a = drag.a, b = drag.b;
    a.bx = wp.x - (a.x + b.x) / 2;
    a.by = wp.y - (a.y + b.y) / 2;
    if (ev.shiftKey || (Math.abs(a.bx) < 8 && Math.abs(a.by) < 8)) { a.bx = 0; a.by = 0; }
  } else if (drag.mode === 'rotate') {
    const e = drag.e;
    const p = samplePose(e, State.time);
    const ang = Math.atan2(wp.y - p.y, wp.x - p.x) / DEG;
    const snapped = ev.shiftKey ? Math.round(ang / 15) * 15 : Math.round(ang);
    if (State.autoKey) setKeyframe(e, State.time, { rot: snapped });
    else e.keyframes.forEach(k => k.rot = snapped);
    Timeline.render();
  }
  requestRender();
});

cv.addEventListener('pointerup', () => {
  if (drag && drag.mode !== 'pan') scheduleSave();
  drag = null;
});
cv.addEventListener('contextmenu', ev => ev.preventDefault());

cv.addEventListener('wheel', ev => {
  ev.preventDefault();
  const rect = cv.getBoundingClientRect();
  const sp = { x: ev.clientX - rect.left, y: ev.clientY - rect.top };
  const before = s2w(sp);
  const factor = ev.deltaY < 0 ? 1.12 : 1 / 1.12;
  State.view.zoom = Math.max(0.15, Math.min(6, State.view.zoom * factor));
  const after = s2w(sp);
  State.view.x += before.x - after.x;
  State.view.y += before.y - after.y;
  requestRender();
}, { passive: false });

/* Insert a keyframe on the path at the nearest curve point (exact bezier subdivision,
   so the shape does not change). Returns the new keyframe or null. */
function insertPathKeyframe(e, wp) {
  if (!canBend(e)) return null;
  const pk = posKfs(e);
  let best = null;
  for (let i = 1; i < pk.length; i++) {
    const a = pk[i - 1], b = pk[i], c = segControl(a, b);
    for (let j = 1; j < 60; j++) {
      const u = j / 60, g = 1 - u;
      const x = g * g * a.x + 2 * u * g * c.x + u * u * b.x;
      const y = g * g * a.y + 2 * u * g * c.y + u * u * b.y;
      const d = Math.hypot(wp.x - x, wp.y - y);
      if (!best || d < best.d) best = { d, a, b, c, u };
    }
  }
  if (!best || best.d > 14 / State.view.zoom) return null;
  const { a, b, c, u } = best;
  const t = snapT(a.t + u * (b.t - a.t));
  if (t <= a.t + 0.05 || t >= b.t - 0.05) return null;
  const g = 1 - u;
  const M = { x: g * g * a.x + 2 * u * g * c.x + u * u * b.x,
              y: g * g * a.y + 2 * u * g * c.y + u * u * b.y };
  const Q0 = { x: a.x + (c.x - a.x) * u, y: a.y + (c.y - a.y) * u };
  const Q1 = { x: c.x + (b.x - c.x) * u, y: c.y + (b.y - c.y) * u };
  const kf = { t, x: M.x, y: M.y };
  if (!e.split) kf.rot = samplePose(e, t).rot;
  if (a.ease) kf.ease = a.ease;
  /* de Casteljau split: both halves keep the exact original shape */
  a.bx = Q0.x - (a.x + M.x) / 2; a.by = Q0.y - (a.y + M.y) / 2;
  kf.bx = Q1.x - (M.x + b.x) / 2; kf.by = Q1.y - (M.y + b.y) / 2;
  e.keyframes.push(kf);
  e.keyframes.sort((k1, k2) => k1.t - k2.t);
  return kf;
}

cv.addEventListener('dblclick', ev => {
  const rect = cv.getBoundingClientRect();
  const wp = s2w({ x: ev.clientX - rect.left, y: ev.clientY - rect.top });
  const e = getEntity(State.selectedId);
  if (!e || hitTest(wp)) return;
  if (insertPathKeyframe(e, wp)) {
    State.selectedKf = null;
    Timeline.render(); UI.refresh(); requestRender(); scheduleSave();
  }
});

/* render loop */
let renderQueued = false;
function requestRender() {
  if (renderQueued) return;
  renderQueued = true;
  requestAnimationFrame(() => {
    renderQueued = false;
    drawScene();
    drawOverlay();
  });
}
