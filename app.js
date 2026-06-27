// ═══════════════════════════════════════════════════════
//  MANDALA MAKER — app.js
// ═══════════════════════════════════════════════════════

// ── Constants ──────────────────────────────────────────
const MANDALA_COLORS = ['#ff6b9d','#7c6af0','#4ecdc4','#ffe66d','#ff8b3d','#a8ff78'];
const HANDLE_RADIUS = 7;
const MAX_HISTORY = 50;

// ── State ───────────────────────────────────────────────
const S = {
  // scene
  mandalas: [],
  activeIdx: 0,

  // tool
  tool: 'brush',
  color: '#ff6b9d',
  bgColor: '#0d0d1a',
  thickness: 4,
  opacity: 1,
  smooth: 0,
  mirror: true,
  showGuides: true,
  snapAngle: false,

  // drawing transient
  drawing: false,
  pts: [],
  lineStart: null,

  // sprite selection
  selectedSpriteId: null,
  dragHandle: null,     // 'move' | 'scale-*' | 'rotate' | 'mandala-move'
  dragMandalaId: null,  // id of mandala being dragged
  mandalaOrigin: null,  // {cx, cy} before drag started
  dragStart: null,
  spriteDragOrigin: null,

  // palette
  palette: [],      // {id,name,img,dataUrl,isGif,transparentColor,tolerance,isSpriteSheet,cols,rows,selectedCell,processedCache}
  selectedPaletteId: null,

  // history
  history: [],
  redoStack: [],

  // canvas
  canvasW: 1200,
  canvasH: 900,
  mousePos: null,   // canvas-space coords, updated every mousemove

  // animation
  rafId: null,
  lastTime: 0,
  animClock: 0,

  // viewport
  viewport: { zoom: 1, panX: 0, panY: 0 },
  panning: false,
  panStart: null,       // { x, y, panX, panY }
  spaceDown: false,
};

// ── DOM refs ────────────────────────────────────────────
const canvas = document.getElementById('main-canvas');
const ctx = canvas.getContext('2d', { willReadFrequently: true });
const hiddenImgs = document.getElementById('hidden-imgs');

// ── Utilities ───────────────────────────────────────────
let _uidCounter = 0;
const uid = () => 'id' + (++_uidCounter) + '_' + Date.now();

function getActiveMandala() { return S.mandalas[S.activeIdx] || null; }

function canvasPos(e) {
  const r = canvas.getBoundingClientRect();
  const scaleX = canvas.width / r.width;
  const scaleY = canvas.height / r.height;
  const src = e.touches ? e.touches[0] : e;
  return { x: (src.clientX - r.left) * scaleX, y: (src.clientY - r.top) * scaleY };
}

function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }

function lerp(a, b, t) { return a + (b - a) * t; }

// ── Animation engine ────────────────────────────────────
const EASING_NAMES = ['linear', 'ease', 'ease-in', 'ease-out', 'bounce', 'elastic'];
const EASINGS = {
  linear:    t => t,
  ease:      t => t < 0.5 ? 2*t*t : -1+(4-2*t)*t,
  'ease-in': t => t * t,
  'ease-out':t => t * (2 - t),
  bounce:    t => {
    if (t < 1/2.75) return 7.5625*t*t;
    if (t < 2/2.75) { t -= 1.5/2.75;  return 7.5625*t*t + 0.75; }
    if (t < 2.5/2.75){ t -= 2.25/2.75; return 7.5625*t*t + 0.9375; }
    t -= 2.625/2.75; return 7.5625*t*t + 0.984375;
  },
  elastic:   t => t === 0 ? 0 : t === 1 ? 1 :
    -Math.pow(2, 10*t-10) * Math.sin((t*10-10.75)*(2*Math.PI)/3),
};

// Evaluate animated property at normalised time t (0-1, looping handled by caller)
function animValueAtT(animProp, t) {
  const kfs = animProp.keyframes;
  if (!kfs || kfs.length === 0) return null;
  if (kfs.length === 1) return kfs[0].value;
  // Clamp to first/last outside defined range
  if (t <= kfs[0].t) return kfs[0].value;
  if (t >= kfs[kfs.length-1].t) return kfs[kfs.length-1].value;
  for (let i = 0; i < kfs.length - 1; i++) {
    const a = kfs[i], b = kfs[i+1];
    if (t >= a.t && t <= b.t) {
      const span = b.t - a.t;
      if (span <= 0) return a.value;
      const localT = (t - a.t) / span;
      const fn = EASINGS[a.easing] || EASINGS.ease;
      return lerp(a.value, b.value, fn(localT));
    }
  }
  return kfs[kfs.length-1].value;
}

function getAnimValue(spr, prop, clock) {
  const ap = spr.anim?.[prop];
  if (!ap?.enabled || !ap.keyframes?.length) return null;
  const t = (clock % ap.duration) / ap.duration;
  return animValueAtT(ap, t);
}

function hasAnyAnimation() {
  return S.mandalas.some(m => m.sprites.some(s =>
    s.anim && Object.values(s.anim).some(ap => ap.enabled)
  ));
}

function applyPreset(preset) {
  return {
    enabled: true,
    duration: preset.dur,
    keyframes: preset.kfs.map(k => ({ t: k.t, value: k.v, easing: k.e })),
  };
}

function defaultAnimProp(value, duration = 2) {
  return {
    enabled: true,
    duration,
    keyframes: [
      { t: 0,   value, easing: 'ease' },
      { t: 0.5, value: value * 1.4, easing: 'ease' },
      { t: 1,   value, easing: 'ease' },
    ],
  };
}

// ── Animation timeline canvas ────────────────────────────
const ANIM_PROPS = [
  { key: 'scale',    label: 'Scale',    min: 0.05, max: 8,   format: v => v.toFixed(2)+'×' },
  { key: 'rotation', label: 'Rotation', min: -180,  max: 180, format: v => Math.round(v)+'°' },
  { key: 'orbit',    label: 'Orbit',    min: -180,  max: 180, format: v => Math.round(v)+'°' },
  { key: 'offsetX',  label: 'Offset X', min: -400,  max: 400, format: v => Math.round(v) },
  { key: 'offsetY',  label: 'Offset Y', min: -400,  max: 400, format: v => Math.round(v) },
  { key: 'opacity',  label: 'Opacity',  min: 0,     max: 1,   format: v => Math.round(v*100)+'%' },
];

const TL = {  // timeline interaction state
  dragging: null,    // { prop, kfIdx }
  selectedKf: null,  // { prop, kfIdx }
};

const ANIM_PRESETS = {
  scale: [
    { label: 'Pulse',        kfs: [{t:0,v:1,e:'ease'},{t:0.5,v:1.5,e:'ease'},{t:1,v:1,e:'ease'}], dur: 2 },
    { label: 'Grow',         kfs: [{t:0,v:0.5,e:'ease'},{t:1,v:2,e:'ease'}], dur: 3 },
    { label: 'Breathe',      kfs: [{t:0,v:1,e:'ease-in'},{t:0.5,v:1.3,e:'ease-out'},{t:1,v:1,e:'ease-in'}], dur: 4 },
    { label: 'Bounce In',    kfs: [{t:0,v:0,e:'bounce'},{t:1,v:1,e:'linear'}], dur: 1 },
  ],
  rotation: [
    { label: 'Spin CW',      kfs: [{t:0,v:-180,e:'linear'},{t:1,v:180,e:'linear'}], dur: 3 },
    { label: 'Spin CCW',     kfs: [{t:0,v:180,e:'linear'},{t:1,v:-180,e:'linear'}], dur: 3 },
    { label: 'Rock',         kfs: [{t:0,v:-30,e:'ease'},{t:0.5,v:30,e:'ease'},{t:1,v:-30,e:'ease'}], dur: 2 },
    { label: 'Wobble',       kfs: [{t:0,v:-10,e:'ease'},{t:0.25,v:10,e:'ease'},{t:0.5,v:-10,e:'ease'},{t:0.75,v:10,e:'ease'},{t:1,v:-10,e:'ease'}], dur: 1 },
  ],
  orbit: [
    { label: 'Orbit CW',     kfs: [{t:0,v:-180,e:'linear'},{t:1,v:180,e:'linear'}], dur: 4 },
    { label: 'Orbit CCW',    kfs: [{t:0,v:180,e:'linear'},{t:1,v:-180,e:'linear'}], dur: 4 },
    { label: 'Swing',        kfs: [{t:0,v:-45,e:'ease'},{t:0.5,v:45,e:'ease'},{t:1,v:-45,e:'ease'}], dur: 3 },
    { label: 'Figure 8',     kfs: [{t:0,v:0,e:'ease'},{t:0.25,v:90,e:'ease'},{t:0.5,v:0,e:'ease'},{t:0.75,v:-90,e:'ease'},{t:1,v:0,e:'ease'}], dur: 4 },
  ],
  offsetX: [
    { label: 'Drift Right',  kfs: [{t:0,v:-50,e:'ease'},{t:1,v:50,e:'ease'}], dur: 3 },
    { label: 'Oscillate',    kfs: [{t:0,v:-100,e:'ease'},{t:0.5,v:100,e:'ease'},{t:1,v:-100,e:'ease'}], dur: 2 },
  ],
  offsetY: [
    { label: 'Float',        kfs: [{t:0,v:-20,e:'ease'},{t:0.5,v:20,e:'ease'},{t:1,v:-20,e:'ease'}], dur: 3 },
    { label: 'Drop',         kfs: [{t:0,v:-100,e:'linear'},{t:1,v:100,e:'linear'}], dur: 2 },
  ],
  opacity: [
    { label: 'Fade In/Out',  kfs: [{t:0,v:1,e:'ease'},{t:0.5,v:0.1,e:'ease'},{t:1,v:1,e:'ease'}], dur: 2 },
    { label: 'Flicker',      kfs: [{t:0,v:1,e:'linear'},{t:0.45,v:1,e:'linear'},{t:0.5,v:0,e:'linear'},{t:0.55,v:1,e:'linear'},{t:1,v:1,e:'linear'}], dur: 1.5 },
    { label: 'Appear',       kfs: [{t:0,v:0,e:'ease-out'},{t:0.4,v:1,e:'linear'},{t:1,v:1,e:'linear'}], dur: 2 },
  ],
};

function tlCanvasEl(prop) { return document.getElementById('anim-tl-' + prop); }

function tlCoords(canvasEl, animProp) {
  const W = canvasEl.width, H = canvasEl.height;
  const PAD = { l: 6, r: 6, t: 8, b: 8 };
  const iW = W - PAD.l - PAD.r, iH = H - PAD.t - PAD.b;
  const cfg = ANIM_PROPS.find(p => p.key === animProp);
  const vMin = cfg.min, vMax = cfg.max;
  return {
    tx: t  => PAD.l + t * iW,
    vy: v  => PAD.t + (1 - (v - vMin) / (vMax - vMin)) * iH,
    tv: px => Math.max(0, Math.min(1, (px - PAD.l) / iW)),
    yv: py => vMin + (1 - (py - PAD.t) / iH) * (vMax - vMin),
    PAD, iW, iH, W, H,
  };
}

function drawTimeline(prop, spr) {
  const el = tlCanvasEl(prop);
  if (!el) return;
  const ap = spr?.anim?.[prop];
  if (!ap) return;
  const c = el.getContext('2d');
  const { tx, vy, PAD, W, H, iH } = tlCoords(el, prop);
  const kfs = ap.keyframes;

  // Background
  c.clearRect(0, 0, W, H);
  c.fillStyle = '#08081a';
  c.fillRect(0, 0, W, H);

  // Grid verticals
  c.strokeStyle = '#1c1c38'; c.lineWidth = 1;
  [0.25, 0.5, 0.75].forEach(t => {
    c.beginPath(); c.moveTo(tx(t), PAD.t); c.lineTo(tx(t), H - PAD.b); c.stroke();
  });
  // Mid-value horizontal
  const cfg = ANIM_PROPS.find(p => p.key === prop);
  const mid = (cfg.min + cfg.max) / 2;
  c.beginPath(); c.moveTo(PAD.l, vy(mid)); c.lineTo(W - PAD.r, vy(mid)); c.stroke();

  // Curve
  if (kfs.length >= 2) {
    c.strokeStyle = '#7c6af0'; c.lineWidth = 2;
    c.beginPath();
    const STEPS = 150;
    for (let i = 0; i <= STEPS; i++) {
      const t = kfs[0].t + (i / STEPS) * (kfs[kfs.length-1].t - kfs[0].t);
      const v = animValueAtT(ap, t);
      const x = tx(t), y = vy(v);
      i === 0 ? c.moveTo(x, y) : c.lineTo(x, y);
    }
    c.stroke();
  }

  // Easing labels between keyframes
  c.font = '8px sans-serif'; c.fillStyle = '#5060a0'; c.textAlign = 'center';
  for (let i = 0; i < kfs.length - 1; i++) {
    const mx = tx((kfs[i].t + kfs[i+1].t) / 2);
    const my = vy((kfs[i].value + kfs[i+1].value) / 2);
    c.fillText(kfs[i].easing, mx, Math.max(PAD.t + 8, Math.min(H - PAD.b - 2, my - 6)));
  }

  // Keyframe dots
  kfs.forEach((kf, idx) => {
    const x = tx(kf.t), y = vy(kf.value);
    const isSel = TL.selectedKf?.prop === prop && TL.selectedKf?.kfIdx === idx;
    c.beginPath(); c.arc(x, y, isSel ? 7 : 5.5, 0, Math.PI*2);
    c.fillStyle = isSel ? '#ff6b9d' : '#7c6af0'; c.fill();
    c.strokeStyle = '#ffffff'; c.lineWidth = isSel ? 2 : 1.5; c.stroke();
  });

  // Playhead
  const playT = (S.animClock % ap.duration) / ap.duration;
  c.strokeStyle = '#ff6b9d'; c.lineWidth = 1.5;
  c.setLineDash([3, 2]);
  c.beginPath(); c.moveTo(tx(playT), PAD.t); c.lineTo(tx(playT), H - PAD.b); c.stroke();
  c.setLineDash([]);
}

