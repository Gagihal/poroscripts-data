// ==UserScript==
// @name         Poromagia Store Manager — MCM/TCG buttons (ID-based direct links)
// @namespace    poroscripts
// @version      3.0
// @description  Adds MCM and TCG buttons using direct product ID links for MCM (with search fallback); reuses persistent named tabs.
// @match        https://poromagia.com/store_manager/pokemon/*
// @require      https://raw.githubusercontent.com/Gagihal/poroscripts-data/main/poro-search-utils.js
// @updateURL    https://raw.githubusercontent.com/Gagihal/poroscripts-data/main/pokemng-mcmtcg-buttons-id.user.js
// @downloadURL  https://raw.githubusercontent.com/Gagihal/poroscripts-data/main/pokemng-mcmtcg-buttons-id.user.js
// @connect      raw.githubusercontent.com
// @grant        none
// ==/UserScript==




(async function () {
  'use strict';

  // ----- guards -----
  const manager = document.getElementById('storemanager'); if (!manager) return;
  const table   = manager.querySelector('table');          if (!table)   return;
  const tbody   = table.querySelector('tbody');            if (!tbody)   return;

  // Preload ID mapping for better performance
  PoroSearch.preloadIdMap().catch(() => {});

  // ----- toolbar: pre-open both tabs from current filter -----
  (function injectToolbarBtn(){
    const content = document.getElementById('content');
    if (!content) return;
    const btn = document.createElement('button');
    btn.textContent = 'OPEN MCM/TCG';
    btn.title = 'Open/reuse persistent tabs based on current filter query.';
    btn.style.cssText = 'margin:8px 0;padding:2px 6px;border:1px solid #888;background:#eee;';
    btn.onclick = () => {
      const raw   = document.getElementById('id_name')?.value.trim() || '';
      const { name } = PoroSearch.splitNameNum(raw);
      const clean = PoroSearch.sanitize(name);

      const tcgQ = PoroSearch.buildTcgQuery({ name: clean, setFull: '' }); // no set in filter box
      const mcmQ = clean; // without set/number, just name is best fallback

      const mcmURL = 'https://www.cardmarket.com/en/Pokemon/Products/Search?searchString=' + encodeURIComponent(mcmQ);
      const tcgURL = 'https://www.tcgplayer.com/search/pokemon/product?Language=English&ProductTypeName=Cards&productLineName=pokemon&q='
                   + encodeURIComponent(tcgQ) + '&view=grid';
      PoroSearch.openNamed(mcmURL, 'MCMWindow');
      PoroSearch.openNamed(tcgURL, 'TCGWindow');
    };
    content.insertBefore(btn, manager);
  })();

  // ----- per-row buttons -----
  async function enhanceRows(){
    // process rows sequentially so we can await query-builders cleanly
    for (const row of tbody.querySelectorAll('tr')){
      if (row._pmMcmTcgDone) continue;

      const nameCell = row.querySelector('td.name');
      const setCell  = row.querySelector('td:nth-child(6)');
      const idCell   = row.querySelector('td:nth-child(4)');
      // Last column contains Card ID (the one we need for ID mapping)
      const cardIdCell = row.querySelector('td:last-child');
      if (!nameCell || !setCell || !idCell || !cardIdCell) { row._pmMcmTcgDone = true; continue; }

      const rawName = nameCell.textContent || '';
      const setFull = (setCell.textContent || '').trim();
      const cardId = (cardIdCell.textContent || '').trim();

      const { name, num } = PoroSearch.splitNameNum(rawName);
      const cleanName = PoroSearch.sanitize(name);

      const tcgQ = PoroSearch.buildTcgQuery({ name: cleanName, setFull });

      // Try to get direct MCM URL from ID mapping (using Card ID)
      const mcmDirectUrl = await PoroSearch.buildMcmDirectUrl(cardId);

      // Fallback: build search queries if no ID mapping
      let mcmSearchUrl = null;
      let mcmBackupSearchUrl = null;
      let usingFallback = false;
      if (!mcmDirectUrl) {
        usingFallback = true;
        const { primary: mcmQ, backup: mcmBackupQ } = await PoroSearch.buildMcmQuery({
          name: cleanName, setFull, number: num
        });
        mcmSearchUrl = 'https://www.cardmarket.com/en/Pokemon/Products/Search?searchString=' + encodeURIComponent(mcmQ);
        mcmBackupSearchUrl = 'https://www.cardmarket.com/en/Pokemon/Products/Search?searchString=' + encodeURIComponent(mcmBackupQ);
      }

      // MCM button (direct link if available, otherwise search; Alt = backup search)
      const mBtn = document.createElement('button');
      mBtn.textContent = 'MCM';
      mBtn.className = 'pm-mcm-btn';
      mBtn.style.cssText = 'display:block;margin:2px;padding:2px;';
      // Visual indicator: green border if direct link available
      if (mcmDirectUrl) {
        mBtn.style.borderLeft = '3px solid #4CAF50';
        mBtn.title = 'Direct product link';
      } else {
        mBtn.title = 'Search query (Alt-click for backup)';
      }
      mBtn.onclick = (e)=>{
        let url;
        if (mcmDirectUrl && !e.altKey) {
          url = mcmDirectUrl;
        } else if (e.altKey && mcmBackupSearchUrl) {
          url = mcmBackupSearchUrl;
          alert('Had to fall back to old search (backup)');
        } else if (mcmSearchUrl) {
          url = mcmSearchUrl;
          if (usingFallback) alert('Had to fall back to old search');
        } else {
          return; // shouldn't happen
        }
        PoroSearch.openNamed(url, 'MCMWindow');
      };
      idCell.appendChild(mBtn);

      // TCG button (still uses search for now)
      const tBtn = document.createElement('button');
      tBtn.textContent = 'TCG';
      tBtn.className = 'pm-tcg-btn';
      tBtn.style.cssText = 'display:block;margin:2px;padding:2px;';
      tBtn.onclick = ()=>{
        const url = 'https://www.tcgplayer.com/search/pokemon/product?Language=English&ProductTypeName=Cards&productLineName=pokemon&q='
                  + encodeURIComponent(tcgQ) + '&view=grid';
        PoroSearch.openNamed(url, 'TCGWindow');
      };
      idCell.appendChild(tBtn);

      row._pmMcmTcgDone = true;
    }
  }

  let enhancing = false;
  async function safeEnhance(){
    if (enhancing) return;
    enhancing = true;
    try { await enhanceRows(); } finally { enhancing = false; }
  }

  await safeEnhance();
  new MutationObserver(() => { safeEnhance(); })
    .observe(tbody, { childList: true, subtree: true });

  // ----- filter form: open both tabs on submit -----
  document.getElementById('filterer')?.addEventListener('submit', ()=>{
    const raw   = document.getElementById('id_name')?.value.trim() || '';
    const { name } = PoroSearch.splitNameNum(raw);
    const clean = PoroSearch.sanitize(name);

    const mcmURL = 'https://www.cardmarket.com/en/Pokemon/Products/Search?searchString=' + encodeURIComponent(clean);
    const tcgURL = 'https://www.tcgplayer.com/search/pokemon/product?Language=English&ProductTypeName=Cards&productLineName=pokemon&q='
                 + encodeURIComponent(PoroSearch.buildTcgQuery({ name: clean, setFull: '' })) + '&view=grid';
    PoroSearch.openNamed(mcmURL, 'MCMWindow');
    PoroSearch.openNamed(tcgURL, 'TCGWindow');
  });
})();
