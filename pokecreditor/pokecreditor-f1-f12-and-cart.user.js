// ==UserScript==
// @name         Poromagia Pokemon Creditor — F1-F12 Quick Add & Cart Dock
// @namespace    poroscripts
// @version      1.1
// @description  F1-F12 quick-add, docked cart panel with a "Last card added" readout, smart filter splitting, F-key annotations, and column customization
// @match        https://poromagia.com/pokemon_credit/*
// @updateURL    https://raw.githubusercontent.com/Gagihal/poroscripts-data/main/pokecreditor/pokecreditor-f1-f12-and-cart.user.js
// @downloadURL  https://raw.githubusercontent.com/Gagihal/poroscripts-data/main/pokecreditor/pokecreditor-f1-f12-and-cart.user.js
// @grant        none
// ==/UserScript==
(function(){
  'use strict';

  //
  // 1) F-Key → Quick-add rows 1–12
  //
  document.addEventListener('keydown', function(e) {
    if (e.altKey||e.ctrlKey||e.metaKey||e.shiftKey) return;
    let m = /^F(\d+)$/.exec(e.key);
    if (!m) return;
    let idx = parseInt(m[1],10) - 1;
    let rows = Array.from(document.querySelectorAll('#item-list tbody tr'));
    if (idx < 0 || idx >= rows.length) return;
    let btn = rows[idx].querySelector('input[type="submit"][value="Lisää koriin"]');
    if (btn) {
      btn.click();
      e.preventDefault();
    }
  });

  //
  // 2) Dock & style the cart panel at the bottom
  //
  function dockCart() {
    let panel = document.querySelector('#cart > table');
    if (!panel) return;
    Object.assign(panel.style, {
      position:       'fixed',
      top:            'auto',
      bottom:         '0',
      left:           '0',
      width:          '100%',
      maxHeight:      '25vh',
      overflowY:      'auto',
      display:        'block',
      zIndex:         '9999',
      backgroundColor:'#fff',
      boxShadow:      '0 -2px 8px rgba(0,0,0,0.2)'
    });
    if (!document.getElementById('tm-dockcart-styles')) {
      let css = document.createElement('style');
      css.id = 'tm-dockcart-styles';
      css.textContent = `
        /* always show the cart table */
        #cart > table { visibility: visible !important; opacity: 1 !important; top: auto !important; bottom: 0 !important; }
        /* make room so content doesn't hide behind the bar */
        #content-wrapper { padding-bottom: 26vh !important; }
      `;
      document.head.appendChild(css);
    }
  }
  window.addEventListener('load', dockCart);
  new MutationObserver(dockCart).observe(document.body, { childList:true, subtree:true });

  //
  // 3) Smart-split trailing digits on Filter submit
  //
  function hookFilterSplit() {
    let form = document.getElementById('filter');
    if (!form || form._splitHooked) return;
    form._splitHooked = true;
    form.addEventListener('submit', function(e) {
      let nameField = document.getElementById('card-name');
      let numField  = document.getElementById('card-number');
      let txt = nameField.value.trim();
      let m = /^(.*?)(\d+)$/.exec(txt);
      if (m) {
        nameField.value = m[1];
        numField.value  = m[2];
      }
      // otherwise do nothing
    });
  }
  window.addEventListener('load', hookFilterSplit);
  new MutationObserver(hookFilterSplit).observe(document.body, { childList:true, subtree:true });

})();


// 4) Annotate each row with its F-key number
function annotateFKeys() {
  const rows = document.querySelectorAll('#item-list tbody tr');
  rows.forEach((row, i) => {
    // only insert once
    if (row.querySelector('.fkey-hint')) return;

    // make a <td> at the very front
    const hintTd = document.createElement('td');
    hintTd.className = 'fkey-hint';
    hintTd.textContent = 'F' + (i+1);
    hintTd.style.cssText = 'font-weight:bold; padding-right:0.5em;';

    // insert it before the first cell
    row.insertBefore(hintTd, row.firstElementChild);
  });

  // also insert a header cell so the columns line up
  const header = document.querySelector('#item-list thead tr');
  if (header && !header.querySelector('.fkey-hint')) {
    const th = document.createElement('th');
    th.className = 'fkey-hint';
    th.textContent = 'F';
    header.insertBefore(th, header.firstElementChild);
  }
}

