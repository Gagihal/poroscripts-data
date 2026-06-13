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
  merge ADDITIVELY: keep every existing tcgId, only fill in where the current map has
  none. mcmId is refreshed from the DB for all cards. This never regresses coverage.

  KNOWN conflict class (NOT overwritten): ~192 Base Set cards where the current map points
  at "Base Set (Shadowless)" but the set+number match resolves to plain "Base Set"
  (Unlimited). Which is correct is a printing-variant decision — left to a human.

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
    # productcatalog: (set_name, normalized number) -> set of tcg product ids
    pc = {}
    for tid, sname, num in q("SELECT tcgplayer_product_id, set_name, number "
                             "FROM pokemon_tcgplayerproductcatalog;"):
        pc.setdefault((sname, norm_num(num)), set()).add(tid)

    # cards with their TCG set name (via setmapping reverse lookup)
    cards = q("""
        SELECT c.id, IFNULL(c.mcm_product_id,''), IFNULL(c.collector_number,''),
          IFNULL((SELECT sm.tcgplayer_set_name FROM pokemon_setmapping sm
                  WHERE sm.poro_set_id=c.set_id AND sm.tcgplayer_set_name<>'' LIMIT 1),'')
        FROM pokemon_card c;""")

    with open(MAP_PATH, encoding="utf-8") as f:
        merged = {k: dict(v) for k, v in json.load(f).items()}

    before = sum(1 for v in merged.values() if v.get("tcgId"))
    new_cards = tcg_filled = 0
    for cid, mcm, cnum, tset in cards:
        e = merged.get(cid)
        if e is None:
            e = {}
            new_cards += 1
        if mcm:
            e["mcmId"] = mcm
        if tset and not e.get("tcgId"):
            ids = pc.get((tset, norm_num(cnum)))
            if ids and len(ids) == 1:          # only fill on an UNAMBIGUOUS match
                e["tcgId"] = next(iter(ids))
                tcg_filled += 1
        if e:
            merged[cid] = e

    with open(MAP_PATH, "w", encoding="utf-8") as f:
        json.dump(merged, f, separators=(",", ":"), sort_keys=True)

    mcm = sum(1 for v in merged.values() if v.get("mcmId"))
    tcg = sum(1 for v in merged.values() if v.get("tcgId"))
    print(f"entries: {len(merged)} (+{new_cards} new cards)")
    print(f"with MCM: {mcm}")
    print(f"with TCG: {tcg} (+{tcg_filled} filled where map had none; existing preserved)")


if __name__ == "__main__":
    main()
