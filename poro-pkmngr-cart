// ==UserScript==
// @name         Pokemon Manager – Cart tools (add + inline viewer) v1.0
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Adds per-row "Add to cart" and a "Show Cart" inline viewer.
// @match        https://poromagia.com/store_manager/pokemon/*
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

  function enhanceRows(){
    tbody.querySelectorAll('tr').forEach(row=>{
      if(row._cartBtnDone) return; row._cartBtnDone = true;

      const idCell  = row.querySelector('td:nth-child(4)');
      if(!idCell) return;
      const pid = +idCell.textContent.trim(); if(Number.isNaN(pid)) return;

      const targetCell = incomingIdx>0 ? row.querySelector(`td:nth-child(${incomingIdx})`) : idCell;
      if(!targetCell) return;

      const cBtn = document.createElement('button');
      cBtn.textContent='Add to cart';
      cBtn.className='pm-cart-btn';
      cBtn.style.cssText='display:block;margin:2px;padding:2px;';

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
          const old = cBtn.textContent;
          cBtn.textContent='OK';
          setTimeout(()=>cBtn.textContent=old,1200);
        }catch(e){
          alert('Add failed: '+e);
        }
      };

      targetCell.appendChild(cBtn);
    });
  }

  enhanceRows();
  new MutationObserver(enhanceRows).observe(tbody,{childList:true,subtree:true});

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
