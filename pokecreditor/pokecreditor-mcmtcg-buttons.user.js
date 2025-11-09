// ==UserScript==
// @name         Pokemon Creditor list — tiny T/M buttons (with MCM set-abbrev)
// @namespace    poroscripts
// @version      2.7
// @description  Add compact T (TCGplayer) and M (MCM) buttons after Condition on the creditor list (handles ID 0 gracefully).
// @match        https://poromagia.com/*/admin/pokemon/creditorderitem/*
// @require      https://raw.githubusercontent.com/Gagihal/poroscripts-data/main/utils/poro-search-utils.js
// @updateURL    https://raw.githubusercontent.com/Gagihal/poroscripts-data/main/pokecreditor/pokecreditor-mcmtcg-buttons.user.js
// @downloadURL  https://raw.githubusercontent.com/Gagihal/poroscripts-data/main/pokecreditor/pokecreditor-mcmtcg-buttons.user.js
// @connect      raw.githubusercontent.com
// @grant        none
// ==/UserScript==

(async function () {
  'use strict';

  // Preload ID mapping
  PoroSearch.preloadIdMap().catch(() => {});

  /* ---------- UI styles ---------- */
  (function injectStyles(){
    const css = `
      .pm-tm-cell { white-space: nowrap; }
      .pm-tm-wrap { display:flex; gap:4px; align-items:center; }
      .pm-tm-btn {
        padding: 1px 6px; border: 1px solid #888; background: #eee;
        border-radius: 4px; font: 11px system-ui, sans-serif; line-height: 1.3; cursor: pointer;
      }
      .pm-tm-btn:active { transform: translateY(1px); }
      @media (max-width: 900px){ .pm-tm-btn { padding: 1px 5px; font-size: 10px; } }
    `;
    const s = document.createElement('style'); s.textContent = css; document.head.appendChild(s);
  })();

  /* ---------- wait for DOM ---------- */
  function waitForTable() {
    return new Promise((resolve) => {
      const check = () => {
        const table = document.querySelector('#result_list');
        if (table && table.tBodies[0]) {
          resolve(table);
        } else {
          requestAnimationFrame(check);
        }
      };
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', check);
      } else {
        check();
      }
    });
  }

  /* ---------- parse card data from row ---------- */
  function parseCardData(row){
    // name from first column
    const rawName = row.querySelector('th.field-card_name')?.textContent || '';
    const { name, num: numFromName } = PoroSearch.splitNameNum(rawName);
    const cleanName = PoroSearch.sanitize(name || rawName);

    // identifier like: "(#079) – Ultra Rare – X&Y Steam Siege"
    const identTxt = (row.querySelector('td.field-card_identifier')?.textContent || '').replace(/\u00A0/g,' ').trim();
    const parts = identTxt.split(/–/).map(s=>s.trim()).filter(Boolean);
    const setFull = parts.length ? parts[parts.length - 1] : '';

    // number: prefer (#xxx) in identifier; fallback to number inside name
    let number = '';
    const mHash = identTxt.match(/\(#\s*([A-Za-z]*\d+)\s*\)/);
    if (mHash) number = mHash[1];
    if (!number && numFromName) number = numFromName;

    // card ID
    const cardIdCell = row.querySelector('td.field-card_id');
    const cardId = cardIdCell ? cardIdCell.textContent.trim() : null;

    return { name: cleanName, setFull, number, cardId };
  }

  /* ---------- main ---------- */
  const table = await waitForTable();

  async function enhance(){
    const rows = table.querySelectorAll('tbody > tr');

    for (const row of rows){
      if (row._pmTinyDone) continue;

      const condCell = row.querySelector('td.field-condition');
      if (!condCell) continue;

      // Insert new cell after condition
      const allTds = Array.from(row.children);
      const condIdx = allTds.indexOf(condCell);
      const newCell = row.insertCell(condIdx + 1);
      newCell.className = 'pm-tm-cell';

      const holder = document.createElement('div');
      holder.className = 'pm-tm-wrap';
      newCell.appendChild(holder);

      // Parse card data
      const cardData = parseCardData(row);

      // Use the new utility to create both buttons
      const { tcgButton, mcmButton } = await PoroSearch.createSearchButtons(cardData, {
        tcgText: 'T',
        mcmText: 'M',
        tcgClassName: 'pm-tm-btn',
        mcmClassName: 'pm-tm-btn'
      });

      holder.append(tcgButton, mcmButton);
      row._pmTinyDone = true;
    }
  }

  let enhancing = false;
  async function safeEnhance(){
    if (enhancing) return;
    enhancing = true;
    try { await enhance(); } finally { enhancing = false; }
  }

  await safeEnhance();
  new MutationObserver(() => { safeEnhance(); })
    .observe(table.tBodies[0], { childList:true, subtree:true });
})();
