// ==UserScript==
// @name         Cardmarket → TCGP/TCGA Buttons on Single Card Product Page
// @namespace    cm-cart
// @version      1.0
// @description  Adds TCGP (product page) and TCGA (Seller Admin) buttons near the title of a Cardmarket single-card product page
// @match        https://www.cardmarket.com/*/Products/Singles/*
// @require      https://raw.githubusercontent.com/Gagihal/poroscripts-data/main/utils/poro-search-utils.js
// @updateURL    https://raw.githubusercontent.com/Gagihal/poroscripts-data/main/mcm-buy/mcm-product-tcg-buttons.user.js
// @downloadURL  https://raw.githubusercontent.com/Gagihal/poroscripts-data/main/mcm-buy/mcm-product-tcg-buttons.user.js
// @connect      raw.githubusercontent.com
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(async function () {
    "use strict";

    // Preload ID mapping for better performance
    PoroSearch.preloadIdMap().catch(() => {});

    // Slightly larger than the seller/cart pills — this sits next to a big title
    const BTN_STYLE = `
        display:inline-block;
        font-size:12px;
        line-height:1.3;
        padding:4px 10px;
        border-radius:5px;
        border:1px solid #888;
        background:#1a1a1a;
        color:#fff;
        cursor:pointer;
        text-decoration:none;
        font-family:sans-serif;
        white-space:nowrap;
    `;

    // Extract the MCM product ID — try the most stable sources in order.
    function getMcmId() {
        const input = document.querySelector('input[name="idProduct"]');
        if (input && input.value && /^\d+$/.test(input.value.trim())) {
            return input.value.trim();
        }
        const og = document.querySelector('meta[property="og:image"]');
        if (og) {
            const m = (og.getAttribute('content') || '')
                .match(/cardmarket\.com\/\d+\/[A-Z]+\/(\d+)\/\d+\.jpg/);
            if (m) return m[1];
        }
        const link = document.querySelector('[href*="idProduct="], [data-bs-target*="idProduct="]');
        if (link) {
            const attr = link.getAttribute('href') || link.getAttribute('data-bs-target') || '';
            const m = attr.match(/idProduct=(\d+)/);
            if (m) return m[1];
        }
        return null;
    }

    // Card name from the page title (text node before the muted set span),
    // with the trailing "(SET 7)" parenthetical stripped.
    function getName(h1) {
        if (!h1) return "";
        const raw = (h1.firstChild && h1.firstChild.textContent) || h1.textContent || "";
        const beforeParen = raw.indexOf("(") !== -1 ? raw.slice(0, raw.indexOf("(")) : raw;
        return PoroSearch.sanitize(beforeParen.trim());
    }

    // Collector number from the title parenthetical, e.g. "(DS 7)" -> "7".
    function getNumber(h1) {
        if (!h1) return "";
        const raw = (h1.firstChild && h1.firstChild.textContent) || "";
        const m = raw.match(/\(([^)]*)\)\s*$/);
        if (!m) return "";
        const tokens = m[1].trim().split(/\s+/);
        return tokens[tokens.length - 1] || "";
    }

    // Set name from the breadcrumb (item before the active one) — language-agnostic.
    function getSet() {
        const items = [...document.querySelectorAll('.breadcrumb .breadcrumb-item')];
        if (items.length >= 2) {
            const setItem = items[items.length - 2];
            return (setItem.textContent || "").trim();
        }
        return "";
    }

    async function init() {
        const titleContainer = document.querySelector('.page-title-container');
        const h1 = titleContainer ? titleContainer.querySelector('h1') : document.querySelector('h1');
        if (!titleContainer || !h1) return;
        if (document.getElementById('cm-product-tcg-buttons')) return;

        const mcmId = getMcmId();
        const poroId = mcmId ? await PoroSearch.getPoroIdFromMcm(mcmId) : null;

        const cardData = {
            name: getName(h1),
            setFull: getSet(),
            number: getNumber(h1),
            cardId: poroId
        };

        const tcgBtn = await PoroSearch.createTcgButton(cardData, {
            text: 'TCGP',
            elementType: 'a',
            style: BTN_STYLE
        });
        const tcgSellerBtn = await PoroSearch.createTcgSellerButton(cardData, {
            text: 'TCGA',
            elementType: 'a',
            style: BTN_STYLE
        });

        const bar = document.createElement('div');
        bar.id = 'cm-product-tcg-buttons';
        bar.style.cssText = 'display:flex;gap:8px;align-items:center;margin:6px 0 2px;';
        bar.appendChild(tcgBtn);
        bar.appendChild(tcgSellerBtn);

        // Place the bar directly under the title block
        titleContainer.insertAdjacentElement('afterend', bar);
    }

    init();
})();
