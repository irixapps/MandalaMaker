// ═══════════════════════════════════════════════════════
//  MANDALA MAKER — app.js
// ═══════════════════════════════════════════════════════

// ── Version ────────────────────────────────────────────
const VERSION = '1.0';

// ── Constants ──────────────────────────────────────────
const MANDALA_COLORS = ['#ff6b9d','#7c6af0','#4ecdc4','#ffe66d','#ff8b3d','#a8ff78'];
const HANDLE_RADIUS = 7;
const MAX_HISTORY = 50;

// ── Gradient presets ───────────────────────────────────
const GRADIENT_PRESETS = {
  'Rainbow':      [{pos:0,color:'#ff0000'},{pos:0.17,color:'#ff8800'},{pos:0.33,color:'#ffff00'},{pos:0.5,color:'#00ff44'},{pos:0.67,color:'#0088ff'},{pos:0.83,color:'#aa00ff'},{pos:1,color:'#ff0000'}],
  'Fire':         [{pos:0,color:'#ff0000'},{pos:0.4,color:'#ff6600'},{pos:0.7,color:'#ffcc00'},{pos:1,color:'#ff0000'}],
  'Ocean':        [{pos:0,color:'#001a4d'},{pos:0.35,color:'#0066cc'},{pos:0.65,color:'#00ccff'},{pos:1,color:'#001a4d'}],
  'Amiga Copper': [{pos:0,color:'#ff0066'},{pos:0.25,color:'#ff8800'},{pos:0.5,color:'#0000ff'},{pos:0.75,color:'#00ffff'},{pos:1,color:'#ff0066'}],
  'Neon':         [{pos:0,color:'#ff00ff'},{pos:0.33,color:'#00ffff'},{pos:0.66,color:'#ff00aa'},{pos:1,color:'#ff00ff'}],
  'Sunset':       [{pos:0,color:'#ff6600'},{pos:0.4,color:'#ff0066'},{pos:0.7,color:'#6600cc'},{pos:1,color:'#ff6600'}],
  'Ice':          [{pos:0,color:'#ffffff'},{pos:0.4,color:'#88ccff'},{pos:0.7,color:'#0044aa'},{pos:1,color:'#ffffff'}],
  'Lava':         [{pos:0,color:'#1a0000'},{pos:0.3,color:'#cc2200'},{pos:0.6,color:'#ff8800'},{pos:0.85,color:'#ffff00'},{pos:1,color:'#1a0000'}],
  'Gold':         [{pos:0,color:'#2a1a00'},{pos:0.3,color:'#cc8800'},{pos:0.5,color:'#ffd700'},{pos:0.7,color:'#cc8800'},{pos:1,color:'#2a1a00'}],
  'Acid':         [{pos:0,color:'#003300'},{pos:0.4,color:'#00ff00'},{pos:0.7,color:'#aaff00'},{pos:1,color:'#003300'}],
  'Plasma':       [{pos:0,color:'#cc00ff'},{pos:0.25,color:'#00ffff'},{pos:0.5,color:'#ff00cc'},{pos:0.75,color:'#ffff00'},{pos:1,color:'#cc00ff'}],
  'Chrome':       [{pos:0,color:'#111122'},{pos:0.25,color:'#888899'},{pos:0.5,color:'#ffffff'},{pos:0.75,color:'#888899'},{pos:1,color:'#111122'}],
  'Aurora':       [{pos:0,color:'#001a00'},{pos:0.3,color:'#00cc44'},{pos:0.55,color:'#00cccc'},{pos:0.75,color:'#4400aa'},{pos:1,color:'#001a00'}],
  'Candy':        [{pos:0,color:'#ff6ec7'},{pos:0.25,color:'#a8edff'},{pos:0.5,color:'#b066ff'},{pos:0.75,color:'#ffa8d4'},{pos:1,color:'#ff6ec7'}],
  'Infrared':     [{pos:0,color:'#0a0000'},{pos:0.4,color:'#cc0000'},{pos:0.7,color:'#ff6600'},{pos:0.85,color:'#ffff00'},{pos:1,color:'#ffffff'}],
  'Matrix':       [{pos:0,color:'#000000'},{pos:0.4,color:'#004400'},{pos:0.7,color:'#00cc00'},{pos:0.9,color:'#aaffaa'},{pos:1,color:'#000000'}],
  'Rose':         [{pos:0,color:'#3a0010'},{pos:0.35,color:'#cc2255'},{pos:0.6,color:'#ff88aa'},{pos:0.8,color:'#ffe0ec'},{pos:1,color:'#3a0010'}],
  'Hologram':     [{pos:0,color:'#ff00ff'},{pos:0.14,color:'#00ffff'},{pos:0.28,color:'#ffff00'},{pos:0.43,color:'#00ff88'},{pos:0.57,color:'#ff4400'},{pos:0.71,color:'#8800ff'},{pos:0.86,color:'#00ccff'},{pos:1,color:'#ff00ff'}],
  'Toxic':        [{pos:0,color:'#002200'},{pos:0.3,color:'#33ff00'},{pos:0.6,color:'#ccff00'},{pos:0.8,color:'#ffff44'},{pos:1,color:'#002200'}],
  'Deep Sea':     [{pos:0,color:'#000033'},{pos:0.3,color:'#003366'},{pos:0.6,color:'#006699'},{pos:0.8,color:'#00ccaa'},{pos:1,color:'#000033'}],
  'Ember':        [{pos:0,color:'#000000'},{pos:0.3,color:'#440000'},{pos:0.55,color:'#ff2200'},{pos:0.75,color:'#ff8800'},{pos:0.9,color:'#ffffaa'},{pos:1,color:'#000000'}],
};

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

  // gradient stroke
  gradientMode: true,
  gradient: {
    stops: JSON.parse(JSON.stringify(GRADIENT_PRESETS['Rainbow'])),
    scale: 400,   // pixels per full gradient cycle
    speed: 0.3,   // cycles per second
  },
  mirror: true,
  showGuides: true,
  snapAngle: false,

  // grid + axes snapping
  snapGrid: { enabled: false, x: 15, y: 15, linked: true },
  snapAxes: { enabled: false, step: 3, radial: 20 },

  // shape tool state
  shapeTool: 'circle',
  shapeParams: { sides: 6, points: 5, innerRatio: 0.45 },
  shapeFill: null,
  shapeLineCap: 'round',
  shapeLineJoin: 'round',
  shapeDash: [],
  shapeStampMode: false,

  // shape drawing transient
  shapeDragging: false,
  shapePreview: null,
  selectedShapeId: null,
  shapeHandleDrag: null,
  shapeHandleStart: null,
  shapeDragOrigin: null,

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
  animPaused: false,

  // viewport
  viewport: { zoom: 1, panX: 0, panY: 0 },
  panning: false,
  panStart: null,       // { x, y, panX, panY }
  spaceDown: false,
};

// ── DOM refs ────────────────────────────────────────────
const canvas = document.getElementById('main-canvas');
const ctx = canvas.getContext('2d', { willReadFrequently: true });
const overlayCanvas = document.getElementById('overlay-canvas');
const overlayCtx = overlayCanvas.getContext('2d');
const hiddenImgs = document.getElementById('hidden-imgs');

// ── Utilities ───────────────────────────────────────────
let _uidCounter = 0;
const uid = () => 'id' + (++_uidCounter) + '_' + Date.now();

function getActiveMandala() { return S.mandalas[S.activeIdx] || null; }

function canvasPos(e) {
  const cc = document.getElementById('canvas-container');
  const r = cc.getBoundingClientRect();
  const src = e.touches ? e.touches[0] : e;
  const { panX, panY, zoom } = S.viewport;
  return {
    x: (src.clientX - r.left - panX) / zoom,
    y: (src.clientY - r.top  - panY) / zoom,
  };
}

// Convert canvas-space point to overlay/screen-space point
function canvasToScreen(cx, cy) {
  const { panX, panY, zoom } = S.viewport;
  return { x: panX + cx * zoom, y: panY + cy * zoom };
}

function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }

function lerp(a, b, t) { return a + (b - a) * t; }

// ── Gradient colour utilities ───────────────────────────
// Pre-parse gradient stops to integer RGB for the hot render path.
// WeakMap so entries GC when the stops array is replaced.
const _parsedStopsCache = new WeakMap();
function getParsedStops(stops) {
  let p = _parsedStopsCache.get(stops);
  if (p) return p;
  p = stops.map(s => ({
    pos: s.pos,
    r: parseInt(s.color.slice(1,3), 16),
    g: parseInt(s.color.slice(3,5), 16),
    b: parseInt(s.color.slice(5,7), 16),
  }));
  _parsedStopsCache.set(stops, p);
  return p;
}

// Sample gradient: returns {r,g,b} ints — avoids any string work in the hot path.
function sampleGradientRGB(stops, t) {
  const p = getParsedStops(stops);
  if (!p.length) return { r:255, g:255, b:255 };
  if (p.length === 1) return { r:p[0].r, g:p[0].g, b:p[0].b };
  t = ((t % 1) + 1) % 1;
  for (let i = 0; i < p.length - 1; i++) {
    if (t >= p[i].pos && t < p[i+1].pos) {
      const u = (t - p[i].pos) / (p[i+1].pos - p[i].pos);
      return {
        r: (p[i].r + (p[i+1].r - p[i].r) * u + 0.5) | 0,
        g: (p[i].g + (p[i+1].g - p[i].g) * u + 0.5) | 0,
        b: (p[i].b + (p[i+1].b - p[i].b) * u + 0.5) | 0,
      };
    }
  }
  const last = p[p.length-1], first = p[0];
  const span = 1 - last.pos;
  if (span <= 0) return { r:last.r, g:last.g, b:last.b };
  const u = (t - last.pos) / span;
  return {
    r: (last.r + (first.r - last.r) * u + 0.5) | 0,
    g: (last.g + (first.g - last.g) * u + 0.5) | 0,
    b: (last.b + (first.b - last.b) * u + 0.5) | 0,
  };
}

// Hex string version kept for non-hot-path uses (gradient preview bar, etc.)
function sampleGradient(stops, t) {
  const { r, g, b } = sampleGradientRGB(stops, t);
  return '#' + [r,g,b].map(v => v.toString(16).padStart(2,'0')).join('');
}

// Render a stroke using a cycling gradient along its length.
// Called inside a ctx.save() block that has already set translate+rotate for one symmetry cell.
// dashArr: pre-scaled array (px values), e.g. [15, 10]. null = solid.
// capType: 'round' | 'butt' | 'square'. 'round' is required for smooth gradient blending on solid strokes.
// Reusable offscreen canvases for gradient-shape compositing
let _gradColorCanvas = null, _gradColorCtx = null;
let _gradMaskCanvas  = null, _gradMaskCtx  = null;
function _ensureGradOffscreen(W, H) {
  if (!_gradColorCanvas || _gradColorCanvas.width !== W || _gradColorCanvas.height !== H) {
    _gradColorCanvas = document.createElement('canvas');
    _gradColorCanvas.width = W; _gradColorCanvas.height = H;
    _gradColorCtx = _gradColorCanvas.getContext('2d');
    _gradMaskCanvas = document.createElement('canvas');
    _gradMaskCanvas.width = W; _gradMaskCanvas.height = H;
    _gradMaskCtx = _gradMaskCanvas.getContext('2d');
  }
}

// targetCtx: optional — if provided, render into that context instead of the global ctx
function renderGradientSegments(pts, grad, lineWidth, dashArr, capType, targetCtx) {
  if (pts.length < 2) return;
  const tgt = targetCtx || ctx;
  const { stops, scale, speed } = grad;
  const timeOffset = (S.animClock * speed) % 1;

  // Cumulative arc-lengths
  const lens = [0];
  for (let i = 1; i < pts.length; i++) {
    const dx = pts[i].x - pts[i-1].x, dy = pts[i].y - pts[i-1].y;
    lens.push(lens[i-1] + Math.sqrt(dx*dx + dy*dy));
  }
  const totalLen = lens[lens.length - 1];

  const cap = capType || 'round';
  tgt.lineWidth = lineWidth;
  tgt.lineCap   = cap;
  tgt.lineJoin  = 'round';

  const hasDash = dashArr && dashArr.length >= 2 && dashArr.reduce((a, b) => a + b, 0) > 0;
  const dashCycle = hasDash ? dashArr.reduce((a, b) => a + b, 0) : 0;
  const dotRadius = lineWidth / 2;

  const step = cap === 'round'
    ? Math.max(1.5, lineWidth * 0.65)
    : Math.max(0.5, lineWidth * 0.25);

  function ptAtDist(d) {
    d = Math.max(0, Math.min(totalLen, d));
    for (let i = 0; i < pts.length - 1; i++) {
      if (d <= lens[i + 1] + 1e-6) {
        const segLen = lens[i + 1] - lens[i];
        const t = segLen > 0 ? (d - lens[i]) / segLen : 0;
        return { x: pts[i].x + (pts[i+1].x - pts[i].x) * t,
                 y: pts[i].y + (pts[i+1].y - pts[i].y) * t };
      }
    }
    return pts[pts.length - 1];
  }

  const onPeriod = hasDash ? dashArr[0] : 0;
  const isDotted = hasDash && onPeriod <= step;

  if (isDotted) {
    let d = 0;
    while (d <= totalLen) {
      const { r, g, b } = sampleGradientRGB(stops, d / scale + timeOffset);
      const { x, y } = ptAtDist(d);
      tgt.beginPath();
      tgt.arc(x, y, dotRadius, 0, Math.PI * 2);
      tgt.fillStyle = `rgb(${r},${g},${b})`;
      tgt.fill();
      d += dashCycle;
    }
    return;
  }

  const COLOR_TOL = cap === 'round' ? 4 : 2;
  let prevR = -999, prevG = -999, prevB = -999, hasPath = false;
  tgt.beginPath();

  for (let i = 0; i < pts.length - 1; i++) {
    const dx = pts[i+1].x - pts[i].x, dy = pts[i+1].y - pts[i].y;
    const segLen = Math.sqrt(dx*dx + dy*dy);
    if (segLen === 0) continue;
    const steps = Math.max(1, Math.ceil(segLen / step));

    for (let s = 0; s < steps; s++) {
      const ta = s / steps, tb = (s + 1) / steps;
      const dist = lens[i] + segLen * ta;

      if (hasDash) {
        const cyclePos = dist % dashCycle;
        let cum = 0, drawing = true;
        for (let d = 0; d < dashArr.length; d++) {
          cum += dashArr[d];
          if (cyclePos < cum) { drawing = (d % 2 === 0); break; }
        }
        if (!drawing) {
          if (hasPath) { tgt.stroke(); tgt.beginPath(); hasPath = false; prevR = -999; }
          continue;
        }
      }

      const { r, g, b } = sampleGradientRGB(stops, dist / scale + timeOffset);
      const drift = Math.abs(r - prevR) + Math.abs(g - prevG) + Math.abs(b - prevB);
      if (drift > COLOR_TOL) {
        if (hasPath) tgt.stroke();
        tgt.beginPath();
        tgt.strokeStyle = `rgb(${r},${g},${b})`;
        prevR = r; prevG = g; prevB = b;
        hasPath = false;
      }

      const xa = pts[i].x + dx*ta, ya = pts[i].y + dy*ta;
      const xb = pts[i].x + dx*tb, yb = pts[i].y + dy*tb;
      tgt.moveTo(xa, ya);
      tgt.lineTo(xb, yb);
      hasPath = true;
    }
  }
  if (hasPath) tgt.stroke();
}

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
  if (S.mandalas.some(m => m.sprites.some(s => s.anim && Object.values(s.anim).some(ap => ap.enabled)))) return true;
  if (S.mandalas.some(m => (m.shapes || []).some(s => s.anim && Object.values(s.anim).some(ap => ap.enabled)))) return true;
  if (S.mandalas.some(m => m.strokes.some(s => s.gradient && s.gradient.speed > 0))) return true;
  if (S.mandalas.some(m => m.strokes.some(s => s.trailAnim?.enabled))) return true;
  return S.mandalas.some(m => (m.shapes || []).some(s => s.gradient && s.gradient.speed > 0));
}

// Computes the visible trail window [tailFrac, headFrac] (both 0..1, arc-length fractions
// of the stroke path) for a given point in the loop cycle.
// Draw phase: head sweeps 0 -> 1 while tail trails `visibleFrac` behind it (clamped to 0).
// Recede phase: head holds at 1 while tail sweeps up to close the window, then the loop repeats.
// Phase durations are weighted by distance travelled so the leading/trailing edges move at a
// constant, matched speed across both phases.
function trailWindowFrac(trailAnim, clock) {
  const duration = trailAnim.duration > 0 ? trailAnim.duration : 0.1;
  const visibleFrac = Math.max(0.02, Math.min(1, (trailAnim.lengthPct ?? 40) / 100));
  const totalTravel = 1 + visibleFrac;
  const drawPhaseFrac = 1 / totalTravel;
  const t = (clock % duration) / duration;
  const recedeStart = Math.max(0, 1 - visibleFrac);
  if (t < drawPhaseFrac) {
    const headFrac = t / drawPhaseFrac;
    return { tailFrac: Math.max(0, headFrac - visibleFrac), headFrac };
  }
  const recedeT = (t - drawPhaseFrac) / (1 - drawPhaseFrac);
  return { tailFrac: recedeStart + recedeT * (1 - recedeStart), headFrac: 1 };
}

// Walks pts from arc-distance fromD to toD (via the shared ptAtDist lookup) as one stroked path.
function _trailArcStroke(ctx, ptAtDist, fromD, toD, step) {
  if (toD <= fromD) return;
  ctx.beginPath();
  let d = fromD;
  let p = ptAtDist(d);
  ctx.moveTo(p.x, p.y);
  while (d < toD) {
    d = Math.min(d + step, toD);
    p = ptAtDist(d);
    ctx.lineTo(p.x, p.y);
  }
  ctx.stroke();
}

