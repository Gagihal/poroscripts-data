// ==UserScript==
// @name         Poromagia Store Manager — Add to Kassa cart
// @namespace    poroscripts
// @version      1.0
// @description  Adds a "→ Kassa" button under the PrAlert column that adds the card to the in-store Kassa (POS) cart. Separate from the site-basket "Add 1" button.
// @match        https://poromagia.com/store_manager/pokemon/*
// @updateURL    https://raw.githubusercontent.com/Gagihal/poroscripts-data/main/pokemng/pokemng-kassa-add.user.js
// @downloadURL  https://raw.githubusercontent.com/Gagihal/poroscripts-data/main/pokemng/pokemng-kassa-add.user.js
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  const tbody = document.querySelector('#storemanager table tbody');
  if (!tbody) return;

  const BTN_STYLE = 'display:block;margin:3px auto 0;padding:1px 6px;font-size:10px;line-height:1.3;cursor:pointer;white-space:nowrap;';

  function getCSRF() {
    const m = document.cookie.match(/csrftoken=([^;]+)/);
    return m ? m[1] : null;
  }

  // Read the product id from the ID cell's anchor (text is the clean id, so a
  // sibling TCG/MCM button in that cell can't corrupt it).
  function pidOf(row) {
    const idCell = row.querySelector('td.product-image-on-hover') || row.querySelector('td:nth-child(4)');
    if (!idCell) return null;
    const a = idCell.querySelector('a');
    const txt = ((a ? a.textContent : idCell.textContent) || '').trim();
    return /^\d+$/.test(txt) ? txt : null;
  }

  function enhance() {
    for (const row of tbody.querySelectorAll('tr')) {
      if (row._kassaBtnDone) continue;
      const cell = row.querySelector('td.product_alerts'); // the PrAlert column (primary rows only)
      const pid = pidOf(row);
      if (!cell || !pid) { row._kassaBtnDone = true; continue; }
      row._kassaBtnDone = true;

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = '→ Kassa';
      btn.title = 'Add to the in-store Kassa (POS) cart';
      btn.style.cssText = BTN_STYLE;
      btn.addEventListener('click', async () => {
        const csrf = getCSRF();
        if (!csrf) { alert('CSRF token missing'); return; }
        const old = btn.textContent;
        btn.disabled = true;
        btn.textContent = '…';
        try {
          const body = new URLSearchParams();
          body.set('csrfmiddlewaretoken', csrf);
          body.set('quantity-' + pid, '1'); // kassa_add collects quantity-<productId> keys
          const r = await fetch('/store_manager/kassa/add/', {
            method: 'POST',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
              'X-Requested-With': 'XMLHttpRequest',
            },
            body: body.toString(),
          });
          btn.disabled = false;
          if (r.ok) {
            btn.textContent = '✓';
            setTimeout(() => { btn.textContent = old; }, 1200);
          } else {
            // most likely cause: card not stocked at the active kassa partner
            btn.textContent = '✗ ' + r.status;
            setTimeout(() => { btn.textContent = old; }, 2500);
          }
        } catch (e) {
          btn.disabled = false;
          btn.textContent = '✗';
          setTimeout(() => { btn.textContent = old; }, 2500);
        }
      });
      cell.appendChild(btn);
    }
  }

  enhance();
  new MutationObserver(enhance).observe(tbody, { childList: true, subtree: true });
})();
