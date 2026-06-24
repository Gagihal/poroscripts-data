// ==UserScript==
// @name         Poromagia Store Manager — MCM/TCG/TCGA buttons (ID-based direct links)
// @namespace    poroscripts
// @version      5.14
// @description  Adds MCM, TCG and TCGA buttons (one per column: Hidden / Autohide / ID) via the shared PoroButtons engine. Auto-opens the tabs on filter submit.
// @match        https://poromagia.com/store_manager/pokemon/*
// @require      https://raw.githubusercontent.com/Gagihal/poroscripts-data/main/utils/poro-search-utils.js
// @updateURL    https://raw.githubusercontent.com/Gagihal/poroscripts-data/main/pokemng/pokemng-mcmtcg-buttons-id.user.js
// @downloadURL  https://raw.githubusercontent.com/Gagihal/poroscripts-data/main/pokemng/pokemng-mcmtcg-buttons-id.user.js
// @connect      raw.githubusercontent.com
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  const DEBUG = false;
  const tbody = document.querySelector('#storemanager table tbody');
  if (!tbody) return;
  PoroSearch.preloadIdMap().catch(() => {});

  // Shared row extractor (used by both the buttons and the filter auto-open).
  function extract(row) {
    const nameCell = row.querySelector('td.name');
    const setCell  = row.querySelector('td:nth-child(6)');
    const idCell   = row.querySelector('td:nth-child(4)');
    const cardIdCell = (row.querySelector('td a[href*="link-product-card"]') || {}).parentElement;
    if (!nameCell || !setCell || !idCell || !cardIdCell) return null;
    const { name, num } = PoroSearch.splitNameNum(nameCell.textContent || '');
    return {
      cardId: (cardIdCell.textContent || '').trim(),
      name: PoroSearch.sanitize(name),
      setFull: (setCell.textContent || '').trim(),
      number: num,
    };
  }

  // ----- per-row buttons (shared engine), one per column, skipping the 🔥 column -----
  PoroButtons.enhance({
    items: '#storemanager table tbody tr',
    card: (row) => {
      const x = extract(row);
      if (!x) return null;
      return { id: { kind: 'poro', value: x.cardId }, name: x.name, setFull: x.setFull, number: x.number };
    },
    buttons: ['TCGA', 'MCM', 'TCG'],
    style: 'block',
    place: { distribute: { TCGA: 'td.product-hidden', MCM: 'td.autohide', TCG: 'td:nth-child(4)' } },
    observe: '#storemanager table tbody',
  });

  // ----- page-specific extra: open MCM + TCG + TCGA tabs for the first valid row after a filter -----
  async function openAllTabs(cardData) {
    const hasValidId = cardData.cardId && cardData.cardId !== '0' && cardData.cardId !== 0;
    const mcmDirectUrl = hasValidId ? await PoroSearch.buildMcmDirectUrl(cardData.cardId) : null;
    const tcgDirectUrl = hasValidId ? await PoroSearch.buildTcgDirectUrl(cardData.cardId) : null;
    const tcgId        = hasValidId ? await PoroSearch.getTcgId(cardData.cardId) : null;

    let mcmURL;
    if (mcmDirectUrl) { mcmURL = mcmDirectUrl; }
    else {
      const q = await PoroSearch.buildMcmQuery(cardData);
      mcmURL = `https://www.cardmarket.com/en/Pokemon/Products/Search?searchString=${encodeURIComponent(q.primary || q.backup || cardData.name)}`;
    }
    let tcgURL;
    if (tcgDirectUrl) { tcgURL = tcgDirectUrl; }
    else { tcgURL = `https://www.tcgplayer.com/search/pokemon/product?Language=English&ProductTypeName=Cards&productLineName=pokemon&q=${encodeURIComponent(PoroSearch.buildTcgQuery(cardData))}&view=grid`; }
    let sellerURL;
    if (tcgId && tcgId !== '0' && tcgId !== 0) { sellerURL = `https://store.tcgplayer.com/admin/product/manage/${tcgId}`; }
    else { sellerURL = `https://store.tcgplayer.com/admin/product/catalog?SearchValue=${encodeURIComponent(PoroSearch.buildTcgQuery(cardData))}`; }

    PoroSearch.openNamed(mcmURL, 'MCMWindow');
    PoroSearch.openNamed(tcgURL, 'TCGWindow');
    PoroSearch.openNamed(sellerURL, 'TCGSellerWindow');
  }

  let pendingAutoSearch = false, t = null;
  document.getElementById('filterer')?.addEventListener('submit', () => { pendingAutoSearch = true; });
  new MutationObserver(() => {
    if (!pendingAutoSearch) return;
    clearTimeout(t);
    t = setTimeout(() => {
      if (!pendingAutoSearch) return;
      for (const row of tbody.querySelectorAll('tr')) {
        const x = extract(row);
        if (x && x.cardId && x.cardId !== 'NO CARD') {
          pendingAutoSearch = false;
          openAllTabs({ name: x.name, setFull: x.setFull, number: x.number, cardId: x.cardId });
          break;
        }
      }
    }, 300);
  }).observe(tbody, { childList: true, subtree: true });
})();