// Renders the visible [tailFrac, headFrac] window of `pts` across all symmetry copies, with the
// trailing 25% of that window fading from transparent to full opacity (a "fading trail" look).
function renderStrokeTrailSymmetric(ctx, m, pts, color, thickness, opacity, mirror, axes, axisRotation, tailFrac, headFrac, gradient) {
  if (pts.length < 2 || headFrac <= 0) return;
  const n = axes != null ? axes : m.axes;
  const rotRad = ((axisRotation != null ? axisRotation : m.axisRotation) || 0) * Math.PI / 180;
  const effectiveN = n === 0 ? 1 : (mirror ? n : n * 2);
  const effectiveMirror = n === 0 ? false : mirror;
  const segAngle = effectiveN > 0 ? (Math.PI * 2) / effectiveN : 0;

  const lens = [0];
  for (let i = 1; i < pts.length; i++) {
    const dx = pts[i].x - pts[i-1].x, dy = pts[i].y - pts[i-1].y;
    lens.push(lens[i-1] + Math.sqrt(dx*dx + dy*dy));
  }
  const totalLen = lens[lens.length - 1];
  if (totalLen <= 0) return;

  const tailDist = Math.max(0, Math.min(totalLen, tailFrac * totalLen));
  const headDist = Math.max(0, Math.min(totalLen, headFrac * totalLen));
  if (headDist <= tailDist) return;
  const fadeLen = (headDist - tailDist) * 0.25;
  const fadeEndDist = tailDist + fadeLen;

  function ptAtDist(d) {
    d = Math.max(0, Math.min(totalLen, d));
    for (let i = 0; i < pts.length - 1; i++) {
      if (d <= lens[i + 1] + 1e-6) {
        const segLen = lens[i + 1] - lens[i];
        const t = segLen > 0 ? (d - lens[i]) / segLen : 0;
        return { x: pts[i].x + (pts[i+1].x - pts[i].x) * t,
                 y: pts[i].y + (pts[i+1].y - pts[i].y) * t };
      }
    }
    return pts[pts.length - 1];
  }

  const solidRGB = gradient ? null : hexToRgb(color);
  const timeOffset = gradient ? (S.animClock * gradient.speed) % 1 : 0;
  const step = Math.max(1.5, thickness * 0.65); // round-cap smoothing, matches gradient arc-walk

  ctx.save();
  ctx.globalCompositeOperation = 'source-over';
  ctx.lineWidth = thickness;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  for (let i = 0; i < effectiveN; i++) {
    for (let flip = 0; flip < (effectiveMirror ? 2 : 1); flip++) {
      ctx.save();
      ctx.translate(m.cx, m.cy);
      ctx.rotate(rotRad + segAngle * i);
      if (flip === 1) ctx.scale(1, -1);

      if (gradient) {
        // Colour shifts continuously along the path, so walk the whole window in small
        // segments — alpha ramps through the fade zone, full opacity beyond it.
        let d = tailDist;
        while (d < headDist) {
          const dNext = Math.min(d + step, headDist);
          const midD = (d + dNext) / 2;
          const alpha = (fadeLen > 0.01 && midD < fadeEndDist)
            ? Math.max(0, Math.min(1, (midD - tailDist) / fadeLen)) * opacity
            : opacity;
          const { r, g, b } = sampleGradientRGB(gradient.stops, midD / gradient.scale + timeOffset);
          const p0 = ptAtDist(d), p1 = ptAtDist(dNext);
          ctx.strokeStyle = `rgba(${r},${g},${b},${alpha.toFixed(3)})`;
          ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y); ctx.stroke();
          d = dNext;
        }
      } else if (fadeLen <= 0.01) {
        const { r, g, b } = solidRGB;
        ctx.strokeStyle = `rgba(${r},${g},${b},${opacity})`;
        _trailArcStroke(ctx, ptAtDist, tailDist, headDist, step);
      } else {
        const { r, g, b } = solidRGB;
        // Fading tail: alpha ramps 0 -> opacity across [tailDist, fadeEndDist]
        let d = tailDist;
        while (d < fadeEndDist) {
          const dNext = Math.min(d + step, fadeEndDist);
          const midD = (d + dNext) / 2;
          const alpha = Math.max(0, Math.min(1, (midD - tailDist) / fadeLen)) * opacity;
          const p0 = ptAtDist(d), p1 = ptAtDist(dNext);
          ctx.strokeStyle = `rgba(${r},${g},${b},${alpha.toFixed(3)})`;
          ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y); ctx.stroke();
          d = dNext;
        }
        // Solid head: full opacity across [fadeEndDist, headDist]
        if (fadeEndDist < headDist) {
          ctx.strokeStyle = `rgba(${r},${g},${b},${opacity})`;
          _trailArcStroke(ctx, ptAtDist, fadeEndDist, headDist, step);
        }
      }
      ctx.restore();
    }
  }
  ctx.restore();
}

// Cached version — avoids scanning all mandala data every frame.
// Call flushHasAnimCache() whenever shapes/sprites/strokes/gradients change.
let _hasAnimCacheDirty = true;
let _hasAnimCacheResult = false;
function flushHasAnimCache() { _hasAnimCacheDirty = true; }
function hasAnyAnimationCached() {
  if (_hasAnimCacheDirty) {
    _hasAnimCacheResult = hasAnyAnimation();
    _hasAnimCacheDirty = false;
  }
  return _hasAnimCacheResult;
}

// Dirty flag: when false and no animation is running, skip the canvas repaint entirely.
let _renderDirty = true;
function markRenderDirty() { _renderDirty = true; }

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

// ── Shape animation props / presets ─────────────────────
const SHAPE_ANIM_PROPS = [
  { key: 'radius',    label: 'Radius',    min: 2,    max: 600, format: v => Math.round(v)+'px' },
  { key: 'thickness', label: 'Thickness', min: 1,    max: 60,  format: v => Math.round(v) },
  { key: 'opacity',   label: 'Opacity',   min: 0,    max: 1,   format: v => Math.round(v*100)+'%' },
  { key: 'rotation',  label: 'Rotation',  min: -360, max: 360, format: v => Math.round(v)+'°' },
  { key: 'orbit',     label: 'Orbit',     min: -180, max: 180, format: v => Math.round(v)+'°' },
  { key: 'offsetX',   label: 'Offset X',  min: -500, max: 500, format: v => Math.round(v) },
  { key: 'offsetY',   label: 'Offset Y',  min: -500, max: 500, format: v => Math.round(v) },
];

const SHAPE_ANIM_PRESETS = {
  radius:    [
    { label: 'Pulse',   kfs: [{t:0,v:50,e:'ease'},{t:0.5,v:100,e:'ease'},{t:1,v:50,e:'ease'}], dur: 2 },
    { label: 'Breathe', kfs: [{t:0,v:60,e:'ease-in'},{t:0.5,v:90,e:'ease-out'},{t:1,v:60,e:'ease-in'}], dur: 4 },
    { label: 'Shrink',  kfs: [{t:0,v:150,e:'ease'},{t:1,v:20,e:'ease'}], dur: 3 },
  ],
  thickness: [
    { label: 'Pulse',   kfs: [{t:0,v:2,e:'ease'},{t:0.5,v:12,e:'ease'},{t:1,v:2,e:'ease'}], dur: 2 },
    { label: 'Breathe', kfs: [{t:0,v:3,e:'ease-in'},{t:0.5,v:8,e:'ease-out'},{t:1,v:3,e:'ease-in'}], dur: 3 },
  ],
  opacity:   [
    { label: 'Fade In/Out', kfs: [{t:0,v:1,e:'ease'},{t:0.5,v:0.1,e:'ease'},{t:1,v:1,e:'ease'}], dur: 2 },
    { label: 'Flicker',     kfs: [{t:0,v:1,e:'linear'},{t:0.45,v:1,e:'linear'},{t:0.5,v:0,e:'linear'},{t:0.55,v:1,e:'linear'},{t:1,v:1,e:'linear'}], dur: 1.5 },
    { label: 'Appear',      kfs: [{t:0,v:0,e:'ease-out'},{t:0.4,v:1,e:'linear'},{t:1,v:1,e:'linear'}], dur: 2 },
  ],
  rotation:  [
    { label: 'Spin CW',  kfs: [{t:0,v:-180,e:'linear'},{t:1,v:180,e:'linear'}], dur: 3 },
    { label: 'Spin CCW', kfs: [{t:0,v:180,e:'linear'},{t:1,v:-180,e:'linear'}], dur: 3 },
    { label: 'Rock',     kfs: [{t:0,v:-30,e:'ease'},{t:0.5,v:30,e:'ease'},{t:1,v:-30,e:'ease'}], dur: 2 },
    { label: 'Wobble',   kfs: [{t:0,v:-10,e:'ease'},{t:0.25,v:10,e:'ease'},{t:0.5,v:-10,e:'ease'},{t:0.75,v:10,e:'ease'},{t:1,v:-10,e:'ease'}], dur: 1 },
  ],
  orbit:     [
    { label: 'Orbit CW',  kfs: [{t:0,v:-180,e:'linear'},{t:1,v:180,e:'linear'}], dur: 4 },
    { label: 'Orbit CCW', kfs: [{t:0,v:180,e:'linear'},{t:1,v:-180,e:'linear'}], dur: 4 },
    { label: 'Swing',     kfs: [{t:0,v:-45,e:'ease'},{t:0.5,v:45,e:'ease'},{t:1,v:-45,e:'ease'}], dur: 3 },
  ],
  // Offset X = tangential (side-to-side, perpendicular to axis)
  offsetX:   [
    { label: 'Arc Swing',  kfs: [{t:0,v:-60,e:'ease'},{t:0.5,v:60,e:'ease'},{t:1,v:-60,e:'ease'}], dur: 2 },
    { label: 'Drift',      kfs: [{t:0,v:-80,e:'ease'},{t:1,v:80,e:'ease'}], dur: 3 },
    { label: 'Shimmer',    kfs: [{t:0,v:-20,e:'ease'},{t:0.25,v:20,e:'ease'},{t:0.5,v:-20,e:'ease'},{t:0.75,v:20,e:'ease'},{t:1,v:-20,e:'ease'}], dur: 1.5 },
  ],
  // Offset Y = radial (in/out along the axis — negative = further from center)
  offsetY:   [
    { label: 'Oscillate',     kfs: [{t:0,v:-60,e:'ease'},{t:0.5,v:-200,e:'ease'},{t:1,v:-60,e:'ease'}], dur: 3 },
    { label: 'Pulse Out',     kfs: [{t:0,v:-100,e:'ease'},{t:0.5,v:-280,e:'ease'},{t:1,v:-100,e:'ease'}], dur: 2 },
    { label: 'Breathe',       kfs: [{t:0,v:-80,e:'ease-in'},{t:0.5,v:-160,e:'ease-out'},{t:1,v:-80,e:'ease-in'}], dur: 4 },
    { label: 'Approach',      kfs: [{t:0,v:-250,e:'ease'},{t:0.5,v:-40,e:'ease'},{t:1,v:-250,e:'ease'}], dur: 3 },
  ],
};

const STL = { dragging: null, selectedKf: null };  // shape timeline interaction state

// ── Timeline canvas ──────────────────────────────────────
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

// Shared drawing core for both sprite and shape timelines
function drawTimelineOn(canvasEl, propCfg, ap, selectedKfForProp) {
  if (!canvasEl || !propCfg || !ap) return;
  const c = canvasEl.getContext('2d');
  const W = canvasEl.width, H = canvasEl.height;
  const PAD = { l: 6, r: 6, t: 8, b: 8 };
  const iW = W - PAD.l - PAD.r, iH = H - PAD.t - PAD.b;
  const vMin = propCfg.min, vMax = propCfg.max;
  const tx = t => PAD.l + t * iW;
  const vy = v => PAD.t + (1 - (v - vMin) / (vMax - vMin)) * iH;
  const kfs = ap.keyframes;

  c.clearRect(0, 0, W, H);
  c.fillStyle = '#08081a'; c.fillRect(0, 0, W, H);

  c.strokeStyle = '#1c1c38'; c.lineWidth = 1;
  [0.25, 0.5, 0.75].forEach(t => { c.beginPath(); c.moveTo(tx(t), PAD.t); c.lineTo(tx(t), H - PAD.b); c.stroke(); });
  const mid = (vMin + vMax) / 2;
  c.beginPath(); c.moveTo(PAD.l, vy(mid)); c.lineTo(W - PAD.r, vy(mid)); c.stroke();

  if (kfs.length >= 2) {
    // Loop-match: first and last keyframe share the same value (seamless loop)
    const first = kfs[0], last = kfs[kfs.length - 1];
    const vRange = vMax - vMin;
    const isLoopMatch = Math.abs(first.value - last.value) / (vRange || 1) < 0.01;
    if (isLoopMatch) {
      const ly = vy(first.value);
      c.save();
      c.strokeStyle = 'rgba(255,255,255,0.18)';
      c.lineWidth = 1;
      c.setLineDash([4, 4]);
      c.beginPath(); c.moveTo(tx(first.t), ly); c.lineTo(tx(last.t), ly); c.stroke();
      c.setLineDash([]);
      c.restore();
    }

    c.strokeStyle = isLoopMatch ? '#ffffff' : '#7c6af0'; c.lineWidth = 2; c.beginPath();
    const STEPS = 150;
    for (let i = 0; i <= STEPS; i++) {
      const t = kfs[0].t + (i / STEPS) * (kfs[kfs.length-1].t - kfs[0].t);
      const v = animValueAtT(ap, t);
      i === 0 ? c.moveTo(tx(t), vy(v)) : c.lineTo(tx(t), vy(v));
    }
    c.stroke();
  }

  c.font = '8px sans-serif'; c.fillStyle = '#5060a0'; c.textAlign = 'center';
  for (let i = 0; i < kfs.length - 1; i++) {
    const mx = tx((kfs[i].t + kfs[i+1].t) / 2);
    const my = vy((kfs[i].value + kfs[i+1].value) / 2);
    c.fillText(kfs[i].easing, mx, Math.max(PAD.t + 8, Math.min(H - PAD.b - 2, my - 6)));
  }

  kfs.forEach((kf, idx) => {
    const x = tx(kf.t), y = vy(kf.value);
    const isSel = selectedKfForProp?.kfIdx === idx;
    c.beginPath(); c.arc(x, y, isSel ? 7 : 5.5, 0, Math.PI * 2);
    c.fillStyle = isSel ? '#ff6b9d' : '#7c6af0'; c.fill();
    c.strokeStyle = '#ffffff'; c.lineWidth = isSel ? 2 : 1.5; c.stroke();
  });

  const playT = (S.animClock % ap.duration) / ap.duration;
  c.strokeStyle = '#ff6b9d'; c.lineWidth = 1.5; c.setLineDash([3, 2]);
  c.beginPath(); c.moveTo(tx(playT), PAD.t); c.lineTo(tx(playT), H - PAD.b); c.stroke();
  c.setLineDash([]);
}

function drawTimeline(prop, spr) {
  const el = tlCanvasEl(prop); if (!el || !spr?.anim?.[prop]) return;
  const cfg = ANIM_PROPS.find(p => p.key === prop);
  const selKf = TL.selectedKf?.prop === prop ? TL.selectedKf : null;
  drawTimelineOn(el, cfg, spr.anim[prop], selKf);
}

// ── Shape timeline functions ─────────────────────────────
function shaTlCanvasEl(prop) { return document.getElementById('sa-tl-' + prop); }
function shaEntity() { const f = findSelectedShape(); return f ? f.shape : null; }

function shaTlCoords(canvasEl, prop) {
  const W = canvasEl.width, H = canvasEl.height;
  const PAD = { l: 6, r: 6, t: 8, b: 8 };
  const iW = W - PAD.l - PAD.r, iH = H - PAD.t - PAD.b;
  const cfg = SHAPE_ANIM_PROPS.find(p => p.key === prop);
  const vMin = cfg.min, vMax = cfg.max;
  return {
    W, H, PAD, iW, iH,
    tx: t  => PAD.l + t * iW,
    vy: v  => PAD.t + (1 - (v - vMin) / (vMax - vMin)) * iH,
    tv: px => Math.max(0, Math.min(1, (px - PAD.l) / iW)),
    yv: py => vMin + (1 - (py - PAD.t) / iH) * (vMax - vMin),
  };
}

function drawShapeTimeline(prop, shape) {
  const el = shaTlCanvasEl(prop); if (!el || !shape?.anim?.[prop]) return;
  const cfg = SHAPE_ANIM_PROPS.find(p => p.key === prop);
  const selKf = STL.selectedKf?.prop === prop ? STL.selectedKf : null;
  drawTimelineOn(el, cfg, shape.anim[prop], selKf);
}

function refreshAllShapeTimelines() {
  const shape = shaEntity(); if (!shape) return;
  SHAPE_ANIM_PROPS.forEach(({ key }) => drawShapeTimeline(key, shape));
}

function shaNearestKf(el, prop, px, py, radius = 14) {
  const shape = shaEntity(); const ap = shape?.anim?.[prop]; if (!ap) return -1;
  const { tx, vy } = shaTlCoords(el, prop);
  let best = -1, bestD = radius;
  ap.keyframes.forEach((kf, i) => {
    const d = Math.hypot(tx(kf.t) - px, vy(kf.value) - py);
    if (d < bestD) { bestD = d; best = i; }
  });
  return best;
}

function syncShapeEasingDropdown(prop, shape) {
  const sel = document.getElementById('sa-ease-sel-' + prop);
  const row = document.getElementById('sa-kf-row-' + prop);
  if (!sel || !row) return;
  const kfIdx = STL.selectedKf?.prop === prop ? STL.selectedKf.kfIdx : -1;
  if (kfIdx < 0 || !shape?.anim?.[prop]) { row.style.display = 'none'; return; }
  const kfs = shape.anim[prop].keyframes;
  const hasNext = kfIdx < kfs.length - 1;
  row.style.display = hasNext ? 'flex' : 'none';
  if (hasNext) sel.value = kfs[kfIdx].easing;
  const delBtn = document.getElementById('sa-kf-del-' + prop);
  if (delBtn) {
    const canDel = kfIdx > 0 && kfIdx < kfs.length - 1 && kfs.length > 2;
    delBtn.style.display = canDel ? '' : 'none';
  }
}

function initShapeTimelineCanvas(prop) {
  const el = shaTlCanvasEl(prop); if (!el) return;
  el.addEventListener('mousedown', e => {
    e.preventDefault();
    const rect = el.getBoundingClientRect();
    const scaleX = el.width / rect.width;
    const px = (e.clientX - rect.left) * scaleX;
    const py = (e.clientY - rect.top) * scaleX;
    const shape = shaEntity(); if (!shape?.anim?.[prop]) return;
    if (e.button === 2) {
      const idx = shaNearestKf(el, prop, px, py);
      if (idx >= 0 && shape.anim[prop].keyframes.length > 2) { shape.anim[prop].keyframes.splice(idx, 1); historySnapshot(); }
      return;
    }
    const kfIdx = shaNearestKf(el, prop, px, py);
    if (kfIdx >= 0) {
      STL.dragging = { prop, kfIdx }; STL.selectedKf = { prop, kfIdx };
      syncShapeEasingDropdown(prop, shape); return;
    }
    STL.selectedKf = null; syncShapeEasingDropdown(prop, shape);
    const { tv, yv } = shaTlCoords(el, prop);
    const cfg = SHAPE_ANIM_PROPS.find(p => p.key === prop);
    const t = tv(px), v = Math.max(cfg.min, Math.min(cfg.max, yv(py)));
    const kfs = shape.anim[prop].keyframes;
    const prevKf = kfs.filter(k => k.t < t).pop();
    kfs.push({ t, value: v, easing: prevKf?.easing ?? 'linear' });
    kfs.sort((a, b) => a.t - b.t);
    historySnapshot();
  });
  window.addEventListener('mousemove', e => {
    if (!STL.dragging || STL.dragging.prop !== prop) return;
    const rect = el.getBoundingClientRect();
    const scaleX = el.width / rect.width, scaleY = el.height / rect.height;
    const px = (e.clientX - rect.left) * scaleX;
    const py = (e.clientY - rect.top) * scaleY;
    const shape = shaEntity(); if (!shape?.anim?.[prop]) return;
    const { tv, yv } = shaTlCoords(el, prop);
    const cfg = SHAPE_ANIM_PROPS.find(p => p.key === prop);
    const kfs = shape.anim[prop].keyframes;
    const kf = kfs[STL.dragging.kfIdx];
    kf.t = Math.max(0, Math.min(1, tv(px)));
    kf.value = Math.max(cfg.min, Math.min(cfg.max, yv(py)));
    kfs.sort((a, b) => a.t - b.t);
    STL.dragging.kfIdx = kfs.indexOf(kf);
  });
  window.addEventListener('mouseup', () => {
    if (STL.dragging?.prop === prop) {
      const shape = shaEntity();
      if (STL.selectedKf?.prop === prop && shape?.anim?.[prop])
        STL.selectedKf.kfIdx = Math.min(STL.selectedKf.kfIdx, shape.anim[prop].keyframes.length - 1);
      syncShapeEasingDropdown(prop, shape);
      STL.dragging = null; historySnapshot();
    }
  });
  el.addEventListener('contextmenu', e => e.preventDefault());
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
  const snap = JSON.stringify(S.mandalas);
  S.history.push(snap);
  S.redoStack = [];
  if (S.history.length > MAX_HISTORY) S.history.shift();
  updateUndoButtons();
  markRenderDirty();
  flushHasAnimCache();
}

