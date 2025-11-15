# Pokemon Store Manager Scripts

Userscripts for the Poromagia Store Manager interface.

**URL Pattern:** `https://poromagia.com/store_manager/pokemon/*`

## Scripts

### pokemng-mcmtcg-buttons-id.user.js (v5.9)
Adds MCM and TCG buttons to each card row.

**Features:**
- **MCM button** - Opens Cardmarket product page (green border = direct link)
- **TCG button** - Opens TCGplayer product page (blue border = direct link)
- **Automatic search** - Opens both sites automatically when filter form is submitted
- **NO CARD handling** - Skips invalid rows, finds first valid card for auto-search

**Installation:**
```
https://raw.githubusercontent.com/Gagihal/poroscripts-data/main/pokemng/pokemng-mcmtcg-buttons-id.user.js
```

### pokemng-tcgseller-button.user.js (v1.2)
Adds TCGA button for TCGplayer Seller Admin access.

**Features:**
- **TCGA button** - Opens TCGplayer Seller Admin page (orange border = direct link)
- **Direct URL:** `store.tcgplayer.com/admin/product/manage/{tcgId}`
- **Fallback URL:** `store.tcgplayer.com/admin/product/catalog?SearchValue={query}`
- **Automatic search** - Opens Seller Admin when filter form is submitted
- **NO CARD handling** - Skips invalid rows

**Installation:**
```
https://raw.githubusercontent.com/Gagihal/poroscripts-data/main/pokemng/pokemng-tcgseller-button.user.js
```

**Note:** This is a separate script for selective distribution (seller access only).

## Button Location

Buttons appear in the **4th column (ID column)** of the table, stacked vertically:
```
MCM
TCG
TCGA  (if both scripts installed)
```

## How It Works

1. Script waits for table to load
2. For each row, extracts:
   - Card name from `td.name`
   - Set name from 6th column
   - Poro Card ID from `td a[href*="link-product-card"]`
3. Uses `PoroSearch.createSearchButtons()` or `PoroSearch.createTcgSellerButton()` to create buttons
4. Buttons use ID mapping for direct links when available
5. MutationObserver handles dynamically loaded rows

## Automatic Search

When the filter form (`#filterer`) is submitted:
1. Script sets a pending flag
2. As new rows load, it finds the first valid card (not "NO CARD")
3. Automatically opens the external site(s) for that card
4. Only triggers once per form submission

## DOM Structure Expected

```html
<table>
  <tbody>
    <tr>
      <td class="name">Pikachu 025/198</td>
      <td>...</td>
      <td>...</td>
      <td>ID column (buttons go here)</td>
      <td>...</td>
      <td>Set Name</td>
      ...
      <td>
        <a href="...link-product-card...">Card ID</a>
      </td>
    </tr>
  </tbody>
</table>
```

## Dependencies

Both scripts require:
- `poro-search-utils.js` (loaded via `@require`)
- `product-id-map-v2.json` (fetched automatically)
