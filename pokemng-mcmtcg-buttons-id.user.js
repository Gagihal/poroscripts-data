// ==UserScript==
// @name         Poromagia Store Manager — MCM/TCG buttons (ID-based direct links)
// @namespace    poroscripts
// @version      3.4
// @description  Adds MCM and TCG buttons using direct product ID links for MCM (with search fallback); reuses persistent named tabs. Automatic search uses first result's ID.
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

  // ----- Helper: get first row's card data after waiting for results -----
  async function getFirstRowCardData(timeoutMs = 5000) {
    return new Promise((resolve) => {
      const startTime = Date.now();

      // Function to extract card data from first row
      function extractFirstRow() {
        const firstRow = tbody.querySelector('tr');
        if (!firstRow) return null;

        const nameCell = firstRow.querySelector('td.name');
        const setCell = firstRow.querySelector('td:nth-child(6)');
        const cardIdCell = firstRow.querySelector('td a[href*="link-product-card"]')?.parentElement;

        if (nameCell && setCell && cardIdCell) {
          const rawName = nameCell.textContent || '';
          const setFull = (setCell.textContent || '').trim();
          const cardId = (cardIdCell.textContent || '').trim();
          const { name, num } = PoroSearch.splitNameNum(rawName);
          const cleanName = PoroSearch.sanitize(name);

          return {
            name: cleanName,
            setFull: setFull,
            number: num,
            cardId: cardId
          };
        }
        return null;
      }

      // Check if we already have a row
      const existing = extractFirstRow();
      if (existing) {
        resolve(existing);
        return;
      }

      // Set up timeout
      const timeoutId = setTimeout(() => {
        observer.disconnect();
        resolve(null);
      }, timeoutMs);

      // Watch for table mutations
      const observer = new MutationObserver(() => {
        const cardData = extractFirstRow();
        if (cardData) {
          clearTimeout(timeoutId);
          observer.disconnect();
          resolve(cardData);
        }
      });

      observer.observe(tbody, { childList: true, subtree: true });
    });
  }

  // ----- Helper: open MCM/TCG tabs using card data (with ID-based direct links) -----
  async function openSearchTabs(cardData) {
    // Try to get MCM and TCG IDs from the card data
    const mcmId = cardData.cardId ? await PoroSearch.getMcmId(cardData.cardId) : null;
    const tcgId = cardData.cardId ? await PoroSearch.getTcgId(cardData.cardId) : null;

    // Build URLs - direct if we have IDs, otherwise search
    let mcmURL, tcgURL;

    if (mcmId) {
      mcmURL = `https://www.cardmarket.com/en/Pokemon/Products/Singles/${mcmId}`;
    } else {
      // Fallback to search
      const mcmQ = PoroSearch.buildMcmQuery(cardData);
      mcmURL = `https://www.cardmarket.com/en/Pokemon/Products/Search?searchString=${encodeURIComponent(mcmQ)}`;
    }

    if (tcgId) {
      tcgURL = `https://www.tcgplayer.com/product/${tcgId}`;
    } else {
      // Fallback to search
      const tcgQ = PoroSearch.buildTcgQuery(cardData);
      tcgURL = `https://www.tcgplayer.com/search/pokemon/product?Language=English&ProductTypeName=Cards&productLineName=pokemon&q=${encodeURIComponent(tcgQ)}&view=grid`;
    }

    PoroSearch.openNamed(mcmURL, 'MCMWindow');
    PoroSearch.openNamed(tcgURL, 'TCGWindow');
  }

  // ----- toolbar: pre-open both tabs from current filter -----
  (function injectToolbarBtn(){
    const content = document.getElementById('content');
    if (!content) return;
    const btn = document.createElement('button');
    btn.textContent = 'OPEN MCM/TCG';
    btn.title = 'Open/reuse persistent tabs using first result\'s direct ID links (or search if no results).';
    btn.style.cssText = 'margin:8px 0;padding:2px 6px;border:1px solid #888;background:#eee;';
    btn.onclick = async () => {
      // Try to get first row's card data
      const cardData = await getFirstRowCardData();

      if (cardData) {
        // Use first row's data to open tabs with direct ID links
        await openSearchTabs(cardData);
      } else {
        // No results yet, fall back to name-based search from filter
        const raw = document.getElementById('id_name')?.value.trim() || '';
        const { name } = PoroSearch.splitNameNum(raw);
        const clean = PoroSearch.sanitize(name);

        const fallbackData = {
          name: clean,
          setFull: '',
          number: '',
          cardId: null
        };
        await openSearchTabs(fallbackData);
      }
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
  document.getElementById('filterer')?.addEventListener('submit', async (e) => {
    // Wait a moment for the form to submit and table to update, then open tabs
    setTimeout(async () => {
      const cardData = await getFirstRowCardData();

      if (cardData) {
        // Use first row's data to open tabs with direct ID links
        await openSearchTabs(cardData);
      } else {
        // No results, fall back to name-based search from filter
        const raw = document.getElementById('id_name')?.value.trim() || '';
        const { name } = PoroSearch.splitNameNum(raw);
        const clean = PoroSearch.sanitize(name);

        const fallbackData = {
          name: clean,
          setFull: '',
          number: '',
          cardId: null
        };
        await openSearchTabs(fallbackData);
      }
    }, 100); // Small delay to let form submit first
  });
})();
