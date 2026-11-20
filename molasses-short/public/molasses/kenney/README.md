# public/molasses/kenney — the town dressing kit (CC0)

The world loads 24 props from this folder at runtime (`KENNEY` in
`src/videos/molasses/world.ts`); any missing file is simply skipped, but the
trees, stalls, lanterns, carts and the park dressing will be missing without
them.

## One-step install

```bash
python tools/build_public.py path/to/kenney_nature-kit.zip
```

That unpacks the kit's `models/*.glb` (or `Models/GLB format/*.glb`) into this
folder and renames them to the kebab/camel names the code expects.

## Manual install

1. Download **Kenney Nature Kit** (CC0) from https://kenney.nl/assets/nature-kit
   — the same kit the reference short uses, so the teal materials and the
   recolouring in `build.ts` hold.
2. Copy the GLB models you want into this folder and name them:

```
tree_oak, tree_default, tree_detailed, tree_fat, tree_cone, tree-high-round,
tree, plant_bushLarge, plant_bushDetailed, plant_bush, hedge, flower_redA,
flower_yellowA, flower_purpleA, grass_large, grass, lantern, cart, stall-red,
stall-green, stall-bench, banner-red, banner-green, windmill
```

3. `npx remotion still` will log nothing on success; missing props render as
   gaps, so compare against the shot list in `SCRIPT.md` to check coverage.

License: Kenney assets are CC0 — no attribution required (credit is welcome).