function restoreSnapshot(snap) {
  S.mandalas = JSON.parse(snap);
  S.selectedSpriteId = null;
  invalidateStrokeCache();
  updateMandalaList();
  updateSpriteProps();
}

function undo() {
  if (!S.history.length) return;
  S.redoStack.push(JSON.stringify(S.mandalas));
  restoreSnapshot(S.history.pop());
  updateUndoButtons();
}

function redo() {
  if (!S.redoStack.length) return;
  S.history.push(JSON.stringify(S.mandalas));
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
  markRenderDirty();
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

function sizeOverlay() {
  const cc = document.getElementById('canvas-container');
  overlayCanvas.width  = cc.clientWidth;
  overlayCanvas.height = cc.clientHeight;
}

function wireViewport() {
  const cc = document.getElementById('canvas-container');

  // Keep overlay sized to container
  const ro = new ResizeObserver(sizeOverlay);
  ro.observe(cc);

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
    shapes: [],
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

// ── Stroke cache (offscreen canvas for solid strokes) ────
// Re-renders only when strokes/BG change; gradient strokes + sprites
// are always rendered live on top.
let _strokeCache = null;
let _strokeCacheDirty = true;
// Reusable proxy object for renderShapeSymmetric — avoids per-frame allocation.
const _shapeProxy = {};

function invalidateStrokeCache() { _strokeCacheDirty = true; markRenderDirty(); flushHasAnimCache(); }

function rebuildStrokeCache() {
  if (!_strokeCache || _strokeCache.width !== canvas.width || _strokeCache.height !== canvas.height) {
    _strokeCache = document.createElement('canvas');
    _strokeCache.width  = canvas.width;
    _strokeCache.height = canvas.height;
  }
  const cc = _strokeCache.getContext('2d');
  cc.clearRect(0, 0, canvas.width, canvas.height);
  cc.fillStyle = S.bgColor;
  cc.fillRect(0, 0, canvas.width, canvas.height);

  for (const m of S.mandalas) {
    if (!m.visible) continue;
    for (const stroke of m.strokes) {
      if (stroke.pts.length < 2 || stroke.gradient || stroke.trailAnim?.enabled || stroke.visible === false) continue; // skip gradient/trail — rendered live
      const axes = stroke.axes != null ? stroke.axes : m.axes;
      const rot  = stroke.axisRotation != null ? stroke.axisRotation : m.axisRotation;
      // Use the offscreen ctx, not the main ctx
      const savedCtx = ctx;
      // Temporarily rebind renderStrokeSymmetric to use cc
      renderStrokeSymmetricTo(cc, m, stroke.pts, stroke.color, stroke.thickness, stroke.opacity, stroke.erase, stroke.mirror !== false, axes, rot, null);
    }
  }
  _strokeCacheDirty = false;
}

// ── Rendering ────────────────────────────────────────────
function render(timestamp) {
  S.rafId = requestAnimationFrame(render);
  const dt = S.lastTime ? Math.min((timestamp - S.lastTime) / 1000, 0.1) : 0;
  S.lastTime = timestamp;

  const animating = hasAnyAnimationCached();

  // Skip repaint entirely when nothing has changed and there's no animation.
  // Mouse-move with place/erase/draw tools marks dirty via their own handlers.
  if (!animating && !_renderDirty) return;
  _renderDirty = false;

  if (animating) {
    if (!S.animPaused) S.animClock += dt;
    // Only redraw timeline canvases when the panel is actually visible.
    if (document.getElementById('anim-panel-scale')?.offsetParent !== null ||
        document.getElementById('sa-anim-panel-radius')?.offsetParent !== null) {
      refreshAllTimelines();
      refreshAllShapeTimelines();
    }
  }

  // Composite cached solid strokes (rebuilds if dirty)
  if (_strokeCacheDirty) rebuildStrokeCache();
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(_strokeCache, 0, 0);

  // Grid overlay
  if (S.snapGrid.enabled) renderGridOverlay();

  // Live layer: gradient strokes + sprites for all mandalas
  for (const m of S.mandalas) {
    if (!m.visible) continue;
    renderMandalaLive(m);
  }

  // Current stroke preview
  if (S.drawing && S.pts.length > 1) {
    const m = getActiveMandala();
    const liveGrad = (S.gradientMode && S.tool !== 'erase') ? S.gradient : null;
    if (m) renderStrokeSymmetric(ctx, m, S.pts, S.color, S.thickness, S.opacity, S.tool === 'erase', m.mirror !== false, m.axes, m.axisRotation, liveGrad);
  }
  if (S.drawing && S.tool === 'line' && S.lineStart && S.pts.length > 0) {
    const m = getActiveMandala();
    if (m) {
      const last = S.pts[S.pts.length - 1];
      const liveGrad = S.gradientMode ? S.gradient : null;
      renderLineSymmetric(ctx, m, S.lineStart, last, S.color, S.thickness, S.opacity, m.mirror !== false, m.axes, m.axisRotation, liveGrad);
    }
  }

  // Shape preview while dragging
  if (S.shapeDragging && S.shapePreview && S.shapePreview.r > 0) {
    const m = getActiveMandala();
    if (m) {
      ctx.save(); ctx.globalAlpha = 0.55;
      renderShapeSymmetric(ctx, m, S.shapePreview);
      ctx.restore();
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
        const defaultScale = canvas.width / canvas.getBoundingClientRect().width;
        const ghostSpr = { x: lx, y: ly, rotation: 0, scale: item.stampScale ?? defaultScale, opacity: 1, flipX: false, warpMode: false, axes: m.axes, axisRotation: m.axisRotation, mirror: m.mirror };
        renderSprite(ctx, m, ghostSpr, drawable);
        ctx.globalAlpha = prevAlpha;
      }
    }
  }

  // Guides + snap overlays
  if (S.showGuides) {
    for (const m of S.mandalas) {
      if (!m.visible) continue;
      renderGuides(m, m === getActiveMandala());
    }
  }
  if (S.snapAxes.enabled) {
    for (const m of S.mandalas) {
      if (m.visible) renderSnapAxisDots(m, m === getActiveMandala());
    }
  }

  // Layers panel hover highlight
  renderLayerHoverHighlight();

  // Selection handles
  if (S.selectedSpriteId && S.tool === 'select') {
    renderSelectionHandles();
  }
  if (S.selectedShapeId && S.tool === 'select') {
    renderShapeSelectionHandles();
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

  renderOverlay();
}

function spriteCanvasCenter(spr, m) {
  if (spr.warpMode) return warpArcCenter(spr, m);
  return { x: m.cx + spr.x, y: m.cy + spr.y };
}

// Returns the actual canvas position of the primary (i=0) copy of a sprite,
// accounting for animated orbit, offsetX/Y — matching the render transform chain.
function spriteAnimatedCenter(spr, m) {
  if (spr.warpMode) return warpArcCenter(spr, m);
  const clk = S.animClock;
  const rotRad  = ((spr.axisRotation != null ? spr.axisRotation : m.axisRotation) || 0) * Math.PI / 180;
  const sprOrbit = (getAnimValue(spr, 'orbit', clk) ?? (spr.orbitAngle || 0)) * Math.PI / 180;
  const sprX    = getAnimValue(spr, 'offsetX', clk) ?? spr.x;
  const sprY    = getAnimValue(spr, 'offsetY', clk) ?? spr.y;
  const angle   = rotRad + sprOrbit;
  return {
    x: m.cx + Math.cos(angle) * sprX - Math.sin(angle) * sprY,
    y: m.cy + Math.sin(angle) * sprX + Math.cos(angle) * sprY,
  };
}

// Animated version of shapeWorldCenter — accounts for orbit and animated offsetX/Y.
function shapeAnimatedWorldCenter(m, shape) {
  const clk = S.animClock;
  const rotRad = ((shape.axisRotation != null ? shape.axisRotation : m.axisRotation) || 0) * Math.PI / 180;
  const orbit  = (getAnimValue(shape, 'orbit', clk) ?? (shape.orbit || 0)) * Math.PI / 180;
  const ox = getAnimValue(shape, 'offsetX', clk) ?? shape.x;
  const oy = getAnimValue(shape, 'offsetY', clk) ?? shape.y;
  const angle = rotRad + orbit;
  return {
    x: m.cx + Math.cos(angle) * ox - Math.sin(angle) * oy,
    y: m.cy + Math.sin(angle) * ox + Math.cos(angle) * oy,
  };
}

function isSpriteOffCanvas(spr, m) {
  const { x, y } = spriteCanvasCenter(spr, m);
  const margin = 60;
  return x < -margin || x > S.canvasW + margin || y < -margin || y > S.canvasH + margin;
}

// Clamp a screen position to within the overlay canvas with padding.
// Returns { x, y, clamped: bool }
function clampToOverlay(sx, sy, pad = 24) {
  const ow = overlayCanvas.width, oh = overlayCanvas.height;
  const cx = Math.max(pad, Math.min(ow - pad, sx));
  const cy = Math.max(pad, Math.min(oh - pad, sy));
  return { x: cx, y: cy, clamped: Math.abs(cx - sx) > 0.5 || Math.abs(cy - sy) > 0.5 };
}

function drawOverlayEdgeIndicator(sx, sy, trueSx, trueSy, color, label) {
  // Draw at clamped position an arrow pointing toward the true off-screen position
  const ang = Math.atan2(trueSy - sy, trueSx - sx);
  const r = 16;
  overlayCtx.save();
  overlayCtx.translate(sx, sy);
  overlayCtx.globalAlpha = 0.85;
  overlayCtx.fillStyle = color;
  overlayCtx.beginPath();
  overlayCtx.arc(0, 0, r, 0, Math.PI * 2);
  overlayCtx.fill();
  overlayCtx.strokeStyle = '#fff';
  overlayCtx.lineWidth = 1.5;
  overlayCtx.stroke();
  // Arrow
  overlayCtx.strokeStyle = '#fff';
  overlayCtx.lineWidth = 2;
  overlayCtx.beginPath();
  overlayCtx.moveTo(0, 0);
  const al = r - 4;
  overlayCtx.lineTo(Math.cos(ang) * al, Math.sin(ang) * al);
  overlayCtx.lineTo(Math.cos(ang - 0.5) * (al - 5), Math.sin(ang - 0.5) * (al - 5));
  overlayCtx.moveTo(Math.cos(ang) * al, Math.sin(ang) * al);
  overlayCtx.lineTo(Math.cos(ang + 0.5) * (al - 5), Math.sin(ang + 0.5) * (al - 5));
  overlayCtx.stroke();
  if (label) {
    overlayCtx.fillStyle = '#fff';
    overlayCtx.font = 'bold 9px sans-serif';
    overlayCtx.textAlign = 'center';
    overlayCtx.textBaseline = 'bottom';
    overlayCtx.fillText(label, 0, -r - 2);
  }
  overlayCtx.restore();
}

function drawOverlayGhost(sx, sy, iw, ih, rot, drawable, isSelected, mandalaColor) {
  overlayCtx.save();
  overlayCtx.translate(sx, sy);
  overlayCtx.rotate(rot);

  // Semi-transparent image or colour block
  overlayCtx.globalAlpha = 0.35;
  if (drawable && drawable.width) {
    overlayCtx.drawImage(drawable, -iw / 2, -ih / 2, iw, ih);
  } else {
    overlayCtx.fillStyle = mandalaColor || '#7c6af0';
    overlayCtx.fillRect(-iw / 2, -ih / 2, iw, ih);
  }

  // Dashed border
  overlayCtx.globalAlpha = isSelected ? 1 : 0.7;
  overlayCtx.strokeStyle = isSelected ? '#fff' : '#7c6af0';
  overlayCtx.lineWidth = isSelected ? 2 : 1.5;
  overlayCtx.setLineDash([5, 3]);
  overlayCtx.strokeRect(-iw / 2, -ih / 2, iw, ih);
  overlayCtx.setLineDash([]);

  overlayCtx.restore();
}

function drawOverlayHandles(sx, sy, iw, ih, rot) {
  const hr = HANDLE_RADIUS;
  overlayCtx.save();
  overlayCtx.translate(sx, sy);
  overlayCtx.rotate(rot);
  overlayCtx.globalAlpha = 1;

  overlayCtx.strokeStyle = '#7c6af0';
  overlayCtx.lineWidth = 1.5;
  overlayCtx.setLineDash([4, 3]);
  overlayCtx.strokeRect(-iw / 2, -ih / 2, iw, ih);
  overlayCtx.setLineDash([]);

  for (const [hx, hy] of [[-iw/2,-ih/2],[iw/2,-ih/2],[iw/2,ih/2],[-iw/2,ih/2]]) {
    overlayCtx.fillStyle = '#fff'; overlayCtx.strokeStyle = '#7c6af0'; overlayCtx.lineWidth = 1.5;
    overlayCtx.beginPath(); overlayCtx.arc(hx, hy, hr, 0, Math.PI * 2); overlayCtx.fill(); overlayCtx.stroke();
  }
  overlayCtx.strokeStyle = '#7c6af0'; overlayCtx.lineWidth = 1.5;
  overlayCtx.beginPath(); overlayCtx.moveTo(0, -ih/2); overlayCtx.lineTo(0, -ih/2-24); overlayCtx.stroke();
  overlayCtx.fillStyle = '#ffe66d'; overlayCtx.beginPath(); overlayCtx.arc(0, -ih/2-24, hr, 0, Math.PI*2); overlayCtx.fill(); overlayCtx.stroke();
  overlayCtx.fillStyle = '#7c6af0'; overlayCtx.beginPath(); overlayCtx.arc(0, 0, hr, 0, Math.PI*2); overlayCtx.fill();

  overlayCtx.restore();
}

function renderOverlay() {
  overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);

  const { panX, panY, zoom } = S.viewport;
  const activeMandala = getActiveMandala();

  // ── Off-canvas sprites ───────────────────────────────────
  for (const m of S.mandalas) {
    if (!m.visible) continue;
    for (const spr of m.sprites) {
      if (!isSpriteOffCanvas(spr, m)) continue;

      const { x: canX, y: canY } = spriteCanvasCenter(spr, m);
      const trueSx = panX + canX * zoom;
      const trueSy = panY + canY * zoom;
      const { x: sx, y: sy, clamped } = clampToOverlay(trueSx, trueSy);

      const item = getPaletteItem(spr.paletteId);
      const drawable = item ? getDrawableImage(item) : null;
      const imgW = drawable ? (drawable.width || drawable.naturalWidth || 64) : 64;
      const imgH = drawable ? (drawable.height || drawable.naturalHeight || 64) : 64;
      const iw = Math.max(32, imgW * spr.scale * zoom);
      const ih = Math.max(32, imgH * spr.scale * zoom);
      const isSelected = spr.id === S.selectedSpriteId;
      const rot = spr.warpMode ? 0 : spr.rotation;

      if (clamped) {
        drawOverlayEdgeIndicator(sx, sy, trueSx, trueSy, m.color || '#7c6af0', isSelected ? '●' : null);
      } else {
        drawOverlayGhost(sx, sy, iw, ih, rot, drawable, isSelected, m.color);
        if (isSelected && S.tool === 'select') {
          drawOverlayHandles(sx, sy, iw, ih, rot);
        }
      }
    }
  }

  // ── Off-canvas mandala centres ───────────────────────────
  for (const m of S.mandalas) {
    if (!m.visible) continue;
    const margin = 20;
    const offX = m.cx < -margin || m.cx > S.canvasW + margin;
    const offY = m.cy < -margin || m.cy > S.canvasH + margin;
    if (!offX && !offY) continue;

    const trueSx = panX + m.cx * zoom;
    const trueSy = panY + m.cy * zoom;
    const { x: sx, y: sy, clamped } = clampToOverlay(trueSx, trueSy);
    const isActive = m === activeMandala;
    const color = m.color || '#7c6af0';

    if (clamped) {
      drawOverlayEdgeIndicator(sx, sy, trueSx, trueSy, color, isActive ? '⊕' : null);
    } else {
      // Draw a cross/circle at the mandala centre position
      overlayCtx.save();
      overlayCtx.translate(sx, sy);
      overlayCtx.globalAlpha = 0.9;
      overlayCtx.strokeStyle = color;
      overlayCtx.fillStyle = color;
      overlayCtx.lineWidth = 1.5;
      const r = isActive ? 10 : 7;
      overlayCtx.beginPath(); overlayCtx.arc(0, 0, r, 0, Math.PI * 2); overlayCtx.fill();
      overlayCtx.globalAlpha = 0.5;
      overlayCtx.strokeStyle = '#fff'; overlayCtx.lineWidth = 1;
      overlayCtx.beginPath(); overlayCtx.arc(0, 0, r, 0, Math.PI * 2); overlayCtx.stroke();
      // crosshair lines
      overlayCtx.strokeStyle = '#fff'; overlayCtx.lineWidth = 1;
      overlayCtx.beginPath();
      overlayCtx.moveTo(-r - 4, 0); overlayCtx.lineTo(r + 4, 0);
      overlayCtx.moveTo(0, -r - 4); overlayCtx.lineTo(0, r + 4);
      overlayCtx.stroke();
      overlayCtx.restore();
    }
  }
}

// Full render — used by GIF/WebP export (no cache)
function renderMandala(m, forExport) {
  for (const stroke of m.strokes) {
    if (stroke.pts.length < 2 || stroke.visible === false) continue;
    const axes = stroke.axes != null ? stroke.axes : m.axes;
    const rot  = stroke.axisRotation != null ? stroke.axisRotation : m.axisRotation;
    if (stroke.trailAnim?.enabled) {
      const { tailFrac, headFrac } = trailWindowFrac(stroke.trailAnim, S.animClock);
      renderStrokeTrailSymmetric(ctx, m, stroke.pts, stroke.erase ? S.bgColor : stroke.color, stroke.thickness, stroke.opacity, stroke.mirror !== false, axes, rot, tailFrac, headFrac, stroke.erase ? null : stroke.gradient);
      continue;
    }
    renderStrokeSymmetric(ctx, m, stroke.pts, stroke.color, stroke.thickness, stroke.opacity, stroke.erase, stroke.mirror !== false, axes, rot, stroke.gradient || null);
  }
  for (const shape of (m.shapes || [])) { if (shape.visible !== false) renderShapeSymmetric(ctx, m, shape); }
  for (const spr of m.sprites) { if (spr.visible !== false) renderSprite(ctx, m, spr); }
}

// Live render — gradient/trail strokes + shapes + sprites (static solid strokes come from cache)
function renderMandalaLive(m) {
  for (const stroke of m.strokes) {
    if (stroke.pts.length < 2 || stroke.visible === false) continue;
    const isTrail = !!stroke.trailAnim?.enabled;
    if (!stroke.gradient && !isTrail) continue; // static — already in cache
    const axes = stroke.axes != null ? stroke.axes : m.axes;
    const rot  = stroke.axisRotation != null ? stroke.axisRotation : m.axisRotation;
    if (isTrail) {
      const { tailFrac, headFrac } = trailWindowFrac(stroke.trailAnim, S.animClock);
      renderStrokeTrailSymmetric(ctx, m, stroke.pts, stroke.erase ? S.bgColor : stroke.color, stroke.thickness, stroke.opacity, stroke.mirror !== false, axes, rot, tailFrac, headFrac, stroke.erase ? null : stroke.gradient);
      continue;
    }
    renderStrokeSymmetric(ctx, m, stroke.pts, stroke.color, stroke.thickness, stroke.opacity, stroke.erase, stroke.mirror !== false, axes, rot, stroke.gradient || null);
  }
  for (const shape of (m.shapes || [])) { if (shape.visible !== false) renderShapeSymmetric(ctx, m, shape); }
  for (const spr of m.sprites) { if (spr.visible !== false) renderSprite(ctx, m, spr); }
}

// Renders a stroke into an arbitrary 2D context (used by stroke cache builder)
function renderStrokeSymmetricTo(tgt, m, pts, color, thickness, opacity, erase, mirror, axes, axisRotation, gradient) {
  const n = (axes != null ? axes : m.axes);
  const rotRad = ((axisRotation != null ? axisRotation : m.axisRotation) || 0) * Math.PI / 180;
  const effectiveN = n === 0 ? 1 : (mirror ? n : n * 2);
  const effectiveMirror = n === 0 ? false : mirror;
  const segAngle = effectiveN > 0 ? (Math.PI * 2) / effectiveN : 0;
  tgt.save();
  tgt.globalCompositeOperation = 'source-over';
  tgt.globalAlpha = opacity;
  tgt.strokeStyle = erase ? S.bgColor : color;
  tgt.lineWidth = thickness;
  tgt.lineCap = 'round';
  tgt.lineJoin = 'round';
  for (let i = 0; i < effectiveN; i++) {
    for (let flip = 0; flip < (effectiveMirror ? 2 : 1); flip++) {
      tgt.save();
      tgt.translate(m.cx, m.cy);
      tgt.rotate(rotRad + segAngle * i);
      if (flip === 1) tgt.scale(1, -1);
      tgt.beginPath();
      tgt.moveTo(pts[0].x, pts[0].y);
      for (let j = 1; j < pts.length; j++) {
        const mp = pts[j-1], cp = pts[j];
        tgt.quadraticCurveTo(mp.x, mp.y, (mp.x+cp.x)/2, (mp.y+cp.y)/2);
      }
      tgt.lineTo(pts[pts.length-1].x, pts[pts.length-1].y);
      tgt.stroke();
      tgt.restore();
    }
  }
  tgt.restore();
}

function renderStrokeSymmetric(ctx, m, pts, color, thickness, opacity, erase, mirror, axes, axisRotation, gradient) {
  const n = (axes != null ? axes : m.axes);
  const rotRad = ((axisRotation != null ? axisRotation : m.axisRotation) || 0) * Math.PI / 180;
  const effectiveN = n === 0 ? 1 : (mirror ? n : n * 2);
  const effectiveMirror = n === 0 ? false : mirror;
  const segAngle = effectiveN > 0 ? (Math.PI * 2) / effectiveN : 0;
  ctx.save();
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = opacity;

  for (let i = 0; i < effectiveN; i++) {
    for (let flip = 0; flip < (effectiveMirror ? 2 : 1); flip++) {
      ctx.save();
      ctx.translate(m.cx, m.cy);
      ctx.rotate(rotRad + segAngle * i);
      if (flip === 1) ctx.scale(1, -1);

      if (gradient && !erase) {
        renderGradientSegments(pts, gradient, thickness);
      } else {
        ctx.strokeStyle = erase ? S.bgColor : color;
        ctx.lineWidth = thickness;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let j = 1; j < pts.length; j++) {
          const mp = pts[j - 1], cp = pts[j];
          ctx.quadraticCurveTo(mp.x, mp.y, (mp.x + cp.x) / 2, (mp.y + cp.y) / 2);
        }
        ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
        ctx.stroke();
      }
      ctx.restore();
    }
  }
  ctx.restore();
}

