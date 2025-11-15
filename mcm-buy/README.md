# Cardmarket Buying Scripts

Userscripts for browsing Pokemon cards on Cardmarket seller pages.

**URL Pattern:** `https://www.cardmarket.com/*/Pokemon/Users/*/Offers/Singles*`

## Scripts

### mcm-pkseller-mcmtcg-buttons.user.js (v2.9)
Adds TCGP and PM buttons next to each card name on seller's Singles page.

**Features:**
- **TCGP button** - Opens TCGplayer product page (blue border = direct link)
- **PM button** - Opens Poromagia store manager search
- **MCM ID extraction** - Extracts product ID from card image URLs
- **Reverse ID lookup** - MCM ID → Poro ID → TCG ID for direct links
- **Set name mapping** - Translates MCM set names to Poromagia equivalents
- **Dark theme styling** - Pills that match Cardmarket's interface

**Installation:**
```
https://raw.githubusercontent.com/Gagihal/poroscripts-data/main/mcm-buy/mcm-pkseller-mcmtcg-buttons.user.js
```

## Button Location

Buttons appear at the **right side of the card name cell**, using flexbox spacing:
```
Card Name                    [TCGP] [PM]
```

## How It Works

1. Script loads set name mapping (`mcm-to-poromagia-setmap.json`)
2. For each card row in `#UserOffersTable`:
   - Extracts card name from link
   - Extracts set name from expansion symbol tooltip
   - Extracts MCM product ID from card image URL
3. Does reverse lookup: MCM ID → Poro ID
4. Uses Poro ID to get TCG ID for direct link
5. Maps MCM set name to Poromagia set name for PM search
6. Creates TCGP and PM buttons
7. MutationObserver handles dynamically loaded rows

## Data Extraction

### Card Name
```html
<a href="/Pokemon/Products/Singles/...">Pikachu (PK 14)</a>
```
Extracts: "Pikachu" (text before parentheses)

### Set Name
```html
<a class="expansion-symbol" title="Power Keepers">...</a>
```
Extracts: "Power Keepers"

### MCM Product ID
From card thumbnail tooltip:
```html
<div data-bs-title="<img src='https://product-images.s3.cardmarket.com/51/BS/273740/273740.jpg' />">
```
Extracts: "273740" (from URL pattern)

## Set Name Mapping

MCM and Poromagia use different set naming conventions:
```javascript
// mcm-to-poromagia-setmap.json
{
  "151": "Scarlet & Violet 151",
  "Obsidian Flames": "Scarlet & Violet Obsidian Flames",
  "Power Keepers": "Power Keepers"
}
```

Cache: 7 days in localStorage

## Reverse ID Lookup Flow

```
MCM Page → Extract MCM Product ID
              ↓
         getPoroIdFromMcm(mcmId)
              ↓
         Poro Card ID
              ↓
         getTcgId(poroId)
              ↓
         TCGplayer Product ID
              ↓
         Build Direct URL
```

This enables cross-platform linking even when starting from Cardmarket.

## Button Styling

```javascript
const PILL_STYLE = `
  display: inline-block;
  font-size: 10px;
  padding: 2px 4px;
  margin-left: 4px;
  border-radius: 4px;
  border: 1px solid #888;
  background: #1a1a1a;
  color: #fff;
  cursor: pointer;
`;
```

Designed for Cardmarket's dark theme.

## Dependencies

- `poro-search-utils.js` (loaded via `@require`)
- `product-id-map-v2.json` (fetched automatically)
- `mcm-to-poromagia-setmap.json` (fetched automatically)

## Use Case

When browsing a seller's inventory on Cardmarket:
1. See a card you want to compare prices
2. Click TCGP to check TCGplayer pricing
3. Click PM to check Poromagia's inventory/pricing

The direct links save time vs manual searching.
