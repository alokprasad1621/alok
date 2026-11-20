#!/usr/bin/env python3
"""Unpack a Kenney Nature Kit zip into public/molasses/kenney with the names world.ts expects.

Usage:  python tools/build_public.py path/to/kenney_nature-kit.zip [--dest public/molasses/kenney]

Kenney ships kebab-case names; the code loads a couple of camel-case ones, and older zips nest the
GLBs under "Models/GLB format/". This keeps only .glb files, renames, and reports the coverage of
the KENNEY list.
"""
import argparse
import os
import shutil
import sys
import zipfile

WANT = ["tree_oak", "tree_default", "tree_detailed", "tree_fat", "tree_cone", "tree-high-round", "tree",
        "plant_bushLarge", "plant_bushDetailed", "plant_bush", "hedge", "flower_redA", "flower_yellowA",
        "flower_purpleA", "grass_large", "grass", "lantern", "cart", "stall-red", "stall-green", "stall-bench",
        "banner-red", "banner-green", "windmill"]
ALIASES = {"tree_high_round": "tree-high-round", "treeHighRound": "tree-high-round",
           "plant_bush_large": "plant_bushLarge", "plant_bush_largeDetailed": "plant_bushDetailed",
           "plant_bushDetailed_detailed": "plant_bushDetailed", "stallRed": "stall-red",
           "stallGreen": "stall-green", "stallBench": "stall-bench", "bannerRed": "banner-red",
           "bannerGreen": "banner-green", "flower_red_a": "flower_redA", "flower_yellow_a": "flower_yellowA",
           "flower_purple_a": "flower_purpleA", "grass_large": "grass_large"}


def norm(name: str) -> str:
    stem = os.path.splitext(os.path.basename(name))[0]
    fixed = ALIASES.get(stem, ALIASES.get(stem.lower(), stem))
    return fixed if fixed in WANT else stem


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("zip")
    ap.add_argument("--dest", default=os.path.join("public", "molasses", "kenney"))
    args = ap.parse_args()
    os.makedirs(args.dest, exist_ok=True)
    got = set()
    with zipfile.ZipFile(args.zip) as z:
        for info in z.infolist():
            if not info.filename.lower().endswith(".glb"):
                continue
            name = norm(info.filename)
            if name not in WANT:
                continue
            with z.open(info) as f, open(os.path.join(args.dest, name + ".glb"), "wb") as out:
                shutil.copyfileobj(f, out)
            got.add(name)
    missing = [n for n in WANT if n not in got]
    print(f"{len(got)} props -> {args.dest}")
    if missing:
        print("missing (the loader skips them):", ", ".join(missing))
        return 1
    print("all props present")
    return 0


if __name__ == "__main__":
    sys.exit(main())
