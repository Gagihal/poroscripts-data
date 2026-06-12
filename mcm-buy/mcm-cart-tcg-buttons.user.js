// ==UserScript==
// @name         Cardmarket → TCGP/TCGA Buttons on Shopping Cart
// @namespace    cm-cart
// @version      1.0
// @description  Adds TCGP (product page) and TCGA (Seller Admin) buttons to each card row in the Cardmarket shopping cart
// @match        https://www.cardmarket.com/*/ShoppingCart*
// @require      https://raw.githubusercontent.com/Gagihal/poroscripts-data/main/utils/poro-search-utils.js
// @updateURL    https://raw.githubusercontent.com/Gagihal/poroscripts-data/main/mcm-buy/mcm-cart-tcg-buttons.user.js
// @downloadURL  https://raw.githubusercontent.com/Gagihal/poroscripts-data/main/mcm-buy/mcm-cart-tcg-buttons.user.js
// @connect      raw.githubusercontent.com
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(async function () {
    "use strict";

    // Preload ID mapping for better performance
    PoroSearch.preloadIdMap().catch(() => {});

    // Pill button style matching Cardmarket's dark theme (same as seller-page script)
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
        display:inline-flex;
        gap:4px;
        align-items:center;
        margin-left:auto;
    `;

    // Cart article rows carry everything as data attributes:
    // data-product-id (MCM ID), data-name, data-expansion-name, data-number
    function getRowData(row) {
        const mcmId = row.dataset.productId;
        const name = (row.dataset.name || "").trim();
        if (!mcmId || !name) return null;
        return {
            mcmId,
            name: PoroSearch.sanitize(name),
            setFull: (row.dataset.expansionName || "").trim(),
            number: (row.dataset.number || "").trim()
        };
    }

    async function enhanceRow(row) {
        if (row.dataset.cmTcgDone === "1") return;
        row.dataset.cmTcgDone = "1";

        const data = getRowData(row);
        if (!data) return;

        // MCM ID → Poro ID enables direct product/admin links
        const poroId = await PoroSearch.getPoroIdFromMcm(data.mcmId);
        const cardData = {
            name: data.name,
            setFull: data.setFull,
            number: data.number,
            cardId: poroId
        };

        const tcgBtn = await PoroSearch.createTcgButton(cardData, {
            text: 'TCGP',
            elementType: 'a',
            style: PILL_STYLE
        });
        const tcgSellerBtn = await PoroSearch.createTcgSellerButton(cardData, {
            text: 'TCGA',
            elementType: 'a',
            style: PILL_STYLE
        });

        const btnContainer = document.createElement('span');
        btnContainer.style.cssText = BUTTON_CONTAINER_STYLE;
        btnContainer.appendChild(tcgBtn);
        btnContainer.appendChild(tcgSellerBtn);

        // Desktop name cell; fall back to the mobile name div inside td.info
        const nameCell = row.querySelector('td.name') || row.querySelector('td.info .text-start');
        if (!nameCell) return;
        nameCell.style.display = 'flex';
        nameCell.style.justifyContent = 'space-between';
        nameCell.style.alignItems = 'center';
        nameCell.appendChild(btnContainer);
    }

    async function scanAll() {
        for (const row of document.querySelectorAll('tr[data-product-id]')) {
            await enhanceRow(row);
        }
    }

    await scanAll();
    new MutationObserver(scanAll).observe(document.body, { childList: true, subtree: true });
})();
