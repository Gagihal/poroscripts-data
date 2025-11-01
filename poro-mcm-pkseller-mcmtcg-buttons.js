
// ==UserScript==
// @name         Cardmarket → Quick Links for Pokemon Sellers (TCGP + PM)
// @namespace    cm-links
// @version      0.6
// @description  Adds TCGP and PM buttons next to each card name on a sellefor Pokemon Sellers r's Singles page
// @match        https://www.cardmarket.com/*/Pokemon/Users/*/Offers/Singles*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function () {
    "use strict";

    const TCGP_BASE =
        "https://www.tcgplayer.com/search/pokemon/product?Language=English&productLineName=pokemon&q=";

    const PM_BASE =
        "https://poromagia.com/store_manager/pokemon/?";

    // "Dusclops  (PK 14)" → "Dusclops"
    // "Altaria ex δ Delta Species  (DF 90)" → "Altaria ex δ Delta Species"
    function extractCardName(fullText) {
        if (!fullText) return "";
        const t = fullText.trim().replace(/\s+/g, " ");
        const idx = t.indexOf("(");
        if (idx === -1) return t;
        return t.slice(0, idx).trim();
    }

    // Pull cardName, setName, and the anchor so we know where to inject
    function getRowData(row) {
        const nameAnchor = row.querySelector(
            ".col-seller a[href*='/Pokemon/Products/Singles']"
        );
        if (!nameAnchor) return null;

        const fullNameText = nameAnchor.textContent || "";
        const cardName = extractCardName(fullNameText);

        const setAnchor = row.querySelector(
            ".product-attributes a.expansion-symbol[title]"
        );
        const setName = setAnchor ? setAnchor.getAttribute("title").trim() : "";

        return { cardName, setName, nameAnchor };
    }

    function buildTcgplayerUrl(cardName, setName) {
        const q = `${cardName} ${setName}`.trim();
        return TCGP_BASE + encodeURIComponent(q);
    }

    function buildPmUrl(cardName, setName) {
        // Manual encode so we get %20, not +
        const n = encodeURIComponent(cardName);
        const s = encodeURIComponent(setName);
        return `${PM_BASE}name=${n}&set=${s}`;
    }

    function makeButton(label, onClick) {
        const btn = document.createElement("a");
        btn.textContent = label;
        btn.href = "#";

        btn.addEventListener("click", function (e) {
            e.preventDefault();
            onClick();
        });

        // pill style
        btn.style.display = "inline-block";
        btn.style.fontSize = "10px";
        btn.style.lineHeight = "1.2";
        btn.style.padding = "2px 4px";
        btn.style.marginLeft = "6px";
        btn.style.borderRadius = "4px";
        btn.style.border = "1px solid #888";
        btn.style.background = "#1a1a1a";
        btn.style.color = "#fff";
        btn.style.cursor = "pointer";
        btn.style.textDecoration = "none";
        btn.style.fontFamily = "sans-serif";
        btn.style.whiteSpace = "nowrap";

        return btn;
    }

    function enhanceRow(row) {
        if (row.dataset.cmLinksEnhanced === "1") return;

        const data = getRowData(row);
        if (!data) return;

        const { cardName, setName, nameAnchor } = data;
        if (!cardName || !nameAnchor) return;

        const tcgpUrl = buildTcgplayerUrl(cardName, setName);
        const pmUrl   = buildPmUrl(cardName, setName);

        const tcgpBtn = makeButton("TCGP", () => {
            window.open(tcgpUrl, "TCGPWindow");
        });

        const pmBtn = makeButton("PM", () => {
            window.open(pmUrl, "PMWindow");
        });

        // insert both after the card name link
        nameAnchor.insertAdjacentElement("afterend", tcgpBtn);
        tcgpBtn.insertAdjacentElement("afterend", pmBtn);

        row.dataset.cmLinksEnhanced = "1";
    }

    function scanAll() {
        document
            .querySelectorAll("#UserOffersTable .article-row")
            .forEach(enhanceRow);
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
