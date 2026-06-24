// ==UserScript==
// @name         Pokemon Creditor list — T/M/A buttons
// @namespace    poroscripts
// @version      3.1
// @description  Adds compact T (TCGplayer) / M (MCM) / A (TCGplayer Seller Admin) buttons after the Condition column on the admin creditor list. Built on the shared PoroButtons engine (combines the old T/M + A scripts).
// @match        https://poromagia.com/*/admin/pokemon/creditorderitem/*
// @require      https://raw.githubusercontent.com/Gagihal/poroscripts-data/main/utils/poro-search-utils.js
// @updateURL    https://raw.githubusercontent.com/Gagihal/poroscripts-data/main/pokecreditor/pokecreditor-mcmtcg-buttons.user.js
// @downloadURL  https://raw.githubusercontent.com/Gagihal/poroscripts-data/main/pokecreditor/pokecreditor-mcmtcg-buttons.user.js
// @connect      raw.githubusercontent.com
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  // Light "admin" button look (matches the Django admin theme).
  const BTN_STYLE = 'padding:1px 6px;border:1px solid #888;background:#eee;color:#000;border-radius:4px;font:11px system-ui,sans-serif;line-height:1.3;cursor:pointer;text-decoration:none;';

  PoroButtons.enhance({
    items: '#result_list tbody > tr',
    card: (row) => {
      if (!row.querySelector('td.field-condition')) return null;
      const rawName = (row.querySelector('th.field-card_name') || {}).textContent || '';
      const { name, num } = PoroSearch.splitNameNum(rawName);
      const identTxt = ((row.querySelector('td.field-card_identifier') || {}).textContent || '')
        .replace(/\u00A0/g, ' ').trim();
      const parts = identTxt.split(/–/).map((s) => s.trim()).filter(Boolean);
      const setFull = parts.length ? parts[parts.length - 1] : '';
      let number = '';
      const mHash = identTxt.match(/\(#\s*([A-Za-z]*\d+)\s*\)/);
      if (mHash) number = mHash[1];
      if (!number && num) number = num;
      const cardIdCell = row.querySelector('td.field-card_id');
      const cardId = cardIdCell ? cardIdCell.textContent.trim() : null;
      return {
        id: cardId ? { kind: 'poro', value: cardId } : null,
        name: PoroSearch.sanitize(name || rawName),
        setFull,
        number,
      };
    },
    buttons: [{ TCG: 'T' }, { MCM: 'M' }, { TCGA: 'A' }],
    style: BTN_STYLE,
    place: (row, bar) => {
      const condCell = row.querySelector('td.field-condition');
      if (!condCell) return;
      const idx = Array.prototype.indexOf.call(row.children, condCell);
      const cell = row.insertCell(idx + 1);
      cell.style.whiteSpace = 'nowrap';
      cell.appendChild(bar);
    },
    observe: true,
  });
})();
