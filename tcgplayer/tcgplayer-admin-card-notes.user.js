// ==UserScript==
// @name         TCGplayer Seller Admin → Shared Card Notes
// @namespace    poroscripts
// @version      1.2
// @description  Minimizable notes box on the TCGplayer Seller Admin product page. Opens automatically when the card has a note, otherwise starts minimized. Notes are shared via the Poromagia hub so every user with the script sees them.
// @match        https://store.tcgplayer.com/admin/product/manage/*
// @updateURL    https://raw.githubusercontent.com/Gagihal/poroscripts-data/main/tcgplayer/tcgplayer-admin-card-notes.user.js
// @downloadURL  https://raw.githubusercontent.com/Gagihal/poroscripts-data/main/tcgplayer/tcgplayer-admin-card-notes.user.js
// @connect      os.poromagia.com
// @run-at       document-idle
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// ==/UserScript==

(function () {
    "use strict";

    const API_BASE = 'https://os.poromagia.com/api/card-notes/';
    const INITIALS_KEY = 'poro_note_initials';

    function getTcgId() {
        const m = location.pathname.match(/\/admin\/product\/manage\/(\d+)/);
        return m ? m[1] : null;
    }

    // --- hub API via GM_xmlhttpRequest (bypasses CORS / SSO cookie) ---
    function apiGet(tcgId) {
        return new Promise((resolve) => {
            GM_xmlhttpRequest({
                method: 'GET', url: API_BASE + tcgId, timeout: 15000,
                onload: (r) => { try { resolve(JSON.parse(r.responseText)); } catch (e) { resolve(null); } },
                onerror: () => resolve(null), ontimeout: () => resolve(null),
            });
        });
    }
    function apiSave(tcgId, note, author) {
        return new Promise((resolve) => {
            GM_xmlhttpRequest({
                method: 'POST', url: API_BASE + tcgId, timeout: 15000,
                headers: { 'Content-Type': 'application/json' },
                data: JSON.stringify({ note, author }),
                onload: (r) => { try { resolve(JSON.parse(r.responseText)); } catch (e) { resolve(null); } },
                onerror: () => resolve(null), ontimeout: () => resolve(null),
            });
        });
    }

    // --- the box (built once, contents refreshed per product) ---
    let box, pill, area, status, saveBtn, currentId = null, dirty = false, expanded = false;

    function setExpanded(v) {
        expanded = v;
        if (!box) return;
        box.style.display = v ? 'block' : 'none';
        pill.style.display = v ? 'none' : 'block';
        if (v) area.focus();
    }

    // The minimized pill turns green with a dot when the current card has a note,
    // so you can tell there's something to read without opening it.
    function updatePill(rec) {
        if (!pill) return;
        const has = !!(rec && rec.note && rec.note.trim());
        pill.textContent = has ? '📝 Card notes ●' : '📝 Card notes';
        pill.style.color = has ? '#3fb950' : '#8b93a7';
        pill.style.borderColor = has ? '#2ea043' : '#3a3f4b';
        pill.title = (has ? 'This card has a note' : 'No note yet') + ' — click to open';
    }

    function ensureBox() {
        if (box) return;

        // minimized pill (default state)
        pill = document.createElement('div');
        pill.id = 'poro-card-notes-pill';
        pill.style.cssText = `
            position:fixed; bottom:16px; right:16px; z-index:999999;
            background:rgba(20,22,28,0.97); border:1px solid #3a3f4b; border-radius:8px;
            padding:6px 12px; box-shadow:0 2px 10px rgba(0,0,0,0.5);
            font:11px/1 sans-serif; color:#8b93a7; cursor:pointer; user-select:none;
            text-transform:uppercase; letter-spacing:.5px;`;
        pill.textContent = '📝 Card notes';
        pill.onclick = () => setExpanded(true);
        document.body.appendChild(pill);

        box = document.createElement('div');
        box.id = 'poro-card-notes';
        box.style.cssText = `
            position:fixed; bottom:16px; right:16px; z-index:999999; width:280px;
            background:rgba(20,22,28,0.97); border:1px solid #3a3f4b; border-radius:8px;
            padding:9px 11px; box-shadow:0 2px 10px rgba(0,0,0,0.5);
            font-family:sans-serif; color:#cbd2e0;`;

        const head = document.createElement('div');
        head.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;';
        const label = document.createElement('span');
        label.textContent = 'Card notes';
        label.style.cssText = 'font-size:10px;text-transform:uppercase;letter-spacing:.5px;color:#8b93a7;';
        const right = document.createElement('span');
        right.style.cssText = 'display:flex;align-items:center;gap:8px;';
        const who = document.createElement('span');
        who.id = 'poro-note-who';
        who.title = 'Your initials (click to change)';
        who.style.cssText = 'font-size:10px;color:#6b7280;cursor:pointer;';
        who.onclick = () => { setInitials(true); };
        const collapse = document.createElement('span');
        collapse.textContent = '–';
        collapse.title = 'Minimize';
        collapse.style.cssText = 'font-size:16px;line-height:1;color:#8b93a7;cursor:pointer;padding:0 2px;';
        collapse.onclick = () => setExpanded(false);
        right.appendChild(who); right.appendChild(collapse);
        head.appendChild(label); head.appendChild(right);

        area = document.createElement('textarea');
        area.placeholder = 'Notes on pricing / choices for this card…';
        area.rows = 4;
        area.style.cssText = `width:100%;box-sizing:border-box;resize:vertical;
            background:#0f1117;border:1px solid #262a36;border-radius:5px;color:#e6e9ef;
            font-family:inherit;font-size:12px;padding:6px;`;
        area.addEventListener('input', () => { dirty = true; });
        area.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); save(); }
        });

        const foot = document.createElement('div');
        foot.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-top:6px;';
        status = document.createElement('span');
        status.style.cssText = 'font-size:10px;color:#6b7280;flex:1;margin-right:8px;line-height:1.3;';
        saveBtn = document.createElement('button');
        saveBtn.textContent = 'Save';
        saveBtn.style.cssText = `font-size:12px;padding:4px 12px;border-radius:5px;border:1px solid #2ea043;
            background:rgba(46,160,67,0.2);color:#3fb950;cursor:pointer;font-family:inherit;`;
        saveBtn.onclick = save;
        foot.appendChild(status); foot.appendChild(saveBtn);

        box.appendChild(head); box.appendChild(area); box.appendChild(foot);
        box.style.display = 'none';   // start minimized — the pill is the entry point
        document.body.appendChild(box);
        refreshWho();
    }

    function refreshWho() {
        const who = document.getElementById('poro-note-who');
        const ini = GM_getValue(INITIALS_KEY, '');
        if (who) who.textContent = ini ? ('you: ' + ini) : 'set initials';
    }
    function setInitials(force) {
        let ini = GM_getValue(INITIALS_KEY, '');
        if (ini && !force) return ini;
        const v = (prompt('Your initials for card notes (e.g. AH):', ini || '') || '').trim().slice(0, 16);
        if (v) { GM_setValue(INITIALS_KEY, v); refreshWho(); return v; }
        return ini;
    }

    function metaLine(rec) {
        if (!rec || !rec.updated_at) return 'No note yet.';
        const by = rec.author ? ('by ' + rec.author + ', ') : '';
        return 'Last edited ' + by + rec.updated_at.replace('T', ' ').slice(0, 16);
    }

    async function load() {
        const tcgId = getTcgId();
        if (!tcgId) return;
        if (tcgId === currentId) return;
        ensureBox();
        currentId = tcgId;
        dirty = false;
        status.textContent = 'Loading…';
        area.value = '';
        const rec = await apiGet(tcgId);
        // guard against a fast navigation having changed the product mid-fetch
        if (currentId !== tcgId) return;
        area.value = (rec && rec.note) || '';
        status.textContent = metaLine(rec);
        updatePill(rec);
        // Start open if this card already has a note, otherwise stay minimized.
        setExpanded(!!(rec && rec.note && rec.note.trim()));
    }

    async function save() {
        const tcgId = getTcgId();
        if (!tcgId) return;
        const author = setInitials(false);
        saveBtn.disabled = true;
        status.textContent = 'Saving…';
        const rec = await apiSave(tcgId, area.value, author);
        saveBtn.disabled = false;
        if (rec) { dirty = false; status.textContent = '✓ ' + metaLine(rec); updatePill(rec); }
        else { status.textContent = '⚠ save failed — try again'; }
    }

    // --- run + follow SPA navigation ---
    load();
    const fire = () => setTimeout(load, 400);
    ['pushState', 'replaceState'].forEach((t) => {
        const o = history[t];
        history[t] = function () { const r = o.apply(this, arguments); window.dispatchEvent(new Event('poro-loc')); return r; };
    });
    window.addEventListener('popstate', () => window.dispatchEvent(new Event('poro-loc')));
    window.addEventListener('poro-loc', fire);
    let last = location.href;
    setInterval(() => { if (location.href !== last) { last = location.href; fire(); } }, 1000);
})();