function tlNearestKf(el, prop, px, py, radius = 14) {
  const ap = tlSpr()?.anim?.[prop]; if (!ap) return -1;
  const { tx, vy } = tlCoords(el, prop);
  let best = -1, bestD = radius;
  ap.keyframes.forEach((kf, i) => {
    const d = Math.hypot(tx(kf.t) - px, vy(kf.value) - py);
    if (d < bestD) { bestD = d; best = i; }
  });
  return best;
}

function syncEasingDropdown(prop, spr) {
  const sel = document.getElementById('anim-ease-sel-' + prop);
  const row = document.getElementById('anim-kf-row-' + prop);
  if (!sel || !row) return;
  const kfIdx = TL.selectedKf?.prop === prop ? TL.selectedKf.kfIdx : -1;
  if (kfIdx < 0 || !spr?.anim?.[prop]) {
    row.style.display = 'none';
    return;
  }
  const kfs = spr.anim[prop].keyframes;
  // Show easing for the segment *after* this keyframe (last kf has no segment after)
  const hasNext = kfIdx < kfs.length - 1;
  row.style.display = hasNext ? 'flex' : 'none';
  if (hasNext) sel.value = kfs[kfIdx].easing;
  // Bin: only show for non-endpoint keyframes that are deletable
  const delBtn = document.getElementById('anim-kf-del-' + prop);
  if (delBtn) {
    const canDelete = kfIdx > 0 && kfIdx < kfs.length - 1 && kfs.length > 2;
    delBtn.style.display = canDelete ? '' : 'none';
  }
}

function tlSpr() {
  const f = findSprite(S.selectedSpriteId);
  return f ? f.sprite : null;
}

function initTimelineCanvas(prop) {
  const el = tlCanvasEl(prop);
  if (!el) return;

  el.addEventListener('mousedown', e => {
    e.preventDefault();
    const rect = el.getBoundingClientRect();
    const scaleX = el.width / rect.width;
    const px = (e.clientX - rect.left) * scaleX;
    const py = (e.clientY - rect.top) * scaleX;
    const spr = tlSpr(); if (!spr?.anim?.[prop]) return;

    if (e.button === 2) { // right-click = delete kf
      const idx = tlNearestKf(el, prop, px, py);
      if (idx >= 0 && spr.anim[prop].keyframes.length > 2) {
        spr.anim[prop].keyframes.splice(idx, 1);
        historySnapshot();
      }
      return;
    }

    const kfIdx = tlNearestKf(el, prop, px, py);
    if (kfIdx >= 0) {
      TL.dragging = { prop, kfIdx };
      TL.selectedKf = { prop, kfIdx };
      syncEasingDropdown(prop, spr);
      return;
    }

    // Deselect and add keyframe on empty click
    TL.selectedKf = null;
    syncEasingDropdown(prop, spr);
    const { tv, yv } = tlCoords(el, prop);
    const t = tv(px), v = yv(py);
    const cfg = ANIM_PROPS.find(p => p.key === prop);
    const clampedV = Math.max(cfg.min, Math.min(cfg.max, v));
    // inherit easing from previous segment
    const kfs = spr.anim[prop].keyframes;
    const prevKf = kfs.filter(k => k.t < t).pop();
    spr.anim[prop].keyframes.push({ t, value: clampedV, easing: prevKf?.easing ?? 'linear' });
    spr.anim[prop].keyframes.sort((a, b) => a.t - b.t);
    historySnapshot();
  });

  window.addEventListener('mousemove', e => {
    if (!TL.dragging || TL.dragging.prop !== prop) return;
    const rect = el.getBoundingClientRect();
    const scaleX = el.width / rect.width;
    const scaleY = el.height / rect.height;
    const px = (e.clientX - rect.left) * scaleX;
    const py = (e.clientY - rect.top) * scaleY;
    const spr = tlSpr(); if (!spr?.anim?.[prop]) return;
    const { tv, yv } = tlCoords(el, prop);
    const cfg = ANIM_PROPS.find(p => p.key === prop);
    const kfs = spr.anim[prop].keyframes;
    const draggedKf = kfs[TL.dragging.kfIdx];
    draggedKf.t = Math.max(0, Math.min(1, tv(px)));
    draggedKf.value = Math.max(cfg.min, Math.min(cfg.max, yv(py)));
    kfs.sort((a, b) => a.t - b.t);
    TL.dragging.kfIdx = kfs.indexOf(draggedKf);
  });

  window.addEventListener('mouseup', () => {
    if (TL.dragging?.prop === prop) {
      // After drag, re-sync selectedKf index (sort may have shifted it)
      const spr = tlSpr();
      if (TL.selectedKf?.prop === prop && spr?.anim?.[prop]) {
        // keep it valid after sort
        TL.selectedKf.kfIdx = Math.min(TL.selectedKf.kfIdx, spr.anim[prop].keyframes.length - 1);
        syncEasingDropdown(prop, spr);
      }
      TL.dragging = null;
      historySnapshot();
    }
  });

  el.addEventListener('contextmenu', e => e.preventDefault());
}

function refreshAllTimelines() {
  const spr = tlSpr();
  ANIM_PROPS.forEach(({ key }) => drawTimeline(key, spr));
}

function smoothPoints(pts, factor) {
  if (pts.length < 3 || factor === 0) return pts;
  const out = [pts[0]];
  for (let i = 1; i < pts.length - 1; i++) {
    out.push({
      x: lerp(pts[i].x, (pts[i - 1].x + pts[i + 1].x) / 2, factor / 10),
      y: lerp(pts[i].y, (pts[i - 1].y + pts[i + 1].y) / 2, factor / 10),
    });
  }
  out.push(pts[pts.length - 1]);
  return out;
}

function snapAngle(dx, dy) {
  const angle = Math.atan2(dy, dx);
  const snap = Math.round(angle / (Math.PI / 12)) * (Math.PI / 12);
  const len = Math.hypot(dx, dy);
  return { dx: Math.cos(snap) * len, dy: Math.sin(snap) * len };
}

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return { r, g, b };
}

function colorDist(r1, g1, b1, r2, g2, b2) {
  return Math.abs(r1 - r2) + Math.abs(g1 - g2) + Math.abs(b1 - b2);
}

// ── History ─────────────────────────────────────────────
function historySnapshot() {
  const snap = JSON.stringify(S.mandalas.map(m => ({
    ...m,
    strokes: m.strokes.map(s => ({ ...s, pts: [...s.pts.map(p => ({ ...p })) ] })),
    sprites: m.sprites.map(sp => ({ ...sp })),
  })));
  S.history.push(snap);
  S.redoStack = [];
  if (S.history.length > MAX_HISTORY) S.history.shift();
  updateUndoButtons();
}

function restoreSnapshot(snap) {
  S.mandalas = JSON.parse(snap);
  S.selectedSpriteId = null;
  updateMandalaList();
  updateSpriteProps();
}

function undo() {
  if (!S.history.length) return;
  S.redoStack.push(JSON.stringify(S.mandalas.map(m => ({
    ...m,
    strokes: m.strokes.map(s => ({ ...s, pts: [...s.pts] })),
    sprites: m.sprites.map(sp => ({ ...sp })),
  }))));
  restoreSnapshot(S.history.pop());
  updateUndoButtons();
}

function redo() {
  if (!S.redoStack.length) return;
  S.history.push(JSON.stringify(S.mandalas.map(m => ({
    ...m,
    strokes: m.strokes.map(s => ({ ...s, pts: [...s.pts] })),
    sprites: m.sprites.map(sp => ({ ...sp })),
  }))));
  restoreSnapshot(S.redoStack.pop());
  updateUndoButtons();
}

function updateUndoButtons() {
  document.getElementById('btn-undo').style.opacity = S.history.length ? '1' : '0.4';
  document.getElementById('btn-redo').style.opacity = S.redoStack.length ? '1' : '0.4';
}

// ── Canvas view helpers ──────────────────────────────────
function applyViewport() {
  const { zoom, panX, panY } = S.viewport;
  canvas.style.transform = `translate(${panX}px, ${panY}px) scale(${zoom})`;
  const zl = document.getElementById('zoom-label');
  if (zl) zl.textContent = Math.round(zoom * 100) + '%';
}

function fitCanvas() {
  const cc = document.getElementById('canvas-container');
  if (!cc) return;
  requestAnimationFrame(() => {
    const cw = cc.clientWidth, ch = cc.clientHeight;
    const zoom = Math.min(1, (cw - 48) / canvas.width, (ch - 48) / canvas.height);
    S.viewport.zoom = zoom;
    S.viewport.panX = (cw - canvas.width * zoom) / 2;
    S.viewport.panY = (ch - canvas.height * zoom) / 2;
    applyViewport();
  });
}

function centerCanvasView() { fitCanvas(); }

function zoomAt(factor, clientX, clientY) {
  const cc = document.getElementById('canvas-container');
  const rect = cc.getBoundingClientRect();
  const mx = clientX - rect.left;
  const my = clientY - rect.top;
  const newZoom = Math.max(0.05, Math.min(16, S.viewport.zoom * factor));
  S.viewport.panX = mx - (mx - S.viewport.panX) * (newZoom / S.viewport.zoom);
  S.viewport.panY = my - (my - S.viewport.panY) * (newZoom / S.viewport.zoom);
  S.viewport.zoom = newZoom;
  applyViewport();
}

function wireViewport() {
  const cc = document.getElementById('canvas-container');

  // Ctrl+Wheel = zoom; Wheel alone = pan
  cc.addEventListener('wheel', e => {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) {
      const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
      zoomAt(factor, e.clientX, e.clientY);
    } else {
      S.viewport.panX -= e.deltaX;
      S.viewport.panY -= e.deltaY;
      applyViewport();
    }
  }, { passive: false });

  // Middle-mouse drag OR Space+left-drag = pan
  cc.addEventListener('mousedown', e => {
    if (e.button === 1 || (e.button === 0 && S.spaceDown)) {
      e.preventDefault();
      S.panning = true;
      S.panStart = { x: e.clientX, y: e.clientY, panX: S.viewport.panX, panY: S.viewport.panY };
      cc.style.cursor = 'grabbing';
    }
  });

  window.addEventListener('mousemove', e => {
    if (!S.panning) return;
    S.viewport.panX = S.panStart.panX + (e.clientX - S.panStart.x);
    S.viewport.panY = S.panStart.panY + (e.clientY - S.panStart.y);
    applyViewport();
  });

  window.addEventListener('mouseup', e => {
    if (S.panning) {
      S.panning = false;
      cc.style.cursor = S.spaceDown ? 'grab' : '';
    }
  });

  // Space to toggle pan mode cursor
  window.addEventListener('keydown', e => {
    if (e.code === 'Space' && !e.target.matches('input,textarea,select')) {
      e.preventDefault();
      S.spaceDown = true;
      cc.style.cursor = 'grab';
    }
  });
  window.addEventListener('keyup', e => {
    if (e.code === 'Space') {
      S.spaceDown = false;
      if (!S.panning) cc.style.cursor = '';
    }
  });

  // Double-click container background (not canvas) = fit
  cc.addEventListener('dblclick', e => {
    if (e.target === cc) fitCanvas();
  });

  // Zoom buttons
  document.getElementById('btn-zoom-in') .addEventListener('click', () => zoomAt(1.25, window.innerWidth/2, window.innerHeight/2));
  document.getElementById('btn-zoom-out').addEventListener('click', () => zoomAt(1/1.25, window.innerWidth/2, window.innerHeight/2));
  document.getElementById('btn-zoom-fit').addEventListener('click', fitCanvas);

  // Keyboard zoom shortcuts
  window.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && (e.key === '=' || e.key === '+')) { e.preventDefault(); zoomAt(1.25, window.innerWidth/2, window.innerHeight/2); }
    if ((e.ctrlKey || e.metaKey) && e.key === '-')                    { e.preventDefault(); zoomAt(1/1.25, window.innerWidth/2, window.innerHeight/2); }
    if ((e.ctrlKey || e.metaKey) && e.key === '0')                    { e.preventDefault(); fitCanvas(); }
  });

  // Canvas size presets + custom
  document.getElementById('canvas-size').addEventListener('change', e => {
    const val = e.target.value;
    if (val === 'custom') {
      document.getElementById('custom-size-row').style.display = 'flex';
      return;
    }
    document.getElementById('custom-size-row').style.display = 'none';
    const [w, h] = val.split('x').map(Number);
    if (confirm(`Resize canvas to ${w}×${h}? Drawing will be preserved.`)) resizeCanvas(w, h);
    else e.target.value = `${S.canvasW}x${S.canvasH}`;
  });

  document.getElementById('btn-apply-custom-size').addEventListener('click', () => {
    const w = Math.max(100, Math.min(8192, parseInt(document.getElementById('custom-w').value) || 1200));
    const h = Math.max(100, Math.min(8192, parseInt(document.getElementById('custom-h').value) || 900));
    if (confirm(`Resize canvas to ${w}×${h}? Drawing will be preserved.`)) {
      resizeCanvas(w, h);
      document.getElementById('canvas-size').value = 'custom';
    }
  });
}

// ── Mandala factory ─────────────────────────────────────
function createMandala(cx, cy, axes = 8, colorIdx = 0) {
  return {
    id: uid(),
    cx, cy,
    axes,
    axisRotation: 0,
    mirror: true,
    colorIdx: colorIdx % MANDALA_COLORS.length,
    visible: true,
    strokes: [],
    sprites: [],
  };
}

