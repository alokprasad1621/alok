# Every sound effect + ambience bed of the molasses short as a cue list timed to the picture (timeline.py), rendered
# into one stereo SFX stem. Levels follow the user's standard mix: each EVENT has a "naive" level (LU relative to the
# voice stem, measured as the event's max momentary loudness) and is placed SFX_DB = -6 dB under it; ambience BEDS
# (integrated loudness) are not reduced. Distance to the camera adds gain, a low-pass and more valley reverb.
import math
import numpy as np
from dsp import (SR, ns, tt, rng, dbg, lp, hp, bp, peq, shelf, pan, st, place, fades, widen, make_ir, convolve_st,
                 momentary_max, integrated, colored, smooth_noise, modal)
import sfx_gen as G
import timeline as T

N = ns(T.DUR)
SFX_DB = -6.0


class Cue:
    def __init__(self, t, name, desc, gen, naive, kind="event", p=0.0, extra=0.0, lpf=None, send=0.12, group=None, cut=None):
        self.t, self.name, self.desc, self.gen, self.naive = t, name, desc, gen, naive
        self.kind, self.p, self.extra, self.lpf, self.send, self.cut = kind, p, extra, lpf, send, cut
        self.group = group or name
        self.applied = naive + (SFX_DB if kind == "event" else 0.0) + extra
        self.measured = None


