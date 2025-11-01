// ==UserScript==
// @name         Pokemon Creditor list – tiny T/M buttons (with MCM set-abbrev)
// @namespace    http://tampermonkey.net/
// @version      0.2
// @description  Add compact T (TCGplayer) and M (MCM) buttons after Condition on the creditor list, with proper MCM set-abbrev queries.
// @match        https://poromagia.com/en/admin/pokemon/creditorderitem/*
// @grant        none
// ==/UserScript==

(async function () {
  'use strict';

  /* ---------- helpers (same as manager) ---------- */
  const PREF_RE = /^(tg|gg|rc|sv|h|sl|sh)\d+/i;
  const IGNORE = new Set(['full','art','secret','rare','hyper','alternative','alternate','reverse','holo','bs']);
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
  function fixDelta(q){ return q.replace(/\u03b4\s*Delta\s*Species/gi, 'delta'); }
  function openNamed(url, name){
    let w = window.open('', name);
    if (!w || w.closed) w = window.open('about:blank', name);
    if (!w) return; // popup blocked
    try { w.location.replace(url); w.focus(); } catch { window.open(url, name); }
  }

  /* ---------- load set-code map for MCM ---------- */
  const MAP_URL = 'https://raw.githubusercontent.com/gagihal/poroscripts-data/main/mcmsetmap.json';
  let abbrLower = {};
  try{
    const r = await fetch(MAP_URL,{mode:'cors'});
    if(!r.ok) throw new Error(r.status);
    const js = await r.json();
    Object.entries(js).forEach(([k,v]) => abbrLower[k.toLowerCase()] = v);
  }catch(e){
    console.error('[Creditor T/M] set-map load failed:', e);
    // non-fatal; we’ll fall back to non-abbrev searches
  }

  /* ---------- UI styles ---------- */
  (function injectStyles(){
    const css = `
      .pm-tm-cell { white-space: nowrap; }
      .pm-tm-wrap { display:flex; gap:4px; align-items:center; }
      .pm-tm-btn {
        padding: 1px 6px; border: 1px solid #888; background: #eee;
        border-radius: 4px; font: 11px system-ui, sans-serif; line-height: 1.3; cursor: pointer;
      }
      .pm-tm-btn:active { transform: translateY(1px); }
      @media (max-width: 900px){ .pm-tm-btn { padding: 1px 5px; font-size: 10px; } }
    `;
    const s = document.createElement('style'); s.textContent = css; document.head.appendChild(s);
  })();

  /* ---------- main ---------- */
  const table = document.querySelector('#result_list');
  if (!table || !table.tBodies[0]) return;

  function parseSetAndNum(row){
    // name from first column
    const rawName = row.querySelector('th.field-card_name')?.textContent || '';
    const cleanName = sanitize(splitNameNum(rawName).name || rawName);

    // identifier like: "(#079) – Ultra Rare – X&Y Steam Siege"
    const identTxt = (row.querySelector('td.field-card_identifier')?.textContent || '').replace(/\u00A0/g,' ').trim();
    const parts = identTxt.split(/–/).map(s=>s.trim()).filter(Boolean);
    const setFull = parts.length ? parts[parts.length - 1] : '';

    // number: prefer (#xxx) in identifier; fallback to number inside name
    let pnRaw = '';
    const mHash = identTxt.match(/\(#\s*([A-Za-z]*\d+)\s*\)/);
    if (mHash) pnRaw = mHash[1];
    if (!pnRaw){
      const fromName = splitNameNum(rawName).num;
      if (fromName) pnRaw = fromName;
    }
    const pn = firstNum(pnRaw); // handles tg/rc/... or plain digits

    return { cleanName, setFull, pn };
  }

  function buildQueries(row){
    const { cleanName, setFull, pn } = parseSetAndNum(row);

    // TCG: name + last word of set (with Expedition special-case) + delta fix
    const tcgSetWord = /^expedition base set$/i.test(setFull)
      ? 'Expedition'
      : (setFull.split(/\s+/).pop() || '');
    const tcgQ = fixDelta(sanitize(`${cleanName} ${tcgSetWord}`));

    // MCM: try set abbreviation + number pattern; with fallbacks like manager script
    const key = normalizeSetKey(setFull);
    let abbr = abbrLower[key] || '';
    if (!abbr){
      const keyNoAdd = key
        .replace(/\s*[:\-–—]\s*additionals?$/i, '')
        .replace(/\s+additionals?$/i, '');
      abbr = abbrLower[keyNoAdd] || '';
    }

    let mcm = cleanName;
    if (abbr && /^\d+$/.test(pn)) mcm = `${cleanName} ${abbr}${pn}`;
    else if (abbr && pn) mcm = `${cleanName} ${pn}`;
    else if (pn) mcm = /^\d+$/.test(pn) ? `${cleanName} ${pn.padStart(3,'0')}` : `${cleanName} ${pn}`;

    // backup: clean + zero-padded numeric if available
    let backup = cleanName;
    if (pn) backup = /^\d+$/.test(pn) ? `${cleanName} ${pn.padStart(3,'0')}` : `${cleanName} ${pn}`;

    return { tcgQ, mcmQ: mcm, mcmBackupQ: backup };
  }

  function makeBtn(txt, title, onclick){
    const b = document.createElement('button');
    b.textContent = txt; b.title = title; b.className = 'pm-tm-btn'; b.type = 'button';
    b.addEventListener('click', onclick);
    return b;
  }

  function enhance(){
    table.querySelectorAll('tbody > tr').forEach(row=>{
      if (row._pmTinyDone) return;

      const condCell = row.querySelector('td.field-condition');
      if (!condCell) return;

      const allTds = Array.from(row.children);
      const condIdx = allTds.indexOf(condCell);
      const newCell = row.insertCell(condIdx + 1);
      newCell.className = 'pm-tm-cell';

      const holder = document.createElement('div');
      holder.className = 'pm-tm-wrap';
      newCell.appendChild(holder);

      const { tcgQ, mcmQ, mcmBackupQ } = buildQueries(row);

      const tBtn = makeBtn('T','Search on TCGplayer', ()=>{
        const url = 'https://www.tcgplayer.com/search/pokemon/product?Language=English&ProductTypeName=Cards&productLineName=pokemon&q='
          + encodeURIComponent(tcgQ) + '&view=grid';
        openNamed(url, 'TCGWindow');
      });

      const mBtn = makeBtn('M','Search on Cardmarket (Alt = backup)', (e)=>{
        const q = e.altKey ? mcmBackupQ : mcmQ;
        const url = 'https://www.cardmarket.com/en/Pokemon/Products/Search?searchString=' + encodeURIComponent(q);
        openNamed(url, 'MCMWindow');
      });

      holder.append(tBtn, mBtn);
      row._pmTinyDone = true;
    });
  }

  enhance();
  new MutationObserver(enhance).observe(table.tBodies[0], { childList:true, subtree:true });
})();
