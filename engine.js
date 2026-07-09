// ═══════════════════════════════════════════════════════
//  MANDALA MAKER — engine.js
//  Pure rendering/data engine: draws mandala projects (strokes, shapes,
//  sprites, text, effects, animation) with zero dependency on editor UI,
//  tool state, or DOM elements outside a plain canvas 2D context. Loaded
//  before app.js — the editor calls straight into these functions instead
//  of redefining them, so a lightweight standalone player can later load
//  just this file (+ a thin loader/render-loop) and stay automatically in
//  sync with every render feature the editor gains.
// ═══════════════════════════════════════════════════════

// ── Constants ──────────────────────────────────────────
const MANDALA_COLORS = ['#ff6b9d','#7c6af0','#4ecdc4','#ffe66d','#ff8b3d','#a8ff78'];
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

// Preset <select> dropdowns (toolbar/shape/stroke gradient pickers) only
// ever fire on user interaction — they don't live-reflect an object's
// current stops, so switching to a different stroke/shape (or drawing a
// fresh one) left whichever preset name the user last clicked showing,
// regardless of what that object's actual gradient was. Called from each
// panel's render step to sync the dropdown back to reality: the preset
// name if the stops still exactly match one, or the blank placeholder
// option otherwise (edited/custom stops, or a plain default that happens
// not to match any preset).
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
  const { stops, scale, speed, reverse } = grad;
  const timeOffset = (S.animClock * speed * (reverse ? -1 : 1)) % 1;

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
  if (S.mandalas.some(m => m.strokes.some(s => s.anim?.orbit?.enabled))) return true;
  if (S.mandalas.some(m => (m.shapes || []).some(s => s.trailAnim?.enabled))) return true;
  if (S.mandalas.some(m => (m.shapes || []).some(s => s.gradient && s.gradient.speed > 0))) return true;
  // EFFECT-MODULE: animation-detection — generic over every effect's
  // animatable controls, no per-type code needed here.
  return S.effects.some(effectHasAnimation);
}

// True if `pts` forms a closed loop (its start and end points coincide) —
// used to decide how Continuous chase mode should treat a path: closed
// loops can wrap the trail seamlessly, open paths can't and ping-pong instead.
function isClosedLoop(pts) {
  if (pts.length < 2) return false;
  const dx = pts[0].x - pts[pts.length - 1].x, dy = pts[0].y - pts[pts.length - 1].y;
  return Math.hypot(dx, dy) < 0.5;
}

// Computes the visible trail window(s) as arc-length fractions of the path —
// an array of { tailFrac, headFrac, fadeAtStart, wrap } (almost always one
// entry; continuous mode on an open path can return two — see below). Two
// families:
// - Pulse (default, trailAnim.continuous falsy): grow-then-recede-then-loop.
//   Draw phase: head sweeps 0 -> 1 while tail trails `visibleFrac` behind it.
//   Recede phase: head holds at 1 while tail sweeps up to close the window,
//   then the whole thing repeats. Phase durations are weighted by distance
//   travelled so the leading/trailing edges move at a constant, matched
//   speed across both phases.
// - Continuous (trailAnim.continuous): always advancing, never pausing.
//   Closed loops wrap the window seamlessly through the 1.0/0.0 seam
//   forever, like a comet orbiting endlessly (tailFrac can go negative —
//   renderTrailWindowInContext wraps it via `wrap`). Open paths have no
//   seamless wrap point, so instead a fresh trail's head starts sweeping
//   0 -> 1 every `duration`, while the previous trail's head holds at 1 and
//   its tail keeps sweeping onward to 1 (finishing its fade-out) — the two
//   overlap for the `visibleFrac` tail of the cycle, so a follow-on trail is
//   always already underway by the time the old one fully exits. At most
//   two are ever alive at once since visibleFrac <= 1.
function trailWindows(trailAnim, clock, isClosed) {
  const duration = trailAnim.duration > 0 ? trailAnim.duration : 0.1;
  const visibleFrac = Math.max(0.02, Math.min(1, (trailAnim.lengthPct ?? 40) / 100));

  if (!trailAnim.continuous) {
    const totalTravel = 1 + visibleFrac;
    const drawPhaseFrac = 1 / totalTravel;
    const t = (clock % duration) / duration;
    const recedeStart = Math.max(0, 1 - visibleFrac);
    if (t < drawPhaseFrac) {
      const headFrac = t / drawPhaseFrac;
      return [{ tailFrac: Math.max(0, headFrac - visibleFrac), headFrac, fadeAtStart: true, wrap: false }];
    }
    const recedeT = (t - drawPhaseFrac) / (1 - drawPhaseFrac);
    return [{ tailFrac: recedeStart + recedeT * (1 - recedeStart), headFrac: 1, fadeAtStart: true, wrap: false }];
  }

  if (isClosed) {
    const headFrac = (clock % duration) / duration;
    return [{ tailFrac: headFrac - visibleFrac, headFrac, fadeAtStart: true, wrap: true }];
  }

  // Open path, continuous: up to two overlapping trails, `duration` apart,
  // each running its own 0 -> (1 + visibleFrac) progress (in units of a
  // cycle) with its head clamped to 1 once it arrives.
  const windows = [];
  const cycle = Math.floor(clock / duration);
  for (const k of [cycle, cycle - 1]) {
    const p = (clock - k * duration) / duration; // this trail's raw progress, 0 at its start
    if (p < 0 || p >= 1 + visibleFrac) continue; // not yet started, or fully exited
    const headFrac = Math.min(1, p);
    const tailFrac = Math.max(0, p - visibleFrac);
    if (headFrac <= tailFrac) continue;
    windows.push({ tailFrac, headFrac, fadeAtStart: true, wrap: false });
  }
  return windows;
}

// Draws one trail `window` (see trailWindows) of `pts` — already in
// whatever local frame the caller has already transformed `ctx` into — with
// a 25%-of-window fade at whichever end trails the direction of travel
// (fadeAtStart) and, for wrap:true, seamless wraparound through the path's
// start/end seam. Factored out of renderStrokeTrailSymmetric so shapes can
// reuse it too, via renderShapeTrailSymmetric, without duplicating this math.
function renderTrailWindowInContext(ctx, pts, color, thickness, opacity, gradient, window) {
  const { tailFrac, headFrac, fadeAtStart = true, wrap = false } = window;
  if (pts.length < 2 || headFrac <= tailFrac) return;

  const lens = [0];
  for (let i = 1; i < pts.length; i++) {
    const dx = pts[i].x - pts[i-1].x, dy = pts[i].y - pts[i-1].y;
    lens.push(lens[i-1] + Math.sqrt(dx*dx + dy*dy));
  }
  const totalLen = lens[lens.length - 1];
  if (totalLen <= 0) return;

  // headFrac is always <=1 in both modes. Non-wrapping windows also clamp
  // tailDist to the path's real extent; wrapping ones allow it to go
  // negative — ptAtDist below wraps it back into [0, totalLen).
  const tailDist = wrap ? tailFrac * totalLen : Math.max(0, tailFrac * totalLen);
  const headDist = Math.min(totalLen, headFrac * totalLen);
  if (headDist <= tailDist) return;
  const fadeLen = (headDist - tailDist) * 0.25;

  function ptAtDist(d) {
    d = wrap ? ((d % totalLen) + totalLen) % totalLen : Math.max(0, Math.min(totalLen, d));
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

  function alphaAt(midD) {
    if (fadeLen <= 0.01) return opacity;
    if (fadeAtStart) {
      return midD < tailDist + fadeLen
        ? Math.max(0, Math.min(1, (midD - tailDist) / fadeLen)) * opacity
        : opacity;
    }
    return midD > headDist - fadeLen
      ? Math.max(0, Math.min(1, (headDist - midD) / fadeLen)) * opacity
      : opacity;
  }

  const solidRGB = gradient ? null : hexToRgb(color);
  const timeOffset = gradient ? (S.animClock * gradient.speed * (gradient.reverse ? -1 : 1)) % 1 : 0;
  const step = Math.max(1.5, thickness * 0.65); // round-cap smoothing, matches gradient arc-walk

  ctx.lineWidth = thickness;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  let d = tailDist;
  while (d < headDist) {
    const dNext = Math.min(d + step, headDist);
    const midD = (d + dNext) / 2;
    const alpha = alphaAt(midD);
    const p0 = ptAtDist(d), p1 = ptAtDist(dNext);
    if (gradient) {
      const { r, g, b } = sampleGradientRGB(gradient.stops, midD / gradient.scale + timeOffset);
      ctx.strokeStyle = `rgba(${r},${g},${b},${alpha.toFixed(3)})`;
    } else {
      const { r, g, b } = solidRGB;
      ctx.strokeStyle = `rgba(${r},${g},${b},${alpha.toFixed(3)})`;
    }
    ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y); ctx.stroke();
    d = dNext;
  }
}