function renderLineSymmetric(ctx, m, start, end, color, thickness, opacity, mirror, axes, axisRotation, gradient) {
  const n = axes != null ? axes : m.axes;
  const rotRad = ((axisRotation != null ? axisRotation : m.axisRotation) || 0) * Math.PI / 180;
  const effectiveN = n === 0 ? 1 : (mirror ? n : n * 2);
  const effectiveMirror = n === 0 ? false : mirror;
  const segAngle = effectiveN > 0 ? (Math.PI * 2) / effectiveN : 0;
  ctx.save();
  ctx.globalAlpha = opacity;

  for (let i = 0; i < effectiveN; i++) {
    for (let flip = 0; flip < (effectiveMirror ? 2 : 1); flip++) {
      ctx.save();
      ctx.translate(m.cx, m.cy);
      ctx.rotate(rotRad + segAngle * i);
      if (flip === 1) ctx.scale(1, -1);
      if (gradient) {
        renderGradientSegments([start, end], gradient, thickness);
      } else {
        ctx.strokeStyle = color;
        ctx.lineWidth = thickness;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(start.x, start.y);
        ctx.lineTo(end.x, end.y);
        ctx.stroke();
      }
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

  // Use animated values to match what the renderer actually draws
  const clk = S.animClock;
  const animScale    = getAnimValue(spr, 'scale',    clk) ?? spr.scale;
  const animRotation = getAnimValue(spr, 'rotation', clk);
  const sprRotation  = animRotation != null ? animRotation * Math.PI / 180 : spr.rotation;
  const iw = (drawable?.width || drawable?.naturalWidth || 64) * animScale;
  const ih = (drawable?.height || drawable?.naturalHeight || 64) * animScale;

  const { x: cx, y: cy } = spriteAnimatedCenter(spr, m);

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(spr.warpMode ? 0 : sprRotation);

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
  const clk = S.animClock;
  const animScale    = getAnimValue(spr, 'scale',    clk) ?? spr.scale;
  const animRotation = getAnimValue(spr, 'rotation', clk);
  const sprRotation  = animRotation != null ? animRotation * Math.PI / 180 : spr.rotation;
  const iw = (drawable?.width || drawable?.naturalWidth || 64) * animScale;
  const ih = (drawable?.height || drawable?.naturalHeight || 64) * animScale;
  const { x: cx, y: cy } = spriteAnimatedCenter(spr, m);

  // Transform point into handle space
  const dx = x - cx, dy = y - cy;
  const rot = spr.warpMode ? 0 : sprRotation;
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

// ── Snap helpers ─────────────────────────────────────────
function applySnap(cx, cy, m) {
  let x = cx, y = cy;
  if (S.snapGrid.enabled) {
    const gx = S.snapGrid.x || 20, gy = S.snapGrid.y || 20;
    x = Math.round(x / gx) * gx;
    y = Math.round(y / gy) * gy;
  }
  if (S.snapAxes.enabled && m && m.axes > 0) {
    const lx = x - m.cx, ly = y - m.cy;
    const dist = Math.hypot(lx, ly);
    if (dist > 8) {
      const step = S.snapAxes.step || 1;
      const radial = S.snapAxes.radial || 40;
      const angleStep = Math.PI / (m.axes * step);
      const rotRad = (m.axisRotation || 0) * Math.PI / 180;
      const angle = Math.atan2(ly, lx);
      // Snap to nearest ray angle
      const nearestAngle = Math.round((angle - rotRad) / angleStep) * angleStep + rotRad;
      // Snap to nearest radial ring
      const nearestDist = Math.round(dist / radial) * radial;
      const snapDist = nearestDist > 0 ? nearestDist : dist;
      const sx = m.cx + Math.cos(nearestAngle) * snapDist;
      const sy = m.cy + Math.sin(nearestAngle) * snapDist;
      if (Math.hypot(x - sx, y - sy) < 20) { x = sx; y = sy; }
    }
  }
  return { x, y };
}

function renderGridOverlay() {
  const gx = S.snapGrid.x || 20, gy = S.snapGrid.y || 20;
  const w = canvas.width, h = canvas.height;
  ctx.save();
  ctx.strokeStyle = 'rgba(124,106,240,0.14)';
  ctx.lineWidth = 1;
  for (let x = 0; x <= w; x += gx) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,h); ctx.stroke(); }
  for (let y = 0; y <= h; y += gy) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(w,y); ctx.stroke(); }
  ctx.restore();
}

// ── Snap-dot Worker ──────────────────────────────────────
// Renders the axes dot pattern on a background thread so the main thread
// never blocks. Main thread always draws the latest available ImageBitmap
// (stale bitmap shown while a new one is being computed).
const _snapWorker = (() => {
  const code = `
self.onmessage = function(e) {
  const { id, axes, axisRotation, colorIdx, step, spacing, W, H, cx, cy, isActive, colors } = e.data;
  const col  = colors[colorIdx % colors.length];
  const off  = new OffscreenCanvas(W, H);
  const oc   = off.getContext('2d');
  const maxR = Math.hypot(W, H) * 0.75;
  const totalHalfRays = axes * 2 * step;
  const angleStep     = Math.PI / (axes * step);
  const rotRad        = axisRotation * Math.PI / 180;
  const DOT_R         = isActive ? 2 : 1.5;

  oc.translate(cx, cy);

  if (step > 1) {
    oc.strokeStyle = col;
    oc.lineWidth   = 0.7;
    oc.setLineDash([3, 8]);
    oc.globalAlpha = isActive ? 0.18 : 0.08;
    oc.beginPath();
    for (let i = 0; i < totalHalfRays; i++) {
      if (i % step === 0) continue;
      const a = rotRad + Math.PI / 2 + angleStep * i;
      const cos = Math.cos(a), sin = Math.sin(a);
      oc.moveTo(cos * -maxR, sin * -maxR);
      oc.lineTo(cos *  maxR, sin *  maxR);
    }
    oc.stroke();
    oc.setLineDash([]);
  }

  oc.fillStyle   = col;
  oc.globalAlpha = isActive ? 0.45 : 0.18;
  oc.beginPath();
  for (let i = 0; i < totalHalfRays; i++) {
    const a = rotRad + Math.PI / 2 + angleStep * i;
    const cos = Math.cos(a), sin = Math.sin(a);
    for (let r = spacing; r <= maxR; r += spacing) {
      oc.moveTo(cos * r + DOT_R, sin * r);
      oc.arc(cos * r, sin * r, DOT_R, 0, Math.PI * 2);
    }
  }
  oc.fill();

  const bitmap = off.transferToImageBitmap();
  self.postMessage({ id, bitmap }, [bitmap]);
};
`;
  try {
    const blob = new Blob([code], { type: 'application/javascript' });
    return new Worker(URL.createObjectURL(blob));
  } catch(e) { return null; }
})();

// _snapDotCache: m → { bitmap: ImageBitmap|null, key: string, pending: string|null }
const _snapDotCache = new WeakMap();
let   _snapWorkerSeq = 0; // monotonic request id — only the latest response is used

if (_snapWorker) {
  _snapWorker.onmessage = ({ data: { id, bitmap } }) => {
    // Find which mandala this response belongs to and apply only if still current
    for (const m of S.mandalas) {
      const entry = _snapDotCache.get(m);
      if (entry && entry.pendingId === id) {
        if (entry.bitmap) entry.bitmap.close(); // release previous GPU texture
        entry.bitmap    = bitmap;
        entry.key       = entry.pendingKey;
        entry.pendingId = null;
        markRenderDirty();
        break;
      }
    }
  };
}

function _snapDotRequestWorker(m, cacheKey, step, spacing, isActive) {
  let entry = _snapDotCache.get(m);
  if (!entry) { entry = { bitmap: null, key: '', pendingId: null, pendingKey: '' }; _snapDotCache.set(m, entry); }
  if (entry.pendingKey === cacheKey) return; // already in-flight
  entry.pendingKey = cacheKey;
  entry.pendingId  = ++_snapWorkerSeq;
  _snapWorker.postMessage({
    id: entry.pendingId, axes: m.axes, axisRotation: m.axisRotation || 0,
    colorIdx: m.colorIdx, step, spacing,
    W: canvas.width, H: canvas.height, cx: m.cx, cy: m.cy,
    isActive, colors: MANDALA_COLORS,
  });
}

// Synchronous fallback (used when Worker unavailable)
function _snapDotSync(m, cacheKey, step, spacing, isActive) {
  let entry = _snapDotCache.get(m);
  const W = canvas.width, H = canvas.height;
  if (!entry || !entry.off || entry.off.width !== W || entry.off.height !== H) {
    const off = document.createElement('canvas');
    off.width = W; off.height = H;
    entry = { off, oc: off.getContext('2d'), key: '', bitmap: null };
    _snapDotCache.set(m, entry);
  }
  if (entry.key === cacheKey) return;
  const { oc } = entry;
  oc.clearRect(0, 0, W, H);
  const maxR = Math.hypot(W, H) * 0.75;
  const totalHalfRays = m.axes * 2 * step;
  const angleStep = Math.PI / (m.axes * step);
  const rotRad = (m.axisRotation || 0) * Math.PI / 180;
  const col = MANDALA_COLORS[m.colorIdx];
  const DOT_R = isActive ? 2 : 1.5;
  oc.save(); oc.translate(m.cx, m.cy);
  if (step > 1) {
    oc.strokeStyle = col; oc.lineWidth = 0.7; oc.setLineDash([3, 8]);
    oc.globalAlpha = isActive ? 0.18 : 0.08; oc.beginPath();
    for (let i = 0; i < totalHalfRays; i++) {
      if (i % step === 0) continue;
      const a = rotRad + Math.PI / 2 + angleStep * i;
      const cos = Math.cos(a), sin = Math.sin(a);
      oc.moveTo(cos * -maxR, sin * -maxR); oc.lineTo(cos * maxR, sin * maxR);
    }
    oc.stroke(); oc.setLineDash([]);
  }
  oc.fillStyle = col; oc.globalAlpha = isActive ? 0.45 : 0.18; oc.beginPath();
  for (let i = 0; i < totalHalfRays; i++) {
    const a = rotRad + Math.PI / 2 + angleStep * i;
    const cos = Math.cos(a), sin = Math.sin(a);
    for (let r = spacing; r <= maxR; r += spacing) {
      oc.moveTo(cos * r + DOT_R, sin * r); oc.arc(cos * r, sin * r, DOT_R, 0, Math.PI * 2);
    }
  }
  oc.fill(); oc.restore();
  entry.key = cacheKey;
}

function renderSnapAxisDots(m, isActive) {
  if (m.axes === 0) return;
  const step    = S.snapAxes.step || 1;
  const spacing = S.snapAxes.radial || 20;
  const cacheKey = `${m.axes},${m.axisRotation},${m.colorIdx},${step},${spacing},${canvas.width},${canvas.height},${isActive ? 1 : 0},${m.cx},${m.cy}`;

  if (_snapWorker) {
    const entry = _snapDotCache.get(m);
    if (!entry || entry.key !== cacheKey) _snapDotRequestWorker(m, cacheKey, step, spacing, isActive);
    const bmp = _snapDotCache.get(m)?.bitmap;
    if (bmp) ctx.drawImage(bmp, 0, 0);
  } else {
    _snapDotSync(m, cacheKey, step, spacing, isActive);
    const entry = _snapDotCache.get(m);
    if (entry?.off) ctx.drawImage(entry.off, 0, 0);
  }
}

// ── Shape system ─────────────────────────────────────────
// Convert shape outline to point array (for gradient rendering via arc-length)
function getShapePoints(shape) {
  const r = Math.max(1, shape.r);
  const pts = [];
  if (shape.type === 'circle') {
    const N = Math.max(48, Math.round(r * 0.8));
    for (let i = 0; i <= N; i++) {
      const a = (i / N) * Math.PI * 2;
      pts.push({ x: Math.cos(a) * r, y: Math.sin(a) * r });
    }
  } else if (shape.type === 'star') {
    const numPts = (shape.params && shape.params.points) || 5;
    const inner = r * ((shape.params && shape.params.innerRatio) || 0.45);
    for (let i = 0; i <= numPts * 2; i++) {
      const ri = (i % 2 === 0) ? r : inner;
      const a = i * Math.PI / numPts - Math.PI / 2;
      pts.push({ x: Math.cos(a) * ri, y: Math.sin(a) * ri });
    }
  } else if (shape.type === 'polygon') {
    const sides = (shape.params && shape.params.sides) || 6;
    for (let i = 0; i <= sides; i++) {
      const a = (i % sides) * Math.PI * 2 / sides - Math.PI / 2;
      pts.push({ x: Math.cos(a) * r, y: Math.sin(a) * r });
    }
  }
  return pts;
}

// Cache Path2D objects per shape — rebuilds only when geometry changes.
const _path2DCache = new Map(); // shapeId → {r, type, p0, p1, path}
function evictPath2DCache(shapeId) { _path2DCache.delete(shapeId); }

function getShapePath2D(shape) {
  const r   = Math.max(1, shape.r);
  const p0  = shape.params?.points ?? shape.params?.sides ?? 0;
  const p1  = shape.params?.innerRatio ?? 0;
  const cached = _path2DCache.get(shape.id);
  if (cached && cached.r === r && cached.type === shape.type && cached.p0 === p0 && cached.p1 === p1) {
    return cached.path;
  }

  const p = new Path2D();
  if (shape.type === 'circle') {
    p.arc(0, 0, r, 0, Math.PI * 2);
  } else if (shape.type === 'star') {
    const pts   = p0 || 5;
    const inner = r * (p1 || 0.45);
    for (let i = 0; i < pts * 2; i++) {
      const ri = (i % 2 === 0) ? r : inner;
      const a  = i * Math.PI / pts - Math.PI / 2;
      if (i === 0) p.moveTo(Math.cos(a)*ri, Math.sin(a)*ri);
      else         p.lineTo(Math.cos(a)*ri, Math.sin(a)*ri);
    }
    p.closePath();
  } else if (shape.type === 'polygon') {
    const sides = p0 || 6;
    for (let i = 0; i < sides; i++) {
      const a = i * Math.PI * 2 / sides - Math.PI / 2;
      if (i === 0) p.moveTo(Math.cos(a)*r, Math.sin(a)*r);
      else         p.lineTo(Math.cos(a)*r, Math.sin(a)*r);
    }
    p.closePath();
  }

  _path2DCache.set(shape.id, { r, type: shape.type, p0, p1, path: p });
  return p;
}

