#!/usr/bin/env python3
"""
Convert the CardKaikki CSV to a JSON map with both MCM and TCGplayer IDs.
Format: { "cardId": { "mcmId": "xxx", "tcgId": "yyy" } }
"""

import csv
import json

def convert_csv_to_json(csv_path, json_path):
    id_map = {}

    with open(csv_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)

        for row in reader:
            card_id = row['CardId'].strip()
            mcm_id = row['McmId'].strip()
            tcg_id = row['TcgplayerProductId'].strip()

            # Skip empty card IDs
            if not card_id:
                continue

            # Build the entry
            entry = {}

            # Add MCM ID if present
            if mcm_id:
                entry['mcmId'] = mcm_id

            # Add TCGplayer ID if present
            if tcg_id:
                entry['tcgId'] = tcg_id

            # Only add to map if at least one ID exists
            if entry:
                id_map[card_id] = entry

    # Write to JSON
    with open(json_path, 'w', encoding='utf-8') as f:
        json.dump(id_map, f, separators=(',', ':'))

    # Print statistics
    total_cards = len(id_map)
    cards_with_mcm = sum(1 for v in id_map.values() if 'mcmId' in v)
    cards_with_tcg = sum(1 for v in id_map.values() if 'tcgId' in v)
    cards_with_both = sum(1 for v in id_map.values() if 'mcmId' in v and 'tcgId' in v)

    print(f"Conversion complete!")
    print(f"Total cards: {total_cards}")
    print(f"Cards with MCM ID: {cards_with_mcm}")
    print(f"Cards with TCGplayer ID: {cards_with_tcg}")
    print(f"Cards with both IDs: {cards_with_both}")
    print(f"Output written to: {json_path}")

if __name__ == '__main__':
    csv_path = '2025-11 Pokemon MCM Tcg Poromagia id match - CardKaikki.csv'
    json_path = 'product-id-map-v2.json'
    convert_csv_to_json(csv_path, json_path)
