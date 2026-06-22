// ==UserScript==
// @name         Cardmarket → TCGP/TCGA Buttons on Single Card Product Page
// @namespace    cm-cart
// @version      2.0
// @description  Adds TCGP (product page) and TCGA (Seller Admin) buttons near the title of a Cardmarket single-card product page. Built on the shared PoroButtons engine.
// @match        https://www.cardmarket.com/*/Products/Singles/*
// @require      https://raw.githubusercontent.com/Gagihal/poroscripts-data/main/utils/poro-search-utils.js
// @updateURL    https://raw.githubusercontent.com/Gagihal/poroscripts-data/main/mcm-buy/mcm-product-tcg-buttons.user.js
// @downloadURL  https://raw.githubusercontent.com/Gagihal/poroscripts-data/main/mcm-buy/mcm-product-tcg-buttons.user.js
// @connect      raw.githubusercontent.com
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function () {
  "use strict";

  const BTN_STYLE = 'display:inline-block;font-size:12px;line-height:1.3;padding:4px 10px;border-radius:5px;border:1px solid #888;background:#1a1a1a;color:#fff;cursor:pointer;text-decoration:none;font-family:sans-serif;white-space:nowrap;';

  function getMcmId() {
    const input = document.querySelector('input[name="idProduct"]');
    if (input && input.value && /^\d+$/.test(input.value.trim())) return input.value.trim();
    const og = document.querySelector('meta[property="og:image"]');
    if (og) {
      const m = (og.getAttribute('content') || '').match(/cardmarket\.com\/\d+\/[A-Z]+\/(\d+)\/\d+\.jpg/);
      if (m) return m[1];
    }
    const link = document.querySelector('[href*="idProduct="], [data-bs-target*="idProduct="]');
    if (link) {
      const attr = link.getAttribute('href') || link.getAttribute('data-bs-target') || '';
      const m = attr.match(/idProduct=(\d+)/);
      if (m) return m[1];
    }
    return null;
  }
  function getName(h1) {
    if (!h1) return '';
    const raw = (h1.firstChild && h1.firstChild.textContent) || h1.textContent || '';
    const beforeParen = raw.indexOf('(') !== -1 ? raw.slice(0, raw.indexOf('(')) : raw;
    return PoroSearch.sanitize(beforeParen.trim());
  }
  function getNumber(h1) {
    if (!h1) return '';
    const raw = (h1.firstChild && h1.firstChild.textContent) || '';
    const m = raw.match(/\(([^)]*)\)\s*$/);
    if (!m) return '';
    const tokens = m[1].trim().split(/\s+/);
    return tokens[tokens.length - 1] || '';
  }
  function getSet() {
    const items = Array.prototype.slice.call(document.querySelectorAll('.breadcrumb .breadcrumb-item'));
    if (items.length >= 2) return (items[items.length - 2].textContent || '').trim();
    return '';
  }

  PoroButtons.enhance({
    items: 'self',
    observe: false, // SSR page — render once
    card: () => {
      const titleContainer = document.querySelector('.page-title-container');
      const h1 = titleContainer ? titleContainer.querySelector('h1') : document.querySelector('h1');
      if (!titleContainer || !h1) return null;
      const mcmId = getMcmId();
      return {
        id: mcmId ? { kind: 'mcm', value: mcmId } : null,
        name: getName(h1),
        setFull: getSet(),
        number: getNumber(h1),
      };
    },
    buttons: [{ TCG: 'TCGP' }, 'TCGA'],
    style: BTN_STYLE,
    bar: { gap: '8px', style: 'margin:6px 0 2px;' },
    place: (item, bar) => {
      if (document.getElementById('cm-product-tcg-buttons')) return;
      const tc = document.querySelector('.page-title-container');
      if (!tc) return;
      bar.id = 'cm-product-tcg-buttons';
      tc.insertAdjacentElement('afterend', bar);
    },
  });
})();
