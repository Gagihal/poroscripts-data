# Utils - Core Library & Data Pipeline

This folder contains the shared utility library and ID mapping data that powers all Poroscripts.

## Files

### poro-search-utils.js (v1.8.2)
The core utility library loaded by all userscripts. Provides:
- Card ID lookups (Poro → MCM, TCG)
- Button creation functions
- Query builders and URL constructors
- Caching system

### product-id-map-v2.json
Three-way mapping between card database IDs:
- **35,572 unique Poromagia card IDs**
- 34,410 with TCGplayer IDs
- 37,495 with Cardmarket IDs

### mcm-to-poromagia-setmap.json
Set name translations between Cardmarket and Poromagia naming conventions (175 sets).

---

## JSON Format: product-id-map-v2.json

```json
{
  "PoroCardId": {
    "mcmId": "CardmarketProductId",
    "tcgId": "TcgplayerProductId"
  },
  "1549": {
    "mcmId": "273696",
    "tcgId": "42346"
  },
  "25423": {
    "mcmId": "275060",
    "tcgId": "83681"
  }
}
```

**Key:** Poromagia internal card ID (string)
**Value:** Object with:
- `mcmId` - Cardmarket product ID (used for direct links)
- `tcgId` - TCGplayer product ID (used for direct links)

---

## Data Pipeline

### Source Data
Google Sheets: `2025-11 Pokemon MCM Tcg Poromagia id match - CardKaikki.csv`

CSV columns:
```
CardId, McmId, TcgplayerProductId, CanonicalProduct, Porosetti, McmSetti, TcgSetti
```

### Conversion Script (Python)
```python
import csv
import json

input_file = '2025-11 Pokemon MCM Tcg Poromagia id match - CardKaikki.csv'
output_file = 'product-id-map-v2.json'

mapping = {}

with open(input_file, 'r', encoding='utf-8') as f:
    reader = csv.DictReader(f)
    for row in reader:
        card_id = row.get('CardId', '').strip()
        mcm_id = row.get('McmId', '').strip()
        tcg_id = row.get('TcgplayerProductId', '').strip()

        if not card_id or card_id == '0':
            continue

        if mcm_id or tcg_id:
            mapping[card_id] = {
                'mcmId': mcm_id if mcm_id else '',
                'tcgId': tcg_id if tcg_id else ''
            }

with open(output_file, 'w', encoding='utf-8') as f:
    json.dump(mapping, f, indent=2, ensure_ascii=False)
```

### Update Procedure
1. Export updated sheet as CSV to `utils/` folder
2. Run the Python conversion script
3. Commit and push `product-id-map-v2.json`
4. Users get new data on next cache refresh (24h) or by clearing cache

---

## Caching System

### How It Works
1. Scripts load `poro-search-utils.js` via `@require`
2. On first ID lookup, the library fetches `product-id-map-v2.json` from GitHub
3. Data is cached in localStorage with timestamp
4. Cache expires after **24 hours** (configurable via `IDMAP_CACHE_MS`)
5. Cache version is part of the key - new versions force refresh

### Cache Keys (v1.8.2)
```javascript
const IDMAP_LS_KEY = 'poro_product_id_map_v5';    // Cached JSON data
const IDMAP_LS_TS  = 'poro_product_id_map_ts_v5'; // Timestamp
const IDMAP_CACHE_MS = 24 * 3600 * 1000;          // 24 hours
```

### Force Cache Refresh
```javascript
// Clear product ID cache
localStorage.removeItem('poro_product_id_map_v5');
localStorage.removeItem('poro_product_id_map_ts_v5');

// Clear all Poro caches
Object.keys(localStorage).filter(k => k.includes('poro')).forEach(k => localStorage.removeItem(k));

// Verify cleared
console.log('Cleared:', localStorage.getItem('poro_product_id_map_v5') === null);
```

### Version Bumping
When updating the JSON structure or forcing client refresh:
1. Increment cache version: `v5` → `v6`
2. Update keys in `poro-search-utils.js`
3. Bump library version number
4. Clients automatically fetch fresh data

---

## API Reference: poro-search-utils.js

### ID Lookup Functions

```javascript
// Get MCM product ID from Poro card ID
const mcmId = await PoroSearch.getMcmId('25423');
// Returns: "275060"

// Get TCGplayer product ID from Poro card ID
const tcgId = await PoroSearch.getTcgId('25423');
// Returns: "83681"

// Reverse lookup: Poro ID from MCM ID
const poroId = await PoroSearch.getPoroIdFromMcm('275060');
// Returns: "25423"

// Reverse lookup: Poro ID from TCG ID
const poroId = await PoroSearch.getPoroIdFromTcg('83681');
// Returns: "25423"
```

### URL Builders