function renderShapeInContext(tCtx, shape) {
  const path = getShapePath2D(shape);
  tCtx.save();
  tCtx.globalAlpha = shape.opacity || 1;
  tCtx.lineCap = shape.lineCap || 'round';
  tCtx.lineJoin = shape.lineJoin || 'round';
  // Scale dash pattern relative to line thickness so it stays proportional
  const t = shape.thickness || 1;
  tCtx.setLineDash((shape.dash || []).map(v => v * t));

  // Fill (always use Path2D)
  if (shape.fill) { tCtx.fillStyle = shape.fill; tCtx.fill(path); }

  // Stroke
  if (shape.gradient && tCtx === ctx) {
    const pts        = getShapePoints(shape);
    const scaledDash = (shape.dash && shape.dash.length) ? shape.dash.map(v => v * t) : null;
    const lineCap    = shape.lineCap  || 'round';
    const lineJoin   = shape.lineJoin || 'round';
    const needsComposite = lineJoin !== 'round' || (lineCap !== 'round' && scaledDash);

    if (pts.length > 1) {
      if (needsComposite) {
        // Composite approach: render gradient colours to a temp canvas, then
        // mask with a native stroke (correct lineCap/lineJoin/dash) via destination-in.
        const W = canvas.width, H = canvas.height;
        _ensureGradOffscreen(W, H);
        const xf = ctx.getTransform();

        // 1. Draw gradient arc-walk into colour canvas
        _gradColorCtx.clearRect(0, 0, W, H);
        _gradColorCtx.setTransform(xf);
        renderGradientSegments(pts, shape.gradient, shape.thickness, null, 'round', _gradColorCtx);
        _gradColorCtx.setTransform(1, 0, 0, 1, 0, 0);

        // 2. Draw native stroke (correct cap/join/dash) as white mask
        _gradMaskCtx.clearRect(0, 0, W, H);
        _gradMaskCtx.setTransform(xf);
        _gradMaskCtx.lineWidth  = shape.thickness;
        _gradMaskCtx.lineCap    = lineCap;
        _gradMaskCtx.lineJoin   = lineJoin;
        _gradMaskCtx.setLineDash(scaledDash || []);
        _gradMaskCtx.strokeStyle = '#fff';
        _gradMaskCtx.stroke(path);
        _gradMaskCtx.setLineDash([]);
        _gradMaskCtx.setTransform(1, 0, 0, 1, 0, 0);

        // 3. Clip gradient colours to the stroke mask
        _gradColorCtx.globalCompositeOperation = 'destination-in';
        _gradColorCtx.drawImage(_gradMaskCanvas, 0, 0);
        _gradColorCtx.globalCompositeOperation = 'source-over';

        // 4. Blit to main canvas (bypass current transform — already baked in)
        ctx.save();
        ctx.resetTransform();
        ctx.globalAlpha = shape.opacity || 1;
        ctx.drawImage(_gradColorCanvas, 0, 0);
        ctx.restore();
      } else {
        renderGradientSegments(pts, shape.gradient, shape.thickness, scaledDash, lineCap);
      }
    }
  } else {
    tCtx.strokeStyle = shape.color;
    tCtx.lineWidth = shape.thickness;
    tCtx.stroke(path);
  }
  tCtx.restore();
}

function renderShapeSymmetric(tCtx, m, shape) {
  // Resolve animated property values — no object spread, just local vars.
  const clk = S.animClock;
  const animR       = getAnimValue(shape, 'radius',    clk);
  const animThick   = getAnimValue(shape, 'thickness', clk);
  const animOp      = getAnimValue(shape, 'opacity',   clk);
  const animRot     = getAnimValue(shape, 'rotation',  clk);
  const animOrbit   = getAnimValue(shape, 'orbit',     clk);
  const animOffX    = getAnimValue(shape, 'offsetX',   clk);
  const animOffY    = getAnimValue(shape, 'offsetY',   clk);

  // Mutate a reused proxy object instead of allocating a new one each frame.
  _shapeProxy.id        = shape.id;
  _shapeProxy.type      = shape.type;
  _shapeProxy.r         = animR     ?? shape.r;
  _shapeProxy.thickness = animThick ?? shape.thickness;
  _shapeProxy.opacity   = animOp    ?? (shape.opacity ?? 1);
  _shapeProxy.color     = shape.color;
  _shapeProxy.fill      = shape.fill;
  _shapeProxy.lineCap   = shape.lineCap;
  _shapeProxy.lineJoin  = shape.lineJoin;
  _shapeProxy.dash      = shape.dash;
  _shapeProxy.gradient  = shape.gradient;
  _shapeProxy.params    = shape.params;
  const effShape = _shapeProxy;

  const effRotRad   = (animRot   ?? (shape.rotation  || 0)) * Math.PI / 180;
  const effOrbitRad = (animOrbit ?? (shape.orbit      || 0)) * Math.PI / 180;
  const effX        = animOffX   ?? shape.x;
  const effY        = animOffY   ?? shape.y;

  const n = shape.axes != null ? shape.axes : m.axes;
  const rotRad = ((shape.axisRotation != null ? shape.axisRotation : m.axisRotation) || 0) * Math.PI / 180;
  const doMirror = shape.mirror !== false;
  const effectiveN = n === 0 ? 1 : (doMirror ? n : n * 2);
  const effectiveMirror = n === 0 ? false : doMirror;
  const segAngle = effectiveN > 0 ? (Math.PI * 2) / effectiveN : 0;

  tCtx.save();
  tCtx.globalCompositeOperation = 'source-over';
  for (let i = 0; i < effectiveN; i++) {
    for (let flip = 0; flip < (effectiveMirror ? 2 : 1); flip++) {
      tCtx.save();
      tCtx.translate(m.cx, m.cy);
      tCtx.rotate(rotRad + segAngle * i + effOrbitRad);
      if (flip === 1) tCtx.scale(1, -1);
      tCtx.translate(effX, effY);
      if (effRotRad) tCtx.rotate(effRotRad);
      renderShapeInContext(tCtx, effShape);
      tCtx.restore();
    }
  }
  tCtx.restore();
}

function shapeContainsPoint(m, shape, wx, wy) {
  const n = shape.axes != null ? shape.axes : m.axes;
  const doMirror = shape.mirror !== false;
  const effectiveN = n === 0 ? 1 : (doMirror ? n : n * 2);
  const effectiveMirror = n === 0 ? false : doMirror;
  const segAngle = effectiveN > 0 ? (Math.PI * 2) / effectiveN : 0;
  const rotRad = ((shape.axisRotation != null ? shape.axisRotation : m.axisRotation) || 0) * Math.PI / 180;
  const hitR = shape.r + (shape.thickness || 2) / 2 + 8;
  for (let i = 0; i < effectiveN; i++) {
    for (let flip = 0; flip < (effectiveMirror ? 2 : 1); flip++) {
      const ang = rotRad + segAngle * i;
      const dx = wx - m.cx, dy = wy - m.cy;
      const cos = Math.cos(-ang), sin = Math.sin(-ang);
      let lx = cos * dx - sin * dy;
      let ly = sin * dx + cos * dy;
      if (flip === 1) ly = -ly;
      if (Math.hypot(lx - shape.x, ly - shape.y) <= hitR) return true;
    }
  }
  return false;
}

function hitTestShapes(wx, wy) {
  for (const m of [...S.mandalas].reverse()) {
    if (!m.visible) continue;
    for (const shape of [...(m.shapes || [])].reverse()) {
      if (shapeContainsPoint(m, shape, wx, wy)) return { shape, mandala: m };
    }
  }
  return null;
}

function findSelectedShape() {
  if (!S.selectedShapeId) return null;
  for (const m of S.mandalas) {
    const shape = (m.shapes || []).find(s => s.id === S.selectedShapeId);
    if (shape) return { shape, mandala: m };
  }
  return null;
}

function shapeWorldCenter(m, shape) {
  const rotRad = ((shape.axisRotation != null ? shape.axisRotation : m.axisRotation) || 0) * Math.PI / 180;
  return {
    x: m.cx + Math.cos(rotRad) * shape.x - Math.sin(rotRad) * shape.y,
    y: m.cy + Math.sin(rotRad) * shape.x + Math.cos(rotRad) * shape.y,
  };
}

function getShapeHandleAtPoint(wx, wy) {
  if (!S.selectedShapeId || S.tool !== 'select') return null;
  const found = findSelectedShape();
  if (!found) return null;
  const { shape, mandala: m } = found;
  const clk = S.animClock;
  const animR = getAnimValue(shape, 'radius', clk) ?? shape.r;
  const { x: cx, y: cy } = shapeAnimatedWorldCenter(m, shape);
  const scaleHx = cx + animR + shape.thickness / 2 + 4;
  if (Math.hypot(wx - scaleHx, wy - cy) < HANDLE_RADIUS + 4) return 'shape-scale';
  if (Math.hypot(wx - cx, wy - cy) < animR + 8) return 'shape-move';
  return null;
}

