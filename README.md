# Poroscripts Data

Browser userscripts for Pokemon card pricing and inventory management. These scripts integrate Poromagia's store system with external marketplaces (Cardmarket/MCM, TCGplayer) through ID-based direct linking.

## Features

- **Direct product links** using mapped IDs (Poromagia → MCM → TCGplayer)
- **Automatic search fallback** when IDs are unavailable
- **Daily cache refresh** for up-to-date mappings
- **Named window reuse** (tabs don't stack)

## Quick Start

Install these userscripts via Tampermonkey/Greasemonkey:

### Store Manager (poromagia.com/store_manager/pokemon/*)
- **MCM/TCG buttons**: [pokemng-mcmtcg-buttons-id.user.js](https://raw.githubusercontent.com/Gagihal/poroscripts-data/main/pokemng/pokemng-mcmtcg-buttons-id.user.js)
- **TCG Seller button** (TCGA): [pokemng-tcgseller-button.user.js](https://raw.githubusercontent.com/Gagihal/poroscripts-data/main/pokemng/pokemng-tcgseller-button.user.js)

### Creditor List (poromagia.com/*/admin/pokemon/creditorderitem/*)
- **T/M buttons**: [pokecreditor-mcmtcg-buttons.user.js](https://raw.githubusercontent.com/Gagihal/poroscripts-data/main/pokecreditor/pokecreditor-mcmtcg-buttons.user.js)
- **A button** (TCG Seller): [pokecreditor-tcgseller-button.user.js](https://raw.githubusercontent.com/Gagihal/poroscripts-data/main/pokecreditor/pokecreditor-tcgseller-button.user.js)

### Cardmarket Seller Pages (cardmarket.com/*/Pokemon/Users/*/Offers/Singles*)
- **TCGP/PM buttons**: [mcm-pkseller-mcmtcg-buttons.user.js](https://raw.githubusercontent.com/Gagihal/poroscripts-data/main/mcm-buy/mcm-pkseller-mcmtcg-buttons.user.js)

## Directory Structure

```
poroscripts-data/
├── utils/                    # Core utilities and data
│   ├── poro-search-utils.js  # Shared utility library (v1.8.2)
│   ├── product-id-map-v2.json # Card ID mappings (37k+ cards)
│   └── mcm-to-poromagia-setmap.json  # Set name translations
├── pokemng/                  # Store manager scripts
├── pokecreditor/             # Creditor list scripts
├── mcm-buy/                  # Cardmarket buying scripts
└── deprecated/               # Old script versions
```

## Architecture

All scripts share a common utility library:

```
Scripts → poro-search-utils.js → product-id-map-v2.json
                                  (Poro ID → MCM ID, TCG ID)
```

The JSON mapping enables direct product page links instead of search queries.

## Cache Management

Scripts cache the ID mapping in localStorage for 24 hours. To force a refresh:

```javascript
// Clear cache (run in browser console)
localStorage.removeItem('poro_product_id_map_v5');
localStorage.removeItem('poro_product_id_map_ts_v5');
```

## Documentation

- [Utils & Data Pipeline](utils/README.md) - JSON format, API reference, maintenance
- [Store Manager Scripts](pokemng/README.md)
- [Creditor List Scripts](pokecreditor/README.md)
- [Cardmarket Scripts](mcm-buy/README.md)

## License

Internal use only - Poromagia