// Renders the visible [tailFrac, headFrac] window of `pts` across all symmetry copies, with the
// trailing 25% of that window fading from transparent to full opacity (a "fading trail" look).
function renderStrokeTrailSymmetric(ctx, m, pts, color, thickness, opacity, mirror, axes, axisRotation, trailAnim, gradient, erase) {
  if (pts.length < 2) return;
  // Reverse direction of travel: walk the path's points back-to-front
  // instead of front-to-back. Every trailWindows() fraction/wrap formula
  // stays untouched — flipping which end is arc-length 0 is enough to make
  // the same computed progress sweep the opposite physical way.
  if (trailAnim.reverse) pts = [...pts].reverse();
  const windows = trailWindows(trailAnim, S.animClock, isClosedLoop(pts));
  if (!windows.length) return;
  const n = axes != null ? axes : m.axes;
  const rotRad = ((axisRotation != null ? axisRotation : m.axisRotation) || 0) * Math.PI / 180;
  const effectiveN = n === 0 ? 1 : (mirror ? n : n * 2);
  const effectiveMirror = n === 0 ? false : mirror;
  const segAngle = effectiveN > 0 ? (Math.PI * 2) / effectiveN : 0;

  ctx.save();
  // See renderStrokeSymmetricTo — erase punches real alpha holes instead of
  // painting a background-coloured patch.
  ctx.globalCompositeOperation = erase ? 'destination-out' : 'source-over';

  for (let i = 0; i < effectiveN; i++) {
    for (let flip = 0; flip < (effectiveMirror ? 2 : 1); flip++) {
      ctx.save();
      ctx.translate(m.cx, m.cy);
      ctx.rotate(rotRad + segAngle * i);
      if (flip === 1) ctx.scale(1, -1);
      for (const window of windows) renderTrailWindowInContext(ctx, pts, color, thickness, opacity, gradient, window);
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

const EFFECT_TYPES = {
  bloom: {
    label: 'Bloom',
    supportsExcludeImages: true,
    defaults: () => ({ amount: 50, threshold: 60, radius: 12, excludeImages: false }),
    controls: [
      { key: 'amount',    label: 'Amount',    min: 0, max: 400, step: 1, format: v => Math.round(v) + '%', animatable: true },
      { key: 'threshold', label: 'Threshold', min: 0, max: 100, step: 1, format: v => Math.round(v) + '%', animatable: false },
      { key: 'radius',    label: 'Blur Radius', min: 1, max: 60, step: 1, format: v => Math.round(v) + 'px', animatable: false },
    ],
    presets: {
      amount: [
        { label: 'Pulse',       kfs: [{t:0,v:20,e:'ease'},{t:0.5,v:90,e:'ease'},{t:1,v:20,e:'ease'}], dur: 2 },
        { label: 'Fade In/Out', kfs: [{t:0,v:0,e:'ease'},{t:0.5,v:100,e:'ease'},{t:1,v:0,e:'ease'}], dur: 3 },
        { label: 'Flicker',     kfs: [{t:0,v:80,e:'linear'},{t:0.45,v:80,e:'linear'},{t:0.5,v:20,e:'linear'},{t:0.55,v:80,e:'linear'},{t:1,v:80,e:'linear'}], dur: 1.5 },
      ],
    },
    // Cheap canvas-2D approximation of bloom: no per-pixel readback (that'd
    // be far too slow for GIF/WebP export's per-frame loop). "Threshold" is
    // a real per-channel cutoff-with-renormalization, applied via a
    // referenced SVG filter (see _setBloomThreshold) rather than CSS
    // contrast() — contrast alone only pushes values away from mid-grey, so
    // it barely affects near-black-background/near-max-brightness artwork
    // (this app's typical look, with little actual midtone content); a true
    // threshold clips low values to 0 and rescales the rest, so it visibly
    // shrinks/grows the bloom regardless of how saturated the source is.
    // `excludeImages` (opt-in, default off — see ECHO_EXCLUDE_IMAGES_FEATURE
    // and drawMandalasWithOptionalSpriteSplit) sources the blur/threshold
    // pass from the sprite-free snapshot instead of the full canvas, so
    // stamped images/GIFs don't grow a glow halo. Unlike Echo/Spiral Echo,
    // Bloom never clears or replaces the canvas — it only adds a glow layer
    // on top via 'lighter' — so the sprites themselves are already sitting
    // on `ctx` untouched; excluding them here just means the glow *source*
    // skips them, no separate "redraw sprites on top" step needed.
    apply(ctx, canvas, { amount, threshold, radius, excludeImages }) {
      if (amount <= 0 || radius <= 0) return;
      const useSplit = excludeImages && _echoNoSpriteSnap && _echoNoSpriteSnap.width === canvas.width && _echoNoSpriteSnap.height === canvas.height;
      const source = useSplit ? _echoNoSpriteSnap : canvas;
      _ensureBloomOffscreen(canvas.width, canvas.height);
      _bloomCtx.clearRect(0, 0, canvas.width, canvas.height);
      _setBloomThreshold(threshold);
      _bloomCtx.filter = `url(#bloom-threshold-filter) brightness(130%) blur(${radius}px)`;
      _bloomCtx.drawImage(source, 0, 0);
      _bloomCtx.filter = 'none';

      // A single 'lighter' pass at alpha 1 is already as bright as one copy
      // of the glow layer can get, so 0-100 draws it once at up to full
      // alpha exactly as before, and every further 100 draws another full
      // additive pass — up to 4 at the 400% max — with whatever's left
      // over fading in the final one. Each full pass roughly doubles the
      // achievable brightness on top of the last.
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (let remaining = amount; remaining > 0; remaining -= 100) {
        ctx.globalAlpha = Math.min(1, remaining / 100);
        ctx.drawImage(_bloomCanvas, 0, 0);
      }
      ctx.restore();
    },
  },
  echo: {
    label: 'Echo',
    supportsExcludeImages: true,
    defaults: () => ({ amount: 60, separation: 0, excludeImages: false }),
    controls: [
      { key: 'amount',     label: 'Amount',     min: 0, max: 100, step: 1, format: v => Math.round(v) + '%', animatable: true },
      { key: 'separation', label: 'Separation', min: 0, max: 4,   step: 1, format: v => Math.round(v) + (Math.round(v) === 1 ? ' frame' : ' frames'), animatable: false },
    ],
    presets: {
      amount: [
        { label: 'Ghost Trail', kfs: [{t:0,v:60,e:'linear'},{t:1,v:60,e:'linear'}], dur: 2 },
        { label: 'Pulse',       kfs: [{t:0,v:0,e:'ease'},{t:0.5,v:90,e:'ease'},{t:1,v:0,e:'ease'}], dur: 3 },
      ],
    },
    // A persistent accumulation buffer, not a stateless per-frame filter like
    // Bloom — each frame it (1) fades the buffer's existing content toward
    // the background colour by a small amount, then (2) stamps the fully-
    // rendered current frame on top (unless Separation says to skip this
    // frame — see below), then (3) writes the buffer back as the canvas's
    // final content.
    //
    // The stamp step uses 'lighten' compositing (keep the brighter of the
    // two, per channel) rather than a plain opaque overwrite — the current
    // frame is a fully opaque bitmap (background colour included), so
    // stamping it with normal source-over would paint over and instantly
    // erase the fading trail everywhere, every frame, leaving no trail at
    // all. 'lighten' means the current frame's background (dark) can't
    // stamp over a brighter trail pixel underneath it, so old bright
    // content keeps decaying visibly instead of being wiped each frame —
    // this assumes a dark background with brighter foreground content
    // (this app's default aesthetic); it won't read correctly as a trail
    // on a light background. `amount` controls how slow the fade is
    // (higher = longer-lived trail).
    //
    // `separation` is a literal rendered-frame count, not a time duration —
    // it counts actual apply() calls (one per rendered frame, whether live
    // preview or export), not animation-clock seconds. That's deliberate:
    // live preview runs at a variable real frame rate while exports run at
    // a fixed, user-chosen fps, so a time-based gap would visibly stamp at
    // different real spacing between the two; "skip N frames" behaves the
    // same way a frame-hold/frame-skip control does in any timeline-based
    // animation tool — N is just N frames of whatever's actually being
    // rendered, live or exported.
    // At 0 (the default, matching the original always-on behaviour) every
    // frame stamps a fresh copy, giving one continuous blurred trail.
    // Raising it skips stamping on frames that arrive before N have passed
    // since the last stamp, so moving content leaves distinct, spaced-out
    // ghost copies instead of a smear — still fades via the same `amount`
    // between stamps.
    // `excludeImages` (opt-in, default off — see ECHO_EXCLUDE_IMAGES_FEATURE
    // and drawMandalasWithOptionalSpriteSplit above) stamps a sprite-free
    // snapshot into the trail buffer instead of the full canvas, then
    // redraws sprites fresh on top afterwards, so stamped images/GIFs stay
    // sharp and un-trailed while everything else still echoes. When off
    // (or the snapshot isn't ready yet), this behaves exactly as before.
    apply(ctx, canvas, { amount, separation, excludeImages }, effectId) {
      const buf = _ensureEchoBuffer(effectId, canvas.width, canvas.height);
      const useSplit = excludeImages && _echoNoSpriteSnap && _echoNoSpriteSnap.width === canvas.width && _echoNoSpriteSnap.height === canvas.height;
      const stampSource = useSplit ? _echoNoSpriteSnap : canvas;
      const fadeAlpha = 1 - Math.min(0.98, amount / 100);
      buf.ctx.globalCompositeOperation = 'source-over';
      buf.ctx.globalAlpha = fadeAlpha;
      buf.ctx.fillStyle = S.bgColor;
      buf.ctx.fillRect(0, 0, canvas.width, canvas.height);

      const skip = Math.max(0, Math.round(separation || 0));
      buf.framesSinceStamp = (buf.framesSinceStamp || 0) + 1;
      if (buf.framesSinceStamp > skip) {
        buf.framesSinceStamp = 0;
        buf.ctx.globalCompositeOperation = 'lighten';
        buf.ctx.globalAlpha = 1;
        buf.ctx.drawImage(stampSource, 0, 0);
        buf.ctx.globalCompositeOperation = 'source-over';
      }

      if (amount > 0) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(buf.canvas, 0, 0);
        if (useSplit) ctx.drawImage(_echoSpritesOnlySnap, 0, 0);
      }
    },
    resetState(effectId) { _echoBuffers.delete(effectId); },
  },
  chromaticAberration: {
    label: 'Chromatic Aberration',
    defaults: () => ({ amount: 30, angle: 0 }),
    controls: [
      { key: 'amount', label: 'Amount', min: 0, max: 100, step: 1, format: v => Math.round(v) + '%', animatable: true },
      { key: 'angle',  label: 'Angle',  min: 0, max: 360, step: 1, format: v => Math.round(v) + '°', animatable: false },
    ],
    presets: {
      amount: [
        { label: 'Pulse',  kfs: [{t:0,v:0,e:'ease'},{t:0.5,v:80,e:'ease'},{t:1,v:0,e:'ease'}], dur: 1.5 },
        { label: 'Glitch', kfs: [{t:0,v:10,e:'linear'},{t:0.1,v:90,e:'linear'},{t:0.15,v:10,e:'linear'},{t:0.5,v:10,e:'linear'},{t:0.55,v:70,e:'linear'},{t:0.6,v:10,e:'linear'},{t:1,v:10,e:'linear'}], dur: 2 },
      ],
    },
    // No per-pixel readback (same reasoning as Bloom) — instead, isolate
    // each colour channel with a 'multiply' fill against a pure R/G/B
    // colour (multiplying by e.g. (255,0,0) zeroes G and B while leaving R
    // exactly as it was), draw each isolated channel from a slightly
    // different offset, then recombine with 'lighter' (additive) so the
    // three offset channels sum back into a full-colour image that's split
    // apart along the fringe. This is a fixed-direction split (set by
    // Angle), not a true per-pixel-radial one — a real radial falloff
    // would need per-pixel distance math, which isn't cheap enough for
    // GIF/WebP export's per-frame loop.
    apply(ctx, canvas, { amount, angle }) {
      if (amount <= 0) return;
      const W = canvas.width, H = canvas.height;
      _ensureChromaOffscreen(W, H);
      const maxOffset = (amount / 100) * Math.max(W, H) * 0.02;
      const rad = angle * Math.PI / 180;
      const dx = Math.cos(rad) * maxOffset, dy = Math.sin(rad) * maxOffset;

      function isolatedChannel(color, ox, oy) {
        _chromaMaskCtx.clearRect(0, 0, W, H);
        _chromaMaskCtx.globalCompositeOperation = 'source-over';
        _chromaMaskCtx.drawImage(canvas, ox, oy);
        _chromaMaskCtx.globalCompositeOperation = 'multiply';
        _chromaMaskCtx.fillStyle = color;
        _chromaMaskCtx.fillRect(0, 0, W, H);
        // 'multiply' against a transparent backdrop has nothing to multiply
        // against, so the blend falls through to the flat fill colour —
        // every empty area of the canvas gets flooded solid red/green/blue
        // instead of staying empty, and once the three channels are summed
        // via 'lighter' below that flood adds up to solid white, blowing
        // out (and visually "inverting") anywhere that wasn't already
        // fully opaque. Re-clip to the original image's alpha shape so
        // empty areas stay empty.
        _chromaMaskCtx.globalCompositeOperation = 'destination-in';
        _chromaMaskCtx.drawImage(canvas, ox, oy);
        _chromaMaskCtx.globalCompositeOperation = 'source-over';
      }

      _chromaCtx.clearRect(0, 0, W, H);
      _chromaCtx.globalCompositeOperation = 'lighter';
      isolatedChannel('#ff0000', dx, dy);
      _chromaCtx.drawImage(_chromaMaskCanvas, 0, 0);
      isolatedChannel('#00ff00', 0, 0);
      _chromaCtx.drawImage(_chromaMaskCanvas, 0, 0);
      isolatedChannel('#0000ff', -dx, -dy);
      _chromaCtx.drawImage(_chromaMaskCanvas, 0, 0);
      _chromaCtx.globalCompositeOperation = 'source-over';

      ctx.clearRect(0, 0, W, H);
      ctx.drawImage(_chromaCanvas, 0, 0);
    },
  },
  vignette: {
    label: 'Vignette',
    defaults: () => ({ amount: 60, spread: 50 }),
    controls: [
      { key: 'amount', label: 'Amount', min: 0, max: 100, step: 1, format: v => Math.round(v) + '%', animatable: true },
      { key: 'spread', label: 'Spread', min: 0, max: 100, step: 1, format: v => Math.round(v) + '%', animatable: false },
    ],
    presets: {
      amount: [
        { label: 'Pulse', kfs: [{t:0,v:30,e:'ease'},{t:0.5,v:80,e:'ease'},{t:1,v:30,e:'ease'}], dur: 3 },
      ],
    },
    // Simplest possible effect in the whole stack — one radial-gradient
    // fill, darkening toward the edges. No offscreen buffer needed at all.
    apply(ctx, canvas, { amount, spread }) {
      if (amount <= 0) return;
      const W = canvas.width, H = canvas.height;
      const cx = W / 2, cy = H / 2;
      const maxR = Math.hypot(cx, cy);
      const innerR = maxR * (spread / 100) * 0.6;
      const grad = ctx.createRadialGradient(cx, cy, innerR, cx, cy, maxR);
      grad.addColorStop(0, 'rgba(0,0,0,0)');
      grad.addColorStop(1, `rgba(0,0,0,${Math.min(1, amount / 100)})`);
      ctx.save();
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    },
  },
  zoomBlur: {
    label: 'Zoom Blur',
    defaults: () => ({ amount: 40 }),
    controls: [
      { key: 'amount', label: 'Amount', min: 0, max: 100, step: 1, format: v => Math.round(v) + '%', animatable: true },
    ],
    presets: {
      amount: [
        { label: 'Burst', kfs: [{t:0,v:0,e:'ease-out'},{t:0.2,v:90,e:'ease-out'},{t:1,v:0,e:'linear'}], dur: 2 },
      ],
    },
    // Approximates a radial/zoom blur without any per-pixel work: redraw
    // the frame several times at slightly increasing scale around the
    // canvas centre, each pass more transparent than the last, so the
    // stack reads as streaks radiating outward. Centred on the canvas
    // (not any one mandala), which lines up with this app's usual
    // centred-mandala compositions.
    apply(ctx, canvas, { amount }) {
      if (amount <= 0) return;
      const W = canvas.width, H = canvas.height;
      _ensureZoomBlurOffscreen(W, H);
      _zoomBlurCtx.clearRect(0, 0, W, H);
      const cx = W / 2, cy = H / 2;
      const steps = 10;
      const maxScale = 1 + (amount / 100) * 0.25;
      for (let i = 0; i < steps; i++) {
        const t = i / (steps - 1);
        const scale = 1 + (maxScale - 1) * t;
        _zoomBlurCtx.save();
        _zoomBlurCtx.globalAlpha = Math.min(1, ((1 - t) / steps) * 2.2);
        _zoomBlurCtx.translate(cx, cy);
        _zoomBlurCtx.scale(scale, scale);
        _zoomBlurCtx.translate(-cx, -cy);
        _zoomBlurCtx.drawImage(canvas, 0, 0);
        _zoomBlurCtx.restore();
      }
      ctx.clearRect(0, 0, W, H);
      ctx.drawImage(_zoomBlurCanvas, 0, 0);
    },
  },
  hueRotate: {
    label: 'Hue Rotate',
    defaults: () => ({ angle: 0 }),
    controls: [
      { key: 'angle', label: 'Angle', min: 0, max: 360, step: 1, format: v => Math.round(v) + '°', animatable: true },
    ],
    presets: {
      angle: [
        { label: 'Cycle', kfs: [{t:0,v:0,e:'linear'},{t:1,v:360,e:'linear'}], dur: 6 },
      ],
    },
    // The cheapest module in the stack — a single native CSS filter.
    apply(ctx, canvas, { angle }) {
      const a = ((angle % 360) + 360) % 360;
      if (a === 0) return;
      _ensureHueOffscreen(canvas.width, canvas.height);
      _hueCtx.clearRect(0, 0, canvas.width, canvas.height);
      _hueCtx.filter = `hue-rotate(${a}deg)`;
      _hueCtx.drawImage(canvas, 0, 0);
      _hueCtx.filter = 'none';
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(_hueCanvas, 0, 0);
    },
  },
  scanlines: {
    label: 'Scanlines',
    defaults: () => ({ amount: 40, spacing: 4 }),
    controls: [
      { key: 'amount',  label: 'Amount',  min: 0, max: 100, step: 1, format: v => Math.round(v) + '%', animatable: true },
      { key: 'spacing', label: 'Spacing', min: 2, max: 20,  step: 1, format: v => Math.round(v) + 'px', animatable: false },
    ],
    presets: {
      amount: [
        { label: 'Flicker', kfs: [{t:0,v:40,e:'linear'},{t:0.45,v:40,e:'linear'},{t:0.5,v:10,e:'linear'},{t:0.55,v:40,e:'linear'},{t:1,v:40,e:'linear'}], dur: 1.5 },
      ],
    },
    // A tiny repeating tile (a black stripe over the top half of one
    // `spacing`-tall row, transparent below it), filled across the whole
    // canvas as a CanvasPattern with 'multiply' compositing — multiplying
    // by black darkens, multiplying by a transparent pixel leaves the
    // destination untouched (its alpha is 0, so it contributes nothing to
    // the blend), so only the stripe rows actually darken.
    apply(ctx, canvas, { amount, spacing }) {
      if (amount <= 0) return;
      const tile = _ensureScanlineTile(spacing);
      const pattern = ctx.createPattern(tile, 'repeat');
      ctx.save();
      ctx.globalAlpha = Math.min(1, amount / 100);
      ctx.globalCompositeOperation = 'multiply';
      ctx.fillStyle = pattern;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.restore();
    },
  },
  invertFlash: {
    label: 'Invert Flash',
    defaults: () => ({ amount: 0 }),
    controls: [
      { key: 'amount', label: 'Amount', min: 0, max: 100, step: 1, format: v => Math.round(v) + '%', animatable: true },
    ],
    presets: {
      amount: [
        { label: 'Strobe',     kfs: [{t:0,v:0,e:'linear'},{t:0.48,v:0,e:'linear'},{t:0.5,v:100,e:'linear'},{t:0.52,v:0,e:'linear'},{t:1,v:0,e:'linear'}], dur: 2 },
        { label: 'Flash Pulse',kfs: [{t:0,v:0,e:'ease-out'},{t:0.1,v:100,e:'ease-in'},{t:0.3,v:0,e:'ease'},{t:1,v:0,e:'linear'}], dur: 3 },
      ],
    },
    // Defaults to 0 (off) — on its own a held invert isn't very useful, this
    // is meant to be driven by a curve for a single strobe/flash beat
    // (see the presets above) rather than left static.
    apply(ctx, canvas, { amount }) {
      if (amount <= 0) return;
      _ensureInvertOffscreen(canvas.width, canvas.height);
      _invertCtx.clearRect(0, 0, canvas.width, canvas.height);
      _invertCtx.filter = `invert(${Math.min(100, amount)}%)`;
      _invertCtx.drawImage(canvas, 0, 0);
      _invertCtx.filter = 'none';
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(_invertCanvas, 0, 0);
    },
  },
  spiralEcho: {
    label: 'Spiral Echo',
    supportsExcludeImages: true,
    defaults: () => ({ amount: 55, rotation: 6, zoom: 100, excludeImages: false }),
    controls: [
      { key: 'amount',   label: 'Amount',   min: 0,   max: 100, step: 1,   format: v => Math.round(v) + '%', animatable: true },
      { key: 'rotation', label: 'Rotation', min: -30, max: 30,  step: 0.5, format: v => v.toFixed(1) + '°/f', animatable: true },
      { key: 'zoom',     label: 'Zoom',     min: 90,  max: 110, step: 0.5, format: v => v.toFixed(1) + '%', animatable: true },
    ],
    // All presets below start and end each control on the same value (with
    // a zero-velocity 'ease' at both endpoints where the curve isn't flat),
    // so the keyframe player's clock%duration wrap — see getAnimValue —
    // never produces a visible jump/restart; the loop point is seamless.
    presets: {
      amount: [
        { label: 'Vortex', kfs: [{t:0,v:60,e:'linear'},{t:1,v:60,e:'linear'}], dur: 2 },
        { label: 'Pulse',   kfs: [{t:0,v:40,e:'ease'},{t:0.5,v:90,e:'ease'},{t:1,v:40,e:'ease'}], dur: 3 },
      ],
      rotation: [
        { label: 'Spin Pulse',   kfs: [{t:0,v:4,e:'ease'},{t:0.5,v:18,e:'ease'},{t:1,v:4,e:'ease'}], dur: 5 },
        { label: 'Direction Flip',kfs: [{t:0,v:10,e:'ease'},{t:0.5,v:-10,e:'ease'},{t:1,v:10,e:'ease'}], dur: 6 },
      ],
      zoom: [
        { label: 'Breathe Out', kfs: [{t:0,v:100,e:'ease'},{t:0.5,v:104,e:'ease'},{t:1,v:100,e:'ease'}], dur: 4 },
        { label: 'Breathe In',  kfs: [{t:0,v:100,e:'ease'},{t:0.5,v:94,e:'ease'},{t:1,v:100,e:'ease'}], dur: 4 },
      ],
    },
    // A feedback-loop buffer, like Echo, but each frame the *existing*
    // buffer content is itself rotated and scaled around the canvas centre
    // before the current frame stamps on top — so old copies don't just
    // fade in place, they spin and drift inward/outward, compounding frame
    // over frame into a hypnotic vortex/tunnel trail. `rotation` is degrees
    // applied per rendered frame (not per second, same reasoning as Echo's
    // separation — consistent between variable-rate live preview and
    // fixed-fps export), `zoom` is the per-frame scale multiplier (100% =
    // no drift, <100% spirals inward, >100% spirals outward), and `amount`
    // is how much of the transformed history survives each frame (opacity
    // of the feedback copy, not a background fade like Echo).
    // `excludeImages` (opt-in, default off, same mechanism as Echo's) uses
    // the sprite-free snapshot as the stamp source into the feedback
    // buffer instead of the full canvas, then redraws sprites fresh on top
    // afterwards, so stamped images/GIFs stay sharp instead of getting
    // dragged into the spinning vortex trail.
    apply(ctx, canvas, { amount, rotation, zoom, excludeImages }, effectId) {
      if (amount <= 0) return;
      const W = canvas.width, H = canvas.height;
      const buf = _ensureSpiralBuffer(effectId, W, H);
      _ensureSpiralTemp(W, H);
      const cx = W / 2, cy = H / 2;
      const useSplit = excludeImages && _echoNoSpriteSnap && _echoNoSpriteSnap.width === W && _echoNoSpriteSnap.height === H;
      const stampSource = useSplit ? _echoNoSpriteSnap : canvas;

      _spiralTempCtx.clearRect(0, 0, W, H);
      _spiralTempCtx.save();
      _spiralTempCtx.globalAlpha = Math.min(0.98, amount / 100);
      _spiralTempCtx.translate(cx, cy);
      _spiralTempCtx.rotate(rotation * Math.PI / 180);
      _spiralTempCtx.scale(zoom / 100, zoom / 100);
      _spiralTempCtx.translate(-cx, -cy);
      _spiralTempCtx.drawImage(buf.canvas, 0, 0);
      _spiralTempCtx.restore();

      buf.ctx.clearRect(0, 0, W, H);
      buf.ctx.drawImage(_spiralTempCanvas, 0, 0);
      buf.ctx.globalCompositeOperation = 'lighten';
      buf.ctx.globalAlpha = 1;
      buf.ctx.drawImage(stampSource, 0, 0);
      buf.ctx.globalCompositeOperation = 'source-over';

      ctx.clearRect(0, 0, W, H);
      ctx.drawImage(buf.canvas, 0, 0);
      if (useSplit) ctx.drawImage(_echoSpritesOnlySnap, 0, 0);
    },
    resetState(effectId) { _spiralBuffers.delete(effectId); },
  },
  lightRays: {
    label: 'Light Rays',
    defaults: () => ({ amount: 60, threshold: 55, length: 45 }),
    controls: [
      { key: 'amount',    label: 'Amount',    min: 0, max: 100, step: 1, format: v => Math.round(v) + '%', animatable: true },
      { key: 'threshold', label: 'Threshold', min: 0, max: 100, step: 1, format: v => Math.round(v) + '%', animatable: false },
      { key: 'length',    label: 'Length',    min: 0, max: 100, step: 1, format: v => Math.round(v) + '%', animatable: true },
    ],
    presets: {
      amount: [
        { label: 'Pulse',   kfs: [{t:0,v:40,e:'ease'},{t:0.5,v:90,e:'ease'},{t:1,v:40,e:'ease'}], dur: 3 },
        { label: 'Flicker', kfs: [{t:0,v:70,e:'linear'},{t:0.45,v:70,e:'linear'},{t:0.5,v:15,e:'linear'},{t:0.55,v:70,e:'linear'},{t:1,v:70,e:'linear'}], dur: 1.5 },
      ],
      length: [
        { label: 'Breathe', kfs: [{t:0,v:35,e:'ease'},{t:0.5,v:70,e:'ease'},{t:1,v:35,e:'ease'}], dur: 4 },
      ],
    },
    // Fakes volumetric "god rays" with no per-pixel readback (too slow for
    // GIF/WebP export's per-frame loop): isolate bright regions with the
    // same real per-channel threshold trick Bloom uses (its own SVG filter
    // instance — see _setRaysThreshold — so the two effects can't clobber
    // each other's threshold if both are active the same frame), then
    // radially smear *just that bright layer* outward from the canvas
    // centre as repeated, increasingly transparent scaled copies (the same
    // accumulation trick Zoom Blur uses for its streaks), and finally
    // screen-blend the smeared layer back onto the original — brightening
    // outward along radial streaks instead of replacing pixels, so the
    // rest of the artwork stays intact underneath.
    apply(ctx, canvas, { amount, threshold, length }) {
      if (amount <= 0 || length <= 0) return;
      const W = canvas.width, H = canvas.height;
      _ensureRaysBrightOffscreen(W, H);
      _raysBrightCtx.clearRect(0, 0, W, H);
      _setRaysThreshold(threshold);
      _raysBrightCtx.filter = 'url(#rays-threshold-filter)';
      _raysBrightCtx.drawImage(canvas, 0, 0);
      _raysBrightCtx.filter = 'none';

      _ensureRaysAccumOffscreen(W, H);
      _raysAccumCtx.clearRect(0, 0, W, H);
      const cx = W / 2, cy = H / 2;
      const steps = 14;
      const maxScale = 1 + (length / 100) * 1.6;
      for (let i = 0; i < steps; i++) {
        const t = i / (steps - 1);
        const scale = 1 + (maxScale - 1) * t;
        _raysAccumCtx.save();
        _raysAccumCtx.globalCompositeOperation = 'lighten';
        _raysAccumCtx.globalAlpha = Math.min(1, ((1 - t) / steps) * 2.6 * (amount / 100));
        _raysAccumCtx.translate(cx, cy);
        _raysAccumCtx.scale(scale, scale);
        _raysAccumCtx.translate(-cx, -cy);
        _raysAccumCtx.drawImage(_raysBrightCanvas, 0, 0);
        _raysAccumCtx.restore();
      }

      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      ctx.drawImage(_raysAccumCanvas, 0, 0);
      ctx.restore();
    },
  },
  rgbGlitch: {
    label: 'RGB Glitch',
    defaults: () => ({ amount: 0, slices: 18 }),
    controls: [
      { key: 'amount', label: 'Amount', min: 0, max: 100, step: 1, format: v => Math.round(v) + '%', animatable: true },
      { key: 'slices', label: 'Slices', min: 2, max: 40,  step: 1, format: v => Math.round(v), animatable: false },
    ],
    presets: {
      amount: [
        { label: 'Glitch Burst', kfs: [{t:0,v:0,e:'linear'},{t:0.06,v:85,e:'linear'},{t:0.12,v:0,e:'linear'},{t:1,v:0,e:'linear'}], dur: 1.2 },
        { label: 'Chaos Pulse',  kfs: [{t:0,v:0,e:'linear'},{t:0.3,v:0,e:'linear'},{t:0.35,v:70,e:'linear'},{t:0.4,v:0,e:'linear'},{t:0.7,v:0,e:'linear'},{t:0.75,v:90,e:'linear'},{t:0.8,v:0,e:'linear'},{t:1,v:0,e:'linear'}], dur: 2 },
        { label: 'Static Hold',  kfs: [{t:0,v:40,e:'linear'},{t:1,v:40,e:'linear'}], dur: 1 },
      ],
    },
    // Defaults to 0 (off), same reasoning as Invert Flash — a constantly-
    // held heavy glitch reads as broken, not stylish; this is meant to be
    // driven by a burst curve (see presets) for VHS-tracking-error/
    // datamosh-style stutters. No per-pixel readback: (1) redraws random
    // horizontal bands of the frame at a random slice-specific horizontal
    // offset (a cheap whole-band drawImage per glitching slice, not a
    // pixel-sort), using true per-frame randomness — since this is called
    // once per rendered frame either live or exported, the glitch pattern
    // is simply whatever that frame's draw rolled, no different from how a
    // real capture glitch looks frame to frame; then (2) applies one global
    // RGB channel split (same isolate-by-multiply-then-add trick as
    // Chromatic Aberration, its own scratch canvases so the two effects
    // can't clobber each other mid-chain) for a constant-cost colour-fringe
    // sizzle regardless of how many slices are configured.
    apply(ctx, canvas, { amount, slices }) {
      if (amount <= 0) return;
      const W = canvas.width, H = canvas.height;
      _ensureGlitchOffscreen(W, H);

      _glitchCtx.clearRect(0, 0, W, H);
      _glitchCtx.drawImage(canvas, 0, 0);
      const bandCount = Math.max(1, Math.round(slices));
      const bandH = H / bandCount;
      const prob = Math.min(1, (amount / 100) * 0.55);
      const maxShift = (amount / 100) * W * 0.12;
      for (let i = 0; i < bandCount; i++) {
        if (Math.random() > prob) continue;
        const y = Math.floor(i * bandH);
        const h = Math.ceil(bandH) + 1;
        const dx = (Math.random() * 2 - 1) * maxShift;
        _glitchCtx.save();
        _glitchCtx.beginPath();
        _glitchCtx.rect(0, y, W, h);
        _glitchCtx.clip();
        _glitchCtx.clearRect(0, y, W, h);
        _glitchCtx.drawImage(canvas, dx, 0);
        _glitchCtx.restore();
      }
      // A shifted band leaves a transparent gap at whichever edge the
      // source didn't reach — left with this backfill, that gap would
      // still read as alpha 0 going into the channel-isolation pass below,
      // and 'multiply' against a transparent destination resolves to the
      // *unblended* fill colour at full alpha (see the W3C compositing
      // spec's blend formula for Da=0), so three isolated R/G/B passes
      // recombined with 'lighter' would turn every gap solid white.
      // Backfilling with the real background colour first means there's
      // no fully-transparent pixel left for that to happen to.
      _glitchCtx.save();
      _glitchCtx.globalCompositeOperation = 'destination-over';
      _glitchCtx.fillStyle = S.bgColor;
      _glitchCtx.fillRect(0, 0, W, H);
      _glitchCtx.restore();

      _ensureGlitchChanOffscreen(W, H);
      const chanOffset = 1 + (amount / 100) * 6;
      function isolatedChannel(color, ox) {
        _glitchChanMaskCtx.clearRect(0, 0, W, H);
        _glitchChanMaskCtx.globalCompositeOperation = 'source-over';
        _glitchChanMaskCtx.drawImage(_glitchCanvas, ox, 0);
        _glitchChanMaskCtx.globalCompositeOperation = 'multiply';
        _glitchChanMaskCtx.fillStyle = color;
        _glitchChanMaskCtx.fillRect(0, 0, W, H);
      }
      _glitchChanCtx.clearRect(0, 0, W, H);
      _glitchChanCtx.globalCompositeOperation = 'lighter';
      isolatedChannel('#ff0000', -chanOffset);
      _glitchChanCtx.drawImage(_glitchChanMaskCanvas, 0, 0);
      isolatedChannel('#00ff00', 0);
      _glitchChanCtx.drawImage(_glitchChanMaskCanvas, 0, 0);
      isolatedChannel('#0000ff', chanOffset);
      _glitchChanCtx.drawImage(_glitchChanMaskCanvas, 0, 0);
      _glitchChanCtx.globalCompositeOperation = 'source-over';

      ctx.clearRect(0, 0, W, H);
      ctx.drawImage(_glitchChanCanvas, 0, 0);
    },
  },
  shatter: {
    label: 'Kaleidoscope Shatter',
    defaults: () => ({ amount: 0, shards: 10 }),
    controls: [
      { key: 'amount', label: 'Amount', min: 0, max: 100, step: 1, format: v => Math.round(v) + '%', animatable: true },
      { key: 'shards', label: 'Shards', min: 4,  max: 24,  step: 1, format: v => Math.round(v), animatable: false },
    ],
    presets: {
      amount: [
        { label: 'Shatter Pulse', kfs: [{t:0,v:0,e:'ease-out'},{t:0.3,v:100,e:'ease-in'},{t:1,v:0,e:'ease-out'}], dur: 1.5 },
        { label: 'Slow Break',    kfs: [{t:0,v:0,e:'ease'},{t:0.5,v:60,e:'ease'},{t:1,v:0,e:'ease'}], dur: 4 },
      ],
    },
    // Defaults to 0 (fully reassembled), same reasoning as Invert Flash and
    // RGB Glitch — a held shatter is less interesting than a burst; this is
    // meant to be driven by a curve (see presets) for a break-apart/
    // reassemble beat. No per-pixel readback: cuts the canvas into radial
    // pie-slice shards around its centre, then redraws *the whole source
    // image* through each shard's wedge-shaped clip while the drawing
    // context itself is translated/rotated outward — since the clip is
    // defined in the same (already-transformed) space the image is drawn
    // in, each shard still samples the correct original source pixels, it
    // just displays them at a shifted, slightly rotated position, i.e. an
    // outward-flying puzzle piece rather than a redrawn/distorted one.
    // Every shard's direction/distance/spin comes from a fixed hash of its
    // own index (`seed` below), not Math.random(), so the shatter *pattern*
    // never flickers frame to frame — only `amount` (the scalar distance
    // multiplier) moves, and at amount=0 every shard's offset is exactly
    // zero, so the wedges' union reassembles pixel-for-pixel into the
    // original frame.
    apply(ctx, canvas, { amount, shards }) {
      if (amount <= 0) return;
      const W = canvas.width, H = canvas.height;
      _ensureShatterOffscreen(W, H);
      _shatterCtx.clearRect(0, 0, W, H);
      const cx = W / 2, cy = H / 2;
      const maxR = Math.hypot(Math.max(cx, W - cx), Math.max(cy, H - cy)) + 4;
      const n = Math.max(2, Math.round(shards));
      const maxDisp = Math.min(W, H) * 0.4 * (amount / 100);
      const maxRot = 0.5 * (amount / 100);

      for (let i = 0; i < n; i++) {
        const a0 = (i / n) * Math.PI * 2;
        const a1 = ((i + 1) / n) * Math.PI * 2;
        const mid = (a0 + a1) / 2;
        const seed = Math.sin(i * 12.9898) * 43758.5453;
        const rnd = seed - Math.floor(seed);
        const dirJitter = (rnd - 0.5) * 0.6;
        const dist = maxDisp * (0.6 + rnd * 0.8);
        const dx = Math.cos(mid + dirJitter) * dist;
        const dy = Math.sin(mid + dirJitter) * dist;
        const rot = (rnd - 0.5) * 2 * maxRot;

        _shatterCtx.save();
        _shatterCtx.translate(cx + dx, cy + dy);
        _shatterCtx.rotate(rot);
        _shatterCtx.translate(-cx, -cy);
        _shatterCtx.beginPath();
        _shatterCtx.moveTo(cx, cy);
        _shatterCtx.arc(cx, cy, maxR, a0, a1);
        _shatterCtx.closePath();
        _shatterCtx.clip();
        _shatterCtx.drawImage(canvas, 0, 0);
        _shatterCtx.restore();
      }

      ctx.clearRect(0, 0, W, H);
      ctx.drawImage(_shatterCanvas, 0, 0);
    },
  },
  cometSparkle: {
    label: 'Comet Sparkle',
    // Hidden from the "+Add" dropdown for now (still needs more tuning),
    // but left fully registered so it keeps rendering/editing correctly in
    // any project that already has one — see wireEffectsPanel's dropdown
    // population, which skips any def with hidden:true.
    hidden: true,
    defaults: () => ({ amount: 40, speed: 40, size: 6, innerRadius: 20, blur: 6, duration: 50, rotation: 0, gradient: 'Rainbow' }),
    controls: [
      { key: 'amount',      label: 'Amount',       min: 0,   max: 100, step: 1,   format: v => Math.round(v) + '%',   animatable: true },
      { key: 'speed',       label: 'Speed',        min: 1,   max: 100, step: 1,   format: v => Math.round(v) + '%',   animatable: false },
      { key: 'size',        label: 'Size',         min: 2,   max: 20,  step: 1,   format: v => Math.round(v) + 'px',  animatable: false },
      { key: 'innerRadius', label: 'Inner Radius', min: 0,   max: 100, step: 1,   format: v => Math.round(v) + '%',   animatable: false },
      { key: 'blur',        label: 'Blur',         min: 0,   max: 20,  step: 1,   format: v => Math.round(v) + 'px',  animatable: true },
      { key: 'duration',    label: 'Duration',     min: 10,  max: 200, step: 5,   format: v => Math.round(v) + 'f',   animatable: false },
      { key: 'rotation',    label: 'Rotation',     min: -20, max: 20,  step: 0.5, format: v => v.toFixed(1) + '°/f',  animatable: true },
    ],
    presets: {
      amount: [
        { label: 'Sparkle Burst', kfs: [{t:0,v:10,e:'ease'},{t:0.5,v:90,e:'ease'},{t:1,v:10,e:'ease'}], dur: 3 },
        { label: 'Gentle Drift',  kfs: [{t:0,v:30,e:'linear'},{t:1,v:30,e:'linear'}], dur: 2 },
      ],
      blur: [
        { label: 'Pulse Glow', kfs: [{t:0,v:2,e:'ease'},{t:0.5,v:14,e:'ease'},{t:1,v:2,e:'ease'}], dur: 3 },
      ],
      rotation: [
        { label: 'Slow Spin',  kfs: [{t:0,v:3,e:'linear'},{t:1,v:3,e:'linear'}], dur: 1 },
        { label: 'Spin Pulse', kfs: [{t:0,v:2,e:'ease'},{t:0.5,v:12,e:'ease'},{t:1,v:2,e:'ease'}], dur: 5 },
      ],
    },
    // A small persistent particle system, not a whole-canvas filter: each
    // frame spawns a few glowing dots on a ring at `innerRadius` (count
    // driven by `amount`, true per-frame randomness like RGB Glitch — no
    // reproducibility need), tracked in polar coordinates (angle, radius)
    // rather than x/y velocity so every particle can share one global
    // `rotation` (degrees per frame) — the whole field swirls together like
    // a pinwheel/galaxy as it expands, instead of drifting in fixed
    // straight lines. Each particle also carries a fixed `t` sampled once
    // at spawn into the chosen `gradient` preset (same sampleGradientRGB
    // used by stroke/shape gradients elsewhere), so sparkle colour comes
    // from a real palette instead of random hue. `duration` controls how
    // many frames a particle survives (life -= 1/duration per frame) and
    // `blur` drives a canvas shadowBlur glow on top of each particle's own
    // radial-gradient falloff. Particles accumulate into their own
    // persistent buffer that's only lightly faded (destination-out) each
    // frame rather than fully cleared, so a moving particle leaves a soft
    // fading streak behind it — a comet tail — without tracking path
    // history per particle. That buffer then composites onto the real
    // canvas with 'lighter' (additive), so sparkles layer on top of
    // existing artwork as pure added brightness rather than replacing
    // anything underneath — the one effect in the stack that's additive
    // decoration rather than a transform of the frame.
    apply(ctx, canvas, { amount, speed, size, innerRadius, blur, duration, rotation, gradient }, effectId) {
      const W = canvas.width, H = canvas.height;
      const st = _ensureCometState(effectId, W, H);
      const cx = W / 2, cy = H / 2;
      const stops = GRADIENT_PRESETS[gradient] || GRADIENT_PRESETS.Rainbow;
      const rotRad = rotation * Math.PI / 180;

      st.ctx.globalCompositeOperation = 'destination-out';
      st.ctx.globalAlpha = 0.12;
      st.ctx.fillStyle = '#000';
      st.ctx.fillRect(0, 0, W, H);
      st.ctx.globalCompositeOperation = 'source-over';
      st.ctx.globalAlpha = 1;

      if (amount > 0) {
        st.spawnAccum = (st.spawnAccum || 0) + (amount / 100) * 2.2;
        const baseR = Math.min(W, H) * 0.5 * (innerRadius / 100);
        while (st.spawnAccum >= 1) {
          st.spawnAccum -= 1;
          const radialSpeed = (speed / 100) * (Math.min(W, H) * 0.012) * (0.6 + Math.random() * 0.8);
          st.particles.push({
            angle: Math.random() * Math.PI * 2,
            radius: baseR + Math.random() * Math.min(W, H) * 0.03,
            radialSpeed,
            life: 1,
            t: Math.random(),
          });
        }
      }

      st.ctx.globalCompositeOperation = 'lighter';
      st.ctx.shadowBlur = blur;
      for (let i = st.particles.length - 1; i >= 0; i--) {
        const p = st.particles[i];
        p.angle += rotRad;
        p.radius += p.radialSpeed;
        p.life -= 1 / Math.max(1, duration);
        if (p.life <= 0) { st.particles.splice(i, 1); continue; }
        const x = cx + Math.cos(p.angle) * p.radius;
        const y = cy + Math.sin(p.angle) * p.radius;
        const { r: cr, g: cg, b: cb } = sampleGradientRGB(stops, p.t);
        const rad = Math.max(0.5, size * p.life);
        st.ctx.shadowColor = `rgba(${cr},${cg},${cb},${p.life})`;
        const grad = st.ctx.createRadialGradient(x, y, 0, x, y, rad);
        grad.addColorStop(0, `rgba(${cr},${cg},${cb},${p.life})`);
        grad.addColorStop(1, `rgba(${cr},${cg},${cb},0)`);
        st.ctx.fillStyle = grad;
        st.ctx.beginPath();
        st.ctx.arc(x, y, rad, 0, Math.PI * 2);
        st.ctx.fill();
      }
      st.ctx.shadowBlur = 0;
      st.ctx.globalCompositeOperation = 'source-over';

      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.drawImage(st.canvas, 0, 0);
      ctx.restore();
    },
    resetState(effectId) { _cometStates.delete(effectId); },
  },
  // Add new modules here.
};

let _scanlineTileCanvas = null, _scanlineTileSpacing = null;
function _ensureScanlineTile(spacing) {
  if (_scanlineTileCanvas && _scanlineTileSpacing === spacing) return _scanlineTileCanvas;
  const c = document.createElement('canvas');
  c.width = 2;
  c.height = Math.max(2, Math.round(spacing));
  const tctx = c.getContext('2d');
  tctx.fillStyle = '#000';
  tctx.fillRect(0, 0, 2, Math.max(1, Math.round(spacing / 2)));
  _scanlineTileCanvas = c;
  _scanlineTileSpacing = spacing;
  return c;
}

let _invertCanvas = null, _invertCtx = null;
function _ensureInvertOffscreen(W, H) {
  if (!_invertCanvas || _invertCanvas.width !== W || _invertCanvas.height !== H) {
    _invertCanvas = document.createElement('canvas');
    _invertCanvas.width = W; _invertCanvas.height = H;
    _invertCtx = _invertCanvas.getContext('2d');
  }
}

let _chromaCanvas = null, _chromaCtx = null, _chromaMaskCanvas = null, _chromaMaskCtx = null;
function _ensureChromaOffscreen(W, H) {
  if (!_chromaCanvas || _chromaCanvas.width !== W || _chromaCanvas.height !== H) {
    _chromaCanvas = document.createElement('canvas');
    _chromaCanvas.width = W; _chromaCanvas.height = H;
    _chromaCtx = _chromaCanvas.getContext('2d');
    _chromaMaskCanvas = document.createElement('canvas');
    _chromaMaskCanvas.width = W; _chromaMaskCanvas.height = H;
    _chromaMaskCtx = _chromaMaskCanvas.getContext('2d');
  }
}

let _zoomBlurCanvas = null, _zoomBlurCtx = null;
function _ensureZoomBlurOffscreen(W, H) {
  if (!_zoomBlurCanvas || _zoomBlurCanvas.width !== W || _zoomBlurCanvas.height !== H) {
    _zoomBlurCanvas = document.createElement('canvas');
    _zoomBlurCanvas.width = W; _zoomBlurCanvas.height = H;
    _zoomBlurCtx = _zoomBlurCanvas.getContext('2d');
  }
}

let _hueCanvas = null, _hueCtx = null;
function _ensureHueOffscreen(W, H) {
  if (!_hueCanvas || _hueCanvas.width !== W || _hueCanvas.height !== H) {
    _hueCanvas = document.createElement('canvas');
    _hueCanvas.width = W; _hueCanvas.height = H;
    _hueCtx = _hueCanvas.getContext('2d');
  }
}

// EFFECT-MODULE: shared "exclude image layers" feature, usable by any
// effect module. Originally Echo-only (hence the `_echo*` names, kept as-is
// to avoid a churny rename), now also opted into by Spiral Echo and Bloom
// via `supportsExcludeImages: true` on their EFFECT_TYPES entry — see each
// module's own excludeImages handling for how it uses the snapshots.
// Rollback plan: this whole feature is inert unless a project actually has
// an opted-in effect with excludeImages=true (new projects/effects default
// to false, matching the pre-existing behaviour exactly), so leaving
// ECHO_EXCLUDE_IMAGES_FEATURE at true costs nothing for anyone not using the
// checkbox. If it ever proves too slow in practice, flip this one constant
// to false to hard-disable it everywhere (checkboxes stop rendering,
// apply() falls back to the original single-pass behaviour in every
// opted-in module) without touching any other code.
const ECHO_EXCLUDE_IMAGES_FEATURE = true;
let _echoNoSpriteSnap = null, _echoSpritesOnlySnap = null; // lazily-sized offscreen canvases
function _echoNeedsSpriteSplit() {
  return ECHO_EXCLUDE_IMAGES_FEATURE && S.effects.some(e => e.enabled !== false && e.excludeImages && EFFECT_TYPES[e.type]?.supportsExcludeImages);
}
function _ensureEchoSnapCanvases(W, H) {
  if (!_echoNoSpriteSnap) {
    _echoNoSpriteSnap = document.createElement('canvas');
    _echoNoSpriteSnap.ctx = _echoNoSpriteSnap.getContext('2d');
    _echoSpritesOnlySnap = document.createElement('canvas');
    _echoSpritesOnlySnap.ctx = _echoSpritesOnlySnap.getContext('2d');
  }
  if (_echoNoSpriteSnap.width !== W || _echoNoSpriteSnap.height !== H) {
    _echoNoSpriteSnap.width = _echoSpritesOnlySnap.width = W;
    _echoNoSpriteSnap.height = _echoSpritesOnlySnap.height = H;
  }
}
// Draws all mandalas into `ctx`/`canvas` (live cache-aware pass if
// `forExport` is false, single full pass otherwise), then — only when some
// opted-in effect actually needs sprites excluded — additionally captures a
// "content so far, no sprites" snapshot and a "sprites only" snapshot so
// that effect's apply() can work on everything except sprites, then redraw
// sprites fresh on top afterwards. Zero extra canvas work when no effect
// needs it.
// ctx/canvas are explicit parameters (not read off a bare global) so this
// — and everything it calls — works correctly for any canvas instance,
// not just "the" editor canvas; a standalone player rendering multiple
// mandalas on one page each passes its own ctx/canvas through here.
// runCaches (mandala.id -> baked solid-stroke run canvases, see
// rebuildStrokeCache) defaults to the shared module-level cache the editor
// has always used, so existing single-instance callers need no changes;
// a player passes its own Map so multiple instances never share cache
// canvases sized for a different instance's dimensions.
function drawMandalasWithOptionalSpriteSplit(ctx, canvas, forExport, runCaches = _runCaches) {
  const needSplit = _echoNeedsSpriteSplit();
  for (const m of S.mandalas) {
    if (!m.visible) continue;
    if (forExport) renderMandala(ctx, canvas, m, true, needSplit);
    else renderMandalaLive(ctx, canvas, m, needSplit, runCaches);
  }
  if (!needSplit) return;
  _ensureEchoSnapCanvases(canvas.width, canvas.height);
  _echoNoSpriteSnap.ctx.clearRect(0, 0, canvas.width, canvas.height);
  _echoNoSpriteSnap.ctx.drawImage(canvas, 0, 0);
  _echoSpritesOnlySnap.ctx.clearRect(0, 0, canvas.width, canvas.height);
  for (const m of S.mandalas) {
    if (!m.visible) continue;
    for (const spr of m.sprites) {
      if (spr.visible === false) continue;
      renderSprite(ctx, m, spr);
      renderSprite(_echoSpritesOnlySnap.ctx, m, spr);
    }
  }
}

let _echoBuffers = new Map(); // effectId -> { canvas, ctx } — see the Echo module above
function _ensureEchoBuffer(id, W, H) {
  let buf = _echoBuffers.get(id);
  if (!buf || buf.canvas.width !== W || buf.canvas.height !== H) {
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    buf = { canvas: c, ctx: c.getContext('2d') };
    buf.ctx.fillStyle = S.bgColor;
    buf.ctx.fillRect(0, 0, W, H);
    _echoBuffers.set(id, buf);
  }
  return buf;
}

let _spiralBuffers = new Map(); // effectId -> { canvas, ctx } — see the Spiral Echo module above
function _ensureSpiralBuffer(id, W, H) {
  let buf = _spiralBuffers.get(id);
  if (!buf || buf.canvas.width !== W || buf.canvas.height !== H) {
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    buf = { canvas: c, ctx: c.getContext('2d') };
    _spiralBuffers.set(id, buf);
  }
  return buf;
}
let _spiralTempCanvas = null, _spiralTempCtx = null;
function _ensureSpiralTemp(W, H) {
  if (!_spiralTempCanvas || _spiralTempCanvas.width !== W || _spiralTempCanvas.height !== H) {
    _spiralTempCanvas = document.createElement('canvas');
    _spiralTempCanvas.width = W; _spiralTempCanvas.height = H;
    _spiralTempCtx = _spiralTempCanvas.getContext('2d');
  }
}

// EFFECT-MODULE: reset-hook — clears every effect's private runtime state
// (only Echo currently has any). Called at the start of every export so
// exports always start from a clean trail instead of whatever the live
// preview session happened to accumulate.
function resetAllEffectsRuntimeState() {
  for (const effect of S.effects) {
    EFFECT_TYPES[effect.type]?.resetState?.(effect.id);
  }
}

let _bloomCanvas = null, _bloomCtx = null;
function _ensureBloomOffscreen(W, H) {
  if (!_bloomCanvas || _bloomCanvas.width !== W || _bloomCanvas.height !== H) {
    _bloomCanvas = document.createElement('canvas');
    _bloomCanvas.width = W; _bloomCanvas.height = H;
    _bloomCtx = _bloomCanvas.getContext('2d');
  }
}

// A real per-channel threshold-with-renormalization, applied as an SVG
// filter (referenced from Canvas2D's `filter` via url(#id), same cost class
// as the built-in contrast()/blur() filters already in the chain — no JS
// pixel readback). CSS contrast() alone only pushes values away from mid-
// grey, so it does nothing on content that's already near-black background
// plus near-max-brightness foreground (this app's typical look) — there's
// no midtone for it to act on. A true threshold instead clips anything
// below the cutoff to 0 and rescales what's left back up to the full 0-1
// range, so it visibly shrinks/grows the bloom regardless of how saturated
// the artwork already is.
// feFuncR/G/B's linear transfer: out = slope*in + intercept, clamped to
// [0,1]. For cutoff t: out = (in - t) / (1 - t) for in > t, else 0 — i.e.
// slope = 1/(1-t), intercept = -t/(1-t). t is clamped below 1 to avoid a
// divide-by-zero (t=1 would mean "nothing ever blooms").
let _bloomThresholdFuncs = null;
function _ensureBloomThresholdFilter() {
  if (_bloomThresholdFuncs) return;
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('width', '0');
  svg.setAttribute('height', '0');
  svg.style.position = 'absolute';
  svg.style.pointerEvents = 'none';
  const filter = document.createElementNS(NS, 'filter');
  filter.setAttribute('id', 'bloom-threshold-filter');
  // SVG filters default to operating in linearRGB, silently gamma-decoding
  // pixels before the transfer function and re-encoding after — the linear
  // slope/intercept math below is written for raw sRGB byte values (a plain
  // 0-255 cutoff), so left at the default this crushes far more than
  // intended: a sRGB pixel at ~30% brightness is only ~6.5% in linear
  // light, so even a small 10% threshold wipes out most midtones. Forcing
  // sRGB here makes the transfer function operate on the values as written.
  filter.setAttribute('color-interpolation-filters', 'sRGB');
  const transfer = document.createElementNS(NS, 'feComponentTransfer');
  const funcs = {};
  for (const ch of ['R', 'G', 'B']) {
    const fn = document.createElementNS(NS, `feFunc${ch}`);
    fn.setAttribute('type', 'linear');
    transfer.appendChild(fn);
    funcs[ch] = fn;
  }
  filter.appendChild(transfer);
  svg.appendChild(filter);
  document.body.appendChild(svg);
  _bloomThresholdFuncs = funcs;
}
function _setBloomThreshold(thresholdPct) {
  _ensureBloomThresholdFilter();
  const t = Math.min(0.98, Math.max(0, thresholdPct / 100));
  const slope = 1 / (1 - t);
  const intercept = -t * slope;
  for (const ch of ['R', 'G', 'B']) {
    _bloomThresholdFuncs[ch].setAttribute('slope', slope);
    _bloomThresholdFuncs[ch].setAttribute('intercept', intercept);
  }
}

let _raysBrightCanvas = null, _raysBrightCtx = null;
function _ensureRaysBrightOffscreen(W, H) {
  if (!_raysBrightCanvas || _raysBrightCanvas.width !== W || _raysBrightCanvas.height !== H) {
    _raysBrightCanvas = document.createElement('canvas');
    _raysBrightCanvas.width = W; _raysBrightCanvas.height = H;
    _raysBrightCtx = _raysBrightCanvas.getContext('2d');
  }
}
let _raysAccumCanvas = null, _raysAccumCtx = null;
function _ensureRaysAccumOffscreen(W, H) {
  if (!_raysAccumCanvas || _raysAccumCanvas.width !== W || _raysAccumCanvas.height !== H) {
    _raysAccumCanvas = document.createElement('canvas');
    _raysAccumCanvas.width = W; _raysAccumCanvas.height = H;
    _raysAccumCtx = _raysAccumCanvas.getContext('2d');
  }
}

// Same real per-channel threshold trick as Bloom's _setBloomThreshold, but
// its own SVG filter/element/id so Light Rays and Bloom can each carry a
// different threshold in the same frame without clobbering one another.
let _raysThresholdFuncs = null;
function _ensureRaysThresholdFilter() {
  if (_raysThresholdFuncs) return;
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('width', '0');
  svg.setAttribute('height', '0');
  svg.style.position = 'absolute';
  svg.style.pointerEvents = 'none';
  const filter = document.createElementNS(NS, 'filter');
  filter.setAttribute('id', 'rays-threshold-filter');
  filter.setAttribute('color-interpolation-filters', 'sRGB');
  const transfer = document.createElementNS(NS, 'feComponentTransfer');
  const funcs = {};
  for (const ch of ['R', 'G', 'B']) {
    const fn = document.createElementNS(NS, `feFunc${ch}`);
    fn.setAttribute('type', 'linear');
    transfer.appendChild(fn);
    funcs[ch] = fn;
  }
  filter.appendChild(transfer);
  svg.appendChild(filter);
  document.body.appendChild(svg);
  _raysThresholdFuncs = funcs;
}
function _setRaysThreshold(thresholdPct) {
  _ensureRaysThresholdFilter();
  const t = Math.min(0.98, Math.max(0, thresholdPct / 100));
  const slope = 1 / (1 - t);
  const intercept = -t * slope;
  for (const ch of ['R', 'G', 'B']) {
    _raysThresholdFuncs[ch].setAttribute('slope', slope);
    _raysThresholdFuncs[ch].setAttribute('intercept', intercept);
  }
}

let _glitchCanvas = null, _glitchCtx = null;
function _ensureGlitchOffscreen(W, H) {
  if (!_glitchCanvas || _glitchCanvas.width !== W || _glitchCanvas.height !== H) {
    _glitchCanvas = document.createElement('canvas');
    _glitchCanvas.width = W; _glitchCanvas.height = H;
    _glitchCtx = _glitchCanvas.getContext('2d');
  }
}
let _glitchChanCanvas = null, _glitchChanCtx = null, _glitchChanMaskCanvas = null, _glitchChanMaskCtx = null;
function _ensureGlitchChanOffscreen(W, H) {
  if (!_glitchChanCanvas || _glitchChanCanvas.width !== W || _glitchChanCanvas.height !== H) {
    _glitchChanCanvas = document.createElement('canvas');
    _glitchChanCanvas.width = W; _glitchChanCanvas.height = H;
    _glitchChanCtx = _glitchChanCanvas.getContext('2d');
    _glitchChanMaskCanvas = document.createElement('canvas');
    _glitchChanMaskCanvas.width = W; _glitchChanMaskCanvas.height = H;
    _glitchChanMaskCtx = _glitchChanMaskCanvas.getContext('2d');
  }
}

let _shatterCanvas = null, _shatterCtx = null;
function _ensureShatterOffscreen(W, H) {
  if (!_shatterCanvas || _shatterCanvas.width !== W || _shatterCanvas.height !== H) {
    _shatterCanvas = document.createElement('canvas');
    _shatterCanvas.width = W; _shatterCanvas.height = H;
    _shatterCtx = _shatterCanvas.getContext('2d');
  }
}

let _cometStates = new Map(); // effectId -> { canvas, ctx, particles, spawnAccum } — see the Comet Sparkle module above
function _ensureCometState(id, W, H) {
  let st = _cometStates.get(id);
  if (!st || st.canvas.width !== W || st.canvas.height !== H) {
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    st = { canvas: c, ctx: c.getContext('2d'), particles: [], spawnAccum: 0 };
    _cometStates.set(id, st);
  }
  return st;
}

// EFFECT-MODULE: core — instance creation, per-frame resolve+apply, and the
// generic animation-detection helper. None of this needs to change when a
// new module is added to EFFECT_TYPES above.
function createEffect(type) {
  const def = EFFECT_TYPES[type];
  if (!def) return null;
  const instance = { id: uid(), type, enabled: true, anim: {}, _expanded: true, ...def.defaults() };
  for (const ctrl of def.controls) if (ctrl.animatable) instance.anim[ctrl.key] = null;
  return instance;
}

// True if any of this effect instance's animatable controls has an enabled
// keyframe curve — used by hasAnyAnimation() to keep the render loop ticking.
function effectHasAnimation(effect) {
  const def = EFFECT_TYPES[effect.type];
  if (!def) return false;
  return def.controls.some(c => c.animatable && effect.anim?.[c.key]?.enabled);
}

// Runs the whole enabled effects stack against whatever's currently on
// `canvas` — called once per frame after all mandala content is drawn (see
// EFFECT-MODULE: render-hook) and once per exported frame (see
// EFFECT-MODULE: export-hook). Walks S.effects *bottom-to-top* (reverse
// array order) to match the panel's layer-stack convention: the effect
// listed at the top of the panel is meant to read as "closest to the
// viewer," so it needs to run last, working on whatever every effect below
// it already produced — the same top-is-final-result mental model as a
// Photoshop layer stack, not a top-runs-first pipeline order.
function applyEffectsChain(ctx, canvas) {
  if (!S.effects.length) return;
  const clk = S.animClock;
  for (let i = S.effects.length - 1; i >= 0; i--) {
    const effect = S.effects[i];
    if (!effect.enabled) continue;
    const def = EFFECT_TYPES[effect.type];
    if (!def) continue;
    const resolved = {};
    for (const ctrl of def.controls) {
      resolved[ctrl.key] = (ctrl.animatable ? getAnimValue(effect, ctrl.key, clk) : null) ?? effect[ctrl.key];
    }
    // excludeImages (any module with supportsExcludeImages) and Comet
    // Sparkle's gradient are plain non-slider fields, not def.controls
    // entries, so they aren't picked up by the loop above — pass them
    // through explicitly.
    if (def.supportsExcludeImages) resolved.excludeImages = effect.excludeImages;
    if (effect.type === 'cometSparkle') resolved.gradient = effect.gradient;
    def.apply(ctx, canvas, resolved, effect.id);
  }
}

// EFFECT-MODULE: ui — dynamic stack list, per-instance param controls, and
// keyframe curve editor. Everything here reads EFFECT_TYPES/S.effects
// generically; a new module needs zero changes in this section.
function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return { r, g, b };
}
function colorDist(r1, g1, b1, r2, g2, b2) {
  return Math.abs(r1 - r2) + Math.abs(g1 - g2) + Math.abs(b1 - b2);
}
// ── Layer z-order ────────────────────────────────────────
// Strokes/shapes/sprites used to render as three separate groups (all
// strokes, then all shapes, then all sprites) regardless of the order they
// were actually drawn in — so a stroke drawn after a shape would still
// render behind it, and a gradient stroke (rendered live, always on top of
// the cached solid strokes) would render in front of a solid stroke drawn
// after it. Every new item gets an increasing z so draw order is a single
// real stacking order across all three types; see getOrderedEntries.
function nextZ(m) { return (m._z = (m._z || 0) + 1); }

// Older saved projects predate the z field — assign one to any item that's
// missing it, preserving the original strokes-then-shapes-then-sprites
// stacking so nothing visually jumps the first time an old file is loaded.
function backfillLayerZ(m) {
  let z = m._z || 0;
  for (const s of (m.strokes || [])) if (s.z == null) s.z = ++z;
  for (const s of (m.shapes  || [])) if (s.z == null) s.z = ++z;
  for (const s of (m.sprites || [])) if (s.z == null) s.z = ++z;
  m._z = z;
}

// Flat, bottom-to-top render/list order across strokes+shapes+sprites.
function getOrderedEntries(m) {
  const entries = [];
  for (const s of (m.strokes || [])) entries.push({ type: 'stroke', item: s });
  for (const s of (m.shapes  || [])) entries.push({ type: 'shape',  item: s });
  for (const s of (m.sprites || [])) entries.push({ type: 'sprite', item: s });
  entries.sort((a, b) => (a.item.z || 0) - (b.item.z || 0));
  return entries;
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
    // Only default a fresh/never-set trim range — a project loaded with an
    // existing trimStart/trimEnd (from a prior save) keeps it.
    if (item.trimStart == null) item.trimStart = 0;
    if (item.trimEnd == null) item.trimEnd = frames.length - 1;
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
    if (item.trimStart == null) item.trimStart = 0;
    if (item.trimEnd == null) item.trimEnd = frames.length - 1;
    invalidateAnimCache(item);
  } catch (e) {
    console.warn('WebP decode failed:', e);
  }
}