function renderShapeSelectionHandles() {
  const found = findSelectedShape();
  if (!found) return;
  const { shape, mandala: m } = found;
  const clk = S.animClock;
  const animR = getAnimValue(shape, 'radius', clk) ?? shape.r;
  const { x: cx, y: cy } = shapeAnimatedWorldCenter(m, shape);
  ctx.save();
  ctx.strokeStyle = '#7c6af0';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([4, 3]);
  ctx.globalAlpha = 0.85;
  ctx.beginPath();
  ctx.arc(cx, cy, animR + shape.thickness / 2 + 4, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = '#7c6af0';
  ctx.beginPath();
  ctx.arc(cx, cy, HANDLE_RADIUS, 0, Math.PI * 2);
  ctx.fill();
  const scaleHx = cx + animR + shape.thickness / 2 + 4;
  ctx.fillStyle = '#fff';
  ctx.strokeStyle = '#7c6af0';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(scaleHx, cy, HANDLE_RADIUS, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function handleShapeDragFn(pos) {
  const found = findSelectedShape();
  if (!found) return;
  const { shape, mandala: m } = found;
  const orig = S.shapeDragOrigin;
  const dx = pos.x - S.shapeHandleStart.x;
  const dy = pos.y - S.shapeHandleStart.y;
  if (S.shapeHandleDrag === 'shape-move') {
    const rotRad = ((shape.axisRotation != null ? shape.axisRotation : m.axisRotation) || 0) * Math.PI / 180;
    const cos = Math.cos(-rotRad), sin = Math.sin(-rotRad);
    shape.x = orig.x + (cos * dx - sin * dy);
    shape.y = orig.y + (sin * dx + cos * dy);
  } else if (S.shapeHandleDrag === 'shape-scale') {
    shape.r = Math.max(2, orig.r + dx);
  }
  updateShapeProps();
}

// ── Shape properties panel (right panel) ─────────────────
function updateShapeProps() {
  const panel = document.getElementById('shape-props');
  if (!panel) return;
  const found = findSelectedShape();
  if (!found) { panel.style.display = 'none'; updateLayersList(); return; }
  panel.style.display = '';
  updateLayersList();
  const { shape } = found;
  document.getElementById('sp-type-label').textContent =
    shape.type.charAt(0).toUpperCase() + shape.type.slice(1);
  document.getElementById('sp-radius').value = Math.round(shape.r);
  document.getElementById('sp-radius-val').textContent = Math.round(shape.r) + 'px';
  document.getElementById('sp-color').value = shape.color;
  document.getElementById('sp-thickness').value = shape.thickness;
  document.getElementById('sp-thickness-val').textContent = shape.thickness;
  document.getElementById('sp-opacity').value = shape.opacity;
  document.getElementById('sp-opacity-val').textContent = Math.round(shape.opacity * 100) + '%';
  const hasFill = !!shape.fill;
  document.getElementById('sp-fill-on').checked = hasFill;
  document.getElementById('sp-fill').value = shape.fill || shape.color;
  document.getElementById('sp-fill').disabled = !hasFill;
  document.getElementById('sp-rotation').value = shape.rotation || 0;
  document.getElementById('sp-rotation-val').textContent = (shape.rotation || 0) + '°';
  document.getElementById('sp-orbit').value = shape.orbit || 0;
  document.getElementById('sp-orbit-val').textContent = (shape.orbit || 0) + '°';
  document.getElementById('sp-offsetX').value = Math.round(shape.x);
  document.getElementById('sp-offsetX-val').textContent = Math.round(shape.x);
  document.getElementById('sp-offsetY').value = Math.round(shape.y);
  document.getElementById('sp-offsetY-val').textContent = Math.round(shape.y);
  document.getElementById('sp-cap').value = shape.lineCap || 'round';
  document.getElementById('sp-join').value = shape.lineJoin || 'round';
  document.getElementById('sp-dash').value = (shape.dash || []).join(',');
  // Update anim button states
  if (shape.anim) {
    SHAPE_ANIM_PROPS.forEach(({ key }) => {
      const btn = document.getElementById('sa-btn-' + key);
      if (btn) btn.classList.toggle('active', !!(shape.anim[key]?.enabled));
      const panel = document.getElementById('sa-panel-' + key);
      if (panel) panel.style.display = shape.anim[key]?.enabled ? '' : 'none';
      drawShapeTimeline(key, shape);
    });
  }
  const starRow = document.getElementById('sp-star-row');
  const polyRow = document.getElementById('sp-poly-row');
  if (starRow) starRow.style.display = shape.type === 'star' ? '' : 'none';
  if (polyRow) polyRow.style.display = shape.type === 'polygon' ? '' : 'none';
  if (shape.type === 'star' && shape.params) {
    document.getElementById('sp-points').value = shape.params.points || 5;
    document.getElementById('sp-inner').value = Math.round((shape.params.innerRatio || 0.45) * 100);
    document.getElementById('sp-inner-val').textContent = Math.round((shape.params.innerRatio || 0.45) * 100) + '%';
  }
  if (shape.type === 'polygon' && shape.params) {
    document.getElementById('sp-sides').value = shape.params.sides || 6;
  }
}

function wireShapeProps() {
  function forShape(fn) { const f = findSelectedShape(); if (f) fn(f.shape); }
  document.getElementById('sp-radius').addEventListener('input', e => {
    forShape(s => { s.r = parseInt(e.target.value) || 10; document.getElementById('sp-radius-val').textContent = s.r + 'px'; });
  });
  document.getElementById('sp-color').addEventListener('input', e => forShape(s => s.color = e.target.value));
  document.getElementById('sp-thickness').addEventListener('input', e => {
    forShape(s => { s.thickness = parseInt(e.target.value) || 1; document.getElementById('sp-thickness-val').textContent = s.thickness; });
  });
  document.getElementById('sp-opacity').addEventListener('input', e => {
    forShape(s => { s.opacity = parseFloat(e.target.value); document.getElementById('sp-opacity-val').textContent = Math.round(s.opacity * 100) + '%'; });
  });
  document.getElementById('sp-fill-on').addEventListener('change', e => {
    forShape(s => {
      s.fill = e.target.checked ? (document.getElementById('sp-fill').value || s.color) : null;
      document.getElementById('sp-fill').disabled = !e.target.checked;
    });
  });
  document.getElementById('sp-fill').addEventListener('input', e => forShape(s => { if (s.fill) s.fill = e.target.value; }));
  document.getElementById('sp-rotation').addEventListener('input', e => {
    forShape(s => { s.rotation = parseInt(e.target.value) || 0; document.getElementById('sp-rotation-val').textContent = s.rotation + '°'; });
  });
  document.getElementById('sp-orbit').addEventListener('input', e => {
    forShape(s => { s.orbit = parseInt(e.target.value) || 0; document.getElementById('sp-orbit-val').textContent = s.orbit + '°'; });
  });
  document.getElementById('sp-offsetX').addEventListener('input', e => {
    forShape(s => { s.x = parseInt(e.target.value) || 0; document.getElementById('sp-offsetX-val').textContent = s.x; });
  });
  document.getElementById('sp-offsetY').addEventListener('input', e => {
    forShape(s => { s.y = parseInt(e.target.value) || 0; document.getElementById('sp-offsetY-val').textContent = s.y; });
  });
  document.getElementById('sp-cap').addEventListener('change', e => {
    S.shapeLineCap = e.target.value; // persist so next drawn shape inherits
    forShape(s => s.lineCap = e.target.value);
  });
  document.getElementById('sp-join').addEventListener('change', e => {
    S.shapeLineJoin = e.target.value; // persist so next drawn shape inherits
    forShape(s => s.lineJoin = e.target.value);
  });
  document.getElementById('sp-dash').addEventListener('change', e => {
    forShape(s => { s.dash = e.target.value ? e.target.value.split(',').map(Number) : []; });
  });
  document.getElementById('sp-points').addEventListener('input', e => {
    forShape(s => { if (!s.params) s.params = {}; s.params.points = parseInt(e.target.value) || 5; });
    document.getElementById('sp-points-val').textContent = e.target.value;
  });
  document.getElementById('sp-inner').addEventListener('input', e => {
    forShape(s => {
      if (!s.params) s.params = {};
      s.params.innerRatio = parseInt(e.target.value) / 100;
      document.getElementById('sp-inner-val').textContent = e.target.value + '%';
    });
  });
  document.getElementById('sp-sides').addEventListener('input', e => {
    forShape(s => { if (!s.params) s.params = {}; s.params.sides = parseInt(e.target.value) || 6; });
    document.getElementById('sp-sides-val').textContent = e.target.value;
  });
  document.getElementById('sp-delete').addEventListener('click', () => {
    const found = findSelectedShape();
    if (!found || !confirm('Delete this shape?')) return;
    historySnapshot();
    found.mandala.shapes = (found.mandala.shapes || []).filter(s => s.id !== found.shape.id);
    S.selectedShapeId = null;
    updateShapeProps();
  });
}

function wireShapeAnimProps() {
  SHAPE_ANIM_PROPS.forEach(({ key, min, max }) => {
    const btn = document.getElementById('sa-btn-' + key);
    if (!btn) return;
    btn.addEventListener('click', () => {
      const found = findSelectedShape(); if (!found) return;
      const shape = found.shape;
      if (!shape.anim) shape.anim = {};
      historySnapshot();
      if (shape.anim[key]?.enabled) {
        shape.anim[key].enabled = false;
        btn.classList.remove('active');
        const p = document.getElementById('sa-panel-' + key);
        if (p) p.style.display = 'none';
      } else {
        // Default initial animation based on current static value
        const staticVal = (() => {
          switch (key) {
            case 'radius':    return shape.r || 50;
            case 'thickness': return shape.thickness || 4;
            case 'opacity':   return shape.opacity ?? 1;
            case 'rotation':  return shape.rotation || 0;
            case 'orbit':     return shape.orbit || 0;
            case 'offsetX':   return shape.x || 0;
            case 'offsetY':   return shape.y || 0;
            default:          return 0;
          }
        })();
        const presets = SHAPE_ANIM_PRESETS[key];
        if (!shape.anim[key]) {
          const defaultPreset = presets?.[0];
          shape.anim[key] = defaultPreset ? applyPreset(defaultPreset) : defaultAnimProp(staticVal);
        } else {
          shape.anim[key].enabled = true;
        }
        btn.classList.add('active');
        const p = document.getElementById('sa-panel-' + key);
        if (p) p.style.display = '';
        const durEl = document.getElementById('sa-dur-' + key);
        if (durEl) durEl.value = shape.anim[key].duration;
        drawShapeTimeline(key, shape);
      }
    });

    const durEl = document.getElementById('sa-dur-' + key);
    if (durEl) durEl.addEventListener('change', e => {
      const found = findSelectedShape(); if (!found?.shape?.anim?.[key]) return;
      found.shape.anim[key].duration = Math.max(0.1, parseFloat(e.target.value) || 1);
      drawShapeTimeline(key, found.shape);
    });

    const presetSel = document.getElementById('sa-preset-' + key);
    if (presetSel) presetSel.addEventListener('change', e => {
      const found = findSelectedShape(); if (!found) return;
      const shape = found.shape;
      const preset = SHAPE_ANIM_PRESETS[key]?.find(p => p.label === e.target.value);
      if (!preset) { e.target.value = ''; return; }
      if (!shape.anim) shape.anim = {};
      shape.anim[key] = applyPreset(preset);
      const durEl2 = document.getElementById('sa-dur-' + key);
      if (durEl2) durEl2.value = shape.anim[key].duration;
      document.getElementById('sa-btn-' + key)?.classList.add('active');
      const p = document.getElementById('sa-panel-' + key); if (p) p.style.display = '';
      drawShapeTimeline(key, shape);
      e.target.value = '';
      historySnapshot();
    });

    const easeSel = document.getElementById('sa-ease-sel-' + key);
    if (easeSel) easeSel.addEventListener('change', e => {
      const found = findSelectedShape(); if (!found?.shape?.anim?.[key]) return;
      const shape = found.shape;
      const kfIdx = STL.selectedKf?.prop === key ? STL.selectedKf.kfIdx : -1;
      if (kfIdx >= 0 && kfIdx < shape.anim[key].keyframes.length - 1)
        shape.anim[key].keyframes[kfIdx].easing = e.target.value;
      drawShapeTimeline(key, shape);
    });

    const delBtn = document.getElementById('sa-kf-del-' + key);
    if (delBtn) delBtn.addEventListener('click', () => {
      const found = findSelectedShape(); if (!found?.shape?.anim?.[key]) return;
      const shape = found.shape;
      const kfIdx = STL.selectedKf?.prop === key ? STL.selectedKf.kfIdx : -1;
      const kfs = shape.anim[key].keyframes;
      if (kfIdx > 0 && kfIdx < kfs.length - 1 && kfs.length > 2) {
        kfs.splice(kfIdx, 1);
        STL.selectedKf = null;
        syncShapeEasingDropdown(key, shape);
        drawShapeTimeline(key, shape);
        historySnapshot();
      }
    });

    initShapeTimelineCanvas(key);
  });
}

// ── Shape panel (contextual bar above status bar) ─────────
function updateShapePanel() {
  const panel = document.getElementById('shape-panel');
  if (!panel) return;
  const isShape = ['circle','star','polygon'].includes(S.tool);
  panel.classList.toggle('visible', isShape);
  if (!isShape) return;
  document.getElementById('shapep-star-row').style.display = S.tool === 'star' ? 'flex' : 'none';
  document.getElementById('shapep-poly-row').style.display = S.tool === 'polygon' ? 'flex' : 'none';
  document.getElementById('shapep-fill-on').checked = !!S.shapeFill;
  document.getElementById('shapep-fill').value = S.shapeFill || S.color;
  document.getElementById('shapep-fill').disabled = !S.shapeFill;
  document.getElementById('shapep-points').value = S.shapeParams.points || 5;
  const innerPct = Math.round((S.shapeParams.innerRatio || 0.45) * 100);
  document.getElementById('shapep-inner').value = innerPct;
  document.getElementById('shapep-inner-val').textContent = innerPct + '%';
  document.getElementById('shapep-sides').value = S.shapeParams.sides || 6;
  document.getElementById('btn-shape-gradient').classList.toggle('active', S.gradientMode);
}

function wireShapePanel() {
  document.getElementById('shapep-fill-on').addEventListener('change', e => {
    S.shapeFill = e.target.checked ? document.getElementById('shapep-fill').value : null;
    document.getElementById('shapep-fill').disabled = !e.target.checked;
  });
  document.getElementById('shapep-fill').addEventListener('input', e => { if (S.shapeFill) S.shapeFill = e.target.value; });
  document.getElementById('shapep-points').addEventListener('input', e => { S.shapeParams.points = parseInt(e.target.value) || 5; });
  document.getElementById('shapep-inner').addEventListener('input', e => {
    S.shapeParams.innerRatio = parseInt(e.target.value) / 100;
    document.getElementById('shapep-inner-val').textContent = e.target.value + '%';
  });
  document.getElementById('shapep-sides').addEventListener('input', e => { S.shapeParams.sides = parseInt(e.target.value) || 6; });
  document.getElementById('btn-shape-gradient').addEventListener('click', () => {
    S.gradientMode = !S.gradientMode;
    document.getElementById('btn-shape-gradient').classList.toggle('active', S.gradientMode);
    // Keep main gradient toggle in sync
    const mainBtn = document.getElementById('btn-gradient-mode');
    if (mainBtn) mainBtn.classList.toggle('active', S.gradientMode);
  });
}

// ── Snap UI wiring ────────────────────────────────────────
function wireSnapUI() {
  const gridBtn = document.getElementById('btn-snap-grid');
  const axesBtn = document.getElementById('btn-snap-axes');
  const gridOpts = document.getElementById('snap-grid-opts');
  const axesOpts = document.getElementById('snap-axes-opts');
  gridBtn.addEventListener('click', () => {
    S.snapGrid.enabled = !S.snapGrid.enabled;
    gridBtn.classList.toggle('active', S.snapGrid.enabled);
    if (gridOpts) gridOpts.style.display = S.snapGrid.enabled ? 'contents' : 'none';
    markRenderDirty();
  });
  axesBtn.addEventListener('click', () => {
    S.snapAxes.enabled = !S.snapAxes.enabled;
    axesBtn.classList.toggle('active', S.snapAxes.enabled);
    if (axesOpts) axesOpts.style.display = S.snapAxes.enabled ? 'contents' : 'none';
    markRenderDirty();
  });
  const chainBtn = document.getElementById('snap-grid-chain');
  function updateChain() {
    if (chainBtn) chainBtn.textContent = S.snapGrid.linked ? '🔗' : '🔓';
  }
  if (chainBtn) {
    chainBtn.addEventListener('click', () => {
      S.snapGrid.linked = !S.snapGrid.linked;
      if (S.snapGrid.linked) {
        // Sync Y to X on lock
        S.snapGrid.y = S.snapGrid.x;
        document.getElementById('snap-grid-y').value = S.snapGrid.x;
      }
      updateChain();
    });
  }
  updateChain();

  document.getElementById('snap-grid-x').addEventListener('input', e => {
    S.snapGrid.x = parseInt(e.target.value) || 20;
    if (S.snapGrid.linked) {
      S.snapGrid.y = S.snapGrid.x;
      document.getElementById('snap-grid-y').value = S.snapGrid.x;
    }
  });
  document.getElementById('snap-grid-y').addEventListener('input', e => {
    S.snapGrid.y = parseInt(e.target.value) || 20;
    if (S.snapGrid.linked) {
      S.snapGrid.x = S.snapGrid.y;
      document.getElementById('snap-grid-x').value = S.snapGrid.y;
    }
  });
  let _snapSliderTimer = null;
  function onSnapSliderChange() {
    clearTimeout(_snapSliderTimer);
    _snapSliderTimer = setTimeout(markRenderDirty, 32);
  }
  document.getElementById('snap-axes-step').addEventListener('input', e => { S.snapAxes.step = parseInt(e.target.value) || 1; onSnapSliderChange(); });
  document.getElementById('snap-axes-radial').addEventListener('input', e => { S.snapAxes.radial = parseInt(e.target.value) || 20; onSnapSliderChange(); });
}

// ── Tools ────────────────────────────────────────────────
function toMandalaLocal(m, wx, wy) {
  return { x: wx - m.cx, y: wy - m.cy };
}

function onMouseDown(e) {
  if (e.button !== 0) return;
  const rawPos = canvasPos(e);
  const m = getActiveMandala();
  const pos = applySnap(rawPos.x, rawPos.y, m);

  if (S.tool === 'eyedropper') {
    pickColor(pos.x, pos.y);
    return;
  }

  if (S.tool === 'select') {
    // 1. Sprite transform handles
    const handle = getHandleAtPoint(pos.x, pos.y);
    if (handle) {
      S.dragHandle = handle;
      S.dragStart = pos;
      const found = findSprite(S.selectedSpriteId);
      if (found) S.spriteDragOrigin = { ...found.sprite };
      return;
    }

    // 1b. Shape handles
    const shapeHandle = getShapeHandleAtPoint(pos.x, pos.y);
    if (shapeHandle) {
      S.shapeHandleDrag = shapeHandle;
      S.shapeHandleStart = pos;
      const found = findSelectedShape();
      if (found) S.shapeDragOrigin = { ...found.shape };
      return;
    }

    // 2. Mandala centre drag
    const mHit = hitTestMandalaCenter(pos.x, pos.y);
    if (mHit) {
      S.dragHandle = 'mandala-move';
      S.dragMandalaId = mHit.id;
      S.dragStart = pos;
      S.mandalaOrigin = { cx: mHit.cx, cy: mHit.cy };
      const idx = S.mandalas.indexOf(mHit);
      if (idx !== -1) { S.activeIdx = idx; updateMandalaList(); updateAxesDisplay(); }
      return;
    }

    // 3. Sprite body
    const hit = hitTestSprites(pos.x, pos.y);
    if (hit) {
      S.selectedSpriteId = hit.sprite.id;
      S.selectedShapeId = null;
      S.dragHandle = 'move';
      S.dragStart = pos;
      S.spriteDragOrigin = { ...hit.sprite };
      updateSpriteProps();
      updateShapeProps();
    } else {
      // 3b. Shape body
      const shapeHit = hitTestShapes(pos.x, pos.y);
      if (shapeHit) {
        S.selectedShapeId = shapeHit.shape.id;
        S.selectedSpriteId = null;
        S.shapeHandleDrag = 'shape-move';
        S.shapeHandleStart = pos;
        S.shapeDragOrigin = { ...shapeHit.shape };
        updateShapeProps();
        updateSpriteProps();
      } else {
        S.selectedSpriteId = null;
        S.selectedShapeId = null;
        updateSpriteProps();
        updateShapeProps();
      }
    }
    markRenderDirty();
    return;
  }

  if (S.tool === 'place') {
    placeSprite(pos.x, pos.y);
    return;
  }

  // Shape drawing tools
  if (['circle', 'star', 'polygon'].includes(S.tool)) {
    if (!m) return;
    const local = toMandalaLocal(m, pos.x, pos.y);
    S.shapeDragging = true;
    S.shapePreview = {
      type: S.tool,
      x: local.x, y: local.y,
      r: 0,
      color: S.color,
      thickness: S.thickness,
      opacity: S.opacity,
      fill: S.shapeFill,
      lineCap: S.shapeLineCap,
      lineJoin: S.shapeLineJoin,
      dash: [...S.shapeDash],
      gradient: (S.gradientMode) ? JSON.parse(JSON.stringify(S.gradient)) : null,
      rotation: 0, orbit: 0,
      anim: {},
      params: { ...S.shapeParams },
      axes: m.axes,
      axisRotation: m.axisRotation,
      mirror: m.mirror,
      _startX: pos.x, _startY: pos.y,
    };
    return;
  }

  // Brush / line / erase drawing
  if (!m) return;
  const local = toMandalaLocal(m, pos.x, pos.y);
  S.drawing = true;
  S.pts = [local];
  if (S.tool === 'line') S.lineStart = local;
}

function onMouseMove(e) {
  const rawPos = canvasPos(e);
  const m = getActiveMandala();
  const pos = applySnap(rawPos.x, rawPos.y, m);
  S.mousePos = pos;
  markRenderDirty();
  document.getElementById('cursor-pos').textContent = `x:${Math.round(pos.x)} y:${Math.round(pos.y)}`;

  if (S.tool === 'select' && S.dragHandle && S.dragStart) {
    if (S.dragHandle === 'mandala-move') {
      const dm = S.mandalas.find(x => x.id === S.dragMandalaId);
      if (dm && S.mandalaOrigin) {
        dm.cx = S.mandalaOrigin.cx + (pos.x - S.dragStart.x);
        dm.cy = S.mandalaOrigin.cy + (pos.y - S.dragStart.y);
      }
    } else {
      handleSpriteDrag(pos);
    }
    return;
  }

  if (S.tool === 'select' && S.shapeHandleDrag) {
    handleShapeDragFn(pos);
    return;
  }

  // Shape preview drag
  if (S.shapeDragging && S.shapePreview) {
    const dx = pos.x - S.shapePreview._startX;
    const dy = pos.y - S.shapePreview._startY;
    S.shapePreview.r = Math.max(1, Math.hypot(dx, dy));
    return;
  }

  // Update cursor in select mode
  if (S.tool === 'select' && !S.dragHandle && !S.shapeHandleDrag) {
    const handle = getHandleAtPoint(pos.x, pos.y);
    const shapeHandle = getShapeHandleAtPoint(pos.x, pos.y);
    const mHit = hitTestMandalaCenter(pos.x, pos.y);
    overlayCanvas.style.cursor =
      handle === 'move'          ? 'grab' :
      handle === 'rotate'        ? 'crosshair' :
      handle                     ? 'nwse-resize' :
      shapeHandle === 'shape-scale' ? 'ew-resize' :
      shapeHandle                ? 'grab' :
      mHit                       ? 'move' : 'default';
  }

  if (!S.drawing) return;
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

  if (S.shapeHandleDrag) {
    S.shapeHandleDrag = null;
    S.shapeHandleStart = null;
    S.shapeDragOrigin = null;
    historySnapshot();
    return;
  }

  // Shape placement
  if (S.shapeDragging) {
    S.shapeDragging = false;
    const m = getActiveMandala();
    if (m && S.shapePreview && S.shapePreview.r > 2) {
      historySnapshot();
      const shape = { ...S.shapePreview, id: uid() };
      delete shape._startX; delete shape._startY;
      if (!m.shapes) m.shapes = [];
      m.shapes.push(shape);
      S.selectedShapeId = shape.id;
      updateShapeProps();
      updateLayersList();
      setTool('select');
    }
    S.shapePreview = null;
    return;
  }

  if (!S.drawing) return;
  S.drawing = false;

  const m = getActiveMandala();
  if (!m || S.pts.length < 2) { S.pts = []; S.lineStart = null; return; }

  historySnapshot();

  const pts = S.tool === 'brush' ? smoothPoints(S.pts, S.smooth) : S.pts;

  const newStroke = {
    id: uid(),
    pts: pts,
    color: S.color,
    thickness: S.thickness,
    opacity: S.opacity,
    erase: S.tool === 'erase',
    axes: m.axes,
    axisRotation: m.axisRotation,
    mirror: m.mirror,
    gradient: (S.gradientMode && S.tool !== 'erase') ? JSON.parse(JSON.stringify(S.gradient)) : null,
  };
  m.strokes.push(newStroke);
  if (!newStroke.gradient) invalidateStrokeCache(); // gradient strokes render live, no cache needed
  updateLayersList();

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
  const defaultScale = canvas.width / canvas.getBoundingClientRect().width;
  if (item.stampScale == null) item.stampScale = defaultScale;
  m.sprites.push({
    id: uid(),
    paletteId: item.id,
    x: local.x,
    y: local.y,
    rotation: 0,
    scale: item.stampScale,
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
  updateLayersList();
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
    div.addEventListener('click', () => { S.activeIdx = i; updateMandalaList(); updateAxesDisplay(); updateLayersList(); });
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

// ── Layers panel ─────────────────────────────────────────

// Running counters so names stay unique within a session even after deletions.
const _layerSeq = {};
function _nextSeq(key) {
  _layerSeq[key] = (_layerSeq[key] || 0) + 1;
  return String(_layerSeq[key]).padStart(3, '0');
}

// Assign a stable display name to a layer item the first time it's seen.
function ensureLayerName(item, type) {
  if (item._layerName) return item._layerName;
  let base;
  if (type === 'sprite') {
    const pal = getPaletteItem(item.paletteId);
    if (pal) {
      // Strip extension, sanitise, limit length
      base = (pal.name || 'image').replace(/\.[^.]+$/, '').replace(/[^a-z0-9_-]/gi, '-').toLowerCase().slice(0, 16);
    } else {
      base = 'sprite';
    }
  } else if (type === 'stroke') {
    base = item.gradient ? 'grad-stroke' : 'stroke';
  } else {
    // shape
    base = item.type || 'shape';
  }
  item._layerName = base + '-' + _nextSeq(base);
  return item._layerName;
}

const _SHAPE_ICON = { circle: '○', star: '★', polygon: '⬡' };
const _SPRITE_ICON = '⊞';
const _STROKE_ICON = '✏';

// Which canvas item is being hovered in the layers panel (for highlight ring).
let _layersHoverItem = null;

function updateLayersList() {
  const list = document.getElementById('layers-list');
  if (!list) return;
  list.innerHTML = '';

  const m = getActiveMandala();
  if (!m) return;

  // Build flat list: strokes drawn first (bottom), then shapes, then sprites (top).
  const entries = [];
  for (const stroke of (m.strokes || [])) entries.push({ type: 'stroke', item: stroke });
  for (const shape  of (m.shapes  || [])) entries.push({ type: 'shape',  item: shape  });
  for (const spr    of m.sprites)         entries.push({ type: 'sprite', item: spr    });

  if (entries.length === 0) {
    list.innerHTML = '<div style="padding:6px 10px;font-size:10px;opacity:.35">No layers yet</div>';
    return;
  }

  // Render in reverse so topmost is at the top of the list.
  for (let i = entries.length - 1; i >= 0; i--) {
    const { type, item } = entries[i];
    const name = ensureLayerName(item, type);
    const icon = type === 'sprite' ? _SPRITE_ICON
               : type === 'stroke' ? _STROKE_ICON
               : (_SHAPE_ICON[item.type] || '◇');

    const isActive = type === 'sprite'
      ? item.id === S.selectedSpriteId
      : type === 'shape' ? item.id === S.selectedShapeId
      : false;

    const isVisible = item.visible !== false;

    const row = document.createElement('div');
    row.className = 'layer-item' + (isActive ? ' active' : '') + (isVisible ? '' : ' layer-hidden');
    row.dataset.id = item.id;
    row.dataset.type = type;
    row.title = name;

    const tagLabel = type === 'shape' ? item.type : type === 'stroke' ? 'stroke' : 'gif/img';
    const isTrailOn = type === 'stroke' && !!item.trailAnim?.enabled;

    row.innerHTML =
      `<span class="layer-icon">${icon}</span>` +
      `<span class="layer-name">${name}</span>` +
      `<span class="layer-type-tag">${tagLabel}</span>` +
      (type === 'stroke'
        ? `<button class="layer-trail${isTrailOn ? ' active' : ''}" title="Animate as trail">∿</button>`
        : '') +
      `<button class="layer-eye" title="Toggle visibility">${isVisible ? '👁' : '🚫'}</button>`;

    row.addEventListener('mouseenter', () => {
      _layersHoverItem = { type, id: item.id };
      markRenderDirty();
    });
    row.addEventListener('mouseleave', () => {
      if (_layersHoverItem?.id === item.id) { _layersHoverItem = null; markRenderDirty(); }
    });

    // Eye button — toggle visible, do NOT propagate to the row click
    row.querySelector('.layer-eye').addEventListener('click', e => {
      e.stopPropagation();
      item.visible = item.visible === false ? true : false;
      invalidateStrokeCache(); // solid strokes/shapes/sprites are all composited into the cache
      markRenderDirty();
      updateLayersList();
    });

    // Trail-animation toggle (strokes only) — opening the icon enables the trail
    // and reveals its speed input; clicking again disables and hides it.
    const trailBtn = row.querySelector('.layer-trail');
    if (trailBtn) {
      trailBtn.addEventListener('click', e => {
        e.stopPropagation();
        if (!item.trailAnim) item.trailAnim = { enabled: false, duration: 2, lengthPct: 40 };
        item.trailAnim.enabled = !item.trailAnim.enabled;
        invalidateStrokeCache();
        flushHasAnimCache();
        markRenderDirty();
        updateLayersList();
      });
    }

    row.addEventListener('click', () => {
      if (type === 'sprite') {
        S.selectedSpriteId = item.id;
        S.selectedShapeId  = null;
      } else if (type === 'shape') {
        S.selectedShapeId  = item.id;
        S.selectedSpriteId = null;
      }
      // strokes are not selectable yet — just leave selection unchanged
      if (type !== 'stroke') {
        setTool('select');
        updateSpriteProps();
        updateShapeProps();
      }
      updateLayersList();
      markRenderDirty();
    });

    list.appendChild(row);

    if (isTrailOn) {
      if (item.trailAnim.lengthPct == null) item.trailAnim.lengthPct = 40;
      const panel = document.createElement('div');
      panel.className = 'layer-trail-panel';
      panel.innerHTML =
        `<div class="layer-trail-row">` +
          `<label>Speed</label>` +
          `<input type="number" class="layer-trail-speed" min="0.1" max="20" step="0.1" value="${item.trailAnim.duration}">` +
          `<span class="layer-trail-unit">s / loop</span>` +
        `</div>` +
        `<div class="layer-trail-row">` +
          `<label>Length</label>` +
          `<input type="range" class="layer-trail-length" min="5" max="100" step="1" value="${item.trailAnim.lengthPct}">` +
          `<span class="layer-trail-unit layer-trail-length-val">${item.trailAnim.lengthPct}%</span>` +
        `</div>`;
      panel.querySelector('.layer-trail-speed').addEventListener('input', e => {
        const v = parseFloat(e.target.value);
        item.trailAnim.duration = (v > 0) ? v : 0.1;
        markRenderDirty();
      });
      const lenInput = panel.querySelector('.layer-trail-length');
      const lenVal   = panel.querySelector('.layer-trail-length-val');
      lenInput.addEventListener('input', e => {
        const v = parseInt(e.target.value) || 5;
        item.trailAnim.lengthPct = v;
        lenVal.textContent = v + '%';
        markRenderDirty();
      });
      panel.addEventListener('click', e => e.stopPropagation());
      list.appendChild(panel);
    }
  }
}

// Draw a highlight ring around the hovered layer item on the canvas.
function renderLayerHoverHighlight() {
  if (!_layersHoverItem) return;
  markRenderDirty(); // keep repainting while hovering so the blink animates

  const m = getActiveMandala();
  if (!m) return;

  // Blink: fast sine wave on opacity (3 Hz)
  const pulse = 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(performance.now() * 0.006));

  if (_layersHoverItem.type === 'stroke') {
    const stroke = (m.strokes || []).find(s => s.id === _layersHoverItem.id);
    if (!stroke || stroke.pts.length < 2 || stroke.visible === false) return;
    const axes = stroke.axes != null ? stroke.axes : m.axes;
    const rot  = stroke.axisRotation != null ? stroke.axisRotation : m.axisRotation;
    ctx.save();
    ctx.globalAlpha = pulse;
    ctx.globalCompositeOperation = 'source-over';
    renderStrokeSymmetric(ctx, m, stroke.pts, `rgba(255,255,255,1)`, stroke.thickness + 2, 1, false, stroke.mirror !== false, axes, rot, null);
    ctx.globalAlpha = 1;
    ctx.restore();
    return;
  }

  if (_layersHoverItem.type === 'shape') {
    const shape = (m.shapes || []).find(s => s.id === _layersHoverItem.id);
    if (!shape || shape.visible === false) return;
    const clk = S.animClock;
    const r = (getAnimValue(shape, 'radius', clk) ?? shape.r) + (shape.thickness || 2) / 2 + 5;
    const ox = getAnimValue(shape, 'offsetX', clk) ?? shape.x;
    const oy = getAnimValue(shape, 'offsetY', clk) ?? shape.y;
    const orbitRad = ((getAnimValue(shape, 'orbit', clk) ?? shape.orbit ?? 0) * Math.PI / 180);
    const rotRad   = ((shape.axisRotation != null ? shape.axisRotation : m.axisRotation) || 0) * Math.PI / 180;
    ctx.save();
    ctx.setLineDash([5, 3]);
    ctx.strokeStyle = `rgba(255,255,255,${pulse.toFixed(2)})`;
    ctx.lineWidth = 2;
    ctx.shadowColor = 'white';
    ctx.shadowBlur = 6;
    ctx.translate(m.cx, m.cy);
    ctx.rotate(rotRad + orbitRad);
    ctx.translate(ox, oy);
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  } else {
    const spr = m.sprites.find(s => s.id === _layersHoverItem.id);
    if (!spr || spr.visible === false) return;
    const { x: cx, y: cy } = spriteAnimatedCenter(spr, m);
    const item = getPaletteItem(spr.paletteId);
    const drawable = item ? getDrawableImage(item) : null;
    const iw = drawable ? (drawable.width  || drawable.naturalWidth  || 64) : 64;
    const ih = drawable ? (drawable.height || drawable.naturalHeight || 64) : 64;
    const animScale = getAnimValue(spr, 'scale', S.animClock) ?? spr.scale;
    const hw = iw * animScale / 2 + 6;
    const hh = ih * animScale / 2 + 6;
    ctx.save();
    ctx.setLineDash([5, 3]);
    ctx.strokeStyle = `rgba(255,255,255,${pulse.toFixed(2)})`;
    ctx.lineWidth = 2;
    ctx.shadowColor = 'white';
    ctx.shadowBlur = 6;
    const animRot = getAnimValue(spr, 'rotation', S.animClock);
    const sprRot  = animRot != null ? animRot * Math.PI / 180 : (spr.rotation || 0);
    ctx.translate(cx, cy);
    ctx.rotate(sprRot);
    ctx.strokeRect(-hw, -hh, hw * 2, hh * 2);
    ctx.restore();
  }
}

function updateSpriteProps() {
  const found = S.selectedSpriteId ? findSprite(S.selectedSpriteId) : null;
  const panel = document.getElementById('sprite-props');
  if (!found) { panel.style.display = 'none'; updateLayersList(); return; }
  panel.style.display = 'flex';
  updateSpritePropsValues(found.sprite);
  updateLayersList();
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
  overlayCanvas.style.cursor =
    tool === 'erase'      ? 'none'      :
    tool === 'eyedropper' ? 'crosshair'  :
    tool === 'select'     ? 'default'    :
    tool === 'place'      ? 'copy'       : 'crosshair';
  if (tool !== 'select') {
    S.selectedSpriteId = null;
    S.selectedShapeId = null;
    updateSpriteProps();
    updateShapeProps();
  }
  updateShapePanel();
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
    version: 2,
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
    invalidateStrokeCache();
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

// ── Animated GIF export ──────────────────────────────────

function gcd(a, b) { return b ? gcd(b, a % b) : a; }
function lcm(a, b) { return Math.round(a / gcd(a, b) * b); }

function gifRecommendations() {
  // Collect cycle lengths in centiseconds (integer-friendly for LCM).
  const cycs = [];

  for (const m of S.mandalas) {
    for (const spr of m.sprites) {
      if (!spr.anim) continue;
      for (const ap of Object.values(spr.anim)) {
        if (ap.enabled && ap.duration > 0) cycs.push(Math.round(ap.duration * 100));
      }
    }
    // Include shape keyframe animations — previously missing from LCM.
    for (const shape of (m.shapes || [])) {
      if (!shape.anim) continue;
      for (const ap of Object.values(shape.anim)) {
        if (ap.enabled && ap.duration > 0) cycs.push(Math.round(ap.duration * 100));
      }
    }
    // Include animated gradient strokes.
    for (const stroke of m.strokes) {
      if (stroke.gradient?.speed > 0) {
        const periodCs = Math.round(100 / stroke.gradient.speed);
        if (periodCs > 0 && periodCs <= 3000) cycs.push(periodCs);
      }
    }
    // Include animated gradient shapes.
    for (const shape of (m.shapes || [])) {
      if (shape.gradient?.speed > 0) {
        const periodCs = Math.round(100 / shape.gradient.speed);
        if (periodCs > 0 && periodCs <= 3000) cycs.push(periodCs);
      }
    }
  }
  for (const item of S.palette) {
    if ((item.isGif || item.isWebP) && item.gifFrames?.length) {
      const ms = item.gifFrames.reduce((s, f) => s + (f.delay || 100), 0);
      cycs.push(Math.round(ms / 10)); // ms → cs
    }
  }

  const hasAnim = cycs.length > 0;
  let cyclCs = hasAnim ? cycs.reduce(lcm) : 200; // centiseconds
  cyclCs = Math.min(cyclCs, 3000); // cap at 30 s

  const fps = cyclCs <= 200 ? 30 : cyclCs <= 400 ? 20 : 15;

  // Key fix: derive frame count from the actual per-frame centisecond delay so
  // that (frames × delayCs) == cyclCs exactly — no drift at the loop boundary.
  const delayCs = Math.max(1, Math.round(100 / fps));
  const frames  = Math.max(1, Math.round(cyclCs / delayCs));

  const cyclSec = cyclCs / 100;
  return { fps, frames, cyclSec, cyclCs, hasAnim };
}

function gifFrameAtTime(item, tSec) {
  if (!item.gifFrames?.length) return 0;
  const totalMs = item.gifFrames.reduce((s, f) => s + (f.delay || 100), 0);
  let tMs = (tSec * 1000) % totalMs;
  for (let i = 0; i < item.gifFrames.length; i++) {
    tMs -= item.gifFrames[i].delay || 100;
    if (tMs < 0) return i;
  }
  return item.gifFrames.length - 1;
}

// S._exportFormat: 'gif' | 'webp'
function showGifModal(format = 'gif') {
  if (format === 'gif' && typeof gifenc === 'undefined') {
    alert('GIF encoder library failed to load.');
    return;
  }
  S._exportFormat = format;
  const rec = gifRecommendations();
  const el = id => document.getElementById(id);

  el('gif-modal-title').textContent = format === 'webp' ? 'Export Animated WebP' : 'Export Animated GIF';
  el('gif-colors-row').style.display  = format === 'gif'  ? '' : 'none';
  el('gif-quality-row').style.display = format === 'webp' ? '' : 'none';

  el('gif-fps').value = rec.fps;
  el('gif-fps-val').textContent = rec.fps;
  el('gif-frames').value = rec.frames;
  // Show actual loop duration: frames × delayCs / 100 (not frames/fps, which may differ after cs rounding)
  const _recDelay = Math.max(1, Math.round(100 / rec.fps));
  el('gif-dur-label').textContent = (rec.frames * _recDelay / 100).toFixed(2);
  el('gif-width').value = S.canvasW;
  el('gif-height-label').textContent = `× ${S.canvasH}`;
  el('gif-size-hint').textContent = `Original: ${S.canvasW}×${S.canvasH} — resize to reduce file size`;

  if (rec.hasAnim) {
    el('gif-fps-hint').textContent = `Recommended: ${rec.fps} fps`;
    el('gif-frames-hint').textContent =
      `Recommended ${rec.frames} frames for seamless ${rec.cyclSec.toFixed(1)}s loop`;
  } else {
    el('gif-fps-hint').textContent = `Recommended: ${rec.fps} fps`;
    el('gif-frames-hint').textContent = 'No animations detected — export will be a still image';
  }

  el('gif-progress-wrap').style.display = 'none';
  el('gif-progress-bar').style.width = '0%';
  el('gif-export-btn').disabled = false;
  el('gif-modal').style.display = 'flex';
}

// ── Animated WebP muxer ───────────────────────────────────
// Extracts the VP8/VP8L chunk from a single-frame WebP blob,
// then assembles all frames into an animated WebP RIFF container.

async function extractWebPFrame(blob) {
  const buf = await blob.arrayBuffer();
  const view = new DataView(buf);
  let pos = 12; // skip RIFF(4) + fileSize(4) + WEBP(4)
  while (pos < buf.byteLength - 8) {
    const id = String.fromCharCode(view.getUint8(pos), view.getUint8(pos+1),
                                   view.getUint8(pos+2), view.getUint8(pos+3));
    const size = view.getUint32(pos + 4, true);
    if (id === 'VP8 ' || id === 'VP8L') {
      return { id, data: new Uint8Array(buf, pos + 8, size) };
    }
    pos += 8 + size + (size & 1);
  }
  throw new Error('No VP8 chunk found in WebP frame');
}

function buildAnimatedWebP(frames, width, height, loopCount) {
  // frames: [{id: 'VP8 '|'VP8L', data: Uint8Array, delayMs: number}]
  const w24 = n => [n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff];
  const w32 = n => [n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, (n >> 24) & 0xff];
  const cc  = s => [...s].map(c => c.charCodeAt(0));

  function mkChunk(id, data) {
    const arr = Array.isArray(data) ? data : Array.from(data);
    const pad = arr.length & 1 ? [0] : [];
    return [...cc(id.padEnd(4, ' ')), ...w32(arr.length), ...arr, ...pad];
  }

  const vp8x = mkChunk('VP8X', [
    0x02, 0x00, 0x00, 0x00, // flags: animation bit set
    ...w24(width - 1),
    ...w24(height - 1),
  ]);

  const anim = mkChunk('ANIM', [
    0xff, 0xff, 0xff, 0x00,  // background BGRA (white, transparent)
    loopCount & 0xff, (loopCount >> 8) & 0xff,
  ]);

  const anmfs = frames.flatMap(({ id, data, delayMs }) => {
    const inner = mkChunk(id, data);
    return mkChunk('ANMF', [
      ...w24(0), ...w24(0),          // frame x/2, y/2 (both 0 = full canvas)
      ...w24(width - 1),
      ...w24(height - 1),
      ...w24(Math.round(delayMs)),   // frame duration in ms
      0x00,                          // flags: no blending, no disposal
      ...inner,
    ]);
  });

  const body = [...cc('WEBP'), ...vp8x, ...anim, ...anmfs];
  return new Uint8Array([...cc('RIFF'), ...w32(body.length), ...body]);
}

async function doExportWebP() {
  const el = id => document.getElementById(id);
  const fps     = Math.max(1, parseInt(el('gif-fps').value)    || 12);
  const frames  = Math.max(1, parseInt(el('gif-frames').value) || 24);
  const expW    = Math.max(50, Math.min(4096, parseInt(el('gif-width').value) || S.canvasW));
  const expH    = Math.round(expW * S.canvasH / S.canvasW);
  const quality = (parseInt(el('gif-quality').value) || 85) / 100;
  const repeat  = parseInt(el('gif-loop').value);
  // Round to nearest ms so frame i is at exactly i*delayMs — matches GIF approach.
  const delayMs  = Math.round(1000 / fps);
  const stepFpsW = 1000 / delayMs; // actual fps after ms rounding

  el('gif-progress-wrap').style.display = 'block';
  el('gif-export-btn').disabled = true;
  el('gif-cancel-btn').disabled = true;

  cancelAnimationFrame(S.rafId); S.rafId = null;
  const wasGuides = S.showGuides, wasSel = S.selectedSpriteId, wasClk = S.animClock;
  S.showGuides = false; S.selectedSpriteId = null;

  const gifSnap = S.palette.map(p => ({ idx: p.gifFrameIdx, cache: p.processedCache, animCanvas: p._animCanvas, animFrameIdx: p._animFrameIdx }));

  const offC = document.createElement('canvas');
  offC.width = expW; offC.height = expH;
  const offCtx = offC.getContext('2d');

  const webpFrames = [];

  try {
    for (let i = 0; i < frames; i++) {
      S.animClock = i / stepFpsW; // use actual fps after ms rounding, not nominal fps

      const nowTs = performance.now();
      for (const item of S.palette) {
        if ((item.isGif || item.isWebP) && item.gifFrames?.length) {
          const newIdx = gifFrameAtTime(item, S.animClock);
          if (newIdx !== item.gifFrameIdx) {
            item.gifFrameIdx   = newIdx;
            item._animCanvas   = null;
            item._animFrameIdx = -1;
            item.processedCache = null;
          }
          item.gifFrameTime = nowTs;
        }
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = S.bgColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      for (const m of S.mandalas) { if (m.visible) renderMandala(m, true); }

      offCtx.clearRect(0, 0, expW, expH);
      offCtx.drawImage(canvas, 0, 0, expW, expH);

      const blob = await new Promise(res => offC.toBlob(res, 'image/webp', quality));
      if (!blob) throw new Error('WebP encoding not supported in this browser');
      const frame = await extractWebPFrame(blob);
      webpFrames.push({ ...frame, delayMs });

      const pct = Math.round((i + 1) / frames * 100);
      el('gif-progress-bar').style.width = pct + '%';
      el('gif-progress-label').textContent = `Encoding frame ${i + 1} / ${frames}…`;
      await new Promise(r => setTimeout(r, 0));
    }

    const webpBytes = buildAnimatedWebP(webpFrames, expW, expH, repeat);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([webpBytes], { type: 'image/webp' }));
    a.download = 'mandala.webp';
    a.click();

    el('gif-modal').style.display = 'none';
  } catch (err) {
    alert('WebP export failed: ' + err.message);
  } finally {
    S.showGuides = wasGuides; S.selectedSpriteId = wasSel; S.animClock = wasClk;
    S.palette.forEach((p, i) => {
      p.gifFrameIdx    = gifSnap[i].idx;
      p.processedCache = gifSnap[i].cache;
      p._animCanvas    = gifSnap[i].animCanvas;
      p._animFrameIdx  = gifSnap[i].animFrameIdx;
    });
    el('gif-cancel-btn').disabled = false;
    el('gif-export-btn').disabled = false;
    S.lastTime = 0;
    S.rafId = requestAnimationFrame(render);
  }
}

async function doExportGIF() {
  const el = id => document.getElementById(id);
  const fps    = Math.max(1, parseInt(el('gif-fps').value)    || 12);
  const frames = Math.max(1, parseInt(el('gif-frames').value) || 24);
  const expW   = Math.max(50, Math.min(4096, parseInt(el('gif-width').value) || S.canvasW));
  const expH   = Math.round(expW * S.canvasH / S.canvasW);
  const colors = parseInt(el('gif-colors').value) || 256;
  const repeat = parseInt(el('gif-loop').value);
  // gifenc.writeFrame delay is in ms; it does Math.round(delay/10) internally to get centiseconds.
  // Compute via centiseconds so the time-stepping matches actual GIF playback rate exactly.
  const delayCs = Math.max(1, Math.round(100 / fps)); // what gets written to the GIF file
  const delayMs = delayCs * 10;                        // pass to gifenc so it writes delayCs
  const stepFps = 100 / delayCs;                       // actual playback fps after rounding

  el('gif-progress-wrap').style.display = 'block';
  el('gif-export-btn').disabled = true;
  el('gif-cancel-btn').disabled = true;

  // Pause RAF, hide guides/selection
  cancelAnimationFrame(S.rafId); S.rafId = null;
  const wasGuides = S.showGuides, wasSel = S.selectedSpriteId, wasClk = S.animClock;
  S.showGuides = false; S.selectedSpriteId = null;

  // Snapshot GIF/WebP states so we can restore
  const gifSnap = S.palette.map(p => ({ idx: p.gifFrameIdx, cache: p.processedCache, animCanvas: p._animCanvas, animFrameIdx: p._animFrameIdx }));

  // Offscreen canvas for scaling output
  const offC = document.createElement('canvas');
  offC.width = expW; offC.height = expH;
  const offCtx = offC.getContext('2d', { willReadFrequently: true });

  const { GIFEncoder, quantize, applyPalette } = gifenc;
  const enc = GIFEncoder();

  try {
    for (let i = 0; i < frames; i++) {
      const tSec = i / stepFps;
      S.animClock = tSec;

      // Seek animated palette items to this time.
      // Also reset gifFrameTime to now so advanceGifAnimation() (which uses
      // performance.now()) won't re-advance the frame we just set.
      const nowTs = performance.now();
      for (const item of S.palette) {
        if ((item.isGif || item.isWebP) && item.gifFrames?.length) {
          const newIdx = gifFrameAtTime(item, tSec);
          if (newIdx !== item.gifFrameIdx) {
            item.gifFrameIdx  = newIdx;
            item._animCanvas  = null;
            item._animFrameIdx = -1;
            item.processedCache = null;
          }
          // Always freeze gifFrameTime so the real-time ticker can't steal frames
          item.gifFrameTime = nowTs;
        }
      }

      // Render frame to main canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = S.bgColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      for (const m of S.mandalas) { if (m.visible) renderMandala(m, true); }

      // Scale down to export size
      offCtx.clearRect(0, 0, expW, expH);
      offCtx.drawImage(canvas, 0, 0, expW, expH);

      // Quantize and encode
      const imgData = offCtx.getImageData(0, 0, expW, expH);
      const palette = quantize(imgData.data, colors);
      const index   = applyPalette(imgData.data, palette);
      enc.writeFrame(index, expW, expH, { palette, delay: delayMs, repeat: i === 0 ? repeat : undefined });

      // Progress
      const pct = Math.round((i + 1) / frames * 100);
      el('gif-progress-bar').style.width = pct + '%';
      el('gif-progress-label').textContent = `Encoding frame ${i + 1} / ${frames}…`;
      await new Promise(r => setTimeout(r, 0)); // yield to browser
    }

    enc.finish();

    const blob = new Blob([enc.bytesView()], { type: 'image/gif' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'mandala.gif';
    a.click();

    el('gif-modal').style.display = 'none';
  } catch (err) {
    alert('GIF export failed: ' + err.message);
  } finally {
    // Restore state
    S.showGuides = wasGuides; S.selectedSpriteId = wasSel; S.animClock = wasClk;
    S.palette.forEach((p, i) => {
      p.gifFrameIdx   = gifSnap[i].idx;
      p.processedCache = gifSnap[i].cache;
      p._animCanvas   = gifSnap[i].animCanvas;
      p._animFrameIdx = gifSnap[i].animFrameIdx;
    });
    el('gif-cancel-btn').disabled = false;
    el('gif-export-btn').disabled = false;
    S.lastTime = 0;
    S.rafId = requestAnimationFrame(render);
  }
}

function resizeCanvas(w, h) {
  S.canvasW = w; S.canvasH = h;
  canvas.width = w; canvas.height = h;
  invalidateStrokeCache();
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
  invalidateStrokeCache();
  // Reset layer name counters for the new project
  Object.keys(_layerSeq).forEach(k => delete _layerSeq[k]);
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
let _showcasePrevGuides = true;

function enterShowcase() {
  _showcasePrevGuides = S.showGuides;
  S.showGuides = false;
  S.selectedSpriteId = null;
  S.selectedShapeId = null;
  document.body.classList.add('showcase');
  fitCanvas();
}

function exitShowcase() {
  document.body.classList.remove('showcase');
  S.showGuides = _showcasePrevGuides;
  fitCanvas();
}

function isShowcase() {
  return document.body.classList.contains('showcase');
}

function toggleHelp() {
  const el = document.getElementById('help-overlay');
  if (el) el.classList.toggle('visible');
}
function closeHelp() {
  const el = document.getElementById('help-overlay');
  if (el) el.classList.remove('visible');
}

function wireEvents() {
  // Tool events go on overlay (covers full container incl. off-canvas area)
  overlayCanvas.addEventListener('mousedown', e => { if (!S.spaceDown && e.button !== 1) onMouseDown(e); });
  overlayCanvas.addEventListener('mousemove', onMouseMove);
  overlayCanvas.addEventListener('mouseup', onMouseUp);
  overlayCanvas.addEventListener('mouseleave', e => { S.mousePos = null; markRenderDirty(); if (S.drawing) onMouseUp(e); });
  // Continue drags that leave the overlay (sprite/mandala dragging, drawing)
  window.addEventListener('mousemove', e => {
    if (S.dragHandle || S.drawing) onMouseMove(e);
  });
  window.addEventListener('mouseup', e => {
    if (S.dragHandle || S.drawing) onMouseUp(e);
  });

  // Toolbar
  document.getElementById('btn-new').addEventListener('click', newProject);
  document.getElementById('btn-save').addEventListener('click', saveProject);
  document.getElementById('btn-showcase').addEventListener('click', enterShowcase);
  document.getElementById('btn-help').addEventListener('click', toggleHelp);
  document.getElementById('btn-help-close').addEventListener('click', closeHelp);
  document.getElementById('help-overlay').addEventListener('click', e => { if (e.target === e.currentTarget) closeHelp(); });
  document.getElementById('btn-export').addEventListener('click', exportPNG);
  document.getElementById('btn-export-gif').addEventListener('click', () => showGifModal('gif'));
  document.getElementById('btn-export-webp').addEventListener('click', () => showGifModal('webp'));
  function syncPlayPauseBtns() {
    const icon = S.animPaused ? '▶' : '⏸';
    document.getElementById('btn-anim-playpause').textContent = icon;
    const l = document.getElementById('btn-anim-playpause-layers');
    if (l) l.textContent = icon;
  }
  document.getElementById('btn-anim-playpause').addEventListener('click', () => {
    S.animPaused = !S.animPaused;
    syncPlayPauseBtns();
    markRenderDirty();
    if (!S.animPaused && !S.rafId) S.rafId = requestAnimationFrame(render);
  });
  document.getElementById('btn-anim-playpause-layers').addEventListener('click', () => {
    S.animPaused = !S.animPaused;
    syncPlayPauseBtns();
    markRenderDirty();
    if (!S.animPaused && !S.rafId) S.rafId = requestAnimationFrame(render);
  });
  document.getElementById('gif-cancel-btn').addEventListener('click', () => {
    document.getElementById('gif-modal').style.display = 'none';
  });
  document.getElementById('gif-export-btn').addEventListener('click', () => {
    if (S._exportFormat === 'webp') doExportWebP(); else doExportGIF();
  });
  document.getElementById('gif-quality').addEventListener('input', e => {
    document.getElementById('gif-quality-val').textContent = e.target.value;
  });

  // Live updates in GIF modal
  document.getElementById('gif-fps').addEventListener('input', e => {
    const fps = parseInt(e.target.value);
    document.getElementById('gif-fps-val').textContent = fps;
    const frames = parseInt(document.getElementById('gif-frames').value) || 1;
    document.getElementById('gif-dur-label').textContent = (frames / fps).toFixed(1);
  });
  document.getElementById('gif-frames').addEventListener('input', e => {
    const frames = parseInt(e.target.value) || 1;
    const fps = parseInt(document.getElementById('gif-fps').value) || 12;
    document.getElementById('gif-dur-label').textContent = (frames / fps).toFixed(1);
  });
  document.getElementById('gif-width').addEventListener('input', e => {
    const w = parseInt(e.target.value) || S.canvasW;
    const h = Math.round(w * S.canvasH / S.canvasW);
    document.getElementById('gif-height-label').textContent = `× ${h}`;
  });
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
      m.strokes = []; invalidateStrokeCache();
      m.sprites = [];
      m.shapes = [];
      S.selectedSpriteId = null;
      S.selectedShapeId = null;
      updateSpriteProps();
      updateShapeProps();
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
  document.getElementById('cb-guides').addEventListener('change', e => { S.showGuides = e.target.checked; markRenderDirty(); });
  document.getElementById('bg-color').addEventListener('input', e => { S.bgColor = e.target.value; invalidateStrokeCache(); });
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
    if (e.key === '?' || e.key === '/') { toggleHelp(); return; }
    if (e.key === 'Escape') { if (isShowcase()) { exitShowcase(); return; } closeHelp(); }
    if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); return; }
    if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) { e.preventDefault(); redo(); return; }
    if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); saveProject(); return; }
    if (e.key === 'Escape' && S.tool === 'place') {
      setTool('select');
      if (S.lastStampedId) { S.selectedSpriteId = S.lastStampedId; updateSpriteProps(); }
      return;
    }
    const map = { b:'brush', l:'line', e:'erase', s:'select', p:'place', i:'eyedropper', c:'circle', g:'polygon' };
    if (map[e.key.toLowerCase()]) setTool(map[e.key.toLowerCase()]);
    if (e.key === '*' || (e.shiftKey && e.key === '8')) setTool('star');
    if (e.key === 'Delete' || e.key === 'Backspace') {
      if (S.selectedSpriteId) document.getElementById('btn-delete-sprite').click();
      if (S.selectedShapeId) document.getElementById('sp-delete')?.click();
    }
    if (e.key === '[') {
      if (S.tool === 'place') {
        const item = getPaletteItem(S.selectedPaletteId);
        if (item) { item.stampScale = Math.max(0.05, (item.stampScale ?? 1) * 0.9); }
      } else {
        S.thickness = Math.max(1, S.thickness - 1);
        document.getElementById('brush-size').value = S.thickness;
        document.getElementById('brush-size-val').textContent = S.thickness;
      }
    }
    if (e.key === ']') {
      if (S.tool === 'place') {
        const item = getPaletteItem(S.selectedPaletteId);
        if (item) { item.stampScale = Math.min(20, (item.stampScale ?? 1) * 1.1); }
      } else {
        S.thickness = Math.min(60, S.thickness + 1);
        document.getElementById('brush-size').value = S.thickness;
        document.getElementById('brush-size-val').textContent = S.thickness;
      }
    }
  });

  // ── Gradient panel ──────────────────────────────────────
  initGradientUI();

  // ── Shape panel + snap ───────────────────────────────────
  wireShapePanel();
  wireShapeProps();
  wireShapeAnimProps();
  wireSnapUI();
}

// ── Gradient UI ──────────────────────────────────────────
let _selectedStopIdx = 0;
const HANDLE_H = 5; // triangle height at top + bottom of bar

function initGradientUI() {
  // Reflect the default gradientMode=true on startup
  document.getElementById('btn-gradient-mode').classList.toggle('active', S.gradientMode);
  document.getElementById('gradient-panel').classList.toggle('visible', S.gradientMode);

  const sel = document.getElementById('grad-preset');
  for (const name of Object.keys(GRADIENT_PRESETS)) {
    const opt = document.createElement('option');
    opt.value = name; opt.textContent = name;
    sel.appendChild(opt);
  }
  sel.addEventListener('change', () => {
    S.gradient.stops = JSON.parse(JSON.stringify(GRADIENT_PRESETS[sel.value]));
    _selectedStopIdx = 0;
    renderGradientUI();
  });
  document.getElementById('grad-scale').addEventListener('input', e => {
    S.gradient.scale = parseInt(e.target.value);
    document.getElementById('grad-scale-val').textContent = S.gradient.scale + 'px';
  });
  document.getElementById('grad-speed').addEventListener('input', e => {
    S.gradient.speed = parseInt(e.target.value) / 100;
    document.getElementById('grad-speed-val').textContent = S.gradient.speed.toFixed(1) + '×';
    if (S.gradient.speed > 0 && !S.rafId) S.rafId = requestAnimationFrame(render);
  });
  document.getElementById('btn-gradient-mode').addEventListener('click', () => {
    S.gradientMode = !S.gradientMode;
    document.getElementById('btn-gradient-mode').classList.toggle('active', S.gradientMode);
    document.getElementById('gradient-panel').classList.toggle('visible', S.gradientMode);
  });

  // All handle interaction on the canvas via pointerdown
  const cvs = document.getElementById('grad-preview');
  cvs.addEventListener('pointerdown', e => {
    const rect = cvs.getBoundingClientRect();
    const w = rect.width;
    const t = Math.max(0, Math.min(1, (e.clientX - rect.left) / w));
    const THRESH = 8 / w; // 8px hit zone
    const near = S.gradient.stops.findIndex(s => Math.abs(s.pos - t) < THRESH);

    if (near >= 0) {
      // Select existing stop + drag
      _selectedStopIdx = near;
      renderGradientUI();
      const stop = S.gradient.stops[near];
      const startX = e.clientX, startPos = stop.pos;
      let moved = false;
      const onMove = ev => {
        moved = true;
        const dx = ev.clientX - startX;
        stop.pos = Math.max(0, Math.min(1, startPos + dx / w));
        S.gradient.stops.sort((a, b) => a.pos - b.pos);
        _selectedStopIdx = S.gradient.stops.findIndex(s => s === stop);
        renderGradientUI();
      };
      const onUp = () => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        if (!moved) {
          // Single click on handle: open colour picker
          const picker = document.createElement('input');
          picker.type = 'color'; picker.value = stop.color;
          picker.style.cssText = 'position:fixed;opacity:0;pointer-events:none';
          document.body.appendChild(picker);
          picker.addEventListener('input', ev => { stop.color = ev.target.value; renderGradientUI(); });
          picker.addEventListener('change', () => picker.remove());
          picker.click();
        }
      };
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    } else {
      // Click on empty area: add new stop
      const color = sampleGradient(S.gradient.stops, t);
      const newStop = { pos: t, color };
      S.gradient.stops.push(newStop);
      S.gradient.stops.sort((a, b) => a.pos - b.pos);
      _selectedStopIdx = S.gradient.stops.findIndex(s => s === newStop);
      renderGradientUI();
    }
  });

  cvs.addEventListener('dblclick', e => {
    if (S.gradient.stops.length <= 2) return;
    const rect = cvs.getBoundingClientRect();
    const t = (e.clientX - rect.left) / rect.width;
    const near = S.gradient.stops.findIndex(s => Math.abs(s.pos - t) < 10 / rect.width);
    if (near >= 0) {
      S.gradient.stops.splice(near, 1);
      _selectedStopIdx = Math.min(_selectedStopIdx, S.gradient.stops.length - 1);
      renderGradientUI();
    }
  });

  renderGradientUI();
}

function renderGradientUI() {
  const { stops, scale, speed } = S.gradient;
  const cvs = document.getElementById('grad-preview');
  const rect = cvs.getBoundingClientRect();
  // Sync canvas pixel size to CSS size so it's crisp
  const dpr = window.devicePixelRatio || 1;
  const cw = Math.round(rect.width * dpr) || 300;
  const ch = Math.round(rect.height * dpr) || 28 * dpr;
  if (cvs.width !== cw || cvs.height !== ch) { cvs.width = cw; cvs.height = ch; }

  const pc = cvs.getContext('2d');
  pc.clearRect(0, 0, cw, ch);
  pc.save(); pc.scale(dpr, dpr);

  const W = cw / dpr, H = ch / dpr;
  const barTop = HANDLE_H, barH = H - HANDLE_H * 2;

  // Gradient bar
  const grad = pc.createLinearGradient(0, 0, W, 0);
  for (const s of stops) grad.addColorStop(Math.min(1, Math.max(0, s.pos)), s.color);
  grad.addColorStop(1, stops[0].color); // seamless wrap hint
  pc.fillStyle = grad;
  pc.beginPath();
  pc.roundRect(0, barTop, W, barH, 3);
  pc.fill();

  // Stop handles: triangles at top + bottom pointing inward
  stops.forEach((stop, idx) => {
    const x = stop.pos * W;
    const sel = idx === _selectedStopIdx;
    const hc = sel ? '#ffe66d' : '#fff';

    pc.fillStyle = stop.color;
    pc.strokeStyle = hc;
    pc.lineWidth = sel ? 1.5 : 1;

    // Top triangle (pointing down into bar)
    pc.beginPath();
    pc.moveTo(x, 0);
    pc.lineTo(x - HANDLE_H, barTop - 1);
    pc.lineTo(x + HANDLE_H, barTop - 1);
    pc.closePath();
    pc.fill(); pc.stroke();

    // Bottom triangle (pointing up into bar)
    pc.beginPath();
    pc.moveTo(x, H);
    pc.lineTo(x - HANDLE_H, H - barTop + 1);
    pc.lineTo(x + HANDLE_H, H - barTop + 1);
    pc.closePath();
    pc.fill(); pc.stroke();
  });

  pc.restore();

  // Sync sliders
  document.getElementById('grad-scale-val').textContent = scale + 'px';
  document.getElementById('grad-speed-val').textContent = speed.toFixed(1) + '×';
  document.getElementById('grad-scale').value = scale;
  document.getElementById('grad-speed').value = Math.round(speed * 100);
}

// ── Init ─────────────────────────────────────────────────
function init() {
  document.title = `Mandala Maker v${VERSION}`;
  const vl = document.getElementById('version-label');
  if (vl) vl.textContent = `v${VERSION}`;

  resizeCanvas(S.canvasW, S.canvasH);
  addMandala();
  wireEvents();
  updateUndoButtons();
  updateLayersList();
  document.getElementById('color-swatch').style.background = S.color;
  centerCanvasView();
  requestAnimationFrame(render);
}

// Scripts are placed at end of <body> so DOM is ready by the time this runs.
// DOMContentLoaded guard ensures safety even if the script tag is ever moved.
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
