// Cross-origin broker for poromagia.com -> raw.githubusercontent.com
// Receives postMessage from the manager userscript and opens/reuses named windows.

(function () {
  'use strict';

  // Allow only poromagia.com (and subdomains) to control this broker.
  function isAllowedOrigin(origin) {
    if (!origin) return false;
    if (origin === 'https://poromagia.com') return true;
    return origin.endsWith('.poromagia.com') && origin.startsWith('https://');
  }

  function openOrReuse(name, url) {
    // Using window.open(url, name) is enough to reuse a named target across origins.
    // (Avoid touching other-window .location directly to dodge cross-origin quirks.)
    try {
      const w = window.open(url, name);
      try { w && w.focus && w.focus(); } catch (_) {}
    } catch (e) {
      // last-resort attempt; ignore failures
      try { window.open(url, name); } catch (_) {}
    }
  }

  // Handle messages from the manager pages.
  window.addEventListener('message', (ev) => {
    if (!isAllowedOrigin(ev.origin)) return;
    const data = ev.data || {};

    if (data.type === 'ping') {
      try { ev.source && ev.source.postMessage({ type: 'pong' }, ev.origin); } catch (_) {}
      return;
    }

    if (data.type === 'open' && data.name && data.url) {
      openOrReuse(String(data.name), String(data.url));
      return;
    }

    if (data.type === 'focus' && data.name) {
      try {
        const w = window.open('', String(data.name));
        try { w && w.focus && w.focus(); } catch (_) {}
      } catch (_) {}
      return;
    }
  });

  // On load, tell the opener (if any) we’re ready.
  try {
    if (window.opener && window.opener.postMessage) {
      // We don't know opener origin here; send a generic ready (the userscript filters by origin).
      window.opener.postMessage({ type: 'ready' }, '*');
    }
  } catch (_) {}

})();