// Returns the raw (unprocessed) canvas for the current animation frame,
// advancing the frame index based on elapsed time. Playback is confined to
// [trimStart, trimEnd] (both default to the full range — see
// initGifAnimation/initWebPAnimation) rather than always looping the whole
// decoded frame list, so the Image Inspector's trim sliders can play back
// just a portion of a longer GIF/WebP.
function getAnimFrame(item) {
  if (!item.gifFrames || !item.gifFrames.length) return null;
  const n = item.gifFrames.length;
  const lo = Math.min(Math.max(item.trimStart ?? 0, 0), n - 1);
  const hi = Math.min(Math.max(item.trimEnd ?? (n - 1), lo), n - 1);
  if (item.gifFrameIdx < lo || item.gifFrameIdx > hi) {
    item.gifFrameIdx = lo;
    invalidateAnimCache(item);
  }
  const now = performance.now();
  // Advance frame(s) if enough time has passed
  while (now - item.gifFrameTime >= item.gifFrames[item.gifFrameIdx].delay) {
    item.gifFrameTime += item.gifFrames[item.gifFrameIdx].delay;
    const prevIdx = item.gifFrameIdx;
    item.gifFrameIdx = item.gifFrameIdx + 1 > hi ? lo : item.gifFrameIdx + 1;
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

// ── Stroke cache (offscreen canvases for solid strokes) ──
// Solid (non-gradient/trail/orbit/erase) strokes are pre-rendered instead
// of redrawn every frame — but they can no longer all be flattened into
// one canvas blitted before everything else, since that puts every solid
// stroke behind every shape/sprite/gradient stroke regardless of actual
// draw order (see getOrderedEntries/nextZ). Instead this bakes each
// maximal contiguous run of solid strokes (in z order) into its own
// offscreen canvas; renderMandalaLive blits each run at its correct
// position in the interleaved z walk, so a solid stroke drawn after a
// shape still renders after it — only the strokes need re-baking when
// something changes, shapes/sprites already redraw live every frame.
let _strokeCacheDirty = true;
const _runCaches = new Map(); // mandala.id -> [{ startIdx, endIdx, canvas }]
// Reusable proxy object for renderShapeSymmetric — avoids per-frame allocation.
const _shapeProxy = {};

function invalidateStrokeCache() { _strokeCacheDirty = true; markRenderDirty(); flushHasAnimCache(); }

// Erase strokes are deliberately excluded — they need to stay live (drawn
// directly to the main ctx at their real z position) so they punch through
// whatever is actually visible there at render time, including content
// from an earlier cache run or a shape, not just whatever happens to share
// their own run's canvas.
function isCacheableStrokeEntry(entry) {
  if (entry.type !== 'stroke') return false;
  const s = entry.item;
  return s.pts.length >= 2 && s.visible !== false && !s.erase && !s.gradient && !s.trailAnim?.enabled && !s.anim?.orbit?.enabled;
}

// canvas/runCaches are explicit parameters, defaulting to the editor's
// single shared instance, so a player rendering its own project into its
// own canvas builds cache runs sized to (and stored against) its own
// instance instead of colliding with the editor's or another player's.
function rebuildStrokeCache(canvas, runCaches = _runCaches) {
  runCaches.clear();
  for (const m of S.mandalas) {
    if (!m.visible) continue;
    const entries = getOrderedEntries(m);
    const runs = [];
    let i = 0;
    while (i < entries.length) {
      if (!isCacheableStrokeEntry(entries[i])) { i++; continue; }
      const startIdx = i;
      const cv = document.createElement('canvas');
      cv.width = canvas.width; cv.height = canvas.height;
      const cc = cv.getContext('2d');
      while (i < entries.length && isCacheableStrokeEntry(entries[i])) {
        const stroke = entries[i].item;
        const axes = stroke.axes != null ? stroke.axes : m.axes;
        const rot  = strokeEffectiveRot(stroke, m, S.animClock);
        renderStrokeSymmetricTo(cc, m, stroke.pts, stroke.color, stroke.thickness, stroke.opacity, stroke.erase, stroke.mirror !== false, axes, rot, null);
        i++;
      }
      runs.push({ startIdx, endIdx: i - 1, canvas: cv });
    }
    runCaches.set(m.id, runs);
  }
  _strokeCacheDirty = false;
}

// Sprite counterpart to shapeRadialTangentialOffset (see below) — same
// polar-decomposition treatment for offsetX (radial: distance from centre)
// / offsetY (tangential: arc-offset around centre), so animating a
// stamped sprite's position behaves identically to animating a shape's.
function spriteRadialTangentialOffset(spr, clk) {
  const animOffX = getAnimValue(spr, 'offsetX', clk);
  const animOffY = getAnimValue(spr, 'offsetY', clk);
  if (animOffX == null && animOffY == null) return { x: spr.x, y: spr.y };
  const baseRadius = Math.hypot(spr.x, spr.y);
  const baseAngle  = baseRadius > 0.001 ? Math.atan2(spr.y, spr.x) : 0;
  const radius = animOffX ?? baseRadius;
  const angle  = baseAngle + (animOffY ?? 0) / Math.max(radius, 1);
  return { x: radius * Math.cos(angle), y: radius * Math.sin(angle) };
}

// Returns the actual canvas position of the primary (i=0) copy of a sprite,
// accounting for animated orbit, offsetX/Y — matching the render transform chain.
// Resolves a shape's local (x, y) position for one frame, given its animated
// offsetX (radial: distance from center) / offsetY (tangential: arc-offset around center).
//
// When neither is animated, this is just the shape's static (x, y) — unchanged.
// When either is animated, position is computed in POLAR form around the shape's own
// rest bearing (baseAngle) so the two controls stay fully decoupled: animating radial
// alone always moves straight along the ray from center through the shape's rest
// position (zero tangential drift), and animating tangential alone always holds the
// radius fixed (zero radial drift) — regardless of how far off the guide spoke the
// shape was originally placed. A naive Cartesian override (old behavior) only stays
// pure-radial when the shape sits exactly on the spoke (y === 0).
function shapeRadialTangentialOffset(shape, clk) {
  const animOffX = getAnimValue(shape, 'offsetX', clk);
  const animOffY = getAnimValue(shape, 'offsetY', clk);
  if (animOffX == null && animOffY == null) return { x: shape.x, y: shape.y };
  const baseRadius = Math.hypot(shape.x, shape.y);
  const baseAngle  = baseRadius > 0.001 ? Math.atan2(shape.y, shape.x) : 0;
  const radius = animOffX ?? baseRadius;
  const angle  = baseAngle + (animOffY ?? 0) / Math.max(radius, 1);
  return { x: radius * Math.cos(angle), y: radius * Math.sin(angle) };
}

// A stroke's effective axis rotation (degrees), including its static Orbit
// offset and, if enabled, the animated value in place of the static one —
// same "extra rotation added to the axis spoke" model as shape orbit.
function strokeEffectiveRot(stroke, m, clk) {
  const base = (stroke.axisRotation != null ? stroke.axisRotation : m.axisRotation) || 0;
  const orbit = getAnimValue(stroke, 'orbit', clk) ?? (stroke.orbit || 0);
  return base + orbit;
}
// Draws one ordered entry (stroke/shape/sprite) straight to ctx, live —
// shared by renderMandala's full pass and renderMandalaLive's non-cached
// entries. skipSprites lets the Echo/Bloom "Exclude Images" sprite-split
// path omit sprites from this pass and re-composite them separately.
// ctx/canvas are explicit parameters (not bare globals) so this works
// correctly for any canvas instance — see drawMandalasWithOptionalSpriteSplit.
function renderLiveEntry(ctx, canvas, m, entry, skipSprites) {
  if (entry.type === 'stroke') {
    const stroke = entry.item;
    if (stroke.pts.length < 2 || stroke.visible === false) return;
    const axes = stroke.axes != null ? stroke.axes : m.axes;
    const rot  = strokeEffectiveRot(stroke, m, S.animClock);
    if (stroke.trailAnim?.enabled) {
      renderStrokeTrailSymmetric(ctx, m, stroke.pts, stroke.color, stroke.thickness, stroke.opacity, stroke.mirror !== false, axes, rot, stroke.trailAnim, stroke.gradient, stroke.erase);
    } else {
      renderStrokeSymmetric(ctx, m, stroke.pts, stroke.color, stroke.thickness, stroke.opacity, stroke.erase, stroke.mirror !== false, axes, rot, stroke.gradient || null);
    }
  } else if (entry.type === 'shape') {
    const shape = entry.item;
    if (shape.visible === false) return;
    // Text has no outline path for the generic arc-length trail renderer to
    // walk (getShapePoints returns [] for it) -- its own Fading Trail
    // handling lives inside renderTextShape/textFillStyle instead, reached
    // via the normal renderShapeSymmetric path.
    if (shape.trailAnim?.enabled && shape.type !== 'text') {
      renderShapeTrailSymmetric(ctx, m, shape);
    } else {
      renderShapeSymmetric(ctx, canvas, m, shape);
    }
  } else if (entry.type === 'sprite') {
    if (!skipSprites && entry.item.visible !== false) renderSprite(ctx, m, entry.item);
  }
}

// Full render — used by GIF/WebP export (no cache, everything drawn live
// in one pass through the real z order).
function renderMandala(ctx, canvas, m, forExport, skipSprites) {
  for (const entry of getOrderedEntries(m)) renderLiveEntry(ctx, canvas, m, entry, skipSprites);
}

// Live render — walks the same z order, but blits a pre-baked run canvas
// (see rebuildStrokeCache) wherever a maximal run of solid strokes sits,
// instead of redrawing them; everything else (gradient/trail/orbit/erase
// strokes, shapes, sprites) still renders live at its exact position in
// the walk, so the visible stacking always matches actual draw order.
// canvas is only needed to size a freshly-blitted run correctly if ever
// extended; runCaches defaults to the editor's shared cache Map so
// existing single-instance callers are unaffected — a player passes its
// own Map (see rebuildStrokeCache) to keep multiple instances' cached
// runs from colliding.
function renderMandalaLive(ctx, canvas, m, skipSprites, runCaches = _runCaches) {
  const entries = getOrderedEntries(m);
  const runs = runCaches.get(m.id) || [];
  let runIdx = 0;
  for (let i = 0; i < entries.length; i++) {
    if (runIdx < runs.length && i === runs[runIdx].startIdx) {
      ctx.drawImage(runs[runIdx].canvas, 0, 0);
      i = runs[runIdx].endIdx; // for-loop's i++ advances past the run next iteration
      runIdx++;
      continue;
    }
    renderLiveEntry(ctx, canvas, m, entries[i], skipSprites);
  }
}

// Renders a stroke into an arbitrary 2D context (used by stroke cache builder)
function renderStrokeSymmetricTo(tgt, m, pts, color, thickness, opacity, erase, mirror, axes, axisRotation, gradient) {
  const n = (axes != null ? axes : m.axes);
  const rotRad = ((axisRotation != null ? axisRotation : m.axisRotation) || 0) * Math.PI / 180;
  const effectiveN = n === 0 ? 1 : (mirror ? n : n * 2);
  const effectiveMirror = n === 0 ? false : mirror;
  const segAngle = effectiveN > 0 ? (Math.PI * 2) / effectiveN : 0;
  tgt.save();
  // Erase is a real alpha punch-through (destination-out) rather than a
  // painted background-coloured patch, so it correctly reveals whatever
  // ends up underneath at render time — including animated content that
  // moves through the erased area later — instead of permanently masking
  // whatever happened to be there when the erase stroke was drawn. The
  // stroke colour is irrelevant for destination-out (only its alpha
  // coverage matters), so `color` is left as-is.
  tgt.globalCompositeOperation = erase ? 'destination-out' : 'source-over';
  tgt.globalAlpha = opacity;
  tgt.strokeStyle = color;
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
  // See renderStrokeSymmetricTo — erase punches real alpha holes instead of
  // painting a background-coloured patch.
  ctx.globalCompositeOperation = erase ? 'destination-out' : 'source-over';
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
        ctx.strokeStyle = color;
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
  const sprRotation  = animRotation != null ? animRotation * Math.PI / 180 : spr.rotation;
  const sprOrbit     = (animOrbit    != null ? animOrbit    : (spr.orbitAngle || 0)) * Math.PI / 180;
  const { x: sprX, y: sprY } = spriteRadialTangentialOffset(spr, clk);

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
  } else if (shape.type === 'petal') {
    // One continuous loop: tip -> base along one curve, base -> tip back
    // along the mirrored curve. Equal point counts on both halves (they're
    // geometric mirrors) is what keeps a gradient's arc-length sampling
    // symmetric — see renderShapeInContext's gradient path for why that matters.
    for (const p of petalOutlinePoints(shape)) pts.push(p);
  } else if (shape.type === 'bezier') {
    for (const p of bezierOutlinePoints(shape)) pts.push(p);
  } else if (shape.type === 'wing') {
    for (const p of wingOutlinePoints(shape)) pts.push(p);
  }
  return pts;
}

// Shared petal geometry: tip is always local (0,0) since rendering has
// already translated to the shape's anchor by the time this runs.
function petalControlPoints(shape) {
  const dx = shape.petalDx || 0, dy = shape.petalDy || 0;
  const axisLen = Math.max(1, Math.hypot(dx, dy));
  const bulge = (shape.petalCurve ?? 0.35) * axisLen;
  const ux = dx / axisLen, uy = dy / axisLen;
  const px = -uy, py = ux; // perpendicular unit vector
  const midX = dx / 2, midY = dy / 2;
  return {
    dx, dy,
    cA: { x: midX + px * bulge, y: midY + py * bulge },
    cB: { x: midX - px * bulge, y: midY - py * bulge },
  };
}

function petalOutlinePoints(shape) {
  const { dx, dy, cA, cB } = petalControlPoints(shape);
  const axisLen = Math.max(1, Math.hypot(dx, dy));
  const N = Math.max(16, Math.round(axisLen * 0.15));
  const pts = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N, u = 1 - t;
    pts.push({ x: u * u * 0 + 2 * u * t * cA.x + t * t * dx, y: u * u * 0 + 2 * u * t * cA.y + t * t * dy });
  }
  for (let i = 1; i <= N; i++) {
    const t = i / N, u = 1 - t;
    pts.push({ x: u * u * dx + 2 * u * t * cB.x + t * t * 0, y: u * u * dy + 2 * u * t * cB.y + t * t * 0 });
  }
  return pts;
}

