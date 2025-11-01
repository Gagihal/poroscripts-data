// ==UserScript==
// @name         Pokemon Manager – MCM/TCG buttons (named tabs) v2.1
// @namespace    poroscripts
// @version      2.1
// @description  Adds MCM and TCG buttons; reuses persistent named tabs across manager windows.
// @match        https://poromagia.com/store_manager/pokemon/*
// @require      https://cdn.jsdelivr.net/gh/<you>/<repo>@<TAG_OR_SHA>/poro-search-utils.js
// @updateURL    https://cdn.jsdelivr.net/gh/<you>/<repo>@<TAG_OR_SHA>/store-manager-userscript.user.js
// @downloadURL  https://cdn.jsdelivr.net/gh/<you>/<repo>@<TAG_OR_SHA>/store-manager-userscript.user.js
// @connect      raw.githubusercontent.com
// @grant        none
// ==/UserScript==

(async function () {
  'use strict';

  // ----- helpers -----
  const PREF_RE = /^(tg|gg|rc|sv|h|sl|sh)\d+/i;
  const IGNORE  = new Set(['full','art','secret','rare','hyper','alternative','alternate','reverse','holo','bs']);
  function sanitize(s){ return s.split(/\s+/).filter(w => !IGNORE.has(w.toLowerCase())).join(' ').trim(); }

  function firstNum(str){
    if(!str) return '';
    const first = str.split('/')[0].toUpperCase();
    const m = first.match(PREF_RE);
    if (m) return m[0].toLowerCase();
    const d = first.match(/\d+/);
    return d ? d[0] : '';
  }

  // pick first numeric token but skip "lv.xx"
  function splitNameNum(txt){
    const out = {name: [], num: ''};
    const parts = String(txt).trim().split(/\s+/);
    for (const w of parts){
      if (!out.num && /\d/.test(w)){
        if (/^lv\.\d+$/i.test(w)) { out.name.push(w); continue; }
        out.num = w.toUpperCase();
        break;
      }
      out.name.push(w);
    }
    return {name: out.name.join(' '), num: out.num};
  }

  function normalizeSetKey(s){
    return String(s)
      .replace(/\u00A0/g, ' ')
      .replace(/\s*\(.*?\)\s*/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  // "δ Delta Species" -> "delta" for TCG searches
  function fixDelta(q){ return q.replace(/\u03b4\s*Delta\s*Species/gi, 'delta'); }

  function openNamed(url, name){
    // must run inside user gesture
    let w = window.open('', name);
    if (!w || w.closed) w = window.open('about:blank', name);
    if (!w) return; // popup blocked
    try { w.location.replace(url); w.focus(); }
    catch { window.open(url, name); }
  }

  // ----- load set-code map for MCM -----
  const MAP_URL = 'https://raw.githubusercontent.com/gagihal/poroscripts-data/main/mcmsetmap.json';
  let abbrLower = {};
  try{
    const r = await fetch(MAP_URL,{mode:'cors'});
    if(!r.ok) throw new Error(r.status);
    const js = await r.json();
    Object.entries(js).forEach(([k,v]) => abbrLower[k.toLowerCase()] = v);
  }catch(e){
    console.error('[PM MCM/TCG] set-map load failed:',e);
    alert('Could not load set-code map. MCM queries may be worse.');
  }

  // ----- DOM -----
  const manager = document.getElementById('storemanager'); if (!manager) return;
  const table   = manager.querySelector('table');          if (!table)   return;

  // toolbar button to open both for current filter query
  const content = document.getElementById('content');
  if(content){
    const openTabsBtn = document.createElement('button');
    openTabsBtn.textContent = 'OPEN MCM/TCG';
    openTabsBtn.title = 'Open/reuse persistent tabs based on current filter query.';
    openTabsBtn.style.cssText = 'margin:8px 0;padding:2px 6px;border:1px solid #888;background:#eee;';
    openTabsBtn.onclick = () => {
      const raw = document.getElementById('id_name')?.value.trim() || '';
      const {name, num} = splitNameNum(raw);
      const clean = sanitize(name);
      const pn    = firstNum(num);
      const mcmQ  = pn && /^\d+$/.test(pn) ? `${clean} ${pn.padStart(3,'0')}` : (pn ? `${clean} ${pn}` : clean);
      const mcmURL = 'https://www.cardmarket.com/en/Pokemon/Products/Search?searchString=' + encodeURIComponent(mcmQ);
      const tcgURL = 'https://www.tcgplayer.com/search/pokemon/product?Language=English&ProductTypeName=Cards&productLineName=pokemon&q='
                   + encodeURIComponent(fixDelta(clean)) + '&view=grid';
      openNamed(mcmURL, 'MCMWindow');
      openNamed(tcgURL, 'TCGWindow');
    };
    content.insertBefore(openTabsBtn, manager);
  }

  // find table body
  const headerRow = table.querySelector('tbody tr');
  const tbody = table.querySelector('tbody'); if(!tbody) return;

  function enhanceRows(){
    tbody.querySelectorAll('tr').forEach(row=>{
      if(row._mcmTcgDone) return; row._mcmTcgDone = true;

      const nameCell=row.querySelector('td.name');
      const setCell =row.querySelector('td:nth-child(6)');
      const idCell  =row.querySelector('td:nth-child(4)');
      if(!nameCell||!setCell||!idCell) return;

      function buildTerms(){
        const {name,num}=splitNameNum(nameCell.textContent);
        const clean = sanitize(name);
        const pn    = firstNum(num);

        const setFull = setCell.textContent.trim();

        // TCG exception for "Expedition Base Set" -> "Expedition"
        const last = /^expedition base set$/i.test(setFull)
          ? 'Expedition'
          : (setFull.split(/\s+/).pop() || '');

        // MCM abbr lookup, tolerate "Additionals"
        const key = normalizeSetKey(setFull);
        let abbr  = abbrLower[key] || '';
        if (!abbr) {
          const keyNoAdd = key
            .replace(/\s*[:\-–—]\s*additionals?$/i, '')
            .replace(/\s+additionals?$/i, '');
          abbr = abbrLower[keyNoAdd] || '';
        }

        let mcm = clean;
        if(abbr && /^\d+$/.test(pn)) mcm = `${clean} ${abbr}${pn}`;
        else if(abbr && pn)          mcm = `${clean} ${pn}`;
        else if(pn)                  mcm = /^\d+$/.test(pn) ? `${clean} ${pn.padStart(3,'0')}` : `${clean} ${pn}`;

        let backup = clean;
        if(pn) backup = /^\d+$/.test(pn)?`${clean} ${pn.padStart(3,'0')}`:`${clean} ${pn}`;

        const tcg = fixDelta(sanitize(`${clean} ${last}`));
        return {mcm, backup, tcg};
      }

      const terms = buildTerms();

      // MCM button (Alt = backup query)
      const mBtn = document.createElement('button');
      mBtn.textContent='MCM';
      mBtn.className='pm-mcm-btn';
      mBtn.style.cssText='display:block;margin:2px;padding:2px;';
      mBtn.onclick = e=>{
        const q = e.altKey ? terms.backup : terms.mcm;
        const url = 'https://www.cardmarket.com/en/Pokemon/Products/Search?searchString=' + encodeURIComponent(q);
        openNamed(url, 'MCMWindow');
      };
      idCell.appendChild(mBtn);

      // TCG button
      const tBtn = document.createElement('button');
      tBtn.textContent='TCG';
      tBtn.className='pm-tcg-btn';
      tBtn.style.cssText='display:block;margin:2px;padding:2px;';
      tBtn.onclick = ()=>{
        const url = 'https://www.tcgplayer.com/search/pokemon/product?Language=English&ProductTypeName=Cards&productLineName=pokemon&q='
                  + encodeURIComponent(terms.tcg) + '&view=grid';
        openNamed(url, 'TCGWindow');
      };
      idCell.appendChild(tBtn);
    });
  }

  enhanceRows();
  new MutationObserver(enhanceRows).observe(tbody,{childList:true,subtree:true});

  // also wire the Filter form to open both tabs with the filter query
  document.getElementById('filterer')?.addEventListener('submit',()=>{
    const raw=document.getElementById('id_name').value.trim();
    const {name,num}=splitNameNum(raw);
    const clean=sanitize(name);
    const pn   = firstNum(num);
    const mcm  = pn && /^\d+$/.test(pn) ? `${clean} ${pn.padStart(3,'0')}` : (pn ? `${clean} ${pn}` : clean);

    const mcmURL = 'https://www.cardmarket.com/en/Pokemon/Products/Search?searchString='+encodeURIComponent(mcm);
    const tcgURL = 'https://www.tcgplayer.com/search/pokemon/product?Language=English&ProductTypeName=Cards&productLineName=pokemon&q='
                 + encodeURIComponent(fixDelta(clean))+'&view=grid';

    openNamed(mcmURL, 'MCMWindow');
    openNamed(tcgURL, 'TCGWindow');
  });

})();
