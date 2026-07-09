// ═══════════════════════════════════════════════════════
//  MANDALA MAKER — app.js
// ═══════════════════════════════════════════════════════

// ── Version ────────────────────────────────────────────
const VERSION = '3.95';

// A fixed colour, deliberately not in MANDALA_COLORS, for the axis-snap
// dots/rays — they used to reuse the active mandala's own accent colour
// (the same colour as its axis guide lines), which made the two easy to
// mix up on screen. A single consistent colour also means snap dots read
// the same way regardless of which mandala/colour is currently active.
const SNAP_AXIS_COLOR = '#ffffff';

// ── Load Demo list ──────────────────────────────────────
// The ONLY places to touch when adding a demo:
//   1. Save the project from the app (Save button) → examples/<Name>.json
//   2. Wrap it as examples/<Name>.js:
//        window.MANDALIZE_DEMOS = window.MANDALIZE_DEMOS || {};
//        window.MANDALIZE_DEMOS["<Name>"] = <paste the .json content here>;
//      (a one-line shell command: see the header comment in any existing
//      examples/*.js for the exact wrap, or just copy one and swap the
//      name + JSON body)
//   3. Add one { file: '<Name>', label: '...' } entry below.
// Nothing else — the "Load Demo" dropdown and its click handlers are built
// generically from this array in wireEvents(). Removing a demo is just
// deleting its entry here (the .json/.js files can stay or go).
//
// Demos are loaded as a plain <script> (see loadDemo()), not fetch()/XHR,
// specifically so this works when index.html is opened directly via a
// file:// URL and not just when served over http(s) — browsers block
// fetch()/XHR reads of local files (CORS), but a <script src="local.js">
// load isn't subject to that restriction, the same reason index.html can
// already load app.js/style.css locally. That's also why each demo needs
// its own small .js wrapper around the raw .json instead of being fetched
// as JSON directly.
const DEMO_EXAMPLES = [
  { file: 'ChakraAwakening', label: 'Chakra Awakening' },
  { file: 'ItsOnLikeKong',   label: "It's On Like Kong" },
  { file: 'NeonDreams',      label: 'Neon Dreams' },
  { file: 'RainbowNova',     label: 'Rainbow Nova' },
  { file: 'ScribedOrchid',   label: 'Scribed Orchid' },
  { file: 'TheThirdEye',     label: 'The Third Eye' },
  { file: 'WeComeInPeace',   label: 'We Come In Peace' },
  { file: 'Spirograph',      label: 'Spirograph' },
  { file: 'OrchidInBloom',   label: 'Orchid In Bloom' },
  { file: 'Hadouken',        label: 'Hadouken' },
  { file: 'ThereIsNoSpoon',  label: 'There Is No Spoon' },
];

const HANDLE_RADIUS = 7;
const MAX_HISTORY = 50;
// Wing's mirror axis is a fixed vertical line through the tip (local,
// unrotated space) — not derived from the drag direction — so both bottom
// points are already distinct and independently visible from the very
// start of the drag, rather than only diverging once edited afterward.
const WING_MIRROR_ANGLE = Math.PI / 2;

// ── State ───────────────────────────────────────────────
const S = {
  // scene
  mandalas: [],
  activeIdx: 0,

  // Global post-process effects stack — see "EFFECT-MODULE" comments
  // (search that tag to find every place a new effect module needs to hook
  // in) starting around EFFECT_TYPES below.
  effects: [],
  effectsCollapsed: false,

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

  // petal tool transient — three-click creation, no dragging: null -> 'axis'
  // (base follows cursor until click 2) -> 'curve' (curvature follows cursor
  // until click 3 finalizes) -> null
  petalPhase: null,
  petalTip: null,
  petalBase: null,
  petalCurve: 0.35,

  // bezier tool transient — an open (unfilled) single curve, same
  // three-click creation as petal (tip -> end -> curvature). The end's
  // tangent handle (its second Bezier control point) is edit-only — it
  // defaults to mirroring the curvature handle until independently dragged.
  bezierPhase: null,
  bezierTip: null,
  bezierEnd: null,
  bezierCurve: 0.35,

  // wing tool transient — identical three-click creation to Bezier. On
  // finalize it becomes a 'wing' shape: Bezier's primary curve plus a
  // second arm that's a live mirror of it across the axis captured at
  // that moment (see wingCurves in the shape-geometry section).
  wingPhase: null,
  wingTip: null,
  wingEnd: null,
  wingCurve: 0.35,
  wingMirrorAngle: 0,  // captured from tip->mandala-centre direction on the first click

  // drawing transient
  drawing: false,
  pts: [],

  // line tool transient — click-to-place-start, click-to-finish, same
  // 'axis'-phase click flow as Petal/Bezier/Wing's first stage but with no
  // curvature phase. Shared by 'line' (single segment) and 'lineChain'
  // (auto-restarts from the just-placed end after each finalize).
  linePhase: null,     // null | 'axis'
  lineTip: null,
  lineEnd: null,
  // The one stroke object a Line Chain sequence is building — each
  // finalized segment appends a point to this same stroke's `pts` instead
  // of pushing a whole separate stroke, so the chain renders/animates/
  // selects as a single continuous polyline. Reset to null whenever a
  // chain ends (Escape or switching tools) so the next chain starts fresh.
  lineChainStroke: null,

  // sprite selection
  selectedSpriteId: null,
  dragHandle: null,     // 'move' | 'scale-*' | 'rotate' | 'mandala-move'
  dragMandalaId: null,  // id of mandala being dragged
  mandalaOrigin: null,  // {cx, cy} before drag started
  dragStart: null,
  spriteDragOrigin: null,

  // palette
  palette: [],      // {id,name,img,dataUrl,isGif,transparentColor,tolerance,isSpriteSheet,cols,rows,selectedCell,processedCache}
  // Uploaded custom fonts for the Text tool — {id, name (display), family
  // (internal unique CSS font-family), dataUrl (base64, so it round-trips
  // through save/load the same way palette images already do; a browser
  // FontFace registration doesn't survive a reload on its own, so this is
  // what actually persists the font itself, not just a reference to it).
  customFonts: [],
  selectedPaletteId: null,
  selectedStrokeId: null,

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
  touchPan: null,       // two-finger pinch/pan gesture state — see wireViewport's touch handlers
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


function findMatchingPresetName(stops) {
  if (!stops) return '';
  for (const name of Object.keys(GRADIENT_PRESETS)) {
    const preset = GRADIENT_PRESETS[name];
    if (stops.length !== preset.length) continue;
    if (stops.every((s, i) => s.pos === preset[i].pos && s.color === preset[i].color)) return name;
  }
  return '';
}

// Render a stroke using a cycling gradient along its length.
// Called inside a ctx.save() block that has already set translate+rotate for one symmetry cell.
// dashArr: pre-scaled array (px values), e.g. [15, 10]. null = solid.
// capType: 'round' | 'butt' | 'square'. 'round' is required for smooth gradient blending on solid strokes.
// Reusable offscreen canvases for gradient-shape compositing
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
  { key: 'scale',    label: 'Scale',      min: 0.05, max: 8,   format: v => v.toFixed(2)+'×' },
  { key: 'rotation', label: 'Rotation',   min: -180,  max: 180, format: v => Math.round(v)+'°' },
  { key: 'orbit',    label: 'Orbit',      min: -180,  max: 180, format: v => Math.round(v)+'°' },
  // Radial is a literal distance-from-centre fed straight into
  // radius*cos/sin, not a signed Cartesian offset — 0 (bottom of the
  // timeline curve) means "at the centre", max (top) means "out past the
  // default canvas's centre-to-corner distance" (750px at 1200x900; 800
  // lands just beyond it). A negative radius would flip the angle 180°
  // and throw the shape through the centre to the opposite side, which
  // reads as confusing rather than useful, hence starting the range at 0.
  { key: 'offsetX',  label: 'Radial',     min: 0,  max: 800, format: v => Math.round(v) },
  { key: 'offsetY',  label: 'Tangential', min: -500,  max: 500, format: v => Math.round(v) },
  { key: 'opacity',  label: 'Opacity',    min: 0,     max: 1,   format: v => Math.round(v*100)+'%' },
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
  // Radial/Tangential presets — kept identical to SHAPE_ANIM_PRESETS'
  // offsetX/offsetY (defined further down) so a stamped sprite's motion
  // presets match a shape's exactly; duplicated rather than referenced
  // since SHAPE_ANIM_PRESETS is declared later in the file (const TDZ).
  offsetX: [
    { label: 'Pulse Out', kfs: [{t:0,v:60,e:'ease'},{t:0.5,v:220,e:'ease'},{t:1,v:60,e:'ease'}], dur: 2 },
    { label: 'Breathe',   kfs: [{t:0,v:100,e:'ease-in'},{t:0.5,v:180,e:'ease-out'},{t:1,v:100,e:'ease-in'}], dur: 4 },
    { label: 'Approach',  kfs: [{t:0,v:250,e:'ease'},{t:0.5,v:40,e:'ease'},{t:1,v:250,e:'ease'}], dur: 3 },
    { label: 'Expand',    kfs: [{t:0,v:40,e:'linear'},{t:1,v:300,e:'linear'}], dur: 3 },
    { label: 'Heartbeat', kfs: [{t:0,v:80,e:'ease'},{t:0.15,v:180,e:'ease'},{t:0.3,v:80,e:'ease'},{t:0.45,v:200,e:'ease'},{t:1,v:80,e:'ease'}], dur: 1.5 },
  ],
  offsetY: [
    { label: 'Arc Swing',  kfs: [{t:0,v:-60,e:'ease'},{t:0.5,v:60,e:'ease'},{t:1,v:-60,e:'ease'}], dur: 2 },
    { label: 'Drift',      kfs: [{t:0,v:-80,e:'ease'},{t:1,v:80,e:'ease'}], dur: 3 },
    { label: 'Shimmer',    kfs: [{t:0,v:-20,e:'ease'},{t:0.25,v:20,e:'ease'},{t:0.5,v:-20,e:'ease'},{t:0.75,v:20,e:'ease'},{t:1,v:-20,e:'ease'}], dur: 1.5 },
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
  // See ANIM_PROPS' offsetX comment — same radius*cos/sin semantics, so the
  // same 0-at-bottom/800-at-top range (not the old signed -500..500).
  { key: 'offsetX',   label: 'Radial',     min: 0,    max: 800, format: v => Math.round(v) },
  { key: 'offsetY',   label: 'Tangential', min: -500, max: 500, format: v => Math.round(v) },
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
  // Offset X drives motion ALONG the axis spoke (in/out from center) — this is the
  // radial control. Positive = further out. Presets stay on one side of center
  // (all-positive values) so the shape doesn't flip through to the opposite spoke.
  offsetX:   [
    { label: 'Pulse Out', kfs: [{t:0,v:60,e:'ease'},{t:0.5,v:220,e:'ease'},{t:1,v:60,e:'ease'}], dur: 2 },
    { label: 'Breathe',   kfs: [{t:0,v:100,e:'ease-in'},{t:0.5,v:180,e:'ease-out'},{t:1,v:100,e:'ease-in'}], dur: 4 },
    { label: 'Approach',  kfs: [{t:0,v:250,e:'ease'},{t:0.5,v:40,e:'ease'},{t:1,v:250,e:'ease'}], dur: 3 },
    { label: 'Expand',    kfs: [{t:0,v:40,e:'linear'},{t:1,v:300,e:'linear'}], dur: 3 },
    { label: 'Heartbeat', kfs: [{t:0,v:80,e:'ease'},{t:0.15,v:180,e:'ease'},{t:0.3,v:80,e:'ease'},{t:0.45,v:200,e:'ease'},{t:1,v:80,e:'ease'}], dur: 1.5 },
  ],
  // Offset Y drives motion PERPENDICULAR to the axis spoke (side-to-side around
  // the ring) — this is the tangential control.
  offsetY:   [
    { label: 'Arc Swing',  kfs: [{t:0,v:-60,e:'ease'},{t:0.5,v:60,e:'ease'},{t:1,v:-60,e:'ease'}], dur: 2 },
    { label: 'Drift',      kfs: [{t:0,v:-80,e:'ease'},{t:1,v:80,e:'ease'}], dur: 3 },
    { label: 'Shimmer',    kfs: [{t:0,v:-20,e:'ease'},{t:0.25,v:20,e:'ease'},{t:0.5,v:-20,e:'ease'},{t:0.75,v:20,e:'ease'},{t:1,v:-20,e:'ease'}], dur: 1.5 },
  ],
};

// ═══════════════════════════════════════════════════════════════════════
// EFFECT-MODULE: registry — global post-process effects stack.
//
// This is the ONLY place a new effect module needs a manual entry. Search
// the tag "EFFECT-MODULE" across app.js to find every other spot effects
// hook into (apply pipeline, animation-detection, save/load) — none of
// those need edits when adding a module; they all read this registry.
//
// To add a new effect type "foo":
//   1. Add a `foo: { ... }` entry below, shaped exactly like `bloom`.
//   2. `defaults()` returns the instance's static param values (plain
//      numbers, one key per control).
//   3. `controls` lists the sliders shown in the Inspector, in order.
//      Set `animatable: true` on any control that should get the
//      Animate (∿) button + keyframe timeline curve editor — this reuses
//      the exact same component shapes/sprites already use (getAnimValue,
//      animValueAtT, drawTimelineOn), just pointed at the effect instance
//      instead of a shape. Add a `presets: [...]` array (same {label,kfs,dur}
//      shape as SHAPE_ANIM_PRESETS) if you want quick-pick curve presets
//      for that control — optional.
//   4. `apply(ctx, canvas, resolved, effectId)` does the actual rendering.
//      `resolved` is a plain object with one key per control, already
//      resolved to its current (possibly animated) value — never read
//      `effect` directly for params, so the module doesn't need to know
//      about animation at all. `effectId` is provided ONLY as a stable key
//      for modules that need private per-instance runtime state across
//      frames (e.g. Echo's persistent trail buffer) — stash it in a
//      module-level Map keyed by effectId, never on the effect object
//      itself (that gets JSON-serialized on save). Stateless modules like
//      Bloom just ignore the 4th argument.
//   5. If your module allocates per-instance runtime state, also define
//      `resetState(effectId)` to free/clear it — called when that instance
//      is deleted, and on every export (so exports always start from a
//      clean slate instead of whatever the live-preview buffer happened to
//      contain). Stateless modules can omit it.
//   6. That's it. The stack UI (add/remove/reorder/enable/collapse), the
//      param sliders, the curve editor, save/load, and export all pick the
//      new type up automatically because they iterate this object and
//      each instance's own `type`.
// ═══════════════════════════════════════════════════════════════════════
const ETL = { dragging: null, selectedKf: null }; // effect timeline interaction state, keyed by {effect,key}
let _effectTimelineRefs = []; // [{canvasEl, effect, ctrl}] — repopulated each updateEffectsList()

function updateEffectsList() {
  const list = document.getElementById('effects-list');
  if (!list) return;
  list.innerHTML = '';
  _effectTimelineRefs = [];
  if (S.effects.length === 0) {
    list.innerHTML = '<div style="padding:6px 10px;font-size:10px;opacity:.35">No effects yet</div>';
    return;
  }
  S.effects.forEach((effect, idx) => {
    const def = EFFECT_TYPES[effect.type];
    if (!def) return;
    const row = document.createElement('div');
    row.className = 'effect-item' + (effect.enabled ? '' : ' disabled');
    row.title = 'Effects apply bottom-to-top: the bottom effect runs first, and each one above it runs after, on top of the result so far — the top effect is the final pass.';

    const header = document.createElement('div');
    header.className = 'effect-item-header';
    const animated = effectHasAnimation(effect);
    header.innerHTML =
      `<span class="effect-item-name">${effect._expanded ? '▾' : '▸'} ${def.label}</span>` +
      (animated ? `<span class="effect-anim-badge" title="This effect is animated">∿</span>` : '') +
      `<button class="effect-reorder-btn" data-dir="up" ${idx === 0 ? 'disabled' : ''} title="Move up (runs later, closer to the final result)">▲</button>` +
      `<button class="effect-reorder-btn" data-dir="down" ${idx === S.effects.length - 1 ? 'disabled' : ''} title="Move down (runs earlier)">▼</button>` +
      `<button class="effect-toggle-btn" title="Enable/disable">${effect.enabled ? '👁' : '🚫'}</button>` +
      `<button class="effect-delete-btn" title="Remove effect">🗑</button>`;

    header.addEventListener('click', e => {
      if (e.target.closest('button')) return;
      effect._expanded = !effect._expanded;
      updateEffectsList();
    });
    header.querySelectorAll('.effect-reorder-btn').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const dir = btn.dataset.dir === 'up' ? -1 : 1;
        const j = idx + dir;
        if (j < 0 || j >= S.effects.length) return;
        [S.effects[idx], S.effects[j]] = [S.effects[j], S.effects[idx]];
        historySnapshot(); markRenderDirty();
        updateEffectsList();
      });
    });
    header.querySelector('.effect-toggle-btn').addEventListener('click', e => {
      e.stopPropagation();
      effect.enabled = !effect.enabled;
      historySnapshot(); markRenderDirty(); flushHasAnimCache();
      updateEffectsList();
    });
    header.querySelector('.effect-delete-btn').addEventListener('click', e => {
      e.stopPropagation();
      if (!confirm(`Remove this ${def.label} effect?`)) return;
      def.resetState?.(effect.id);
      S.effects.splice(idx, 1);
      historySnapshot(); markRenderDirty(); flushHasAnimCache();
      updateEffectsList();
    });
    row.appendChild(header);

    if (effect._expanded) {
      const body = document.createElement('div');
      body.className = 'effect-item-body';
      def.controls.forEach(ctrl => body.appendChild(buildEffectControlRow(effect, def, ctrl)));
      // EFFECT-MODULE: "exclude image layers" toggle — not a slider, so
      // it's a one-off row here rather than part of def.controls, shared by
      // every module with supportsExcludeImages (Echo, Spiral Echo, Bloom).
      // Safe to delete this block (and each module's excludeImages default/
      // apply()-branch) to fully remove the feature; every effect's default
      // (false) reproduces the pre-existing behaviour exactly.
      if (def.supportsExcludeImages && ECHO_EXCLUDE_IMAGES_FEATURE) {
        const exRow = document.createElement('div');
        exRow.className = 'prop-row';
        const exLabel = document.createElement('label');
        exLabel.className = 'prop-label';
        exLabel.textContent = 'Exclude Images';
        const exInput = document.createElement('input');
        exInput.type = 'checkbox';
        exInput.checked = !!effect.excludeImages;
        exInput.title = `Keep stamped images/GIFs sharp and untouched by ${def.label}`;
        exInput.addEventListener('change', () => {
          effect.excludeImages = exInput.checked;
          historySnapshot(); markRenderDirty();
        });
        exRow.appendChild(exLabel); exRow.appendChild(exInput);
        body.appendChild(exRow);
      }
      // EFFECT-MODULE: Comet Sparkle's gradient picker — a preset name, not
      // a slider, so it's a one-off row here (same reasoning as Echo's
      // checkbox above) reusing the same GRADIENT_PRESETS dropdown pattern
      // as the stroke/shape gradient pickers elsewhere in the app.
      if (effect.type === 'cometSparkle') {
        const gradRow = document.createElement('div');
        gradRow.className = 'prop-row';
        const gradLabel = document.createElement('label');
        gradLabel.className = 'prop-label';
        gradLabel.textContent = 'Gradient';
        const gradSel = document.createElement('select');
        for (const name of Object.keys(GRADIENT_PRESETS)) {
          const opt = document.createElement('option');
          opt.value = name; opt.textContent = name;
          if (name === effect.gradient) opt.selected = true;
          gradSel.appendChild(opt);
        }
        gradSel.addEventListener('change', () => {
          effect.gradient = gradSel.value;
          historySnapshot(); markRenderDirty();
        });
        gradRow.appendChild(gradLabel); gradRow.appendChild(gradSel);
        body.appendChild(gradRow);
      }
      row.appendChild(body);
    }
    list.appendChild(row);
  });
}

// One control's UI: a slider row, plus — only when ctrl.animatable — the
// same Animate-button + duration + timeline-curve + easing-row component
// shapes/sprites use, wired against this specific effect instance.
function buildEffectControlRow(effect, def, ctrl) {
  const wrap = document.createElement('div');

  const row = document.createElement('div');
  row.className = 'prop-row';
  const label = document.createElement('label');
  label.className = 'prop-label';
  label.textContent = ctrl.label;
  const input = document.createElement('input');
  input.type = 'range';
  input.min = ctrl.min; input.max = ctrl.max; input.step = ctrl.step ?? 1;
  input.value = effect[ctrl.key];
  const val = document.createElement('span');
  val.className = 'prop-val';
  val.textContent = ctrl.format(effect[ctrl.key]);
  input.addEventListener('input', e => {
    effect[ctrl.key] = parseFloat(e.target.value);
    val.textContent = ctrl.format(effect[ctrl.key]);
    markRenderDirty();
  });
  input.addEventListener('change', () => historySnapshot());
  row.appendChild(label); row.appendChild(input); row.appendChild(val);

  if (!ctrl.animatable) { wrap.appendChild(row); return wrap; }

  const animBtn = document.createElement('button');
  animBtn.className = 'anim-btn';
  animBtn.title = 'Animate ' + ctrl.label;
  animBtn.textContent = '∿';
  const hasAnim = !!effect.anim[ctrl.key]?.enabled;
  animBtn.classList.toggle('active', hasAnim);
  row.appendChild(animBtn);
  wrap.appendChild(row);

  const panel = document.createElement('div');
  panel.className = 'anim-panel';
  panel.style.display = hasAnim ? '' : 'none';

  const controlsRow = document.createElement('div');
  controlsRow.className = 'anim-panel-controls';
  const durLabel = document.createElement('span'); durLabel.className = 'anim-label'; durLabel.textContent = 'Dur';
  const durInput = document.createElement('input');
  durInput.type = 'number'; durInput.min = 0.1; durInput.max = 60; durInput.step = 0.1;
  durInput.value = effect.anim[ctrl.key]?.duration ?? 2;
  const sLabel = document.createElement('span'); sLabel.className = 'anim-label'; sLabel.textContent = 's';
  controlsRow.appendChild(durLabel); controlsRow.appendChild(durInput); controlsRow.appendChild(sLabel);

  let presetSel = null;
  if (def.presets?.[ctrl.key]?.length) {
    presetSel = document.createElement('select');
    presetSel.className = 'anim-preset-sel';
    presetSel.innerHTML = '<option value="">Presets…</option>' +
      def.presets[ctrl.key].map((p, i) => `<option value="${i}">${p.label}</option>`).join('');
    controlsRow.appendChild(presetSel);
  }
  panel.appendChild(controlsRow);

  const tlCanvas = document.createElement('canvas');
  tlCanvas.width = 196; tlCanvas.height = 72;
  panel.appendChild(tlCanvas);

  const kfRow = document.createElement('div');
  kfRow.className = 'anim-kf-row';
  kfRow.style.display = 'none';
  const easeLabel = document.createElement('span'); easeLabel.className = 'anim-label'; easeLabel.textContent = 'Easing';
  const easeSel = document.createElement('select');
  easeSel.className = 'anim-ease-sel';
  easeSel.innerHTML = Object.keys(EASINGS).map(k => `<option>${k}</option>`).join('');
  const kfDel = document.createElement('button');
  kfDel.className = 'anim-kf-del'; kfDel.title = 'Delete keyframe'; kfDel.textContent = '🗑';
  kfDel.style.display = 'none';
  kfRow.appendChild(easeLabel); kfRow.appendChild(easeSel); kfRow.appendChild(kfDel);
  panel.appendChild(kfRow);
  wrap.appendChild(panel);

  function ensureAnim() {
    if (!effect.anim[ctrl.key]) {
      effect.anim[ctrl.key] = { enabled: false, duration: 2, keyframes: [
        { t: 0, value: effect[ctrl.key], easing: 'ease' },
        { t: 1, value: effect[ctrl.key], easing: 'ease' },
      ] };
    }
    return effect.anim[ctrl.key];
  }

  function redraw() {
    const ap = effect.anim[ctrl.key];
    if (!ap) return;
    const sel = ETL.selectedKf;
    const selKf = (sel && sel.effect === effect && sel.key === ctrl.key) ? sel : null;
    drawTimelineOn(tlCanvas, ctrl, ap, selKf);
  }

  function syncEasingRow() {
    const sel = ETL.selectedKf;
    const isThis = sel && sel.effect === effect && sel.key === ctrl.key;
    kfRow.style.display = isThis ? '' : 'none';
    if (isThis) {
      const ap = effect.anim[ctrl.key];
      const kf = ap?.keyframes[sel.kfIdx];
      if (kf) {
        easeSel.value = kf.easing;
        kfDel.style.display = ap.keyframes.length > 2 ? '' : 'none';
      }
    }
  }

  animBtn.addEventListener('click', () => {
    const ap = ensureAnim();
    ap.enabled = !ap.enabled;
    animBtn.classList.toggle('active', ap.enabled);
    panel.style.display = ap.enabled ? '' : 'none';
    historySnapshot(); markRenderDirty(); flushHasAnimCache();
    if (ap.enabled && !S.animPaused && !S.rafId) S.rafId = requestAnimationFrame(render);
    redraw();
  });
  durInput.addEventListener('input', () => {
    const ap = effect.anim[ctrl.key]; if (!ap) return;
    const v = parseFloat(durInput.value);
    ap.duration = v > 0 ? v : 0.1;
    markRenderDirty();
  });
  durInput.addEventListener('change', () => historySnapshot());

  if (presetSel) {
    presetSel.addEventListener('change', () => {
      if (presetSel.value === '') return;
      const preset = def.presets[ctrl.key][parseInt(presetSel.value)];
      effect.anim[ctrl.key] = { enabled: true, duration: preset.dur, keyframes: preset.kfs.map(k => ({ t: k.t, value: k.v, easing: k.e })) };
      animBtn.classList.add('active');
      panel.style.display = '';
      durInput.value = preset.dur;
      ETL.selectedKf = null; syncEasingRow();
      historySnapshot(); markRenderDirty(); flushHasAnimCache();
      if (!S.animPaused && !S.rafId) S.rafId = requestAnimationFrame(render);
      redraw();
      presetSel.value = '';
    });
  }

  easeSel.addEventListener('change', () => {
    const sel = ETL.selectedKf;
    if (!sel || sel.effect !== effect || sel.key !== ctrl.key) return;
    const ap = effect.anim[ctrl.key];
    const kf = ap.keyframes[sel.kfIdx];
    if (kf) { kf.easing = easeSel.value; historySnapshot(); markRenderDirty(); redraw(); }
  });
  kfDel.addEventListener('click', () => {
    const sel = ETL.selectedKf;
    if (!sel || sel.effect !== effect || sel.key !== ctrl.key) return;
    const ap = effect.anim[ctrl.key];
    if (ap.keyframes.length > 2) {
      ap.keyframes.splice(sel.kfIdx, 1);
      ETL.selectedKf = null;
      syncEasingRow(); historySnapshot(); markRenderDirty(); redraw();
    }
  });

  wireEffectTimelineCanvas(tlCanvas, effect, ctrl, redraw, syncEasingRow);
  _effectTimelineRefs.push({ canvasEl: tlCanvas, effect, ctrl });
  redraw();
  syncEasingRow();

  return wrap;
}