def cues():
    C = []
    R = rng(1919)
    rr = lambda: rng(int(R.integers(1 << 30)))
    add = C.append

    # ------------------------------------------------ ambience beds (not reduced by the -6 dB event rule)
    def amb_day(dur, flags=0.0, seed=1):
        def g():
            r = rng(seed)
            x = G.breeze(dur, r, 1.0, 0.15, 850)
            x += st(lp(bp(colored(ns(dur), r, 0.8), 150, 900, 1), 800) * 0.18)   # distant harbour town rumble
            x += pan(G.bird_chirps(dur, r, 0.45, "sparrow") * 0.08, 0.5)
            x += pan(G.bird_chirps(dur, r, 0.3, "sparrow") * 0.05, -0.6)
            if flags:
                x += pan(G.flag_flutter(dur, r) * flags, 0.3)
            return fades(x, 0.4, 0.6), 0.0
        return g
    a2, a7 = T.shot_t(2)[0], T.shot_t(7)[1]
    add(Cue(a2, "amb_town", "Commercial Street, cold morning: breeze, sparrows, distant industry (shots 2-7)",
            _cut(amb_day(a7 - a2, 0.25, seed=19), a7 - a2, 0.5, 0.5), -30, "bed", send=0.0))
    wd = T.shot_t(10)[1] - T.shot_t(9)[0]
    add(Cue(T.shot_t(9)[0], "amb_flood", "molasses all around the stuck ones: thick lapping, slow bubbles, wet dragging (shots 9-10)",
            _env(lambda: (lp(G.water_bed(wd, rng(41), 1.0, 0.35), 1600), 0.0), wd, 0.35, 0.4), -18, "bed", send=0.0))
    gd = T.shot_t(13)[1] - T.shot_t(11)[0]
    add(Cue(T.shot_t(11)[0], "amb_golden", "golden-hour calm over the settled flood: soft breeze, blackbirds, crickets, laps (shots 11-13)",
            _env(lambda: (_golden(gd, rng(43)), 0.0), gd, 0.5, 0.5), -29, "bed", send=0.0))
    c14 = T.shot_t(14)
    add(Cue(c14[0], "amb_pad", "by the pad again: breeze, sparrows, a wagon far off (shot 14)", _cut(amb_day(c14[1] - c14[0], 0.0, seed=44),
            c14[1] - c14[0], 0.3, 0.4), -27, "bed", send=0.0))
    c15 = T.shot_t(15)
    add(Cue(c15[0], "amb_town_end", "warm afternoon on the clean street: breeze, sparrows, flags (shot 15)",
            _cut(amb_day(c15[1] - c15[0], 0.3, seed=45), c15[1] - c15[0], 0.3, 0.6), -29, "bed", send=0.0))

    # ------------------------------------------------ the hook (shot 1 is the flash-forward at tau = BURST + 3.6 + t)
    add(Cue(0.0, "hook_roar", "the flash-forward: the surge already roaring down the street under the voice",
            lambda: (lp(G.whoosh(4.35, rng(11), 0.3, 120, 900, 0.9, 0.4, 0.3) + st(colored(ns(4.35), rng(12), 0.9) * 0.2), 700), 0.0),
            -14, p=-0.3, send=0.1, cut=T.FLASH + 0.02))
    add(Cue(0.0, "hook_groans", "the tank still groaning in the flash-forward, far behind",
            lambda: (G.chain_groan(4.3, rng(13), 0.5, 0.85, 18, 34, beats=[0.6, 1.4, 2.1, 3.0, 3.8], t0=0.0), 0.0), -14, p=-0.35, send=0.2,
            cut=T.FLASH + 0.02))
    add(Cue(T.FLASH, "flash_whoosh", "reverse swell into the white flash (frame 130) + soft low whoomp",
            lambda: _flash(rng(130)), -5, send=0.2))

    # ------------------------------------------------ the tank complains (shots 3-7): rising groans, ticks, drips
    groan_beats = [6.6, 8.9, 11.6, 14.2, 16.9, 19.4, 21.0, 22.9, 24.3, 25.7, 27.1, 28.2]
    add(Cue(a2, "tank_groans", "steel groans rising out of the tank over the whole setup (shots 3-7)",
            lambda: (G.chain_groan(T.shot_t(7)[1] - a2 + 0.05, rng(29), 0.28, 1.0, 16, 42, beats=groan_beats, t0=a2), 0.0), -8, p=0.25, send=0.16))
    for k, tm in enumerate([19.9, 21.5, 22.7, 24.0, 25.2, 26.3, 27.2, 27.9, 28.4]):
        add(Cue(tm, "tank_tick", "metal fatigue tick, nearer each time", (lambda r=rr(): (G.clink(r, r.uniform(2200, 3400), 0.1), 0.0)),
                -16 + k, p=0.2, send=0.05, group="tank_tick"))
    for k, tm in enumerate(np.arange(T.shot_t(3)[0] + 0.4, T.shot_t(4)[1], 1.05)):
        add(Cue(float(tm), "seam_drip", "molasses drips into a bucket at the seam", (lambda r=rr(): (G.bubbles(0.35, r, 26, 180, 700,
                (0.004, 0.012), np.exp(-tt(0.35) / 0.09)) * 0.6, 0.0)), -20, p=-0.15, send=0.05, group="drip"))
    for tm, kd in [(24.35, "ugh"), (25.7, "oh"), (26.9, "ugh")]:
        add(Cue(tm, "uneasy_murmur", "workers unsettled at the wall: 'ugh' / 'oh' + a hushed word", (lambda r=rr(), kd=kd: (_groans(r, [(0.0, kd, 0.8)]), 0.0)),
                -18, lpf=4200, send=0.25, group="murmur"))

    # ------------------------------------------------ the rivets fire, then the burst
    add(Cue(T.RIVETS, "rivet_cracks", "RIVETS FIRE OFF LIKE RIFLE SHOTS: a dozen steel cracks marching down the seam",
            lambda: (_rivets(rng(932)), 0.0), -2, p=0.15, send=0.15))
    add(Cue(T.BURST, "burst_snap", "THE TANK UNZIPS: low crack + the whole shell letting go", lambda: (G.bolt_snap(rng(964)), 0.0), -2,
            p=-0.1, send=0.2))
    add(Cue(T.BURST + 0.02, "burst_gas", "two million gallons let go: air push + the giant brown surge starts",
            lambda: (lp(G.whoosh(1.6, rng(965), 0.5, 60, 1100, 1.0, 0.35, 0.5) + st(colored(ns(1.6), rng(966), 0.85)) * 0.5, 2600), 0.0), 0,
            p=-0.15, send=0.12))
    add(Cue(T.BURST + 0.05, "burst_splash", "molasses slams the street: heavy thud + thick splash + bubble cloud",
            lambda: (lp(G.splash_big(rng(966)), 5000), 0.0), -1, send=0.15))
    add(Cue(T.BURST + 0.12, "burst_crowd", "the street screams", lambda: (_whoas(rng(967)), 0.0), -5, lpf=6500, send=0.25))
    for tm in (T.LID_LAND + 0.0, T.LID_LAND + 0.09):
        add(Cue(tm, "lid_land", "the tank lid lands on the street: steel gong + ground thud + settle", (lambda r=rr(): (_lid(r), 0.0)), -4, p=0.2,
                send=0.25))

    # ------------------------------------------------ the wave travels (shots 8-9): roar front + running feet
    add(Cue(T.BURST + 0.9, "gush_roar", "the front sweeps on: continuous thick rushing that follows the camera",
            lambda: (lp(G.whoosh(3.4, rng(1030), 0.42, 90, 1400, 0.9, 0.6, 0.25) + st(colored(ns(3.4), rng(1031), 0.9)) * 0.3, 2200), 0.0),
            -6, p=-0.25, send=0.1))
    for k in range(16):
        tm = T.shot_t(9)[0] + 0.08 + k * 0.085
        if tm > T.shot_t(9)[1] - 0.05:
            break
        add(Cue(tm, "running_feet", "wet running footsteps past the lens", (lambda r=rr(): (lp(G.stroll_step(r, r.uniform(0.7, 1.3)), 6500), 0.0)),
                -12, p=float(np.clip(-0.6 + k * 0.09, -0.7, 0.7)) + R.uniform(-0.15, 0.15), send=0.2, group="running_steps"))
    add(Cue(T.shot_t(9)[0] + 0.15, "flee_crowd", "everyone runs: shouts, whoas, splashing chaos",
            lambda: (_sum2(_cheer(1.15, rng(1099)) * 0.9, _whoas(rng(1100))), 0.0), -8, lpf=6000, send=0.3))
    for tm, kd in [(38.5, "ugh"), (39.6, "ow"), (40.1, "ugh"), (41.0, "oh")]:
        add(Cue(tm, "groans", "hurt people sitting in the settled flood", (lambda r=rr(), kd=kd: (_groans(r, [(0.0, kd, 1.0)]), 0.0)), -13,
                lpf=5000, send=0.22, group="groans"))
    for k, tm in enumerate(np.arange(T.shot_t(10)[0] + 0.3, T.shot_t(10)[1] - 0.1, 1.6)):
        add(Cue(float(tm), "wading_slosh", "slow dragging in waist-deep molasses", (lambda r=rr(): (lp(G.bubbles(0.9, r, 9, 90, 500,
                (0.01, 0.04), np.exp(-tt(0.9) / 0.3)) * 0.8, 1200), 0.0)), -16, p=R.uniform(-0.6, 0.6), send=0.1, group="slosh"))

    # ------------------------------------------------ golden beats (shots 11-13): calm water + the cork pop on "shook"
    add(Cue(T.SHOOK, "cork_pop", "the bottle gives: cork clink + fizz burst in the golden quiet",
            lambda: (_sum2(G.clink(rng(1410), 1900, 0.1) * 0.7, G.bubbles(0.7, rng(1411), 34, 700, 3800,
                    (0.003, 0.008), np.exp(-tt(0.7) / 0.16)) * 0.35), 0.0), -8, p=0.25, send=0.1))
    add(Cue(T.shot_t(12)[0] + 0.4, "stoop_babble", "warm voices at the stoop", lambda: (_murmur(2.3, rng(1360), 5, early=False), 0.0), -20,
            lpf=3000, send=0.3))
    for k, tm in enumerate(np.arange(T.shot_t(13)[0] + 1.0, T.shot_t(13)[1] - 0.3, 2.4)):
        add(Cue(float(tm), "lap_far", "the flood settling: thick lazy lap against the stoops", (lambda r=rr(): (lp(G.bubbles(1.1, r, 5, 60, 350,
                (0.02, 0.06), np.exp(-tt(1.1) / 0.4)) * 0.7, 800), 0.0)), -22, p=R.uniform(-0.7, 0.7), send=0.15, group="lap_far"))

    # ------------------------------------------------ the rule (shot 14): hammer on the sign
    for k, tm in [(0, 54.4), (1, 56.1)]:
        add(Cue(tm, "onlooker_murmur", "neighbours watching the sign: approving murmurs", lambda: (_murmur(2.6, rng(1590 + k), 7, early=False), 0.0),
                -19, lpf=3200, send=0.35, group="murmur"))
    for k, th in enumerate(T.HITS):
        big = 1.0 if k < 2 else 1.25
        add(Cue(th - 0.09, "hammer_swish", "hammer swing", (lambda r=rr(): (G.whoosh(0.18, r, 0.08, 600, 2500, 0.6, 0.04, 0.2), 0.08)), -20,
                p=0.3, send=0.1, group="hammer"))
        add(Cue(th, "hammer", f"hammer blow {k + 1}/3 nailing the sign: steel 'tink' + board 'thock' + post", (lambda r=rr(), big=big: (G.hammer_hit(r, big), 0.0)),
                -5 if k < 2 else -4, p=0.3, send=0.22, group="hammer"))

    # ------------------------------------------------ cleanup (shot 15): shovels, kids, warm murmur
    for k, tm in enumerate(np.arange(c15[0] + 0.5, T.DUR - 2.2, 1.9)):
        add(Cue(float(tm), "shovel_scrape", "molasses scraped off the cobbles", (lambda r=rr(): (lp(shelf(G.creak(0.4, r, 90, 160, G.TIMBER,
                [(0, 0), (0.5, 1), (1, 0.3)], 0.3, 0.15), 900, 1), 5000, 1.0), 0.0)), -17, p=float(np.clip(-0.5 + k * 0.18, -0.6, 0.6)),
                send=0.1, group="cleanup"))
    add(Cue(c15[0] + 0.6, "cleanup_murmur", "the sweet-tooth kids + the adults: light chatter and laughing",
            lambda: (_murmur(5.4, rng(1790), 10, early=False), 0.0), -15, lpf=3600, send=0.35))
    add(Cue(T.DUR - 2.6, "kid_giggles", "two kids giggling over the traded candy, right on the ending",
            lambda: (_sum2(pan(G.hurrah(rng(1900), 300, 1.3, True) * 0.5, 0.3), pan(G.hurrah(rng(1901), 290, 1.35, True) * 0.5, 0.45)), 0.0), -13,
            lpf=6500, send=0.15))
    return C


