#!/usr/bin/env python3
"""words.json -> src/videos/molasses/timings.ts

The picture is timed to the voice word timings (SKILL.md step 4): every shot boundary, punch and
reaction frame here is a word, not a hand-picked number. This tool reads voice/words.json and writes
timings.ts. Re-run it whenever the voice is re-recorded and re-time nothing by hand.

words.json shapes accepted (as produced by Whisper --word_timestamps true, wav2vec2 alignment, or hand
editing): a list of {"word": str, "start": seconds} (also "t" or "from" keys), or a list of [word,
seconds] pairs, or {"words": [...]}. Extra fields are ignored.

With --provisional (or when voice/words.json is missing), it first writes a provisional words.json at
the skill pacing: 3.7 words/s, 0.22 s pause between sentences. That pacing equals the reference
median (STYLE_BIBLE.md), so real narration should land within a few seconds of it.

Usage:
  python tools/retime.py                 # needs voice/words.json (or writes a provisional one first)
  python tools/retime.py --provisional   # force the provisional timings even if words.json exists
"""
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
FPS = 30.0
WPS = 3.7                 # reference median words/s
PAUSE = 0.22              # seconds between sentences
LEAD = 0.40               # silence before the first word
TAIL = 1.60               # hold after the last word

# The approved script, sentence by sentence (see SCRIPT.md). Word counts must match what is spoken.
SENTENCES = [
    "A wave of molasses once buried a Boston street faster than anyone could run.",
    "January 1919: Boston's new fifty foot tank holds two million gallons of syrup, right beside homes, a firehouse, and an elevated train.",
    "For two years the tank groaned and wept at the seams, and the neighbours just brought buckets.",
    "But today is the first warm day after a cold snap, and the whole tank is awake.",
    "Wait. How does warm weather scare a metal tank?",
    "By noon the groans are so loud that workers phone the office, and the office says it's fine.",
    "At half past twelve, the rivets fire off like rifle shots, the plates unzip, and the street disappears under a two storey wave going thirty five miles an hour.",
    "Luckily, molasses is thicker than water. Unluckily, molasses at thirty five miles an hour is thicker than you.",
    "You see, syrup in a sealed tank pushes on the sides like soda in a can you just shook.",
    "And this can went up in a rush, from steel half as thick as the rules wanted, and was never once tested with water.",
    "Afterwards, the survivors brought the first class action against a big company, and now every large tank needs a real engineer's stamp.",
    "And for thirty years, the North End smelled of candy every time summer came around.",
]


def toks(s: str):
    return s.replace(":", " ").replace(",", " ").replace(".", " ").replace("-", " ").split()


def load_words(path: str):
    with open(path) as fh:
        data = json.load(fh)
    if isinstance(data, dict):
        for key in ("words", "segments"):
            if key in data:
                data = data[key]
    out = []
    for item in data:
        if isinstance(item, (list, tuple)):
            out.append([str(item[0]).strip().lower(), float(item[1])])
        elif isinstance(item, dict):
            t = item.get("start", item.get("t", item.get("from")))
            if t is None and "start_time" in item:
                t = item["start_time"]
            if t is None:
                continue
            out.append([str(item.get("word", item.get("w", ""))).strip().lower(), float(t)])
    return out


def provisional():
    words, t, out = [], LEAD, []
    for i, sent in enumerate(SENTENCES):
        for w in toks(sent):
            words.append([w, t])
            out.append({"word": w, "start": round(t, 3)})
            t += 1.0 / WPS
        if i < len(SENTENCES) - 1:
            t += PAUSE
            if i in (1, 5, 7):  # breathing room after setting, before deadpan, before the payoff
                t += 0.35
    t += TAIL
    return out, words, t


def write_timings(words, total_t, path):
    # match sentences against the word list in order (allow small ASR variants / extra fillers)
    ti, sent_frames, all_frames = 0, [], []
    for sent in SENTENCES:
        st = toks(sent)
        frames = []
        for w in st:
            while ti < len(words) and words[ti][0] != w:
                window = [x[0] for x in words[ti:ti + 4]]
                if w in window:
                    ti += window.index(w)
                    break
                ti += 1
            if ti >= len(words):
                break
            frames.append(round(words[ti][1] * FPS))
            ti += 1
        if not frames:
            sys.exit(f"sentence not found in words.json: {sent[:50]}...")
        sent_frames.append(frames[0])
        all_frames.append(frames)
    total = int(round(total_t * FPS))
    body = ", ".join(str(f) for f in sent_frames)
    rows = ",\n  ".join("[" + ", ".join(str(f) for f in fr) + "]" for fr in all_frames)
    with open(path, "w") as fh:
        fh.write(
            "// GENERATED by tools/retime.py from voice/words.json - do not edit by hand.\n"
            "// Sentence start frames (S[0] = first word of sentence 1 in SCRIPT.md) and every word frame.\n"
            f"export const FPS = {FPS:g};\n"
            f"export const TOTAL = {total};\n"
            f"export const S: number[] = [{body}];\n"
            "export const W: number[][] = [\n  " + rows + ",\n];\n"
        )
    print(f"timings.ts: {len(SENTENCES)} sentences, {total} frames ({total / FPS:.1f} s)")


if __name__ == "__main__":
    wpath = os.path.join(ROOT, "voice", "words.json")
    if not os.path.exists(wpath) or "--provisional" in sys.argv:
        prov, words, total_t = provisional()
        os.makedirs(os.path.dirname(wpath), exist_ok=True)
        with open(wpath, "w") as fh:
            json.dump(prov, fh, indent=1)
        print(f"provisional words.json written ({len(prov)} words, {total_t:.1f} s)")
    else:
        words = load_words(wpath)
        total_t = max(t for _, t in words) + TAIL
    write_timings(words, total_t, os.path.join(ROOT, "src", "videos", "molasses", "timings.ts"))