function effectTlCoords(canvasEl, ctrl) {
  const W = canvasEl.width, H = canvasEl.height;
  const PAD = { l: 6, r: 6, t: 8, b: 8 };
  const iW = W - PAD.l - PAD.r, iH = H - PAD.t - PAD.b;
  return {
    tx: t => PAD.l + t * iW,
    vy: v => PAD.t + (1 - (v - ctrl.min) / (ctrl.max - ctrl.min)) * iH,
    tv: px => Math.max(0, Math.min(1, (px - PAD.l) / iW)),
    yv: py => ctrl.min + (1 - (py - PAD.t) / iH) * (ctrl.max - ctrl.min),
  };
}

function effectNearestKf(canvasEl, ctrl, ap, px, py) {
  const { tx, vy } = effectTlCoords(canvasEl, ctrl);
  let best = -1, bestD = 64; // ~8px hit radius, squared
  ap.keyframes.forEach((kf, i) => {
    const dx = tx(kf.t) - px, dy = vy(kf.value) - py;
    const d = dx * dx + dy * dy;
    if (d < bestD) { bestD = d; best = i; }
  });
  return best;
}

function wireEffectTimelineCanvas(canvasEl, effect, ctrl, redraw, syncEasingRow) {
  const key = ctrl.key;
  canvasEl.addEventListener('mousedown', e => {
    e.preventDefault();
    const ap = effect.anim[key]; if (!ap) return;
    const rect = canvasEl.getBoundingClientRect();
    const scaleX = canvasEl.width / rect.width, scaleY = canvasEl.height / rect.height;
    const px = (e.clientX - rect.left) * scaleX;
    const py = (e.clientY - rect.top) * scaleY;
    if (e.button === 2) {
      const idx = effectNearestKf(canvasEl, ctrl, ap, px, py);
      if (idx >= 0 && ap.keyframes.length > 2) { ap.keyframes.splice(idx, 1); historySnapshot(); redraw(); }
      return;
    }
    const kfIdx = effectNearestKf(canvasEl, ctrl, ap, px, py);
    if (kfIdx >= 0) {
      ETL.dragging = { effect, key, kfIdx };
      ETL.selectedKf = { effect, key, kfIdx };
      syncEasingRow(); redraw();
      return;
    }
    ETL.selectedKf = null; syncEasingRow();
    const { tv, yv } = effectTlCoords(canvasEl, ctrl);
    const t = tv(px), v = Math.max(ctrl.min, Math.min(ctrl.max, yv(py)));
    const prevKf = ap.keyframes.filter(k => k.t < t).pop();
    ap.keyframes.push({ t, value: v, easing: prevKf?.easing ?? 'linear' });
    ap.keyframes.sort((a, b) => a.t - b.t);
    historySnapshot(); redraw();
  });
  window.addEventListener('mousemove', e => {
    if (!ETL.dragging || ETL.dragging.effect !== effect || ETL.dragging.key !== key) return;
    const ap = effect.anim[key]; if (!ap) return;
    const rect = canvasEl.getBoundingClientRect();
    const scaleX = canvasEl.width / rect.width, scaleY = canvasEl.height / rect.height;
    const px = (e.clientX - rect.left) * scaleX;
    const py = (e.clientY - rect.top) * scaleY;
    const { tv, yv } = effectTlCoords(canvasEl, ctrl);
    const kf = ap.keyframes[ETL.dragging.kfIdx];
    if (!kf) return;
    kf.t = Math.max(0, Math.min(1, tv(px)));
    kf.value = Math.max(ctrl.min, Math.min(ctrl.max, yv(py)));
    ap.keyframes.sort((a, b) => a.t - b.t);
    ETL.dragging.kfIdx = ap.keyframes.indexOf(kf);
    ETL.selectedKf.kfIdx = ETL.dragging.kfIdx;
    redraw();
  });
  window.addEventListener('mouseup', () => {
    if (ETL.dragging && ETL.dragging.effect === effect && ETL.dragging.key === key) {
      ETL.dragging = null;
      historySnapshot();
      syncEasingRow();
    }
  });
  canvasEl.addEventListener('contextmenu', e => e.preventDefault());
}

function refreshAllEffectTimelines() {
  for (const { canvasEl, effect, ctrl } of _effectTimelineRefs) {
    const ap = effect.anim[ctrl.key];
    if (!ap) continue;
    const sel = ETL.selectedKf;
    const selKf = (sel && sel.effect === effect && sel.key === ctrl.key) ? sel : null;
    drawTimelineOn(canvasEl, ctrl, ap, selKf);
  }
}

function wireEffectsPanel() {
  const addSel = document.getElementById('effect-add-select');
  for (const key of Object.keys(EFFECT_TYPES)) {
    if (EFFECT_TYPES[key].hidden) continue;
    const opt = document.createElement('option');
    opt.value = key; opt.textContent = EFFECT_TYPES[key].label;
    addSel.appendChild(opt);
  }
  addSel.addEventListener('change', () => {
    if (!addSel.value) return;
    const effect = createEffect(addSel.value);
    if (effect) {
      S.effects.push(effect);
      historySnapshot(); markRenderDirty(); flushHasAnimCache();
      updateEffectsList();
    }
    addSel.value = '';
  });

  const header = document.getElementById('effects-header');
  const title = document.getElementById('effects-title');
  const list = document.getElementById('effects-list');
  header.addEventListener('click', e => {
    if (e.target.closest('select')) return;
    S.effectsCollapsed = !S.effectsCollapsed;
    list.style.display = S.effectsCollapsed ? 'none' : '';
    title.textContent = 'Effects ' + (S.effectsCollapsed ? '▸' : '▾');
  });

  updateEffectsList();
}

const STL = { dragging: null, selectedKf: null };  // shape timeline interaction state

// ── Radial-animation keyframe ghost preview ──────────────
// While dragging a keyframe on a shape's or sprite's Radial (offsetX)
// timeline, the vertical axis alone doesn't say much about what a given
// value actually *means* spatially — this draws a semi-transparent white
// silhouette of the entity at the exact position that value would put it,
// live-updating every mousemove, so dragging up/down visibly pulls the
// ghost in/out along its spoke instead of leaving the number to the
// imagination. `x`/`y` here are the entity's own local (pre-symmetry)
// coordinates — renderShapeSymmetric/renderSprite apply the mandala's
// axis/rotation/mirror transform on top, same as for the real entity.
let _radialGhost = null; // { kind: 'shape'|'sprite', mandala, entity, x, y }

// Mirrors shapeRadialTangentialOffset/spriteRadialTangentialOffset's polar
// decomposition, but with the radial component forced to a hypothetical
// value (the keyframe currently being dragged) instead of read from
// animation — tangential still comes from whatever the entity's Tangential
// track currently animates to, so only the axis actually being edited is
// "what if".
function computeRadialGhostLocalPos(entity, clk, radialValue) {
  const tangential = getAnimValue(entity, 'offsetY', clk) ?? 0;
  const baseRadius = Math.hypot(entity.x, entity.y);
  const baseAngle = baseRadius > 0.001 ? Math.atan2(entity.y, entity.x) : 0;
  const radius = radialValue;
  const angle = baseAngle + tangential / Math.max(radius, 1);
  return { x: radius * Math.cos(angle), y: radius * Math.sin(angle) };
}

// White silhouette of a sprite's current drawable frame — 'source-in'
// composites a solid white fill against the image's own alpha shape, so
// the ghost reads as a plain white cutout instead of the actual artwork
// colours. Rebuilt on demand each call (only invoked during an active
// drag, and decoded images are already in memory, so this is cheap enough
// not to need caching).
function ghostSilhouetteFrom(drawableImg) {
  const w = drawableImg.width || drawableImg.naturalWidth, h = drawableImg.height || drawableImg.naturalHeight;
  if (!w || !h) return null;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const gctx = c.getContext('2d');
  gctx.drawImage(drawableImg, 0, 0);
  gctx.globalCompositeOperation = 'source-in';
  gctx.fillStyle = '#ffffff';
  gctx.fillRect(0, 0, w, h);
  return c;
}

function drawRadialGhost() {
  if (!_radialGhost) return;
  const { kind, mandala, entity, x, y } = _radialGhost;
  if (kind === 'shape') {
    const ghost = { ...entity, anim: {}, x, y, color: '#ffffff', fill: entity.fill ? '#ffffff' : null, gradient: null, opacity: 0.35 };
    renderShapeSymmetric(ctx, canvas, mandala, ghost);
  } else if (kind === 'sprite') {
    const item = getPaletteItem(entity.paletteId);
    if (!item || !item.img.complete) return;
    const drawable = getDrawableImage(item);
    if (!drawable) return;
    const silhouette = ghostSilhouetteFrom(drawable);
    if (!silhouette) return;
    const ghost = { ...entity, anim: {}, x, y, opacity: 0.35 };
    renderSprite(ctx, mandala, ghost, silhouette);
  }
}

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
    if (prop === 'offsetX') {
      const found = findSelectedShape();
      if (found) {
        const { x: gx, y: gy } = computeRadialGhostLocalPos(shape, S.animClock, kf.value);
        _radialGhost = { kind: 'shape', mandala: found.mandala, entity: shape, x: gx, y: gy };
      }
    }
    markRenderDirty();
  });
  window.addEventListener('mouseup', () => {
    if (STL.dragging?.prop === prop) {
      const shape = shaEntity();
      if (STL.selectedKf?.prop === prop && shape?.anim?.[prop])
        STL.selectedKf.kfIdx = Math.min(STL.selectedKf.kfIdx, shape.anim[prop].keyframes.length - 1);
      syncShapeEasingDropdown(prop, shape);
      STL.dragging = null; historySnapshot();
      _radialGhost = null; markRenderDirty();
    }
  });
  el.addEventListener('contextmenu', e => e.preventDefault());
}

// ── Drawing (stroke) orbit timeline ──────────────────────
// Same keyframe/timeline machinery as shape animation, scoped to the single
// 'orbit' property strokes support — mirrors initShapeTimelineCanvas etc.
// but against the selected stroke instead of the selected shape.
const DPA_ORBIT_CFG = { min: -180, max: 180 };
const DTL = { dragging: false, selectedKfIdx: null };

function dpaEntity() { const f = findSelectedStroke(); return f ? f.stroke : null; }
function dpaTlCanvasEl() { return document.getElementById('dpa-tl-orbit'); }

function dpaTlCoords(canvasEl) {
  const W = canvasEl.width, H = canvasEl.height;
  const PAD = { l: 6, r: 6, t: 8, b: 8 };
  const iW = W - PAD.l - PAD.r, iH = H - PAD.t - PAD.b;
  const { min: vMin, max: vMax } = DPA_ORBIT_CFG;
  return {
    W, H, PAD, iW, iH,
    tx: t  => PAD.l + t * iW,
    vy: v  => PAD.t + (1 - (v - vMin) / (vMax - vMin)) * iH,
    tv: px => Math.max(0, Math.min(1, (px - PAD.l) / iW)),
    yv: py => vMin + (1 - (py - PAD.t) / iH) * (vMax - vMin),
  };
}

function drawDrawingOrbitTimeline() {
  const el = dpaTlCanvasEl(); const stroke = dpaEntity();
  if (!el || !stroke?.anim?.orbit) return;
  const selKf = DTL.selectedKfIdx != null ? { kfIdx: DTL.selectedKfIdx } : null;
  drawTimelineOn(el, DPA_ORBIT_CFG, stroke.anim.orbit, selKf);
}

function refreshDrawingOrbitTimeline() { drawDrawingOrbitTimeline(); }

function dpaNearestKf(el, px, py, radius = 14) {
  const ap = dpaEntity()?.anim?.orbit; if (!ap) return -1;
  const { tx, vy } = dpaTlCoords(el);
  let best = -1, bestD = radius;
  ap.keyframes.forEach((kf, i) => {
    const d = Math.hypot(tx(kf.t) - px, vy(kf.value) - py);
    if (d < bestD) { bestD = d; best = i; }
  });
  return best;
}

function syncDrawingOrbitEasingDropdown() {
  const sel = document.getElementById('dpa-ease-sel-orbit');
  const row = document.getElementById('dpa-kf-row-orbit');
  if (!sel || !row) return;
  const stroke = dpaEntity();
  const kfIdx = DTL.selectedKfIdx;
  if (kfIdx == null || kfIdx < 0 || !stroke?.anim?.orbit) { row.style.display = 'none'; return; }
  const kfs = stroke.anim.orbit.keyframes;
  const hasNext = kfIdx < kfs.length - 1;
  row.style.display = hasNext ? 'flex' : 'none';
  if (hasNext) sel.value = kfs[kfIdx].easing;
  const delBtn = document.getElementById('dpa-kf-del-orbit');
  if (delBtn) {
    const canDel = kfIdx > 0 && kfIdx < kfs.length - 1 && kfs.length > 2;
    delBtn.style.display = canDel ? '' : 'none';
  }
}

function initDrawingOrbitTimelineCanvas() {
  const el = dpaTlCanvasEl(); if (!el) return;
  el.addEventListener('mousedown', e => {
    e.preventDefault();
    const rect = el.getBoundingClientRect();
    const scaleX = el.width / rect.width;
    const px = (e.clientX - rect.left) * scaleX;
    const py = (e.clientY - rect.top) * scaleX;
    const stroke = dpaEntity(); if (!stroke?.anim?.orbit) return;
    if (e.button === 2) {
      const idx = dpaNearestKf(el, px, py);
      if (idx >= 0 && stroke.anim.orbit.keyframes.length > 2) { stroke.anim.orbit.keyframes.splice(idx, 1); historySnapshot(); }
      return;
    }
    const kfIdx = dpaNearestKf(el, px, py);
    if (kfIdx >= 0) {
      DTL.dragging = true; DTL.selectedKfIdx = kfIdx;
      syncDrawingOrbitEasingDropdown(); return;
    }
    DTL.selectedKfIdx = null; syncDrawingOrbitEasingDropdown();
    const { tv, yv } = dpaTlCoords(el);
    const t = tv(px), v = Math.max(DPA_ORBIT_CFG.min, Math.min(DPA_ORBIT_CFG.max, yv(py)));
    const kfs = stroke.anim.orbit.keyframes;
    const prevKf = kfs.filter(k => k.t < t).pop();
    kfs.push({ t, value: v, easing: prevKf?.easing ?? 'linear' });
    kfs.sort((a, b) => a.t - b.t);
    historySnapshot();
  });
  window.addEventListener('mousemove', e => {
    if (!DTL.dragging) return;
    const rect = el.getBoundingClientRect();
    const scaleX = el.width / rect.width, scaleY = el.height / rect.height;
    const px = (e.clientX - rect.left) * scaleX;
    const py = (e.clientY - rect.top) * scaleY;
    const stroke = dpaEntity(); if (!stroke?.anim?.orbit) return;
    const { tv, yv } = dpaTlCoords(el);
    const kfs = stroke.anim.orbit.keyframes;
    const kf = kfs[DTL.selectedKfIdx];
    if (!kf) return;
    kf.t = Math.max(0, Math.min(1, tv(px)));
    kf.value = Math.max(DPA_ORBIT_CFG.min, Math.min(DPA_ORBIT_CFG.max, yv(py)));
    kfs.sort((a, b) => a.t - b.t);
    DTL.selectedKfIdx = kfs.indexOf(kf);
  });
  window.addEventListener('mouseup', () => {
    if (DTL.dragging) {
      const stroke = dpaEntity();
      if (DTL.selectedKfIdx != null && stroke?.anim?.orbit)
        DTL.selectedKfIdx = Math.min(DTL.selectedKfIdx, stroke.anim.orbit.keyframes.length - 1);
      syncDrawingOrbitEasingDropdown();
      DTL.dragging = false; historySnapshot();
    }
  });
  el.addEventListener('contextmenu', e => e.preventDefault());
}

function wireStrokeOrbitAnim() {
  const btn = document.getElementById('dpa-btn-orbit');
  if (!btn) return;
  btn.addEventListener('click', () => {
    const found = findSelectedStroke(); if (!found) return;
    const stroke = found.stroke;
    if (!stroke.anim) stroke.anim = {};
    historySnapshot();
    if (stroke.anim.orbit?.enabled) {
      stroke.anim.orbit.enabled = false;
      btn.classList.remove('active');
      document.getElementById('dpa-panel-orbit').style.display = 'none';
      invalidateStrokeCache(); // re-enter the static cache at its current orbit value
    } else {
      const presets = SHAPE_ANIM_PRESETS.orbit;
      if (!stroke.anim.orbit) {
        const defaultPreset = presets?.[0];
        stroke.anim.orbit = defaultPreset ? applyPreset(defaultPreset) : defaultAnimProp(stroke.orbit || 0);
      } else {
        stroke.anim.orbit.enabled = true;
      }
      btn.classList.add('active');
      document.getElementById('dpa-panel-orbit').style.display = '';
      document.getElementById('dpa-dur-orbit').value = stroke.anim.orbit.duration;
      drawDrawingOrbitTimeline();
      // Leave the static cache: it must stop drawing this stroke now that
      // it's animating live, or the cached copy and the live copy both
      // render at once (a stale frozen copy plus the moving one).
      invalidateStrokeCache();
      if (!S.animPaused && !S.rafId) S.rafId = requestAnimationFrame(render);
    }
    updateLayersList();
  });

  document.getElementById('dpa-dur-orbit').addEventListener('change', e => {
    const found = findSelectedStroke(); if (!found?.stroke?.anim?.orbit) return;
    found.stroke.anim.orbit.duration = Math.max(0.1, parseFloat(e.target.value) || 1);
    drawDrawingOrbitTimeline();
  });

  document.getElementById('dpa-preset-orbit').addEventListener('change', e => {
    const found = findSelectedStroke(); if (!found) return;
    const stroke = found.stroke;
    const preset = SHAPE_ANIM_PRESETS.orbit.find(p => p.label === e.target.value);
    if (!preset) { e.target.value = ''; return; }
    if (!stroke.anim) stroke.anim = {};
    stroke.anim.orbit = applyPreset(preset);
    document.getElementById('dpa-dur-orbit').value = stroke.anim.orbit.duration;
    document.getElementById('dpa-btn-orbit').classList.add('active');
    document.getElementById('dpa-panel-orbit').style.display = '';
    drawDrawingOrbitTimeline();
    e.target.value = '';
    flushHasAnimCache();
    if (!S.animPaused && !S.rafId) S.rafId = requestAnimationFrame(render);
    historySnapshot();
  });

  document.getElementById('dpa-ease-sel-orbit').addEventListener('change', e => {
    const found = findSelectedStroke(); if (!found?.stroke?.anim?.orbit) return;
    const kfIdx = DTL.selectedKfIdx;
    if (kfIdx != null && kfIdx >= 0 && kfIdx < found.stroke.anim.orbit.keyframes.length - 1)
      found.stroke.anim.orbit.keyframes[kfIdx].easing = e.target.value;
    drawDrawingOrbitTimeline();
  });

  document.getElementById('dpa-kf-del-orbit').addEventListener('click', () => {
    const found = findSelectedStroke(); if (!found?.stroke?.anim?.orbit) return;
    const kfIdx = DTL.selectedKfIdx;
    const kfs = found.stroke.anim.orbit.keyframes;
    if (kfIdx != null && kfIdx > 0 && kfIdx < kfs.length - 1 && kfs.length > 2) {
      kfs.splice(kfIdx, 1);
      DTL.selectedKfIdx = null;
      syncDrawingOrbitEasingDropdown();
      drawDrawingOrbitTimeline();
      historySnapshot();
    }
  });

  initDrawingOrbitTimelineCanvas();
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
    if (prop === 'offsetX') {
      const found = findSprite(S.selectedSpriteId);
      if (found) {
        const { x: gx, y: gy } = computeRadialGhostLocalPos(spr, S.animClock, draggedKf.value);
        _radialGhost = { kind: 'sprite', mandala: found.mandala, entity: spr, x: gx, y: gy };
      }
    }
    markRenderDirty();
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
      _radialGhost = null; markRenderDirty();
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


function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
}

