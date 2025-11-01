// poro-search-utils.js  v1.1.1
;(function (root) {
  'use strict';

  // ---------- config ----------
  let MAP_URL = 'https://raw.githubusercontent.com/gagihal/poroscripts-data/main/mcmsetmap.json';
  const LS_KEY = 'poro_mcm_setabbr_map_v1';
  const LS_TS  = 'poro_mcm_setabbr_map_ts_v1';
  const CACHE_MS = 24 * 3600 * 1000; // 24h

  // ---------- small helpers ----------
  const IGNORE = new Set(['full','art','secret','rare','hyper','alternative','alternate','reverse','holo','bs']);
  const PREF_RE = /^(tg|gg|rc|sv|h|sl|sh)\d+/i;

  function sanitize(s) {
    return String(s || '')
      .split(/\s+/)
      .filter(w => !IGNORE.has(w.toLowerCase()))
      .join(' ')
      .trim();
  }

  function firstNum(str) {
    if (!str) return '';
    const first = String(str).split('/')[0].toUpperCase();
    const m = first.match(PREF_RE);
    if (m) return m[0].toLowerCase();
    const d = first.match(/\d+/);
    return d ? d[0] : '';
  }

  function splitNameNum(txt) {
    const out = { name: [], num: '' };
    const parts = String(txt || '').trim().split(/\s+/);
    for (const w of parts) {
      if (!out.num && /\d/.test(w)) {
        if (/^lv\.\d+$/i.test(w)) { out.name.push(w); continue; }
        out.num = w.toUpperCase();
        break;
      }
      out.name.push(w);
    }
    return { name: out.name.join(' '), num: out.num };
  }

  function normalizeSetKey(s) {
    return String(s || '')
      .replace(/\u00A0/g, ' ')
      .replace(/\s*\(.*?\)\s*/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  function fixDelta(q) {
    return String(q || '').replace(/\u03b4\s*Delta\s*Species/gi, 'delta');
  }

  function openNamed(url, name) {
    // Try to open/reuse a named window
    let w = window.open(url, name);
    if (w) {
      try { w.focus(); } catch {}
    }
    // If blocked, user will need to allow popups
  }

  // ---------- set-abbreviation map cache ----------
  let _abbrMap = null;
  let _abbrTs = 0;

  function _readLS() {
    try {
      const ts = parseInt(localStorage.getItem(LS_TS) || '0', 10);
      if (!ts || Date.now() - ts > CACHE_MS) return null;
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') return parsed;
    } catch {}
    return null;
  }

  function _writeLS(map) {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(map || {}));
      localStorage.setItem(LS_TS, String(Date.now()));
    } catch {}
  }

  async function _fetchMap() {
    const r = await fetch(MAP_URL, { mode: 'cors' });
    if (!r.ok) throw new Error(`map fetch ${r.status}`);
    const js = await r.json();
    const lower = {};
    Object.entries(js).forEach(([k, v]) => { lower[String(k).toLowerCase()] = v; });
    return lower;
  }

  async function getAbbrMap() {
    // memory cache valid?
    if (_abbrMap && (Date.now() - _abbrTs) < CACHE_MS) return _abbrMap;

    // try localStorage cache
    const cached = _readLS();
    if (cached) {
      _abbrMap = cached; _abbrTs = Date.now();
      return _abbrMap;
    }

    // fetch fresh
    try {
      const fresh = await _fetchMap();
      _abbrMap = fresh; _abbrTs = Date.now();
      _writeLS(fresh);
      return _abbrMap;
    } catch (e) {
      // on failure, keep whatever we have or fall back to empty
      console.error('[PoroSearch] set-map load failed:', e);
      _abbrMap = _abbrMap || {};
      return _abbrMap;
    }
  }

  // ---------- public builders ----------
  /**
   * Build Cardmarket search queries.
   * @param {{name:string,setFull:string,number?:string}} p
   * @returns {Promise<{primary:string, backup:string}>}
   */
  async function buildMcmQuery(p) {
    const name = sanitize(p?.name);
    const pn = firstNum(p?.number || '');
    const map = await getAbbrMap();

    const key = normalizeSetKey(p?.setFull);
    let abbr = map[key] || '';
    if (!abbr) {
      const keyNoAdd = key
        .replace(/\s*[:\-–—]\s*additionals?$/i, '')
        .replace(/\s+additionals?$/i, '');
      abbr = map[keyNoAdd] || '';
    }

    let primary = name;
    if (abbr && /^\d+$/.test(pn)) primary = `${name} ${abbr}${pn}`;
    else if (abbr && pn)          primary = `${name} ${pn}`;
    else if (pn)                  primary = /^\d+$/.test(pn) ? `${name} ${pn.padStart(3, '0')}` : `${name} ${pn}`;

    let backup = name;
    if (pn) backup = /^\d+$/.test(pn) ? `${name} ${pn.padStart(3, '0')}` : `${name} ${pn}`;

    return { primary, backup };
  }

  /**
   * Build TCGplayer search query: name + last word of set (Expedition special-case) with delta fix.
   * @param {{name:string,setFull:string}} p
   * @returns {string}
   */
  function buildTcgQuery(p) {
    const clean = sanitize(splitNameNum(p?.name).name || p?.name);
    const setFull = String(p?.setFull || '');
    const last = /^expedition base set$/i.test(setFull)
      ? 'Expedition'
      : (setFull.split(/\s+/).pop() || '');
    return fixDelta(sanitize(`${clean} ${last}`));
  }

  // ---------- admin/override hooks ----------
  function setMapUrl(url) { if (url) MAP_URL = String(url); }
  function setAbbrMap(obj) {
    if (obj && typeof obj === 'object') {
      const lower = {};
      Object.entries(obj).forEach(([k, v]) => { lower[String(k).toLowerCase()] = v; });
      _abbrMap = lower; _abbrTs = Date.now();
      _writeLS(lower);
    }
  }
  async function preloadAbbrMap() { await getAbbrMap(); }

  // ---------- export ----------
  const api = {
    // utils
    sanitize, splitNameNum, firstNum, normalizeSetKey, fixDelta, openNamed,
    // builders
    buildMcmQuery, buildTcgQuery,
    // cache/admin
    preloadAbbrMap, setAbbrMap, setMapUrl,
    // meta
    version: '1.1.1'
  };

  root.PoroSearch = api;

})(typeof unsafeWindow !== 'undefined' ? unsafeWindow : window);