def _rivets(r):
    out = np.zeros((2, ns(1.0)))
    for k in range(7):
        tm = 0.04 + k * 0.115 + abs(r.normal(0.0, 0.02))
        a = G.clink(r, r.uniform(1600, 2600), 0.16) * (1.0 - k * 0.05)
        b = lp(G.bolt_strain(r, 0.8), 6000)
        c = np.zeros(max(len(a), len(b)))
        c[:len(a)] += a
        c[:len(b)] += b
        place(out, pan(c, r.uniform(-0.7, 0.7)), tm)
    return out


def _lid(r):
    out = np.zeros((2, ns(1.6)))
    gong = modal(0.9, [(r.uniform(160, 210), 1.0, 0.5), (r.uniform(320, 430), 0.5, 0.25), (r.uniform(700, 900), 0.2, 0.1)], r)
    df = G.deck_flex(r, 0.7)
    df = df if df.ndim == 1 else df.mean(0)
    place(out, pan(gong, 0.3), 0.0)
    place(out, pan(df * 0.8, 0.1), 0.05)
    return out


# ================================================================ helpers for composite cues
def _cut(gen, dur, fin, fout):
    def g():
        x, a = gen()
        return fades(x, fin, fout), a
    return g


def _env(gen, dur, fin, fout):
    return _cut(gen, dur, fin, fout)


