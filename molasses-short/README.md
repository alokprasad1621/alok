# molasses-short — "The Wave That Was Slower Than Water"

A render-ready Remotion project for a 66 s vertical (1080×1920 @ 30 fps,
render 2K with `--scale 1.3333`) animated short about the Great Molasses Flood
(Boston, 1919), built with the cartoon-3d-short skill's pipeline:
flat inked characters as camera-facing cards in a 3D toon world, two-tone
lighting, thin-lens depth of field, ink pass, per-shot grade, word-timed
everything.

Everything is timed to `voice/words.json` → `src/videos/molasses/timings.ts`.
Re-record the voice, re-run one script, and every shot boundary, camera key,
kick, effect and audio cue re-times with it.

## Requirements

- Node 20+ and npm (Remotion 4.0.245, three 0.169)
- A GPU browser for rendering (Chrome/Edge); set `CHROME_PATH` if Remotion
  can't find one. Headless CPU-only machines: add `GL=swiftshader` for stills
  (`GL=swiftshader node scripts/molasses-stills.mjs ...`).
- Python 3.11+ with numpy + scipy for the audio pipeline (`pip install numpy scipy`)
- ffmpeg for the final mux

## Setup

1. `npm install`
2. The 3D town dresses itself from Kenney Nature Kit (CC0) GLBs: see
   `public/molasses/kenney/README.md` (or
   `python tools/build_public.py kenney_nature-kit.zip`). Any missing prop is
   skipped, but the trees/stalls/carts are framing furniture — install them.
3. `python tools/retime.py` — keeps the provisional 3.7 w/s pacing, or reads
   your real `voice/words.json` when you add one.

## Voice

> **The bundled `voice/voice.wav` is a placeholder**: machine TTS
> (espeak-ng, per-sentence speed-fitted into the plan's sentence slots,
> 48 kHz stereo, exactly the composition length). Replace it with a real
> recording, regenerate `voice/words.json` with word timestamps from the
> same transcript, and re-run the two commands below — every shot, camera
> key, kick and audio cue re-times from them.

`voice/voice.wav` + `voice/words.json` (word timestamps; the script and the
fact sheet are in `SCRIPT.md`). Shapes accepted by retime.py: a list of
`{"word", "start"}` (whisper), pairs, or `{"words": [...]}`. Then:

```
python tools/retime.py            # rewrites src/videos/molasses/timings.ts
python audio/mix.py               # renders the music/sfx stems + the final cue report
```

`audio/timeline.py` mirrors the picture timeline for the audio side; if you
re-run retime.py after a re-record, refresh the constants at its top
(TOTAL / SHOTS / HITS / RIVETS / BURST / SHOOK / FLASH).

## Stills + render

```
CHROME_PATH="/path/to/chrome" npm run still   # out/still/x_<frame>.jpg at 0.5 scale
npm run render                                # 1080x1920 -> 1440x2560, out/molasses/video.mp4
```

For the final render set REMOTION_TMP to a folder on a big drive; Remotion
bundles fill the temp dir (~1 GB each run). Mux the voice + stems over the
picture (the stems already carry the reference mix: voice unchanged, music
+3 dB, SFX −6 dB):

```
ffmpeg -y -i out/molasses/video.mp4 -i out/molasses/audio.wav \
  -map 0:v:0 -map 1:a:0 -c:v copy -c:a aac -b:a 192k molasses_final.mp4
```

QA pass: `python scripts/molasses_shots.py` writes `out/molasses/shots.json`
from story.ts + timings.ts; `python scripts/short_qa.py` then checks the
render against the planned cuts/x-fades/flash/kicks.
`node scripts/sbs_sheet.py <frames>` builds a side-by-side contact sheet for
the look-match loop (SKILL.md steps 9–10).

### Rendering on CPU-only machines (this repo was rendered in one)

On a machine without a GPU, Chrome must rasterize in software (SwiftShader),
and two extra rules apply that the reference pipeline never hits on a GPU
machine:

- **Never render with `--concurrency > 1`.** With SwiftShader, every tab
  beyond the first shares one GPU process; the canvases in background tabs
  never composite, the captured frames come out plain white, the encoded
  chunk's bitrate collapses to ~10–20 kb/s, and Remotion still reports
  success. Check each chunk's bitrate before concatenating — a 1080×1920
  chunk under ~200 kb/s is blank.
- 2-canvas x-fade pages render fine at concurrency 1 even in software —
  single tab only — and multiple `remotion render` *processes* (one chrome
  each, concurrency 1) can safely run on disjoint frame ranges.
- **Chunk + concat.** Software GL at 1080×1920 with the full post chain runs
  ~15–30 s per frame, so render the timeline in chunks — crashed windows can
  be re-rendered alone, and
  `npx remotion ffmpeg -f concat -safe 0 -c copy` stitches them. Partition
  the x-fade windows ([1258–1265], [1355–1363], [1419–1427], [1620–1628],
  [1805–1813], ± a couple frames) into their own chunks first.

## Layout

```
src/videos/molasses/
  Molasses.tsx   composition + post chain (ink, DOF, bloom, tone map, grade)
  story.ts       shots, cameras, DOF, kicks, tank/flood physics — ALL word-timed
  world.ts       sky/sun/light rig, the town, the tank + burst shell, flood shader
  cast.ts        the cast: canvas-pool sprites, blinks, crowds, one-off fx
  build.ts       batches, houses, kit props (Kenney), cartoon vegetation
  toon.ts        the Pen drawing API + outfits + effect drawings
  timings.ts     GENERATED from voice/words.json (never edit by hand)
voice/words.json voice word timestamps (provisional until you record)
audio/           timeline.py + the stems (music.py retime is an open item)
tools/retime.py  words.json -> timings.ts (and the provisional pacing)
SCRIPT.md        the sourced script + shot plan
```

## Open items

- The narration is a machine-TTS placeholder (see Voice above).
- The bundled render (`out/molasses/molasses-short.mp4`, not in git when
  ignored) was made at `--scale 1` (1080×1920), not the documented 1.3333
  (1440×2560): software rendering cost. To re-render at 2K on a GPU machine,
  use the same pipeline with `--scale 1.3333`.
- `audio/music.py` still carries the bridge short's section map; retime its
  section table (hook → burst → aftermath) before rendering music.
- The elevated train from sentence 2 is voiced but not modelled (the aerial
  reads fine without it); add it to `build.ts buildTown()` if wanted.
- The swell/push-in numbers were set from the reference measures; run the
  look-match loop (stills at shots 3/7/10/12 vs SKILL.md step 9) on your GPU
  machine and tune `LIGHTS`/`LOOK` from stills if needed.
