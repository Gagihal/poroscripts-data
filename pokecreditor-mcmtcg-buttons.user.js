// ==UserScript==
// @name         Pokemon Creditor list — tiny T/M buttons (with MCM set-abbrev)
// @namespace    poroscripts
// @version      1.5
// @description  Add compact T (TCGplayer) and M (MCM) buttons after Condition on the creditor list, using shared search utilities.
// @match        https://poromagia.com/en/admin/pokemon/creditorderitem/*
// @require      https://raw.githubusercontent.com/Gagihal/poroscripts-data/main/poro-search-utils.js
// @updateURL    https://raw.githubusercontent.com/Gagihal/poroscripts-data/main/pokecreditor-mcmtcg-buttons.user.js
// @downloadURL  https://raw.githubusercontent.com/Gagihal/poroscripts-data/main/pokecreditor-mcmtcg-buttons.user.js
// @connect      raw.githubusercontent.com
// @grant        none
// ==/UserScript==

(async function () {
  'use strict';

  console.log('[Pokecreditor v1.5] Script started');
  console.log('[Pokecreditor] PoroSearch available?', typeof PoroSearch);
  console.log('[Pokecreditor] Current URL:', window.location.href);

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

  /* ---------- wait for DOM ---------- */
  function waitForTable() {
    return new Promise((resolve) => {
      const check = () => {
        const table = document.querySelector('#result_list');
        console.log('[Pokecreditor] Checking for table... found:', !!table, 'has tbody:', !!(table && table.tBodies[0]));
        if (table && table.tBodies[0]) {
          console.log('[Pokecreditor] Table found! Starting enhancement...');
          resolve(table);
        } else {
          requestAnimationFrame(check);
        }
      };
      if (document.readyState === 'loading') {
        console.log('[Pokecreditor] DOM still loading, waiting for DOMContentLoaded...');
        document.addEventListener('DOMContentLoaded', check);
      } else {
        console.log('[Pokecreditor] DOM already loaded, checking now...');
        check();
      }
    });
  }

  /* ---------- main ---------- */
  const table = await waitForTable();
  console.log('[Pokecreditor] Table ready, rows found:', table.querySelectorAll('tbody > tr').length);

  function parseSetAndNum(row){
    // name from first column
    const rawName = row.querySelector('th.field-card_name')?.textContent || '';
    const { name, num: numFromName } = PoroSearch.splitNameNum(rawName);
    const cleanName = PoroSearch.sanitize(name || rawName);

    // identifier like: "(#079) – Ultra Rare – X&Y Steam Siege"
    const identTxt = (row.querySelector('td.field-card_identifier')?.textContent || '').replace(/\u00A0/g,' ').trim();
    const parts = identTxt.split(/–/).map(s=>s.trim()).filter(Boolean);
    const setFull = parts.length ? parts[parts.length - 1] : '';

    // number: prefer (#xxx) in identifier; fallback to number inside name
    let pnRaw = '';
    const mHash = identTxt.match(/\(#\s*([A-Za-z]*\d+)\s*\)/);
    if (mHash) pnRaw = mHash[1];
    if (!pnRaw && numFromName) pnRaw = numFromName;

    return { cleanName, setFull, number: pnRaw };
  }

  async function buildQueries(row){
    const { cleanName, setFull, number } = parseSetAndNum(row);

    // Use shared utility builders
    const tcgQ = PoroSearch.buildTcgQuery({ name: cleanName, setFull });
    const { primary: mcmQ, backup: mcmBackupQ } = await PoroSearch.buildMcmQuery({
      name: cleanName, setFull, number
    });

    return { tcgQ, mcmQ, mcmBackupQ };
  }

  function makeBtn(txt, title, onclick){
    const b = document.createElement('button');
    b.textContent = txt; b.title = title; b.className = 'pm-tm-btn'; b.type = 'button';
    b.addEventListener('click', onclick);
    return b;
  }

  async function enhance(){
    const rows = table.querySelectorAll('tbody > tr');
    console.log('[Pokecreditor] enhance() called, processing', rows.length, 'rows');

    for (const row of rows){
      if (row._pmTinyDone) continue;

      const condCell = row.querySelector('td.field-condition');
      if (!condCell) {
        console.log('[Pokecreditor] Row skipped - no field-condition cell found');
        continue;
      }
      console.log('[Pokecreditor] Processing row, found condition cell');

      const allTds = Array.from(row.children);
      const condIdx = allTds.indexOf(condCell);
      const newCell = row.insertCell(condIdx + 1);
      newCell.className = 'pm-tm-cell';

      const holder = document.createElement('div');
      holder.className = 'pm-tm-wrap';
      newCell.appendChild(holder);

      const { tcgQ, mcmQ, mcmBackupQ } = await buildQueries(row);

      const tBtn = makeBtn('T','Search on TCGplayer', (e)=>{
        e.preventDefault();
        const url = 'https://www.tcgplayer.com/search/pokemon/product?Language=English&ProductTypeName=Cards&productLineName=pokemon&q='
          + encodeURIComponent(tcgQ) + '&view=grid';
        PoroSearch.openNamed(url, 'TCGWindow');
      });

      const mBtn = makeBtn('M','Search on Cardmarket (Alt = backup)', (e)=>{
        e.preventDefault();
        const q = e.altKey ? mcmBackupQ : mcmQ;
        const url = 'https://www.cardmarket.com/en/Pokemon/Products/Search?searchString=' + encodeURIComponent(q);
        PoroSearch.openNamed(url, 'MCMWindow');
      });

      holder.append(tBtn, mBtn);
      row._pmTinyDone = true;
      console.log('[Pokecreditor] Buttons added to row successfully');
    }
    console.log('[Pokecreditor] enhance() completed');
  }

  let enhancing = false;
  async function safeEnhance(){
    if (enhancing) return;
    enhancing = true;
    try { await enhance(); } finally { enhancing = false; }
  }

  await safeEnhance();
  new MutationObserver(() => { safeEnhance(); })
    .observe(table.tBodies[0], { childList:true, subtree:true });
})();