def _golden(dur, r):
    n = ns(dur)
    x = G.breeze(dur, r, 0.7, 0.1, 650)
    x += st(lp(bp(colored(n, r, 0.8), 150, 1400, 1), 1200) * 0.35)
    x += pan(G.bird_chirps(dur, r, 0.35, "blackbird") * 0.06, -0.5)
    x += pan(G.bird_chirps(dur, r, 0.25, "blackbird") * 0.04, 0.6)
    x += widen(G.crickets(dur, r, 3) * 0.008, r, 9, 1.0)
    return x


def _flash(r):
    dur = 0.75
    y = G.whoosh(dur, r, 0.33, 500, 4200, 0.9, 0.09, 0.4)
    t = tt(dur)
    boom = np.where(t > 0.33, np.exp(-(t - 0.33) / 0.12) * np.sin(2 * np.pi * 62 * (t - 0.33)), 0) * 0.8
    return widen(y + boom, r, 12, 0.9), 0.33


def _murmur(dur, r, voices, early=False):
    n = ns(dur)
    out = np.zeros((2, n))
    for v in range(voices):
        kind = r.uniform()
        base, scale = ((r.uniform(95, 140), r.uniform(0.95, 1.05)) if kind < 0.45 else
                       (r.uniform(175, 235), r.uniform(1.12, 1.2)) if kind < 0.85 else (r.uniform(260, 330), r.uniform(1.25, 1.35)))
        y = G.babble(dur, r, base, scale, r.uniform(3.6, 4.8), r.uniform(0.55, 0.8), fmax=3400)
        y = lp(y, r.uniform(2200, 3600), 1) * r.uniform(0.3, 1.0)
        out += pan(y, r.uniform(-0.85, 0.85))
    if early:
        for k in range(4):
            h = G.hurrah(r, r.uniform(110, 230), r.uniform(1.0, 1.18))
            place(out, pan(lp(h, 3000, 1) * 0.5, r.uniform(-0.8, 0.8)), r.uniform(0.2, 1.6))
    return fades(out, 0.25, 0.8)


