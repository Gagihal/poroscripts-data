// ==UserScript==
// @name         Poromagia Pokémon Credit list — MCM/TCG/TCGA buttons
// @namespace    poroscripts
// @version      1.0
// @description  Adds MCM, TCG and TCGA buttons to each card row on the Pokémon credit (buylist) page, under the card name. Direct product links via ID mapping, search fallback otherwise.
// @match        https://poromagia.com/*pokemon_credit*
// @require      https://raw.githubusercontent.com/Gagihal/poroscripts-data/main/utils/poro-search-utils.js
// @updateURL    https://raw.githubusercontent.com/Gagihal/poroscripts-data/main/pokecreditor/pokemon-credit-list-buttons.user.js
// @downloadURL  https://raw.githubusercontent.com/Gagihal/poroscripts-data/main/pokecreditor/pokemon-credit-list-buttons.user.js
// @connect      raw.githubusercontent.com
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(async function () {
  'use strict';

  PoroSearch.preloadIdMap().catch(() => {});

  // Same small style as the store-manager buttons (v5.12). The helpers add a
  // coloured left-border direct-link indicator on top of this.
  const BTN_STYLE = 'display:inline-block;margin:0;padding:2px 7px;font-size:10px;line-height:1.35;';

  // The credit row's `item` IS the pokemon_card, so item.id is the Poro card id
  // (the key product-id-map-v2.json uses). It lives in the quickcredit form's
  // hidden card input; fall back to the staff admin-card link.
  function getCardId(row) {
    const input = row.querySelector('td.quickcredit input[name="card"]');
    if (input && input.value && /^\d+$/.test(input.value.trim())) return input.value.trim();
    const link = row.querySelector('td.collector_number a[href*="/admin/pokemon/card/"]');
    if (link) {
      const m = (link.getAttribute('href') || '').match(/\/admin\/pokemon\/card\/(\d+)\//);
      if (m) return m[1];
    }
    return null;
  }

  function cellText(row, sel) {
    const cell = row.querySelector(sel);
    if (!cell) return '';
    const a = cell.querySelector('a');
    return ((a ? a.textContent : cell.textContent) || '').trim();
  }

  async function enhanceRow(row) {
    if (row._pmCreditBtnsDone) return;
    row._pmCreditBtnsDone = true;

    const nameCell = row.querySelector('td.link');
    if (!nameCell) return;

    const cardId = getCardId(row);
    const rawName = cellText(row, 'td.link');
    const setFull = cellText(row, 'td.set');
    const numberTxt = cellText(row, 'td.collector_number');

    const { name } = PoroSearch.splitNameNum(rawName);
    const cardData = {
      name: PoroSearch.sanitize(name || rawName),
      setFull: setFull,
      number: numberTxt,
      cardId: cardId
    };

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

    const bar = document.createElement('div');
    bar.className = 'poro-credit-btns';
    bar.style.cssText = 'display:flex;flex-wrap:wrap;gap:4px;margin-top:4px;justify-content:center;';
    bar.appendChild(tcgSellerButton); // TCGA
    bar.appendChild(mcmButton);       // MCM
    bar.appendChild(tcgButton);       // TCG
    nameCell.appendChild(bar);
  }

  function scanAll() {
    const rows = document.querySelectorAll('#item-list tbody tr[class^="pokemon-credit-table-row"]');
    rows.forEach((r) => { enhanceRow(r); });
  }

  scanAll();

  // DataTables redraws the tbody on filter / pagination — re-enhance new rows.
  const tbody = document.querySelector('#item-list tbody');
  if (tbody) {
    let t = null;
    new MutationObserver(() => { clearTimeout(t); t = setTimeout(scanAll, 200); })
      .observe(tbody, { childList: true, subtree: true });
  }
})();
