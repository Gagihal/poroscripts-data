// ==UserScript==
// @name         Poromagia Store Manager — TCG Seller button (ID-based direct links)
// @namespace    poroscripts
// @version      1.0
// @description  Adds TCGA (TCGplayer Seller Admin) button using direct product ID links
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

  // ----- per-row buttons -----
  async function enhanceRows(){
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
})();
