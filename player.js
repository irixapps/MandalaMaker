// ═══════════════════════════════════════════════════════
//  MANDALA MAKER — player.js
//  Loads a saved mandala project (relative or absolute URL, passed via
//  ?src=) and plays it — no editor UI, no tools, nothing beyond load +
//  animate + fullscreen. Runs entirely on top of engine.js (loaded before
//  this script), so every render feature the editor gains is available
//  here automatically with no separate implementation to keep in sync.
//
//  Multi-instance note: this file is meant to be loaded fresh inside its
//  own <iframe> per player (see mandalize-embed.js) rather than included
//  multiple times on one page — engine.js keeps a handful of state/cache
//  globals (S, the animation-cache flags, per-effect offscreen buffers)
//  that assume exactly one canvas exists in the current JS scope, which
//  an iframe gives for free without needing a deeper refactor.
// ═══════════════════════════════════════════════════════

// ── State (trimmed to exactly what engine.js's render path reads) ──────
const S = {
  mandalas: [],
  effects: [],
  bgColor: '#0d0d1a',
  animClock: 0,
  palette: [],
  canvasW: 1200,
  canvasH: 900,
};

// ── DOM refs ─────────────────────────────────────────────
const playerRoot = document.getElementById('player-root');
const canvas = document.getElementById('main-canvas');
const ctx = canvas.getContext('2d', { willReadFrequently: true });
const hiddenImgs = document.getElementById('hidden-imgs');
const loadingEl = document.getElementById('player-loading');
const errorEl = document.getElementById('player-error');
const chromeEl = document.getElementById('player-chrome');
const playPauseBtn = document.getElementById('player-play-pause');
const fullscreenBtn = document.getElementById('player-fullscreen');

// ── Player-local playback state ─────────────────────────
let animPaused = false;
let rafId = null;
let lastTime = 0;
let renderDirty = true;
let isVisible = true;   // gated by IntersectionObserver — pause RAF work when scrolled offscreen
let hasLoaded = false;
const runCaches = new Map(); // this instance's own stroke run-cache — see rebuildStrokeCache in engine.js

function markRenderDirty() { renderDirty = true; }

// ── Loading a project ────────────────────────────────────
// Trimmed sibling of the editor's loadProject() — same data-applying
// steps (palette image decode, custom font registration, effect defaults
// backfill, layer z-order backfill), with every editor-UI call (updating
// panels, menus, dropdowns) removed, since there is no UI here.
function loadProjectData(json) {
  const data = JSON.parse(json);
  S.bgColor = data.bgColor || '#0d0d1a';
  S.canvasW = data.canvasW || 1200;
  S.canvasH = data.canvasH || 900;
  canvas.width = S.canvasW;
  canvas.height = S.canvasH;

  S.mandalas = data.mandalas || [];
  for (const m of S.mandalas) backfillLayerZ(m);

  S.effects = data.effects || [];
  S.effects.forEach(e => {
    const def = EFFECT_TYPES[e.type];
    if (def) {
      const defaults = def.defaults();
      for (const k in defaults) if (e[k] === undefined) e[k] = defaults[k];
    }
  });
  flushHasAnimCache();

  S.palette = [];
  hiddenImgs.innerHTML = '';
  const paletteLoads = (data.palette || []).map(p => new Promise(resolve => {
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
    img.onerror = resolve; // a broken image shouldn't block the whole project from playing
  }));

  const fontLoads = (data.customFonts || []).map(cf => registerCustomFont(cf));

  return Promise.all([...paletteLoads, ...fontLoads]).then(() => {
    runCaches.clear();
    rebuildStrokeCache(canvas, runCaches);
    renderDirty = true;
  });
}

async function loadFromUrl(src) {
  const res = await fetch(src);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const text = await res.text();
  await loadProjectData(text);
}

// ── Render loop ──────────────────────────────────────────
// Trimmed sibling of the editor's render() — same content-drawing
// sequence (rebuild cache if needed, clear, draw mandalas + sprites,
// apply effects, paint background behind everything via destination-over
// so erase-stroke holes and empty areas both resolve to bgColor), with
// every tool-preview/editor-chrome branch removed, since none of that
// exists in a saved project.
function renderFrame(timestamp) {
  rafId = requestAnimationFrame(renderFrame);
  if (!isVisible || !hasLoaded) return;

  const dt = lastTime ? Math.min((timestamp - lastTime) / 1000, 0.1) : 0;
  lastTime = timestamp;

  const animating = hasAnyAnimationCached();
  if (!animating && !renderDirty) return;
  renderDirty = false;
  if (animating && !animPaused) S.animClock += dt;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawMandalasWithOptionalSpriteSplit(ctx, canvas, false, runCaches);
  applyEffectsChain(ctx, canvas);

  ctx.save();
  ctx.globalCompositeOperation = 'destination-over';
  ctx.fillStyle = S.bgColor;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.restore();
}

// ── Playback controls ────────────────────────────────────
function setPaused(paused) {
  animPaused = paused;
  playPauseBtn.textContent = paused ? '►' : '❚❚';
  playPauseBtn.setAttribute('aria-label', paused ? 'Play' : 'Pause');
  markRenderDirty();
}

canvas.addEventListener('click', () => setPaused(!animPaused));

document.addEventListener('keydown', e => {
  if (e.key === ' ') { e.preventDefault(); setPaused(!animPaused); }
  if (e.key.toLowerCase() === 'f') { e.preventDefault(); toggleFullscreen(); }
});

// ── Fullscreen (YouTube-style) ───────────────────────────
function toggleFullscreen() {
  const isFs = document.fullscreenElement || document.webkitFullscreenElement;
  if (isFs) {
    (document.exitFullscreen || document.webkitExitFullscreen).call(document);
  } else {
    const req = playerRoot.requestFullscreen || playerRoot.webkitRequestFullscreen;
    req.call(playerRoot);
  }
}
fullscreenBtn.addEventListener('click', toggleFullscreen);

// ── Visibility-based pausing ──────────────────────────────
// Offscreen gallery tiles shouldn't burn CPU/battery redrawing a canvas
// nobody can see — pause the moment this player scrolls out of view, and
// also whenever the tab itself is backgrounded, regardless of scroll
// position (a good-citizen default; native <iframe loading="lazy"> in
// mandalize-embed.js additionally avoids even creating far-offscreen
// players in the first place).
new IntersectionObserver(entries => {
  isVisible = entries[0].isIntersecting;
  if (isVisible) markRenderDirty();
}, { threshold: 0.01 }).observe(canvas);

document.addEventListener('visibilitychange', () => {
  isVisible = isVisible && !document.hidden;
  if (!document.hidden) markRenderDirty();
});

// ── Boot ──────────────────────────────────────────────────
(function init() {
  const params = new URLSearchParams(window.location.search);
  const src = params.get('src');
  if (!src) {
    loadingEl.style.display = 'none';
    errorEl.textContent = 'No mandala specified (missing ?src=).';
    errorEl.style.display = 'flex';
    return;
  }

  loadFromUrl(src)
    .then(() => {
      hasLoaded = true;
      loadingEl.style.display = 'none';
      chromeEl.style.display = '';
      renderDirty = true;
    })
    .catch(err => {
      console.error('Mandalize player failed to load', src, err);
      loadingEl.style.display = 'none';
      errorEl.textContent = "Couldn't load this mandala.";
      errorEl.style.display = 'flex';
    });

  rafId = requestAnimationFrame(renderFrame);
})();
