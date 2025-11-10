// ==UserScript==
// @name         Poromagia Store Manager — TCG Seller button (ID-based direct links)
// @namespace    poroscripts
// @version      1.2
// @description  Adds TCGA (TCGplayer Seller Admin) button using direct product ID links (updated: improved TCG ID matching). Automatic search skips NO CARD rows to find first valid card.
// @match        https://poromagia.com/store_manager/pokemon/*
// @require      https://raw.githubusercontent.com/Gagihal/poroscripts-data/main/utils/poro-search-utils.js
// @updateURL    https://raw.githubusercontent.com/Gagihal/poroscripts-data/main/pokemng/pokemng-tcgseller-button.user.js
// @downloadURL  https://raw.githubusercontent.com/Gagihal/poroscripts-data/main/pokemng/pokemng-tcgseller-button.user.js
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

  // ----- Helper: open TCG Seller tab using card data (with ID-based direct links) -----
  async function openTcgSellerTab(cardData) {
    console.log('[openTcgSellerTab] cardData:', cardData);

    // Try to get TCG product ID
    const hasValidId = cardData.cardId && cardData.cardId !== '0' && cardData.cardId !== 0;
    const tcgId = hasValidId ? await PoroSearch.getTcgId(cardData.cardId) : null;

    // Build direct admin URL if we have a valid TCG ID
    const directUrl = (tcgId && tcgId !== '0' && tcgId !== 0)
      ? `https://store.tcgplayer.com/admin/product/manage/${tcgId}`
      : null;

    console.log('[openTcgSellerTab] directUrl:', directUrl);

    let tcgSellerURL;
    if (directUrl) {
      tcgSellerURL = directUrl;
    } else {
      // Fallback to search
      const query = PoroSearch.buildTcgQuery(cardData);
      console.log('[openTcgSellerTab] TCG Seller fallback to search, query:', query);
      tcgSellerURL = `https://store.tcgplayer.com/admin/product/catalog?SearchValue=${encodeURIComponent(query)}`;
    }

    console.log('[openTcgSellerTab] Final URL:', tcgSellerURL);
    PoroSearch.openNamed(tcgSellerURL, 'TCGSellerWindow');
  }

  // ----- per-row buttons -----
  async function enhanceRows(){
    // process rows sequentially so we can await query-builders cleanly
    let autoSearchTriggered = false;
    for (const row of tbody.querySelectorAll('tr')){
      if (row._pmTcgSellerDone) continue;

      const nameCell = row.querySelector('td.name');
      const setCell  = row.querySelector('td:nth-child(6)');
      const idCell   = row.querySelector('td:nth-child(4)');
      // Card ID is in the cell with link-product-card link
      const cardIdCell = row.querySelector('td a[href*="link-product-card"]')?.parentElement;
      if (!nameCell || !setCell || !idCell || !cardIdCell) { row._pmTcgSellerDone = true; continue; }

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

      // Create TCG Seller button
      const tcgSellerButton = await PoroSearch.createTcgSellerButton(cardData, {
        text: 'TCGA',
        className: 'pm-tcgseller-btn',
        style: 'display:block;margin:2px;padding:2px;'
      });

      idCell.appendChild(tcgSellerButton);
      row._pmTcgSellerDone = true;

      // If we have a pending auto-search and haven't triggered it yet
      // Skip rows with "NO CARD" and find the first valid card
      if (pendingAutoSearch && !autoSearchTriggered) {
        if (cardId === 'NO CARD') {
          console.log('[enhanceRows] Skipping row with NO CARD, looking for next valid card');
          continue;
        }
        console.log('[enhanceRows] Found valid card, triggering automatic TCG Seller search');
        pendingAutoSearch = false;
        autoSearchTriggered = true;
        // Trigger the automatic search with this row's data
        await openTcgSellerTab(cardData);
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

  // ----- filter form: open TCG Seller tab on submit -----
  document.getElementById('filterer')?.addEventListener('submit', (e) => {
    console.log('[Filter Submit] Form submitted, setting flag for automatic TCG Seller search');
    // Set flag - when the first row is enhanced, it will trigger the automatic search
    pendingAutoSearch = true;
  });
})();
