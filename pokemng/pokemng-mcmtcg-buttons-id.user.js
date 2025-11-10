// ==UserScript==
// @name         Poromagia Store Manager — MCM/TCG buttons (ID-based direct links)
// @namespace    poroscripts
// @version      5.9
// @description  Adds MCM and TCG buttons using direct product ID links (updated: improved TCG ID matching). Automatic search skips NO CARD rows to find first valid card.
// @match        https://poromagia.com/store_manager/pokemon/*
// @require      https://raw.githubusercontent.com/Gagihal/poroscripts-data/main/utils/poro-search-utils.js
// @updateURL    https://raw.githubusercontent.com/Gagihal/poroscripts-data/main/pokemng/pokemng-mcmtcg-buttons-id.user.js
// @downloadURL  https://raw.githubusercontent.com/Gagihal/poroscripts-data/main/pokemng/pokemng-mcmtcg-buttons-id.user.js
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

  // Flag to trigger automatic search when first row is enhanced
  let pendingAutoSearch = false;

  // ----- Helper: open MCM/TCG tabs using card data (with ID-based direct links) -----
  async function openSearchTabs(cardData) {
    console.log('[openSearchTabs] cardData:', cardData);

    // Try to build direct URLs using the utility functions
    const mcmDirectUrl = cardData.cardId ? await PoroSearch.buildMcmDirectUrl(cardData.cardId) : null;
    const tcgDirectUrl = cardData.cardId ? await PoroSearch.buildTcgDirectUrl(cardData.cardId) : null;

    console.log('[openSearchTabs] mcmDirectUrl:', mcmDirectUrl);
    console.log('[openSearchTabs] tcgDirectUrl:', tcgDirectUrl);

    // Build URLs - direct if we have them, otherwise search
    let mcmURL, tcgURL;

    if (mcmDirectUrl) {
      mcmURL = mcmDirectUrl;
    } else {
      // Fallback to search - buildMcmQuery is async and returns {primary, backup}
      const mcmQueryObj = await PoroSearch.buildMcmQuery(cardData);
      const mcmQ = mcmQueryObj.primary || mcmQueryObj.backup || cardData.name;
      console.log('[openSearchTabs] MCM fallback to search, query:', mcmQ);
      mcmURL = `https://www.cardmarket.com/en/Pokemon/Products/Search?searchString=${encodeURIComponent(mcmQ)}`;
    }

    if (tcgDirectUrl) {
      tcgURL = tcgDirectUrl;
    } else {
      // Fallback to search - buildTcgQuery is sync and returns a string
      const tcgQ = PoroSearch.buildTcgQuery(cardData);
      console.log('[openSearchTabs] TCG fallback to search, query:', tcgQ);
      tcgURL = `https://www.tcgplayer.com/search/pokemon/product?Language=English&ProductTypeName=Cards&productLineName=pokemon&q=${encodeURIComponent(tcgQ)}&view=grid`;
    }

    console.log('[openSearchTabs] Final URLs - MCM:', mcmURL, 'TCG:', tcgURL);
    PoroSearch.openNamed(mcmURL, 'MCMWindow');
    PoroSearch.openNamed(tcgURL, 'TCGWindow');
  }

  // Toolbar button removed - deprecated in favor of automatic search on filter submit

  // ----- per-row buttons -----
  async function enhanceRows(){
    // process rows sequentially so we can await query-builders cleanly
    let autoSearchTriggered = false;
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

      // If we have a pending auto-search and haven't triggered it yet
      // Skip rows with "NO CARD" and find the first valid card
      if (pendingAutoSearch && !autoSearchTriggered) {
        if (cardId === 'NO CARD') {
          console.log('[enhanceRows] Skipping row with NO CARD, looking for next valid card');
          continue;
        }
        console.log('[enhanceRows] Found valid card, triggering automatic search');
        pendingAutoSearch = false;
        autoSearchTriggered = true;
        // Trigger the automatic search with this row's data
        await openSearchTabs(cardData);
      }
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
  document.getElementById('filterer')?.addEventListener('submit', (e) => {
    console.log('[Filter Submit] Form submitted, setting flag for automatic search');
    // Set flag - when the first row is enhanced, it will trigger the automatic search
    pendingAutoSearch = true;
  });
})();
