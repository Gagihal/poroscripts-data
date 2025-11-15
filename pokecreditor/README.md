# Pokemon Creditor List Scripts

Userscripts for the Poromagia Creditor List admin interface.

**URL Pattern:** `https://poromagia.com/*/admin/pokemon/creditorderitem/*`

## Scripts

### pokecreditor-mcmtcg-buttons.user.js (v2.9)
Adds compact T and M buttons after the Condition column.

**Features:**
- **T button** - Opens TCGplayer product page (blue border = direct link)
- **M button** - Opens Cardmarket product page (green border = direct link)
- **Alt+Click on M** - Uses backup search query
- **Compact styling** - Small pills that fit the admin interface

**Installation:**
```
https://raw.githubusercontent.com/Gagihal/poroscripts-data/main/pokecreditor/pokecreditor-mcmtcg-buttons.user.js
```

### pokecreditor-tcgseller-button.user.js (v1.1)
Adds compact A button for TCGplayer Seller Admin access.

**Features:**
- **A button** - Opens TCGplayer Seller Admin page (orange border = direct link)
- **Direct URL:** `store.tcgplayer.com/admin/product/manage/{tcgId}`
- **Fallback URL:** `store.tcgplayer.com/admin/product/catalog?SearchValue={query}`
- **Compact styling** - Matches T/M button style

**Installation:**
```
https://raw.githubusercontent.com/Gagihal/poroscripts-data/main/pokecreditor/pokecreditor-tcgseller-button.user.js
```

**Note:** This is a separate script for selective distribution (seller access only).

## Button Location

Buttons appear in a **new cell inserted after the Condition column**, displayed inline:
```
[T] [M] [A]
```

## How It Works

1. Script waits for `#result_list` table to load
2. For each row, extracts:
   - Card name from `th.field-card_name`
   - Card identifier from `td.field-card_identifier` (includes number and set)
   - Card ID from `td.field-card_id`
3. Parses identifier: `"(#025) – Ultra Rare – Evolving Skies"`
4. Creates buttons using `PoroSearch.createSearchButtons()` or `PoroSearch.createTcgSellerButton()`
5. Inserts new table cell after Condition
6. MutationObserver handles dynamically loaded rows

## Data Extraction

The creditor list uses different column structure than store manager:

```html
<tr>
  <th class="field-card_name">Pikachu 025/198</th>
  <td class="field-card_identifier">(#025) – Ultra Rare – Evolving Skies</td>
  <td class="field-card_id">25423</td>
  <td class="field-condition">NM</td>
  <!-- New button cell inserted here -->
</tr>
```

### Identifier Parsing
```
"(#025) – Ultra Rare – Evolving Skies"
  ↓
Parts: ["(#025)", "Ultra Rare", "Evolving Skies"]
  ↓
Set name: "Evolving Skies" (last part)
Number: "025" (from #xxx pattern)
```

## Button Styling

```css
.pm-tm-btn {
  padding: 1px 6px;
  border: 1px solid #888;
  background: #eee;
  border-radius: 4px;
  font: 11px system-ui, sans-serif;
  cursor: pointer;
}
```

Responsive: Smaller at `max-width: 900px`

## Dependencies

Both scripts require:
- `poro-search-utils.js` (loaded via `@require`)
- `product-id-map-v2.json` (fetched automatically)

## Coexistence

Both scripts can run simultaneously without conflicts:
- T/M script uses flag: `row._pmTinyDone`
- A script uses flag: `row._pmTcgSellerDone`
- Both insert their own cells and track separately
