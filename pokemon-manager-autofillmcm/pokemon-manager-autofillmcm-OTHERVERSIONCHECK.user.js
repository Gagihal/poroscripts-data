// ==UserScript==
// @name         Pokémon Manager ➜ MCM Sell-button (postMessage v0.6) OLD
// @namespace    https://poromagia.com/
// @version      0.6
// @description  Adds a “Sell” button that opens Cardmarket and postMessages the form data.
// @match        https://poromagia.com/store_manager/pokemon/*
// @grant        none
// ==/UserScript==

(async function () {
  'use strict';

  /* ───────────────────── 0) helpers ───────────────────── */

  const MAP_URL = 'https://raw.githubusercontent.com/gagihal/poroscripts-data/main/mcmsetmap.json';
  const PREF_RE = /^(tg|gg|rc|sv|h|sl|sh)\d+/i;
  const COND_MAP = { 'NM/M':2,'EX':3,'GD':4,'LP':5,'PL':6,'DMG':7 };
  const IGNORE   = new Set(['full','art','secret','rare','hyper',
                            'alternative','alternate','reverse','holo','bs']);

  /* 0a – load the set-code map once */
  const abbr = {};
  try {
    const r = await fetch(MAP_URL,{mode:'cors'});
    Object.entries(await r.json()).forEach(([k,v])=>abbr[k.toLowerCase()]=v);
  } catch(e){ console.warn('[pm-sell] set map failed → only name+number searches'); }

  /* small utils */
  const sanitize = s => s.split(/\s+/).filter(w=>!IGNORE.has(w.toLowerCase())).join(' ').trim();
  const splitNameNum = txt=>{
    const out={name:[],num:''};
    for(const w of txt.trim().split(/\s+/)){
      if(!out.num && /\d/.test(w)){ out.num=w.toUpperCase(); break; }
      out.name.push(w);
    }
    return {name:out.name.join(' '), num:out.num};
  };
  const firstNum = s=>{
    if(!s) return '';
    const first=s.split('/')[0].toUpperCase();
    const m = first.match(PREF_RE);
    if(m) return m[0].toLowerCase();
    const d = first.match(/\d+/);
    return d ? d[0] : '';
  };

  /* ───────────────────── 1) inject buttons ───────────────────── */

  const tbody = document.querySelector('#storemanager table tbody');
  if(!tbody) return;

  function addButtons(){
    tbody.querySelectorAll('tr').forEach(row=>{
      if(row._pmSellDone) return; row._pmSellDone = true;

      const tds = row.querySelectorAll('td');
      if(tds.length<18) return;

      const idCell    = tds[3];
      const nameCell  = tds[4];
      const setCell   = tds[5];
      const condCell  = tds[6];
      const priceCell = tds[9];
      const allocCell = tds[17];

      /* 1a – build search string */
      const {name,num} = splitNameNum(nameCell.textContent);
      const clean  = sanitize(name);
      const pn     = firstNum(num);
      const abbrCode = abbr[ setCell.textContent.trim().toLowerCase() ] || '';
      let cmQuery  = clean;
      if(abbrCode && /^\d+$/.test(pn)) cmQuery = `${clean} ${abbrCode}${pn}`;
      else if(abbrCode && pn)          cmQuery = `${clean} ${pn}`;
      else if(pn)                      cmQuery = /^\d+$/.test(pn)
                                                  ? `${clean} ${pn.padStart(3,'0')}`
                                                  : `${clean} ${pn}`;

      /* 1b – collect autofill data */
      const productId = (idCell.textContent.match(/^\d+/)||[''])[0];
      const condText  = condCell.textContent.split('-')[0].trim();
      const cmCond    = COND_MAP[condText] || 2;
      const cmPrice   = parseFloat(priceCell.textContent.replace(/[^\d.,]/g,'').replace(',','.'))||'';

      /* 1c – send w.postMessage() (retry for a few seconds) */
      function sendTo(win){
        const msg = {pmSell:true, price:cmPrice, condition:cmCond, comments:String(productId)};
        let tries = 0;
        const t = setInterval(()=>{
          if(!win || win.closed || tries>9){ clearInterval(t); return; }
          win.postMessage(msg,'*');     // listener checks origin
          tries++;
        },400);
      }

      /* 1d – create the button */
      const btn = document.createElement('button');
      btn.textContent='Sell';
      btn.style.cssText='display:block;margin:2px auto;padding:2px 6px;font-size:11px;';
      btn.addEventListener('click',()=>{
        const tab =
          (window.pmMcmTab && !window.pmMcmTab.closed)
          ? window.pmMcmTab
          : (window.pmMcmTab = window.open('about:blank','MCMWindow'));
        if(!tab){ alert('Popup blocked'); return; }

        tab.location.href =
          'https://www.cardmarket.com/en/Pokemon/Products/Search?searchString='+
          encodeURIComponent(cmQuery)+'#tabSell';
        sendTo(tab);                    // keep pinging until listener gets it
      });

      allocCell.appendChild(btn);
    });
  }

  addButtons();
  new MutationObserver(addButtons).observe(tbody,{childList:true,subtree:true});
})();