// run once on load…
window.addEventListener('load', annotateFKeys);
// …and anytime the table changes (e.g. after filter)
new MutationObserver(annotateFKeys)
  .observe(document.querySelector('#item-list tbody'), {
    childList: true, subtree: true
  });


// —————————————————————————
// Rename your table’s column headers
// —————————————————————————
function renameHeaders() {
  const map = {
    'Numero':         'Nr',
    'Setti':          'Set',
    'Amount needed':  'Inv (d)',
    'Price':          'PKr',
    'Myyntihinta':    '€'
  };
  document
    .querySelectorAll('#item-list thead th')
    .forEach(th => {
      const txt = th.textContent.trim();
      if (map[txt]) th.textContent = map[txt];
    });
}

// run once on page load
window.addEventListener('load', renameHeaders);

// watch for any header re-render (e.g. by DataTables)
const thead = document.querySelector('#item-list thead');
if (thead) {
  new MutationObserver(renameHeaders)
    .observe(thead, { childList: true, subtree: true });
}

// ————————————————————————
// Tweak widths of Nr, Inv (d), PKr and € columns
// ————————————————————————
;(function(){
  const css = `
    /* Nr = 4th col, Inv (d) = 8th, PKr = 9th, € = 10th */
    #item-list th:nth-child(4),
    #item-list td:nth-child(4),
    #item-list th:nth-child(8),
    #item-list td:nth-child(8),
    #item-list th:nth-child(9),
    #item-list td:nth-child(9),
    #item-list th:nth-child(10),
    #item-list td:nth-child(10) {
      min-width: 60px;

    }
  `;
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);
})();


// —————————————————————————
// "Last card added" readout, pinned to the empty right side of the cart dock
// —————————————————————————
;(function(){
  'use strict';
  const KEY = 'poro_credit_last_added';

  function ensureBox() {
    let box = document.getElementById('poro-last-added');
    if (!box) {
      box = document.createElement('div');
      box.id = 'poro-last-added';
      box.style.cssText = [
        'position:fixed', 'right:7vw', 'bottom:0', 'height:25vh',
        'display:flex', 'align-items:center', 'justify-content:flex-end',
        'text-align:right', 'max-width:60vw', 'z-index:10000',
        'pointer-events:none', 'font-family:sans-serif', 'font-weight:800',
        'font-size:36px', 'line-height:1.2', 'color:#222'
      ].join(';');
      document.body.appendChild(box);
    }
    return box;
  }

  function render() {
    let data = null;
    try { data = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) {}
    const box = ensureBox();
    if (!data) { box.textContent = ''; return; }
    const amt = data.amount ? (' ×' + data.amount) : '';
    box.textContent = 'Last card added: ' + [data.card, data.condition].filter(Boolean).join(' ') + amt;
  }

  function captureAdd(form) {
    const val = (sel) => { const el = form.querySelector(sel); return el ? (el.value || '').trim() : ''; };
    const name = val('input[name="name"]');
    const condition = val('input[name="condition"]');
    const amount = val('input[name="count"]');
    const row = form.closest('tr');
    const numCell = row && row.querySelector('td.collector_number');
    const num = numCell ? (numCell.textContent || '').trim() : '';
    const card = num ? (name + ' ' + num) : name;
    try { localStorage.setItem(KEY, JSON.stringify({ card, condition, amount })); } catch (e) {}
    render();
  }

  // Capture-phase submit: catches manual "Lisää koriin" clicks, F-key adds
  // (btn.click → submit) and add-all (jQuery .submit() trigger). A credit add
  // form is identified by its card + count inputs (excludes the filter form).
  document.addEventListener('submit', function (e) {
    const form = e.target;
    if (form && form.querySelector &&
        form.querySelector('input[name="card"]') &&
        form.querySelector('input[name="count"]')) {
      captureAdd(form);
    }
  }, true);

  window.addEventListener('load', render);
})();
