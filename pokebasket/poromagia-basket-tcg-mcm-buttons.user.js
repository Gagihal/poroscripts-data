// ==UserScript==
// @name         Poromagia Basket → TCG / TCGA / MCM buttons
// @namespace    poroscripts
// @version      2.0
// @description  Adds TCG (TCGplayer product), TCGA (Seller Admin) and MCM (Cardmarket) buttons to each card row in the poromagia.com basket. Built on the shared PoroButtons engine ('parent' product id resolution).
// @match        https://poromagia.com/*/basket/*
// @require      https://raw.githubusercontent.com/Gagihal/poroscripts-data/main/utils/poro-search-utils.js
// @updateURL    https://raw.githubusercontent.com/Gagihal/poroscripts-data/main/pokebasket/poromagia-basket-tcg-mcm-buttons.user.js
// @downloadURL  https://raw.githubusercontent.com/Gagihal/poroscripts-data/main/pokebasket/poromagia-basket-tcg-mcm-buttons.user.js
// @connect      raw.githubusercontent.com
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function () {
  "use strict";

  const PILL_STYLE = 'display:inline-block;font-size:11px;line-height:1.2;padding:2px 7px;border-radius:4px;border:1px solid #888;background:#1a1a1a;color:#fff;cursor:pointer;text-decoration:none;font-family:sans-serif;white-space:nowrap;';

  PoroButtons.enhance({
    // basket line rows carry a catalogue link + an h4 title
    items: () => Array.prototype.slice.call(document.querySelectorAll('#basket_formset .row, .basket-items .row'))
      .filter((r) => r.querySelector('a[href*="/catalogue/"]') && r.querySelector('h4')),
    card: (row) => {
      const link = row.querySelector('a[href*="/catalogue/"]');
      const m = link && (link.getAttribute('href') || '').match(/_(\d+)\/?$/);
      const parentId = m ? m[1] : null;        // parent catalogue product id (the basket's id)
      const h4 = row.querySelector('h4');
      const title = (h4 ? h4.textContent : '').trim().replace(/\s*\(\d+\)\s*/, ' '); // drop (childId)
      const parts = title.split(' - ');
      const sn = PoroSearch.splitNameNum(parts[0] || '');
      if (!sn.name) return null;
      return {
        id: parentId ? { kind: 'parent', value: parentId } : null,
        name: PoroSearch.sanitize(sn.name),
        setFull: parts.length >= 2 ? parts[1].trim() : '',
        number: sn.num,
      };
    },
    buttons: ['TCG', 'TCGA', 'MCM'],
    style: PILL_STYLE,
    bar: { style: 'display:flex;flex-wrap:wrap;margin-top:4px;' },
    place: { append: '.col-sm-4' },
  });
})();
