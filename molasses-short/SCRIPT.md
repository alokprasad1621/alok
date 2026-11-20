# "The Wave That Was Slower Than Water" — script + fact sheet

The Great Molasses Flood (Boston North End, 15 January 1919). Vertical 2K short
(1440×2560 render of the 1080×1920 composition), 12 sentences, ~66 s at the
skill pacing of 3.7 words/s, one steady voice, no captions, text-free imagery.

## Sources

All facts spoken in the film:

1. Wikipedia, "Great Molasses Flood" — casualty count, tank size, wave, Jell's
   lack of engineering experience, no water test, painted brown to hide leaks,
   residents collecting drips, causes (warm snap after a cold snap, thin steel,
   brittle low-manganese steel, fatigue crack at a manhole/rivet holes).
   https://en.wikipedia.org/wiki/Great_Molasses_Flood
2. Mayville, Ronald A. (Simpson Gumpertz & Heger), 2014 modern engineering
   analysis, reported in Schworm, The Boston Globe, "Nearly a century later,
   structural flaw in molasses tank revealed": the steel plates were about
   50 % too thin even by 1919 standards; flawed rivet design; stresses
   concentrated at rivet holes where the crack first grew. (Also History.com:
   walls 0.67 in at the base to 0.31 in at the top.)
3. Puleo, Stephen. *Dark Tide: The Great Boston Molasses Flood of 1919*,
   Beacon Press, 2003 — the tank groaning and "weeping", complaints and
   buckets, the lawsuits, the aftermath, the lingering smell stories.
4. NPR, "A Deadly Tsunami Of Molasses In Boston's North End" (2019): the
   lawsuit "used expert witnesses for the first time and was the catalyst for
   new regulations governing architects and engineers."
5. Smithsonian Magazine, "The Sticky Science Behind the Deadly Boston Molasses
   Disaster" (2016) — wave ~25 ft high, ~35 mph; 2.3 million gallons.

Numbers spoken in the film, rounded for voice: 50 ft tank (source 1), two
million gallons (2.3 M, source 5), "half past twelve" (the burst was ~12:40),
two-storey wave (25 ft), 35 mph, "thirty years" of the candy smell (decades).

NOT spoken, and why the script avoids it: the "built in fifteen days" figure
circulates in retrospectives but could not be pinned to a primary source, so
sentence 10 says only "in a rush / half as thick / never tested with water" —
all three directly sourced (2, 1).

## The spoken script (frozen — `tools/retime.py` SENTENCES must match word-for-word)

1. A wave of molasses once buried a Boston street faster than anyone could run.
2. January 1919: Boston's new fifty foot tank holds two million gallons of
   syrup, right beside homes, a firehouse, and an elevated train.
3. For two years the tank groaned and wept at the seams, and the neighbours
   just brought buckets.
4. But today is the first warm day after a cold snap, and the whole tank is
   awake.
5. Wait. How does warm weather scare a metal tank?
6. By noon the groans are so loud that workers phone the office, and the
   office says it's fine.
7. At half past twelve, the rivets fire off like rifle shots, the plates
   unzip, and the street disappears under a two storey wave going thirty five
   miles an hour.
8. Luckily, molasses is thicker than water. Unluckily, molasses at thirty
   five miles an hour is thicker than you.
9. You see, syrup in a sealed tank pushes on the sides like soda in a can you
   just shook.
10. And this can went up in a rush, from steel half as thick as the rules
    wanted, and was never once tested with water.
11. Afterwards, the survivors brought the first class action against a big
    company, and now every large tank needs a real engineer's stamp.
12. And for thirty years, the North End smelled of candy every time summer
    came around.

## Voice direction

One steady storyteller, slightly amused, warm; slow down ~5 % on sentences
7 and 10, land "unzip" and "shook" clean (each carries a camera kick and an
effect), smile on "candy". Record at ≥ 48 kHz mono, then export audio words.json
with word timestamps (Whisper `--word_timestamps true`, or wav2vec2 forced
alignment) and run `python tools/retime.py` — every shot boundary, camera key
and kick re-derives from it.

## Picture plan (15 shots; timings regenerate from words.json)

| # | Words | Light | What happens |
|---|-------|-------|--------------|
| 1 | hook | day | flash-forward: flying low with the surge down Commercial Street, cut on a 4-frame white flash |
| 2 | s1 | day | aerial of the North End: the tank on its pad, the corridor street, sinking in on "tank"/"gallons" |
| 3 | s2 | day | low at the pad foot: strollers, the seam and its drip pool, the bucket line, closer on "buckets" |
| 4 | s3 | day | the tank in full across the street; first warm day light |
| 5 | s4 | day | rivet-seam close-up at ear height ("Wait.") |
| 6 | s5 | day | a worker listening at the wall, cut to the phone man at "phone" |
| 7 | s6 → burst | day | the seam CU; rivet cracks punch on "rifle shots"; the street-side shell swings open on "unzip" |
| 8 | s6 → wave | day | high down the street; the front swallows it on "disappears", down to street level on "wave" |
| 9 | s7 | day | the street at face height, everyone runs at the lens |
| 10 | s7 → s8 | day | water-level among the stuck ones, sitting deep as the flood settles |
| 11 | s8 → s9 | golden | calm wide over the lake, the opened tank behind ("You see,") |
| 12 | s9 | golden | the kid shakes the soda bottle at the stoop; the cork pops on "shook" (kick + foam) |
| 13 | s10 | golden | the opened tank from its street side, cut to the fallen plates on "steel" |
| 14 | s11 | day | the fireman nails the new rule onto the sign; three hammer blows on "real engineer's stamp" |
| 15 | s12 | day | the stoop kids and the cleanup, crane out over the street for the smell callback |

Punch word anchors (frames regenerate via words.json): rivets "rifle" 932,
burst "unzip" 964, wave wide "street" 989, lid lands burst + 2.6 s, pop
"shook" 1410, hammer blows "real engineer's stamp" 1780/1788/1796. Impacts get
a 7-frame flip-sign camera kick; faces swap expressions 0–3 frames before
their word; every hold pushes in 0.15–0.35 %/frame.