// Shared bezier geometry: an open single cubic Bezier from tip (0,0) to end
// (dx,dy), with two fully independent, freely-draggable control points —
// C1 near the tip, C2 near the end. Finalized shapes always have both set
// explicitly (see the Bezier tool's 3rd-click finalize); the fallback bulge
// formula here only covers the transient preview shape shown mid-creation,
// which is driven by a single S.bezierCurve scalar until it's finalized.
function bezierControlPoints(shape) {
  const dx = shape.bezierDx || 0, dy = shape.bezierDy || 0;
  let cA = (shape.bezierC1x != null && shape.bezierC1y != null) ? { x: shape.bezierC1x, y: shape.bezierC1y } : null;
  let cB = (shape.bezierC2x != null && shape.bezierC2y != null) ? { x: shape.bezierC2x, y: shape.bezierC2y } : null;
  if (!cA || !cB) {
    const axisLen = Math.max(1, Math.hypot(dx, dy));
    const bulge = (shape.bezierCurve ?? 0.35) * axisLen;
    const ux = dx / axisLen, uy = dy / axisLen;
    const px = -uy, py = ux;
    const midX = dx / 2, midY = dy / 2;
    if (!cA) cA = { x: midX + px * bulge, y: midY + py * bulge };
    if (!cB) cB = { x: midX - px * bulge, y: midY - py * bulge };
  }
  return { dx, dy, cA, cB };
}

