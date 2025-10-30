const ch = new BroadcastChannel('pmTabBroker');

function openOrReuse(name, url) {
  let w = window.open('', name);
  if (!w || w.closed) w = window.open('about:blank', name);
  try { w.location.replace(url); w.focus(); } catch { window.open(url, name); }
}

ch.onmessage = ev => {
  const msg = ev.data || {};
  if (msg.type === 'ping') ch.postMessage({type:'pong'});
  if (msg.type === 'open' && msg.name && msg.url) openOrReuse(msg.name, msg.url);
  if (msg.type === 'focus' && msg.name) {
    try { const w = window.open('', msg.name); if (w) w.focus(); } catch {}
  }
};

// announce readiness
try { ch.postMessage({type:'ready'}); } catch {}
