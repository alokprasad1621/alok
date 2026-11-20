# Writes out/molasses/shots.json (shot frame ranges, crossfade windows, flash, kick windows) from
# src/videos/molasses/story.ts + timings.ts for scripts/short_qa.py.
# SHOTS/cuts are TS expressions (S[1] - 2, wf(8, 7), ...) so each frame expression is evaluated in a
# small Python environment mirroring story.ts's numeric constants.
import json, os, re, sys

src = open(sys.argv[1] if len(sys.argv) > 1 else "src/videos/molasses/story.ts", encoding="utf-8").read()
tim = open(sys.argv[2] if len(sys.argv) > 2 else "src/videos/molasses/timings.ts", encoding="utf-8").read()

S = [int(x) for x in re.search(r"export const S: number\[\] = \[([\d\s,]+?)\]", tim).group(1).split(",")]
rows = re.findall(r"\[([\d\s,]+?)\]", re.search(r"export const W: number\[\]\[\] = \[(.*?)\];", tim, re.S).group(1))
W = [[int(x) for x in r.split(",")] for r in rows]
TOTAL = int(re.search(r"export const TOTAL = (\d+)", tim).group(1))
FPS = int(re.search(r"export const FPS = (\d+)", tim).group(1))

# safe eval env: numbers/lists plus the anchor consts declared in story.ts before the SHOTS table
env = {"S": S, "W": W, "TOTAL": TOTAL, "FPS": FPS, "wf": lambda s, w: W[s - 1][w - 1]}
for m in re.finditer(r"(?:const|let) ([A-Z][A-Z0-9_]*):? ?(?:number\[\])? ?= ([^;\n]+);", src):
    name, expr = m.group(1), m.group(2).strip()
    if expr.startswith(("wf(", "[", "S[", "W[")) or re.fullmatch(r"[\d\s+\-*/()]+", expr):
        try:
            env[name] = eval(expr, {"__builtins__": {}}, env)
        except Exception:
            pass

SAFE = {"__builtins__": {}, "len": len}

def tsp(expr):
    # TS -> Python: optional-index guards and nullish coalescing
    expr = re.sub(r"(\w+)\[(\d+)\]\?\.\[(\d+)\] \?\? (\d+)",
                  r"(\1[\2][\3] if len(\1) > \2 and len(\1[\2]) > \3 else \4)", expr)
    return expr.strip()

def fe(expr):
    return int(eval(tsp(expr), SAFE, env))

shots = [{"id": int(i), "a": fe(a), "b": fe(b)}
         for i, a, b in re.findall(r"\{ id: (\d+), a: ([^,]+?), b: ([^,]+?),", src)]
xf = {int(k): int(v) for k, v in re.findall(r"(\d+): (\d+)", re.search(r"XFADE[^=]*= \{([^}]*)\}", src).group(1))}
flash = fe(re.search(r"FLASH_AT = ([^;\n]+);", src).group(1))
xfade = [[s["a"] - xf[s["id"]] // 2, s["a"] + xf[s["id"]] // 2] for s in shots if s["id"] in xf]
# planned hard cuts inside shots, and 7-frame flip kicks (rivet cracks, burst, wave wide, lid land, shook, hammer blows)
cuts = [[fe(f), fe(f)] for f in re.findall(r"\{ f: (.+?), cut: true", src)]
wf2 = env["wf"]
rivets, burst = wf2(7, 10), wf2(7, 14)
kicks = [rivets, burst, wf2(7, 17), burst + 78, wf2(9, 19)] + [wf2(11, w) for w in (20, 21, 22)]
kicks = [[k, k + 8] for k in kicks]
os.makedirs("out/molasses", exist_ok=True)
json.dump({"shots": shots, "xfade": xfade, "flash": [flash, flash + 4], "planned": cuts + kicks},
          open("out/molasses/shots.json", "w"), indent=1)
print(len(shots), "shots", xfade, flash, "cuts", [c[0] for c in cuts], "kicks", [k[0] for k in kicks])