// Samples a single cubic Bezier from (0,0) to (dx,dy) via control points
// cA, cB into N+1 points — shared by Bezier (one curve) and Wing (two).
function sampleCubicBezier(dx, dy, cA, cB) {
  const axisLen = Math.max(1, Math.hypot(dx, dy));
  const N = Math.max(16, Math.round(axisLen * 0.15));
  const pts = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N, u = 1 - t;
    const uu = u * u, tt = t * t, uut = 3 * uu * t, utt = 3 * u * tt;
    pts.push({
      x: uu * u * 0 + uut * cA.x + utt * cB.x + tt * t * dx,
      y: uu * u * 0 + uut * cA.y + utt * cB.y + tt * t * dy,
    });
  }
  return pts;
}

function bezierOutlinePoints(shape) {
  const { dx, dy, cA, cB } = bezierControlPoints(shape);
  return sampleCubicBezier(dx, dy, cA, cB);
}

// Reflects a point across the line through the origin at the given angle —
// used to derive Wing's second arm as a live mirror of its first.
function mirrorAcrossAxis(p, angle) {
  const ux = Math.cos(angle), uy = Math.sin(angle);
  const dot = p.x * ux + p.y * uy;
  return { x: 2 * dot * ux - p.x, y: 2 * dot * uy - p.y };
}

