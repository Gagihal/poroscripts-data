// ==UserScript==
// @name         Cardmarket autofill from Poromagia (postMessage v0.5.1) OLD
// @namespace    https://cardmarket.com/
// @version      0.5.1
// @description  Receives postMessage from Pokémon Manager and autofills the Sell tab.
// @match        https://www.cardmarket.com/*/Pokemon/*
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  const SEL_COND  = '#idCondition';
  const SEL_PRICE = '#price';
  const SEL_COMM  = '#comments';

  document.querySelector('a[href$="#tabSell"]')?.click();

  function trigger(el){ ['input','change'].forEach(e=>el.dispatchEvent(new Event(e,{bubbles:true}))); }

  function fill(d){
    const cond=document.querySelector(SEL_COND);
    const price=document.querySelector(SEL_PRICE);
    const comm=document.querySelector(SEL_COMM);
    if(!cond||!price||!comm) return false;
    cond.value=d.condition; price.value=d.price; comm.value=d.comments;
    trigger(cond); trigger(price); trigger(comm); return true;
  }

  window.addEventListener('message',e=>{
    const ok = e.origin==='https://poromagia.com' || e.origin==='https://www.poromagia.com';
    if(!ok || !e.data?.pmSell) return;
    console.log('[MCM-autofill] payload',e.data);
    if(fill(e.data)) return;
    /* in case fields not yet in DOM */
    const mo=new MutationObserver(()=>{ if(fill(e.data)) mo.disconnect(); });
    mo.observe(document.documentElement,{childList:true,subtree:true});
  });
})();


/* WORKING OLD
(function () {
  'use strict';

  const PREFIX = 'pmSell|';
  let payload;

  function decodePayload() {
    if (!window.name.startsWith(PREFIX)) return false;
    try {
      payload = JSON.parse(atob(window.name.slice(PREFIX.length)));
      return true;
    } catch {
      return false;
    }
  }

  if (!decodePayload()) return;

  // Auto-click the Sell tab
  document.querySelector('a[href$="#tabSell"]')?.click();

  const SEL_COND  = '#idCondition';
  const SEL_PRICE = '#price';
  const SEL_COMM  = '#comments';

  function triggerInput(el) {
    if (!el) return;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function fillOnce() {
    const cond  = document.querySelector(SEL_COND);
    const price = document.querySelector(SEL_PRICE);
    const comm  = document.querySelector(SEL_COMM);

    if (!cond || !price || !comm) return false;

    cond.value  = payload.condition;
    price.value = payload.price;
    comm.value  = payload.comments;

    [cond, price, comm].forEach(triggerInput);

    // All good → stop future runs
    window.name = 'MCMWindow';
    return true;
  }

  if (fillOnce()) return;

  const mo = new MutationObserver(() => {
    if (fillOnce()) mo.disconnect();
  });
  mo.observe(document.documentElement, { childList: true, subtree: true });

  window.addEventListener('popstate', () => {
    if (decodePayload()) fillOnce();
  });

})();
*/