function rgbToHsv(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === r) h = 60 * (((g - b) / d) % 6);
    else if (max === g) h = 60 * ((b - r) / d + 2);
    else h = 60 * ((r - g) / d + 4);
  }
  if (h < 0) h += 360;
  return { h, s: max === 0 ? 0 : d / max, v: max };
}

function hsvToRgb(h, s, v) {
  h = ((h % 360) + 360) % 360 / 60;
  const c = v * s, x = c * (1 - Math.abs(h % 2 - 1)), m = v - c;
  let r, g, b;
  if (h < 1) [r, g, b] = [c, x, 0];
  else if (h < 2) [r, g, b] = [x, c, 0];
  else if (h < 3) [r, g, b] = [0, c, x];
  else if (h < 4) [r, g, b] = [0, x, c];
  else if (h < 5) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return { r: (r + m) * 255, g: (g + m) * 255, b: (b + m) * 255 };
}


// Drawing in a colour that's very close to the background is a real trap —
// the stroke *does* render correctly (verified: identical pixels either
// way, only the background differs), it's just visually indistinguishable
// from "nothing happened," which reads exactly like a bug. Rather than
// changing any actual rendering behaviour, just surface a warning next to
// the colour swatch so it's obvious before the user draws and wonders
// where their stroke went.
//
// Raw RGB distance (colorDist) isn't the right metric here: black
// (0,0,0) vs this app's default near-black background (#0d0d1a) is only
// ~52 apart on that scale, well above a naive low threshold, yet the two
// are essentially indistinguishable on screen. What actually determines
// on-screen visibility is *perceived brightness*, not raw channel
// distance — two very different hues at the same low brightness are
// still hard to tell apart. Compare luma (standard 0.299/0.587/0.114
// weighting) instead, which correctly flags black-on-near-black
// regardless of the small hue offset between them.
function updateColorContrastWarning() {
  const warn = document.getElementById('color-contrast-warning');
  if (!warn) return;
  const a = hexToRgb(S.color), b = hexToRgb(S.bgColor);
  const lumaA = 0.299 * a.r + 0.587 * a.g + 0.114 * a.b;
  const lumaB = 0.299 * b.r + 0.587 * b.g + 0.114 * b.b;
  warn.style.display = Math.abs(lumaA - lumaB) < 25 ? '' : 'none';
}

// ── Custom colour popover ───────────────────────────────
// Fully in-page HSV picker used for gradient stop editing instead of the
// native <input type=color> — on macOS that hands off to the OS's own
// colour panel, whose on-screen position the page has no way to influence,
// so it always opened wherever the system last left it (often the corner).
// This one we draw and position ourselves.
let _cpState = null;

function initColorPopover() {
  const pop = document.getElementById('color-popover');
  const svCanvas = document.getElementById('cp-sv');
  const svHandle = document.getElementById('cp-sv-handle');
  const hueEl = document.getElementById('cp-hue');
  const hueHandle = document.getElementById('cp-hue-handle');
  const swatch = document.getElementById('cp-swatch');
  const hexInput = document.getElementById('cp-hex');
  const svCtx = svCanvas.getContext('2d');

  function drawSV() {
    const w = svCanvas.width, h = svCanvas.height;
    const hueRgb = hsvToRgb(_cpState.h, 1, 1);
    svCtx.fillStyle = `rgb(${hueRgb.r | 0},${hueRgb.g | 0},${hueRgb.b | 0})`;
    svCtx.fillRect(0, 0, w, h);
    const gradWhite = svCtx.createLinearGradient(0, 0, w, 0);
    gradWhite.addColorStop(0, 'rgba(255,255,255,1)');
    gradWhite.addColorStop(1, 'rgba(255,255,255,0)');
    svCtx.fillStyle = gradWhite;
    svCtx.fillRect(0, 0, w, h);
    const gradBlack = svCtx.createLinearGradient(0, 0, 0, h);
    gradBlack.addColorStop(0, 'rgba(0,0,0,0)');
    gradBlack.addColorStop(1, 'rgba(0,0,0,1)');
    svCtx.fillStyle = gradBlack;
    svCtx.fillRect(0, 0, w, h);
  }

  function updateHandles() {
    svHandle.style.left = (_cpState.s * 100) + '%';
    svHandle.style.top = ((1 - _cpState.v) * 100) + '%';
    hueHandle.style.left = (_cpState.h / 360 * 100) + '%';
  }

  function commit(skipHexInput) {
    const { r, g, b } = hsvToRgb(_cpState.h, _cpState.s, _cpState.v);
    const hex = rgbToHex(r, g, b);
    swatch.style.background = hex;
    if (!skipHexInput) hexInput.value = hex.toUpperCase();
    _cpState.onChange?.(hex);
  }

  function dragOn(el, onMove) {
    el.addEventListener('pointerdown', e => {
      if (!_cpState) return;
      onMove(e);
      const move = ev => onMove(ev);
      const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
    });
  }

  dragOn(svCanvas, e => {
    const rect = svCanvas.getBoundingClientRect();
    _cpState.s = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    _cpState.v = 1 - Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    updateHandles();
    commit();
  });

  dragOn(hueEl, e => {
    const rect = hueEl.getBoundingClientRect();
    _cpState.h = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)) * 360;
    drawSV();
    updateHandles();
    commit();
  });

  hexInput.addEventListener('input', () => {
    if (!_cpState) return;
    let v = hexInput.value.trim();
    if (v && !v.startsWith('#')) v = '#' + v;
    if (!/^#[0-9a-fA-F]{6}$/.test(v)) return;
    const { r, g, b } = hexToRgb(v);
    const hsv = rgbToHsv(r, g, b);
    _cpState.h = hsv.h; _cpState.s = hsv.s; _cpState.v = hsv.v;
    drawSV();
    updateHandles();
    commit(true);
  });

  function closePopover() {
    if (!_cpState) return;
    pop.classList.remove('visible');
    document.removeEventListener('pointerdown', onOutsidePointerDown, true);
    const cb = _cpState.onClose;
    _cpState = null;
    cb?.();
  }

  function onOutsidePointerDown(e) {
    if (!pop.contains(e.target)) closePopover();
  }

  window.openColorPopover = function (x, y, hex, onChange, onClose) {
    const { r, g, b } = hexToRgb(hex);
    const hsv = rgbToHsv(r, g, b);
    _cpState = { h: hsv.h, s: hsv.s, v: hsv.v, onChange, onClose };
    drawSV();
    updateHandles();
    swatch.style.background = hex;
    hexInput.value = hex.toUpperCase();
    pop.classList.add('visible');
    requestAnimationFrame(() => {
      const pr = pop.getBoundingClientRect();
      const left = Math.max(6, Math.min(window.innerWidth - pr.width - 6, x - pr.width / 2));
      const top = Math.max(6, Math.min(window.innerHeight - pr.height - 6, y));
      pop.style.left = left + 'px';
      pop.style.top = top + 'px';
    });
    setTimeout(() => document.addEventListener('pointerdown', onOutsidePointerDown, true), 0);
  };

  window.closeColorPopover = closePopover;
}

// ── History ─────────────────────────────────────────────
function historySnapshot() {
  const snap = JSON.stringify({ mandalas: S.mandalas, effects: S.effects }); // EFFECT-MODULE: undo/redo
  S.history.push(snap);
  S.redoStack = [];
  if (S.history.length > MAX_HISTORY) S.history.shift();
  updateUndoButtons();
  markRenderDirty();
  flushHasAnimCache();
}

function restoreSnapshot(snap) {
  const data = JSON.parse(snap);
  S.mandalas = data.mandalas;
  S.effects = data.effects || []; // EFFECT-MODULE: undo/redo
  S.selectedSpriteId = null;
  invalidateStrokeCache();
  updateMandalaList();
  updateSpriteProps();
  updateEffectsList();
}

function undo() {
  if (!S.history.length) return;
  S.redoStack.push(JSON.stringify({ mandalas: S.mandalas, effects: S.effects }));
  restoreSnapshot(S.history.pop());
  updateUndoButtons();
}