// Wing: Bezier's primary curve (tip -> bezierDx/Dy via bezierC1/C2, exactly
// like Bezier — same fields, same edit handles) plus a second arm that's a
// live mirror of it across an axis through the tip (stored per-shape as
// wingMirrorAngle, captured on the tool's first click as the tip->mandala-
// centre direction, so it always renders the same way it did while being
// drawn — see the 'wing' tool block in onMouseDown). Since the primary
// curve's end is wherever the cursor was clicked next — not constrained to
// that axis — the two arms read as visibly separate from the very first
// drag, unlike Petal's forced-closed loop; only a drag exactly along the
// mirror axis joins them at the bottom.
function wingCurves(shape) {
  const primary = bezierControlPoints(shape);
  const angle = shape.wingMirrorAngle || 0;
  const dx2 = mirrorAcrossAxis({ x: primary.dx, y: primary.dy }, angle);
  const cA2 = mirrorAcrossAxis(primary.cA, angle);
  const cB2 = mirrorAcrossAxis(primary.cB, angle);
  return { primary, mirrored: { dx: dx2.x, dy: dx2.y, cA: cA2, cB: cB2 } };
}

function wingOutlinePoints(shape) {
  const { primary, mirrored } = wingCurves(shape);
  return [
    ...sampleCubicBezier(primary.dx, primary.dy, primary.cA, primary.cB),
    ...sampleCubicBezier(mirrored.dx, mirrored.dy, mirrored.cA, mirrored.cB),
  ];
}