def _sum2(a, b):
    if a.ndim == 1:
        a = np.vstack([a, a])
    if b.ndim == 1:
        b = np.vstack([b, b])
    n = max(a.shape[1], b.shape[1], 1)
    out = np.zeros((2, n))
    out[:, :a.shape[1]] += a
    out[:, :b.shape[1]] += b
    return out


def _cheer(dur, r):
    n = ns(dur)
    t = np.arange(n) / SR
    out = np.zeros((2, n))
    for v in range(26):
        kid = v % 6 == 5
        base = r.uniform(270, 340) if kid else (r.uniform(105, 160) if v % 2 else r.uniform(180, 250))
        scale = 1.3 if kid else (1.0 if v % 2 else 1.15)
        for rep in range(1 + int(r.uniform() < 0.4)):
            h = G.hurrah(r, base * r.uniform(0.97, 1.05), scale, kid)
            tm = r.uniform(0.25, 1.1) + rep * r.uniform(0.75, 1.0)
            place(out, pan(lp(h, 4000, 1) * r.uniform(0.35, 1.0), r.uniform(-0.9, 0.9)), tm)
    env = np.interp(t, [0, 0.4, 1.0, 1.9, 3.4], [0.0, 0.5, 1.0, 0.75, 0.0])
    out += G.applause(dur, r, 40, env) * 0.9
    return fades(out, 0.05, 0.5)


def _bounces(r):
    y = np.zeros(ns(0.6))
    for k, (tm, a) in enumerate([(0.0, 1.0), (0.11, 0.45), (0.19, 0.25), (0.24, 0.12)]):
        c = G.clink(r, r.uniform(2600, 3400), 0.12) * a
        y[ns(tm): ns(tm) + len(c)] += c[: len(y) - ns(tm)]
    return y


def _scuffle(r):
    y = np.zeros((2, ns(0.6)))
    for k in range(18):
        s = G.stroll_step(r, r.uniform(0.6, 1.2)) * r.uniform(0.3, 1.0)
        place(y, pan(s, r.uniform(-0.6, 0.6)), r.uniform(0, 0.3))
    return y


