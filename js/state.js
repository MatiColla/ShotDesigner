/* ============ State & data model ============ */
const State = {
  project: {
    duration: 15,          // seconds (max 30)
    background: null,      // {src, scale, opacity}
    entities: [],
    cuts: []               // [{t, cameraId}]
  },
  time: 0,
  playing: false,
  loop: true,
  autoKey: true,
  selectedId: null,
  selectedKf: null,        // {entityId, index}
  counters: { character: 0, camera: 0, prop: 0 },
  view: { x: 0, y: 0, zoom: 1 }   // canvas pan/zoom
};

const SKIN_TONES = ['#f5d0b0', '#e8b58a', '#c68642', '#8d5524', '#5c3a21', '#3b2417'];
const CLOTH_COLORS = ['#e11d48', '#f97316', '#eab308', '#22c55e', '#0ea5e9', '#3b82f6', '#8b5cf6', '#ec4899', '#94a3b8', '#334155'];

function uid() { return 'e' + Math.random().toString(36).slice(2, 9); }

function addEntity(type, opts = {}) {
  const t = snapT(State.time);
  let e;
  if (type === 'character') {
    const n = ++State.counters.character;
    e = {
      id: uid(), type, name: opts.name || 'Actor ' + n,
      visible: true, showPath: true,
      gender: opts.gender || 'm',
      skin: opts.skin || SKIN_TONES[1],
      color: opts.color || CLOTH_COLORS[(n - 1) % CLOTH_COLORS.length],
      scale: 1,
      keyframes: [{ t: 0, x: opts.x ?? 0, y: opts.y ?? 0, rot: 0 }]
    };
  } else if (type === 'camera') {
    const n = ++State.counters.camera;
    e = {
      id: uid(), type, name: 'C' + n, num: n,
      visible: true, showPath: true,
      fov: 55, range: 280, pov: null, handheld: 0,
      keyframes: [{ t: 0, x: opts.x ?? 0, y: opts.y ?? 150, rot: -90 }]
    };
    if (State.project.cuts.length === 0) State.project.cuts.push({ t: 0, cameraId: e.id });
  } else { // prop
    const n = ++State.counters.prop;
    e = {
      id: uid(), type, name: 'Prop ' + n,
      visible: true, showPath: false,
      shape: opts.shape || 'rect', w: 120, h: 70, color: '#a78bfa',
      keyframes: [{ t: 0, x: opts.x ?? 0, y: opts.y ?? 0, rot: 0 }]
    };
  }
  State.project.entities.push(e);
  State.selectedId = e.id;
  return e;
}

function removeEntity(id) {
  const p = State.project;
  p.entities = p.entities.filter(e => e.id !== id);
  p.cuts = p.cuts.filter(c => c.cameraId !== id);
  p.entities.forEach(e => { if (e.pov === id) e.pov = null; });
  if (State.selectedId === id) { State.selectedId = null; State.selectedKf = null; }
}

function getEntity(id) { return State.project.entities.find(e => e.id === id); }

function snapT(t) { return Math.round(t * 10) / 10; }

/* control point of the bezier segment leaving keyframe a (offset stored on a.bx/a.by) */
function segControl(a, b) {
  return { x: (a.x + b.x) / 2 + (a.bx || 0), y: (a.y + b.y) / 2 + (a.by || 0) };
}

function lerpAngle(a, b, f) {
  let d = ((b - a) % 360 + 540) % 360 - 180;
  return a + d * f;
}

/* keyframes that carry each channel */
function posKfs(e) { return e.keyframes.filter(k => k.x !== undefined); }
function rotKfs(e) { return e.keyframes.filter(k => k.rot !== undefined); }