// Like wingOutlinePoints, but keeps the two arms as separate point lists
// instead of concatenating them — used for the gradient stroke walk so each
// arm's arc-length restarts at 0 from the shared tip, rather than one arm
// inheriting wherever the other left off (see the gradient stroke block in
// renderShapeInContext).
function wingArmPointLists(shape) {
  const { primary, mirrored } = wingCurves(shape);
  return [
    sampleCubicBezier(primary.dx, primary.dy, primary.cA, primary.cB),
    sampleCubicBezier(mirrored.dx, mirrored.dy, mirrored.cA, mirrored.cB),
  ];
}

// Cache Path2D objects per shape — rebuilds only when geometry changes.
const _path2DCache = new Map(); // shapeId → {r, type, p0, p1, path}
function evictPath2DCache(shapeId) { _path2DCache.delete(shapeId); }

function getShapePath2D(shape) {
  const r   = Math.max(1, shape.r);
  const p0  = shape.params?.points ?? shape.params?.sides ?? 0;
  const p1  = shape.params?.innerRatio ?? 0;
  // Petals have no r/params — key their cache entry on the geometry that
  // actually varies for them instead.
  const p2  = shape.type === 'petal' ? `${shape.petalDx || 0},${shape.petalDy || 0},${shape.petalCurve ?? 0.35}`
    : (shape.type === 'bezier' || shape.type === 'wing') ? `${shape.bezierDx || 0},${shape.bezierDy || 0},${shape.bezierCurve ?? ''},${shape.bezierC1x ?? ''},${shape.bezierC1y ?? ''},${shape.bezierC2x ?? ''},${shape.bezierC2y ?? ''},${shape.wingMirrorAngle ?? ''}`
    : '';
  const cached = _path2DCache.get(shape.id);
  if (cached && cached.r === r && cached.type === shape.type && cached.p0 === p0 && cached.p1 === p1 && cached.p2 === p2) {
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
  } else if (shape.type === 'petal') {
    // Two mirrored quadratic curves from tip (0,0) to base (dx,dy) — they
    // meet at both endpoints with different tangent directions, which is
    // exactly what gives the tip a sharp, unrounded point when stroked.
    const { dx, dy, cA, cB } = petalControlPoints(shape);
    p.moveTo(0, 0);
    p.quadraticCurveTo(cA.x, cA.y, dx, dy);
    p.quadraticCurveTo(cB.x, cB.y, 0, 0);
    p.closePath();
  } else if (shape.type === 'bezier') {
    // Single open cubic Bezier, tip to end — never closed, since this is
    // meant to read as one brush-like stroke, not an enclosed area.
    const { dx, dy, cA, cB } = bezierControlPoints(shape);
    p.moveTo(0, 0);
    p.bezierCurveTo(cA.x, cA.y, cB.x, cB.y, dx, dy);
  } else if (shape.type === 'wing') {
    // Two open subpaths sharing only the start (0,0) — Bezier's primary
    // curve, plus its live mirror across the fixed creation-time axis. Two
    // separate moveTo calls, not one closed loop, so they can drift apart.
    const { primary, mirrored } = wingCurves(shape);
    p.moveTo(0, 0);
    p.bezierCurveTo(primary.cA.x, primary.cA.y, primary.cB.x, primary.cB.y, primary.dx, primary.dy);
    p.moveTo(0, 0);
    p.bezierCurveTo(mirrored.cA.x, mirrored.cA.y, mirrored.cB.x, mirrored.cB.y, mirrored.dx, mirrored.dy);
  }

  _path2DCache.set(shape.id, { r, type: shape.type, p0, p1, p2, path: p });
  return p;
}

let _textTrailCanvas = null, _textTrailCtx = null;
function ensureTextTrailOffscreen(w, h) {
  if (!_textTrailCanvas || _textTrailCanvas.width !== w || _textTrailCanvas.height !== h) {
    _textTrailCanvas = document.createElement('canvas');
    _textTrailCanvas.width = w; _textTrailCanvas.height = h;
    _textTrailCtx = _textTrailCanvas.getContext('2d');
  }
}

// Text's Animated Gradient: strokes/shapes scroll their gradient by
// sampling sampleGradientRGB at (arc-length-distance / scale + timeOffset)
// for every point along their outline (see the stroke gradient renderer's
// `timeOffset`/`midD` math) — text has no arc-length path, but it does have
// a horizontal extent, so this samples the identical gradient function
// across x instead of distance-along-path, at enough stops (24) to read as
// a smooth scroll/shimmer rather than a banded one. Speed/Scale/Reverse are
// the exact same shape.gradient fields the stroke/shape UI already edits.
function textFillStyle(gctx, shape, w) {
  if (!shape.gradient) return shape.color || '#ffffff';
  const { scale, speed, reverse, stops } = shape.gradient;
  const grad = gctx.createLinearGradient(-w / 2, 0, w / 2, 0);
  const timeOffset = speed ? (S.animClock * speed * (reverse ? -1 : 1)) % 1 : 0;
  const SAMPLES = 24;
  for (let i = 0; i <= SAMPLES; i++) {
    const frac = i / SAMPLES;
    const x = -w / 2 + frac * w;
    const t = x / (scale || 100) + timeOffset;
    const { r, g, b } = sampleGradientRGB(stops, t);
    grad.addColorStop(frac, `rgb(${r},${g},${b})`);
  }
  return grad;
}

// How visible a point at arc-length fraction `frac` (0..1 along whatever's
// being revealed) should be, given trailWindows()'s output — same hard-cut
// head / 25%-of-window fade tail convention as renderTrailWindowInContext,
// but evaluated at a single fraction instead of walked along a Path2D. Takes
// the max across all returned windows (continuous mode can return two), so
// unlike the straight-line offscreen-mask version this doesn't need to drop
// any of them.
function trailAlphaAtFrac(frac, windows) {
  if (!windows || !windows.length) return 1;
  let alpha = 0;
  for (const win of windows) {
    const tailFrac = Math.max(0, win.tailFrac), headFrac = Math.min(1, win.headFrac);
    if (headFrac <= tailFrac || frac < tailFrac || frac > headFrac) continue;
    const fadeFrac = Math.max(0.001, (headFrac - tailFrac) * 0.25);
    const a = frac < tailFrac + fadeFrac ? (frac - tailFrac) / fadeFrac : 1;
    alpha = Math.max(alpha, a);
  }
  return alpha;
}

// ctx.measureText is the expensive part of arc text (and it's called once
// per glyph, per mirrored/axis copy, every animation frame) — cache glyph
// widths per font, and cache the whole computed layout (widths/angles/
// totalAngle) per shape.id, invalidated only when text/font/size/radius
// actually change. A shape with N axes × mirror draws N*2 copies per frame
// but they all share one shape.id, so this turns "measure every glyph on
// every copy every frame" into "measure once, reuse for the rest of that
// frame and every subsequent unchanged frame".
const _glyphWidthCache = new Map(); // fontKey -> Map<char, width>
function getGlyphWidth(tCtx, fontKey, ch) {
  let m = _glyphWidthCache.get(fontKey);
  if (!m) { m = new Map(); _glyphWidthCache.set(fontKey, m); }
  let w = m.get(ch);
  if (w === undefined) { w = tCtx.measureText(ch).width; m.set(ch, w); }
  return w;
}
const _arcLayoutCache = new Map(); // shape.id -> { sig, chars, widths, angles, totalAngle }
function getArcLayout(tCtx, shape, fontSize, radius) {
  const fontKey = `${fontSize}px ${shape.fontFamily || 'Inter'}`;
  const sig = `${shape.text}|${fontKey}|${radius}`;
  const cached = _arcLayoutCache.get(shape.id);
  if (cached && cached.sig === sig) return cached;
  tCtx.font = fontKey;
  const chars = [...(shape.text || '')];
  const widths = chars.map(ch => getGlyphWidth(tCtx, fontKey, ch));
  const angles = widths.map(w => w / radius);
  const totalAngle = angles.reduce((a, b) => a + b, 0);
  const entry = { sig, chars, widths, angles, totalAngle };
  _arcLayoutCache.set(shape.id, entry);
  return entry;
}

// Arc text: walks the string glyph-by-glyph around a circle of the given
// radius, placing each character at real arc-length spacing (angle = glyph
// width / radius) so letters don't stretch or compress — unlike the
// straight-baseline path, gradient/trail don't need an offscreen mask here:
// each glyph already gets its own transform+draw call, so gradient colour
// and trail alpha are just sampled once per glyph at that glyph's walked-
// distance fraction, same underlying math (sampleGradientRGB / trailWindows)
// as the straight path, just evaluated per-character instead of per-pixel.
function renderArcText(tCtx, shape) {
  const text = shape.text || '';
  if (!text) return;
  const fontSize = shape.fontSize || 48;
  const radius = shape.arc.radius || 150;
  const dir = shape.arc.direction === -1 ? -1 : 1;
  const flip = !!shape.arc.flip;
  const startAngle = (shape.arc.startAngle || 0) * Math.PI / 180;

  const { chars, angles, totalAngle } = getArcLayout(tCtx, shape, fontSize, radius);
  if (!chars.length || !totalAngle) return;
  tCtx.font = `${fontSize}px ${shape.fontFamily || 'Inter'}`;

  const windows = shape.trailAnim?.enabled ? trailWindows(shape.trailAnim, S.animClock, false) : null;
  const gradient = shape.gradient;
  const timeOffset = gradient?.speed ? (S.animClock * gradient.speed * (gradient.reverse ? -1 : 1)) % 1 : 0;

  tCtx.save();
  let walked = 0;
  for (let i = 0; i < chars.length; i++) {
    const glyphAngle = walked + angles[i] / 2;
    let frac = glyphAngle / totalAngle;
    if (flip) frac = 1 - frac;
    const alpha = trailAlphaAtFrac(frac, windows);
    walked += angles[i];
    if (alpha <= 0) continue;

    const theta = startAngle + dir * glyphAngle * (flip ? -1 : 1);
    const x = radius * Math.cos(theta);
    const y = radius * Math.sin(theta);

    let fillStyle = shape.color || '#ffffff';
    if (gradient) {
      const t = frac + timeOffset;
      const { r, g, b } = sampleGradientRGB(gradient.stops, t);
      fillStyle = `rgb(${r},${g},${b})`;
    }

    tCtx.save();
    tCtx.translate(x, y);
    tCtx.rotate(theta + Math.PI / 2 * dir + (flip ? Math.PI : 0));
    tCtx.textAlign = 'center';
    tCtx.textBaseline = 'middle';
    tCtx.globalAlpha = (shape.opacity ?? 1) * alpha;
    tCtx.fillStyle = fillStyle;
    tCtx.fillText(chars[i], 0, 0);
    tCtx.restore();
  }
  tCtx.restore();
}

// Text renders straight through fillText — no Path2D fill/stroke geometry
// (that machinery, and its arc-length-walk gradient stroke renderer, is
// built for vector outline shapes; textFillStyle above is the equivalent
// for a filled word/phrase without per-glyph gradient sampling).
//
// Fading Trail: strokes/shapes reveal a [tailFrac, headFrac] arc-length
// window of their outline (trailWindows), with a hard cutoff at the
// leading edge and a 25%-of-window linear fade at the trailing edge (see
// renderTrailWindowInContext). Text has no outline path to walk either,
// so this maps that same window onto the text's horizontal extent instead
// — draws the (possibly gradient-filled) text to an offscreen canvas, then
// punches the same tail-faded/head-cut window into it as an alpha mask via
// destination-in, so a comet-like reveal sweeps across the string the same
// way it would sweep along a stroke.
// Builds a flat, horizontally-laid-out rendering of the text — colour/
// gradient via textFillStyle, Fading Trail applied as a continuous
// destination-in alpha mask (same hard-head/25%-tail-fade convention as
// everywhere else) — onto the reusable offscreen canvas. Shared by the
// straight-baseline trail path and Warp arc mode, which bends this same
// rasterized strip around a circle (see renderWarpArcText) exactly the way
// renderSprite's warpMode bends an uploaded image. Returns null if a trail
// window closes the text out entirely (nothing to draw).
function buildFlatTextCanvas(shape, w) {
  const fontSize = shape.fontSize || 48;
  const text = shape.text || '';
  const pad = fontSize; // room for ascenders/descenders/glyph overhang
  const cw = Math.max(1, Math.ceil(w + pad * 2)), ch = Math.max(1, Math.ceil(fontSize * 2 + pad * 2));
  ensureTextTrailOffscreen(cw, ch);
  _textTrailCtx.clearRect(0, 0, cw, ch);
  _textTrailCtx.save();
  _textTrailCtx.translate(cw / 2, ch / 2);
  _textTrailCtx.font = `${fontSize}px ${shape.fontFamily || 'Inter'}`;
  _textTrailCtx.textAlign = 'center';
  _textTrailCtx.textBaseline = 'middle';
  _textTrailCtx.fillStyle = textFillStyle(_textTrailCtx, shape, w);
  _textTrailCtx.fillText(text, 0, 0);
  _textTrailCtx.restore();

  if (shape.trailAnim?.enabled) {
    const win = trailWindows(shape.trailAnim, S.animClock, false)[0];
    if (!win || win.headFrac <= win.tailFrac) return null;
    const tailFrac = Math.max(0, win.tailFrac), headFrac = Math.min(1, win.headFrac);
    const fadeFrac = Math.max(0.001, (headFrac - tailFrac) * 0.25);
    // Reverse: strokes flip which end of the point list is arc-length 0
    // (see pts.reverse() elsewhere); text has no point list, so the same
    // effect — sweep the other way across the string — comes from just
    // swapping which physical edge t=0/t=1 map to.
    const rev = !!shape.trailAnim.reverse;
    const mask = _textTrailCtx.createLinearGradient(rev ? w / 2 : -w / 2, 0, rev ? -w / 2 : w / 2, 0);
    let lastPos = -1;
    const stop = (t, a) => {
      const pos = Math.max(lastPos, Math.max(0, Math.min(1, t)));
      mask.addColorStop(pos, `rgba(255,255,255,${a})`);
      lastPos = pos;
    };
    stop(0, 0);
    stop(tailFrac, 0);
    stop(tailFrac + fadeFrac, 1);
    stop(headFrac, 1);
    stop(headFrac + 0.001, 0);
    stop(1, 0);
    _textTrailCtx.save();
    _textTrailCtx.translate(cw / 2, ch / 2);
    _textTrailCtx.globalCompositeOperation = 'destination-in';
    _textTrailCtx.fillStyle = mask;
    _textTrailCtx.fillRect(-cw / 2, -ch / 2, cw, ch);
    _textTrailCtx.restore();
  }
  return { canvas: _textTrailCanvas, w: cw, h: ch };
}

