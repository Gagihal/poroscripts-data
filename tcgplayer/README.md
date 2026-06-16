# TCGplayer Scripts

Userscripts for TCGplayer product + Seller Admin pages.

**URL Patterns:** `https://www.tcgplayer.com/product/*` · `https://store.tcgplayer.com/admin/product/manage/*`

## Scripts

### tcgplayer-admin-card-notes.user.js (v1.2)
Minimizable "Card notes" box (bottom-right) on the Seller Admin product page
(`store.tcgplayer.com/admin/product/manage/<id>`). **Opens automatically when the card already has
a note**; otherwise starts minimized as a small pill — click to open, "–" to collapse. The pill
turns green with a dot ● when the current card has a note.
A single **shared** free-text note per card (pricing rationale, decisions), stored on the Poromagia
hub so every user with the script sees the same note. Shows the last editor's initials (set once per
browser via `GM_setValue`). Talks to `https://os.poromagia.com/api/card-notes/<id>` via
`GM_xmlhttpRequest` (no CORS/SSO needed). Ctrl/Cmd+Enter saves. SPA-aware.

**Installation:**
```
https://raw.githubusercontent.com/Gagihal/poroscripts-data/main/tcgplayer/tcgplayer-admin-card-notes.user.js
```

### tcgplayer-product-poro-links.user.js (v1.0)
Adds a small persistent floating box (bottom-right corner) on single-card product pages with
buttons to the matching **MCM** (Cardmarket), **PM** (Poromagia Store Manager) and **TCGA**
(TCGplayer Seller Admin) pages.

**How it works:**
- The TCG product ID comes from the page URL (`/product/<id>/`) — authoritative, so the **TCGA**
  link is always a direct `store.tcgplayer.com/admin/product/manage/<id>` link.
- That TCG ID is reverse-resolved through the shared ID map (TCG → Poro → MCM) for direct **MCM**
  (Cardmarket product page) and **PM** (Store Manager product-id) links. Colored left border = direct
  link (green MCM / purple PM / orange TCGA); no border on MCM/PM = search fallback built from the
  card name/number/set parsed from `document.title`.
- TCGplayer is a SPA — the box re-resolves automatically when you navigate between cards (history
  patch + URL poll), no reload needed.

**Installation:**
```
https://raw.githubusercontent.com/Gagihal/poroscripts-data/main/tcgplayer/tcgplayer-product-poro-links.user.js
```

**Note:** Cards missing from the ID map (e.g. irregular promos like League & Championship) fall back
to search links — expected; regular cards resolve to direct links.
