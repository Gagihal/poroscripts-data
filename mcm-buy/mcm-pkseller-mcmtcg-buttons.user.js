
// ==UserScript==
// @name         Cardmarket → Quick Links for Pokemon Sellers (TCGP + PM)
// @namespace    cm-links
// @version      2.4
// @description  Adds TCGP and PM buttons next to each card name on a seller's Singles page (with improved TCGplayer direct links)
// @match        https://www.cardmarket.com/*/Pokemon/Users/*/Offers/Singles*
// @require      https://raw.githubusercontent.com/Gagihal/poroscripts-data/main/utils/poro-search-utils.js
// @updateURL    https://raw.githubusercontent.com/Gagihal/poroscripts-data/main/mcm-buy/mcm-pkseller-mcmtcg-buttons.user.js
// @downloadURL  https://raw.githubusercontent.com/Gagihal/poroscripts-data/main/mcm-buy/mcm-pkseller-mcmtcg-buttons.user.js
// @connect      raw.githubusercontent.com
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(async function () {
    "use strict";

    // Preload ID mapping for better performance
    PoroSearch.preloadIdMap().catch(() => {});

    // MCM to Poromagia set name mapping
    const SETMAP_URL = 'https://raw.githubusercontent.com/Gagihal/poroscripts-data/main/utils/mcm-to-poromagia-setmap.json';
    const SETMAP_CACHE_KEY = 'mcm_poro_setmap';
    const SETMAP_CACHE_TS_KEY = 'mcm_poro_setmap_ts';
    const SETMAP_CACHE_MS = 7 * 24 * 3600 * 1000; // 7 days
    let setMap = null;

    async function loadSetMap() {
        // Check cache first
        try {
            const cachedTs = parseInt(localStorage.getItem(SETMAP_CACHE_TS_KEY) || '0', 10);
            if (cachedTs && Date.now() - cachedTs < SETMAP_CACHE_MS) {
                const cached = localStorage.getItem(SETMAP_CACHE_KEY);
                if (cached) {
                    setMap = JSON.parse(cached);
                    return setMap;
                }
            }
        } catch (e) {}

        // Fetch from GitHub
        try {
            const response = await fetch(SETMAP_URL);
            if (response.ok) {
                setMap = await response.json();
                // Cache it
                try {
                    localStorage.setItem(SETMAP_CACHE_KEY, JSON.stringify(setMap));
                    localStorage.setItem(SETMAP_CACHE_TS_KEY, String(Date.now()));
                } catch (e) {}
            }
        } catch (e) {
            console.warn('[MCM-Buy] Failed to load set mapping:', e);
        }
        return setMap || {};
    }

    // Map MCM set name to Poromagia set name
    function mapSetName(mcmSetName) {
        if (!setMap || !mcmSetName) return mcmSetName;
        return setMap[mcmSetName] || mcmSetName;
    }

    // Preload set mapping (will be awaited in init)

    // Pill button style for Cardmarket's dark theme
    const PILL_STYLE = `
        display:inline-block;
        font-size:10px;
        line-height:1.2;
        padding:2px 4px;
        margin-left:4px;
        border-radius:4px;
        border:1px solid #888;
        background:#1a1a1a;
        color:#fff;
        cursor:pointer;
        text-decoration:none;
        font-family:sans-serif;
        white-space:nowrap;
    `;

    const BUTTON_CONTAINER_STYLE = `
        display:flex;
        gap:4px;
        align-items:center;
        margin-left:auto;
    `;

    // Extract card data including MCM ID from image URL
    function getRowData(row) {
        const nameAnchor = row.querySelector(
            ".col-seller a[href*='/Pokemon/Products/Singles']"
        );
        if (!nameAnchor) return null;

        const fullNameText = nameAnchor.textContent || "";
        // "Dusclops  (PK 14)" → extract name before parens, then split and sanitize
        const beforeParen = fullNameText.indexOf("(") !== -1
            ? fullNameText.slice(0, fullNameText.indexOf("(")).trim()
            : fullNameText.trim();
        const { name } = PoroSearch.splitNameNum(beforeParen);
        const cardName = PoroSearch.sanitize(name);

        const setAnchor = row.querySelector(
            ".product-attributes a.expansion-symbol[title]"
        );
        const setName = setAnchor ? setAnchor.getAttribute("title").trim() : "";

        // Extract MCM ID from image URL in tooltip
        // Example: <img src="https://product-images.s3.cardmarket.com/51/BS/273740/273740.jpg" ...>
        let mcmId = null;
        const tooltip = row.querySelector('[data-bs-title]');
        if (tooltip) {
            const titleHtml = tooltip.getAttribute('data-bs-title');
            const match = titleHtml.match(/cardmarket\.com\/\d+\/[A-Z]+\/(\d+)\/\d+\.jpg/);
            if (match) {
                mcmId = match[1];
            }
        }

        return { cardName, setName, nameAnchor, mcmId };
    }

    async function enhanceRow(row) {
        if (row.dataset.cmLinksEnhanced === "1") return;

        // Set flag immediately to prevent duplicate processing
        row.dataset.cmLinksEnhanced = "1";

        const data = getRowData(row);
        if (!data) return;

        const { cardName, setName, nameAnchor, mcmId } = data;
        if (!cardName || !nameAnchor) return;

        // Map MCM set name to Poromagia set name (if mapping exists)
        const poroSetName = mapSetName(setName);

        // Convert MCM ID to Poro ID for direct link support
        const poroId = mcmId ? await PoroSearch.getPoroIdFromMcm(mcmId) : null;

        // Prepare card data for button utilities
        const cardData = {
            name: cardName,
            setFull: setName,
            cardId: poroId  // Poro ID for direct link lookup
        };

        // Card data for PM button (uses mapped Poromagia set name)
        const pmCardData = {
            name: cardName,
            setFull: poroSetName
        };

        // Create TCGP button with direct link support
        const tcgBtn = await PoroSearch.createTcgButton(cardData, {
            text: 'TCGP',
            elementType: 'a',
            style: PILL_STYLE
        });

        // Create PM button using utility with mapped set name
        const pmBtn = PoroSearch.createPmButton(pmCardData, {
            text: 'PM',
            elementType: 'a',
            style: PILL_STYLE
        });

        // Create a container for the buttons that floats right
        const btnContainer = document.createElement('span');
        btnContainer.style.cssText = BUTTON_CONTAINER_STYLE;
        btnContainer.appendChild(tcgBtn);
        btnContainer.appendChild(pmBtn);

        // Get the parent cell and make it flexbox to push buttons right
        const nameCell = nameAnchor.closest('.col-seller') || nameAnchor.parentElement;

        // Set the cell to use flexbox with space-between
        nameCell.style.display = 'flex';
        nameCell.style.justifyContent = 'space-between';
        nameCell.style.alignItems = 'center';

        nameCell.appendChild(btnContainer);
    }

    async function scanAll() {
        const rows = document.querySelectorAll("#UserOffersTable .article-row");
        for (const row of rows) {
            await enhanceRow(row);
        }
    }

    function initObserver() {
        const table = document.querySelector("#UserOffersTable");
        if (!table) return;

        const obs = new MutationObserver(scanAll);
        obs.observe(table, { childList: true, subtree: true });
    }

    async function init() {
        await loadSetMap();  // Wait for set map to load before scanning
        scanAll();
        initObserver();
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
})();