// ── Palette management ──────────────────────────────────
function loadImageFromFile(file) {
  const reader = new FileReader();
  reader.onload = e => {
    const dataUrl = e.target.result;
    const isGif = file.type === 'image/gif';
    const isWebP = file.type === 'image/webp';
    addToPalette(file.name, dataUrl, isGif, isWebP);
  };
  reader.readAsDataURL(file);
}

function addToPalette(name, dataUrl, isGif = false, isWebP = false) {
  const id = uid();
  const img = document.createElement('img');
  img.src = dataUrl;
  img.onload = () => {
    const item = {
      id, name, img, dataUrl, isGif, isWebP,
      transparentColor: null, tolerance: 15,
      cropRect: null,
      isSpriteSheet: false, cols: 4, rows: 4, selectedCell: 0,
      processedCache: null,
      // animation fields (populated by initAnimation)
      gifFrames: null,   // [{canvas, delay}] decoded frames
      gifFrameIdx: 0,    // current frame index
      gifFrameTime: 0,   // timestamp of last frame advance
    };
    S.palette.push(item);
    hiddenImgs.appendChild(img);
    renderPaletteList();
    // Decode animation frames in the background
    if (isGif) initGifAnimation(item);
    else if (isWebP) initWebPAnimation(item);
  };
}

function getPaletteItem(id) { return S.palette.find(p => p.id === id) || null; }

// ── GIF / WebP frame decoder (drives our own animation, not the img element) ──
async function initGifAnimation(item) {
  if (typeof gifuct === "undefined") return; // library not loaded
  try {
    const buf = dataUrlToArrayBuffer(item.dataUrl);
    const gif = gifuct.parseGIF(buf);
    const rawFrames = gifuct.decompressFrames(gif, true);
    if (rawFrames.length <= 1) return; // static GIF

    const gw = gif.lsd.width, gh = gif.lsd.height;
    const composite = document.createElement('canvas');
    composite.width = gw; composite.height = gh;
    const cctx = composite.getContext('2d');

    const frames = [];
    let prevData = null;

    for (let i = 0; i < rawFrames.length; i++) {
      const f = rawFrames[i];
      const prev = i > 0 ? rawFrames[i - 1] : null;
      if (prev) {
        if (prev.disposalType === 2) {
          cctx.clearRect(prev.dims.left, prev.dims.top, prev.dims.width, prev.dims.height);
        } else if (prev.disposalType === 3 && prevData) {
          cctx.putImageData(prevData, 0, 0);
        }
      }
      prevData = cctx.getImageData(0, 0, gw, gh);
      const patch = document.createElement('canvas');
      patch.width = f.dims.width; patch.height = f.dims.height;
      patch.getContext('2d').putImageData(
        new ImageData(new Uint8ClampedArray(f.patch.buffer), f.dims.width, f.dims.height), 0, 0
      );
      cctx.drawImage(patch, f.dims.left, f.dims.top);

      const fc = document.createElement('canvas');
      fc.width = gw; fc.height = gh;
      fc.getContext('2d').drawImage(composite, 0, 0);
      frames.push({ canvas: fc, delay: Math.max(20, (f.delay || 100)) });
    }

    item.gifFrames = frames;
    item.gifFrameIdx = 0;
    item.gifFrameTime = performance.now();
    invalidateAnimCache(item);
  } catch (e) {
    console.warn('GIF decode failed:', e);
  }
}

async function initWebPAnimation(item) {
  if (!window.ImageDecoder) return;
  try {
    const res = await fetch(item.dataUrl);
    const blob = await res.blob();
    const decoder = new ImageDecoder({ data: blob.stream(), type: 'image/webp' });
    await decoder.tracks.ready;
    const track = decoder.tracks.selectedTrack;
    if (!track || track.frameCount <= 1) { decoder.close(); return; }

    const frames = [];
    for (let i = 0; i < track.frameCount; i++) {
      const result = await decoder.decode({ frameIndex: i });
      const bitmap = await createImageBitmap(result.image);
      const fc = document.createElement('canvas');
      fc.width = bitmap.width; fc.height = bitmap.height;
      fc.getContext('2d').drawImage(bitmap, 0, 0);
      bitmap.close();
      frames.push({ canvas: fc, delay: Math.max(20, (result.image.duration || 100000) / 1000) });
    }
    decoder.close();

    item.gifFrames = frames;
    item.gifFrameIdx = 0;
    item.gifFrameTime = performance.now();
    invalidateAnimCache(item);
  } catch (e) {
    console.warn('WebP decode failed:', e);
  }
}

// Returns the raw (unprocessed) canvas for the current animation frame,
// advancing the frame index based on elapsed time.
function getAnimFrame(item) {
  if (!item.gifFrames || !item.gifFrames.length) return null;
  const now = performance.now();
  // Advance frame(s) if enough time has passed
  while (now - item.gifFrameTime >= item.gifFrames[item.gifFrameIdx].delay) {
    item.gifFrameTime += item.gifFrames[item.gifFrameIdx].delay;
    const prevIdx = item.gifFrameIdx;
    item.gifFrameIdx = (item.gifFrameIdx + 1) % item.gifFrames.length;
    // Frame changed — invalidate any processed-frame cache
    if (item.gifFrameIdx !== prevIdx) invalidateAnimCache(item);
  }
  return item.gifFrames[item.gifFrameIdx].canvas;
}

function invalidateAnimCache(item) {
  item._animCanvas = null;
  item._animFrameIdx = -1;
}

function applyProcessing(src, sx, sy, sW, sH, item) {
  const off = document.createElement('canvas');
  off.width = sW; off.height = sH;
  const octx = off.getContext('2d', { willReadFrequently: true });
  octx.drawImage(src, sx, sy, sW, sH, 0, 0, sW, sH);
  if (item.transparentColor) {
    const { r: tr, g: tg, b: tb } = hexToRgb(item.transparentColor);
    const tol = (item.tolerance || 15) * 3;
    const imgData = octx.getImageData(0, 0, sW, sH);
    const d = imgData.data;
    for (let i = 0; i < d.length; i += 4) {
      if (colorDist(d[i], d[i+1], d[i+2], tr, tg, tb) <= tol) d[i+3] = 0;
    }
    octx.putImageData(imgData, 0, 0);
  }
  return off;
}

function getDrawableImage(item, noCache = false) {
  if (!item) return null;
  const hasCrop = !!item.cropRect;
  const hasTrans = !!item.transparentColor;
  const isSS = item.isSpriteSheet;
  const needsProcessing = hasTrans || isSS || hasCrop;
  const isAnimated = (item.isGif || item.isWebP) && item.gifFrames;

  if (isAnimated) {
    const rawFrame = getAnimFrame(item); // advances frame clock, returns canvas
    if (!needsProcessing) return rawFrame;

    // Return cached processed frame if frame index hasn't changed
    if (item._animCanvas && !noCache && item._animFrameIdx === item.gifFrameIdx) {
      return item._animCanvas;
    }

    // Apply crop / sprite-sheet region
    const fw = rawFrame.width, fh = rawFrame.height;
    let sx = 0, sy = 0, sW = fw, sH = fh;
    if (isSS && item.cols > 0 && item.rows > 0) {
      const cellW = Math.floor(fw / item.cols), cellH = Math.floor(fh / item.rows);
      sx = (item.selectedCell % item.cols) * cellW;
      sy = Math.floor(item.selectedCell / item.cols) * cellH;
      sW = cellW; sH = cellH;
    } else if (hasCrop) {
      sx = Math.max(0, item.cropRect.x);
      sy = Math.max(0, item.cropRect.y);
      sW = Math.max(1, Math.min(item.cropRect.w, fw - sx));
      sH = Math.max(1, Math.min(item.cropRect.h, fh - sy));
    }

    const processed = applyProcessing(rawFrame, sx, sy, sW, sH, item);
    item._animCanvas = processed;
    item._animFrameIdx = item.gifFrameIdx;
    return processed;
  }

  // Static image path
  if (!needsProcessing) return item.img;
  if (item.processedCache && !noCache) return item.processedCache;

  const srcImg = item.img;
  const sw = srcImg.naturalWidth, sh = srcImg.naturalHeight;
  if (!sw || !sh) return srcImg;

  let sx = 0, sy = 0, sW = sw, sH = sh;
  if (isSS && item.cols > 0 && item.rows > 0) {
    const cellW = Math.floor(sw / item.cols), cellH = Math.floor(sh / item.rows);
    sx = (item.selectedCell % item.cols) * cellW;
    sy = Math.floor(item.selectedCell / item.cols) * cellH;
    sW = cellW; sH = cellH;
  } else if (hasCrop) {
    sx = Math.max(0, item.cropRect.x);
    sy = Math.max(0, item.cropRect.y);
    sW = Math.max(1, Math.min(item.cropRect.w, sw - sx));
    sH = Math.max(1, Math.min(item.cropRect.h, sh - sy));
  }

  item.processedCache = applyProcessing(srcImg, sx, sy, sW, sH, item);
  return item.processedCache;
}

