// ==UserScript==
// @name         Pokemon Manager – Cart tools (add + inline viewer)
// @namespace    poroscripts
// @version      1.3
// @description  Adds per-row "Add 1 (X)" button (X = copies already in cart) and a "Show Cart" inline viewer.
// @match        https://poromagia.com/store_manager/pokemon/*
// @updateURL    https://raw.githubusercontent.com/Gagihal/poroscripts-data/main/pokemng/pokemng-cart.user.js
// @downloadURL  https://raw.githubusercontent.com/Gagihal/poroscripts-data/main/pokemng/pokemng-cart.user.js
// @connect      raw.githubusercontent.com
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  function getCSRF(){
    const m = document.cookie.match(/csrftoken=([^;]+)/);
    return m ? m[1] : null;
  }

  const manager = document.getElementById('storemanager'); if (!manager) return;
  const table   = manager.querySelector('table');          if (!table)   return;

  // find "Incoming" column index to place the button there; fallback to ID column
  const headerRow = table.querySelector('tbody tr');
  let incomingIdx = -1;
  headerRow?.querySelectorAll('th').forEach((th,i)=>{
    if(th.textContent.trim().toLowerCase()==='incoming') incomingIdx = i+1;
  });

  const tbody = table.querySelector('tbody'); if(!tbody) return;

  // ===== cart quantity tracking =====
  // Basket lines are child products. Key: parent product id (from the
  // catalogue URL "_<pk>/") + condition (title suffix " - NM/M" etc.).
  // Store manager rows expose the same parent id in the link-product-card
  // href (?product_id=) and the condition in td.condition.
  const CONDITIONS = ['NM/M','DMG','EX','GD','LP','PL','MT','NM']; // NM/M before NM

  let cartCounts = null;          // {byChild: {parent|cond: qty}, byParent: {parent: qty}}
  const labeledButtons = [];      // {btn, parent, cond}
  let resyncTimer = null;

  async function fetchCartCounts(){
    const r = await fetch('/en/basket/', {credentials:'include'});
    if(!r.ok) throw new Error('HTTP '+r.status);
    const doc = new DOMParser().parseFromString(await r.text(), 'text/html');
    const byChild = {}, byParent = {};
    let rows = doc.querySelectorAll('#basket_formset .basket-items .row');
    if(!rows.length) rows = doc.querySelectorAll('#basket_formset .row');
    rows.forEach(row=>{
      const a = row.querySelector('a[href*="/catalogue/"]');
      const m = a && (a.getAttribute('href')||'').match(/_(\d+)\/?$/);
      if(!m) return;
      const parent = m[1];
      const qty = parseInt(row.querySelector('input[type="number"]')?.value, 10) || 0;
      if(!qty) return;
      byParent[parent] = (byParent[parent]||0) + qty;
      const title = row.querySelector('h4')?.textContent || '';
      const cond = title.split(' - ').pop().trim().toUpperCase();
      if(CONDITIONS.includes(cond)){
        const k = parent + '|' + cond;
        byChild[k] = (byChild[k]||0) + qty;
      }
    });
    cartCounts = {byChild, byParent};
    return cartCounts;
  }

  function countFor(parent, cond){
    if(!cartCounts || !parent) return null;
    if(cond) return cartCounts.byChild[parent + '|' + cond] || 0;
    return cartCounts.byParent[parent] || 0;
  }

  function buttonLabel(parent, cond){
    const n = countFor(parent, cond);
    return n === null ? 'Add 1' : `Add 1 (${n})`;
  }

  function relabelAll(){
    labeledButtons.forEach(({btn, parent, cond})=>{
      if(btn._flashing) return;
      btn.textContent = buttonLabel(parent, cond);
    });
  }

  function bumpLocal(parent, cond, delta){
    if(!cartCounts || !parent) return;
    cartCounts.byParent[parent] = (cartCounts.byParent[parent]||0) + delta;
    if(cond){
      const k = parent + '|' + cond;
      cartCounts.byChild[k] = (cartCounts.byChild[k]||0) + delta;
    }
  }

  function scheduleResync(){
    clearTimeout(resyncTimer);
    resyncTimer = setTimeout(()=>{
      fetchCartCounts().then(relabelAll).catch(()=>{});
    }, 1500);
  }

  function getRowCartKey(row){
    // parent product id from the link-product-card href
    const link = row.querySelector('a[href*="link-product-card"]');
    const pm = link && (link.getAttribute('href')||'').match(/product_id=(\d+)/);
    const parent = pm ? pm[1] : null;
    // condition is the leading text of td.condition (before the rarity <br>)
    let cond = null;
    const condCell = row.querySelector('td.condition');
    if(condCell){
      const txt = (condCell.textContent||'').trim().toUpperCase();
      cond = CONDITIONS.find(c=>txt.startsWith(c)) || null;
    }
    return { parent, cond };
  }

  function enhanceRows(){
    tbody.querySelectorAll('tr').forEach(row=>{
      if(row._cartBtnDone) return; row._cartBtnDone = true;

      const idCell  = row.querySelector('td:nth-child(4)');
      if(!idCell) return;
      const pid = +idCell.textContent.trim(); if(Number.isNaN(pid)) return;

      const targetCell = incomingIdx>0 ? row.querySelector(`td:nth-child(${incomingIdx})`) : idCell;
      if(!targetCell) return;

      const { parent, cond } = getRowCartKey(row);

      const cBtn = document.createElement('button');
      cBtn.textContent = buttonLabel(parent, cond);
      cBtn.className='pm-cart-btn';
      cBtn.style.cssText='display:block;margin:2px;padding:2px;';
      labeledButtons.push({btn: cBtn, parent, cond});

      cBtn.onclick = async ()=>{
        const csrf=getCSRF(); if(!csrf) { alert('CSRF missing'); return; }
        try{
          const r = await fetch(`/en/basket/add/${pid}/`,{
            method:'POST',credentials:'include',
            headers:{
              'Content-Type':'application/x-www-form-urlencoded',
              'X-Requested-With':'XMLHttpRequest'
            },
            body:`csrfmiddlewaretoken=${csrf}&quantity=1`
          });
          if(!r.ok) throw new Error('HTTP '+r.status);
          bumpLocal(parent, cond, 1);
          cBtn._flashing = true;
          cBtn.textContent='OK';
          setTimeout(()=>{
            cBtn._flashing = false;
            cBtn.textContent = buttonLabel(parent, cond);
          },1200);
          scheduleResync();
        }catch(e){
          alert('Add failed: '+e);
        }
      };

      targetCell.appendChild(cBtn);
    });
  }

  enhanceRows();
  new MutationObserver(enhanceRows).observe(tbody,{childList:true,subtree:true});

  // initial cart sync → label buttons with current quantities
  fetchCartCounts().then(relabelAll).catch(e=>console.warn('[PM-Cart] basket sync failed:', e));

  // Inline cart viewer
  const content = document.getElementById('content');
  if(content){
    const showCartBtn=document.createElement('button');
    showCartBtn.textContent='Show Cart';
    showCartBtn.style.cssText='display:block;margin:8px;padding:6px;background:#eee;border:1px solid #999;';
    content.appendChild(showCartBtn);

    showCartBtn.onclick = async ()=>{
      let box=document.getElementById('pm-cart-container');
      if(!box){
        box=document.createElement('div');
        box.id='pm-cart-container';
        box.style.cssText='margin-top:8px;padding:8px;border:1px solid #ccc;background:#fafafa;';
        content.appendChild(box);
      }
      box.textContent='Loading cart...';
      try{
        const r=await fetch('/en/basket/',{credentials:'include'});
        if(!r.ok){ box.textContent='Load failed: '+r.status; return; }
        const doc=new DOMParser().parseFromString(await r.text(),'text/html');
        const rows=doc.querySelectorAll('#basket_formset .row');
        if(!rows.length){ box.textContent='Cart is empty.'; return; }
        const ul=document.createElement('ul'); ul.style.listStyle='disc inside';
        rows.forEach(row=>{
          const nm = row.querySelector('.col-sm-4 h4')?.innerText.trim() || '[no name]';
          const qt = row.querySelector('input[type="number"]')?.value || '?';
          const pr = row.querySelector('.col-sm-1 .price_color')?.innerText
                       .split('\n').filter(s=>s.trim()).pop();
          const li=document.createElement('li');
          li.textContent = nm + ' - ' + qt + ' x ' + pr; // ASCII-only
          ul.appendChild(li);
        });
        box.innerHTML=''; box.appendChild(ul);
      }catch(e){
        box.textContent='Cart error: '+e;
      }
    };
  }

})();
