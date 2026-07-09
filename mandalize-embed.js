// ═══════════════════════════════════════════════════════
//  MANDALA MAKER — mandalize-embed.js
//  Runs on a HOST gallery page (not inside the player itself) — scans for
//  placeholder elements and mounts one player <iframe> into each. An
//  iframe per player gives each instance a fully separate JS scope for
//  free (its own copy of engine.js's state), which is what makes "many
//  players on one page" safe without any cross-instance interference.
//
//  Usage:
//    <div class="mandalize-player" data-src="mandalas/rainbow-nova.json"></div>
//    <script src="mandalize-embed.js"></script>
//
//  Or programmatically:
//    MandalizePlayer.mount(el, { src: 'https://example.com/x.json' });
// ═══════════════════════════════════════════════════════

(function () {
  // Resolved relative to THIS script's own location, not the host page's
  // URL, so a gallery on a different path/domain still finds player.html
  // correctly as long as it's hosted alongside mandalize-embed.js.
  const BASE_URL = new URL('.', document.currentScript.src);

  function mount(el, opts) {
    const src = opts && opts.src || el.dataset.src;
    if (!src) { console.warn('Mandalize player: no src given', el); return; }

    const iframe = document.createElement('iframe');
    iframe.src = new URL('player.html?src=' + encodeURIComponent(src), BASE_URL).href;
    iframe.loading = 'lazy'; // browser-native deferred load for offscreen tiles
    iframe.title = 'Mandalize mandala player';
    iframe.style.cssText = 'width:100%;height:100%;border:0;display:block';
    iframe.setAttribute('allowfullscreen', '');

    el.innerHTML = '';
    el.appendChild(iframe);
    return iframe;
  }

  function mountAll() {
    document.querySelectorAll('.mandalize-player').forEach(el => {
      if (!el.dataset.mandalizeMounted) {
        mount(el);
        el.dataset.mandalizeMounted = '1';
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mountAll);
  } else {
    mountAll();
  }

  window.MandalizePlayer = { mount, mountAll };
})();
