// ==UserScript==
// @name         TTV Demo Button
// @namespace    poroscripts
// @version      1.0
// @description  Adds a demo button to the Pokemon Store Manager toolbar
// @match        https://poromagia.com/store_manager/pokemon/*
// @updateURL    https://raw.githubusercontent.com/Gagihal/poroscripts-data/main/TTV_Demo.user.js
// @downloadURL  https://raw.githubusercontent.com/Gagihal/poroscripts-data/main/TTV_Demo.user.js
// @connect      raw.githubusercontent.com
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  // ----- guards -----
  const manager = document.getElementById('storemanager');
  if (!manager) return;

  const content = document.getElementById('content');
  if (!content) return;

  // ----- add demo button to toolbar -----
  const btn = document.createElement('button');
  btn.textContent = 'TTV DEMO';
  btn.title = 'Open the demo page';
  btn.style.cssText = 'margin:8px 0 8px 8px;padding:2px 6px;border:1px solid #888;background:#eee;';
  btn.onclick = () => {
    const demoUrl = 'https://raw.githubusercontent.com/Gagihal/poroscripts-data/main/TTV_Demo.html';
    window.open(demoUrl, 'TTVDemoWindow');
  };

  // Insert the button before the manager (next to other toolbar buttons)
  content.insertBefore(btn, manager);
})();