function redo() {
  if (!S.redoStack.length) return;
  S.history.push(JSON.stringify({ mandalas: S.mandalas, effects: S.effects }));
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
      trimStart: null,   // playback trim range — null until decode sets it to [0, frames.length-1]
      trimEnd: null,
    };
    S.palette.push(item);
    hiddenImgs.appendChild(img);
    renderPaletteList();
    // Decode animation frames in the background
    if (isGif) initGifAnimation(item);
    else if (isWebP) initWebPAnimation(item);
  };
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
    if (document.getElementById('dpa-panel-orbit')?.offsetParent !== null) {
      refreshDrawingOrbitTimeline();
    }
    // EFFECT-MODULE: render-hook (timeline playhead refresh)
    if (document.getElementById('effects-list')?.offsetParent !== null) {
      refreshAllEffectTimelines();
    }
  }

  // Rebuild per-mandala solid-stroke run caches if dirty — each run gets
  // blitted at its correct z position inside renderMandalaLive, not here.
  if (_strokeCacheDirty) rebuildStrokeCache(canvas);
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Grid overlay
  if (S.snapGrid.enabled) renderGridOverlay();

  // Live layer: gradient strokes + sprites for all mandalas
  drawMandalasWithOptionalSpriteSplit(ctx, canvas, false);

  // EFFECT-MODULE: render-hook — post-process the finished artwork before
  // any tool previews/guides/selection handles draw on top, so effects
  // never touch UI chrome, only the actual mandala content.
  applyEffectsChain(ctx, canvas);

  // Current stroke preview
  if (S.drawing && S.pts.length > 1) {
    const m = getActiveMandala();
    const liveGrad = S.gradientMode ? S.gradient : null;
    if (m) renderStrokeSymmetric(ctx, m, S.pts, S.color, S.thickness, S.opacity, false, m.mirror !== false, m.axes, m.axisRotation, liveGrad);
  }
  // Line / Line Chain preview — live symmetric line plus tip/end guide dots
  // (reusing Petal/Bezier's guide renderer with no curvature handle, since a
  // straight line has none).
  if ((S.tool === 'line' || S.tool === 'lineChain') && S.linePhase === 'axis' && S.lineTip && S.lineEnd) {
    const m = getActiveMandala();
    if (m) {
      const liveGrad = S.gradientMode ? S.gradient : null;
      renderLineSymmetric(ctx, m, S.lineTip, S.lineEnd, S.color, S.thickness, S.opacity, m.mirror !== false, m.axes, m.axisRotation, liveGrad);
      renderPetalGuides(m, S.lineTip, S.lineEnd, null);
    }
  }

  // Shape preview while dragging
  if (S.shapeDragging && S.shapePreview && S.shapePreview.r > 0) {
    const m = getActiveMandala();
    if (m) {
      ctx.save(); ctx.globalAlpha = 0.55;
      renderShapeSymmetric(ctx, canvas, m, S.shapePreview);
      ctx.restore();
    }
  }

  // Radial-animation keyframe ghost — see drawRadialGhost.
  drawRadialGhost();

  // Petal preview — live shape (both drag stages) plus construction guides
  // (tip->base axis line, endpoint markers, and the curvature handle once
  // that stage starts).
  if (S.tool === 'petal' && S.petalPhase && S.petalTip && S.petalBase) {
    const m = getActiveMandala();
    if (m) {
      const previewShape = {
        id: '_petal_preview', type: 'petal',
        x: S.petalTip.x, y: S.petalTip.y,
        petalDx: S.petalBase.x - S.petalTip.x,
        petalDy: S.petalBase.y - S.petalTip.y,
        petalCurve: S.petalCurve,
        r: 0, color: S.color, thickness: S.thickness, opacity: S.opacity,
        fill: S.shapeFill, lineCap: S.shapeLineCap, lineJoin: 'miter', dash: [],
        gradient: null, rotation: 0, orbit: 0, anim: {}, params: {},
        axes: m.axes, axisRotation: m.axisRotation, mirror: m.mirror,
      };
      ctx.save(); ctx.globalAlpha = 0.7;
      renderShapeSymmetric(ctx, canvas, m, previewShape);
      ctx.restore();
      renderPetalGuides(m, S.petalTip, S.petalBase, S.petalPhase === 'curve' ? S.petalCurve : null);
    }
  }

  // Bezier preview — identical construction guides to Petal, just an open
  // unfilled curve instead of a closed loop.
  if (S.tool === 'bezier' && S.bezierPhase && S.bezierTip && S.bezierEnd) {
    const m = getActiveMandala();
    if (m) {
      const previewShape = {
        id: '_bezier_preview', type: 'bezier',
        x: S.bezierTip.x, y: S.bezierTip.y,
        bezierDx: S.bezierEnd.x - S.bezierTip.x,
        bezierDy: S.bezierEnd.y - S.bezierTip.y,
        bezierCurve: S.bezierCurve,
        bezierC1x: null, bezierC1y: null, bezierC2x: null, bezierC2y: null,
        r: 0, color: S.color, thickness: S.thickness, opacity: S.opacity,
        fill: null, lineCap: S.shapeLineCap, lineJoin: S.shapeLineJoin, dash: [],
        gradient: null, rotation: 0, orbit: 0, anim: {}, params: {},
        axes: m.axes, axisRotation: m.axisRotation, mirror: m.mirror,
      };
      ctx.save(); ctx.globalAlpha = 0.7;
      renderShapeSymmetric(ctx, canvas, m, previewShape);
      ctx.restore();
      renderPetalGuides(m, S.bezierTip, S.bezierEnd, S.bezierPhase === 'curve' ? S.bezierCurve : null);
    }
  }

  // Wing preview — the bottom point is mirrored across the tip->mandala-
  // centre axis captured on the first click (S.wingMirrorAngle, see
  // renderWingGuides), so both arms are visibly distinct live, not just
  // once edited afterward.
  if (S.tool === 'wing' && S.wingPhase && S.wingTip && S.wingEnd) {
    const m = getActiveMandala();
    if (m) {
      const dx = S.wingEnd.x - S.wingTip.x, dy = S.wingEnd.y - S.wingTip.y;
      const previewShape = {
        id: '_wing_preview', type: 'wing',
        x: S.wingTip.x, y: S.wingTip.y,
        bezierDx: dx, bezierDy: dy,
        bezierCurve: S.wingCurve,
        bezierC1x: null, bezierC1y: null, bezierC2x: null, bezierC2y: null,
        wingMirrorAngle: S.wingMirrorAngle,
        r: 0, color: S.color, thickness: S.thickness, opacity: S.opacity,
        fill: null, lineCap: S.shapeLineCap, lineJoin: S.shapeLineJoin, dash: [],
        gradient: null, rotation: 0, orbit: 0, anim: {}, params: {},
        axes: m.axes, axisRotation: m.axisRotation, mirror: m.mirror,
      };
      ctx.save(); ctx.globalAlpha = 0.7;
      renderShapeSymmetric(ctx, canvas, m, previewShape);
      ctx.restore();
      renderWingGuides(m, S.wingTip, S.wingEnd, S.wingPhase === 'curve' ? S.wingCurve : null, S.wingMirrorAngle);
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

  // Fill the background colour in behind everything drawn so far (cache,
  // live layers, effects, and every content/tool preview above) rather than
  // painting it upfront — erase strokes now punch real transparent holes
  // (see renderStrokeSymmetricTo), and destination-over here fills only
  // those holes (and any area with no content at all) with the background
  // colour, without touching already-opaque pixels. Must happen before any
  // UI chrome below (guides, handles, cursors) so those keep drawing with
  // normal compositing on top of a fully opaque canvas.
  ctx.save();
  ctx.globalCompositeOperation = 'destination-over';
  ctx.fillStyle = S.bgColor;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.restore();

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

  renderOverlay();
}

function spriteCanvasCenter(spr, m) {
  if (spr.warpMode) return warpArcCenter(spr, m);
  return { x: m.cx + spr.x, y: m.cy + spr.y };
}

function spriteAnimatedCenter(spr, m) {
  if (spr.warpMode) return warpArcCenter(spr, m);
  const clk = S.animClock;
  const rotRad  = ((spr.axisRotation != null ? spr.axisRotation : m.axisRotation) || 0) * Math.PI / 180;
  const sprOrbit = (getAnimValue(spr, 'orbit', clk) ?? (spr.orbitAngle || 0)) * Math.PI / 180;
  const { x: sprX, y: sprY } = spriteRadialTangentialOffset(spr, clk);
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
  const { x: ox, y: oy } = shapeRadialTangentialOffset(shape, clk);
  const angle = rotRad + orbit;
  return {
    x: m.cx + Math.cos(angle) * ox - Math.sin(angle) * oy,
    y: m.cy + Math.sin(angle) * ox + Math.cos(angle) * oy,
  };
}

// World position of an arbitrary point in a shape's own local frame — (lx,
// ly) relative to the shape's anchor, before the shape's own `rotation`
// property is applied (this function applies it). Unlike petal/bezier's
// per-point helpers below (which pivot around their tip, a fixed geometry
// anchor), this pivots around the shape's own origin, matching how
// renderShapeInContext's default branch (circle/star/polygon/text) actually
// rotates — `applyShapeLocalRotation` just does ctx.rotate(effRotRad) at the
// local origin for anything that isn't petal/bezier/wing. Used for text's
// rotation handle.
function shapeAnimatedWorldPoint(m, shape, lx, ly) {
  const clk = S.animClock;
  const rotRad = ((shape.axisRotation != null ? shape.axisRotation : m.axisRotation) || 0) * Math.PI / 180;
  const orbit  = (getAnimValue(shape, 'orbit', clk) ?? (shape.orbit || 0)) * Math.PI / 180;
  const effRot = (getAnimValue(shape, 'rotation', clk) ?? (shape.rotation || 0)) * Math.PI / 180;
  const { x: ox, y: oy } = shapeRadialTangentialOffset(shape, clk);
  const rx = Math.cos(effRot) * lx - Math.sin(effRot) * ly;
  const ry = Math.sin(effRot) * lx + Math.cos(effRot) * ly;
  const px = ox + rx, py = oy + ry;
  const angle = rotRad + orbit;
  return {
    x: m.cx + Math.cos(angle) * px - Math.sin(angle) * py,
    y: m.cy + Math.sin(angle) * px + Math.cos(angle) * py,
  };
}

// World position of an arbitrary point in a petal's local frame (relative
// to the tip, before the shape's own rotation) — like shapeAnimatedWorldCenter
// but for an offset point rather than the anchor itself, so it also accounts
// for the shape's own rotation (which rotates the tip->base axis around the
// tip). Used for the move/base/curvature edit handles alike.
// Shared by Petal and Bezier — both store x/y as the tip rather than the
// center, and both rotate around the tip->end midpoint (see
// renderShapeSymmetric), so an arbitrary local point (lx,ly) needs rotating
// relative to that pivot, not the local origin, to track the rendered shape.
function openCurveAnimatedWorldPoint(m, shape, dxField, dyField, lx, ly) {
  const clk = S.animClock;
  const rotRad = ((shape.axisRotation != null ? shape.axisRotation : m.axisRotation) || 0) * Math.PI / 180;
  const orbit = (getAnimValue(shape, 'orbit', clk) ?? (shape.orbit || 0)) * Math.PI / 180;
  const animRot = (getAnimValue(shape, 'rotation', clk) ?? (shape.rotation || 0)) * Math.PI / 180;
  const { x: ox, y: oy } = shapeRadialTangentialOffset(shape, clk);
  const pvx = (shape[dxField] || 0) / 2, pvy = (shape[dyField] || 0) / 2;
  const relX = lx - pvx, relY = ly - pvy;
  const rdx = Math.cos(animRot) * relX - Math.sin(animRot) * relY + pvx;
  const rdy = Math.sin(animRot) * relX + Math.cos(animRot) * relY + pvy;
  const px = ox + rdx, py = oy + rdy;
  const angle = rotRad + orbit;
  return {
    x: m.cx + Math.cos(angle) * px - Math.sin(angle) * py,
    y: m.cy + Math.sin(angle) * px + Math.cos(angle) * py,
  };
}

function petalAnimatedWorldPoint(m, shape, lx, ly) {
  return openCurveAnimatedWorldPoint(m, shape, 'petalDx', 'petalDy', lx, ly);
}

// World position of a petal's tip->base midpoint (its "grab anywhere to
// move" handle).
function petalAnimatedWorldMid(m, shape) {
  return petalAnimatedWorldPoint(m, shape, (shape.petalDx || 0) / 2, (shape.petalDy || 0) / 2);
}

function bezierAnimatedWorldPoint(m, shape, lx, ly) {
  return openCurveAnimatedWorldPoint(m, shape, 'bezierDx', 'bezierDy', lx, ly);
}

function bezierAnimatedWorldMid(m, shape) {
  return bezierAnimatedWorldPoint(m, shape, (shape.bezierDx || 0) / 2, (shape.bezierDy || 0) / 2);
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


// Construction guides shown only while creating a petal: a dashed line from
// tip to base (drag 1), then the curvature handle once drag 2 starts.
// Drawn once in the mandala's own local frame (not repeated per axis copy)
// since it's an editing aid, not part of the artwork.
function renderPetalGuides(m, tip, base, curveVal) {
  const rotRad = ((m.axisRotation) || 0) * Math.PI / 180;
  ctx.save();
  ctx.translate(m.cx, m.cy);
  ctx.rotate(rotRad);

  ctx.strokeStyle = 'rgba(124,106,240,0.8)';
  ctx.lineWidth = 1;
  ctx.setLineDash([5, 5]);
  ctx.beginPath();
  ctx.moveTo(tip.x, tip.y);
  ctx.lineTo(base.x, base.y);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(tip.x, tip.y, 4, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(base.x, base.y, 4, 0, Math.PI * 2); ctx.fill();

  if (curveVal != null) {
    const dx = base.x - tip.x, dy = base.y - tip.y;
    const axisLen = Math.hypot(dx, dy) || 1;
    const ux = dx / axisLen, uy = dy / axisLen;
    const px = -uy, py = ux;
    const midX = (tip.x + base.x) / 2, midY = (tip.y + base.y) / 2;
    const bulge = curveVal * axisLen;
    const hx = midX + px * bulge, hy = midY + py * bulge;
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.setLineDash([3, 3]);
    ctx.beginPath(); ctx.moveTo(midX, midY); ctx.lineTo(hx, hy); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#ff6b9d';
    ctx.beginPath(); ctx.arc(hx, hy, 5, 0, Math.PI * 2); ctx.fill();
  }

  ctx.restore();
}

// Like renderPetalGuides, but also shows the mirrored bottom point (Wing's
// second arm end) as its own dashed line + dot, live as the primary end
// point moves — since Wing's two arms are meant to read as distinct from
// the very start of the drag, not just once edited afterward.
function renderWingGuides(m, tip, end, curveVal, mirrorAngle) {
  const rotRad = ((m.axisRotation) || 0) * Math.PI / 180;
  const rel = { x: end.x - tip.x, y: end.y - tip.y };
  const mirroredRel = mirrorAcrossAxis(rel, mirrorAngle);
  const mirroredEnd = { x: tip.x + mirroredRel.x, y: tip.y + mirroredRel.y };

  ctx.save();
  ctx.translate(m.cx, m.cy);
  ctx.rotate(rotRad);

  ctx.strokeStyle = 'rgba(124,106,240,0.8)';
  ctx.lineWidth = 1;
  ctx.setLineDash([5, 5]);
  ctx.beginPath(); ctx.moveTo(tip.x, tip.y); ctx.lineTo(end.x, end.y); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(tip.x, tip.y); ctx.lineTo(mirroredEnd.x, mirroredEnd.y); ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(tip.x, tip.y, 4, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(end.x, end.y, 4, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(mirroredEnd.x, mirroredEnd.y, 4, 0, Math.PI * 2); ctx.fill();

  if (curveVal != null) {
    // Curvature guide for the primary arm only — the mirrored arm's own
    // control point is implied automatically (see wingCurves).
    const dx = end.x - tip.x, dy = end.y - tip.y;
    const axisLen = Math.hypot(dx, dy) || 1;
    const ux = dx / axisLen, uy = dy / axisLen;
    const px = -uy, py = ux;
    const midX = (tip.x + end.x) / 2, midY = (tip.y + end.y) / 2;
    const bulge = curveVal * axisLen;
    const hx = midX + px * bulge, hy = midY + py * bulge;
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.setLineDash([3, 3]);
    ctx.beginPath(); ctx.moveTo(midX, midY); ctx.lineTo(hx, hy); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#ff6b9d';
    ctx.beginPath(); ctx.arc(hx, hy, 5, 0, Math.PI * 2); ctx.fill();
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
    isActive, colors: [SNAP_AXIS_COLOR],
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
  const col = SNAP_AXIS_COLOR;
  const DOT_R = isActive ? 2 : 1.5;
  oc.save(); oc.translate(m.cx, m.cy);
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

function shapeContainsPoint(m, shape, wx, wy) {
  const n = shape.axes != null ? shape.axes : m.axes;
  const doMirror = shape.mirror !== false;
  const effectiveN = n === 0 ? 1 : (doMirror ? n : n * 2);
  const effectiveMirror = n === 0 ? false : doMirror;
  const segAngle = effectiveN > 0 ? (Math.PI * 2) / effectiveN : 0;
  const rotRad = ((shape.axisRotation != null ? shape.axisRotation : m.axisRotation) || 0) * Math.PI / 180;
  const { cx: hitCx, cy: hitCy, r: hitR } = shapeHitCircle(shape);
  for (let i = 0; i < effectiveN; i++) {
    for (let flip = 0; flip < (effectiveMirror ? 2 : 1); flip++) {
      const ang = rotRad + segAngle * i;
      const dx = wx - m.cx, dy = wy - m.cy;
      const cos = Math.cos(-ang), sin = Math.sin(-ang);
      let lx = cos * dx - sin * dy;
      let ly = sin * dx + cos * dy;
      if (flip === 1) ly = -ly;
      if (Math.hypot(lx - hitCx, ly - hitCy) <= hitR) return true;
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

function findSelectedStroke() {
  if (!S.selectedStrokeId) return null;
  for (const m of S.mandalas) {
    const stroke = (m.strokes || []).find(s => s.id === S.selectedStrokeId);
    if (stroke) return { stroke, mandala: m };
  }
  return null;
}

// Clears selection across every layer type + the Images list. Used whenever a
// new/different item is selected so the Inspector always reflects exactly one
// thing (or nothing), never a stale panel left open from a previous selection.
function clearAllSelections() {
  S.selectedSpriteId = null;
  S.selectedShapeId = null;
  S.selectedStrokeId = null;
  S.selectedPaletteId = null;
}

// The Layers panel's "Clear Selection" button is touch-only (gated by an
// `@media (hover: none)` rule in CSS — desktop already deselects by clicking
// empty canvas) and should only appear once there's actually a layer
// selected. Call after any of the three selection IDs might have changed.
function updateClearSelectionButtonVisibility() {
  const btn = document.getElementById('btn-clear-selection');
  if (!btn) return;
  const hasSelection = !!(S.selectedSpriteId || S.selectedShapeId || S.selectedStrokeId);
  btn.classList.toggle('has-selection', hasSelection);
}

// Shows the "nothing selected" placeholder only when all three layer-item
// Inspector panels are hidden — call after any updateXProps() runs. The
// Image Inspector lives as its own accordion in the Images panel instead,
// so it's intentionally excluded here.
function updateInspectorEmptyState() {
  const panels = ['sprite-props', 'shape-props', 'stroke-props'];
  const anyVisible = panels.some(id => {
    const el = document.getElementById(id);
    return el && el.style.display !== 'none';
  });
  const empty = document.getElementById('inspector-empty');
  if (empty) empty.style.display = anyVisible ? 'none' : '';
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
  if (shape.type === 'petal') {
    // Petals get three handles: drag the base point to re-aim/resize the
    // tip->base axis, drag the curvature point to re-bulge it, or grab
    // anywhere else in the hit circle to move the whole shape. Check the
    // small point handles first since they sit inside the move area.
    const { cA } = petalControlPoints(shape);
    const { x: bx, y: by } = petalAnimatedWorldPoint(m, shape, shape.petalDx || 0, shape.petalDy || 0);
    if (Math.hypot(wx - bx, wy - by) < HANDLE_RADIUS + 4) return 'petal-base';
    const { x: cvx, y: cvy } = petalAnimatedWorldPoint(m, shape, cA.x, cA.y);
    if (Math.hypot(wx - cvx, wy - cvy) < HANDLE_RADIUS + 4) return 'petal-curve';
    const { x: mx, y: my } = petalAnimatedWorldMid(m, shape);
    const axisLen = Math.hypot(shape.petalDx || 0, shape.petalDy || 0);
    if (Math.hypot(wx - mx, wy - my) < axisLen / 2 + (shape.thickness || 2) / 2 + 8) return 'shape-move';
    return null;
  }
  if (shape.type === 'bezier' || shape.type === 'wing') {
    // A true 2-control-point cubic Bezier: four handles total — move,
    // the end point, and two fully independent control-point handles (one
    // near the tip, one near the end), symmetric with each other. Wing
    // reuses these same four (its second arm is a live, non-interactive
    // mirror — see wingCurves).
    const { cA, cB } = bezierControlPoints(shape);
    const { x: ex, y: ey } = bezierAnimatedWorldPoint(m, shape, shape.bezierDx || 0, shape.bezierDy || 0);
    if (Math.hypot(wx - ex, wy - ey) < HANDLE_RADIUS + 4) return 'bezier-end';
    const { x: c1x, y: c1y } = bezierAnimatedWorldPoint(m, shape, cA.x, cA.y);
    if (Math.hypot(wx - c1x, wy - c1y) < HANDLE_RADIUS + 4) return 'bezier-c1';
    const { x: c2x, y: c2y } = bezierAnimatedWorldPoint(m, shape, cB.x, cB.y);
    if (Math.hypot(wx - c2x, wy - c2y) < HANDLE_RADIUS + 4) return 'bezier-c2';
    const { x: mx, y: my } = bezierAnimatedWorldMid(m, shape);
    const axisLen = Math.hypot(shape.bezierDx || 0, shape.bezierDy || 0);
    if (Math.hypot(wx - mx, wy - my) < axisLen / 2 + (shape.thickness || 2) / 2 + 8) return 'shape-move';
    return null;
  }
  if (shape.type === 'text') {
    // Move + rotate — no resize handle, Font Size drives sizing instead.
    // The rotate handle sits along the shape's own local -Y axis (straight
    // "up" before rotation is applied), so it visibly orbits the text as
    // rotation changes, same convention as most vector editors' rotate grips.
    const { r } = shapeHitCircle(shape);
    const { x: rhx, y: rhy } = shapeAnimatedWorldPoint(m, shape, 0, -(r + 20));
    if (Math.hypot(wx - rhx, wy - rhy) < HANDLE_RADIUS + 4) return 'shape-rotate';
    const { x: cx, y: cy } = shapeAnimatedWorldCenter(m, shape);
    if (Math.hypot(wx - cx, wy - cy) < r) return 'shape-move';
    return null;
  }
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
  if (shape.type === 'petal') {
    const { x: mx, y: my } = petalAnimatedWorldMid(m, shape);
    const axisLen = Math.hypot(shape.petalDx || 0, shape.petalDy || 0);
    const { cA } = petalControlPoints(shape);
    const { x: bx, y: by } = petalAnimatedWorldPoint(m, shape, shape.petalDx || 0, shape.petalDy || 0);
    const { x: cvx, y: cvy } = petalAnimatedWorldPoint(m, shape, cA.x, cA.y);
    ctx.save();
    ctx.strokeStyle = '#7c6af0';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 3]);
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    ctx.arc(mx, my, axisLen / 2 + (shape.thickness || 2) / 2 + 4, 0, Math.PI * 2);
    ctx.stroke();
    // Base/curvature construction line, matching the creation-time guides.
    ctx.beginPath();
    ctx.moveTo(mx, my);
    ctx.lineTo(cvx, cvy);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#7c6af0';
    ctx.beginPath();
    ctx.arc(mx, my, HANDLE_RADIUS, 0, Math.PI * 2);
    ctx.fill();
    // Base handle (white, matches the tip/base dots shown while drawing).
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = '#7c6af0';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(bx, by, HANDLE_RADIUS, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // Curvature handle (pink, matches the curvature dot shown while drawing).
    ctx.fillStyle = '#ff6b9d';
    ctx.strokeStyle = '#7c6af0';
    ctx.beginPath();
    ctx.arc(cvx, cvy, HANDLE_RADIUS, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    return;
  }
  if (shape.type === 'bezier' || shape.type === 'wing') {
    const { x: mx, y: my } = bezierAnimatedWorldMid(m, shape);
    const axisLen = Math.hypot(shape.bezierDx || 0, shape.bezierDy || 0);
    const { cA, cB } = bezierControlPoints(shape);
    const { x: tx, y: ty } = bezierAnimatedWorldPoint(m, shape, 0, 0);
    const { x: ex, y: ey } = bezierAnimatedWorldPoint(m, shape, shape.bezierDx || 0, shape.bezierDy || 0);
    const { x: c1x, y: c1y } = bezierAnimatedWorldPoint(m, shape, cA.x, cA.y);
    const { x: c2x, y: c2y } = bezierAnimatedWorldPoint(m, shape, cB.x, cB.y);
    ctx.save();
    ctx.strokeStyle = '#7c6af0';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 3]);
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    ctx.arc(mx, my, axisLen / 2 + (shape.thickness || 2) / 2 + 4, 0, Math.PI * 2);
    ctx.stroke();
    // Classic Bezier handle lines: tip->C1 and end->C2.
    ctx.beginPath();
    ctx.moveTo(tx, ty);
    ctx.lineTo(c1x, c1y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(ex, ey);
    ctx.lineTo(c2x, c2y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#7c6af0';
    ctx.beginPath();
    ctx.arc(mx, my, HANDLE_RADIUS, 0, Math.PI * 2);
    ctx.fill();
    // End handle (white, matches the tip/end dots shown while drawing).
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = '#7c6af0';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(ex, ey, HANDLE_RADIUS, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // C1 handle, near the tip (pink, matches Petal's curvature dot).
    ctx.fillStyle = '#ff6b9d';
    ctx.beginPath();
    ctx.arc(c1x, c1y, HANDLE_RADIUS, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // C2 handle, near the end (teal) — independent of C1, unlike Petal's
    // single shared curvature.
    ctx.fillStyle = '#6affc4';
    ctx.beginPath();
    ctx.arc(c2x, c2y, HANDLE_RADIUS, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    return;
  }
  if (shape.type === 'text') {
    const { x: cx, y: cy } = shapeAnimatedWorldCenter(m, shape);
    const { r } = shapeHitCircle(shape);
    const { x: rhx, y: rhy } = shapeAnimatedWorldPoint(m, shape, 0, -(r + 20));
    ctx.save();
    ctx.strokeStyle = '#7c6af0';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 3]);
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
    // Spoke out to the rotate handle, matching the base/curvature
    // construction lines Petal/Bezier draw to their own handles.
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(rhx, rhy);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#7c6af0';
    ctx.beginPath();
    ctx.arc(cx, cy, HANDLE_RADIUS, 0, Math.PI * 2);
    ctx.fill();
    // Rotate handle (green, matches Bezier's C2 handle colour convention
    // for "a different kind of control than move").
    ctx.fillStyle = '#6affc4';
    ctx.strokeStyle = '#7c6af0';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(rhx, rhy, HANDLE_RADIUS, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    return;
  }
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
  } else if (S.shapeHandleDrag === 'shape-rotate') {
    // Invert the axis/orbit transform to get the drag angle in the
    // shape's own local frame, then measure it against the handle's
    // un-rotated baseline (straight "up", i.e. -90°) — see
    // shapeAnimatedWorldPoint's comment for why the handle sits there.
    const { x: ccx, y: ccy } = shapeAnimatedWorldCenter(m, shape);
    const axisRotRad = ((shape.axisRotation != null ? shape.axisRotation : m.axisRotation) || 0) * Math.PI / 180;
    const orbit = (getAnimValue(shape, 'orbit', S.animClock) ?? (shape.orbit || 0)) * Math.PI / 180;
    const worldAngle = Math.atan2(pos.y - ccy, pos.x - ccx);
    const localAngle = worldAngle - (axisRotRad + orbit);
    shape.rotation = (localAngle + Math.PI / 2) * 180 / Math.PI;
    // Arc/Radial text: the same handle sits at (arc.radius + fontSize + 20)
    // from center regardless of rotation (rotating a point only changes its
    // angle, not its distance), so the drag distance from center doubles as
    // a live radius control — no separate resize handle needed.
    if (shape.type === 'text' && shape.arc?.enabled) {
      const dist = Math.hypot(pos.x - ccx, pos.y - ccy);
      const fontSize = shape.fontSize || 48;
      shape.arc.radius = Math.max(20, Math.round(dist - fontSize - 20));
    }
  } else if (S.shapeHandleDrag === 'petal-base') {
    // Re-aim/resize the tip->base axis, same angle-snap as the Line tool
    // and the petal's own creation drag.
    const rotRad = ((shape.axisRotation != null ? shape.axisRotation : m.axisRotation) || 0) * Math.PI / 180;
    const cos = Math.cos(-rotRad), sin = Math.sin(-rotRad);
    const ldx = cos * dx - sin * dy, ldy = sin * dx + cos * dy;
    let nx = (orig.petalDx || 0) + ldx, ny = (orig.petalDy || 0) + ldy;
    if (S.snapAngle) { const snap = snapAngle(nx, ny); nx = snap.dx; ny = snap.dy; }
    shape.petalDx = nx;
    shape.petalDy = ny;
  } else if (S.shapeHandleDrag === 'petal-curve') {
    // Re-bulge the petal — same perpendicular-distance-from-axis math used
    // to set curvature during creation, just driven by the handle instead
    // of the raw cursor position.
    const rotRad = ((shape.axisRotation != null ? shape.axisRotation : m.axisRotation) || 0) * Math.PI / 180;
    const cos = Math.cos(-rotRad), sin = Math.sin(-rotRad);
    const ldx = cos * dx - sin * dy, ldy = sin * dx + cos * dy;
    const { cA } = petalControlPoints(orig);
    const hx = cA.x + ldx, hy = cA.y + ldy;
    const axisDx = orig.petalDx || 0, axisDy = orig.petalDy || 0;
    const axisLen = Math.max(1, Math.hypot(axisDx, axisDy));
    const ux = axisDx / axisLen, uy = axisDy / axisLen;
    const px = -uy, py = ux;
    const midX = axisDx / 2, midY = axisDy / 2;
    const perpDist = (hx - midX) * px + (hy - midY) * py;
    shape.petalCurve = Math.max(-1.2, Math.min(1.2, perpDist / axisLen));
  } else if (S.shapeHandleDrag === 'bezier-end') {
    // Same as petal-base — re-aim/resize the tip->end axis. Note this
    // leaves C1/C2 fixed in local space, so they don't automatically
    // follow — same tradeoff a vector editor's anchor drag has when handles
    // aren't explicitly re-linked.
    const rotRad = ((shape.axisRotation != null ? shape.axisRotation : m.axisRotation) || 0) * Math.PI / 180;
    const cos = Math.cos(-rotRad), sin = Math.sin(-rotRad);
    const ldx = cos * dx - sin * dy, ldy = sin * dx + cos * dy;
    let nx = (orig.bezierDx || 0) + ldx, ny = (orig.bezierDy || 0) + ldy;
    if (S.snapAngle) { const snap = snapAngle(nx, ny); nx = snap.dx; ny = snap.dy; }
    shape.bezierDx = nx;
    shape.bezierDy = ny;
  } else if (S.shapeHandleDrag === 'bezier-c1' || S.shapeHandleDrag === 'bezier-c2') {
    // Both control points are fully independent free 2D handles — no
    // scalar curvature concept, no mirroring. Whichever one is grabbed
    // just moves by the same rotation-corrected delta as every other
    // shape handle (see 'shape-move').
    const rotRad = ((shape.axisRotation != null ? shape.axisRotation : m.axisRotation) || 0) * Math.PI / 180;
    const cos = Math.cos(-rotRad), sin = Math.sin(-rotRad);
    const ldx = cos * dx - sin * dy, ldy = sin * dx + cos * dy;
    const { cA, cB } = bezierControlPoints(orig);
    if (S.shapeHandleDrag === 'bezier-c1') {
      shape.bezierC1x = cA.x + ldx;
      shape.bezierC1y = cA.y + ldy;
    } else {
      shape.bezierC2x = cB.x + ldx;
      shape.bezierC2y = cB.y + ldy;
    }
  }
  updateShapeProps();
}

// ── Shape properties panel (right panel) ─────────────────
let spGradientEditor = null; // set up in wireShapeProps(), reused across selections
function updateShapeProps() {
  const panel = document.getElementById('shape-props');
  if (!panel) return;
  updateClearSelectionButtonVisibility();
  const found = findSelectedShape();
  if (!found) { panel.style.display = 'none'; updateInspectorEmptyState(); updateLayersList(); return; }
  panel.style.display = '';
  updateInspectorEmptyState();
  updateLayersList();
  const { shape } = found;
  document.getElementById('sp-type-label').textContent =
    shape.type.charAt(0).toUpperCase() + shape.type.slice(1);
  document.getElementById('sp-radius').value = Math.round(shape.r || 0);
  document.getElementById('sp-radius-val').textContent = Math.round(shape.r || 0) + 'px';
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

  // Radius doesn't apply to petal/bezier/wing (sized by tip/end/curvature
  // instead); Petal's Curvature slider doesn't apply to Bezier or Wing —
  // both use freeform control-point handles, with no single scalar to show.
  const isPetal = shape.type === 'petal';
  const isBezier = shape.type === 'bezier' || shape.type === 'wing';
  const isText = shape.type === 'text';
  const radiusBlock = document.getElementById('sp-radius-block');
  const petalRow = document.getElementById('sp-petal-row');
  if (radiusBlock) radiusBlock.style.display = (isPetal || isBezier || isText) ? 'none' : '';
  if (petalRow) petalRow.style.display = isPetal ? '' : 'none';
  const textRow = document.getElementById('sp-text-row');
  if (textRow) textRow.style.display = isText ? '' : 'none';
  if (isText) {
    const textContentEl = document.getElementById('sp-text-content');
    if (document.activeElement !== textContentEl) textContentEl.value = shape.text || '';
    const currentFont = shape.fontFamily || 'Inter';
    const fontBtn = document.getElementById('sp-text-font-btn');
    let matchedItem = null;
    document.querySelectorAll('#sp-text-font-menu .font-menu-item').forEach(item => {
      const isMatch = item.dataset.value === currentFont;
      item.classList.toggle('selected', isMatch);
      if (isMatch) matchedItem = item;
    });
    if (fontBtn) {
      fontBtn.textContent = matchedItem ? matchedItem.textContent : currentFont;
      fontBtn.style.fontFamily = currentFont;
    }
    document.getElementById('sp-text-size').value = shape.fontSize || 48;
    document.getElementById('sp-text-size-val').textContent = (shape.fontSize || 48) + 'px';
    const hasArc = !!shape.arc?.enabled;
    document.getElementById('sp-arc-on').checked = hasArc;
    document.getElementById('sp-arc-radial').checked = !!shape.arc?.radial;
    document.getElementById('sp-arc-options').style.display = hasArc ? '' : 'none';
    if (shape.arc) {
      document.getElementById('sp-arc-radius').value = shape.arc.radius || 150;
      document.getElementById('sp-arc-radius-val').textContent = (shape.arc.radius || 150) + 'px';
      document.getElementById('sp-arc-start').value = shape.arc.startAngle || 0;
      document.getElementById('sp-arc-start-val').textContent = (shape.arc.startAngle || 0) + '°';
      document.getElementById('sp-arc-direction').value = shape.arc.direction === -1 ? '-1' : '1';
      document.getElementById('sp-arc-flip').checked = !!shape.arc.flip;
      document.getElementById('sp-arc-warp').checked = !!shape.arc.warp;
    }
  }
  // Radial Text locks x/y to the mandala's true center — hide the Offset
  // controls rather than let them silently fight (and visually break) that
  // lock. Axes/mirror are left alone so the mandala's normal symmetry still
  // draws every copy, evenly spaced around the same real circle.
  const offsetBlock = document.getElementById('sp-offset-block');
  if (offsetBlock) offsetBlock.style.display = (isText && shape.arc?.radial) ? 'none' : '';
  if (isPetal) {
    const pct = Math.round((shape.petalCurve ?? 0.35) * 100);
    document.getElementById('sp-petal-curve').value = pct;
    document.getElementById('sp-petal-curve-val').textContent = pct + '%';
  }
  // Bezier/Wing are always unfilled — Fill doesn't apply, hide it rather
  // than let it silently do nothing. Cap DOES apply (both ends are plain,
  // configurable stroke ends).
  const fillRow = document.getElementById('sp-fill-row');
  if (fillRow) fillRow.style.display = (isBezier || isText) ? 'none' : '';
  const thicknessBlock = document.getElementById('sp-thickness-block');
  if (thicknessBlock) thicknessBlock.style.display = isText ? 'none' : '';

  // Gradient and fading-trail — same controls the Drawing inspector has.
  const hasGradient = !!shape.gradient;
  document.getElementById('sp-gradient-on').checked = hasGradient;
  document.getElementById('sp-gradient-options').style.display = hasGradient ? '' : 'none';
  if (hasGradient) {
    document.getElementById('sp-grad-reverse').checked = !!shape.gradient.reverse;
    document.getElementById('sp-grad-preset').value = findMatchingPresetName(shape.gradient.stops);
    spGradientEditor?.render();
  }

  const hasTrail = !!shape.trailAnim?.enabled;
  document.getElementById('sp-trail-on').checked = hasTrail;
  document.getElementById('sp-trail-options').style.display = hasTrail ? '' : 'none';
  if (shape.trailAnim) {
    document.getElementById('sp-trail-speed').value = shape.trailAnim.duration;
    document.getElementById('sp-trail-length').value = shape.trailAnim.lengthPct;
    document.getElementById('sp-trail-length-val').textContent = shape.trailAnim.lengthPct + '%';
    document.getElementById('sp-trail-continuous').checked = !!shape.trailAnim.continuous;
    document.getElementById('sp-trail-reverse').checked = !!shape.trailAnim.reverse;
  }
}

// ── Text font picker (built-in list + uploaded custom fonts) ─────
// Applies whichever menu row (built-in or custom) was clicked to the
// currently-selected shape and updates the button/menu to reflect it.
// Top-level rather than nested in wireShapeProps() since loadProject()
// also needs to rebuild menu items for restored custom fonts.
function selectFontMenuItem(item) {
  const value = item.dataset.value;
  const found = findSelectedShape();
  if (found) { found.shape.fontFamily = value; markRenderDirty(); }
  const fontBtn = document.getElementById('sp-text-font-btn');
  const fontMenu = document.getElementById('sp-text-font-menu');
  if (fontBtn) { fontBtn.textContent = item.textContent; fontBtn.style.fontFamily = value; }
  if (fontMenu) {
    fontMenu.querySelectorAll('.font-menu-item').forEach(i => i.classList.toggle('selected', i === item));
    fontMenu.classList.remove('visible');
  }
  historySnapshot();
}

// Inserts a menu row for an already-registered custom font, just above the
// "+ Upload Font…" row, and reveals the separator above it (hidden until
// there's at least one custom font to separate from the built-in list).
function addCustomFontMenuItem(cf) {
  const menu = document.getElementById('sp-text-font-menu');
  const uploadBtn = document.getElementById('font-menu-upload-btn');
  const sep = document.getElementById('font-menu-custom-sep');
  if (!menu || !uploadBtn) return null;
  if (sep) sep.style.display = '';
  const item = document.createElement('div');
  item.className = 'font-menu-item';
  item.dataset.value = `'${cf.family}'`;
  item.style.fontFamily = `'${cf.family}'`;
  item.textContent = cf.name;
  item.addEventListener('click', () => selectFontMenuItem(item));
  menu.insertBefore(item, uploadBtn);
  return item;
}

// Reads an uploaded font file, registers it, and stores it in
// S.customFonts (base64 dataUrl, so saveProject/loadProject persist it
// exactly like a palette image). Returns null (and warns the user) if the
// browser couldn't parse the file as a font at all.
async function addCustomFont(file) {
  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
  const id = uid();
  const family = `CustomFont_${id}`;
  const name = file.name.replace(/\.[^.]+$/, '');
  const cf = { id, name, family, dataUrl };
  const ok = await registerCustomFont(cf);
  if (!ok) { alert(`Couldn't load "${file.name}" as a font.`); return null; }
  S.customFonts.push(cf);
  return cf;
}

function wireShapeProps() {
  function forShape(fn) { const f = findSelectedShape(); if (f) fn(f.shape); }
  document.getElementById('sp-radius').addEventListener('input', e => {
    forShape(s => { s.r = parseInt(e.target.value) || 10; document.getElementById('sp-radius-val').textContent = s.r + 'px'; });
  });
  document.getElementById('sp-text-content').addEventListener('input', e => {
    forShape(s => { s.text = e.target.value; markRenderDirty(); });
  });
  document.getElementById('sp-text-content').addEventListener('change', () => historySnapshot());

  // Custom font popover (not a native <select> — see the .font-menu CSS
  // comment for why). Click the button to open a fixed-position list
  // anchored under it; click a row to apply and close; click anywhere
  // else to close without choosing. selectFontMenuItem/addCustomFontMenuItem
  // are top-level (not local to this function) since loadProject() also
  // needs to rebuild menu items for restored custom fonts, well outside
  // this closure.
  const fontBtn = document.getElementById('sp-text-font-btn');
  const fontMenu = document.getElementById('sp-text-font-menu');
  fontBtn.addEventListener('click', e => {
    e.stopPropagation();
    const rect = fontBtn.getBoundingClientRect();
    fontMenu.style.left = rect.left + 'px';
    fontMenu.style.top = (rect.bottom + 4) + 'px';
    fontMenu.classList.toggle('visible');
  });
  // :not(.font-menu-upload) — the upload row shares the same base class for
  // layout/hover styling but opens the file picker instead of picking a
  // font, wired separately below.
  fontMenu.querySelectorAll('.font-menu-item:not(.font-menu-upload)').forEach(item => {
    item.addEventListener('click', () => selectFontMenuItem(item));
  });
  document.addEventListener('click', () => fontMenu.classList.remove('visible'));

  // Upload a custom font: FontFace API + base64 persistence (see the
  // customFonts comment in state) so it round-trips through save/load.
  const fontUploadBtn = document.getElementById('font-menu-upload-btn');
  const fontUploadInput = document.getElementById('font-upload-input');
  fontUploadBtn.addEventListener('click', e => {
    e.stopPropagation();
    fontUploadInput.click();
  });
  fontUploadInput.addEventListener('change', async e => {
    const file = e.target.files[0];
    fontUploadInput.value = ''; // allow re-selecting the same file later
    if (!file) return;
    const cf = await addCustomFont(file);
    if (!cf) return;
    const item = addCustomFontMenuItem(cf);
    selectFontMenuItem(item);
  });

  document.getElementById('sp-text-size').addEventListener('input', e => {
    forShape(s => { s.fontSize = parseInt(e.target.value) || 48; document.getElementById('sp-text-size-val').textContent = s.fontSize + 'px'; });
  });
  document.getElementById('sp-text-size').addEventListener('change', () => historySnapshot());
  document.getElementById('sp-arc-on').addEventListener('change', e => {
    forShape(s => {
      s.arc = e.target.checked ? { enabled: true, radius: 150, startAngle: -90, direction: 1, flip: false, warp: false, radial: false } : null;
      document.getElementById('sp-arc-options').style.display = e.target.checked ? '' : 'none';
      // Turning Arc Text off entirely takes Radial Text down with it — a
      // radial ring has no meaning without curving. Restore wherever the
      // shape was before Radial centred it, same as unchecking Radial
      // Text alone does.
      if (!e.target.checked) {
        document.getElementById('sp-arc-radial').checked = false;
        document.getElementById('sp-offset-block').style.display = '';
        if (s._preRadialX != null) { s.x = s._preRadialX; delete s._preRadialX; }
        if (s._preRadialY != null) { s.y = s._preRadialY; delete s._preRadialY; }
        document.getElementById('sp-offsetX').value = s.x;
        document.getElementById('sp-offsetX-val').textContent = s.x;
        document.getElementById('sp-offsetY').value = s.y;
        document.getElementById('sp-offsetY-val').textContent = s.y;
      }
      markRenderDirty();
    });
    historySnapshot();
  });
  document.getElementById('sp-arc-radius').addEventListener('input', e => {
    forShape(s => { if (s.arc) { s.arc.radius = parseInt(e.target.value) || 150; document.getElementById('sp-arc-radius-val').textContent = s.arc.radius + 'px'; } });
  });
  document.getElementById('sp-arc-radius').addEventListener('change', () => historySnapshot());
  document.getElementById('sp-arc-start').addEventListener('input', e => {
    forShape(s => { if (s.arc) { s.arc.startAngle = parseInt(e.target.value) || 0; document.getElementById('sp-arc-start-val').textContent = s.arc.startAngle + '°'; } });
  });
  document.getElementById('sp-arc-start').addEventListener('change', () => historySnapshot());
  document.getElementById('sp-arc-direction').addEventListener('change', e => {
    forShape(s => { if (s.arc) s.arc.direction = parseInt(e.target.value); });
    historySnapshot();
  });
  document.getElementById('sp-arc-flip').addEventListener('change', e => {
    forShape(s => { if (s.arc) s.arc.flip = e.target.checked; });
    historySnapshot();
  });
  document.getElementById('sp-arc-warp').addEventListener('change', e => {
    forShape(s => { if (s.arc) s.arc.warp = e.target.checked; });
    historySnapshot();
  });
  // Independent of Arc Text's own checkbox — turning Radial Text on auto-
  // enables arc curving (creating shape.arc if it doesn't exist yet) rather
  // than requiring Arc Text to already be checked.
  document.getElementById('sp-arc-radial').addEventListener('change', e => {
    forShape(s => {
      if (e.target.checked) {
        if (!s.arc) s.arc = { enabled: true, radius: 150, startAngle: -90, direction: 1, flip: false, warp: false, radial: false };
        s.arc.enabled = true;
        s.arc.radial = true;
        // Center on the mandala's true centre — every axis/mirror copy
        // already shares that same center point (translate happens before
        // rotate), differing only by rotation, so this alone is enough to
        // make the mandala's normal symmetry tile evenly-spaced copies of
        // the text around one real circle. Axes/mirror are deliberately
        // left untouched: forcing a single copy here was the earlier
        // mistake — every instance the mandala already draws needs to
        // stay on the circle, not collapse down to one.
        // Remember wherever it was so turning Radial back off can put it
        // there again instead of leaving it stuck at the centre (which
        // would otherwise look identical to Radial being still on, since
        // x=0,y=0 IS what makes the ring tile evenly in the first place).
        s._preRadialX = s.x; s._preRadialY = s.y;
        s.x = 0; s.y = 0;
        document.getElementById('sp-arc-on').checked = true;
        document.getElementById('sp-arc-options').style.display = '';
      } else if (s.arc) {
        s.arc.radial = false;
        if (s._preRadialX != null) { s.x = s._preRadialX; delete s._preRadialX; }
        if (s._preRadialY != null) { s.y = s._preRadialY; delete s._preRadialY; }
      }
      document.getElementById('sp-offset-block').style.display = (s.arc?.radial) ? 'none' : '';
      document.getElementById('sp-offsetX').value = s.x;
      document.getElementById('sp-offsetX-val').textContent = s.x;
      document.getElementById('sp-offsetY').value = s.y;
      document.getElementById('sp-offsetY-val').textContent = s.y;
      markRenderDirty();
    });
    historySnapshot();
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
    const sides = parseInt(e.target.value) || 6;
    forShape(s => { if (!s.params) s.params = {}; s.params.sides = sides; });
    document.getElementById('sp-sides-val').textContent = e.target.value;
    // Also remember this as the default for the next new polygon drawn.
    S.shapeParams.sides = sides;
    const toolSidesInput = document.getElementById('shapep-sides');
    if (toolSidesInput) toolSidesInput.value = sides;
    try { localStorage.setItem('mandala-polygon-sides', String(sides)); } catch {}
  });
  document.getElementById('sp-petal-curve').addEventListener('input', e => {
    forShape(s => { s.petalCurve = parseInt(e.target.value) / 100; });
    document.getElementById('sp-petal-curve-val').textContent = e.target.value + '%';
  });
  spGradientEditor = makeGradientStopEditor({
    canvas: document.getElementById('sp-grad-preview'),
    scaleInput: document.getElementById('sp-grad-scale'),
    scaleVal: document.getElementById('sp-grad-scale-val'),
    speedInput: document.getElementById('sp-grad-speed'),
    speedVal: document.getElementById('sp-grad-speed-val'),
    getGradient: () => findSelectedShape()?.shape.gradient,
    onChange: () => {
      forShape(s => {
        markRenderDirty();
        flushHasAnimCache();
        if (s.gradient?.speed > 0 && !S.animPaused && !S.rafId) S.rafId = requestAnimationFrame(render);
      });
    },
  });

  const spPresetSel = document.getElementById('sp-grad-preset');
  spPresetSel.appendChild(new Option('Preset…', ''));
  for (const name of Object.keys(GRADIENT_PRESETS)) {
    const opt = document.createElement('option');
    opt.value = name; opt.textContent = name;
    spPresetSel.appendChild(opt);
  }
  spPresetSel.addEventListener('change', () => {
    if (!spPresetSel.value) return;
    forShape(s => {
      if (!s.gradient) return;
      s.gradient.stops = JSON.parse(JSON.stringify(GRADIENT_PRESETS[spPresetSel.value]));
      spGradientEditor.resetSelection();
      spGradientEditor.render();
      markRenderDirty();
    });
  });

  document.getElementById('sp-gradient-on').addEventListener('change', e => {
    forShape(s => {
      if (e.target.checked) {
        // Deep-clone so this shape's stops are independent of the shared
        // toolbar gradient (and any other shape/stroke).
        s.gradient = { stops: JSON.parse(JSON.stringify(S.gradient.stops)), scale: S.gradient.scale, speed: S.gradient.speed };
        spGradientEditor.resetSelection();
      } else {
        s.gradient = null;
      }
      markRenderDirty();
      flushHasAnimCache();
      updateShapeProps();
      if (s.gradient?.speed > 0 && !S.animPaused && !S.rafId) S.rafId = requestAnimationFrame(render);
    });
  });
  document.getElementById('sp-grad-scale').addEventListener('input', e => {
    forShape(s => {
      if (!s.gradient) return;
      s.gradient.scale = parseInt(e.target.value);
      spGradientEditor.render();
      markRenderDirty();
    });
  });
  document.getElementById('sp-grad-speed').addEventListener('input', e => {
    forShape(s => {
      if (!s.gradient) return;
      s.gradient.speed = parseInt(e.target.value) / 100;
      spGradientEditor.render();
      flushHasAnimCache();
      if (s.gradient.speed > 0 && !S.animPaused && !S.rafId) S.rafId = requestAnimationFrame(render);
    });
  });
  document.getElementById('sp-grad-reverse').addEventListener('change', e => {
    forShape(s => {
      if (!s.gradient) return;
      s.gradient.reverse = e.target.checked;
      markRenderDirty();
    });
  });

  document.getElementById('sp-trail-on').addEventListener('change', e => {
    forShape(s => {
      if (!s.trailAnim) s.trailAnim = { enabled: false, duration: 2, lengthPct: 40, continuous: false, reverse: false };
      s.trailAnim.enabled = e.target.checked;
      markRenderDirty();
      flushHasAnimCache();
      updateShapeProps();
      if (s.trailAnim.enabled && !S.animPaused && !S.rafId) S.rafId = requestAnimationFrame(render);
    });
  });
  document.getElementById('sp-trail-speed').addEventListener('input', e => {
    forShape(s => {
      if (!s.trailAnim) return;
      const v = parseFloat(e.target.value);
      s.trailAnim.duration = (v > 0) ? v : 0.1;
      markRenderDirty();
    });
  });
  document.getElementById('sp-trail-length').addEventListener('input', e => {
    forShape(s => {
      if (!s.trailAnim) return;
      const v = parseInt(e.target.value);
      s.trailAnim.lengthPct = v;
      document.getElementById('sp-trail-length-val').textContent = v + '%';
      markRenderDirty();
    });
  });
  document.getElementById('sp-trail-continuous').addEventListener('change', e => {
    forShape(s => {
      if (!s.trailAnim) return;
      s.trailAnim.continuous = e.target.checked;
      markRenderDirty();
    });
  });
  document.getElementById('sp-trail-reverse').addEventListener('change', e => {
    forShape(s => {
      if (!s.trailAnim) return;
      s.trailAnim.reverse = e.target.checked;
      markRenderDirty();
    });
  });

  document.getElementById('sp-dup').addEventListener('click', () => {
    const found = findSelectedShape();
    if (!found) return;
    historySnapshot();
    // Deep clone, not a shallow spread — a shallow copy shares the exact
    // same anim/gradient/trailAnim/params objects (and their keyframe
    // arrays) with the original, so dragging a keyframe or editing a
    // gradient stop on either one silently edits both. JSON round-trip
    // matches how saveProject/loadProject already serialize this same
    // shape data, so anything that survives a save/load survives this too.
    const copy = { ...JSON.parse(JSON.stringify(found.shape)), id: uid(), z: nextZ(found.mandala), x: found.shape.x + 20, y: found.shape.y + 20 };
    (found.mandala.shapes = found.mandala.shapes || []).push(copy);
    S.selectedShapeId = copy.id;
    flushHasAnimCache();
    markRenderDirty();
    updateShapeProps();
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

// ── Drawing (stroke) inspector — gradient/colour/thickness + trail anim ──
let dpGradientEditor = null; // set up in wireStrokeProps(), reused across selections

function updateStrokeProps() {
  const panel = document.getElementById('stroke-props');
  if (!panel) return;
  updateClearSelectionButtonVisibility();
  const found = findSelectedStroke();
  if (!found) { panel.style.display = 'none'; updateInspectorEmptyState(); updateLayersList(); return; }
  panel.style.display = '';
  updateInspectorEmptyState();
  updateLayersList();
  const { stroke } = found;

  document.getElementById('dp-color').value = stroke.color;
  document.getElementById('dp-thickness').value = stroke.thickness;
  document.getElementById('dp-thickness-val').textContent = stroke.thickness;
  document.getElementById('dp-opacity').value = stroke.opacity;
  document.getElementById('dp-opacity-val').textContent = Math.round(stroke.opacity * 100) + '%';

  document.getElementById('dp-orbit').value = stroke.orbit || 0;
  document.getElementById('dp-orbit-val').textContent = (stroke.orbit || 0) + '°';
  const orbitAnim = stroke.anim?.orbit;
  document.getElementById('dpa-btn-orbit').classList.toggle('active', !!orbitAnim?.enabled);
  document.getElementById('dpa-panel-orbit').style.display = orbitAnim?.enabled ? '' : 'none';
  if (orbitAnim) document.getElementById('dpa-dur-orbit').value = orbitAnim.duration;
  drawDrawingOrbitTimeline();

  const hasGradient = !!stroke.gradient;
  document.getElementById('dp-gradient-on').checked = hasGradient;
  document.getElementById('dp-gradient-options').style.display = hasGradient ? '' : 'none';
  if (hasGradient) {
    document.getElementById('dp-grad-reverse').checked = !!stroke.gradient.reverse;
    document.getElementById('dp-grad-preset').value = findMatchingPresetName(stroke.gradient.stops);
    dpGradientEditor?.render();
  }

  const hasTrail = !!stroke.trailAnim?.enabled;
  document.getElementById('dp-trail-on').checked = hasTrail;
  document.getElementById('dp-trail-options').style.display = hasTrail ? '' : 'none';
  if (stroke.trailAnim) {
    document.getElementById('dp-trail-speed').value = stroke.trailAnim.duration;
    document.getElementById('dp-trail-length').value = stroke.trailAnim.lengthPct;
    document.getElementById('dp-trail-length-val').textContent = stroke.trailAnim.lengthPct + '%';
    document.getElementById('dp-trail-continuous').checked = !!stroke.trailAnim.continuous;
    document.getElementById('dp-trail-reverse').checked = !!stroke.trailAnim.reverse;
  }
}

function wireStrokeProps() {
  function forStroke(fn) { const f = findSelectedStroke(); if (f) fn(f.stroke); }

  document.getElementById('dp-color').addEventListener('input', e => {
    forStroke(s => { s.color = e.target.value; invalidateStrokeCache(); });
  });
  document.getElementById('dp-thickness').addEventListener('input', e => {
    forStroke(s => {
      s.thickness = parseInt(e.target.value) || 1;
      document.getElementById('dp-thickness-val').textContent = s.thickness;
      invalidateStrokeCache();
    });
  });
  document.getElementById('dp-opacity').addEventListener('input', e => {
    forStroke(s => {
      s.opacity = parseFloat(e.target.value);
      document.getElementById('dp-opacity-val').textContent = Math.round(s.opacity * 100) + '%';
      invalidateStrokeCache();
    });
  });
  document.getElementById('dp-orbit').addEventListener('input', e => {
    forStroke(s => {
      s.orbit = parseInt(e.target.value) || 0;
      document.getElementById('dp-orbit-val').textContent = s.orbit + '°';
      invalidateStrokeCache();
    });
  });
  wireStrokeOrbitAnim();

  dpGradientEditor = makeGradientStopEditor({
    canvas: document.getElementById('dp-grad-preview'),
    scaleInput: document.getElementById('dp-grad-scale'),
    scaleVal: document.getElementById('dp-grad-scale-val'),
    speedInput: document.getElementById('dp-grad-speed'),
    speedVal: document.getElementById('dp-grad-speed-val'),
    getGradient: () => findSelectedStroke()?.stroke.gradient,
    onChange: () => {
      forStroke(s => {
        invalidateStrokeCache();
        flushHasAnimCache();
        if (s.gradient?.speed > 0 && !S.animPaused && !S.rafId) S.rafId = requestAnimationFrame(render);
      });
    },
  });

  const dpPresetSel = document.getElementById('dp-grad-preset');
  dpPresetSel.appendChild(new Option('Preset…', ''));
  for (const name of Object.keys(GRADIENT_PRESETS)) {
    const opt = document.createElement('option');
    opt.value = name; opt.textContent = name;
    dpPresetSel.appendChild(opt);
  }
  dpPresetSel.addEventListener('change', () => {
    if (!dpPresetSel.value) return;
    forStroke(s => {
      if (!s.gradient) return;
      s.gradient.stops = JSON.parse(JSON.stringify(GRADIENT_PRESETS[dpPresetSel.value]));
      dpGradientEditor.resetSelection();
      dpGradientEditor.render();
      invalidateStrokeCache();
    });
  });

  document.getElementById('dp-gradient-on').addEventListener('change', e => {
    forStroke(s => {
      if (e.target.checked) {
        // Deep-clone so this stroke's stops are independent of the shared
        // toolbar gradient (and any other stroke) — editing one must not
        // silently mutate the others.
        s.gradient = { stops: JSON.parse(JSON.stringify(S.gradient.stops)), scale: S.gradient.scale, speed: S.gradient.speed };
        dpGradientEditor.resetSelection();
      } else {
        s.gradient = null;
      }
      invalidateStrokeCache();
      flushHasAnimCache();
      updateStrokeProps();
      if (s.gradient?.speed > 0 && !S.animPaused && !S.rafId) S.rafId = requestAnimationFrame(render);
    });
  });
  document.getElementById('dp-grad-scale').addEventListener('input', e => {
    forStroke(s => {
      if (!s.gradient) return;
      s.gradient.scale = parseInt(e.target.value);
      dpGradientEditor.render();
      invalidateStrokeCache();
    });
  });
  document.getElementById('dp-grad-speed').addEventListener('input', e => {
    forStroke(s => {
      if (!s.gradient) return;
      s.gradient.speed = parseInt(e.target.value) / 100;
      dpGradientEditor.render();
      flushHasAnimCache();
      if (s.gradient.speed > 0 && !S.animPaused && !S.rafId) S.rafId = requestAnimationFrame(render);
    });
  });
  document.getElementById('dp-grad-reverse').addEventListener('change', e => {
    forStroke(s => {
      if (!s.gradient) return;
      s.gradient.reverse = e.target.checked;
      markRenderDirty();
    });
  });

  document.getElementById('dp-trail-on').addEventListener('change', e => {
    forStroke(s => {
      if (!s.trailAnim) s.trailAnim = { enabled: false, duration: 2, lengthPct: 40, continuous: false, reverse: false };
      s.trailAnim.enabled = e.target.checked;
      invalidateStrokeCache();
      flushHasAnimCache();
      updateStrokeProps();
      if (s.trailAnim.enabled && !S.animPaused && !S.rafId) S.rafId = requestAnimationFrame(render);
    });
  });
  document.getElementById('dp-trail-speed').addEventListener('input', e => {
    forStroke(s => {
      if (!s.trailAnim) return;
      const v = parseFloat(e.target.value);
      s.trailAnim.duration = (v > 0) ? v : 0.1;
      markRenderDirty();
    });
  });
  document.getElementById('dp-trail-length').addEventListener('input', e => {
    forStroke(s => {
      if (!s.trailAnim) return;
      const v = parseInt(e.target.value) || 5;
      s.trailAnim.lengthPct = v;
      document.getElementById('dp-trail-length-val').textContent = v + '%';
      markRenderDirty();
    });
  });
  document.getElementById('dp-trail-continuous').addEventListener('change', e => {
    forStroke(s => {
      if (!s.trailAnim) return;
      s.trailAnim.continuous = e.target.checked;
      markRenderDirty();
    });
  });
  document.getElementById('dp-trail-reverse').addEventListener('change', e => {
    forStroke(s => {
      if (!s.trailAnim) return;
      s.trailAnim.reverse = e.target.checked;
      markRenderDirty();
    });
  });

  document.getElementById('dp-dup').addEventListener('click', () => {
    const found = findSelectedStroke();
    if (!found) return;
    historySnapshot();
    // Deep clone — see the shape Duplicate handler's comment for why a
    // shallow spread isn't enough (shared gradient/trailAnim/anim.orbit
    // keyframe object references). pts still gets its own explicit +20/+20
    // remap since the JSON clone alone wouldn't offset the copy's position.
    const copy = { ...JSON.parse(JSON.stringify(found.stroke)), id: uid(), pts: found.stroke.pts.map(p => ({ x: p.x + 20, y: p.y + 20 })) };
    (found.mandala.strokes = found.mandala.strokes || []).push(copy);
    S.selectedStrokeId = copy.id;
    invalidateStrokeCache();
    flushHasAnimCache();
    updateStrokeProps();
  });

  document.getElementById('dp-delete').addEventListener('click', () => {
    const found = findSelectedStroke();
    if (!found || !confirm('Delete this drawing? This cannot be undone.')) return;
    historySnapshot();
    found.mandala.strokes = (found.mandala.strokes || []).filter(s => s.id !== found.stroke.id);
    S.selectedStrokeId = null;
    invalidateStrokeCache();
    flushHasAnimCache();
    updateStrokeProps();
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
      updateLayersList();
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
  document.getElementById('shapep-sides').addEventListener('input', e => {
    S.shapeParams.sides = parseInt(e.target.value) || 6;
    try { localStorage.setItem('mandala-polygon-sides', String(S.shapeParams.sides)); } catch {}
  });
  document.getElementById('btn-shape-gradient').addEventListener('click', () => {
    S.gradientMode = !S.gradientMode;
    document.getElementById('btn-shape-gradient').classList.toggle('active', S.gradientMode);
    // Keep main gradient toggle in sync
    const mainBtn = document.getElementById('btn-gradient-mode');
    if (mainBtn) mainBtn.classList.toggle('active', S.gradientMode);
    updateGradientPanelVisibility();
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
  // e.button is undefined for touch events — only gate on it for real mouse events.
  if (e.button != null && e.button !== 0) return;
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
      clearAllSelections();
      S.selectedSpriteId = hit.sprite.id;
      S.dragHandle = 'move';
      S.dragStart = pos;
      S.spriteDragOrigin = { ...hit.sprite };
      updateSpriteProps();
      updateShapeProps();
      updateStrokeProps();
      updatePaletteItemProps();
    } else {
      // 3b. Shape body
      const shapeHit = hitTestShapes(pos.x, pos.y);
      if (shapeHit) {
        clearAllSelections();
        S.selectedShapeId = shapeHit.shape.id;
        S.shapeHandleDrag = 'shape-move';
        S.shapeHandleStart = pos;
        S.shapeDragOrigin = { ...shapeHit.shape };
        updateShapeProps();
        updateSpriteProps();
        updateStrokeProps();
        updatePaletteItemProps();
      } else {
        clearAllSelections();
        updateSpriteProps();
        updateShapeProps();
        updateStrokeProps();
        updatePaletteItemProps();
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

  // Text tool — single click places a text layer immediately (no drag-to-
  // size like Circle/Star/Polygon; Font Size drives sizing instead) and
  // drops straight into Select on the new layer, same finalize pattern as
  // every other one-shot tool.
  if (S.tool === 'text') {
    if (!m) return;
    const local = toMandalaLocal(m, pos.x, pos.y);
    historySnapshot();
    const shape = {
      id: uid(), type: 'text',
      x: local.x, y: local.y,
      text: 'Text',
      fontFamily: 'Inter',
      fontSize: 48,
      arc: null,
      color: S.color,
      thickness: S.thickness,
      opacity: S.opacity,
      fill: null,
      lineCap: 'round', lineJoin: 'round', dash: [],
      gradient: (S.gradientMode) ? JSON.parse(JSON.stringify(S.gradient)) : null,
      rotation: 0, orbit: 0,
      anim: {},
      params: {},
      axes: m.axes,
      axisRotation: m.axisRotation,
      mirror: m.mirror,
    };
    if (!m.shapes) m.shapes = [];
    shape.z = nextZ(m);
    m.shapes.push(shape);
    S.selectedShapeId = shape.id;
    updateShapeProps();
    updateLayersList();
    setTool('select');
    markRenderDirty();
    return;
  }

  // Petal tool — three clicks, no dragging: click 1 sets the tip, move and
  // click 2 sets the base (axis live-previews as the cursor moves), move
  // and click 3 sets curvature (also live-previewed) and finalizes.
  if (S.tool === 'petal') {
    if (!m) return;
    const local = toMandalaLocal(m, pos.x, pos.y);
    if (S.petalPhase === null) {
      S.petalTip = local;
      S.petalBase = local;
      S.petalPhase = 'axis';
    } else if (S.petalPhase === 'axis') {
      const axisLen = Math.hypot(S.petalBase.x - S.petalTip.x, S.petalBase.y - S.petalTip.y);
      if (axisLen < 3) {
        S.petalPhase = null; S.petalTip = null; S.petalBase = null;
      } else {
        S.petalPhase = 'curve';
        S.petalCurve = 0.35;
      }
    } else if (S.petalPhase === 'curve') {
      historySnapshot();
      const shape = {
        id: uid(), type: 'petal',
        x: S.petalTip.x, y: S.petalTip.y,
        petalDx: S.petalBase.x - S.petalTip.x,
        petalDy: S.petalBase.y - S.petalTip.y,
        petalCurve: S.petalCurve,
        r: 0,
        color: S.color,
        thickness: S.thickness,
        opacity: S.opacity,
        fill: S.shapeFill,
        lineCap: S.shapeLineCap,
        lineJoin: 'miter', // keeps the tip/base corners sharp regardless of the shared Join dropdown default
        dash: [...S.shapeDash],
        gradient: (S.gradientMode) ? JSON.parse(JSON.stringify(S.gradient)) : null,
        rotation: 0, orbit: 0,
        anim: {},
        params: {},
        axes: m.axes,
        axisRotation: m.axisRotation,
        mirror: m.mirror,
      };
      if (!m.shapes) m.shapes = [];
      shape.z = nextZ(m);
      m.shapes.push(shape);
      S.selectedShapeId = shape.id;
      updateShapeProps();
      updateLayersList();
      setTool('select');
      S.petalPhase = null; S.petalTip = null; S.petalBase = null;
    }
    return;
  }

  // Bezier tool — same three-click flow as Petal (tip, end, curvature), but
  // finalizes into an open, unfilled single curve instead of a closed loop.
  if (S.tool === 'bezier') {
    if (!m) return;
    const local = toMandalaLocal(m, pos.x, pos.y);
    if (S.bezierPhase === null) {
      S.bezierTip = local;
      S.bezierEnd = local;
      S.bezierPhase = 'axis';
    } else if (S.bezierPhase === 'axis') {
      const axisLen = Math.hypot(S.bezierEnd.x - S.bezierTip.x, S.bezierEnd.y - S.bezierTip.y);
      if (axisLen < 3) {
        S.bezierPhase = null; S.bezierTip = null; S.bezierEnd = null;
      } else {
        S.bezierPhase = 'curve';
        S.bezierCurve = 0.35;
      }
    } else if (S.bezierPhase === 'curve') {
      historySnapshot();
      const dx = S.bezierEnd.x - S.bezierTip.x, dy = S.bezierEnd.y - S.bezierTip.y;
      // Both control points start as mirror images of each other (the same
      // bulge the 3rd click just dragged out), giving a natural-looking
      // curve immediately — but each is stored explicitly and independently
      // draggable from here on, unlike Petal's single shared curvature.
      const axisLen = Math.max(1, Math.hypot(dx, dy));
      const bulge = S.bezierCurve * axisLen;
      const ux = dx / axisLen, uy = dy / axisLen;
      const px = -uy, py = ux;
      const midX = dx / 2, midY = dy / 2;
      const shape = {
        id: uid(), type: 'bezier',
        x: S.bezierTip.x, y: S.bezierTip.y,
        bezierDx: dx, bezierDy: dy,
        bezierC1x: midX + px * bulge, bezierC1y: midY + py * bulge,
        bezierC2x: midX - px * bulge, bezierC2y: midY - py * bulge,
        r: 0,
        color: S.color,
        thickness: S.thickness,
        opacity: S.opacity,
        fill: null, // always an open stroke, never filled
        lineCap: S.shapeLineCap,
        lineJoin: S.shapeLineJoin,
        dash: [...S.shapeDash],
        gradient: (S.gradientMode) ? JSON.parse(JSON.stringify(S.gradient)) : null,
        rotation: 0, orbit: 0,
        anim: {},
        params: {},
        axes: m.axes,
        axisRotation: m.axisRotation,
        mirror: m.mirror,
      };
      if (!m.shapes) m.shapes = [];
      shape.z = nextZ(m);
      m.shapes.push(shape);
      S.selectedShapeId = shape.id;
      updateShapeProps();
      updateLayersList();
      setTool('select');
      S.bezierPhase = null; S.bezierTip = null; S.bezierEnd = null;
    }
    return;
  }

  // Wing tool — identical three-click flow to Bezier, except the bottom
  // point is mirrored across an axis through the tip from the very start of
  // the drag (see onMouseMove's 'axis' phase below), so both arms are
  // visibly distinct while drawing, not just once edited later. That mirror
  // axis is captured on the first click as the direction from the tip to
  // the mandala's centre (local (0,0)), so the wing radiates naturally
  // regardless of where on the canvas it's drawn.
  if (S.tool === 'wing') {
    if (!m) return;
    const local = toMandalaLocal(m, pos.x, pos.y);
    if (S.wingPhase === null) {
      S.wingTip = local;
      S.wingEnd = local;
      const distToCentre = Math.hypot(local.x, local.y);
      S.wingMirrorAngle = distToCentre > 0.5 ? Math.atan2(-local.y, -local.x) : WING_MIRROR_ANGLE;
      S.wingPhase = 'axis';
    } else if (S.wingPhase === 'axis') {
      const axisLen = Math.hypot(S.wingEnd.x - S.wingTip.x, S.wingEnd.y - S.wingTip.y);
      if (axisLen < 3) {
        S.wingPhase = null; S.wingTip = null; S.wingEnd = null;
      } else {
        S.wingPhase = 'curve';
        S.wingCurve = 0.35;
      }
    } else if (S.wingPhase === 'curve') {
      historySnapshot();
      const dx = S.wingEnd.x - S.wingTip.x, dy = S.wingEnd.y - S.wingTip.y;
      const axisLen = Math.max(1, Math.hypot(dx, dy));
      const bulge = S.wingCurve * axisLen;
      const ux = dx / axisLen, uy = dy / axisLen;
      const px = -uy, py = ux;
      const midX = dx / 2, midY = dy / 2;
      const shape = {
        id: uid(), type: 'wing',
        x: S.wingTip.x, y: S.wingTip.y,
        bezierDx: dx, bezierDy: dy,
        bezierC1x: midX + px * bulge, bezierC1y: midY + py * bulge,
        bezierC2x: midX - px * bulge, bezierC2y: midY - py * bulge,
        wingMirrorAngle: S.wingMirrorAngle,
        r: 0,
        color: S.color,
        thickness: S.thickness,
        opacity: S.opacity,
        fill: null, // always an open pair of strokes, never filled
        lineCap: S.shapeLineCap,
        lineJoin: S.shapeLineJoin,
        dash: [...S.shapeDash],
        gradient: (S.gradientMode) ? JSON.parse(JSON.stringify(S.gradient)) : null,
        rotation: 0, orbit: 0,
        anim: {},
        params: {},
        axes: m.axes,
        axisRotation: m.axisRotation,
        mirror: m.mirror,
      };
      if (!m.shapes) m.shapes = [];
      shape.z = nextZ(m);
      m.shapes.push(shape);
      S.selectedShapeId = shape.id;
      updateShapeProps();
      updateLayersList();
      setTool('select');
      S.wingPhase = null; S.wingTip = null; S.wingEnd = null;
    }
    return;
  }

  // Line tool — click to place the start, move for a live preview, click to
  // finish and commit the straight-line stroke (same click flow as Petal/
  // Bezier's first stage, no curvature phase). Line Chain is the identical
  // two-click cycle, except finalizing appends the new endpoint to the same
  // in-progress stroke (S.lineChainStroke) instead of committing a whole
  // separate stroke, so repeated clicks extend one continuous polyline —
  // one selectable/animatable/gradientable object — until Escape or a tool
  // switch ends the chain (see setTool's cleanup and the Escape handler,
  // both of which null out S.lineChainStroke to start the next chain fresh).
  if (S.tool === 'line' || S.tool === 'lineChain') {
    if (!m) return;
    const local = toMandalaLocal(m, pos.x, pos.y);
    if (S.linePhase === null) {
      S.lineTip = local;
      S.lineEnd = local;
      S.linePhase = 'axis';
    } else if (S.linePhase === 'axis') {
      const axisLen = Math.hypot(S.lineEnd.x - S.lineTip.x, S.lineEnd.y - S.lineTip.y);
      if (axisLen < 3) {
        S.linePhase = null; S.lineTip = null; S.lineEnd = null; S.lineChainStroke = null;
      } else {
        historySnapshot();
        if (S.tool === 'lineChain' && S.lineChainStroke) {
          S.lineChainStroke.pts.push(S.lineEnd);
          if (!S.lineChainStroke.gradient) invalidateStrokeCache();
        } else {
          const newStroke = {
            id: uid(),
            pts: [S.lineTip, S.lineEnd],
            color: S.color,
            thickness: S.thickness,
            opacity: S.opacity,
            erase: false,
            axes: m.axes,
            axisRotation: m.axisRotation,
            mirror: m.mirror,
            gradient: (S.gradientMode) ? JSON.parse(JSON.stringify(S.gradient)) : null,
          };
          newStroke.z = nextZ(m);
          m.strokes.push(newStroke);
          if (!newStroke.gradient) invalidateStrokeCache();
          if (S.tool === 'lineChain') S.lineChainStroke = newStroke;
        }
        updateLayersList();
        if (S.tool === 'lineChain') {
          S.lineTip = S.lineEnd;
          S.lineEnd = S.lineTip;
          S.linePhase = 'axis';
        } else {
          S.linePhase = null; S.lineTip = null; S.lineEnd = null;
          setTool('select');
        }
      }
    }
    return;
  }

  // Brush / erase drawing
  if (!m) return;
  const local = toMandalaLocal(m, pos.x, pos.y);
  S.drawing = true;
  S.pts = [local];
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

  // Petal stage 2 — the base follows the cursor (no button held) until the
  // next click locks it in, angle-snapping the tip->base axis the same way
  // the Line tool snaps (S.snapAngle / hold Snap).
  if (S.tool === 'petal' && S.petalPhase === 'axis' && m) {
    const local = toMandalaLocal(m, pos.x, pos.y);
    let dx = local.x - S.petalTip.x, dy = local.y - S.petalTip.y;
    if (S.snapAngle) { const snap = snapAngle(dx, dy); dx = snap.dx; dy = snap.dy; }
    S.petalBase = { x: S.petalTip.x + dx, y: S.petalTip.y + dy };
    return;
  }

  // Petal stage 3 — curvature follows the cursor until the next click
  // finalizes the shape; it's the signed perpendicular distance of the
  // cursor from the tip->base axis, as a fraction of that axis's length.
  if (S.tool === 'petal' && S.petalPhase === 'curve' && m) {
    const local = toMandalaLocal(m, pos.x, pos.y);
    const axisDx = S.petalBase.x - S.petalTip.x, axisDy = S.petalBase.y - S.petalTip.y;
    const axisLen = Math.max(1, Math.hypot(axisDx, axisDy));
    const ux = axisDx / axisLen, uy = axisDy / axisLen;
    const px = -uy, py = ux;
    const relX = local.x - S.petalTip.x, relY = local.y - S.petalTip.y;
    const perpDist = relX * px + relY * py;
    S.petalCurve = Math.max(-1.2, Math.min(1.2, perpDist / axisLen));
    return;
  }

  // Bezier stage 2 — same axis tracking as Petal.
  if (S.tool === 'bezier' && S.bezierPhase === 'axis' && m) {
    const local = toMandalaLocal(m, pos.x, pos.y);
    let dx = local.x - S.bezierTip.x, dy = local.y - S.bezierTip.y;
    if (S.snapAngle) { const snap = snapAngle(dx, dy); dx = snap.dx; dy = snap.dy; }
    S.bezierEnd = { x: S.bezierTip.x + dx, y: S.bezierTip.y + dy };
    return;
  }

  // Bezier stage 3 — same curvature tracking as Petal.
  if (S.tool === 'bezier' && S.bezierPhase === 'curve' && m) {
    const local = toMandalaLocal(m, pos.x, pos.y);
    const axisDx = S.bezierEnd.x - S.bezierTip.x, axisDy = S.bezierEnd.y - S.bezierTip.y;
    const axisLen = Math.max(1, Math.hypot(axisDx, axisDy));
    const ux = axisDx / axisLen, uy = axisDy / axisLen;
    const px = -uy, py = ux;
    const relX = local.x - S.bezierTip.x, relY = local.y - S.bezierTip.y;
    const perpDist = relX * px + relY * py;
    S.bezierCurve = Math.max(-1.2, Math.min(1.2, perpDist / axisLen));
    return;
  }

  // Wing stage 2 — same axis tracking as Bezier/Petal.
  if (S.tool === 'wing' && S.wingPhase === 'axis' && m) {
    const local = toMandalaLocal(m, pos.x, pos.y);
    let dx = local.x - S.wingTip.x, dy = local.y - S.wingTip.y;
    if (S.snapAngle) { const snap = snapAngle(dx, dy); dx = snap.dx; dy = snap.dy; }
    S.wingEnd = { x: S.wingTip.x + dx, y: S.wingTip.y + dy };
    return;
  }

  // Wing stage 3 — same curvature tracking as Bezier/Petal.
  if (S.tool === 'wing' && S.wingPhase === 'curve' && m) {
    const local = toMandalaLocal(m, pos.x, pos.y);
    const axisDx = S.wingEnd.x - S.wingTip.x, axisDy = S.wingEnd.y - S.wingTip.y;
    const axisLen = Math.max(1, Math.hypot(axisDx, axisDy));
    const ux = axisDx / axisLen, uy = axisDy / axisLen;
    const px = -uy, py = ux;
    const relX = local.x - S.wingTip.x, relY = local.y - S.wingTip.y;
    const perpDist = relX * px + relY * py;
    S.wingCurve = Math.max(-1.2, Math.min(1.2, perpDist / axisLen));
    return;
  }

  // Line / Line Chain stage 2 — same axis tracking as Bezier/Petal/Wing's
  // first stage (endpoint follows the cursor, angle-snaps with Snap held);
  // there's no curvature phase, the next click finalizes directly.
  if ((S.tool === 'line' || S.tool === 'lineChain') && S.linePhase === 'axis' && m) {
    const local = toMandalaLocal(m, pos.x, pos.y);
    let dx = local.x - S.lineTip.x, dy = local.y - S.lineTip.y;
    if (S.snapAngle) { const snap = snapAngle(dx, dy); dx = snap.dx; dy = snap.dy; }
    S.lineEnd = { x: S.lineTip.x + dx, y: S.lineTip.y + dy };
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
  S.pts.push(local);
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
      shape.z = nextZ(m);
      m.shapes.push(shape);
      S.selectedShapeId = shape.id;
      updateShapeProps();
      updateLayersList();
      setTool('select');
    }
    S.shapePreview = null;
    return;
  }

  // Petal/Bezier/Wing/Line/Line Chain placement is fully click-driven
  // (handled in onMouseDown) — every stage transition happens on
  // mousedown, so mouseup has nothing to do.
  if (S.tool === 'petal' || S.tool === 'bezier' || S.tool === 'wing' || S.tool === 'line' || S.tool === 'lineChain') return;

  if (!S.drawing) return;
  S.drawing = false;

  const m = getActiveMandala();
  if (!m || S.pts.length < 2) { S.pts = []; return; }

  historySnapshot();

  const pts = S.tool === 'brush' ? smoothPoints(S.pts, S.smooth) : S.pts;

  const newStroke = {
    id: uid(),
    pts: pts,
    color: S.color,
    thickness: S.thickness,
    opacity: S.opacity,
    erase: false,
    axes: m.axes,
    axisRotation: m.axisRotation,
    mirror: m.mirror,
    gradient: S.gradientMode ? JSON.parse(JSON.stringify(S.gradient)) : null,
  };
  newStroke.z = nextZ(m);
  m.strokes.push(newStroke);
  if (!newStroke.gradient) invalidateStrokeCache(); // gradient strokes render live, no cache needed
  updateLayersList();

  S.pts = [];
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
    z: nextZ(m),
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
  updateColorContrastWarning();
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
    base = item.erase ? 'erase' : item.gradient ? 'grad-stroke' : 'stroke';
  } else {
    // shape
    base = item.type || 'shape';
  }
  item._layerName = base + '-' + _nextSeq(base);
  return item._layerName;
}

const _SHAPE_ICON = { circle: '○', star: '★', polygon: '⬡', text: 'T' };
const _SPRITE_ICON = '⊞';
const _STROKE_ICON = '✏';

// Which canvas item is being hovered in the layers panel (for highlight ring).
let _layersHoverItem = null;

// True if this layer has any active animation — keyframes on any property,
// an animated gradient, a fading trail, or (strokes only) orbit — so the
// Layers list can flag it without the user having to open the Inspector.
function layerHasAnimation(type, item) {
  if (item.gradient?.speed > 0) return true;
  if (item.trailAnim?.enabled) return true;
  if (type === 'stroke') {
    return !!item.anim?.orbit?.enabled;
  }
  return !!(item.anim && Object.values(item.anim).some(ap => ap.enabled));
}

// Moves the current selection to the layer immediately above/below it in
// the Layers panel's displayed (topmost-first) order — same real z order
// updateLayersList shows, just walked in display order instead of z order.
// dir: -1 = up (towards the top of the panel), +1 = down.
function selectAdjacentLayer(dir) {
  const m = getActiveMandala();
  if (!m) return;
  const entries = getOrderedEntries(m);
  if (!entries.length) return;
  const displayOrder = entries.slice().reverse(); // topmost-first, matches updateLayersList's render order
  const currentId = S.selectedSpriteId || S.selectedShapeId || S.selectedStrokeId;
  if (!currentId) return;
  const idx = displayOrder.findIndex(e => e.item.id === currentId);
  if (idx === -1) return;
  const next = displayOrder[idx + dir];
  if (!next) return;
  S.selectedSpriteId = next.type === 'sprite' ? next.item.id : null;
  S.selectedShapeId  = next.type === 'shape'  ? next.item.id : null;
  S.selectedStrokeId = next.type === 'stroke' ? next.item.id : null;
  updateSpriteProps();
  updateShapeProps();
  updateStrokeProps();
  markRenderDirty();
}

function updateLayersList() {
  const list = document.getElementById('layers-list');
  if (!list) return;
  list.innerHTML = '';

  const m = getActiveMandala();
  if (!m) return;

  // Flat list in real z order (bottom to top) — see getOrderedEntries.
  const entries = getOrderedEntries(m);

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

    const isActive = type === 'sprite'  ? item.id === S.selectedSpriteId
                    : type === 'shape'  ? item.id === S.selectedShapeId
                    : type === 'stroke' ? item.id === S.selectedStrokeId
                    : false;

    const isVisible = item.visible !== false;

    const row = document.createElement('div');
    row.className = 'layer-item' + (isActive ? ' active' : '') + (isVisible ? '' : ' layer-hidden');
    row.dataset.id = item.id;
    row.dataset.type = type;
    row.title = name;

    const tagLabel = type === 'shape' ? item.type : type === 'stroke' ? (item.erase ? 'erase' : 'stroke') : 'gif/img';
    const deleteTitle = type === 'stroke' ? (item.erase ? 'Delete this erase mark' : 'Delete this drawing') : type === 'shape' ? 'Delete this shape' : 'Delete this sprite';
    const animated = layerHasAnimation(type, item);

    row.innerHTML =
      `<span class="layer-icon">${icon}</span>` +
      `<span class="layer-name">${name}</span>` +
      (animated ? `<span class="layer-anim-badge" title="This layer is animated">∿</span>` : '') +
      `<span class="layer-type-tag">${tagLabel}</span>` +
      `<button class="layer-delete" title="${deleteTitle}">🗑</button>` +
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

    // Delete button — confirm before permanently removing the layer. Works
    // for all three layer types now (strokes, shapes, sprites).
    row.querySelector('.layer-delete').addEventListener('click', e => {
      e.stopPropagation();
      if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
      historySnapshot();
      if (type === 'stroke') {
        const idx = m.strokes.findIndex(s => s.id === item.id);
        if (idx !== -1) m.strokes.splice(idx, 1);
        if (S.selectedStrokeId === item.id) S.selectedStrokeId = null;
      } else if (type === 'shape') {
        m.shapes = (m.shapes || []).filter(s => s.id !== item.id);
        if (S.selectedShapeId === item.id) S.selectedShapeId = null;
      } else {
        m.sprites = m.sprites.filter(s => s.id !== item.id);
        if (S.selectedSpriteId === item.id) S.selectedSpriteId = null;
      }
      if (_layersHoverItem?.id === item.id) _layersHoverItem = null;
      invalidateStrokeCache();
      flushHasAnimCache();
      markRenderDirty();
      updateStrokeProps();
      updateShapeProps();
      updateSpriteProps();
    });

    // Selecting a layer shows exactly that item's properties in the Inspector
    // below — clears any other selection first so only one panel is ever open.
    row.addEventListener('click', () => {
      clearAllSelections();
      if (type === 'sprite') S.selectedSpriteId = item.id;
      else if (type === 'shape') S.selectedShapeId = item.id;
      else S.selectedStrokeId = item.id;

      if (type !== 'stroke') setTool('select');
      updateSpriteProps();
      updateShapeProps();
      updateStrokeProps();
      updatePaletteItemProps();
      updateLayersList();
      markRenderDirty();
    });

    list.appendChild(row);
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
    const rot  = strokeEffectiveRot(stroke, m, S.animClock);
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
    const { x: ox, y: oy } = shapeRadialTangentialOffset(shape, clk);
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
  updateClearSelectionButtonVisibility();
  const found = S.selectedSpriteId ? findSprite(S.selectedSpriteId) : null;
  const panel = document.getElementById('sprite-props');
  if (!found) { panel.style.display = 'none'; updateInspectorEmptyState(); updateLayersList(); return; }
  panel.style.display = 'flex';
  updateSpritePropsValues(found.sprite);
  updateInspectorEmptyState();
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
  // The Image Inspector accordion lives inside this list, moved to sit
  // right after whichever item is selected — detach it first so it
  // survives the innerHTML wipe below instead of being destroyed with it.
  const propsPanel = document.getElementById('palette-item-props');
  propsPanel.remove();
  list.innerHTML = '';
  let propsPlaced = false;
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

    if (item.id === S.selectedPaletteId) {
      list.appendChild(propsPanel);
      propsPlaced = true;
    }
  });
  // Nothing selected (or the selected item vanished) — park the panel at
  // the end of the list, hidden, so it stays in the document for later.
  if (!propsPlaced) list.appendChild(propsPanel);
}

function selectPaletteItem(id) {
  // Clicking the already-open image closes its accordion instead of
  // re-opening it — same toggle behaviour as an accordion header.
  const wasSelected = S.selectedPaletteId === id;
  S.selectedSpriteId = null;
  S.selectedShapeId = null;
  S.selectedStrokeId = null;
  S.selectedPaletteId = wasSelected ? null : id;
  renderPaletteList();
  updateSpriteProps();
  updateShapeProps();
  updateStrokeProps();
  updatePaletteItemProps();
  if (!wasSelected) setTool('place');
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
  // Keep each row's highlight in sync even when this is called from a
  // selection made elsewhere (canvas, Layers) without a full list re-render.
  document.querySelectorAll('#palette-list .palette-item.selected').forEach(el => {
    if (!item || el.dataset.id !== item.id) el.classList.remove('selected');
  });
  if (!item) { panel.style.display = 'none'; updateInspectorEmptyState(); return; }
  const row = document.querySelector(`#palette-list .palette-item[data-id="${item.id}"]`);
  if (row) row.classList.add('selected');
  panel.style.display = 'block';
  updateInspectorEmptyState();
  document.getElementById('prop-sprite-sheet').checked = item.isSpriteSheet;
  document.getElementById('sprite-sheet-options').style.display = item.isSpriteSheet ? 'block' : 'none';
  document.getElementById('ss-cols').value = item.cols;
  document.getElementById('ss-rows').value = item.rows;
  document.getElementById('trans-tolerance').value = item.tolerance || 15;
  document.getElementById('trans-tolerance-val').textContent = item.tolerance || 15;
  if (item.isSpriteSheet) renderSpriteSheetGrid(item);

  const isAnimated = (item.isGif || item.isWebP) && item.gifFrames && item.gifFrames.length > 1;
  document.getElementById('trim-frames-row').style.display = isAnimated ? 'block' : 'none';
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
    tool === 'eyedropper' ? 'crosshair'  :
    tool === 'select'     ? 'default'    :
    tool === 'place'      ? 'copy'       : 'crosshair';
  if (tool !== 'select') {
    S.selectedSpriteId = null;
    S.selectedShapeId = null;
    updateSpriteProps();
    updateShapeProps();
  }
  if (tool !== 'petal') {
    // Abandon an in-progress petal (mid tip->base or mid curvature drag) if
    // the user switches tools before finishing it, so it doesn't get stuck.
    S.petalPhase = null;
    S.petalTip = null;
    S.petalBase = null;
  }
  if (tool !== 'bezier') {
    S.bezierPhase = null;
    S.bezierTip = null;
    S.bezierEnd = null;
  }
  if (tool !== 'wing') {
    S.wingPhase = null;
    S.wingTip = null;
    S.wingEnd = null;
  }
  if (tool !== 'line' && tool !== 'lineChain') {
    // Abandon an in-progress line (or chain) if the user switches tools
    // before finishing the current segment.
    S.linePhase = null;
    S.lineTip = null;
    S.lineEnd = null;
    S.lineChainStroke = null;
  }
  updateShapePanel();
  updateGradientPanelVisibility();
  updateStatusBarVisibility();
}

// Tools that actually draw a stroke/shape with the current colour or
// gradient — the only ones the gradient panel is relevant for. Every other
// tool (erase, select, place/stamp, eyedropper) hides it automatically.
const GRADIENT_PANEL_TOOLS = new Set(['brush', 'line', 'lineChain', 'circle', 'star', 'polygon', 'text']);

function updateGradientPanelVisibility() {
  const panel = document.getElementById('gradient-panel');
  if (!panel) return;
  const show = S.gradientMode && GRADIENT_PANEL_TOOLS.has(S.tool);
  panel.classList.toggle('visible', show);
  if (show) {
    const sel = document.getElementById('grad-preset');
    if (sel) sel.value = findMatchingPresetName(S.gradient.stops);
    toolbarGradientEditor?.render();
  }
}

// Same idea for the status-bar's own Color/Gradient/Size/Opacity/Smooth
// controls — each carries the set of tools it's actually relevant to via
// its data-tools attribute, so unrelated tools (Select, Place, Eyedropper)
// don't show controls that do nothing for them.
function updateStatusBarVisibility() {
  document.querySelectorAll('#status-bar .status-group[data-tools]').forEach(el => {
    const tools = el.dataset.tools.split(',');
    el.classList.toggle('tool-hidden', !tools.includes(S.tool));
  });
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

// ── Trim Frames dialog ──────────────────────────────────────
// Same modal-overlay/modal-dialog pattern as Crop and Transparency, with a
// live-playing preview so trimming a GIF/WebP's loop range is a "see it,
// then commit it" interaction instead of blind slider numbers.
function openTrimFramesDialog() {
  const item = getPaletteItem(S.selectedPaletteId);
  if (!item || !item.gifFrames || item.gifFrames.length < 2) return;

  const maxIdx = item.gifFrames.length - 1;
  let start = Math.min(Math.max(item.trimStart ?? 0, 0), maxIdx);
  let end = Math.min(Math.max(item.trimEnd ?? maxIdx, start), maxIdx);

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal-dialog" style="min-width:340px">
      <h3>Trim Frames</h3>
      <p style="font-size:11px;color:var(--text-dim);margin:2px 0 8px">Loop just a portion of this animation's ${item.gifFrames.length} decoded frames.</p>
      <canvas id="trim-canvas-preview" style="display:block;border:1px solid var(--border);margin:0 auto"></canvas>
      <div id="trim-info" style="font-size:10px;color:var(--text-dim);text-align:center;margin-top:4px">Frame 0 / ${maxIdx}</div>
      <div class="prop-row" style="margin-top:8px">
        <label class="prop-label">Start Frame</label>
        <input type="range" id="trim-start" min="0" max="${maxIdx}" step="1" value="${start}">
        <span class="prop-val" id="trim-start-val">${start}</span>
      </div>
      <div class="prop-row">
        <label class="prop-label">End Frame</label>
        <input type="range" id="trim-end" min="0" max="${maxIdx}" step="1" value="${end}">
        <span class="prop-val" id="trim-end-val">${end}</span>
      </div>
      <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px">
        <button class="btn" id="trim-reset">Reset (full range)</button>
        <button class="btn" id="trim-cancel">Cancel</button>
        <button class="btn" id="trim-apply" style="background:var(--accent)">Apply</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  const pc = document.getElementById('trim-canvas-preview');
  const iw = item.gifFrames[0].canvas.width, ih = item.gifFrames[0].canvas.height;
  const MAX_W = 300, MAX_H = 260;
  const scale = Math.min(MAX_W / iw, MAX_H / ih, 1);
  pc.width = Math.round(iw * scale);
  pc.height = Math.round(ih * scale);
  const pctx = pc.getContext('2d');

  const startInput = document.getElementById('trim-start');
  const endInput = document.getElementById('trim-end');
  const startVal = document.getElementById('trim-start-val');
  const endVal = document.getElementById('trim-end-val');
  const info = document.getElementById('trim-info');

  let previewIdx = start;
  let lastTick = performance.now();
  let rafId = null;

  function drawFrame() {
    pctx.clearRect(0, 0, pc.width, pc.height);
    for (let y = 0; y < pc.height; y += 8) for (let x = 0; x < pc.width; x += 8)
      { pctx.fillStyle = ((x/8+y/8)%2===0) ? '#333' : '#3d3d3d'; pctx.fillRect(x, y, 8, 8); }
    pctx.drawImage(item.gifFrames[previewIdx].canvas, 0, 0, pc.width, pc.height);
    info.textContent = `Frame ${previewIdx} / ${maxIdx}  (playing ${start}-${end})`;
  }

  function tick(now) {
    rafId = requestAnimationFrame(tick);
    if (previewIdx < start || previewIdx > end) previewIdx = start;
    const delay = item.gifFrames[previewIdx].delay;
    if (now - lastTick >= delay) {
      lastTick = now;
      previewIdx = previewIdx + 1 > end ? start : previewIdx + 1;
    }
    drawFrame();
  }
  rafId = requestAnimationFrame(tick);

  function cleanup() {
    if (rafId) cancelAnimationFrame(rafId);
    overlay.remove();
  }

  startInput.addEventListener('input', e => {
    let v = parseInt(e.target.value);
    if (v > end) { end = v; endInput.value = v; endVal.textContent = v; }
    start = v;
    startVal.textContent = v;
    previewIdx = start;
  });
  endInput.addEventListener('input', e => {
    let v = parseInt(e.target.value);
    if (v < start) { start = v; startInput.value = v; startVal.textContent = v; }
    end = v;
    endVal.textContent = v;
  });

  document.getElementById('trim-reset').addEventListener('click', () => {
    start = 0; end = maxIdx;
    startInput.value = 0; endInput.value = maxIdx;
    startVal.textContent = 0; endVal.textContent = maxIdx;
    previewIdx = start;
  });
  document.getElementById('trim-cancel').addEventListener('click', cleanup);
  document.getElementById('trim-apply').addEventListener('click', () => {
    item.trimStart = start;
    item.trimEnd = end;
    item.gifFrameIdx = start;
    invalidateAnimCache(item);
    markRenderDirty();
    renderPaletteList();
    updatePaletteItemProps();
    cleanup();
  });
}

// ── Frame splitting ───────────────────────────────────────

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
    effects: S.effects, // EFFECT-MODULE: persistence
    palette: S.palette.map(p => ({
      id: p.id, name: p.name, dataUrl: p.dataUrl, isGif: p.isGif, isWebP: p.isWebP,
      transparentColor: p.transparentColor, tolerance: p.tolerance,
      cropRect: p.cropRect || null,
      isSpriteSheet: p.isSpriteSheet, cols: p.cols, rows: p.rows, selectedCell: p.selectedCell,
      trimStart: p.trimStart, trimEnd: p.trimEnd,
    })),
    customFonts: S.customFonts.map(cf => ({ id: cf.id, name: cf.name, family: cf.family, dataUrl: cf.dataUrl })),
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
    updateColorContrastWarning();
    S.canvasW = data.canvasW || 1200;
    S.canvasH = data.canvasH || 900;
    resizeCanvas(S.canvasW, S.canvasH);
    S.mandalas = data.mandalas || [];
    // Projects saved before the z-order field existed (or demo files) need
    // one backfilled so strokes/shapes/sprites keep their original visual
    // stacking instead of all colliding at z=undefined.
    for (const m of S.mandalas) backfillLayerZ(m);
    S.effects = data.effects || []; // EFFECT-MODULE: persistence
    S.effects.forEach(e => {
      if (e._expanded == null) e._expanded = false;
      // Backfill any control added to this effect type after the project was
      // saved (e.g. Echo's Separation) — otherwise a missing field reads as
      // undefined and crashes the control row's format() (a bare
      // `.toFixed()` on undefined) the moment the panel tries to draw it.
      const def = EFFECT_TYPES[e.type];
      if (def) {
        const defaults = def.defaults();
        for (const k in defaults) if (e[k] === undefined) e[k] = defaults[k];
      }
    });
    flushHasAnimCache();
    updateEffectsList();
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

    // Custom fonts: a FontFace registration is in-memory only and doesn't
    // survive a reload, so every load re-registers each one from its saved
    // base64 and rebuilds its menu row — first clearing out any rows left
    // over from whatever project was open before (matched by the
    // 'CustomFont_' family prefix addCustomFont gives every upload, so the
    // built-in rows are never touched).
    S.customFonts = [];
    document.querySelectorAll("#sp-text-font-menu .font-menu-item[data-value^=\"'CustomFont_\"]").forEach(el => el.remove());
    const customFontSep = document.getElementById('font-menu-custom-sep');
    if (customFontSep) customFontSep.style.display = 'none';
    const fontLoads = (data.customFonts || []).map(async cf => {
      const ok = await registerCustomFont(cf);
      if (ok) {
        S.customFonts.push(cf);
        addCustomFontMenuItem(cf);
      }
    });

    Promise.all([...loads, ...fontLoads]).then(() => {
      renderPaletteList();
      updateMandalaList();
      updateAxesDisplay();
      updateSpriteProps();
    });
  } catch (err) {
    alert('Failed to load project: ' + err.message);
  }
}

// Fetches examples/<file>.json relative to the current page and loads it
// through the exact same loadProject() a real Save/Load file goes through
// — a demo is just a regular saved project. The relative path (no origin)
// is what makes this work unmodified whether served locally or deployed.
// Loads examples/<file>.js — a plain <script>, not a fetch()/XHR request,
// specifically so this works when the app is opened directly via a
// file:// URL and not just when served over http(s). Browsers block
// fetch()/XHR reads of local files as a CORS security measure, but a
// <script src="local/path.js"> load is exempt from that (same mechanism
// index.html already relies on to load app.js/style.css locally) — so each
// demo is stored as a .js file that just registers its data into
// window.MANDALIZE_DEMOS instead of raw .json fetched at runtime.
function loadDemo(file) {
  const existing = document.querySelector(`script[data-demo="${file}"]`);
  if (existing) existing.remove(); // re-fetch fresh instead of relying on a stale cached run
  const script = document.createElement('script');
  script.src = `examples/${file}.js`;
  script.dataset.demo = file;
  script.onload = () => {
    const data = window.MANDALIZE_DEMOS?.[file];
    if (!data) { alert('Failed to load demo: no data registered for "' + file + '"'); return; }
    loadProject(JSON.stringify(data));
  };
  script.onerror = () => alert(`Failed to load demo: could not load examples/${file}.js`);
  document.head.appendChild(script);
}

function exportPNG() {
  // Render once without guides
  const wasGuides = S.showGuides;
  const wasSel = S.selectedSpriteId;
  S.showGuides = false;
  S.selectedSpriteId = null;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawMandalasWithOptionalSpriteSplit(ctx, canvas, true);
  // Fill background colour in behind everything, same destination-over
  // trick as the live render() loop — see rebuildStrokeCache's comment.
  ctx.save();
  ctx.globalCompositeOperation = 'destination-over';
  ctx.fillStyle = S.bgColor;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.restore();
  applyEffectsChain(ctx, canvas); // EFFECT-MODULE: export-hook

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

  resetAllEffectsRuntimeState(); // EFFECT-MODULE: export-hook — start every export from a clean trail
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
      drawMandalasWithOptionalSpriteSplit(ctx, canvas, true);
      // Fill background colour in behind everything, same destination-over
      // trick as the live render() loop — see rebuildStrokeCache's comment.
      ctx.save();
      ctx.globalCompositeOperation = 'destination-over';
      ctx.fillStyle = S.bgColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.restore();
      applyEffectsChain(ctx, canvas); // EFFECT-MODULE: export-hook

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

  resetAllEffectsRuntimeState(); // EFFECT-MODULE: export-hook — start every export from a clean trail
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
      drawMandalasWithOptionalSpriteSplit(ctx, canvas, true);
      // Fill background colour in behind everything, same destination-over
      // trick as the live render() loop — see rebuildStrokeCache's comment.
      ctx.save();
      ctx.globalCompositeOperation = 'destination-over';
      ctx.fillStyle = S.bgColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.restore();
      applyEffectsChain(ctx, canvas); // EFFECT-MODULE: export-hook

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

// ── Video export ──────────────────────────────────────────

const VIDEO_PRESETS = {
  'custom':       { label: 'Custom',                       w: null, h: null, hint: 'Uses the current canvas size' },
  'ig-post':      { label: 'Instagram Post (1:1)',          w: 1080, h: 1080, hint: 'Feed post — square crops best in-app' },
  'reel':         { label: 'Reels / Story / Shorts / TikTok', w: 1080, h: 1920, hint: 'Vertical 9:16 — ideal length 15–30s' },
  'yt-landscape': { label: 'YouTube / Facebook (16:9)',     w: 1920, h: 1080, hint: 'Landscape — widely compatible, up to 60fps' },
  'twitter':      { label: 'Twitter / X (16:9)',            w: 1200, h: 675,  hint: 'Keep under ~2:20 for best delivery' },
  'pin':          { label: 'Pinterest Pin (2:3)',           w: 1000, h: 1500, hint: 'Tall pin format' },
};

// Picks the best-supported container/codec MediaRecorder offers on this browser.
// mp4/H.264 is preferred since it's the format every major platform wants natively;
// falls back to WebM (VP9, then VP8) where mp4 recording isn't supported.
function pickVideoMimeType() {
  const candidates = [
    'video/mp4;codecs=avc1.42E01E',
    'video/mp4',
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm',
  ];
  for (const c of candidates) {
    if (window.MediaRecorder?.isTypeSupported?.(c)) return c;
  }
  return null;
}

function showVideoModal() {
  if (!window.MediaRecorder) {
    alert('Video export needs the MediaRecorder API, which this browser doesn\'t support.');
    return;
  }
  const el = id => document.getElementById(id);
  const rec = gifRecommendations();

  // Recommend a standard video frame rate near the animation's natural rate.
  const fps = rec.fps >= 45 ? 60 : rec.fps >= 24 ? 30 : 24;
  el('video-fps').value = String(fps);

  const duration = rec.hasAnim ? Math.min(120, Math.max(1, Math.round(rec.cyclSec * 2) / 2)) : 4;
  el('video-duration').value = duration;
  el('video-duration-hint').textContent = rec.hasAnim
    ? `Recommended: ${duration}s ≈ ${(duration / rec.cyclSec).toFixed(1)}× loop of this animation`
    : 'No animation detected — exports a static-looking clip of this length';

  el('video-preset').value = 'custom';
  applyVideoPreset('custom');

  const mime = pickVideoMimeType();
  el('video-format-hint').textContent = mime
    ? `Will export as ${mime.startsWith('video/mp4') ? 'MP4 (H.264)' : 'WebM'} — best format available in this browser`
    : 'No supported video format found in this browser';
  el('video-export-btn').disabled = !mime;

  el('video-progress-wrap').style.display = 'none';
  el('video-progress-bar').style.width = '0%';
  el('video-cancel-btn').disabled = false;
  el('video-modal').style.display = 'flex';
}

function applyVideoPreset(key) {
  const el = id => document.getElementById(id);
  const p = VIDEO_PRESETS[key] || VIDEO_PRESETS.custom;
  const w = p.w ?? S.canvasW;
  const h = p.h ?? S.canvasH;
  el('video-width').value = w;
  el('video-height-label').textContent = h;
  el('video-width').dataset.aspect = (w / h).toFixed(6);
  el('video-preset-hint').textContent = p.hint;
}

async function doExportVideo() {
  const el = id => document.getElementById(id);
  const mimeType = pickVideoMimeType();
  if (!mimeType) { alert('No supported video format found in this browser.'); return; }

  const expW      = Math.max(50, Math.min(4096, parseInt(el('video-width').value) || S.canvasW));
  const aspect    = parseFloat(el('video-width').dataset.aspect) || (S.canvasW / S.canvasH);
  const expH      = Math.max(50, Math.min(4096, Math.round(expW / aspect)));
  const fps       = parseInt(el('video-fps').value) || 30;
  const duration  = Math.max(0.5, Math.min(120, parseFloat(el('video-duration').value) || 4));
  const bitsPerPx = parseFloat(el('video-quality').value) || 0.08;
  const totalFrames = Math.max(1, Math.round(duration * fps));
  const videoBitsPerSecond = Math.round(Math.min(25_000_000, Math.max(1_000_000, expW * expH * fps * bitsPerPx)));

  el('video-progress-wrap').style.display = 'block';
  el('video-export-btn').disabled = true;
  el('video-cancel-btn').disabled = true;

  cancelAnimationFrame(S.rafId); S.rafId = null;
  const wasGuides = S.showGuides, wasSel = S.selectedSpriteId, wasClk = S.animClock;
  S.showGuides = false; S.selectedSpriteId = null;
  const gifSnap = S.palette.map(p => ({ idx: p.gifFrameIdx, cache: p.processedCache, animCanvas: p._animCanvas, animFrameIdx: p._animFrameIdx }));

  const offC = document.createElement('canvas');
  offC.width = expW; offC.height = expH;
  const offCtx = offC.getContext('2d');

  // Letterbox/pillarbox the native canvas into the export frame, preserving aspect
  // ratio with no stretching — filled with the current background color.
  const scale = Math.min(expW / S.canvasW, expH / S.canvasH);
  const drawW = S.canvasW * scale, drawH = S.canvasH * scale;
  const drawX = (expW - drawW) / 2, drawY = (expH - drawH) / 2;

  const stream = offC.captureStream(0); // manual mode — frames only advance via requestFrame()
  const track  = stream.getVideoTracks()[0];
  const chunks = [];
  const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond });
  recorder.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };

  const stopped = new Promise(res => { recorder.onstop = res; });
  recorder.start();

  let cancelled = false;
  const cancelHandler = () => { cancelled = true; };
  el('video-cancel-btn').addEventListener('click', cancelHandler, { once: true });

  resetAllEffectsRuntimeState(); // EFFECT-MODULE: export-hook — start every export from a clean trail
  try {
    for (let i = 0; i < totalFrames && !cancelled; i++) {
      const tSec = i / fps;
      S.animClock = tSec;

      const nowTs = performance.now();
      for (const item of S.palette) {
        if ((item.isGif || item.isWebP) && item.gifFrames?.length) {
          const newIdx = gifFrameAtTime(item, tSec);
          if (newIdx !== item.gifFrameIdx) {
            item.gifFrameIdx = newIdx;
            item._animCanvas = null;
            item._animFrameIdx = -1;
            item.processedCache = null;
          }
          item.gifFrameTime = nowTs;
        }
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      drawMandalasWithOptionalSpriteSplit(ctx, canvas, true);
      // Fill background colour in behind everything, same destination-over
      // trick as the live render() loop — see rebuildStrokeCache's comment.
      ctx.save();
      ctx.globalCompositeOperation = 'destination-over';
      ctx.fillStyle = S.bgColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.restore();
      applyEffectsChain(ctx, canvas); // EFFECT-MODULE: export-hook

      offCtx.fillStyle = S.bgColor;
      offCtx.fillRect(0, 0, expW, expH);
      offCtx.drawImage(canvas, drawX, drawY, drawW, drawH);
      track.requestFrame();

      const pct = Math.round((i + 1) / totalFrames * 100);
      el('video-progress-bar').style.width = pct + '%';
      el('video-progress-label').textContent = cancelled ? 'Cancelling…' : `Recording frame ${i + 1} / ${totalFrames}…`;
      // Pace requests near real time so MediaRecorder's wall-clock frame
      // timestamps land close to the target fps.
      await new Promise(r => setTimeout(r, 1000 / fps));
    }

    recorder.stop();
    await stopped;

    if (!cancelled) {
      const blob = new Blob(chunks, { type: mimeType });
      const ext = mimeType.startsWith('video/mp4') ? 'mp4' : 'webm';
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `mandala.${ext}`;
      a.click();
      el('video-modal').style.display = 'none';
    }
  } catch (err) {
    alert('Video export failed: ' + err.message);
  } finally {
    el('video-cancel-btn').removeEventListener('click', cancelHandler);
    S.showGuides = wasGuides; S.selectedSpriteId = wasSel; S.animClock = wasClk;
    S.palette.forEach((p, i) => {
      p.gifFrameIdx    = gifSnap[i].idx;
      p.processedCache = gifSnap[i].cache;
      p._animCanvas    = gifSnap[i].animCanvas;
      p._animFrameIdx  = gifSnap[i].animFrameIdx;
    });
    el('video-export-btn').disabled = false;
    el('video-cancel-btn').disabled = false;
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
let _theaterPrevGuides = true;

function enterTheaterMode() {
  _theaterPrevGuides = S.showGuides;
  S.showGuides = false;
  S.selectedSpriteId = null;
  S.selectedShapeId = null;
  document.body.classList.add('theater-mode');
  fitCanvas();
}

function exitTheaterMode() {
  document.body.classList.remove('theater-mode');
  S.showGuides = _theaterPrevGuides;
  fitCanvas();
}

function isTheaterMode() {
  return document.body.classList.contains('theater-mode');
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

  // Touch support (single-finger drawing/selection) — mirrors the mouse
  // handlers above. canvasPos() already reads e.touches[0] when present, so
  // these route straight into the same onMouseDown/onMouseMove/onMouseUp
  // logic. preventDefault stops the page from scrolling/pinch-zooming while
  // a single-finger gesture is drawing on the canvas.
  //
  // Two fingers instead drive the viewport: pinch to zoom and drag to pan,
  // simultaneously (the standard mobile-map gesture) — there's no native
  // equivalent here since #overlay-canvas sets touch-action:none (needed so
  // the browser doesn't also try to scroll/zoom the page while a single
  // finger draws), so this replaces what the browser would otherwise do.
  overlayCanvas.addEventListener('touchstart', e => {
    if (e.touches.length === 2) {
      e.preventDefault();
      onMouseUp(e); // cleanly finalize whatever single-finger gesture (if any) was in progress
      const [t0, t1] = e.touches;
      S.touchPan = {
        startDist: Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY),
        startMidX: (t0.clientX + t1.clientX) / 2,
        startMidY: (t0.clientY + t1.clientY) / 2,
        startZoom: S.viewport.zoom,
        startPanX: S.viewport.panX,
        startPanY: S.viewport.panY,
      };
      return;
    }
    if (e.touches.length !== 1) return; // 3+ fingers — ignore
    e.preventDefault();
    onMouseDown(e);
  }, { passive: false });
  overlayCanvas.addEventListener('touchmove', e => {
    if (e.touches.length === 2 && S.touchPan) {
      e.preventDefault();
      const [t0, t1] = e.touches;
      const dist = Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY);
      const midX = (t0.clientX + t1.clientX) / 2, midY = (t0.clientY + t1.clientY) / 2;
      const tp = S.touchPan;
      const newZoom = Math.max(0.05, Math.min(16, tp.startZoom * (dist / tp.startDist)));
      const cc = document.getElementById('canvas-container');
      const rect = cc.getBoundingClientRect();
      // The point under the gesture's starting midpoint, in unscaled canvas
      // content coordinates — kept anchored under the (now-moved) midpoint
      // as zoom changes, so pinch and pan compose into one smooth gesture.
      const anchorX = tp.startMidX - rect.left, anchorY = tp.startMidY - rect.top;
      const contentX = (anchorX - tp.startPanX) / tp.startZoom;
      const contentY = (anchorY - tp.startPanY) / tp.startZoom;
      S.viewport.zoom = newZoom;
      S.viewport.panX = anchorX + (midX - tp.startMidX) - contentX * newZoom;
      S.viewport.panY = anchorY + (midY - tp.startMidY) - contentY * newZoom;
      applyViewport();
      return;
    }
    if (!S.dragHandle && !S.drawing) return;
    e.preventDefault();
    onMouseMove(e);
  }, { passive: false });
  overlayCanvas.addEventListener('touchend', e => {
    if (S.touchPan) { S.touchPan = null; return; } // pinch/pan gesture ending — don't fall through to draw-finalize
    onMouseUp(e);
  });
  overlayCanvas.addEventListener('touchcancel', e => { S.touchPan = null; onMouseUp(e); });
  window.addEventListener('touchmove', e => {
    if (S.dragHandle || S.drawing) { e.preventDefault(); onMouseMove(e); }
  }, { passive: false });
  window.addEventListener('touchend', e => {
    if (S.dragHandle || S.drawing) onMouseUp(e);
  });

  // Toolbar
  document.getElementById('btn-save').addEventListener('click', saveProject);
  document.getElementById('btn-theater').addEventListener('click', enterTheaterMode);
  document.getElementById('btn-help').addEventListener('click', toggleHelp);
  document.getElementById('btn-help-close').addEventListener('click', closeHelp);
  document.getElementById('help-overlay').addEventListener('click', e => { if (e.target === e.currentTarget) closeHelp(); });
  // Export dropdown menu
  const exportMenu = document.getElementById('export-menu');
  document.getElementById('btn-export-menu').addEventListener('click', e => {
    e.stopPropagation();
    exportMenu.style.display = exportMenu.style.display === 'none' ? 'block' : 'none';
  });
  document.addEventListener('click', e => {
    if (exportMenu.style.display !== 'none' && !e.target.closest('#export-dropdown')) {
      exportMenu.style.display = 'none';
    }
  });
  document.getElementById('btn-export').addEventListener('click', () => { exportMenu.style.display = 'none'; exportPNG(); });
  document.getElementById('btn-export-gif').addEventListener('click', () => { exportMenu.style.display = 'none'; showGifModal('gif'); });
  document.getElementById('btn-export-webp').addEventListener('click', () => { exportMenu.style.display = 'none'; showGifModal('webp'); });
  document.getElementById('btn-export-video').addEventListener('click', () => { exportMenu.style.display = 'none'; showVideoModal(); });

  // Load Demo dropdown — menu items built entirely from DEMO_EXAMPLES (see
  // its declaration near the top of the file), so adding/removing a demo
  // never touches this wiring or the HTML.
  const demoMenu = document.getElementById('demo-menu');
  demoMenu.innerHTML = DEMO_EXAMPLES.map(({ file, label }) =>
    `<button class="export-menu-item" data-demo-file="${file}"><span class="export-menu-title">${label}</span></button>`
  ).join('');
  document.getElementById('btn-load-demo-menu').addEventListener('click', e => {
    e.stopPropagation();
    demoMenu.style.display = demoMenu.style.display === 'none' ? 'block' : 'none';
  });
  demoMenu.addEventListener('click', e => {
    const item = e.target.closest('[data-demo-file]');
    if (!item) return;
    demoMenu.style.display = 'none';
    loadDemo(item.dataset.demoFile);
  });
  document.addEventListener('click', e => {
    if (demoMenu.style.display !== 'none' && !e.target.closest('#demo-dropdown')) {
      demoMenu.style.display = 'none';
    }
  });

  // Video export modal
  document.getElementById('video-cancel-btn').addEventListener('click', () => {
    document.getElementById('video-modal').style.display = 'none';
  });
  document.getElementById('video-export-btn').addEventListener('click', doExportVideo);
  document.getElementById('video-preset').addEventListener('change', e => applyVideoPreset(e.target.value));
  document.getElementById('video-width').addEventListener('input', e => {
    const w = parseInt(e.target.value) || S.canvasW;
    const aspect = parseFloat(e.target.dataset.aspect) || (S.canvasW / S.canvasH);
    document.getElementById('video-height-label').textContent = Math.round(w / aspect);
  });
  function syncPlayPauseBtns() {
    const icon = S.animPaused ? '▶' : '⏸';
    document.getElementById('btn-anim-playpause').textContent = icon;
    const l = document.getElementById('btn-anim-playpause-layers');
    if (l) {
      l.querySelector('.anim-playpause-icon').textContent = icon;
      l.querySelector('.anim-playpause-label').textContent = S.animPaused ? 'Play Anims' : 'Pause Anims';
    }
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
  // Explicit deselect — normally a tap on empty canvas does this, but that
  // relies on being able to see/reach empty canvas, which isn't guaranteed
  // on touch (no hover state to preview a hit before committing to a tap).
  document.getElementById('btn-clear-selection').addEventListener('click', () => {
    clearAllSelections();
    updateSpriteProps();
    updateShapeProps();
    updateStrokeProps();
    updatePaletteItemProps();
    markRenderDirty();
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
    const total = m.strokes.length + m.sprites.length + (m.shapes || []).length;
    if (total === 0) return;
    if (confirm(`Clear all ${total} item${total !== 1 ? 's' : ''} (strokes, shapes and sprites) from this mandala? This cannot be undone.`)) {
      historySnapshot();
      m.strokes = []; invalidateStrokeCache();
      m.sprites = [];
      m.shapes = [];
      clearAllSelections();
      updateSpriteProps();
      updateShapeProps();
      updateStrokeProps();
      updatePaletteItemProps();
      updateLayersList();
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
  document.getElementById('bg-color').addEventListener('input', e => { S.bgColor = e.target.value; invalidateStrokeCache(); updateColorContrastWarning(); });
  wireViewport();

  // Tool buttons
  document.querySelectorAll('.tool-btn[data-tool]').forEach(btn => {
    btn.addEventListener('click', () => setTool(btn.dataset.tool));
  });

  // Status bar
  document.getElementById('draw-color').addEventListener('input', e => {
    S.color = e.target.value;
    document.getElementById('color-swatch').style.background = e.target.value;
    updateColorContrastWarning();
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

  // Images panel — collapses to a thin strip so a large image library
  // doesn't have to compete with the Layers/Inspector column for space.
  const imagesPanel = document.getElementById('images-panel');
  let imagesCollapsed = false;
  try { imagesCollapsed = localStorage.getItem('mandala-images-collapsed') === '1'; } catch {}
  imagesPanel.classList.toggle('collapsed', imagesCollapsed);
  function setImagesCollapsed(collapsed) {
    imagesCollapsed = collapsed;
    imagesPanel.classList.toggle('collapsed', collapsed);
    try { localStorage.setItem('mandala-images-collapsed', collapsed ? '1' : '0'); } catch {}
  }
  document.getElementById('btn-images-collapse').addEventListener('click', () => setImagesCollapsed(true));
  document.getElementById('btn-images-expand-icon').addEventListener('click', () => setImagesCollapsed(false));
  document.getElementById('btn-images-expand').addEventListener('click', () => setImagesCollapsed(false));

  // Effects/Layers/Inspector panel — same collapsible-strip pattern as Images.
  const rightPanel = document.getElementById('right-panel');
  let rightCollapsed = false;
  try { rightCollapsed = localStorage.getItem('mandala-right-collapsed') === '1'; } catch {}
  rightPanel.classList.toggle('collapsed', rightCollapsed);
  function setRightCollapsed(collapsed) {
    rightCollapsed = collapsed;
    rightPanel.classList.toggle('collapsed', collapsed);
    try { localStorage.setItem('mandala-right-collapsed', collapsed ? '1' : '0'); } catch {}
  }
  document.getElementById('btn-right-collapse').addEventListener('click', () => setRightCollapsed(true));
  document.getElementById('btn-right-expand-icon').addEventListener('click', () => setRightCollapsed(false));
  document.getElementById('btn-right-expand').addEventListener('click', () => setRightCollapsed(false));

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
          : key === 'offsetX'  ? Math.hypot(spr.x, spr.y) // radial: base radius
          : key === 'offsetY'  ? 0                        // tangential: no shift from rest position
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
      updateLayersList();
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
    // Deep clone — see the shape Duplicate handler's comment for why a
    // shallow spread isn't enough (shared anim/keyframe object references).
    const copy = { ...JSON.parse(JSON.stringify(found.sprite)), id: uid(), z: nextZ(found.mandala), x: found.sprite.x + 20, y: found.sprite.y + 20 };
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
  document.getElementById('btn-trim-frames').addEventListener('click', openTrimFramesDialog);

  // Keyboard shortcuts
  document.addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') return;
    if (e.key === '?' || e.key === '/') { toggleHelp(); return; }
    if (e.key === 'Escape') { if (isTheaterMode()) { exitTheaterMode(); return; } closeHelp(); }
    if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); return; }
    if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) { e.preventDefault(); redo(); return; }
    if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); saveProject(); return; }
    if (e.key === 'Escape' && S.tool === 'place') {
      setTool('select');
      if (S.lastStampedId) { S.selectedSpriteId = S.lastStampedId; updateSpriteProps(); }
      return;
    }
    if (e.key === 'Escape' && (S.tool === 'line' || S.tool === 'lineChain') && S.linePhase) {
      // Cancel the pending segment and drop out of the tool — for Line
      // Chain this is also how you stop chaining.
      setTool('select');
      return;
    }
    const map = { b:'brush', l:'line', k:'lineChain', s:'select', p:'place', i:'eyedropper', c:'circle', g:'polygon', v:'petal', z:'bezier', w:'wing', t:'text' };
    if (map[e.key.toLowerCase()]) setTool(map[e.key.toLowerCase()]);
    if (e.key === '*' || (e.shiftKey && e.key === '8')) setTool('star');
    if (e.key === 'Delete' || e.key === 'Backspace') {
      if (S.selectedSpriteId) document.getElementById('btn-delete-sprite').click();
      if (S.selectedShapeId) document.getElementById('sp-delete')?.click();
    }
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      if (S.selectedSpriteId || S.selectedShapeId || S.selectedStrokeId) {
        e.preventDefault();
        selectAdjacentLayer(e.key === 'ArrowUp' ? -1 : 1);
      }
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
  initColorPopover();
  initGradientUI();

  // ── Shape panel + snap ───────────────────────────────────
  wireShapePanel();
  wireShapeProps();
  wireShapeAnimProps();
  wireStrokeProps();
  wireSnapUI();

  // EFFECT-MODULE: ui init
  wireEffectsPanel();
}

// ── Gradient UI ──────────────────────────────────────────
// Shared colour-stop bar editor: click empty space to add a stop, click a
// stop to recolour it, drag to reposition, double-click to remove. Used by
// both the toolbar's live-draw gradient panel and the per-stroke Drawing
// Inspector — each instance owns its own selection state and reads/writes
// whichever gradient object getGradient() currently points to.
const HANDLE_H = 5; // triangle height at top + bottom of bar

function makeGradientStopEditor({ canvas, scaleInput, scaleVal, speedInput, speedVal, getGradient, onChange }) {
  let selectedIdx = 0;

  function render() {
    const gradient = getGradient();
    if (!gradient) return;
    const { stops, scale, speed } = gradient;
    // sampleGradientRGB() caches parsed {r,g,b} by this exact stops array
    // reference for hot-path performance — but stop edits mutate colours
    // in place rather than replacing the array, so that cache never saw
    // the change and kept feeding the renderer stale colours. render()
    // runs after every stop edit (drag, recolour, add, remove), so
    // invalidating here guarantees the next paint re-parses fresh values.
    _parsedStopsCache.delete(stops);
    const rect = canvas.getBoundingClientRect();
    // While the panel is hidden (display:none ancestor) the box has zero
    // size — skip drawing rather than falling back to a guessed width.
    // Baking in a fake width here is what caused the canvas to render
    // stretched/blocky later: its bitmap resolution would stay fixed at
    // that guess while its real CSS box (and any handle triangles drawn
    // into the bitmap) grew or shrank around it. The ResizeObserver below
    // re-renders as soon as the box actually has a real size.
    if (rect.width === 0 || rect.height === 0) return;
    // Sync canvas pixel size to CSS size so it's crisp
    const dpr = window.devicePixelRatio || 1;
    const cw = Math.round(rect.width * dpr);
    const ch = Math.round(rect.height * dpr);
    if (canvas.width !== cw || canvas.height !== ch) { canvas.width = cw; canvas.height = ch; }

    const pc = canvas.getContext('2d');
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
      const sel = idx === selectedIdx;
      const hc = sel ? '#ffe66d' : '#fff';

      pc.fillStyle = stop.color;
      pc.strokeStyle = hc;
      pc.lineWidth = sel ? 1.5 : 1;

      pc.beginPath();
      pc.moveTo(x, 0);
      pc.lineTo(x - HANDLE_H, barTop - 1);
      pc.lineTo(x + HANDLE_H, barTop - 1);
      pc.closePath();
      pc.fill(); pc.stroke();

      pc.beginPath();
      pc.moveTo(x, H);
      pc.lineTo(x - HANDLE_H, H - barTop + 1);
      pc.lineTo(x + HANDLE_H, H - barTop + 1);
      pc.closePath();
      pc.fill(); pc.stroke();
    });

    pc.restore();

    // Sync sliders
    if (scaleVal) scaleVal.textContent = scale + 'px';
    if (speedVal) speedVal.textContent = speed.toFixed(1) + '×';
    if (scaleInput) scaleInput.value = scale;
    if (speedInput) speedInput.value = Math.round(speed * 100);
  }

  canvas.addEventListener('pointerdown', e => {
    const gradient = getGradient();
    if (!gradient) return;
    const rect = canvas.getBoundingClientRect();
    const w = rect.width;
    const t = Math.max(0, Math.min(1, (e.clientX - rect.left) / w));
    const THRESH = 8 / w; // 8px hit zone
    const near = gradient.stops.findIndex(s => Math.abs(s.pos - t) < THRESH);

    if (near >= 0) {
      // Select existing stop + drag
      selectedIdx = near;
      render();
      const stop = gradient.stops[near];
      const startX = e.clientX, startPos = stop.pos;
      let moved = false;
      const onMove = ev => {
        moved = true;
        const dx = ev.clientX - startX;
        stop.pos = Math.max(0, Math.min(1, startPos + dx / w));
        gradient.stops.sort((a, b) => a.pos - b.pos);
        selectedIdx = gradient.stops.findIndex(s => s === stop);
        render();
      };
      const onUp = () => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        if (!moved) {
          // Single click on handle: open the custom colour popover,
          // anchored exactly at the stop — see initColorPopover() for why
          // this isn't the native <input type=color> any more.
          openColorPopover(startX, rect.bottom, stop.color, hex => {
            stop.color = hex; render(); onChange?.();
          });
        } else {
          onChange?.();
        }
      };
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    } else {
      // Click on empty area: add new stop
      const color = sampleGradient(gradient.stops, t);
      const newStop = { pos: t, color };
      gradient.stops.push(newStop);
      gradient.stops.sort((a, b) => a.pos - b.pos);
      selectedIdx = gradient.stops.findIndex(s => s === newStop);
      render();
      onChange?.();
    }
  });

  canvas.addEventListener('dblclick', e => {
    const gradient = getGradient();
    if (!gradient || gradient.stops.length <= 2) return;
    const rect = canvas.getBoundingClientRect();
    const t = (e.clientX - rect.left) / rect.width;
    const near = gradient.stops.findIndex(s => Math.abs(s.pos - t) < 10 / rect.width);
    if (near >= 0) {
      gradient.stops.splice(near, 1);
      selectedIdx = Math.min(selectedIdx, gradient.stops.length - 1);
      render();
      onChange?.();
    }
  });

  // Re-render whenever the canvas's actual box size changes for any reason
  // — window resize, its panel being shown/hidden, a sidebar collapsing,
  // a display DPI change — so the bitmap resolution never goes stale.
  if (typeof ResizeObserver !== 'undefined') {
    new ResizeObserver(() => render()).observe(canvas);
  }

  return { render, resetSelection() { selectedIdx = 0; } };
}

let toolbarGradientEditor = null;

function initGradientUI() {
  // Reflect the default gradientMode=true on startup
  document.getElementById('btn-gradient-mode').classList.toggle('active', S.gradientMode);
  updateGradientPanelVisibility();

  const sel = document.getElementById('grad-preset');
  sel.appendChild(new Option('Preset…', ''));
  for (const name of Object.keys(GRADIENT_PRESETS)) {
    const opt = document.createElement('option');
    opt.value = name; opt.textContent = name;
    sel.appendChild(opt);
  }

  toolbarGradientEditor = makeGradientStopEditor({
    canvas: document.getElementById('grad-preview'),
    scaleInput: document.getElementById('grad-scale'),
    scaleVal: document.getElementById('grad-scale-val'),
    speedInput: document.getElementById('grad-speed'),
    speedVal: document.getElementById('grad-speed-val'),
    getGradient: () => S.gradient,
  });

  sel.addEventListener('change', () => {
    if (!sel.value) return;
    S.gradient.stops = JSON.parse(JSON.stringify(GRADIENT_PRESETS[sel.value]));
    toolbarGradientEditor.resetSelection();
    toolbarGradientEditor.render();
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
    updateGradientPanelVisibility();
  });

  toolbarGradientEditor.render();
}

// ── Init ─────────────────────────────────────────────────
function init() {
  // Note: <title> is set statically in index.html for SEO — don't overwrite it here.
  // Version is shown via the #version-label status-bar element instead.
  const vl = document.getElementById('version-label');
  if (vl) vl.textContent = `v${VERSION}`;

  // Restore the last-used polygon side count so it stays consistent across
  // page reloads, not just within a single session.
  try {
    const savedSides = parseInt(localStorage.getItem('mandala-polygon-sides'));
    if (savedSides >= 3 && savedSides <= 20) S.shapeParams.sides = savedSides;
  } catch {}

  resizeCanvas(S.canvasW, S.canvasH);
  addMandala();
  wireEvents();
  updateUndoButtons();
  updateLayersList();
  updateStatusBarVisibility();
  document.getElementById('color-swatch').style.background = S.color;
  updateColorContrastWarning();
  centerCanvasView();
  requestAnimationFrame(render);

  // Splash logo — shown centred on load, faded out after a beat, then
  // removed from the DOM once the fade finishes so it can't linger as a
  // stray layer.
  const splash = document.getElementById('splash-logo');
  if (splash) {
    setTimeout(() => {
      splash.classList.add('splash-hidden');
      splash.addEventListener('transitionend', () => splash.remove(), { once: true });
    }, 1500);
  }
}

// Scripts are placed at end of <body> so DOM is ready by the time this runs.
// DOMContentLoaded guard ensures safety even if the script tag is ever moved.
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
