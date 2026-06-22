// ==UserScript==
// @name         TCGplayer → Poro Links (MCM / PM / TCGA floating box)
// @namespace    poroscripts
// @version      1.3
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

    // ----- TCGplayer set name -> Poromagia set name map (for PM search fallback) -----
    // Poromagia's store manager filters with set__name__icontains, and TCG set names
    // often differ ("Crystal Guardians" vs "EX Crystal Guardians", "SM Promos" vs
    // "Sun & Moon Promos"), so we translate before building the PM search link.
    const SETMAP_URL = 'https://raw.githubusercontent.com/Gagihal/poroscripts-data/main/utils/tcg-to-poromagia-setmap.json';
    const SETMAP_CACHE_KEY = 'tcg_poro_setmap';
    const SETMAP_CACHE_TS_KEY = 'tcg_poro_setmap_ts';
    const SETMAP_CACHE_MS = 7 * 24 * 3600 * 1000;
    let setMap = null;

    async function loadSetMap() {
        try {
            const ts = parseInt(localStorage.getItem(SETMAP_CACHE_TS_KEY) || '0', 10);
            if (ts && Date.now() - ts < SETMAP_CACHE_MS) {
                const cached = localStorage.getItem(SETMAP_CACHE_KEY);
                if (cached) { setMap = JSON.parse(cached); return; }
            }
        } catch (e) {}
        try {
            const r = await fetch(SETMAP_URL);
            if (r.ok) {
                setMap = await r.json();
                try {
                    localStorage.setItem(SETMAP_CACHE_KEY, JSON.stringify(setMap));
                    localStorage.setItem(SETMAP_CACHE_TS_KEY, String(Date.now()));
                } catch (e) {}
            }
        } catch (e) { console.warn('[PoroTCG] set map load failed:', e); }
    }
    function mapSet(tcgSet) {
        if (!setMap || !tcgSet) return tcgSet;
        return setMap[tcgSet] || tcgSet;
    }

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

    // ----- parse current product from URL + product header DOM -----
    function getTcgId() {
        const m = location.pathname.match(/\/product\/(\d+)/);
        return m ? m[1] : null;
    }

    // Wait until the product header has rendered (SPA loads it after navigation).
    function waitForHeader(timeoutMs = 6000) {
        return new Promise((resolve) => {
            const sel = '[data-testid="lblProductDetailsProductName"]';
            if (document.querySelector(sel)) return resolve(document.querySelector(sel));
            const t0 = Date.now();
            const iv = setInterval(() => {
                const el = document.querySelector(sel);
                if (el || Date.now() - t0 > timeoutMs) {
                    clearInterval(iv);
                    resolve(el || null);
                }
            }, 150);
        });
    }

    // Read name/number/set from the header DOM — reliable, unlike document.title
    // which is still the generic landing title when the box first builds.
    function parseProduct(h1) {
        const setEl = document.querySelector('[data-testid="lblProductDetailsSetName"]');
        const setFull = setEl ? (setEl.textContent || '').trim() : '';
        let h1t = h1 ? (h1.textContent || '').trim() : '';
        // h1 = "<name> - <number...> - <setName> (<rarity>)" — drop from the set name on
        if (setFull) {
            const idx = h1t.indexOf(' - ' + setFull);
            if (idx > 0) h1t = h1t.slice(0, idx);
        }
        const parts = h1t.split(' - ');
        const name = parts.shift() || '';
        const numRaw = parts.join(' - ');
        const number = numRaw.split(' (')[0].trim();
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
        const h1 = await waitForHeader();
        const { name, number, setFull } = parseProduct(h1);

        // TCG ID is authoritative here → reverse-resolve to Poro/MCM (shared PoroIds resolver)
        const poroId = await PoroIds.toPoro('tcg', tcgId);
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
            pmHref = PoroSearch.buildPmUrl({ name, setFull: mapSet(setFull) });
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
    loadSetMap().finally(rebuild);

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