/* Works, but just once and uses cumbersome window method without listener


(async function () {
  'use strict';



  // 0a) load and normalise the set-abbr map
  const MAP_URL = 'https://raw.githubusercontent.com/gagihal/poroscripts-data/main/mcmsetmap.json';
  let abbrLower = {};            // key = full set name in lower-case, value = abbr
  try {
    const r = await fetch(MAP_URL, {mode: 'cors'});
    if (!r.ok) throw new Error(r.status);
    const json = await r.json();
    Object.entries(json).forEach(([k, v]) => abbrLower[k.toLowerCase()] = v);
    console.log('[pm-sell] set-map OK –', Object.keys(abbrLower).length, 'entries');
  } catch (e) {
    console.error('[pm-sell] set-map load failed:', e);
    alert('⚠ Couldn’t load set-code map – searches may be imprecise.');
  }

  // 0b) recognised collector-number prefixes
  const PREF_RE = /^(tg|gg|rc)\d+/i;

  // 0c) misc helpers
  const COND_MAP = { 'NM/M':2, 'EX':3, 'GD':4, 'LP':5, 'PL':6, 'DMG':7 };
  const IGNORE   = new Set([
    'full','art','secret','rare','hyper',
    'alternative','alternate','reverse','holo','bs'
  ]);

  const sanitize = s => s.split(/\s+/)
                         .filter(w => !IGNORE.has(w.toLowerCase()))
                         .join(' ').trim();

  function firstNum(str){
    if(!str) return '';
    const first = str.split('/')[0].toUpperCase();
    const pref  = first.match(PREF_RE);
    if (pref) return pref[0].toLowerCase();          // “tg10”
    const d = first.match(/\d+/);
    return d ? d[0] : '';
  }

  function splitNameNum(txt){
    const out = {name: [], num: ''};
    for (const w of txt.trim().split(/\s+/)){
      if (!out.num && /\d/.test(w)){ out.num = w.toUpperCase(); break; }
      out.name.push(w);
    }
    return {name: out.name.join(' '), num: out.num};
  }

  //──────────── 1) add a Sell button to every data row ────────────

  const tbody = document.querySelector('#storemanager table tbody');
  if (!tbody) return;

  function enhanceRows(){
    tbody.querySelectorAll('tr').forEach(row => {
      if (row._pmSellDone) return; row._pmSellDone = true;

      const cells = row.querySelectorAll('td');
      if (cells.length < 18) return;                 // skip header / weird rows

      const idCell    = cells[3];
      const nameCell  = cells[4];
      const setCell   = cells[5];
      const condCell  = cells[6];
      const priceCell = cells[9];
      const allocCell = cells[17];

      // 1a) build Cardmarket search term
      const {name, num} = splitNameNum(nameCell.textContent);
      const clean = sanitize(name);
      const pn    = firstNum(num);                          // “100” or “tg10”
      const abbr  = abbrLower[ setCell.textContent.trim().toLowerCase() ] || '';

      let cmQuery = clean;
      if (abbr && /^\d+$/.test(pn))      cmQuery = `${clean} ${abbr}${pn}`;
      else if (abbr && pn)               cmQuery = `${clean} ${pn}`;
      else if (pn)                       cmQuery = /^\d+$/.test(pn)
                                                    ? `${clean} ${pn.padStart(3,'0')}`
                                                    : `${clean} ${pn}`;

      // 1b) prepare autofill payload
      const productId = (idCell.textContent.match(/^\d+/) || [''])[0];
      const rawCond   = condCell.textContent.split('-')[0].trim();
      const cmCond    = COND_MAP[rawCond] || 2;
      const cmPrice   = parseFloat(
                          priceCell.textContent.replace(/[^\d.,]/g,'').replace(',','.')
                        ) || '';

      // 1c) make the button
      const btn = document.createElement('button');
      btn.textContent = 'Sell';
      btn.style.cssText = 'display:block;margin:2px auto;padding:2px 6px;font-size:11px;';
      btn.addEventListener('click', () => {
        const payload = btoa(JSON.stringify({
          price: cmPrice,
          condition: cmCond,
          comments: `${productId}`
        }));
        const w =
          (window.pmMcmTab && !window.pmMcmTab.closed)
           ? window.pmMcmTab                                 // re-use existing
           : (window.pmMcmTab = window.open('about:blank', 'MCMWindow')); // or create

        if (!w){ alert('Popup blocked'); return; }
        w.name = 'pmSell|' + payload;
        w.location.href =
          'https://www.cardmarket.com/en/Pokemon/Products/Search?searchString=' +
          encodeURIComponent(cmQuery) + '#tabSell';
      });

      allocCell.appendChild(btn);
    });
  }

  enhanceRows();                            // initial page
  new MutationObserver(enhanceRows)         // rows added by pagination, filters …
    .observe(tbody, {childList: true, subtree: true});

})();
*/
