// ==UserScript==
// @name         Poromagia Store Manager — MCM/TCG buttons (ID-based direct links)
// @namespace    poroscripts
// @version      3.2
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
      // Card ID is in the cell with link-product-card link
      const cardIdCell = row.querySelector('td a[href*="link-product-card"]')?.parentElement;
      if (!nameCell || !setCell || !idCell || !cardIdCell) { row._pmMcmTcgDone = true; continue; }

      const rawName = nameCell.textContent || '';
      const setFull = (setCell.textContent || '').trim();
      const cardId = (cardIdCell.textContent || '').trim();

      const { name, num } = PoroSearch.splitNameNum(rawName);
      const cleanName = PoroSearch.sanitize(name);

      // Parse card data
      const cardData = {
        name: cleanName,
        setFull: setFull,
        number: num,
        cardId: cardId
      };

      // Use the new utility to create both buttons
      const { tcgButton, mcmButton } = await PoroSearch.createSearchButtons(cardData, {
        tcgText: 'TCG',
        mcmText: 'MCM',
        tcgClassName: 'pm-tcg-btn',
        mcmClassName: 'pm-mcm-btn',
        tcgStyle: 'display:block;margin:2px;padding:2px;',
        mcmStyle: 'display:block;margin:2px;padding:2px;'
      });

      idCell.appendChild(mcmButton);
      idCell.appendChild(tcgButton);

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
