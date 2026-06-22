// ==UserScript==
// @name         Cardmarket → TCGP/TCGA Buttons on Shopping Cart
// @namespace    cm-cart
// @version      2.0
// @description  Adds TCGP (product page) and TCGA (Seller Admin) buttons to each card row in the Cardmarket shopping cart. Built on the shared PoroButtons engine.
// @match        https://www.cardmarket.com/*/ShoppingCart*
// @require      https://raw.githubusercontent.com/Gagihal/poroscripts-data/main/utils/poro-search-utils.js
// @updateURL    https://raw.githubusercontent.com/Gagihal/poroscripts-data/main/mcm-buy/mcm-cart-tcg-buttons.user.js
// @downloadURL  https://raw.githubusercontent.com/Gagihal/poroscripts-data/main/mcm-buy/mcm-cart-tcg-buttons.user.js
// @connect      raw.githubusercontent.com
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function () {
  "use strict";

  const PILL_STYLE = 'display:inline-block;font-size:10px;line-height:1.2;padding:2px 4px;border-radius:4px;border:1px solid #888;background:#1a1a1a;color:#fff;cursor:pointer;text-decoration:none;font-family:sans-serif;white-space:nowrap;';

  PoroButtons.enhance({
    items: 'tr[data-product-id]',
    card: (row) => {
      const mcmId = row.dataset.productId;
      const name = (row.dataset.name || '').trim();
      if (!mcmId || !name) return null;
      return {
        id: { kind: 'mcm', value: mcmId },
        name: PoroSearch.sanitize(name),
        setFull: (row.dataset.expansionName || '').trim(),
        number: (row.dataset.number || '').trim(),
      };
    },
    buttons: [{ TCG: 'TCGP' }, 'TCGA'],
    style: PILL_STYLE,
    bar: { style: 'margin-left:auto;' },
    place: (row, bar) => {
      const cell = row.querySelector('td.name') || row.querySelector('td.info .text-start');
      if (!cell) return;
      cell.style.display = 'flex';
      cell.style.justifyContent = 'space-between';
      cell.style.alignItems = 'center';
      cell.appendChild(bar);
    },
  });
})();
