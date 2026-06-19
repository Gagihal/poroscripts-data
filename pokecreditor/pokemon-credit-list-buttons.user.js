// ==UserScript==
// @name         Poromagia Pokémon Credit list — TCG/TCGA buttons
// @namespace    poroscripts
// @version      1.2
// @description  Adds compact T / A buttons (TCGplayer + Seller Admin) inline after each card name on the Pokémon credit (buylist) page. The name itself already links to Cardmarket. Direct links via ID mapping, search fallback otherwise.
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

  // Compact inline pills placed right after the card name (so the row doesn't
  // grow taller). The helpers add a coloured left-border direct-link indicator.
  const BTN_STYLE = 'display:inline-block;margin:0 0 0 4px;padding:0 5px;font-size:9px;line-height:1.4;vertical-align:middle;';

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

    const tcgButton = await PoroSearch.createTcgButton(cardData, {
      text: 'T',
      className: 'pm-tcg-btn',
      style: BTN_STYLE
    });
    const tcgSellerButton = await PoroSearch.createTcgSellerButton(cardData, {
      text: 'A',
      className: 'pm-tcgseller-btn',
      style: BTN_STYLE
    });

    // Inline, straight after the card name in T / A order — keeps row height.
    // (No M: the card name itself already links to Cardmarket for staff.)
    const ordered = [tcgButton, tcgSellerButton];
    const anchor = nameCell.querySelector('a');
    if (anchor) {
      let ref = anchor;
      for (const b of ordered) { ref.insertAdjacentElement('afterend', b); ref = b; }
    } else {
      ordered.forEach((b) => nameCell.appendChild(b));
    }
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
