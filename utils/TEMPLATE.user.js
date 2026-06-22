// ==UserScript==
// @name         Poromagia — <PAGE> buttons (TEMPLATE — copy me)
// @namespace    poroscripts
// @version      1.0
// @description  <what this adds, where>
// @match        https://<SITE>/<PATH>*
// @require      https://raw.githubusercontent.com/Gagihal/poroscripts-data/main/utils/poro-search-utils.js
// @updateURL    https://raw.githubusercontent.com/Gagihal/poroscripts-data/main/<DIR>/<FILE>.user.js
// @downloadURL  https://raw.githubusercontent.com/Gagihal/poroscripts-data/main/<DIR>/<FILE>.user.js
// @connect      raw.githubusercontent.com
// @run-at       document-idle
// @grant        none
// ==/UserScript==

// To add MCM / TCG / TCGA / PM buttons to a NEW spot, you usually only fill
// four fields below. The shared engine (PoroButtons, from poro-search-utils.js)
// handles id resolution, building the buttons, placement, dedupe and re-running
// on DOM/SPA changes.
//
// PoroButtons.enhance({
//   items, card, buttons, style, place, observe, spa
// })
//
//   items   : CSS selector for the rows | () => HTMLElement[] | 'self' (single-item page)
//   card    : (item) => ({ id:{kind,value}, name, setFull, number }) | null   // null = skip
//             kind ∈ 'poro' (the pokemon_card id) | 'mcm' | 'tcg' | 'parent' (catalogue parent product id)
//             name/setFull/number are only the search fallback (used when the id isn't mapped);
//             for the PM button, return an already-translated Poromagia setFull if needed.
//   buttons : registry keys in order — 'MCM' | 'TCG' | 'TCGA' | 'PM'
//             use {KIND:'label'} to relabel, e.g. [{TCG:'T'}, {TCGA:'A'}]
//   style   : 'inline' (compact M/T/A) | 'pill' (dark TCGP/PM) | 'block' (one per column) | raw cssText
//   place   : ONE of —
//               { after: '<selector inside item>' }        // bar right after that element
//               { append: '<selector inside item>' }       // bar appended into that element (default: the item)
//               { distribute: { TCGA:'<sel>', MCM:'<sel>', TCG:'<sel>' } }  // one button per target cell
//               { floating: 'bottom-right' | 'bottom-left' } // one fixed corner box (single-item pages)
//               (item, bar, built) => { ... }               // full custom control
//   observe : true (default) | '<container selector>' | false
//   spa     : true for client-routed pages (e.g. TCGplayer) so it re-runs on URL change

PoroButtons.enhance({
  items: '#some-table tbody tr',
  card: (row) => {
    const idEl = row.querySelector('input[name="card"]');
    if (!idEl) return null;
    return {
      id: { kind: 'poro', value: idEl.value },
      name: (row.querySelector('.name a') || {}).textContent || '',
      setFull: (row.querySelector('.set') || {}).textContent || '',
      number: (row.querySelector('.number') || {}).textContent || '',
    };
  },
  buttons: [{ TCG: 'T' }, { TCGA: 'A' }],
  style: 'inline',
  place: { after: '.name a' },
});