// ── Rendering ────────────────────────────────────────────
function render(timestamp) {
  S.rafId = requestAnimationFrame(render);
  const dt = S.lastTime ? Math.min((timestamp - S.lastTime) / 1000, 0.1) : 0;
  S.lastTime = timestamp;
  if (hasAnyAnimation()) {
    S.animClock += dt;
    refreshAllTimelines();
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Background
  ctx.fillStyle = S.bgColor;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Render each mandala
  for (const m of S.mandalas) {
    if (!m.visible) continue;
    renderMandala(m, false);
  }

  // Current stroke preview
  if (S.drawing && S.pts.length > 1) {
    const m = getActiveMandala();
    if (m) renderStrokeSymmetric(ctx, m, S.pts, S.color, S.thickness, S.opacity, S.tool === 'erase', m.mirror !== false, m.axes, m.axisRotation);
  }
  if (S.drawing && S.tool === 'line' && S.lineStart && S.pts.length > 0) {
    const m = getActiveMandala();
    if (m) {
      const last = S.pts[S.pts.length - 1];
      renderLineSymmetric(ctx, m, S.lineStart, last, S.color, S.thickness, S.opacity, m.mirror !== false, m.axes, m.axisRotation);
    }
  }

  // Stamp placement preview
  if (S.tool === 'place' && S.mousePos) {
    const m = getActiveMandala();
    const item = getPaletteItem(S.selectedPaletteId);
    if (m && item && item.img.complete) {
      const drawable = getDrawableImage(item);
      if (drawable) {
        const prevAlpha = ctx.globalAlpha;
        ctx.globalAlpha = 0.4;
        // Temporarily place a ghost sprite at mouse position and render it
        const rotRad = (m.axisRotation || 0) * Math.PI / 180;
        const dx = S.mousePos.x - m.cx, dy = S.mousePos.y - m.cy;
        const lx = dx * Math.cos(-rotRad) - dy * Math.sin(-rotRad);
        const ly = dx * Math.sin(-rotRad) + dy * Math.cos(-rotRad);
        const ghostSpr = { x: lx, y: ly, rotation: 0, scale: 1, opacity: 1, flipX: false, warpMode: false, axes: m.axes, axisRotation: m.axisRotation, mirror: m.mirror };
        renderSprite(ctx, m, ghostSpr, drawable);
        ctx.globalAlpha = prevAlpha;
      }
    }
  }

  // Guides
  if (S.showGuides) {
    for (const m of S.mandalas) {
      if (!m.visible) continue;
      renderGuides(m, m === getActiveMandala());
    }
  }

  // Selection handles
  if (S.selectedSpriteId && S.tool === 'select') {
    renderSelectionHandles();
  }

  // Eraser cursor — drawn last so it's always on top
  if (S.tool === 'erase' && S.mousePos) {
    const r = S.thickness / 2;
    ctx.save();
    ctx.globalAlpha = 0.85;
    // Outer ring
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.arc(S.mousePos.x, S.mousePos.y, r, 0, Math.PI * 2);
    ctx.stroke();
    // Inner crosshair dot
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.beginPath();
    ctx.arc(S.mousePos.x, S.mousePos.y, 1.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function renderMandala(m, forExport) {
  // Draw strokes — each uses its own snapshotted axes + rotation
  for (const stroke of m.strokes) {
    if (stroke.pts.length < 2) continue;
    const axes = stroke.axes != null ? stroke.axes : m.axes;
    const rot = stroke.axisRotation != null ? stroke.axisRotation : m.axisRotation;
    renderStrokeSymmetric(ctx, m, stroke.pts, stroke.color, stroke.thickness, stroke.opacity, stroke.erase, stroke.mirror !== false, axes, rot);
  }
  // Draw sprites — each uses its own snapshotted axes count
  for (const spr of m.sprites) {
    renderSprite(ctx, m, spr);
  }
}

function renderStrokeSymmetric(ctx, m, pts, color, thickness, opacity, erase, mirror, axes, axisRotation) {
  const n = (axes != null ? axes : m.axes);
  const rotRad = ((axisRotation != null ? axisRotation : m.axisRotation) || 0) * Math.PI / 180;
  // axes=0: single copy. Otherwise: 2n copies — either n rotations×flip (mirror) or 2n pure rotations.
  const effectiveN = n === 0 ? 1 : (mirror ? n : n * 2);
  const effectiveMirror = n === 0 ? false : mirror;
  const segAngle = effectiveN > 0 ? (Math.PI * 2) / effectiveN : 0;
  ctx.save();
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = opacity;
  // Eraser paints with the background colour so it correctly covers previous strokes
  ctx.strokeStyle = erase ? S.bgColor : color;
  ctx.lineWidth = thickness;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  for (let i = 0; i < effectiveN; i++) {
    for (let flip = 0; flip < (effectiveMirror ? 2 : 1); flip++) {
      ctx.save();
      ctx.translate(m.cx, m.cy);
      ctx.rotate(rotRad + segAngle * i);
      if (flip === 1) ctx.scale(1, -1);
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let j = 1; j < pts.length; j++) {
        const mp = pts[j - 1], cp = pts[j];
        ctx.quadraticCurveTo(mp.x, mp.y, (mp.x + cp.x) / 2, (mp.y + cp.y) / 2);
      }
      ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
      ctx.stroke();
      ctx.restore();
    }
  }
  ctx.restore();
}

function renderLineSymmetric(ctx, m, start, end, color, thickness, opacity, mirror, axes, axisRotation) {
  const n = axes != null ? axes : m.axes;
  const rotRad = ((axisRotation != null ? axisRotation : m.axisRotation) || 0) * Math.PI / 180;
  const effectiveN = n === 0 ? 1 : (mirror ? n : n * 2);
  const effectiveMirror = n === 0 ? false : mirror;
  const segAngle = effectiveN > 0 ? (Math.PI * 2) / effectiveN : 0;
  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.strokeStyle = color;
  ctx.lineWidth = thickness;
  ctx.lineCap = 'round';

  for (let i = 0; i < effectiveN; i++) {
    for (let flip = 0; flip < (effectiveMirror ? 2 : 1); flip++) {
      ctx.save();
      ctx.translate(m.cx, m.cy);
      ctx.rotate(rotRad + segAngle * i);
      if (flip === 1) ctx.scale(1, -1);
      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(end.x, end.y);
      ctx.stroke();
      ctx.restore();
    }
  }
  ctx.restore();
}

function renderSprite(ctx, m, spr, preloadedDrawable) {
  let drawable = preloadedDrawable;
  if (!drawable) {
    const item = getPaletteItem(spr.paletteId);
    if (!item || !item.img.complete) return;
    drawable = getDrawableImage(item);
    if (!drawable) return;
  }

  const n = spr.axes != null ? spr.axes : m.axes;
  const rotRad = ((spr.axisRotation != null ? spr.axisRotation : m.axisRotation) || 0) * Math.PI / 180;
  const doMirrorFlip = n !== 0 && (spr.mirror !== false);
  const effectiveN = n === 0 ? 1 : (doMirrorFlip ? n : n * 2);
  const segAngle = (Math.PI * 2) / effectiveN;
  const iw = drawable.width || drawable.naturalWidth;
  const ih = drawable.height || drawable.naturalHeight;
  if (!iw || !ih) return;

  // Animated property overrides
  const clk = S.animClock;
  const animScale    = getAnimValue(spr, 'scale',    clk) ?? spr.scale;
  const animOpacity  = getAnimValue(spr, 'opacity',  clk) ?? (spr.opacity != null ? spr.opacity : 1);
  const animRotation = getAnimValue(spr, 'rotation', clk);
  const animOrbit    = getAnimValue(spr, 'orbit',    clk);
  const animOffsetX  = getAnimValue(spr, 'offsetX',  clk);
  const animOffsetY  = getAnimValue(spr, 'offsetY',  clk);
  const sprRotation  = animRotation != null ? animRotation * Math.PI / 180 : spr.rotation;
  const sprOrbit     = (animOrbit    != null ? animOrbit    : (spr.orbitAngle || 0)) * Math.PI / 180;
  const sprX         = animOffsetX  != null ? animOffsetX  : spr.x;
  const sprY         = animOffsetY  != null ? animOffsetY  : spr.y;

  const w = iw * animScale;
  const h = ih * animScale;

  ctx.save();
  ctx.globalAlpha = animOpacity;

  const doMirror = doMirrorFlip;
  for (let i = 0; i < effectiveN; i++) {
    for (let flip = 0; flip < (doMirror ? 2 : 1); flip++) {
    ctx.save();
    ctx.translate(m.cx, m.cy);
    ctx.rotate(rotRad + segAngle * i + sprOrbit);
    if (flip === 1) ctx.scale(1, -1);

    if (spr.warpMode) {
      // Arc-bend warp: curve the image to follow the circular arc at the sprite's
      // radial position. Image width → arc angle, image height → radial depth.
      // Axis direction (outward) = local -Y in this coordinate system.
      // Use animated values for position and scale.
      const rCenter = Math.max(10, -sprY);    // radial distance (sprY negative = outward)
      const dispW = iw * animScale;           // displayed image width
      const dispH = ih * animScale;           // displayed image height
      const halfAng = dispW / (2 * rCenter);  // half angular span of image
      const θOffset = sprX / rCenter;         // tangential shift from axis centre
      const rOuter = rCenter + dispH / 2;
      const N = Math.max(32, Math.round(dispW / 1.5)); // slices for smooth curve

      const tX = Math.max(1, spr.tileX || 1);
      const tY = Math.max(1, spr.tileY || 1);
      const tileH = dispH / tY;

      ctx.save();
      for (let si = 0; si < N; si++) {
        const t = (si + 0.5) / N;
        const θ = θOffset + (-halfAng + t * 2 * halfAng);
        const tileT = (t * tX) % 1; // cycles 0→1 tX times across width
        const srcX = spr.flipX ? Math.floor((1 - tileT) * iw) : Math.floor(tileT * iw);
        const srcW = Math.max(1, Math.ceil(iw / N));
        const sliceW = (dispW / N) * 1.5;

        ctx.save();
        ctx.rotate(θ);
        for (let ty = 0; ty < tY; ty++) {
          ctx.drawImage(drawable, srcX, 0, srcW, ih, -sliceW / 2, -rOuter + ty * tileH, sliceW, tileH);
        }
        ctx.restore();
      }
      ctx.restore();
    } else {
      // Normal: place sprite at offset, with its own rotation
      ctx.translate(sprX, sprY);
      ctx.rotate(sprRotation);
      if (spr.flipX) ctx.scale(-1, 1);
      ctx.drawImage(drawable, -w / 2, -h / 2, w, h);
    }
    ctx.restore();
    } // end flip
  }

  ctx.restore();
}

function renderGuides(m, isActive) {
  if (m.axes === 0) {
    // Free draw mode: just show center dot
    ctx.save();
    ctx.globalAlpha = isActive ? 0.6 : 0.2;
    ctx.fillStyle = MANDALA_COLORS[m.colorIdx];
    ctx.translate(m.cx, m.cy);
    ctx.beginPath();
    ctx.arc(0, 0, isActive ? 5 : 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }
  const n = m.axes;
  const rotRad = (m.axisRotation || 0) * Math.PI / 180;
  // Always show n full lines through center → 2n cells
  const segAngle = Math.PI / n;
  const lineCount = n;
  const len = Math.max(canvas.width, canvas.height);
  const col = MANDALA_COLORS[m.colorIdx];

  ctx.save();
  ctx.strokeStyle = col;
  ctx.translate(m.cx, m.cy);

  for (let i = 0; i < lineCount; i++) {
    ctx.save();
    ctx.rotate(rotRad + Math.PI / 2 + segAngle * i);
    ctx.setLineDash([6, 8]);
    ctx.lineWidth = isActive ? 1 : 0.5;
    ctx.globalAlpha = isActive ? 0.28 : 0.10;
    ctx.beginPath();
    ctx.moveTo(0, -len); ctx.lineTo(0, len);
    ctx.stroke();
    // Shorter bright tick at center
    ctx.setLineDash([]);
    ctx.lineWidth = isActive ? 1.5 : 0.8;
    ctx.globalAlpha = isActive ? 0.5 : 0.18;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, -30);
    ctx.stroke();
    ctx.restore();
  }

  // Centre dot
  ctx.setLineDash([]);
  const dotR = isActive ? 7 : 4;
  ctx.globalAlpha = isActive ? 0.85 : 0.3;
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.arc(0, 0, dotR, 0, Math.PI * 2);
  ctx.fill();

  // Move-arrow hint when Select tool is active
  if (S.tool === 'select' && isActive) {
    const a = 16; // arrow arm length
    ctx.globalAlpha = 0.7;
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1.5;
    ctx.lineCap = 'round';
    for (const [dx, dy] of [[0,-a],[0,a],[a,0],[-a,0]]) {
      ctx.beginPath();
      ctx.moveTo(dx * 0.55, dy * 0.55); // start just outside dot
      ctx.lineTo(dx, dy);
      // tiny arrowhead
      const px = -dy * 0.25, py = dx * 0.25;
      ctx.moveTo(dx, dy);
      ctx.lineTo(dx * 0.75 + px, dy * 0.75 + py);
      ctx.moveTo(dx, dy);
      ctx.lineTo(dx * 0.75 - px, dy * 0.75 - py);
      ctx.stroke();
    }
  }

  ctx.restore();
}

// ── Selection handles ────────────────────────────────────
function findSprite(id) {
  for (const m of S.mandalas) {
    const s = m.sprites.find(sp => sp.id === id);
    if (s) return { sprite: s, mandala: m };
  }
  return null;
}

function getSpriteCanvasPos(m, spr) {
  return { x: m.cx + spr.x, y: m.cy + spr.y };
}

// Returns canvas-space center of the primary warp arc copy
function warpArcCenter(spr, m) {
  const rotRad = ((spr.axisRotation != null ? spr.axisRotation : m.axisRotation) || 0) * Math.PI / 180;
  const rCenter = Math.max(10, -spr.y);
  return {
    x: m.cx + spr.x * Math.cos(rotRad) + rCenter * Math.sin(rotRad),
    y: m.cy + spr.x * Math.sin(rotRad) - rCenter * Math.cos(rotRad),
  };
}

function renderSelectionHandles() {
  const found = findSprite(S.selectedSpriteId);
  if (!found) return;
  const { sprite: spr, mandala: m } = found;
  const item = getPaletteItem(spr.paletteId);
  if (!item) return;
  const drawable = getDrawableImage(item);
  const iw = (drawable?.width || drawable?.naturalWidth || 64) * spr.scale;
  const ih = (drawable?.height || drawable?.naturalHeight || 64) * spr.scale;

  const { x: cx, y: cy } = spr.warpMode ? warpArcCenter(spr, m) : { x: m.cx + spr.x, y: m.cy + spr.y };

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(spr.warpMode ? 0 : spr.rotation);

  // Bounding box
  ctx.strokeStyle = '#7c6af0';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([4, 3]);
  ctx.globalAlpha = 0.8;
  ctx.strokeRect(-iw / 2, -ih / 2, iw, ih);
  ctx.setLineDash([]);

  // Corner handles (scale)
  const corners = [[-iw/2,-ih/2],[iw/2,-ih/2],[iw/2,ih/2],[-iw/2,ih/2]];
  for (const [hx, hy] of corners) {
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = '#7c6af0';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(hx, hy, HANDLE_RADIUS, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  // Rotation handle
  ctx.strokeStyle = '#7c6af0';
  ctx.beginPath();
  ctx.moveTo(0, -ih / 2);
  ctx.lineTo(0, -ih / 2 - 24);
  ctx.stroke();
  ctx.fillStyle = '#ffe66d';
  ctx.beginPath();
  ctx.arc(0, -ih / 2 - 24, HANDLE_RADIUS, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Center handle
  ctx.fillStyle = '#7c6af0';
  ctx.beginPath();
  ctx.arc(0, 0, HANDLE_RADIUS, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

// ── Mandala hit testing ──────────────────────────────────
function hitTestMandalaCenter(x, y) {
  // Check all mandalas, last (top) first
  for (const m of [...S.mandalas].reverse()) {
    if (!m.visible) continue;
    if (Math.hypot(x - m.cx, y - m.cy) < 16) return m;
  }
  return null;
}

// ── Hit testing ──────────────────────────────────────────
function hitTestSprites(x, y) {
  for (const m of [...S.mandalas].reverse()) {
    for (const spr of [...m.sprites].reverse()) {
      if (spriteContainsPoint(m, spr, x, y)) return { sprite: spr, mandala: m };
    }
  }
  return null;
}

function spriteContainsPoint(m, spr, wx, wy) {
  const item = getPaletteItem(spr.paletteId);
  if (!item) return false;
  const drawable = getDrawableImage(item);
  const iw = (drawable?.width || drawable?.naturalWidth || 64) * spr.scale;
  const ih = (drawable?.height || drawable?.naturalHeight || 64) * spr.scale;
  const n = m.axes;
  const segAngle = (Math.PI * 2) / n;

  for (let i = 0; i < n; i++) {
    const angle = segAngle * i;
    // Transform world point into sprite-local coords
    const dx = wx - m.cx, dy = wy - m.cy;
    const cos = Math.cos(-angle), sin = Math.sin(-angle);
    const lx = cos * dx - sin * dy;
    const ly = sin * dx + cos * dy;
    // Now subtract sprite offset and un-rotate by sprite rotation
    const dx2 = lx - spr.x, dy2 = ly - spr.y;
    const cos2 = Math.cos(-spr.rotation), sin2 = Math.sin(-spr.rotation);
    const sx = cos2 * dx2 - sin2 * dy2;
    const sy = sin2 * dx2 + cos2 * dy2;
    if (sx >= -iw/2 && sx <= iw/2 && sy >= -ih/2 && sy <= ih/2) return true;
  }
  return false;
}

function getHandleAtPoint(x, y) {
  if (!S.selectedSpriteId) return null;
  const found = findSprite(S.selectedSpriteId);
  if (!found) return null;
  const { sprite: spr, mandala: m } = found;
  const item = getPaletteItem(spr.paletteId);
  const drawable = getDrawableImage(item);
  const iw = (drawable?.width || drawable?.naturalWidth || 64) * spr.scale;
  const ih = (drawable?.height || drawable?.naturalHeight || 64) * spr.scale;
  const { x: cx, y: cy } = spr.warpMode ? warpArcCenter(spr, m) : { x: m.cx + spr.x, y: m.cy + spr.y };

  // Transform point into handle space
  const dx = x - cx, dy = y - cy;
  const rot = spr.warpMode ? 0 : spr.rotation;
  const cos = Math.cos(-rot), sin = Math.sin(-rot);
  const lx = cos * dx - sin * dy;
  const ly = sin * dx + cos * dy;

  // Rotation handle
  const rhx = 0, rhy = -ih / 2 - 24;
  if (Math.hypot(lx - rhx, ly - rhy) < HANDLE_RADIUS + 4) return 'rotate';

  // Corner handles
  const corners = { 'tl': [-iw/2,-ih/2], 'tr': [iw/2,-ih/2], 'br': [iw/2,ih/2], 'bl': [-iw/2,ih/2] };
  for (const [name, [hx, hy]] of Object.entries(corners)) {
    if (Math.hypot(lx - hx, ly - hy) < HANDLE_RADIUS + 4) return 'scale-' + name;
  }

  // Center handle
  if (Math.hypot(lx, ly) < HANDLE_RADIUS + 4) return 'move';

  // Inside bounding box = move
  if (lx >= -iw/2 && lx <= iw/2 && ly >= -ih/2 && ly <= ih/2) return 'move';

  return null;
}

// ── Tools ────────────────────────────────────────────────
function toMandalaLocal(m, wx, wy) {
  return { x: wx - m.cx, y: wy - m.cy };
}

function onMouseDown(e) {
  if (e.button !== 0) return;
  const pos = canvasPos(e);

  if (S.tool === 'eyedropper') {
    pickColor(pos.x, pos.y);
    return;
  }

  if (S.tool === 'select') {
    // 1. Check sprite transform handles first
    const handle = getHandleAtPoint(pos.x, pos.y);
    if (handle) {
      S.dragHandle = handle;
      S.dragStart = pos;
      const found = findSprite(S.selectedSpriteId);
      if (found) S.spriteDragOrigin = { ...found.sprite };
      return;
    }

    // 2. Check mandala centre drag
    const mHit = hitTestMandalaCenter(pos.x, pos.y);
    if (mHit) {
      S.dragHandle = 'mandala-move';
      S.dragMandalaId = mHit.id;
      S.dragStart = pos;
      S.mandalaOrigin = { cx: mHit.cx, cy: mHit.cy };
      // Make the dragged mandala the active one
      const idx = S.mandalas.indexOf(mHit);
      if (idx !== -1) { S.activeIdx = idx; updateMandalaList(); updateAxesDisplay(); }
      return;
    }

    // 3. Check sprite body
    const hit = hitTestSprites(pos.x, pos.y);
    if (hit) {
      S.selectedSpriteId = hit.sprite.id;
      S.dragHandle = 'move';
      S.dragStart = pos;
      S.spriteDragOrigin = { ...hit.sprite };
      updateSpriteProps();
    } else {
      S.selectedSpriteId = null;
      updateSpriteProps();
    }
    return;
  }

  if (S.tool === 'place') {
    placeSprite(pos.x, pos.y);
    return;
  }

  // Drawing tools
  const m = getActiveMandala();
  if (!m) return;
  const local = toMandalaLocal(m, pos.x, pos.y);
  S.drawing = true;
  S.pts = [local];
  if (S.tool === 'line') S.lineStart = local;
}

function onMouseMove(e) {
  const pos = canvasPos(e);
  S.mousePos = pos;
  document.getElementById('cursor-pos').textContent = `x:${Math.round(pos.x)} y:${Math.round(pos.y)}`;

  if (S.tool === 'select' && S.dragHandle && S.dragStart) {
    if (S.dragHandle === 'mandala-move') {
      const m = S.mandalas.find(x => x.id === S.dragMandalaId);
      if (m && S.mandalaOrigin) {
        m.cx = S.mandalaOrigin.cx + (pos.x - S.dragStart.x);
        m.cy = S.mandalaOrigin.cy + (pos.y - S.dragStart.y);
      }
    } else {
      handleSpriteDrag(pos);
    }
    return;
  }

  // Update cursor when hovering over the canvas in select mode
  if (S.tool === 'select' && !S.dragHandle) {
    const handle = getHandleAtPoint(pos.x, pos.y);
    const mHit = hitTestMandalaCenter(pos.x, pos.y);
    canvas.style.cursor =
      handle === 'move'   ? 'grab' :
      handle === 'rotate' ? 'crosshair' :
      handle              ? 'nwse-resize' :
      mHit                ? 'move' : 'default';
  }

  if (!S.drawing) return;
  const m = getActiveMandala();
  if (!m) return;

  const local = toMandalaLocal(m, pos.x, pos.y);

  if (S.tool === 'line') {
    let dx = local.x - S.lineStart.x, dy = local.y - S.lineStart.y;
    if (S.snapAngle) { const s = snapAngle(dx, dy); dx = s.dx; dy = s.dy; }
    S.pts = [S.lineStart, { x: S.lineStart.x + dx, y: S.lineStart.y + dy }];
  } else {
    S.pts.push(local);
  }
}

function onMouseUp(e) {
  if (S.dragHandle) {
    S.dragHandle = null;
    S.dragStart = null;
    S.spriteDragOrigin = null;
    S.dragMandalaId = null;
    S.mandalaOrigin = null;
    historySnapshot();
    return;
  }

  if (!S.drawing) return;
  S.drawing = false;

  const m = getActiveMandala();
  if (!m || S.pts.length < 2) { S.pts = []; S.lineStart = null; return; }

  historySnapshot();

  const pts = S.tool === 'brush' ? smoothPoints(S.pts, S.smooth) : S.pts;

  m.strokes.push({
    id: uid(),
    pts: pts,
    color: S.color,
    thickness: S.thickness,
    opacity: S.opacity,
    erase: S.tool === 'erase',
    axes: m.axes,
    axisRotation: m.axisRotation,
    mirror: m.mirror,
  });

  S.pts = [];
  S.lineStart = null;
}

function handleSpriteDrag(pos) {
  const found = findSprite(S.selectedSpriteId);
  if (!found) return;
  const { sprite: spr, mandala: m } = found;
  const orig = S.spriteDragOrigin;
  const dx = pos.x - S.dragStart.x;
  const dy = pos.y - S.dragStart.y;

  if (S.dragHandle === 'move') {
    spr.x = orig.x + dx;
    spr.y = orig.y + dy;
    updateSpritePropsValues(spr);
  } else if (S.dragHandle === 'rotate') {
    const { x: cx, y: cy } = spr.warpMode ? warpArcCenter(spr, m) : { x: m.cx + spr.x, y: m.cy + spr.y };
    const angle = Math.atan2(pos.y - cy, pos.x - cx);
    const origAngle = Math.atan2(S.dragStart.y - cy, S.dragStart.x - cx);
    spr.rotation = orig.rotation + (angle - origAngle);
    updateSpritePropsValues(spr);
  } else if (S.dragHandle.startsWith('scale')) {
    const item = getPaletteItem(spr.paletteId);
    const drawable = getDrawableImage(item);
    const iw = (drawable?.width || drawable?.naturalWidth || 64) * orig.scale;
    const distOrigFromCenter = Math.hypot(iw / 2, (drawable?.height || drawable?.naturalHeight || 64) * orig.scale / 2);
    const { x: cx, y: cy } = spr.warpMode ? warpArcCenter(spr, m) : { x: m.cx + spr.x, y: m.cy + spr.y };
    const dNow = Math.hypot(pos.x - cx, pos.y - cy);
    const dOrig = Math.hypot(S.dragStart.x - cx, S.dragStart.y - cy);
    if (dOrig > 5) spr.scale = Math.max(0.05, orig.scale * (dNow / dOrig));
    updateSpritePropsValues(spr);
  }
}

function placeSprite(wx, wy) {
  const item = getPaletteItem(S.selectedPaletteId);
  if (!item) { alert('Select an image from the palette first.'); return; }
  const m = getActiveMandala();
  if (!m) return;

  historySnapshot();
  // Counter-rotate click by axisRotation so sprite renders at the clicked position
  const rotRad = (m.axisRotation || 0) * Math.PI / 180;
  const dx = wx - m.cx, dy = wy - m.cy;
  const local = {
    x: dx * Math.cos(-rotRad) - dy * Math.sin(-rotRad),
    y: dx * Math.sin(-rotRad) + dy * Math.cos(-rotRad),
  };
  m.sprites.push({
    id: uid(),
    paletteId: item.id,
    x: local.x,
    y: local.y,
    rotation: 0,
    scale: canvas.width / canvas.getBoundingClientRect().width,
    opacity: 1,
    flipX: false,
    warpMode: false,
    tileX: 1,
    tileY: 1,
    orbitAngle: 0,
    axes: m.axes,
    axisRotation: m.axisRotation,
    mirror: m.mirror,
  });
  S.lastStampedId = m.sprites[m.sprites.length - 1].id;
}

function pickColor(x, y) {
  const pixel = ctx.getImageData(Math.round(x), Math.round(y), 1, 1).data;
  const hex = '#' + [pixel[0], pixel[1], pixel[2]].map(v => v.toString(16).padStart(2, '0')).join('');
  S.color = hex;
  document.getElementById('draw-color').value = hex;
  document.getElementById('color-swatch').style.background = hex;
  setTool('brush');
}

// ── UI updates ────────────────────────────────────────────
function updateMandalaList() {
  const list = document.getElementById('mandala-list');
  list.innerHTML = '';
  S.mandalas.forEach((m, i) => {
    const div = document.createElement('div');
    div.className = 'mandala-item' + (i === S.activeIdx ? ' active' : '');
    div.title = `Mandala ${i + 1} — ${m.axes} axes`;
    div.style.borderColor = i === S.activeIdx ? MANDALA_COLORS[m.colorIdx] : 'transparent';
    div.style.color = MANDALA_COLORS[m.colorIdx];
    div.innerHTML = `<span style="font-size:16px">⊛</span><span class="mandala-item-label">M${i + 1}</span>`;
    div.addEventListener('click', () => { S.activeIdx = i; updateMandalaList(); updateAxesDisplay(); });
    list.appendChild(div);
  });
}

function updateAxesDisplay() {
  const m = getActiveMandala();
  document.getElementById('axes-display').textContent = m ? (m.axes === 0 ? 'Free' : m.axes) : '—';
  const rotEl = document.getElementById('axis-rotation');
  if (rotEl && m) rotEl.value = m.axisRotation || 0;
  const mirrorEl = document.getElementById('cb-mirror');
  if (mirrorEl && m) mirrorEl.checked = m.mirror !== false;
}

function updateSpriteProps() {
  const found = S.selectedSpriteId ? findSprite(S.selectedSpriteId) : null;
  const panel = document.getElementById('sprite-props');
  if (!found) { panel.style.display = 'none'; return; }
  panel.style.display = 'flex';
  updateSpritePropsValues(found.sprite);
}

function updateSpritePropsValues(spr) {
  document.getElementById('prop-scale').value = spr.scale;
  document.getElementById('prop-scale-val').textContent = spr.scale.toFixed(2) + '×';
  const deg = Math.round(spr.rotation * 180 / Math.PI);
  document.getElementById('prop-rotation').value = deg;
  document.getElementById('prop-rotation-val').textContent = deg + '°';
  document.getElementById('prop-ox').value = Math.round(spr.x);
  document.getElementById('prop-ox-val').textContent = Math.round(spr.x);
  document.getElementById('prop-oy').value = Math.round(spr.y);
  document.getElementById('prop-oy-val').textContent = Math.round(spr.y);
  const orbit = spr.orbitAngle || 0;
  document.getElementById('prop-orbit').value = orbit;
  document.getElementById('prop-orbit-val').textContent = Math.round(orbit) + '°';
  const op = spr.opacity != null ? spr.opacity : 1;
  document.getElementById('prop-spr-opacity').value = op;
  document.getElementById('prop-spr-opacity-val').textContent = Math.round(op * 100) + '%';
  document.getElementById('prop-flip-x').checked = !!spr.flipX;
  document.getElementById('prop-warp').checked = !!spr.warpMode;
  document.getElementById('warp-options').style.display = spr.warpMode ? 'block' : 'none';
  document.getElementById('prop-tile-x').value = spr.tileX || 1;
  document.getElementById('prop-tile-y').value = spr.tileY || 1;
  // Sync anim toggles + panels
  ANIM_PROPS.forEach(({ key }) => {
    const ap = spr.anim?.[key];
    const btn = document.getElementById('anim-btn-' + key);
    const panel = document.getElementById('anim-panel-' + key);
    if (!btn || !panel) return;
    const on = ap?.enabled ?? false;
    btn.classList.toggle('active', on);
    panel.style.display = on ? 'block' : 'none';
    if (on) {
      const durEl = document.getElementById('anim-dur-' + key);
      if (durEl) durEl.value = ap.duration;
      drawTimeline(key, spr);
    }
  });
}

function renderPaletteList() {
  const list = document.getElementById('palette-list');
  list.innerHTML = '';
  S.palette.forEach(item => {
    const div = document.createElement('div');
    div.className = 'palette-item' + (item.id === S.selectedPaletteId ? ' selected' : '');
    div.dataset.id = item.id;

    const thumb = document.createElement('img');
    thumb.className = 'palette-thumb';
    thumb.src = item.dataUrl;
    thumb.alt = item.name;

    const info = document.createElement('div');
    info.className = 'palette-info';
    const name = document.createElement('div');
    name.className = 'palette-name';
    name.textContent = item.name;
    const badges = document.createElement('div');
    badges.className = 'palette-badges';
    if (item.isGif) badges.innerHTML += '<span class="badge badge-gif">GIF</span>';
    if (item.isWebP) badges.innerHTML += '<span class="badge badge-webp">WEBP</span>';
    if (item.isSpriteSheet) badges.innerHTML += '<span class="badge badge-ss">Sheet</span>';
    if (item.transparentColor) badges.innerHTML += '<span class="badge badge-trans">Trans</span>';
    if (item.cropRect) badges.innerHTML += '<span class="badge badge-crop">Crop</span>';
    info.appendChild(name);
    info.appendChild(badges);

    const del = document.createElement('button');
    del.className = 'palette-del-btn';
    del.innerHTML = '<svg width="10" height="11" viewBox="0 0 12 13" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M1 3h10M4 3V2h4v1M2 3l.8 8.5a.6.6 0 00.6.5h5.2a.6.6 0 00.6-.5L10 3M4.5 5.5v4M7.5 5.5v4"/></svg>';
    del.title = 'Remove from palette';
    del.addEventListener('click', e => { e.stopPropagation(); removePaletteItem(item.id); });

    div.appendChild(thumb);
    div.appendChild(info);
    div.appendChild(del);
    div.addEventListener('click', () => selectPaletteItem(item.id));
    list.appendChild(div);
  });
}

function selectPaletteItem(id) {
  S.selectedPaletteId = id;
  renderPaletteList();
  updatePaletteItemProps();
  setTool('place');
}

function removePaletteItem(id) {
  const idx = S.palette.findIndex(p => p.id === id);
  if (idx === -1) return;
  S.palette.splice(idx, 1);
  if (S.selectedPaletteId === id) S.selectedPaletteId = null;
  renderPaletteList();
  updatePaletteItemProps();
}

function updatePaletteItemProps() {
  const panel = document.getElementById('palette-item-props');
  const item = getPaletteItem(S.selectedPaletteId);
  if (!item) { panel.style.display = 'none'; return; }
  panel.style.display = 'block';
  document.getElementById('prop-sprite-sheet').checked = item.isSpriteSheet;
  document.getElementById('sprite-sheet-options').style.display = item.isSpriteSheet ? 'block' : 'none';
  document.getElementById('ss-cols').value = item.cols;
  document.getElementById('ss-rows').value = item.rows;
  document.getElementById('trans-tolerance').value = item.tolerance || 15;
  document.getElementById('trans-tolerance-val').textContent = item.tolerance || 15;
  if (item.isSpriteSheet) renderSpriteSheetGrid(item);
}

function renderSpriteSheetGrid(item) {
  const preview = document.getElementById('ss-grid-preview');
  const cols = parseInt(item.cols) || 4;
  const rows = parseInt(item.rows) || 4;
  const inner = document.createElement('div');
  inner.className = 'ss-grid-inner';
  inner.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
  inner.style.width = '100%';
  const total = cols * rows;
  // CSS trick: each cell shows its slice via background-position as a % offset
  // background-size = cols*100% × rows*100% scales the full image to fit
  const bgSize = `${cols * 100}% ${rows * 100}%`;
  const url = item.dataUrl || (item.img && item.img.src);
  for (let i = 0; i < total; i++) {
    const col = i % cols, row = Math.floor(i / cols);
    const pctX = cols > 1 ? (col / (cols - 1)) * 100 : 0;
    const pctY = rows > 1 ? (row / (rows - 1)) * 100 : 0;
    const cell = document.createElement('div');
    cell.className = 'ss-cell' + (i === item.selectedCell ? ' selected' : '');
    if (url) {
      cell.style.backgroundImage = `url('${url}')`;
      cell.style.setProperty('--ss-w', `${cols * 100}%`);
      cell.style.setProperty('--ss-h', `${rows * 100}%`);
      cell.style.backgroundSize = bgSize;
      cell.style.backgroundPosition = `${pctX}% ${pctY}%`;
    }
    cell.addEventListener('click', () => {
      item.selectedCell = i;
      item.processedCache = null; item._animCanvas = null;
      renderSpriteSheetGrid(item);
    });
    inner.appendChild(cell);
  }
  preview.innerHTML = '';
  preview.appendChild(inner);
}

function setTool(tool) {
  S.tool = tool;
  document.querySelectorAll('.tool-btn[data-tool]').forEach(b => {
    b.classList.toggle('active', b.dataset.tool === tool);
  });
  // Select tool cursor is dynamic (updated in onMouseMove); seed with default
  canvas.style.cursor = tool === 'erase'      ? 'none'      :
                        tool === 'eyedropper' ? 'crosshair'  :
                        tool === 'select'     ? 'default'    :
                        tool === 'place'      ? 'copy'       : 'crosshair';
  if (tool !== 'select') { S.selectedSpriteId = null; updateSpriteProps(); }
}

function updateUndoButtons() {
  document.getElementById('btn-undo').style.opacity = S.history.length ? '1' : '0.4';
  document.getElementById('btn-redo').style.opacity = S.redoStack.length ? '1' : '0.4';
}

// ── Transparency dialog ──────────────────────────────────
function openTransparencyDialog() {
  const item = getPaletteItem(S.selectedPaletteId);
  if (!item) return;

  const overlay = document.createElement('div');
  overlay.id = 'trans-overlay';
  overlay.innerHTML = `
    <div id="trans-dialog">
      <h3>Set Transparent Color</h3>
      <p style="font-size:11px;color:var(--text-dim)">Click a color in the image to make it transparent.</p>
      <canvas id="trans-canvas-preview"></canvas>
      <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:8px">
        <button class="btn" id="trans-clear">Clear Transparency</button>
        <button class="btn" id="trans-cancel">Cancel</button>
        <button class="btn" id="trans-apply" style="background:var(--accent)">Apply</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  const pc = document.getElementById('trans-canvas-preview');
  const pw = Math.min(item.img.naturalWidth, 220);
  const ph = Math.min(item.img.naturalHeight, 180);
  pc.width = pw; pc.height = ph;
  const pctx = pc.getContext('2d', { willReadFrequently: true });
  pctx.drawImage(item.img, 0, 0, pw, ph);

  let pickedColor = item.transparentColor || null;
  const tol = item.tolerance || 15;

  function redrawPreview() {
    pctx.clearRect(0, 0, pw, ph);
    // Checkerboard
    for (let y = 0; y < ph; y += 8) for (let x = 0; x < pw; x += 8)
      { pctx.fillStyle = ((x/8+y/8)%2===0) ? '#666' : '#999'; pctx.fillRect(x, y, 8, 8); }
    const scale = pw / item.img.naturalWidth;
    if (pickedColor) {
      const { r: tr, g: tg, b: tb } = hexToRgb(pickedColor);
      const t = (item.tolerance || 15) * 3;
      const off = document.createElement('canvas');
      off.width = pw; off.height = ph;
      const o2 = off.getContext('2d');
      o2.drawImage(item.img, 0, 0, pw, ph);
      const id = o2.getImageData(0, 0, pw, ph);
      const d = id.data;
      for (let i = 0; i < d.length; i += 4) {
        if (colorDist(d[i], d[i+1], d[i+2], tr, tg, tb) <= t) d[i+3] = 0;
      }
      o2.putImageData(id, 0, 0);
      pctx.drawImage(off, 0, 0);
    } else {
      pctx.drawImage(item.img, 0, 0, pw, ph);
    }
  }
  redrawPreview();

  pc.addEventListener('click', e => {
    const r = pc.getBoundingClientRect();
    const px = Math.round((e.clientX - r.left) * (pc.width / r.width));
    const py = Math.round((e.clientY - r.top) * (pc.height / r.height));
    const pctx2 = document.createElement('canvas').getContext('2d');
    pctx2.canvas.width = pw; pctx2.canvas.height = ph;
    pctx2.drawImage(item.img, 0, 0, pw, ph);
    const pixel = pctx2.getImageData(px, py, 1, 1).data;
    pickedColor = '#' + [pixel[0], pixel[1], pixel[2]].map(v => v.toString(16).padStart(2,'0')).join('');
    redrawPreview();
  });

  document.getElementById('trans-cancel').addEventListener('click', () => overlay.remove());
  document.getElementById('trans-clear').addEventListener('click', () => { pickedColor = null; redrawPreview(); });
  document.getElementById('trans-apply').addEventListener('click', () => {
    item.transparentColor = pickedColor;
    item.processedCache = null; item._animCanvas = null;
    renderPaletteList();
    updatePaletteItemProps();
    overlay.remove();
  });
}

// ── Crop dialog ──────────────────────────────────────────
function openCropDialog() {
  const item = getPaletteItem(S.selectedPaletteId);
  if (!item) return;

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal-dialog" style="min-width:460px">
      <h3>Set Crop Region</h3>
      <p style="font-size:11px;color:var(--text-dim);margin:2px 0 8px">Drag to draw crop area · drag corners to resize · drag inside to move</p>
      <canvas id="crop-canvas" style="display:block;border:1px solid var(--border);cursor:crosshair;max-width:100%"></canvas>
      <div id="crop-info" style="font-size:10px;color:var(--text-dim);margin-top:4px">Drag to select crop area</div>
      <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px">
        <button class="btn" id="crop-reset">Reset (full image)</button>
        <button class="btn" id="crop-cancel">Cancel</button>
        <button class="btn" id="crop-apply" style="background:var(--accent)">Apply Crop</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  const cropCanvas = document.getElementById('crop-canvas');
  const img = item.img;
  const iw = img.naturalWidth, ih = img.naturalHeight;
  const MAX_W = 460, MAX_H = 380;
  const scale = Math.min(MAX_W / iw, MAX_H / ih, 1);
  const dw = Math.round(iw * scale), dh = Math.round(ih * scale);
  cropCanvas.width = dw; cropCanvas.height = dh;
  const cctx = cropCanvas.getContext('2d');
  const HANDLE = 7;

  // Crop rect in display coords
  let cr = item.cropRect
    ? { x: item.cropRect.x * scale, y: item.cropRect.y * scale,
        w: item.cropRect.w * scale, h: item.cropRect.h * scale }
    : { x: 0, y: 0, w: dw, h: dh };

  let dragMode = null, dragStart = null, crAtDrag = null;

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  function getMode(mx, my) {
    const { x, y, w, h } = cr;
    const corners = [['tl',x,y],['tr',x+w,y],['bl',x,y+h],['br',x+w,y+h]];
    for (const [m, hx, hy] of corners) {
      if (Math.abs(mx - hx) < HANDLE + 3 && Math.abs(my - hy) < HANDLE + 3) return m;
    }
    if (mx >= x && mx <= x + w && my >= y && my <= y + h) return 'move';
    return 'new';
  }

  function redraw() {
    cctx.clearRect(0, 0, dw, dh);
    // Checkerboard background (shows transparency)
    for (let cy = 0; cy < dh; cy += 8) for (let cx2 = 0; cx2 < dw; cx2 += 8) {
      cctx.fillStyle = ((cx2 / 8 + cy / 8) % 2 === 0) ? '#555' : '#777';
      cctx.fillRect(cx2, cy, 8, 8);
    }
    cctx.drawImage(img, 0, 0, dw, dh);

    // Dark overlay outside crop
    const { x, y, w, h } = cr;
    cctx.fillStyle = 'rgba(0,0,0,0.55)';
    cctx.fillRect(0, 0, dw, y);
    cctx.fillRect(0, y + h, dw, dh - y - h);
    cctx.fillRect(0, y, x, h);
    cctx.fillRect(x + w, y, dw - x - w, h);

    // Crop border
    cctx.strokeStyle = 'rgba(255,255,255,0.9)';
    cctx.lineWidth = 1.5;
    cctx.setLineDash([5, 4]);
    cctx.strokeRect(x, y, w, h);
    cctx.setLineDash([]);

    // Rule-of-thirds grid
    cctx.strokeStyle = 'rgba(255,255,255,0.2)';
    cctx.lineWidth = 0.5;
    for (let i = 1; i < 3; i++) {
      cctx.beginPath(); cctx.moveTo(x + w * i / 3, y); cctx.lineTo(x + w * i / 3, y + h); cctx.stroke();
      cctx.beginPath(); cctx.moveTo(x, y + h * i / 3); cctx.lineTo(x + w, y + h * i / 3); cctx.stroke();
    }

    // Corner handles
    for (const [hx, hy] of [[x,y],[x+w,y],[x,y+h],[x+w,y+h]]) {
      cctx.fillStyle = '#fff';
      cctx.fillRect(hx - HANDLE / 2, hy - HANDLE / 2, HANDLE, HANDLE);
      cctx.strokeStyle = 'rgba(0,0,0,0.5)';
      cctx.lineWidth = 0.5;
      cctx.strokeRect(hx - HANDLE / 2, hy - HANDLE / 2, HANDLE, HANDLE);
    }

    const ix = Math.round(cr.x / scale), iy = Math.round(cr.y / scale);
    const icrW = Math.round(cr.w / scale), icrH = Math.round(cr.h / scale);
    document.getElementById('crop-info').textContent =
      `Crop: ${ix},${iy}  ${icrW}×${icrH}px   (full image: ${iw}×${ih}px)`;
  }

  function evPos(e) {
    const r = cropCanvas.getBoundingClientRect();
    return {
      x: (e.clientX - r.left) * (dw / r.width),
      y: (e.clientY - r.top) * (dh / r.height),
    };
  }

  cropCanvas.addEventListener('mousedown', e => {
    const p = evPos(e);
    dragMode = getMode(p.x, p.y);
    dragStart = p;
    crAtDrag = { ...cr };
  });

  cropCanvas.addEventListener('mousemove', e => {
    const p = evPos(e);
    const mode = getMode(p.x, p.y);
    cropCanvas.style.cursor =
      mode === 'move'             ? 'move'         :
      mode === 'tl' || mode === 'br' ? 'nwse-resize' :
      mode === 'tr' || mode === 'bl' ? 'nesw-resize' : 'crosshair';

    if (!dragMode || !dragStart) return;
    const dx = p.x - dragStart.x, dy = p.y - dragStart.y;
    const { x: ox, y: oy, w: ow, h: oh } = crAtDrag;

    if (dragMode === 'new') {
      const sx = Math.min(dragStart.x, p.x), sy = Math.min(dragStart.y, p.y);
      cr = {
        x: clamp(sx, 0, dw - 2),
        y: clamp(sy, 0, dh - 2),
        w: clamp(Math.abs(p.x - dragStart.x), 2, dw - clamp(sx, 0, dw)),
        h: clamp(Math.abs(p.y - dragStart.y), 2, dh - clamp(sy, 0, dh)),
      };
    } else if (dragMode === 'move') {
      cr = { x: clamp(ox + dx, 0, dw - ow), y: clamp(oy + dy, 0, dh - oh), w: ow, h: oh };
    } else if (dragMode === 'tl') {
      const nx = clamp(ox + dx, 0, ox + ow - 4), ny = clamp(oy + dy, 0, oy + oh - 4);
      cr = { x: nx, y: ny, w: ox + ow - nx, h: oy + oh - ny };
    } else if (dragMode === 'tr') {
      const ny = clamp(oy + dy, 0, oy + oh - 4);
      cr = { x: ox, y: ny, w: clamp(ow + dx, 4, dw - ox), h: oy + oh - ny };
    } else if (dragMode === 'bl') {
      const nx = clamp(ox + dx, 0, ox + ow - 4);
      cr = { x: nx, y: oy, w: ox + ow - nx, h: clamp(oh + dy, 4, dh - oy) };
    } else if (dragMode === 'br') {
      cr = { x: ox, y: oy, w: clamp(ow + dx, 4, dw - ox), h: clamp(oh + dy, 4, dh - oy) };
    }
    redraw();
  });

  cropCanvas.addEventListener('mouseup', () => { dragMode = null; dragStart = null; });
  cropCanvas.addEventListener('mouseleave', () => { dragMode = null; dragStart = null; });

  document.getElementById('crop-apply').addEventListener('click', () => {
    item.cropRect = {
      x: Math.round(cr.x / scale),
      y: Math.round(cr.y / scale),
      w: Math.max(1, Math.round(cr.w / scale)),
      h: Math.max(1, Math.round(cr.h / scale)),
    };
    item.processedCache = null; item._animCanvas = null;
    renderPaletteList();
    updatePaletteItemProps();
    overlay.remove();
  });

  document.getElementById('crop-reset').addEventListener('click', () => {
    item.cropRect = null;
    item.processedCache = null; item._animCanvas = null;
    renderPaletteList();
    updatePaletteItemProps();
    overlay.remove();
  });

  document.getElementById('crop-cancel').addEventListener('click', () => overlay.remove());

  redraw();
}

// ── Frame splitting ───────────────────────────────────────
function dataUrlToArrayBuffer(dataUrl) {
  const base64 = dataUrl.split(',')[1];
  const binary = atob(base64);
  const buf = new ArrayBuffer(binary.length);
  const view = new Uint8Array(buf);
  for (let i = 0; i < binary.length; i++) view[i] = binary.charCodeAt(i);
  return buf;
}

async function splitFrames() {
  const item = getPaletteItem(S.selectedPaletteId);
  if (!item) return;

  const mimeType = item.dataUrl.split(';')[0].split(':')[1] || '';
  const btn = document.getElementById('btn-split-frames');
  btn.disabled = true;
  btn.textContent = '🎞 Splitting…';

  try {
    if (mimeType === 'image/gif') {
      await splitGifFrames(item);
    } else if (mimeType === 'image/webp') {
      await splitWebPFrames(item);
    } else {
      alert(`Frame splitting supports animated GIF and animated WebP.\nThis image type is: ${mimeType || 'unknown'}`);
    }
  } finally {
    btn.disabled = false;
    btn.textContent = '🎞 Split into Frames';
  }
}

async function splitGifFrames(item) {
  if (typeof gifuct === 'undefined') {
    alert('GIF parser library failed to load — reload the page.');
    return;
  }

  const buf = dataUrlToArrayBuffer(item.dataUrl);
  const gif = gifuct.parseGIF(buf);
  const frames = gifuct.decompressFrames(gif, true);

  if (frames.length <= 1) {
    alert('Only 1 frame found — this appears to be a static GIF.');
    return;
  }

  const gw = gif.lsd.width, gh = gif.lsd.height;
  const composite = document.createElement('canvas');
  composite.width = gw; composite.height = gh;
  const cctx = composite.getContext('2d');

  let prevImageData = null;

  for (let i = 0; i < frames.length; i++) {
    const frame = frames[i];
    const prev = i > 0 ? frames[i - 1] : null;

    // Handle previous frame disposal
    if (prev) {
      if (prev.disposalType === 2) {
        cctx.clearRect(prev.dims.left, prev.dims.top, prev.dims.width, prev.dims.height);
      } else if (prev.disposalType === 3 && prevImageData) {
        cctx.putImageData(prevImageData, 0, 0);
      }
    }

    // Save state for disposal type 3
    prevImageData = cctx.getImageData(0, 0, gw, gh);

    // Composite this frame's patch onto the canvas
    const patch = document.createElement('canvas');
    patch.width = frame.dims.width; patch.height = frame.dims.height;
    patch.getContext('2d').putImageData(
      new ImageData(new Uint8ClampedArray(frame.patch.buffer), frame.dims.width, frame.dims.height), 0, 0
    );
    cctx.drawImage(patch, frame.dims.left, frame.dims.top);

    const baseName = item.name.replace(/\.gif$/i, '');
    addToPalette(`${baseName}_f${i + 1}`, composite.toDataURL('image/png'));
  }

  alert(`Split ${frames.length} frames from "${item.name}" — added to palette.`);
}

async function splitWebPFrames(item) {
  if (!window.ImageDecoder) {
    alert('Animated WebP frame splitting requires Chrome 94+ or Edge 94+.\nYour browser does not support the ImageDecoder API.');
    return;
  }

  // Convert dataUrl to Blob for ImageDecoder
  const res = await fetch(item.dataUrl);
  const blob = await res.blob();

  const decoder = new ImageDecoder({ data: blob.stream(), type: 'image/webp' });
  await decoder.tracks.ready;

  const track = decoder.tracks.selectedTrack;
  if (!track || track.frameCount <= 1) {
    alert('Only 1 frame found — this appears to be a static WebP.');
    decoder.close();
    return;
  }

  const frameCount = track.frameCount;
  for (let i = 0; i < frameCount; i++) {
    const result = await decoder.decode({ frameIndex: i });
    const bitmap = await createImageBitmap(result.image);
    const off = document.createElement('canvas');
    off.width = bitmap.width; off.height = bitmap.height;
    off.getContext('2d').drawImage(bitmap, 0, 0);
    bitmap.close();
    const baseName = item.name.replace(/\.webp$/i, '');
    addToPalette(`${baseName}_f${i + 1}`, off.toDataURL('image/png'));
  }

  decoder.close();
  alert(`Split ${frameCount} frames from "${item.name}" — added to palette.`);
}

// ── Save / Load ──────────────────────────────────────────
function saveProject() {
  const data = {
    version: 1,
    canvasW: S.canvasW,
    canvasH: S.canvasH,
    bgColor: S.bgColor,
    mandalas: S.mandalas,
    palette: S.palette.map(p => ({
      id: p.id, name: p.name, dataUrl: p.dataUrl, isGif: p.isGif, isWebP: p.isWebP,
      transparentColor: p.transparentColor, tolerance: p.tolerance,
      cropRect: p.cropRect || null,
      isSpriteSheet: p.isSpriteSheet, cols: p.cols, rows: p.rows, selectedCell: p.selectedCell,
    })),
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'mandala-project.json';
  a.click();
}

function loadProject(json) {
  try {
    const data = JSON.parse(json);
    S.bgColor = data.bgColor || '#0d0d1a';
    document.getElementById('bg-color').value = S.bgColor;
    S.canvasW = data.canvasW || 1200;
    S.canvasH = data.canvasH || 900;
    resizeCanvas(S.canvasW, S.canvasH);
    S.mandalas = data.mandalas || [];
    S.palette = [];
    S.selectedSpriteId = null;
    hiddenImgs.innerHTML = '';

    const loads = (data.palette || []).map(p => new Promise(resolve => {
      const img = document.createElement('img');
      img.src = p.dataUrl;
      img.onload = () => {
        const item = { ...p, img, processedCache: null, gifFrames: null, gifFrameIdx: 0, gifFrameTime: 0 };
        S.palette.push(item);
        hiddenImgs.appendChild(img);
        if (p.isGif) initGifAnimation(item);
        else if (p.isWebP) initWebPAnimation(item);
        resolve();
      };
      img.onerror = resolve;
    }));

    Promise.all(loads).then(() => {
      renderPaletteList();
      updateMandalaList();
      updateAxesDisplay();
      updateSpriteProps();
    });
  } catch (err) {
    alert('Failed to load project: ' + err.message);
  }
}

function exportPNG() {
  // Render once without guides
  const wasGuides = S.showGuides;
  const wasSel = S.selectedSpriteId;
  S.showGuides = false;
  S.selectedSpriteId = null;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = S.bgColor;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  for (const m of S.mandalas) { if (m.visible) renderMandala(m, true); }

  const a = document.createElement('a');
  a.href = canvas.toDataURL('image/png');
  a.download = 'mandala.png';
  a.click();

  S.showGuides = wasGuides;
  S.selectedSpriteId = wasSel;
}

function resizeCanvas(w, h) {
  S.canvasW = w; S.canvasH = h;
  canvas.width = w; canvas.height = h;
  centerCanvasView();
}

function newProject() {
  if (!confirm('Start a new project? Unsaved changes will be lost.')) return;
  S.mandalas = [];
  S.palette = [];
  S.history = [];
  S.redoStack = [];
  S.selectedSpriteId = null;
  S.selectedPaletteId = null;
  hiddenImgs.innerHTML = '';
  S.bgColor = '#0d0d1a';
  document.getElementById('bg-color').value = S.bgColor;
  addMandala();
  renderPaletteList();
  updateSpriteProps();
  updateUndoButtons();
}

function addMandala() {
  const cx = S.canvasW / 2 + (S.mandalas.length * 30);
  const cy = S.canvasH / 2 + (S.mandalas.length * 20);
  const colorIdx = S.mandalas.length % MANDALA_COLORS.length;
  S.mandalas.push(createMandala(cx, cy, 8, colorIdx));
  S.activeIdx = S.mandalas.length - 1;
  updateMandalaList();
  updateAxesDisplay();
}

// ── Event wiring ─────────────────────────────────────────
function wireEvents() {
  // Canvas events
  canvas.addEventListener('mousedown', onMouseDown);
  canvas.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('mouseup', onMouseUp);
  canvas.addEventListener('mouseleave', e => { S.mousePos = null; if (S.drawing) onMouseUp(e); });

  // Toolbar
  document.getElementById('btn-new').addEventListener('click', newProject);
  document.getElementById('btn-save').addEventListener('click', saveProject);
  document.getElementById('btn-export').addEventListener('click', exportPNG);
  document.getElementById('btn-load').addEventListener('click', () => document.getElementById('file-load').click());
  document.getElementById('file-load').addEventListener('change', e => {
    const f = e.target.files[0]; if (!f) return;
    const r = new FileReader();
    r.onload = ev => loadProject(ev.target.result);
    r.readAsText(f);
    e.target.value = '';
  });

  document.getElementById('btn-undo').addEventListener('click', undo);
  document.getElementById('btn-redo').addEventListener('click', redo);

  document.getElementById('btn-clear').addEventListener('click', () => {
    const m = getActiveMandala();
    if (!m) return;
    const total = m.strokes.length + m.sprites.length;
    if (total === 0) return;
    if (confirm(`Clear all ${total} stroke${total !== 1 ? 's' : ''} and sprite${total !== 1 ? 's' : ''} from this mandala? This cannot be undone.`)) {
      historySnapshot();
      m.strokes = [];
      m.sprites = [];
      S.selectedSpriteId = null;
      updateSpriteProps();
    }
  });

  document.getElementById('axis-rotation').addEventListener('input', e => {
    const m = getActiveMandala(); if (!m) return;
    m.axisRotation = parseFloat(e.target.value) || 0;
  });
  document.getElementById('axis-rotation').addEventListener('change', () => historySnapshot());

  function rotateAxesStep(dir) {
    const m = getActiveMandala(); if (!m) return;
    // Step by 1/4 of a cell (45°/n). Falls back to 15° for free-draw (n=0).
    const step = m.axes > 0 ? 45 / m.axes : 15;
    historySnapshot();
    m.axisRotation = ((m.axisRotation || 0) + dir * step + 360) % 360;
    const el = document.getElementById('axis-rotation');
    if (el) el.value = Math.round(m.axisRotation * 10) / 10;
  }
  document.getElementById('btn-rot-ccw').addEventListener('click', () => rotateAxesStep(-1));
  document.getElementById('btn-rot-cw').addEventListener('click',  () => rotateAxesStep(+1));

  document.getElementById('btn-add-mandala-side').addEventListener('click', addMandala);
  document.getElementById('btn-delete-mandala').addEventListener('click', () => {
    if (S.mandalas.length <= 1) return;
    const idx = S.activeIdx + 1;
    if (!confirm(`Delete Mandala ${idx}? This cannot be undone.`)) return;
    historySnapshot();
    S.mandalas.splice(S.activeIdx, 1);
    S.activeIdx = Math.min(S.activeIdx, S.mandalas.length - 1);
    updateMandalaList();
    updateAxesDisplay();
  });

  document.getElementById('btn-axes-inc').addEventListener('click', () => {
    const m = getActiveMandala(); if (!m) return;
    historySnapshot(); m.axes = Math.min(36, m.axes + 1); updateAxesDisplay();
  });
  document.getElementById('btn-axes-dec').addEventListener('click', () => {
    const m = getActiveMandala(); if (!m) return;
    historySnapshot(); m.axes = Math.max(0, m.axes - 1); updateAxesDisplay();
  });

  document.getElementById('cb-mirror').addEventListener('change', e => {
    const m = getActiveMandala(); if (!m) return;
    m.mirror = e.target.checked;
  });
  document.getElementById('cb-guides').addEventListener('change', e => { S.showGuides = e.target.checked; });
  document.getElementById('bg-color').addEventListener('input', e => { S.bgColor = e.target.value; });
  wireViewport();

  // Tool buttons
  document.querySelectorAll('.tool-btn[data-tool]').forEach(btn => {
    btn.addEventListener('click', () => setTool(btn.dataset.tool));
  });

  // Status bar
  document.getElementById('draw-color').addEventListener('input', e => {
    S.color = e.target.value;
    document.getElementById('color-swatch').style.background = e.target.value;
  });
  document.getElementById('brush-size').addEventListener('input', e => {
    S.thickness = parseInt(e.target.value);
    document.getElementById('brush-size-val').textContent = e.target.value;
  });
  document.getElementById('draw-opacity').addEventListener('input', e => {
    S.opacity = parseFloat(e.target.value);
    document.getElementById('draw-opacity-val').textContent = Math.round(e.target.value * 100) + '%';
  });
  document.getElementById('brush-smooth').addEventListener('input', e => { S.smooth = parseInt(e.target.value); });

  // Palette
  document.getElementById('btn-add-image').addEventListener('click', () => document.getElementById('image-import').click());
  document.getElementById('image-import').addEventListener('change', e => {
    Array.from(e.target.files).forEach(loadImageFromFile);
    e.target.value = '';
  });
  document.getElementById('palette-drop-zone').addEventListener('click', () => document.getElementById('image-import').click());

  const dropZone = document.getElementById('palette-drop-zone');
  dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('drag-over'); });
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
  dropZone.addEventListener('drop', e => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    Array.from(e.dataTransfer.files).forEach(f => { if (f.type.startsWith('image/')) loadImageFromFile(f); });
  });

  // Also allow dropping anywhere on canvas container
  const cc = document.getElementById('canvas-container');
  cc.addEventListener('dragover', e => e.preventDefault());
  cc.addEventListener('drop', e => {
    e.preventDefault();
    Array.from(e.dataTransfer.files).forEach(f => { if (f.type.startsWith('image/')) loadImageFromFile(f); });
  });

  // Sprite properties
  document.getElementById('prop-scale').addEventListener('input', e => {
    const found = findSprite(S.selectedSpriteId); if (!found) return;
    found.sprite.scale = parseFloat(e.target.value);
    document.getElementById('prop-scale-val').textContent = parseFloat(e.target.value).toFixed(2) + '×';
  });
  document.getElementById('prop-scale').addEventListener('change', () => historySnapshot());

  document.getElementById('prop-rotation').addEventListener('input', e => {
    const found = findSprite(S.selectedSpriteId); if (!found) return;
    found.sprite.rotation = parseInt(e.target.value) * Math.PI / 180;
    document.getElementById('prop-rotation-val').textContent = e.target.value + '°';
  });
  document.getElementById('prop-rotation').addEventListener('change', () => historySnapshot());

  document.getElementById('prop-orbit').addEventListener('input', e => {
    const found = findSprite(S.selectedSpriteId); if (!found) return;
    found.sprite.orbitAngle = parseFloat(e.target.value);
    document.getElementById('prop-orbit-val').textContent = Math.round(e.target.value) + '°';
  });
  document.getElementById('prop-orbit').addEventListener('change', () => historySnapshot());

  document.getElementById('prop-ox').addEventListener('input', e => {
    const found = findSprite(S.selectedSpriteId); if (!found) return;
    found.sprite.x = parseInt(e.target.value);
    document.getElementById('prop-ox-val').textContent = e.target.value;
  });
  document.getElementById('prop-ox').addEventListener('change', () => historySnapshot());

  document.getElementById('prop-oy').addEventListener('input', e => {
    const found = findSprite(S.selectedSpriteId); if (!found) return;
    found.sprite.y = parseInt(e.target.value);
    document.getElementById('prop-oy-val').textContent = e.target.value;
  });
  document.getElementById('prop-oy').addEventListener('change', () => historySnapshot());

  document.getElementById('prop-spr-opacity').addEventListener('input', e => {
    const found = findSprite(S.selectedSpriteId); if (!found) return;
    found.sprite.opacity = parseFloat(e.target.value);
    document.getElementById('prop-spr-opacity-val').textContent = Math.round(e.target.value * 100) + '%';
  });
  document.getElementById('prop-spr-opacity').addEventListener('change', () => historySnapshot());

  document.getElementById('prop-flip-x').addEventListener('change', e => {
    const found = findSprite(S.selectedSpriteId); if (!found) return;
    found.sprite.flipX = e.target.checked; historySnapshot();
  });
  document.getElementById('prop-warp').addEventListener('change', e => {
    const found = findSprite(S.selectedSpriteId); if (!found) return;
    found.sprite.warpMode = e.target.checked;
    document.getElementById('warp-options').style.display = e.target.checked ? 'block' : 'none';
    historySnapshot();
  });
  document.getElementById('prop-tile-x').addEventListener('input', e => {
    const found = findSprite(S.selectedSpriteId); if (!found) return;
    found.sprite.tileX = Math.max(1, parseInt(e.target.value) || 1);
  });
  document.getElementById('prop-tile-x').addEventListener('change', () => historySnapshot());
  document.getElementById('prop-tile-y').addEventListener('input', e => {
    const found = findSprite(S.selectedSpriteId); if (!found) return;
    found.sprite.tileY = Math.max(1, parseInt(e.target.value) || 1);
  });
  document.getElementById('prop-tile-y').addEventListener('change', () => historySnapshot());

  // Animation toggle buttons + duration inputs
  ANIM_PROPS.forEach(({ key, min, max }) => {
    const btn = document.getElementById('anim-btn-' + key);
    const panel = document.getElementById('anim-panel-' + key);
    const durEl = document.getElementById('anim-dur-' + key);
    if (btn) btn.addEventListener('click', () => {
      const found = findSprite(S.selectedSpriteId); if (!found) return;
      const spr = found.sprite;
      if (!spr.anim) spr.anim = {};
      if (spr.anim[key]?.enabled) {
        spr.anim[key].enabled = false;
        btn.classList.remove('active');
        panel.style.display = 'none';
      } else {
        const staticVal = key === 'scale' ? spr.scale
          : key === 'rotation' ? spr.rotation * 180 / Math.PI
          : key === 'orbit'    ? (spr.orbitAngle || 0)
          : key === 'offsetX'  ? spr.x
          : key === 'offsetY'  ? spr.y
          : key === 'opacity'  ? (spr.opacity ?? 1)
          : (min + max) / 2;
        if (!spr.anim[key]) {
          // Smart default per property
          const defaultPreset = ANIM_PRESETS[key]?.[0];
          if (defaultPreset) {
            spr.anim[key] = applyPreset(defaultPreset);
          } else {
            spr.anim[key] = defaultAnimProp(staticVal);
          }
        } else {
          spr.anim[key].enabled = true;
        }
        btn.classList.add('active');
        panel.style.display = 'block';
        if (durEl) durEl.value = spr.anim[key].duration;
        drawTimeline(key, spr);
      }
      historySnapshot();
    });
    if (durEl) durEl.addEventListener('input', e => {
      const found = findSprite(S.selectedSpriteId); if (!found) return;
      const ap = found.sprite.anim?.[key]; if (!ap) return;
      ap.duration = Math.max(0.1, parseFloat(e.target.value) || 2);
    });
    if (durEl) durEl.addEventListener('change', () => historySnapshot());

    // Easing dropdown for selected keyframe
    const easeSel = document.getElementById('anim-ease-sel-' + key);
    if (easeSel) easeSel.addEventListener('change', e => {
      const found = findSprite(S.selectedSpriteId); if (!found) return;
      const kfIdx = TL.selectedKf?.prop === key ? TL.selectedKf.kfIdx : -1;
      if (kfIdx < 0) return;
      found.sprite.anim[key].keyframes[kfIdx].easing = e.target.value;
      historySnapshot();
    });

    // Delete selected keyframe button
    const delBtn = document.getElementById('anim-kf-del-' + key);
    if (delBtn) delBtn.addEventListener('click', () => {
      const found = findSprite(S.selectedSpriteId); if (!found) return;
      const ap = found.sprite.anim?.[key]; if (!ap) return;
      const kfIdx = TL.selectedKf?.prop === key ? TL.selectedKf.kfIdx : -1;
      if (kfIdx < 0 || ap.keyframes.length <= 2) return;
      ap.keyframes.splice(kfIdx, 1);
      TL.selectedKf = null;
      syncEasingDropdown(key, found.sprite);
      historySnapshot();
    });

    // Presets dropdown
    const presetSel = document.getElementById('anim-preset-' + key);
    if (presetSel) presetSel.addEventListener('change', e => {
      const found = findSprite(S.selectedSpriteId); if (!found) return;
      const spr2 = found.sprite;
      const preset = ANIM_PRESETS[key]?.find(p => p.label === e.target.value);
      if (!preset) return;
      if (!spr2.anim) spr2.anim = {};
      spr2.anim[key] = applyPreset(preset);
      const durEl2 = document.getElementById('anim-dur-' + key);
      if (durEl2) durEl2.value = spr2.anim[key].duration;
      TL.selectedKf = null;
      drawTimeline(key, spr2);
      presetSel.value = '';
      historySnapshot();
    });

    initTimelineCanvas(key);
  });

  document.getElementById('btn-delete-sprite').addEventListener('click', () => {
    if (!S.selectedSpriteId) return;
    historySnapshot();
    for (const m of S.mandalas) {
      const idx = m.sprites.findIndex(s => s.id === S.selectedSpriteId);
      if (idx !== -1) { m.sprites.splice(idx, 1); break; }
    }
    S.selectedSpriteId = null;
    updateSpriteProps();
  });

  document.getElementById('btn-dup-sprite').addEventListener('click', () => {
    if (!S.selectedSpriteId) return;
    const found = findSprite(S.selectedSpriteId); if (!found) return;
    historySnapshot();
    const copy = { ...found.sprite, id: uid(), x: found.sprite.x + 20, y: found.sprite.y + 20 };
    found.mandala.sprites.push(copy);
    S.selectedSpriteId = copy.id;
    updateSpriteProps();
  });

  // Palette item props
  document.getElementById('btn-crop').addEventListener('click', openCropDialog);
  document.getElementById('btn-split-frames').addEventListener('click', splitFrames);
  document.getElementById('btn-transparency').addEventListener('click', openTransparencyDialog);
  document.getElementById('trans-tolerance').addEventListener('input', e => {
    const item = getPaletteItem(S.selectedPaletteId); if (!item) return;
    item.tolerance = parseInt(e.target.value);
    item.processedCache = null; item._animCanvas = null;
    document.getElementById('trans-tolerance-val').textContent = e.target.value;
  });
  document.getElementById('prop-sprite-sheet').addEventListener('change', e => {
    const item = getPaletteItem(S.selectedPaletteId); if (!item) return;
    item.isSpriteSheet = e.target.checked;
    item.processedCache = null; item._animCanvas = null;
    document.getElementById('sprite-sheet-options').style.display = e.target.checked ? 'block' : 'none';
    if (e.target.checked) renderSpriteSheetGrid(item);
    renderPaletteList();
  });
  document.getElementById('ss-cols').addEventListener('change', e => {
    const item = getPaletteItem(S.selectedPaletteId); if (!item) return;
    item.cols = Math.max(1, parseInt(e.target.value) || 1);
    item.processedCache = null; item._animCanvas = null;
    renderSpriteSheetGrid(item);
  });
  document.getElementById('ss-rows').addEventListener('change', e => {
    const item = getPaletteItem(S.selectedPaletteId); if (!item) return;
    item.rows = Math.max(1, parseInt(e.target.value) || 1);
    item.processedCache = null; item._animCanvas = null;
    renderSpriteSheetGrid(item);
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
    if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); return; }
    if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) { e.preventDefault(); redo(); return; }
    if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); saveProject(); return; }
    if (e.key === 'Escape' && S.tool === 'place') {
      setTool('select');
      if (S.lastStampedId) { S.selectedSpriteId = S.lastStampedId; updateSpriteProps(); }
      return;
    }
    const map = { b:'brush', l:'line', e:'erase', s:'select', p:'place', i:'eyedropper' };
    if (map[e.key.toLowerCase()]) setTool(map[e.key.toLowerCase()]);
    if (e.key === 'Delete' || e.key === 'Backspace') {
      if (S.selectedSpriteId) document.getElementById('btn-delete-sprite').click();
    }
    if (e.key === '[') {
      S.thickness = Math.max(1, S.thickness - 1);
      document.getElementById('brush-size').value = S.thickness;
      document.getElementById('brush-size-val').textContent = S.thickness;
    }
    if (e.key === ']') {
      S.thickness = Math.min(60, S.thickness + 1);
      document.getElementById('brush-size').value = S.thickness;
      document.getElementById('brush-size-val').textContent = S.thickness;
    }
  });
}

// ── Init ─────────────────────────────────────────────────
function init() {
  resizeCanvas(S.canvasW, S.canvasH);
  addMandala();
  wireEvents();
  updateUndoButtons();
  document.getElementById('color-swatch').style.background = S.color;
  centerCanvasView();
  requestAnimationFrame(render);
}

init();
