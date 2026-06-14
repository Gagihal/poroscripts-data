// ==UserScript==
// @name         Poromagia Basket → TCG / TCGA / MCM buttons
// @namespace    poroscripts
// @version      1.0
// @description  Adds TCG (TCGplayer product), TCGA (Seller Admin) and MCM (Cardmarket) buttons to each card row in the poromagia.com basket.
// @match        https://poromagia.com/*/basket/*
// @require      https://raw.githubusercontent.com/Gagihal/poroscripts-data/main/utils/poro-search-utils.js
// @updateURL    https://raw.githubusercontent.com/Gagihal/poroscripts-data/main/pokebasket/poromagia-basket-tcg-mcm-buttons.user.js
// @downloadURL  https://raw.githubusercontent.com/Gagihal/poroscripts-data/main/pokebasket/poromagia-basket-tcg-mcm-buttons.user.js
// @connect      raw.githubusercontent.com
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(async function () {
    "use strict";

    PoroSearch.preloadIdMap().catch(() => {});

    // The basket exposes the PARENT catalogue product id (in the /catalogue/<slug>_<PK>/
    // URL), not the pokemon_card id the id-map is keyed by. This companion map bridges
    // parent product id -> card id so we can reuse the standard button helpers.
    const PARENTMAP_URL = 'https://raw.githubusercontent.com/Gagihal/poroscripts-data/main/utils/parent-product-to-card.json';
    const PM_CACHE_KEY = 'poro_parent_card_map';
    const PM_CACHE_TS_KEY = 'poro_parent_card_map_ts';
    const PM_CACHE_MS = 24 * 3600 * 1000;
    let parentMap = null;

    async function loadParentMap() {
        try {
            const ts = parseInt(localStorage.getItem(PM_CACHE_TS_KEY) || '0', 10);
            if (ts && Date.now() - ts < PM_CACHE_MS) {
                const cached = localStorage.getItem(PM_CACHE_KEY);
                if (cached) { parentMap = JSON.parse(cached); return; }
            }
        } catch (e) {}
        try {
            const r = await fetch(PARENTMAP_URL);
            if (r.ok) {
                parentMap = await r.json();
                try {
                    localStorage.setItem(PM_CACHE_KEY, JSON.stringify(parentMap));
                    localStorage.setItem(PM_CACHE_TS_KEY, String(Date.now()));
                } catch (e) {}
            }
        } catch (e) { console.warn('[PoroBasket] parent map load failed:', e); }
        if (!parentMap) parentMap = {};
    }

    const PILL_STYLE = `
        display:inline-block;
        font-size:11px;
        line-height:1.2;
        padding:2px 7px;
        margin:2px 4px 0 0;
        border-radius:4px;
        border:1px solid #888;
        background:#1a1a1a;
        color:#fff;
        cursor:pointer;
        text-decoration:none;
        font-family:sans-serif;
        white-space:nowrap;
    `;

    // Title format: "Name <num> (childId) - Set Name - CONDITION"
    function parseRow(row) {
        const link = row.querySelector('a[href*="/catalogue/"]');
        if (!link) return null;
        const m = (link.getAttribute('href') || '').match(/_(\d+)\/?$/);
        const parentId = m ? m[1] : null;

        const h4 = row.querySelector('h4');
        let title = (h4 ? h4.textContent : '').trim();
        title = title.replace(/\s*\(\d+\)\s*/, ' ');     // drop the (childId)
        const parts = title.split(' - ');
        const rawName = parts[0] || '';
        const setFull = parts.length >= 2 ? parts[1].trim() : '';
        const { name, num } = PoroSearch.splitNameNum(rawName);
        return {
            parentId,
            cardName: PoroSearch.sanitize(name),
            number: num,
            setFull
        };
    }

    async function enhanceRow(row) {
        if (row.dataset.poroBtnsDone === '1') return;
        row.dataset.poroBtnsDone = '1';

        const d = parseRow(row);
        if (!d || !d.cardName) return;

        const cardId = d.parentId ? (parentMap[d.parentId] || null) : null;
        const cardData = { name: d.cardName, setFull: d.setFull, number: d.number, cardId };

        const tcgBtn = await PoroSearch.createTcgButton(cardData, {
            text: 'TCG', elementType: 'a', style: PILL_STYLE });
        const tcgaBtn = await PoroSearch.createTcgSellerButton(cardData, {
            text: 'TCGA', elementType: 'a', style: PILL_STYLE });
        const mcmBtn = await PoroSearch.createMcmButton(cardData, {
            text: 'MCM', elementType: 'a', style: PILL_STYLE });

        const bar = document.createElement('div');
        bar.className = 'poro-basket-btns';
        bar.style.cssText = 'margin-top:4px;display:flex;flex-wrap:wrap;align-items:center;';
        bar.appendChild(tcgBtn);
        bar.appendChild(tcgaBtn);
        bar.appendChild(mcmBtn);

        // place under the card name (col-sm-4 cell), after the h4
        const cell = row.querySelector('.col-sm-4') || (row.querySelector('h4') || {}).parentElement;
        if (cell) cell.appendChild(bar);
    }

    function rows() {
        // basket line rows carry a catalogue link + an h4 title
        return [...document.querySelectorAll('#basket_formset .row, .basket-items .row')]
            .filter(r => r.querySelector('a[href*="/catalogue/"]') && r.querySelector('h4'));
    }

    async function scanAll() {
        for (const r of rows()) await enhanceRow(r);
    }

    await loadParentMap();
    await scanAll();
    // basket re-renders on quantity change / AJAX
    let t = null;
    new MutationObserver(() => { clearTimeout(t); t = setTimeout(scanAll, 300); })
        .observe(document.body, { childList: true, subtree: true });
})();