def _whoas(r):
    out = np.zeros((2, ns(0.75)))
    for v in range(9):
        w = G.whoa(r, dur=r.uniform(0.35, 0.5))
        place(out, pan(w * r.uniform(0.4, 1.0), r.uniform(-0.8, 0.8)), r.uniform(0.0, 0.18))
    return out


def _splashes(r):
    out = np.zeros((2, ns(2.8)))
    for k, (p, g, dt) in enumerate([(0.0, 1.0, 0.0), (-0.55, 0.75, 0.025), (0.5, 0.7, 0.04), (-0.3, 0.55, 0.06), (0.35, 0.5, 0.075), (0.75, 0.35, 0.09)]):
        s = G.splash_big(r)
        if k:
            s = lp(s, 9000, 1)
        place(out, pan(s * g, p), dt)
    return out


def _oofs(r):
    out = np.zeros((2, ns(0.9)))
    kinds = ["oof", "oof", "ugh", "oh", "oof", "ow", "ugh", "oof", "oh", "oof", "ugh", "ow"]
    for v, k in enumerate(kinds):
        o = G.oof(r, k)
        tm = abs(r.normal(0.06, 0.08)) + (0.0 if v < 5 else 0.1)
        place(out, pan(o * r.uniform(0.45, 1.0), r.uniform(-0.85, 0.85)), min(tm, 0.45))
    return out


def _groans(r, parts):
    out = np.zeros((2, ns(0.9)))
    for tm, kd, g in parts:
        o = G.oof(r, kd, base=r.uniform(90, 125), scale=r.uniform(0.95, 1.05))
        place(out, pan(o * g, r.uniform(-0.6, 0.6)), tm)
    return out


def _debris(r):
    out = np.zeros((2, ns(1.2)))
    for k in range(7):
        knock = modal(0.3, [(r.uniform(180, 320), 1.0, 0.04), (r.uniform(450, 900), 0.6, 0.02), (r.uniform(1200, 2400), 0.3, 0.01)], r)
        sp = G.bubbles(0.3, r, 120, 400, 2200, (0.005, 0.02), np.exp(-tt(0.3) / 0.08)) * 0.5
        place(out, pan((knock + sp) * r.uniform(0.3, 1.0), r.uniform(-0.8, 0.8)), r.uniform(0, 0.8))
    return out


# ================================================================ render
def render(v_ref, on_event=None):
    """v_ref = integrated loudness of the voice stem (stereo). Returns (stereo stem, cue list with measured levels).
    on_event(cue, x, t0) is called with every placed (dry) event, for analysis."""
    C = cues()
    out = np.zeros((2, N))
    send = np.zeros(N)
    for c in C:
        x, anchor = c.gen()
        x = np.asarray(x, float)
        x = pan(x, c.p) if x.ndim == 1 else x
        if c.cut is not None:
            k = ns(c.cut - (c.t - anchor))
            if 0 < k < x.shape[1]:
                x = fades(x[:, :k], 0.0, 0.02)
        tgt = v_ref + c.applied
        cur = momentary_max(x) if c.kind == "event" else integrated(x)
        if np.isfinite(cur):
            x = x * dbg(tgt - cur)
        if c.lpf:
            x = lp(x, c.lpf, 1)
        c.measured = momentary_max(x) - v_ref if c.kind == "event" else integrated(x) - v_ref
        t0 = c.t - anchor
        place(out, x, t0)
        if on_event:
            on_event(c, x, t0)
        if c.send > 0:
            G._place_mono(send, c.send * x.mean(0), t0)
    valley = make_ir(1.1, 77, pre=0.01, hf=1.6, early=[(0.09, 0.45, -0.5), (0.14, 0.3, 0.6), (0.23, 0.2, -0.2)])
    out += 0.55 * convolve_st(send, valley)
    out = hp(out, 25, 2)
    end = ns(T.DUR - 0.12)
    out[:, end:] *= np.linspace(1, 0, N - end)[None, :] ** 2
    return out, C