```javascript
// Build direct URLs (returns null if ID is 0 or not found)
const mcmUrl = await PoroSearch.buildMcmDirectUrl('25423');
// Returns: "https://www.cardmarket.com/Pokemon/Products?idProduct=275060"

const tcgUrl = await PoroSearch.buildTcgDirectUrl('25423');
// Returns: "https://www.tcgplayer.com/product/83681"

// Build search URLs (fallback)
const tcgSearchUrl = PoroSearch.buildTcgUrl('glaceon vmax');
// Returns: "https://www.tcgplayer.com/search/pokemon/product?Language=English&..."

const mcmSearchUrl = PoroSearch.buildMcmSearchUrl('glaceon vmax');
// Returns: "https://www.cardmarket.com/en/Pokemon/Products/Search?searchString=..."
```

### Button Creation Functions

All button functions handle the direct link vs search fallback logic automatically.

```javascript
// TCGplayer button (default text: "T")
const tcgBtn = await PoroSearch.createTcgButton({
  name: 'Glaceon VMAX',
  setFull: 'Evolving Skies',
  cardId: '25423'  // Poro card ID
}, {
  text: 'TCG',
  className: 'my-btn',
  style: 'padding:4px;',
  elementType: 'button',        // or 'a'
  showDirectIndicator: true     // Blue border if direct link
});

// Cardmarket button (default text: "M")
const mcmBtn = await PoroSearch.createMcmButton({...}, {
  text: 'MCM',
  // ... same options
  // Green border if direct link
});

// TCGplayer Seller Admin button (default text: "TCGA")
const tcgaBtn = await PoroSearch.createTcgSellerButton({...}, {
  text: 'TCGA',  // or 'A' for compact
  // ... same options
  // Orange border if direct link
  // Opens: store.tcgplayer.com/admin/product/manage/{tcgId}
});

// Poromagia search button (default text: "PM")
const pmBtn = PoroSearch.createPmButton({
  name: 'Glaceon VMAX',
  setFull: 'Evolving Skies'
}, {
  text: 'PM',
  // ... same options
});

// Create TCG + MCM buttons together
const { tcgButton, mcmButton } = await PoroSearch.createSearchButtons(cardData, {
  tcgText: 'T',
  mcmText: 'M',
  tcgClassName: 'pm-btn',
  mcmClassName: 'pm-btn'
});
```

### Helper Functions

```javascript
// Clean card name (removes special characters)
const clean = PoroSearch.sanitize('Pikachu VMAX (Full Art)');
// Returns: "pikachu vmax"

// Split name and number
const { name, num } = PoroSearch.splitNameNum('Pikachu 025/198');
// Returns: { name: "Pikachu", num: "025" }

// Open URL in named window (reuses tab)
PoroSearch.openNamed('https://tcgplayer.com/...', 'TCGWindow');

// Build search queries with set info
const query = PoroSearch.buildTcgQuery({
  name: 'Glaceon VMAX',
  setFull: 'Evolving Skies'
});
// Returns: "glaceon vmax skies"

const { primary, backup } = await PoroSearch.buildMcmQuery({
  name: 'Glaceon VMAX',
  setFull: 'Evolving Skies',
  number: '025'
});
// Returns queries with set abbreviations
```

### Preloading & Configuration

```javascript
// Preload ID map (improves first-click performance)
PoroSearch.preloadIdMap().catch(() => {});

// Check library version
console.log('Version:', PoroSearch.version);
// Returns: "1.8.2"
```

---

## Handling Invalid IDs

The library treats certain ID values as invalid and falls back to search:

- `null` or `undefined`
- Empty string `""`
- Zero as number `0`
- Zero as string `"0"`

This prevents broken URLs like `tcgplayer.com/product/0` and ensures proper fallback behavior.

---

## Visual Indicators

Buttons show colored left borders to indicate link type:
- **Blue** (`#2196F3`) - Direct TCGplayer link
- **Green** (`#4CAF50`) - Direct Cardmarket link
- **Orange** (`#FF9800`) - Direct TCG Seller Admin link
- **No border** - Using search fallback

---

## Maintenance Tasks

### Adding a new card ID mapping
1. Update the source Google Sheet
2. Export to CSV
3. Regenerate JSON with Python script
4. Push to GitHub

### Fixing a single ID
```bash
# Use Python to edit product-id-map-v2.json
# Or use text editor with JSON formatting
git add utils/product-id-map-v2.json
git commit -m "Fix: Update TCG ID for card XXXXX"
git push
```

### Forcing all users to refresh
1. Bump cache version in `poro-search-utils.js`:
   ```javascript
   const IDMAP_LS_KEY = 'poro_product_id_map_v6';  // was v5
   const IDMAP_LS_TS  = 'poro_product_id_map_ts_v6';
   ```
2. Update library version number
3. Commit and push

---

## Troubleshooting

### Check current cache status
```javascript
// In browser console
const ts = localStorage.getItem('poro_product_id_map_ts_v5');
const age = ts ? (Date.now() - parseInt(ts)) / 1000 / 3600 : 'No cache';
console.log('Cache age (hours):', age);
```

### Verify ID lookup
```javascript
const result = await PoroSearch.getTcgId('25423');
console.log('TCG ID:', result);
// Should return: "83681"
```

### Debug button creation
Buttons log to console:
```
[PoroSearch] getTcgId lookup: { poroId: "25423", mapSize: 35572, result: "83681" }
```
