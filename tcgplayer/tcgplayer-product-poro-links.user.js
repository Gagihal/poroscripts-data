// ==UserScript==
// @name         TCGplayer → Poro Links (MCM / PM / TCGA floating box)
// @namespace    poroscripts
// @version      1.0
// @description  Floating corner box on TCGplayer single-card pages with buttons to the matching Cardmarket, Poromagia Store Manager and TCGplayer Seller Admin pages.
// @match        https://www.tcgplayer.com/product/*
// @require      https://raw.githubusercontent.com/Gagihal/poroscripts-data/main/utils/poro-search-utils.js
// @updateURL    https://raw.githubusercontent.com/Gagihal/poroscripts-data/main/tcgplayer/tcgplayer-product-poro-links.user.js
// @downloadURL  https://raw.githubusercontent.com/Gagihal/poroscripts-data/main/tcgplayer/tcgplayer-product-poro-links.user.js
// @connect      raw.githubusercontent.com
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(async function () {
    "use strict";

    PoroSearch.preloadIdMap().catch(() => {});

    const BTN_STYLE = `
        display:inline-block;
        font-size:12px;
        line-height:1.3;
        padding:5px 10px;
        border-radius:5px;
        border:1px solid #888;
        background:#1a1a1a;
        color:#fff;
        cursor:pointer;
        text-decoration:none;
        font-family:sans-serif;
        white-space:nowrap;
    `;

    // ----- the floating box (built once, contents rebuilt per product) -----
    let box, btnRow;
    function ensureBox() {
        if (box) return;
        box = document.createElement('div');
        box.id = 'poro-tcg-links';
        box.style.cssText = `
            position:fixed; bottom:16px; right:16px; z-index:999999;
            background:rgba(20,22,28,0.96); border:1px solid #3a3f4b;
            border-radius:8px; padding:8px 10px;
            box-shadow:0 2px 10px rgba(0,0,0,0.5);
            font-family:sans-serif; color:#cbd2e0;
        `;
        const label = document.createElement('div');
        label.textContent = 'Poro links';
        label.style.cssText = 'font-size:10px;text-transform:uppercase;letter-spacing:.5px;color:#8b93a7;margin-bottom:5px;';
        btnRow = document.createElement('div');
        btnRow.style.cssText = 'display:flex;gap:6px;align-items:center;';
        box.appendChild(label);
        box.appendChild(btnRow);
        document.body.appendChild(box);
    }

    // ----- parse current product from URL + document.title -----
    function getTcgId() {
        const m = location.pathname.match(/\/product\/(\d+)/);
        return m ? m[1] : null;
    }
    function parseTitle() {
        let t = (document.title || '').replace(/\s*-\s*TCGplayer\.com\s*$/i, '');
        const parts = t.split(' - ');
        if (parts.length >= 2) parts.pop(); // drop trailing product line ("Pokemon")
        const name = parts.shift() || '';
        const numRaw = parts.shift() || '';
        const number = numRaw.split(' (')[0].trim();
        const setFull = parts.join(' - ');
        return { name: PoroSearch.sanitize(name), number, setFull };
    }

    function makeBtn(text, href, title, borderColor) {
        const a = document.createElement('a');
        a.textContent = text;
        a.href = href;
        a.target = '_blank';
        a.rel = 'noopener';
        a.title = title;
        a.style.cssText = BTN_STYLE;
        if (borderColor) a.style.borderLeft = `3px solid ${borderColor}`;
        return a;
    }

    let lastTcgId = null;
    async function rebuild() {
        const tcgId = getTcgId();
        if (!tcgId) return;
        if (tcgId === lastTcgId && btnRow && btnRow.childElementCount) return;
        lastTcgId = tcgId;

        ensureBox();
        const { name, number, setFull } = parseTitle();

        // TCG ID is authoritative here → reverse-resolve to Poro/MCM
        const poroId = await PoroSearch.getPoroIdFromTcg(tcgId);
        const mcmDirect = poroId ? await PoroSearch.buildMcmDirectUrl(poroId) : null;

        // MCM: direct product page if mapped, else search
        let mcmHref, mcmTitle, mcmBorder;
        if (mcmDirect) {
            mcmHref = mcmDirect;
            mcmTitle = 'Direct Cardmarket product';
            mcmBorder = '#4CAF50';
        } else {
            const { primary } = await PoroSearch.buildMcmQuery({ name, setFull, number });
            mcmHref = PoroSearch.buildMcmSearchUrl(primary);
            mcmTitle = 'Search on Cardmarket';
            mcmBorder = null;
        }

        // PM (Poromagia Store Manager): product_id search when we have a Poro ID, else name+set
        let pmHref, pmTitle, pmBorder;
        if (poroId) {
            pmHref = `https://poromagia.com/store_manager/pokemon/?name=${encodeURIComponent(poroId)}`;
            pmTitle = 'Poromagia Store Manager (product ' + poroId + ')';
            pmBorder = '#9C27B0';
        } else {
            pmHref = PoroSearch.buildPmUrl({ name, setFull });
            pmTitle = 'Search Poromagia Store Manager';
            pmBorder = null;
        }

        // TCGA (Seller Admin): always direct — this page IS the TCG product
        const tcgaHref = `https://store.tcgplayer.com/admin/product/manage/${tcgId}`;

        btnRow.innerHTML = '';
        btnRow.appendChild(makeBtn('MCM', mcmHref, mcmTitle, mcmBorder));
        btnRow.appendChild(makeBtn('PM', pmHref, pmTitle, pmBorder));
        btnRow.appendChild(makeBtn('TCGA', tcgaHref, 'TCGplayer Seller Admin (id ' + tcgId + ')', '#FF9800'));
    }

    // ----- run now + follow SPA navigation -----
    rebuild();

    const wrap = (type) => {
        const orig = history[type];
        history[type] = function () {
            const r = orig.apply(this, arguments);
            window.dispatchEvent(new Event('poro-locationchange'));
            return r;
        };
    };
    wrap('pushState');
    wrap('replaceState');
    window.addEventListener('popstate', () => window.dispatchEvent(new Event('poro-locationchange')));
    window.addEventListener('poro-locationchange', () => setTimeout(rebuild, 400));

    // Fallback poll: title/URL can settle after the route event on this SPA
    let lastHref = location.href;
    setInterval(() => {
        if (location.href !== lastHref) {
            lastHref = location.href;
            setTimeout(rebuild, 400);
        }
    }, 1000);
})();
