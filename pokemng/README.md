# Pokemon Store Manager Scripts

Userscripts for the Poromagia Store Manager interface.

**URL Pattern:** `https://poromagia.com/store_manager/pokemon/*`

## Scripts

### pokemng-mcmtcg-buttons-id.user.js (v5.11) — MCM / TCG / TCGA (combined)
Adds three buttons per card row, one per column: **TCGA** in the Hidden column, **MCM** in the
Autohide column, **TCG** in the ID column (the 🔥 removal column is skipped). Combines the old
mcmtcg + tcgseller scripts into one.

**Features:**
- **MCM button** - Opens Cardmarket product page (green border = direct link)
- **TCG button** - Opens TCGplayer product page (blue border = direct link)
- **TCGA button** - Opens TCGplayer Seller Admin (`store.tcgplayer.com/admin/product/manage/{tcgId}`; orange border = direct link)
- **Automatic search** - Opens all three sites automatically when the filter form is submitted
- **NO CARD handling** - Skips invalid rows, finds first valid card for auto-search

**Installation:**
```
https://raw.githubusercontent.com/Gagihal/poroscripts-data/main/pokemng/pokemng-mcmtcg-buttons-id.user.js
```

### pokemng-tcgseller-button.user.js — DEPRECATED
Merged into the combined script above. This is now a no-op stub so installed copies auto-update and
stop adding a duplicate TCGA button; safe to delete from Tampermonkey.

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
