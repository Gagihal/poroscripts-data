// ==UserScript==
// @name         Poromagia Store Manager — MCM/TCG/TCGA buttons (ID-based direct links)
// @namespace    poroscripts
// @version      5.12
// @description  Adds MCM, TCG and TCGA buttons (one per column: Hidden / Autohide / ID) using direct product ID links. Auto-opens the tabs on filter submit. Combines the old mcmtcg + tcgseller scripts.
// @match        https://poromagia.com/store_manager/pokemon/*
// @require      https://raw.githubusercontent.com/Gagihal/poroscripts-data/main/utils/poro-search-utils.js
// @updateURL    https://raw.githubusercontent.com/Gagihal/poroscripts-data/main/pokemng/pokemng-mcmtcg-buttons-id.user.js
// @downloadURL  https://raw.githubusercontent.com/Gagihal/poroscripts-data/main/pokemng/pokemng-mcmtcg-buttons-id.user.js
// @connect      raw.githubusercontent.com
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(async function () {
  'use strict';

  const DEBUG = false;

  // ----- guards -----
  const manager = document.getElementById('storemanager'); if (!manager) return;
  const table   = manager.querySelector('table');          if (!table)   return;
  const tbody   = table.querySelector('tbody');            if (!tbody)   return;

  // Preload ID mapping for better performance
  PoroSearch.preloadIdMap().catch(() => {});

  // Flag to trigger automatic search when first row is enhanced
  let pendingAutoSearch = false;

  // Per-button style — small; placed one per column. The button helpers add a
  // coloured left-border direct-link indicator on top of this.
  const BTN_STYLE = 'display:block;margin:5px auto 0;padding:2px 7px;font-size:10px;line-height:1.35;';

  // ----- Helper: open MCM + TCG + TCGA tabs using card data (direct links or search) -----
  async function openAllTabs(cardData) {
    if (DEBUG) console.log('[openAllTabs] cardData:', cardData);

    const hasValidId = cardData.cardId && cardData.cardId !== '0' && cardData.cardId !== 0;
    const mcmDirectUrl = hasValidId ? await PoroSearch.buildMcmDirectUrl(cardData.cardId) : null;
    const tcgDirectUrl = hasValidId ? await PoroSearch.buildTcgDirectUrl(cardData.cardId) : null;
    const tcgId        = hasValidId ? await PoroSearch.getTcgId(cardData.cardId) : null;

    // MCM
    let mcmURL;
    if (mcmDirectUrl) {
      mcmURL = mcmDirectUrl;
    } else {
      const mcmQueryObj = await PoroSearch.buildMcmQuery(cardData);
      const mcmQ = mcmQueryObj.primary || mcmQueryObj.backup || cardData.name;
      mcmURL = `https://www.cardmarket.com/en/Pokemon/Products/Search?searchString=${encodeURIComponent(mcmQ)}`;
    }

    // TCG (public product page)
    let tcgURL;
    if (tcgDirectUrl) {
      tcgURL = tcgDirectUrl;
    } else {
      const tcgQ = PoroSearch.buildTcgQuery(cardData);
      tcgURL = `https://www.tcgplayer.com/search/pokemon/product?Language=English&ProductTypeName=Cards&productLineName=pokemon&q=${encodeURIComponent(tcgQ)}&view=grid`;
    }

    // TCGA (Seller Admin)
    let sellerURL;
    if (tcgId && tcgId !== '0' && tcgId !== 0) {
      sellerURL = `https://store.tcgplayer.com/admin/product/manage/${tcgId}`;
    } else {
      const q = PoroSearch.buildTcgQuery(cardData);
      sellerURL = `https://store.tcgplayer.com/admin/product/catalog?SearchValue=${encodeURIComponent(q)}`;
    }

    if (DEBUG) console.log('[openAllTabs] URLs:', { mcmURL, tcgURL, sellerURL });
    PoroSearch.openNamed(mcmURL, 'MCMWindow');
    PoroSearch.openNamed(tcgURL, 'TCGWindow');
    PoroSearch.openNamed(sellerURL, 'TCGSellerWindow');
  }

  // ----- per-row buttons -----
  async function enhanceRows(){
    let autoSearchTriggered = false;
    for (const row of tbody.querySelectorAll('tr')){
      if (row._pmBtnsDone) continue;

      const nameCell = row.querySelector('td.name');
      const setCell  = row.querySelector('td:nth-child(6)');
      const idCell   = row.querySelector('td:nth-child(4)');
      // Card ID is in the cell with link-product-card link
      const cardIdCell = row.querySelector('td a[href*="link-product-card"]')?.parentElement;
      if (!nameCell || !setCell || !idCell || !cardIdCell) { row._pmBtnsDone = true; continue; }

      const rawName = nameCell.textContent || '';
      const setFull = (setCell.textContent || '').trim();
      const cardId = (cardIdCell.textContent || '').trim();

      const { name, num } = PoroSearch.splitNameNum(rawName);
      const cleanName = PoroSearch.sanitize(name);

      const cardData = { name: cleanName, setFull: setFull, number: num, cardId: cardId };

      // Create all three buttons
      const { tcgButton, mcmButton } = await PoroSearch.createSearchButtons(cardData, {
        tcgText: 'TCG',
        mcmText: 'MCM',
        tcgClassName: 'pm-tcg-btn',
        mcmClassName: 'pm-mcm-btn',
        tcgStyle: BTN_STYLE,
        mcmStyle: BTN_STYLE
      });
      const tcgSellerButton = await PoroSearch.createTcgSellerButton(cardData, {
        text: 'TCGA',
        className: 'pm-tcgseller-btn',
        style: BTN_STYLE
      });

      // Spread one button per column: Hidden / Autohide / ID (skip the 🔥 column).
      // These cells have rowspan and exist only on a stock-record group's primary
      // row; fall back to the id cell if a target cell isn't present.
      const hiddenCell   = row.querySelector('td.product-hidden');
      const autohideCell = row.querySelector('td.autohide');
      (hiddenCell   || idCell).appendChild(tcgSellerButton); // TCGA → Hidden
      (autohideCell || idCell).appendChild(mcmButton);       // MCM  → Autohide
      idCell.appendChild(tcgButton);                          // TCG  → ID

      row._pmBtnsDone = true;

      // Pending auto-search after a filter: open tabs for the first valid card
      if (pendingAutoSearch && !autoSearchTriggered) {
        if (cardId === 'NO CARD') {
          if (DEBUG) console.log('[enhanceRows] Skipping NO CARD row');
          continue;
        }
        if (DEBUG) console.log('[enhanceRows] Auto-searching first valid card');
        pendingAutoSearch = false;
        autoSearchTriggered = true;
        await openAllTabs(cardData);
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

  // ----- filter form: open the tabs on submit -----
  document.getElementById('filterer')?.addEventListener('submit', () => {
    if (DEBUG) console.log('[Filter Submit] Setting auto-search flag');
    pendingAutoSearch = true;
  });
})();
