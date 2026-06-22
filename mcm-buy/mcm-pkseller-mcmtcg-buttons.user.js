// ==UserScript==
// @name         Cardmarket → Quick Links for Pokemon Sellers (TCGP + TCGA + PM)
// @namespace    cm-links
// @version      3.0
// @description  Adds TCGP, TCGA and PM buttons next to each card name on a seller's Singles page. Built on the shared PoroButtons engine.
// @match        https://www.cardmarket.com/*/Pokemon/Users/*/Offers/Singles*
// @require      https://raw.githubusercontent.com/Gagihal/poroscripts-data/main/utils/poro-search-utils.js
// @updateURL    https://raw.githubusercontent.com/Gagihal/poroscripts-data/main/mcm-buy/mcm-pkseller-mcmtcg-buttons.user.js
// @downloadURL  https://raw.githubusercontent.com/Gagihal/poroscripts-data/main/mcm-buy/mcm-pkseller-mcmtcg-buttons.user.js
// @connect      raw.githubusercontent.com
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(async function () {
  "use strict";

  const PILL_STYLE = 'display:inline-block;font-size:10px;line-height:1.2;padding:2px 4px;border-radius:4px;border:1px solid #888;background:#1a1a1a;color:#fff;cursor:pointer;text-decoration:none;font-family:sans-serif;white-space:nowrap;';

  // MCM set name -> Poromagia set name (only the PM button needs the translated name).
  const SETMAP_URL = 'https://raw.githubusercontent.com/Gagihal/poroscripts-data/main/utils/mcm-to-poromagia-setmap.json';
  const SETMAP_CACHE_KEY = 'mcm_poro_setmap';
  const SETMAP_CACHE_TS_KEY = 'mcm_poro_setmap_ts';
  const SETMAP_CACHE_MS = 7 * 24 * 3600 * 1000;
  let setMap = null;
  async function loadSetMap() {
    try {
      const ts = parseInt(localStorage.getItem(SETMAP_CACHE_TS_KEY) || '0', 10);
      if (ts && Date.now() - ts < SETMAP_CACHE_MS) {
        const cached = localStorage.getItem(SETMAP_CACHE_KEY);
        if (cached) { setMap = JSON.parse(cached); return; }
      }
    } catch (e) {}
    try {
      const r = await fetch(SETMAP_URL);
      if (r.ok) {
        setMap = await r.json();
        try {
          localStorage.setItem(SETMAP_CACHE_KEY, JSON.stringify(setMap));
          localStorage.setItem(SETMAP_CACHE_TS_KEY, String(Date.now()));
        } catch (e) {}
      }
    } catch (e) { console.warn('[MCM-Buy] set map load failed:', e); }
    if (!setMap) setMap = {};
  }
  const mapSet = (s) => (setMap && s && setMap[s]) || s;

  await loadSetMap();

  PoroButtons.enhance({
    items: '#UserOffersTable .article-row',
    card: (row) => {
      const nameAnchor = row.querySelector(".col-seller a[href*='/Pokemon/Products/Singles']");
      if (!nameAnchor) return null;
      const full = nameAnchor.textContent || '';
      const beforeParen = full.indexOf('(') !== -1 ? full.slice(0, full.indexOf('(')).trim() : full.trim();
      const { name } = PoroSearch.splitNameNum(beforeParen);
      const setName = (row.querySelector('.product-attributes a.expansion-symbol[title]') || {}).title || '';
      let mcmId = null;
      const tip = row.querySelector('[data-bs-title]');
      if (tip) {
        const m = (tip.getAttribute('data-bs-title') || '').match(/cardmarket\.com\/\d+\/[A-Z]+\/(\d+)\/\d+\.jpg/);
        if (m) mcmId = m[1];
      }
      return {
        id: mcmId ? { kind: 'mcm', value: mcmId } : null,
        name: PoroSearch.sanitize(name),
        setFull: (setName || '').trim(),
        pmSet: mapSet((setName || '').trim()), // for the PM button only
      };
    },
    buttons: [
      { TCG: 'TCGP' },
      'TCGA',
      { kind: 'PM', text: 'PM', card: (b) => ({ name: b.name, setFull: b.pmSet || b.setFull }) },
    ],
    style: PILL_STYLE,
    bar: { style: 'margin-left:auto;' },
    place: (row, bar) => {
      const cell = row.querySelector('.col-seller');
      if (!cell) return;
      cell.style.display = 'flex';
      cell.style.justifyContent = 'space-between';
      cell.style.alignItems = 'center';
      cell.appendChild(bar);
    },
    observe: '#UserOffersTable',
  });
})();
