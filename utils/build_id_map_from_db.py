#!/usr/bin/env python3
"""
Rebuild product-id-map-v2.json from the local Poromagia Docker DB.

Map format: { "<pokemon_card.id>": { "mcmId": "...", "tcgId": "..." } }

Sources (local Docker `db` container, poromysqldb):
  - mcmId  = pokemon_card.mcm_product_id  (authoritative, ~all cards)
  - tcgId  = pokemon_tcgplayerproductcatalog.tcgplayer_product_id, matched by
             (TCG set name, collector number):
               card.set_id --pokemon_setmapping--> tcgplayer_set_name == productcatalog.set_name
               card.collector_number (zero-pad normalized) == productcatalog.number split on '/'

Why a MERGE (not a clean regenerate):
  The TCG product IDs live in pokemon_tcgplayerproductcatalog (~58.7k rows), and ~98.5%
  of the existing map's TCG ids are present there. But linking a card to the right
  catalog row is imperfect: ~1.8k cards are ambiguous (a set+number has >1 catalog id,
  e.g. normal vs reverse-holo vs shadowless — productcatalog has no variant flag). So we
  merge mostly ADDITIVELY: fill tcgId where the map has none (incl. invalid "0"
  placeholders), and FLIP Base Set "(Shadowless)" -> Unlimited (Poromagia stock is
  Unlimited; Shadowless is rare — confirmed by Aarne). Any OTHER differing real id
  (e.g. promo printings under the same set+number) is left as-is. mcmId is refreshed
  from the DB for all cards. Never drops an entry.

Run with the Docker DB up:  python3 build_id_map_from_db.py
"""
import json
import re
import subprocess
import os

DB = ["docker", "exec", "db", "mysql", "-u", "poromysqluser", "-pporomysqlpwd",
      "poromysqldb", "-N", "-e"]
HERE = os.path.dirname(os.path.abspath(__file__))
MAP_PATH = os.path.join(HERE, "product-id-map-v2.json")


def q(sql):
    out = subprocess.run(DB + [sql], capture_output=True, text=True, check=True).stdout
    return [line.split("\t") for line in out.splitlines() if line]


def norm_num(n):
    """Collector number -> match key: take part before '/', strip leading zeros, upper."""
    n = (n or "").split("/")[0].strip().upper()
    return re.sub(r"^0+(?=\d)", "", n)


def main():
    # productcatalog: (set_name, normalized number) -> set of tcg product ids,
    # and tcg id -> set_name (to detect "(Shadowless)" variants).
    pc = {}
    pc_set = {}
    for tid, sname, num in q("SELECT tcgplayer_product_id, set_name, number "
                             "FROM pokemon_tcgplayerproductcatalog;"):
        pc.setdefault((sname, norm_num(num)), set()).add(tid)
        pc_set[tid] = sname

    # cards with their TCG set name (via setmapping reverse lookup)
    cards = q("""
        SELECT c.id, IFNULL(c.mcm_product_id,''), IFNULL(c.collector_number,''),
          IFNULL((SELECT sm.tcgplayer_set_name FROM pokemon_setmapping sm
                  WHERE sm.poro_set_id=c.set_id AND sm.tcgplayer_set_name<>'' LIMIT 1),'')
        FROM pokemon_card c;""")

    with open(MAP_PATH, encoding="utf-8") as f:
        merged = {k: dict(v) for k, v in json.load(f).items()}

    new_cards = tcg_filled = tcg_flipped = 0
    for cid, mcm, cnum, tset in cards:
        e = merged.get(cid)
        if e is None:
            e = {}
            new_cards += 1
        if mcm:
            e["mcmId"] = mcm
        if tset:
            ids = pc.get((tset, norm_num(cnum)))
            if ids and len(ids) == 1:          # only act on an UNAMBIGUOUS catalog match
                db_tcg = next(iter(ids))
                cur_tcg = e.get("tcgId")
                cur_absent = cur_tcg in (None, "", "0", 0)
                # flip Base Set "(Shadowless)" -> Unlimited: Poromagia stock is Unlimited,
                # Shadowless is rare (confirmed by Aarne). Only when the match resolves to a
                # non-shadowless product for the same set+number.
                cur_shadowless = (not cur_absent
                                  and "Shadowless" in pc_set.get(cur_tcg, "")
                                  and "Shadowless" not in pc_set.get(db_tcg, ""))
                if cur_absent:
                    e["tcgId"] = db_tcg
                    tcg_filled += 1
                elif cur_shadowless:
                    e["tcgId"] = db_tcg
                    tcg_flipped += 1
                # else: genuine differing real id (e.g. promo printings) -> keep existing
        if e:
            merged[cid] = e

    # indent=2 + sorted keys: matches the existing file and keeps future
    # regenerations diff-reviewable (real per-card changes, not a full rewrite).
    with open(MAP_PATH, "w", encoding="utf-8") as f:
        json.dump(merged, f, indent=2, sort_keys=True)

    mcm = sum(1 for v in merged.values() if v.get("mcmId"))
    tcg = sum(1 for v in merged.values() if v.get("tcgId"))
    print(f"entries: {len(merged)} (+{new_cards} new cards)")
    print(f"with MCM: {mcm}")
    print(f"with TCG: {tcg} ({tcg_filled} filled incl. '0' placeholders; "
          f"{tcg_flipped} Base Set shadowless->unlimited; other existing ids kept)")


if __name__ == "__main__":
    main()