/* find segment of a channel list at time t, easing applied */
function findSeg(kfs, t) {
  if (t <= kfs[0].t) return { a: kfs[0], b: kfs[0], f: 0 };
  const last = kfs[kfs.length - 1];
  if (t >= last.t) return { a: last, b: last, f: 0 };
  for (let i = 0; i < kfs.length - 1; i++) {
    const a = kfs[i], b = kfs[i + 1];
    if (t >= a.t && t <= b.t) {
      let f = (b.t - a.t) < 1e-6 ? 0 : (t - a.t) / (b.t - a.t);
      if (a.ease === 'in') f = f * f;
      else if (a.ease === 'out') f = 1 - (1 - f) * (1 - f);
      else if (a.ease === 'inout') f = f * f * (3 - 2 * f);
      return { a, b, f };
    }
  }
  return { a: last, b: last, f: 0 };
}

/* tangent (deg) of the position path at time t, or null if there is no motion */
function pathTangent(pk, t) {
  if (pk.length < 2) return null;
  const tc = Math.max(pk[0].t, Math.min(pk[pk.length - 1].t, t));
  let i = 0;
  while (i < pk.length - 2 && tc > pk[i + 1].t) i++;
  const a = pk[i], b = pk[i + 1];
  let f = (b.t - a.t) < 1e-6 ? 0 : (tc - a.t) / (b.t - a.t);
  if (a.ease === 'in') f = f * f;
  else if (a.ease === 'out') f = 1 - (1 - f) * (1 - f);
  else if (a.ease === 'inout') f = f * f * (3 - 2 * f);
  const c = segControl(a, b);
  let tx = 2 * (1 - f) * (c.x - a.x) + 2 * f * (b.x - c.x);
  let ty = 2 * (1 - f) * (c.y - a.y) + 2 * f * (b.y - c.y);
  if (Math.hypot(tx, ty) < 1e-3) { tx = b.x - a.x; ty = b.y - a.y; }
  if (Math.hypot(tx, ty) < 1e-3) return null;
  return Math.atan2(ty, tx) * 180 / Math.PI;
}

/* characters face their path by default; cameras/props are manual unless opted in */
function isAutoOrient(e) {
  return e.type === 'character' ? e.orient !== 'manual' : e.orient === 'auto';
}

/* Sample entity pose at time t (POV cameras follow their character).
   Position and rotation are independent channels: a keyframe may carry one or both. */
function samplePose(e, t) {
  if (e.type === 'camera' && e.pov) {
    const ch = getEntity(e.pov);
    if (ch) return samplePose(ch, t);
  }
  const pk = posKfs(e), rk = rotKfs(e);
  let x = 0, y = 0, rot = 0;
  if (pk.length) {
    const { a, b, f } = findSeg(pk, t);
    const c = segControl(a, b), g = 1 - f;
    x = g * g * a.x + 2 * f * g * c.x + f * f * b.x;
    y = g * g * a.y + 2 * f * g * c.y + f * f * b.y;
  }
  if (rk.length) {
    const { a, b, f } = findSeg(rk, t);
    rot = lerpAngle(a.rot, b.rot, f);
  }
  if (isAutoOrient(e)) {
    const tg = pathTangent(pk, t);
    if (tg !== null) rot = tg;
  }
  return { x, y, rot };
}

/* Add or merge a keyframe at time t.
   With e.split, a new keyframe only records the channels present in partial. */
function setKeyframe(e, t, partial) {
  t = snapT(Math.max(0, Math.min(State.project.duration, t)));
  let kf = e.keyframes.find(k => Math.abs(k.t - t) < 0.051);
  const wantsPos = 'x' in partial || 'y' in partial;
  const wantsRot = 'rot' in partial;
  if (!kf) {
    kf = { t };
    if (!e.split || (!wantsPos && !wantsRot)) {
      const base = samplePose(e, t);
      kf.x = base.x; kf.y = base.y; kf.rot = base.rot;
    }
    e.keyframes.push(kf);
    e.keyframes.sort((a, b) => a.t - b.t);
  }
  if (wantsPos && (kf.x === undefined || kf.y === undefined)) {
    const base = samplePose(e, t);
    if (kf.x === undefined) kf.x = base.x;
    if (kf.y === undefined) kf.y = base.y;
  }
  Object.assign(kf, partial);
  return kf;
}

