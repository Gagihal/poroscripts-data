
// ==UserScript==
// @name         Cardmarket → Quick Links for Pokemon Sellers (TCGP + PM)
// @namespace    cm-links
// @version      1.0
// @description  Adds TCGP and PM buttons next to each card name on a seller's Singles page (with direct TCGplayer links)
// @match        https://www.cardmarket.com/*/Pokemon/Users/*/Offers/Singles*
// @require      https://raw.githubusercontent.com/Gagihal/poroscripts-data/main/poro-search-utils.js
// @updateURL    https://raw.githubusercontent.com/Gagihal/poroscripts-data/main/mcm-pkseller-mcmtcg-buttons.user.js
// @downloadURL  https://raw.githubusercontent.com/Gagihal/poroscripts-data/main/mcm-pkseller-mcmtcg-buttons.user.js
// @connect      raw.githubusercontent.com
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(async function () {
    "use strict";

    // Preload ID mapping for better performance
    PoroSearch.preloadIdMap().catch(() => {});

    // Pill button style for Cardmarket's dark theme
    const PILL_STYLE = `
        display:inline-block;
        fontSize:10px;
        lineHeight:1.2;
        padding:2px 4px;
        marginLeft:6px;
        borderRadius:4px;
        border:1px solid #888;
        background:#1a1a1a;
        color:#fff;
        cursor:pointer;
        textDecoration:none;
        fontFamily:sans-serif;
        whiteSpace:nowrap;
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

        const data = getRowData(row);
        if (!data) return;

        const { cardName, setName, nameAnchor, mcmId } = data;
        if (!cardName || !nameAnchor) return;

        // Prepare card data for button utilities
        const cardData = {
            name: cardName,
            setFull: setName,
            mcmId: mcmId  // Used for reverse lookup to get TCG ID
        };

        // Create TCGP button with direct link support (via MCM ID reverse lookup)
        const tcgpBtn = await PoroSearch.createTcgButton(cardData, {
            text: 'TCGP',
            elementType: 'a',
            style: PILL_STYLE,
            // Override: use mcmId for reverse lookup instead of cardId
            getTcgId: mcmId ? async () => await PoroSearch.getTcgIdFromMcm(mcmId) : null
        });

        // If we have mcmId, manually handle the direct link logic
        let tcgBtn;
        if (mcmId) {
            const tcgId = await PoroSearch.getTcgIdFromMcm(mcmId);
            const tcgDirectUrl = tcgId ? `https://www.tcgplayer.com/product/${tcgId}` : null;
            const tcgSearchUrl = PoroSearch.buildTcgUrl(PoroSearch.buildTcgQuery(cardData));
            const usingFallback = !tcgDirectUrl;

            tcgBtn = document.createElement('a');
            tcgBtn.textContent = 'TCGP';
            tcgBtn.href = '#';
            tcgBtn.title = tcgDirectUrl ? 'Direct TCGplayer link' : 'Search on TCGplayer';
            tcgBtn.style.cssText = PILL_STYLE;
            if (tcgDirectUrl) {
                tcgBtn.style.borderLeft = '3px solid #2196F3';
            }
            tcgBtn.addEventListener('click', (e) => {
                e.preventDefault();
                const url = tcgDirectUrl || tcgSearchUrl;
                if (usingFallback) {
                    alert('Had to fall back to old search (no TCGplayer ID)');
                }
                PoroSearch.openNamed(url, 'TCGPWindow');
            });
        } else {
            // No MCM ID, create standard search button
            const tcgSearchUrl = PoroSearch.buildTcgUrl(PoroSearch.buildTcgQuery(cardData));
            tcgBtn = document.createElement('a');
            tcgBtn.textContent = 'TCGP';
            tcgBtn.href = '#';
            tcgBtn.title = 'Search on TCGplayer';
            tcgBtn.style.cssText = PILL_STYLE;
            tcgBtn.addEventListener('click', (e) => {
                e.preventDefault();
                PoroSearch.openNamed(tcgSearchUrl, 'TCGPWindow');
            });
        }

        // Create PM button using utility
        const pmBtn = PoroSearch.createPmButton(cardData, {
            text: 'PM',
            elementType: 'a',
            style: PILL_STYLE
        });

        // Insert both after the card name link
        nameAnchor.insertAdjacentElement("afterend", tcgBtn);
        tcgBtn.insertAdjacentElement("afterend", pmBtn);

        row.dataset.cmLinksEnhanced = "1";
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

    function init() {
        scanAll();
        initObserver();
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
})();
