// ==UserScript==
// @name         Cardmarket → Highlight Cart Sellers on Product Pages
// @namespace    cm-cart
// @version      1.1
// @description  Remembers which sellers are in your shopping cart and highlights their rows on single-card listing pages
// @match        https://www.cardmarket.com/*/ShoppingCart*
// @match        https://www.cardmarket.com/*/Products/Singles/*
// @updateURL    https://raw.githubusercontent.com/Gagihal/poroscripts-data/main/mcm-buy/mcm-cart-seller-highlight.user.js
// @downloadURL  https://raw.githubusercontent.com/Gagihal/poroscripts-data/main/mcm-buy/mcm-cart-seller-highlight.user.js
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function () {
    "use strict";

    const STORE_KEY = 'mcm_cart_sellers_v1';
    const STALE_MS = 24 * 3600 * 1000; // warn when cart snapshot is older than 24h

    // ---------- shared storage ----------

    function loadCartData() {
        try {
            const raw = localStorage.getItem(STORE_KEY);
            if (!raw) return null;
            const data = JSON.parse(raw);
            if (!Array.isArray(data.sellers)) return null;
            return data;
        } catch (e) {
            return null;
        }
    }

    function saveCartData(sellers, partial) {
        try {
            localStorage.setItem(STORE_KEY, JSON.stringify({
                sellers: [...sellers],
                ts: Date.now(),
                // partial = optimistic update from a product page, not a full cart snapshot
                partial: !!partial
            }));
        } catch (e) {}
    }

    // Extract a username from any /Users/<name> link (works in every UI language)
    function usernameFromHref(href) {
        const m = (href || "").match(/\/Users\/([^\/?#]+)/);
        return m ? decodeURIComponent(m[1]).toLowerCase() : null;
    }

    // ---------- cart page: compile seller list ----------

    function scrapeCartSellers() {
        const sellers = new Set();
        // Seller block headers and the cart-overview sidebar both link to /Users/<name>
        document.querySelectorAll('a[href*="/Users/"]').forEach(a => {
            const name = usernameFromHref(a.getAttribute('href'));
            if (name) sellers.add(name);
        });
        return sellers;
    }

    function initCartPage() {
        let timer = null;
        const sync = () => {
            const sellers = scrapeCartSellers();
            saveCartData(sellers, false);
            console.log(`[MCM-Cart] Synced ${sellers.size} cart sellers:`, [...sellers].join(', '));
        };
        sync();
        // Re-sync when the cart changes in place (seller removed, quantity edited)
        const obs = new MutationObserver(() => {
            clearTimeout(timer);
            timer = setTimeout(sync, 500);
        });
        obs.observe(document.body, { childList: true, subtree: true });
    }

    // ---------- product page: highlight rows ----------

    const ROW_HIGHLIGHT = [
        ['background-color', 'rgba(46, 160, 67, 0.16)'],
        ['box-shadow', 'inset 4px 0 0 0 #2ea043']
    ];

    const PILL_STYLE = `
        display:inline-block;
        font-size:10px;
        line-height:1.2;
        padding:2px 5px;
        margin-left:6px;
        border-radius:4px;
        border:1px solid #2ea043;
        background:rgba(46,160,67,0.2);
        color:#3fb950;
        font-family:sans-serif;
        font-weight:bold;
        white-space:nowrap;
        vertical-align:middle;
    `;

    function ageLabel(ts) {
        const mins = Math.round((Date.now() - ts) / 60000);
        if (mins < 60) return `${mins} min ago`;
        const hours = Math.round(mins / 60);
        if (hours < 48) return `${hours} h ago`;
        return `${Math.round(hours / 24)} days ago`;
    }

    function getRowSeller(row) {
        const a = row.querySelector('.col-seller a[href*="/Users/"], a[href*="/Users/"]');
        return a ? { name: usernameFromHref(a.getAttribute('href')), anchor: a } : null;
    }

    function highlightRow(row, anchor, data) {
        if (row.dataset.cmCartHighlighted === "1") return;
        row.dataset.cmCartHighlighted = "1";

        ROW_HIGHLIGHT.forEach(([prop, val]) => row.style.setProperty(prop, val, 'important'));

        const pill = document.createElement('span');
        pill.textContent = 'IN CART';
        pill.style.cssText = PILL_STYLE;
        pill.title = `Seller is in your shopping cart (synced ${ageLabel(data.ts)}${data.partial ? ', includes unsynced adds' : ''})`;
        anchor.insertAdjacentElement('afterend', pill);
    }

    function applyHighlights(sellerSet, data) {
        document.querySelectorAll('.article-row').forEach(row => {
            const seller = getRowSeller(row);
            if (seller && seller.name && sellerSet.has(seller.name)) {
                highlightRow(row, seller.anchor, data);
            }
        });
    }

    function showStaleNotice(data) {
        if (document.getElementById('cm-cart-stale-notice')) return;
        const note = document.createElement('div');
        note.id = 'cm-cart-stale-notice';
        note.textContent = data
            ? `Cart seller data is ${ageLabel(data.ts)} old — open your cart to refresh`
            : 'No cart seller data yet — open your shopping cart once to sync';
        note.style.cssText = `
            position:fixed; bottom:12px; left:12px; z-index:9999;
            font:11px sans-serif; color:#d29922;
            background:#1a1a1a; border:1px solid #d29922; border-radius:4px;
            padding:4px 8px; opacity:0.9; cursor:pointer;
        `;
        note.title = 'Click to dismiss';
        note.onclick = () => note.remove();
        document.body.appendChild(note);
    }

    function initProductPage() {
        const data = loadCartData();
        if (!data) {
            showStaleNotice(null);
            return;
        }
        const sellerSet = new Set(data.sellers);
        if (Date.now() - data.ts > STALE_MS) showStaleNotice(data);

        applyHighlights(sellerSet, data);

        // "Show more results" loads rows via AJAX — re-scan on DOM changes
        let timer = null;
        const obs = new MutationObserver(() => {
            clearTimeout(timer);
            timer = setTimeout(() => applyHighlights(sellerSet, data), 300);
        });
        obs.observe(document.body, { childList: true, subtree: true });

        // Optimistic update: clicking a row's cart button marks that seller
        // immediately, without needing to revisit the cart page
        document.addEventListener('click', (ev) => {
            // desktop: form submit button; mobile: <a class="modal-link mobile-cart">
            const btn = ev.target.closest('.article-row .col-offer button, .article-row .col-offer [type="submit"], .article-row .col-offer a.modal-link');
            if (!btn) return;
            const row = btn.closest('.article-row');
            const seller = row && getRowSeller(row);
            if (!seller || !seller.name || sellerSet.has(seller.name)) return;
            sellerSet.add(seller.name);
            saveCartData(sellerSet, true);
            applyHighlights(sellerSet, data);
            console.log(`[MCM-Cart] Optimistically added seller: ${seller.name}`);
        }, true);
    }

    // ---------- dispatch by page type ----------

    if (/\/ShoppingCart/.test(location.pathname)) {
        initCartPage();
    } else {
        initProductPage();
    }
})();