function deleteKeyframe(e, index) {
  if (e.keyframes.length <= 1) return; // always keep one
  e.keyframes.splice(index, 1);
}

/* Move every keyframe of an entity by a delta (drag without auto-key) */
function offsetAllKeyframes(e, dx, dy) {
  e.keyframes.forEach(k => { if (k.x !== undefined) { k.x += dx; k.y += dy; } });
}

/* ---- Camera cuts ---- */
function activeCameraAt(t) {
  const cuts = State.project.cuts.filter(c => getEntity(c.cameraId));
  if (!cuts.length) return null;
  const sorted = [...cuts].sort((a, b) => a.t - b.t);
  let cur = null;
  for (const c of sorted) { if (c.t <= t + 1e-6) cur = c; else break; }
  return cur ? getEntity(cur.cameraId) : getEntity(sorted[0].cameraId);
}

function addCut(t, cameraId) {
  t = snapT(t);
  const cuts = State.project.cuts;
  const same = cuts.find(c => Math.abs(c.t - t) < 0.051);
  if (same) same.cameraId = cameraId;
  else cuts.push({ t, cameraId });
  cuts.sort((a, b) => a.t - b.t);
}

function deleteCut(i) { State.project.cuts.splice(i, 1); }

/* ---- History (undo/redo) ---- */
const History = {
  undo: [], redo: [],
  serialize() { return JSON.stringify({ project: State.project, counters: State.counters }); },
  baseline() { this.undo = [this.serialize()]; this.redo = []; },
  commit() {
    const snap = this.serialize();
    if (snap === this.undo[this.undo.length - 1]) return;
    this.undo.push(snap);
    if (this.undo.length > 60) this.undo.shift();
    this.redo = [];
  },
  restore(snap) {
    const data = JSON.parse(snap);
    State.project = data.project;
    State.counters = data.counters;
    if (!getEntity(State.selectedId)) State.selectedId = null;
    State.selectedKf = null;
    State.time = Math.min(State.time, State.project.duration);
  },
  undoStep() {
    flushSave();
    if (this.undo.length < 2) return false;
    this.redo.push(this.undo.pop());
    this.restore(this.undo[this.undo.length - 1]);
    return true;
  },
  redoStep() {
    if (!this.redo.length) return false;
    const snap = this.redo.pop();
    this.undo.push(snap);
    this.restore(snap);
    return true;
  }
};

/* ---- Persistence ---- */
const LS_KEY = 'shotdesigner_project_v1';
let saveTimer = null;
function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(flushSave, 400);
}
function flushSave() {
  clearTimeout(saveTimer);
  saveTimer = null;
  History.commit();
  try {
    localStorage.setItem(LS_KEY, JSON.stringify({ project: State.project, counters: State.counters }));
  } catch (err) { /* quota — ignore */ }
}

function loadSaved() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return false;
    const data = JSON.parse(raw);
    if (!data.project) return false;
    State.project = data.project;
    State.counters = data.counters || State.counters;
    return true;
  } catch (err) { return false; }
}

function exportJSON() {
  const blob = new Blob([JSON.stringify({ project: State.project, counters: State.counters }, null, 2)],
    { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'shotdesigner-escena.json';
  a.click();
  URL.revokeObjectURL(a.href);
}

function importJSON(file, done) {
  const r = new FileReader();
  r.onload = () => {
    try {
      const data = JSON.parse(r.result);
      if (data.project) {
        State.project = data.project;
        State.counters = data.counters || { character: 0, camera: 0, prop: 0 };
        State.selectedId = null; State.selectedKf = null; State.time = 0;
        done && done(true);
      } else done && done(false);
    } catch (err) { done && done(false); }
  };
  r.readAsText(file);
}
