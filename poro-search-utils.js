// poro-search-utils.js  v1.0.0
;(function (root){
  'use strict';

  const IGNORE  = new Set(['full','art','secret','rare','hyper','alternative','alternate','reverse','holo','bs']);
  const PREF_RE = /^(tg|gg|rc|sv|h|sl|sh)\d+/i;
  const MAP_URL = 'https://raw.githubusercontent.com/gagihal/poroscripts-data/main/mcmsetmap.json';

  function sanitize(s){ return String(s||'').split(/\s+/).filter(w=>!IGNORE.has(w.toLowerCase())).join(' ').trim(); }
  function firstNum(str){
    if(!str) return '';
    const first = String(str).split('/')[0].toUpperCase();
    const m = first.match(PREF_RE);
    if (m) return m[0].toLowerCase();
    const d = first.match(/\d+/);
    return d ? d[0] : '';
  }
  function splitNameNum(txt){
    const out = {name: [], num: ''};
    const parts = String(txt||'').trim().split(/\s+/);
    for (const w of parts){
      if (!out.num && /\d/.test(w)){
        if (/^lv\.\d+$/i.test(w)) { out.name.push(w); continue; }
        out.num = w.toUpperCase(); break;
      }
      out.name.push(w);
    }
    return {name: out.name.join(' '), num: out.num};
  }
  function normalizeSetKey(s){
    return String(s||'')
      .replace(/\u00A0/g, ' ')
      .replace(/\s*\(.*?\)\s*/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }
  function fixDelta(q){ return String(q||'').replace(/\u03b4\s*Delta\s*Species/gi, 'delta'); }

  // --- MCM set-abbrev cache (24h) ---
  let _abbrMap = null, _abbrTs = 0;
  async function getAbbrMap(){
    const now = Date.now();
    if (_abbrMap && now - _abbrTs < 24*3600*1000) return _abbrMap;
    const r = await fetch(MAP_URL, {mode:'cors'});
    const js = await r.json();
    const lower = {};
    Object.entries(js).forEach(([k,v])=> lower[k.toLowerCase()] = v);
    _abbrMap = lower; _abbrTs = now;
    return _abbrMap;
  }

  // --- Public builders ---
  // name: "Charizard", setFull: "EX Dragon Frontiers", opts.number can be "079" or "rc11" etc.
  async function buildMcmQuery({name, setFull, number}){
    const clean = sanitize(name);
    const pn    = firstNum(number);
    const map   = await getAbbrMap();

    const key = normalizeSetKey(setFull);
    let abbr  = map[key] || '';
    if (!abbr){
      const keyNoAdd = key
        .replace(/\s*[:\-–—]\s*additionals?$/i, '')
        .replace(/\s+additionals?$/i, '');
      abbr = map[keyNoAdd] || '';
    }

    // primary and backup like your manager script
    let primary = clean;
    if (abbr && /^\d+$/.test(pn)) primary = `${clean} ${abbr}${pn}`;
    else if (abbr && pn)          primary = `${clean} ${pn}`;
    else if (pn)                  primary = /^\d+$/.test(pn) ? `${clean} ${pn.padStart(3,'0')}` : `${clean} ${pn}`;

    let backup = clean;
    if (pn) backup = /^\d+$/.test(pn) ? `${clean} ${pn.padStart(3,'0')}` : `${clean} ${pn}`;

    return { primary, backup };
  }

  // name + last word (Expedition special-case) for TCGplayer
  function buildTcgQuery({name, setFull}){
    const clean = sanitize(splitNameNum(name).name || name);
    const last  = /^expedition base set$/i.test(setFull) ? 'Expedition' : (String(setFull).split(/\s+/).pop() || '');
    return fixDelta(sanitize(`${clean} ${last}`));
  }

  // Open or reuse named tab
  function openNamed(url, name){
    let w = window.open('', name);
    if (!w || w.closed) w = window.open('about:blank', name);
    if (!w) return; // popup blocked
    try { w.location.replace(url); w.focus(); } catch { window.open(url, name); }
  }

  // export
  const api = { sanitize, splitNameNum, firstNum, normalizeSetKey, fixDelta, buildMcmQuery, buildTcgQuery, openNamed };
  root.PoroSearch = api;
})(typeof unsafeWindow !== 'undefined' ? unsafeWindow : window);
