// ==UserScript==
// @name         Poromagia Pokémon Credit list — TCG/TCGA buttons
// @namespace    poroscripts
// @version      2.0
// @description  Adds compact T / A buttons (TCGplayer + Seller Admin) inline after each card name on the Pokémon credit (buylist) page. The name itself already links to Cardmarket. Built on the shared PoroButtons engine.
// @match        https://poromagia.com/*pokemon_credit*
// @require      https://raw.githubusercontent.com/Gagihal/poroscripts-data/main/utils/poro-search-utils.js
// @updateURL    https://raw.githubusercontent.com/Gagihal/poroscripts-data/main/pokecreditor/pokemon-credit-list-buttons.user.js
// @downloadURL  https://raw.githubusercontent.com/Gagihal/poroscripts-data/main/pokecreditor/pokemon-credit-list-buttons.user.js
// @connect      raw.githubusercontent.com
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  PoroButtons.enhance({
    items: '#item-list tbody tr[class^="pokemon-credit-table-row"]',
    card: (row) => {
      // The credit row's item IS the pokemon_card -> its id is the Poro card id.
      const idEl = row.querySelector('td.quickcredit input[name="card"]');
      let cardId = idEl && /^\d+$/.test((idEl.value || '').trim()) ? idEl.value.trim() : null;
      if (!cardId) {
        const link = row.querySelector('td.collector_number a[href*="/admin/pokemon/card/"]');
        const m = link && (link.getAttribute('href') || '').match(/\/admin\/pokemon\/card\/(\d+)\//);
        cardId = m ? m[1] : null;
      }
      const a = row.querySelector('td.link a') || row.querySelector('td.link');
      const rawName = ((a || {}).textContent || '').trim();
      const { name } = PoroSearch.splitNameNum(rawName);
      return {
        id: cardId ? { kind: 'poro', value: cardId } : null,
        name: PoroSearch.sanitize(name || rawName),
        setFull: ((row.querySelector('td.set a') || row.querySelector('td.set') || {}).textContent || '').trim(),
        number: ((row.querySelector('td.collector_number a') || row.querySelector('td.collector_number') || {}).textContent || '').trim(),
      };
    },
    buttons: [{ TCG: 'T' }, { TCGA: 'A' }],
    // preserve the exact tuned look from v1.2 (9px inline pills)
    style: 'display:inline-block;margin:0 0 0 4px;padding:0 5px;font-size:9px;line-height:1.4;vertical-align:middle;',
    place: { after: 'td.link a' },
    observe: '#item-list tbody',
  });
})();