function renderTextShape(tCtx, shape) {
  const text = shape.text || '';
  if (!text) return;
  if (shape.arc?.enabled) {
    (shape.arc.warp ? renderWarpArcText : renderArcText)(tCtx, shape);
    return;
  }
  const fontSize = shape.fontSize || 48;
  const w = measureTextShapeWidth(shape);

  if (shape.trailAnim?.enabled) {
    const flat = buildFlatTextCanvas(shape, w);
    if (!flat) return;
    tCtx.save();
    tCtx.globalAlpha = shape.opacity ?? 1;
    tCtx.drawImage(flat.canvas, -flat.w / 2, -flat.h / 2);
    tCtx.restore();
    return;
  }

  tCtx.save();
  tCtx.globalAlpha = shape.opacity ?? 1;
  tCtx.font = `${fontSize}px ${shape.fontFamily || 'Inter'}`;
  tCtx.textAlign = 'center';
  tCtx.textBaseline = 'middle';
  tCtx.fillStyle = textFillStyle(tCtx, shape, w);
  tCtx.fillText(text, 0, 0);
  tCtx.restore();
}

// Warp arc text: instead of placing each glyph as its own rigid rotated
// copy (renderArcText), this renders the text flat once — reusing the
// exact same gradient/trail treatment as the straight path via
// buildFlatTextCanvas, so Fading Trail here is a smooth continuous sweep
// across the rendered pixels, not a per-letter on/off step — then bends
// that rasterized strip around the circle exactly the way renderSprite's
// warpMode bends an uploaded image: sliced into thin angular strips, each
// rotated into its own position. Letters visually curve/stretch along the
// arc instead of staying rigid, closer to a real logo/badge text warp.
// Uses the same radius/startAngle/direction/flip fields as renderArcText
// (and the same translate+rotate-per-slice convention, just with N evenly
// spaced slices instead of one draw per glyph) so switching Warp on/off
// keeps the text sitting in the same place.
function renderWarpArcText(tCtx, shape) {
  const text = shape.text || '';
  if (!text) return;
  const fontSize = shape.fontSize || 48;
  const radius = shape.arc.radius || 150;
  const dir = shape.arc.direction === -1 ? -1 : 1;
  const flip = !!shape.arc.flip;
  const startAngle = (shape.arc.startAngle || 0) * Math.PI / 180;

  const w = measureTextShapeWidth(shape);
  if (!w) return;
  const totalAngle = w / radius;
  if (!totalAngle) return;

  const flat = buildFlatTextCanvas(shape, w);
  if (!flat) return;
  const { canvas: src, w: cw, h: ch } = flat;
  const dispH = fontSize * 1.6; // matches the vertical band buildFlatTextCanvas actually paints into
  const N = Math.max(32, Math.round(w / 1.5));

  tCtx.save();
  tCtx.globalAlpha = shape.opacity ?? 1;
  for (let si = 0; si < N; si++) {
    const t = (si + 0.5) / N;
    const glyphAngle = t * totalAngle;
    const theta = startAngle + dir * glyphAngle * (flip ? -1 : 1);
    const srcX = cw / 2 - w / 2 + t * w;
    const srcW = Math.max(1, w / N);
    const sliceW = srcW * 1.5; // slight overlap avoids seams between slices, same trick sprite warp uses

    tCtx.save();
    tCtx.translate(radius * Math.cos(theta), radius * Math.sin(theta));
    tCtx.rotate(theta + Math.PI / 2 * dir + (flip ? Math.PI : 0));
    tCtx.drawImage(src, srcX - srcW / 2, ch / 2 - dispH / 2, srcW, dispH, -sliceW / 2, -dispH / 2, sliceW, dispH);
    tCtx.restore();
  }
  tCtx.restore();
}

// canvas is only needed by the composite gradient-stroke branch below (to
// size its offscreen buffers correctly) — an explicit parameter rather
// than a bare global so this renders correctly against any canvas
// instance, not just "the" editor canvas.
function renderShapeInContext(tCtx, canvas, shape) {
  if (shape.type === 'text') { renderTextShape(tCtx, shape); return; }
  const path = getShapePath2D(shape);
  tCtx.save();
  tCtx.globalAlpha = shape.opacity || 1;
  tCtx.lineCap = shape.lineCap || 'round';
  tCtx.lineJoin = shape.lineJoin || 'round';
  // Scale dash pattern relative to line thickness so it stays proportional
  const t = shape.thickness || 1;
  tCtx.setLineDash((shape.dash || []).map(v => v * t));

  // Fill (always use Path2D) — bezier/wing are always open/unfilled.
  const isOpenCurve = shape.type === 'bezier' || shape.type === 'wing';
  if (shape.fill && !isOpenCurve) { tCtx.fillStyle = shape.fill; tCtx.fill(path); }

  // Stroke
  if (shape.gradient) {
    const scaledDash = (shape.dash && shape.dash.length) ? shape.dash.map(v => v * t) : null;
    const lineCap    = shape.lineCap  || 'round';
    const lineJoin   = shape.lineJoin || 'round';
    const isWing     = shape.type === 'wing';
    // Wing's two arms are disconnected subpaths that both start at the tip.
    // Walked as separate point lists (each restarting its own arc-length at
    // 0) rather than one concatenated list, so both arms sample the same
    // gradient colour at the shared tip and read as true mirror images of
    // each other; concatenating them would also bridge a phantom segment
    // between the arms, which forcing the masked/composite path below hides
    // (the mask comes from the real two-subpath Path2D, which has no ink in
    // the gap).
    const armPtsList = isWing ? wingArmPointLists(shape) : [getShapePoints(shape)];
    const needsComposite = lineJoin !== 'round' || (lineCap !== 'round' && scaledDash) || isWing;

    if (armPtsList.some(pts => pts.length > 1)) {
      if (needsComposite) {
        // Composite approach: render gradient colours to a temp canvas, then
        // mask with a native stroke (correct lineCap/lineJoin/dash) via destination-in.
        const W = canvas.width, H = canvas.height;
        _ensureGradOffscreen(W, H);
        const xf = tCtx.getTransform();

        // 1. Draw gradient arc-walk(s) into colour canvas — one call per arm
        // for Wing so each starts fresh at the tip.
        _gradColorCtx.clearRect(0, 0, W, H);
        _gradColorCtx.setTransform(xf);
        for (const pts of armPtsList) {
          if (pts.length > 1) renderGradientSegments(pts, shape.gradient, shape.thickness, null, 'round', _gradColorCtx);
        }
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

        // 4. Blit to the target canvas (bypass current transform — already baked in)
        tCtx.save();
        tCtx.resetTransform();
        tCtx.globalAlpha = shape.opacity || 1;
        tCtx.drawImage(_gradColorCanvas, 0, 0);
        tCtx.restore();
      } else {
        renderGradientSegments(armPtsList[0], shape.gradient, shape.thickness, scaledDash, lineCap);
      }
    }
  } else {
    tCtx.strokeStyle = shape.color;
    tCtx.lineWidth = shape.thickness;
    tCtx.stroke(path);
  }
  tCtx.restore();
}

// Resolves animated property values onto the reused shape proxy, plus the
// rotation/offset/axis parameters every per-copy render loop needs — shared
// by renderShapeSymmetric and renderShapeTrailSymmetric so both stay in sync.
function computeShapeRenderParams(shape) {
  const clk = S.animClock;
  const animR       = getAnimValue(shape, 'radius',    clk);
  const animThick   = getAnimValue(shape, 'thickness', clk);
  const animOp      = getAnimValue(shape, 'opacity',   clk);
  const animRot     = getAnimValue(shape, 'rotation',  clk);
  const animOrbit   = getAnimValue(shape, 'orbit',     clk);

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
  _shapeProxy.petalDx   = shape.petalDx;
  _shapeProxy.petalDy   = shape.petalDy;
  _shapeProxy.petalCurve = shape.petalCurve;
  _shapeProxy.bezierDx  = shape.bezierDx;
  _shapeProxy.bezierDy  = shape.bezierDy;
  _shapeProxy.bezierCurve = shape.bezierCurve;
  _shapeProxy.bezierC1x = shape.bezierC1x;
  _shapeProxy.bezierC1y = shape.bezierC1y;
  _shapeProxy.bezierC2x = shape.bezierC2x;
  _shapeProxy.bezierC2y = shape.bezierC2y;
  _shapeProxy.wingMirrorAngle = shape.wingMirrorAngle;
  _shapeProxy.text       = shape.text;
  _shapeProxy.fontFamily = shape.fontFamily;
  _shapeProxy.fontSize   = shape.fontSize;
  _shapeProxy.trailAnim  = shape.trailAnim;
  _shapeProxy.arc        = shape.arc;
  const effShape = _shapeProxy;

  const effRotRad   = (animRot   ?? (shape.rotation  || 0)) * Math.PI / 180;
  const effOrbitRad = (animOrbit ?? (shape.orbit      || 0)) * Math.PI / 180;
  const { x: effX, y: effY } = shapeRadialTangentialOffset(shape, clk);

  return { effShape, effRotRad, effOrbitRad, effX, effY };
}
// axes/axisRotation/mirror fall back to the mandala's own settings when a
// shape doesn't override them, which needs `m` — resolved inline in each
// render function below rather than here.

// Rotates around Petal/Bezier/Wing's tip->end midpoint instead of the local
// origin — those types store x/y as the tip, not the center, so rotating at
// the origin would swing the whole shape around its tip instead of turning
// it in place. Wing reuses Bezier's primary-curve fields, so its pivot is
// the same midpoint as Bezier's. No-op (plain rotate) for every other type.
function applyShapeLocalRotation(tCtx, shape, effRotRad) {
  if (!effRotRad) return;
  if (shape.type === 'petal' || shape.type === 'bezier' || shape.type === 'wing') {
    const rawDx = shape.type === 'petal' ? shape.petalDx : shape.bezierDx;
    const rawDy = shape.type === 'petal' ? shape.petalDy : shape.bezierDy;
    const pvx = (rawDx || 0) / 2, pvy = (rawDy || 0) / 2;
    tCtx.translate(pvx, pvy);
    tCtx.rotate(effRotRad);
    tCtx.translate(-pvx, -pvy);
  } else {
    tCtx.rotate(effRotRad);
  }
}

function renderShapeSymmetric(tCtx, canvas, m, shape) {
  const { effShape, effRotRad, effOrbitRad, effX, effY } = computeShapeRenderParams(shape);

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
      applyShapeLocalRotation(tCtx, shape, effRotRad);
      renderShapeInContext(tCtx, canvas, effShape);
      tCtx.restore();
    }
  }
  tCtx.restore();
}

// Fading-trail counterpart to renderShapeSymmetric — same per-copy transform
// pipeline (including the petal/bezier/wing pivot rotation), but draws the
// [tailFrac, headFrac] arc-length window of the shape's outline instead of
// the whole thing, via the same low-level walker strokes use.
function renderShapeTrailSymmetric(tCtx, m, shape) {
  const { effShape, effRotRad, effOrbitRad, effX, effY } = computeShapeRenderParams(shape);
  // Wing's two arms are separate subpaths that both start at the tip (see
  // wingArmPointLists) — walked as independent point lists here too, each
  // with its own trailWindows() call, so they read as two simultaneous
  // trails sweeping outward together instead of one trail whose arc-length
  // walk jumps straight across the gap between the arms' endpoints (the
  // same phantom-bridge issue the gradient stroke renderer had).
  const isWing = effShape.type === 'wing';
  let armPtsList = isWing ? wingArmPointLists(effShape) : [getShapePoints(effShape)];
  // See renderStrokeTrailSymmetric — reversing each arm's own point order
  // flips its arc-length 0 end, which is enough to reverse its direction of
  // travel without touching any of the window/fraction math below.
  if (shape.trailAnim.reverse) armPtsList = armPtsList.map(pts => [...pts].reverse());
  const armWindows = armPtsList.map(pts =>
    pts.length < 2 ? null : trailWindows(shape.trailAnim, S.animClock, isClosedLoop(pts))
  );
  if (armWindows.every(w => !w || !w.length)) return;

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
      applyShapeLocalRotation(tCtx, shape, effRotRad);
      for (let a = 0; a < armPtsList.length; a++) {
        const windows = armWindows[a];
        if (!windows) continue;
        for (const window of windows) renderTrailWindowInContext(tCtx, armPtsList[a], effShape.color, effShape.thickness, effShape.opacity, effShape.gradient, window);
      }
      tCtx.restore();
    }
  }
  tCtx.restore();
}

// Petals aren't radius-based, so their approximate hit-circle (same
// "close enough" style as the other shapes below) is centred on the
// tip->base midpoint instead of the anchor, with the axis half-length as
// its radius. Ignores shape.rotation, same simplification the other shape
// types already accept here.
// Text has no natural "radius" — measures its rendered width (via the
// global ctx, temporarily repointed at the shape's font) so hit-testing,
// selection handles, and the fill/gradient bounding box all agree on the
// same size.
// Called several times per shape per frame (hit-testing, trail masking,
// straight fill) plus once per mirrored/axis copy, so the same
// text+font+size combination gets re-measured many times a frame without
// this cache — measureText is the expensive part, not the lookup.
const _textWidthCache = new Map(); // `${fontKey}|${text}` -> width
function measureTextShapeWidth(shape) {
  const fontKey = `${shape.fontSize || 48}px ${shape.fontFamily || 'Inter'}`;
  const text = shape.text || '';
  const cacheKey = fontKey + '|' + text;
  let w = _textWidthCache.get(cacheKey);
  if (w === undefined) {
    ctx.save();
    ctx.font = fontKey;
    w = ctx.measureText(text).width;
    ctx.restore();
    _textWidthCache.set(cacheKey, w);
  }
  return w;
}

function shapeHitCircle(shape) {
  if (shape.type === 'text') {
    if (shape.arc?.enabled) {
      const r = (shape.arc.radius || 150) + (shape.fontSize || 48);
      return { cx: shape.x, cy: shape.y, r };
    }
    const w = measureTextShapeWidth(shape), h = shape.fontSize || 48;
    return { cx: shape.x, cy: shape.y, r: Math.hypot(w, h) / 2 + 8 };
  }
  if (shape.type === 'petal' || shape.type === 'bezier' || shape.type === 'wing') {
    const dx = shape.type === 'petal' ? (shape.petalDx || 0) : (shape.bezierDx || 0);
    const dy = shape.type === 'petal' ? (shape.petalDy || 0) : (shape.bezierDy || 0);
    return {
      cx: shape.x + dx / 2,
      cy: shape.y + dy / 2,
      r: Math.hypot(dx, dy) / 2 + (shape.thickness || 2) / 2 + 8,
    };
  }
  return { cx: shape.x, cy: shape.y, r: shape.r + (shape.thickness || 2) / 2 + 8 };
}

function dataUrlToArrayBuffer(dataUrl) {
  const base64 = dataUrl.split(',')[1];
  const binary = atob(base64);
  const buf = new ArrayBuffer(binary.length);
  const view = new Uint8Array(buf);
  for (let i = 0; i < binary.length; i++) view[i] = binary.charCodeAt(i);
  return buf;
}
