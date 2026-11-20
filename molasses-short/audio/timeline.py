# Picture timeline mirrored (read-only) from your Remotion project/src/videos/molasses/story.ts + cast.ts so every
# sound lands on the frame: shots, story time tau per shot, the burst, rivet cracks, hammer hits, the cork pop, and
# the flood front distance front(tau) (cast.ts gushFx). Regenerate constants with: python tools/retime.py
import math
import os

import numpy as np

FPS = 30
TOTAL = 1980
DUR = TOTAL / FPS            # 66.000 s
fr = lambda f: f / FPS

FLASH = fr(130)              # white flash ending the hook (story.ts FLASH_AT)
RIVETS = fr(932)             # "rifle shots": the rivets begin firing
BURST = fr(964)              # "unzip": the shell opens
LID_LAND = BURST + 2.6       # the lid lands (story.ts kick pair)
SHOOK = fr(1410)             # "shook": the cork pops
HITS = [fr(1780), fr(1788), fr(1796)]   # the three hammer blows on the sign

# march/score grid (music.py; kept at the template's swing tempo, see README open items)
PUSH0 = 47.24
SWING_T = 1.69

# id: (first frame, end frame, light, crowd) - crowds per story.ts SHOTS
SHOTS = {
    1: (0, 130, "day", "none"), 2: (130, 326, "day", "none"), 3: (326, 470, "day", "street"),
    4: (470, 614, "day", "street"), 5: (614, 694, "day", "none"), 6: (694, 857, "day", "street"),
    7: (857, 948, "day", "none"), 8: (948, 1099, "day", "none"), 9: (1099, 1147, "day", "flee"),
    10: (1147, 1262, "day", "wade"), 11: (1262, 1359, "golden", "calm"), 12: (1359, 1423, "golden", "calm"),
    13: (1423, 1624, "golden", "calm"), 14: (1624, 1809, "day", "sign"), 15: (1809, TOTAL, "day", "cleanup"),
}
XFADE = {11: 8, 12: 8, 13: 8, 14: 8, 15: 8}

# flood physics, story.ts FLOOD_R / FLOOD_D (seconds since the burst)
FLOOD_R = [(0, 0), (0.5, 11), (1.3, 24), (2.6, 37), (4.2, 46), (6.5, 52), (9.5, 56), (14, 59)]
FLOOD_D = [(0, 2.3), (1.6, 1.7), (3.5, 1.25), (6, 1.0), (10, 0.85)]


def shot_t(i):
    a, b = SHOTS[i][:2]
    return fr(a), fr(b)


def shot_at(t):
    f = t * FPS
    for i, (a, b, *_r) in SHOTS.items():
        if a <= f < b:
            return i
    return 15


def tau_of(shot, t):
    """story seconds since the burst (shot 1 is the flash-forward: it runs at BURST + 3.6 + t)"""
    return BURST + 3.6 + t if shot == 1 else t


def _lin(pts, x):
    return float(np.interp(x, [p[0] for p in pts], [p[1] for p in pts]))


def front(tau):
    """flood front distance from the tank (m) tau seconds after the burst (story.ts FLOOD_R)"""
    return _lin(FLOOD_R, max(0.0, tau))


def depth(tau):
    """flood depth at the centre (m) tau seconds after the burst (story.ts FLOOD_D)"""
    return _lin(FLOOD_D, max(0.0, tau))


def tank_distance(t):
    """camera -> tank distance (m) per shot, from the camera keys in story.ts (frame, move frames, metres)"""
    keys = {
        1: [(0, 0, 62.0), (34, 37, 47.0), (74, 33, 31.0)],
        2: [(130, 0, 47.0), (173, 18, 40.0), (205, 18, 34.0)],
        3: [(326, 0, 22.5), (542 - 326, 20, 15.0)],
        4: [(468, 0, 45.0), (505, 20, 36.0)],
        5: [(612, 0, 13.0), (640, 20, 10.5)],
        6: [(692, 0, 11.0), (760, 0, 10.0)],
        7: [(855, 0, 9.2), (930, 0, 7.6)],
        8: [(946, 0, 52.0), (1027, 0, 36.0)],
        13: [(1421, 0, 34.0), (1454, 0, 20.0)],
    }
    s = shot_at(t)
    k = keys.get(s)
    if not k:
        return 45.0
    f = t * FPS
    ld = math.log(k[0][2])
    for kf, dur, d in k[1:]:
        if f < kf:
            break
        ld = ld + (math.log(d) - ld) * easeout((f - kf) / max(dur, 1))
    return math.exp(ld)


def easeout(u):
    u = min(1.0, max(0.0, u))
    return 1 - (1 - u) ** 4


def dist_mu(d):
    """distance -> (gain dB, low-pass Hz, reverb send) used for all tank / flood sounds"""
    d = max(d, 3.5)
    g = -14.0 * math.log10(d / 3.5)
    lpf = float(np.clip(17000 * (3.5 / d) ** 0.55, 1800, 17000))
    send = 0.06 + 0.45 * float(np.clip(math.log(d / 3.5) / math.log(25), 0, 1))
    return g, lpf, send


def words(path):
    import json
    full = path if os.path.isabs(path) else os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", path)
    return json.load(open(full, encoding="utf-8"))
