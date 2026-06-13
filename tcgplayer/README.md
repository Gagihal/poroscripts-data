# TCGplayer Scripts

Userscripts for TCGplayer product pages.

**URL Pattern:** `https://www.tcgplayer.com/product/*`

## Scripts

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
