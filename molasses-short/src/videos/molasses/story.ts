// "The Wave That Was Slower Than Water" (Great Molasses Flood, Boston, 1919).
// Everything here is timed to voice/words.json through timings.ts (re-run tools/retime.py after any voice change):
// shot boundaries and punch words are word frames, never hand numbers. The physics is the flood (story time t in s):
// the tank bursts at BURST, the shell falls open, and a brown surge front R(tau) crawls down Commercial Street.
//
// Camera grammar (reference motion.md, unchanged from the bridge short): every move is a symmetric smootherstep
// glide of 18-40 f; reframes bigger than about half a frame are cuts; holds push in 0.15-0.35 %/f (~0.6 %/f on
// punch words); impacts are 7-frame flip kicks; rolls 4-5 deg on emphasis beats; no hand-held float. Every visual
// reaction lands 0-3 frames before its word.
import { FPS, TOTAL, S, W } from "./timings";
export { FPS, TOTAL, S, W };

export type V3 = [number, number, number];

export const D0 = 6.0; // street level (matches the bridge template's ground convention)
export const TANK: V3 = [58, D0 + 1.2, -12]; // shell bottom centre (pad top); the pad is 1.2 m tall
export const TANK_R = 13.5; // 90 ft -> 27 m, storybook-rounded
export const TANK_H = 15.2; // 50 ft -> 15.2 m
export const LEAK: V3 = [46.2, D0 + 1.25, -17.8]; // the seam drip the neighbourhood collected, at the pad foot
export const SIGN_AT: V3 = [41.5, D0, -24];

export const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
export const smooth = (x: number) => { const u = clamp01(x); return u * u * (3 - 2 * u); };
export const easeOut = (u: number) => 1 - (1 - clamp01(u)) ** 4;
export const wf = (s: number, w: number) => W[s - 1]?.[w - 1] ?? 0;

/** word frames this film hangs on (1-based word indexes; sentence numbers = SCRIPT.md lines) */
const RIVETS = wf(7, 10);              // "rifle shots"
export const BURST = wf(7, 14);        // "unzip"
const WAVE_WIDE = wf(7, 17);           // "street disappears"
const UNLUCKY = wf(8, 7);              // "Unluckily"
const SODA = wf(9, 13);                // "soda" (of "like soda in a can")
export const SHOOK = wf(9, 19);        // "shook"
export const HITS = [wf(11, 20), wf(11, 21), wf(11, 22)]; // "real engineer's stamp": hammer blows
const CANDY = wf(12, 10);              // "candy"

// ---------------- shots ----------------
export type Light = "day" | "golden";
export type Crowd = "street" | "flee" | "wade" | "calm" | "sign" | "cleanup" | "none";
export type ShotDef = { id: number; a: number; b: number; light: Light; crowd: Crowd; tau: (t: number) => number };
/** shot 1 is the flash-forward: its hooks (camera, flood fx) run on story time TAU1 = tBurst + 3.6 + t */
export const TAU1 = BURST / FPS + 3.6;

export const SHOTS: ShotDef[] = [
  { id: 1, a: 0, b: S[1] - 2, light: "day", crowd: "none", tau: (t) => TAU1 + t },
  { id: 2, a: S[1] - 2, b: S[2] - 2, light: "day", crowd: "none", tau: (t) => t },
  { id: 3, a: S[2] - 2, b: S[3] - 2, light: "day", crowd: "street", tau: (t) => t },
  { id: 4, a: S[3] - 2, b: S[4] - 2, light: "day", crowd: "street", tau: (t) => t },
  { id: 5, a: S[4] - 2, b: S[5] - 2, light: "day", crowd: "none", tau: (t) => t },
  { id: 6, a: S[5] - 2, b: S[6] - 2, light: "day", crowd: "street", tau: (t) => t },
  { id: 7, a: S[6] - 2, b: W[6]?.[11] ?? 0, light: "day", crowd: "none", tau: (t) => t },
  { id: 8, a: W[6]?.[11] ?? 0, b: S[7] - 2, light: "day", crowd: "none", tau: (t) => t },
  { id: 9, a: S[7] - 2, b: UNLUCKY - 2, light: "day", crowd: "flee", tau: (t) => t },
  { id: 10, a: UNLUCKY - 2, b: S[8] - 2, light: "day", crowd: "wade", tau: (t) => t },
  { id: 11, a: S[8] - 2, b: SODA - 2, light: "golden", crowd: "calm", tau: (t) => t },
  { id: 12, a: SODA - 2, b: S[9] - 2, light: "golden", crowd: "calm", tau: (t) => t },
  { id: 13, a: S[9] - 2, b: S[10] - 2, light: "golden", crowd: "calm", tau: (t) => t },
  { id: 14, a: S[10] - 2, b: S[11] - 2, light: "day", crowd: "sign", tau: (t) => t },
  { id: 15, a: S[11] - 2, b: TOTAL, light: "day", crowd: "cleanup", tau: (t) => t },
];
/** crossfades at place/time changes; a white 4-frame flash after the hook */
export const XFADE: Record<number, number> = { 11: 8, 12: 8, 13: 8, 14: 8, 15: 8 };
export const FLASH_AT = S[1] - 6;

export const shotAt = (f: number) => SHOTS.find((s) => f >= s.a && f < s.b) ?? SHOTS[SHOTS.length - 1];
/** layers to draw at frame f: base shot, plus the next shot fading in during a crossfade */
export const layersAt = (f: number): { id: number; alpha: number }[] => {
  for (const s of SHOTS) {
    const x = XFADE[s.id];
    if (x && f >= s.a - x / 2 && f < s.a + x / 2) return [{ id: s.id - 1, alpha: 1 }, { id: s.id, alpha: (f - (s.a - x / 2) + 1) / (x + 1) }];
  }
  return [{ id: shotAt(f).id, alpha: 1 }];
};

// ---------------- flood physics ----------------
const B = BURST / FPS;
export type FloodState = { r: number; depth: number; u: number; lid: number }; // u = shell-fall 0..1, lid = flight s
const FLOOD_R: [number, number][] = [[0, 0], [0.5, 11], [1.3, 24], [2.6, 37], [4.2, 46], [6.5, 52], [9.5, 56], [14, 59]];
const FLOOD_D: [number, number][] = [[0, 2.3], [1.6, 1.7], [3.5, 1.25], [6, 1.0], [10, 0.85]];
const lin = (pts: [number, number][], x: number) => {
  if (x <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) if (x <= pts[i][0]) {
    const [a, b] = pts[i - 1], [c, d] = pts[i];
    return b + (d - b) * ((x - a) / (c - a));
  }
  return pts[pts.length - 1][1];
};
const linEnd = (pts: [number, number][], x: number) => {
  for (let i = 1; i < pts.length; i++) if (x <= pts[i][0]) {
    const [a0, b0] = pts[i - 1], [a1, b1] = pts[i];
    return b0 + (b1 - b0) * ((x - a0) / (a1 - a0));
  }
  return pts[pts.length - 1][1];
};
export const floodState = (t: number): FloodState => {
  const tau = Math.max(0, t - B);
  return { r: lin(FLOOD_R, tau), depth: linEnd(FLOOD_D, tau), u: easeOut(tau / 0.55), lid: Math.max(0, tau) };
};
/** the flood disc is drawn from the wave's first shot on (hidden earlier: its radius is 0 at the burst anyway) */
export const floodOn = (f: number) => f >= SHOTS[7].a - 2;
/** the tank leans and hums before it goes: a slow creaky sway, gone after the shell falls */
export const tankLean = (t: number) => (t < B ? 0.0042 * Math.sin(0.9 * (t - B) + 1.1) + 0.0015 * Math.sin(2.3 * (t - B)) : 0);

// ---------------- camera ----------------
export type Cam = { pos: V3; look: V3; fov: number; roll: number };
type Shot = Partial<Cam> & { pos: V3; look: V3 };
type Key = { f: number; dur?: number; cut?: boolean; s: (f: number) => Shot };
export const glide = (u: number) => { const x = clamp01(u); return x * x * x * (x * (6 * x - 15) + 10); };
const mix = (a: Cam, b: Cam, k: number): Cam => ({
  pos: a.pos.map((v, i) => v + (b.pos[i] - v) * k) as V3, look: a.look.map((v, i) => v + (b.look[i] - v) * k) as V3,
  fov: a.fov + (b.fov - a.fov) * k, roll: a.roll + (b.roll - a.roll) * k,
});
const full = (c: Shot): Cam => ({ fov: 40, roll: 0, ...c });
const run = (keys: Key[], f: number) => {
  let cur = full(keys[0].s(f));
  for (let i = 1; i < keys.length; i++) {
    const k = keys[i];
    if (f < k.f) break;
    cur = k.cut ? full(k.s(f)) : mix(cur, full(k.s(f)), glide((f - k.f) / (k.dur ?? 24)));
  }
  return cur;
};
const T = (f: number) => f / FPS;
/** push-in factor since f0: the subject grows ~rate per frame; `punch` raises it (with 8 f soft edges) for the first n frames */
const pushK = (f: number, f0: number, rate: number, punch = 0, n = 35) => {
  const x = Math.max(0, f - f0);
  let s = rate * x;
  if (punch > rate) for (let i = 0; i < Math.min(x, n); i++) s += (punch - rate) * Math.max(0, Math.min(1, (i + 0.5) / 8, (n - i - 0.5) / 8));
  return Math.exp(-s);
};
const dolly = (pos: V3, look: V3, k: number, rest: Partial<Cam> = {}): Shot =>
  ({ pos: [look[0] + (pos[0] - look[0]) * k, look[1] + (pos[1] - look[1]) * k, look[2] + (pos[2] - look[2]) * k], look, ...rest });
const zoom = (pos: V3, look: V3, fov: number, k: number, rest: Partial<Cam> = {}): Shot =>
  ({ pos, look, fov: (360 / Math.PI) * Math.atan(Math.tan((fov * Math.PI) / 360) * k), ...rest });
const rolled = (s: (f: number) => Shot, roll: number) => (f: number): Shot => ({ ...s(f), roll });

/** shot start helper for camera keys (same 2-frame lead as the SHOTS boundaries) */
const SHOT_F = (id: number) => SHOTS[id - 1].a;

// ---- framings (f -> camera); each pushes in from the frame its key starts ----
// shot 1 (hook, flash-forward): flying with the surge down the street, ending low and fast
const S1a = (f: number) => dolly([96, 15, -34], [40, 2.5, -12], pushK(f, 0, 0.0025), { fov: 44 });
const S1b = (f: number) => dolly([66, 6.5, -20], [26, 1.8, -10], pushK(f, 34, 0.002), { fov: 42, roll: -0.04 });
const S1c = (f: number) => dolly([40, 2.6, -15], [14, 1.3, -8], pushK(f, 74, 0.003), { fov: 38, roll: 0.04 });
// shot 2 (setting aerial): the street plus the tank, sinking lower on "fifty foot tank" then "two million gallons"
const S2a = (f: number) => zoom([16, 27, 30], [40, 7, -12], 44, pushK(f, SHOT_F(2), 0.002));
const S2b = (f: number) => zoom([0, 19, 26], [36, 7, -13], 44, pushK(f, wf(2, 6), 0.002));
const S2c = (f: number) => zoom([-14, 13, 22], [30, 8, -12], 40, pushK(f, wf(2, 9), 0.0022, 0.006, 35));
// shot 3 (the seam that wept): low at the pad foot, buckets and leak, closer on "buckets"
const S3a = (f: number) => dolly([27, 2.4, -20], [47, 2.6, -13], pushK(f, SHOT_F(3), 0.002), { fov: 42 });
const S3b = (f: number) => dolly([38, 1.8, -18.5], [47.5, 2.2, -14.5], pushK(f, wf(3, 15), 0.0025), { fov: 38, roll: 0.035 });
// shot 4 (first warm day): the tank in full from across the street, push on "warm day"
const S4a = (f: number) => zoom([18, 4.5, 12], [56, 10, -12], 44, pushK(f, SHOT_F(4), 0.002));
const S4b = (f: number) => zoom([24, 5.5, 4], [56, 10, -12], 42, pushK(f, wf(4, 6), 0.0022, 0.006, 30), { roll: -0.035 });
// shot 5 (mystery): close along the rivet seam at ear height
const S5a = (f: number) => dolly([40, 3.0, -22.5], [49, 5.5, -14], pushK(f, SHOT_F(5), 0.0022), { fov: 40 });
const S5b = (f: number) => dolly([43.5, 3.4, -21], [50, 5.8, -14.5], pushK(f, wf(5, 5), 0.0025), { fov: 36, roll: 0.04 });
// shot 6 (groans at noon + the phone call): listening ear, then the phone man
const S6a = (f: number) => dolly([44, 1.9, -20.5], [49.5, 3.2, -14], pushK(f, SHOT_F(6), 0.002), { fov: 38 });
const S6b = (f: number) => dolly([52, 2.2, -18.6], [56, 2.2, -13.2], pushK(f, wf(6, 9), 0.0025), { fov: 36 });
// shot 7 (the burst): rivet seam CU, punch on "rifle shots", the plates part at BURST under the held framing
const S7a = (f: number) => dolly([44.5, 2.5, -19.5], [48.5, 3.6, -14.5], pushK(f, SHOT_F(7), 0.002, 0.007, 30), { fov: 36, roll: -0.035 });
const S7b = (f: number) => dolly([42, 3.0, -22], [47, 4.4, -15], pushK(f, RIVETS, 0.0025), { fov: 34 });
// shot 8 (the wave): high down the street, then dropping to street level as the front passes
const S8a = (f: number) => dolly([12, 16, 10], [44, 2, -13], pushK(f, SHOT_F(8), 0.002), { fov: 46 });
const S8b = (f: number) => dolly([-2, 4.5, 13], [28, 1.4, -10], pushK(f, wf(7, 19), 0.0022, 0.006, 28), { fov: 44, roll: 0.035 });
// shot 9 ("Luckily ..."): the street at face height, everyone runs at the lens
const S9a = (f: number) => dolly([-4, 2.0, 4], [-14, 1.9, 12], pushK(f, SHOT_F(9), 0.0018), { fov: 42, roll: -0.035 });
// shot 10 ("Unluckily..."): water-level lens among the stuck ones
const S10a = (f: number) => dolly([-15, 1.62, -2], [-24, 1.35, 4], pushK(f, SHOT_F(10), 0.0018), { fov: 40, roll: 0.04 });
// shot 11 (golden, "You see, ..."): calm wide over the lake with the opened tank behind
const S11a = (f: number) => zoom([26, 13, -38], [34, 5, -4], 40, pushK(f, SHOT_F(11), 0.0016));
// shot 12 ("like soda in a can you just shook"): the kid at the stoop, pop on "shook"
const S12a = (f: number) => dolly([-3, 1.5, 18], [-8, 1.7, 25], pushK(f, SHOT_F(12), 0.002), { fov: 40 });
const S12b = (f: number) => dolly([-5, 1.35, 21.5], [-9, 1.75, 26], pushK(f, wf(9, 16), 0.0025), { fov: 37 });
// shot 13 (golden, "steel nobody tested"): the opened tank from its street side, then the fallen plates
const S13a = (f: number) => zoom([76, 8.5, -40], [56, 7, -12], 42, pushK(f, SHOT_F(13), 0.0018));
const S13b = (f: number) => dolly([68, 2.2, -32], [58, 1.8, -18], pushK(f, wf(10, 10), 0.0025), { fov: 40 });
// shot 14 (the rule): the sign by the pad, hammer blows on "real engineer's stamp"
const S14a = (f: number) => dolly([32, 2.2, -28], [40, 2.4, -24], pushK(f, SHOT_F(14), 0.002), { fov: 44 });
const S14b = (f: number) => zoom([37, 2.1, -28.5], [41.5, 2.0, -24], 42, pushK(f, wf(11, 14), 0.0022, 0.005, 24));
// shot 15 (callback): kids at the stoop, then a crane out over the clean street and the town
const S15a = (f: number) => dolly([-6, 1.9, 18], [-12, 1.9, 25], pushK(f, SHOT_F(15), 0.0022), { fov: 41 });
const S15b = (f: number) => dolly([-9, 1.8, 20], [-12, 1.95, 25.5], pushK(f, CANDY - 30, 0.0025, 0.006, 30), { fov: 38 });
const CRANE: V3[] = [[-2, 17, 26], [26, 20, 54], [40, 8, 8]];
const S15c = (f: number): Shot => {
  const a = S15b(S[11] + 160), s = glide((f - (S[11] + 160)) / 90), r = 1 - s, [C, Bv, L] = CRANE;
  return { pos: [0, 1, 2].map((i) => r * r * a.pos[i] + 2 * s * r * C[i] + s * s * Bv[i]) as V3,
    look: [0, 1, 2].map((i) => a.look[i] + (L[i] - a.look[i]) * s) as V3, fov: (a.fov ?? 40) + (44 - (a.fov ?? 40)) * s, roll: 0 };
};

const CAMS: Record<number, Key[]> = {
  1: [
    { f: 0, s: S1a },
    { f: 34, dur: 37, s: S1b },
    { f: 74, dur: 33, s: S1c },
  ],
  2: [
    { f: SHOT_F(2), s: S2a },
    { f: wf(2, 6), dur: 18, s: S2b },
    { f: wf(2, 9), dur: 18, s: S2c },
  ],
  3: [
    { f: SHOT_F(3), s: S3a },
    { f: wf(3, 15), dur: 20, s: S3b },
  ],
  4: [
    { f: SHOT_F(4), s: S4a },
    { f: wf(4, 6), dur: 20, s: S4b },
  ],
  5: [
    { f: SHOT_F(5), s: S5a },
    { f: wf(5, 5), dur: 20, s: S5b },
  ],
  6: [
    { f: SHOT_F(6), s: S6a },
    { f: wf(6, 9), cut: true, s: S6b },
  ],
  7: [
    { f: SHOT_F(7), s: S7a },
    { f: RIVETS, cut: true, s: S7b }, // cut on "rifle shots"; the seam parts at BURST under S7b
  ],
  8: [
    { f: SHOT_F(8), s: S8a },
    { f: wf(7, 19), cut: true, s: S8b }, // "under a two storey wave": down to the street (+ kick)
  ],
  9: [{ f: SHOT_F(9), s: S9a }],
  10: [{ f: SHOT_F(10), s: S10a }],
  11: [{ f: SHOT_F(11), s: S11a }],
  12: [
    { f: SHOT_F(12), s: S12a },
    { f: wf(9, 16), dur: 20, s: S12b },
  ],
  13: [
    { f: SHOT_F(13), s: S13a },
    { f: wf(10, 10), cut: true, s: S13b },
  ],
  14: [
    { f: SHOT_F(14), s: S14a },
    { f: wf(11, 14), dur: 22, s: S14b },
  ],
  15: [
    { f: SHOT_F(15), s: S15a },
    { f: CANDY - 30, dur: 30, s: S15b },
    { f: S[11] + 160, cut: true, s: S15c },
  ],
};

/** impact kicks (flip-shake, decay 7 f): rivet shots, the burst itself, the wave slam, the cork pop, hammer blows */
const kickPairs: [number, number][] = [
  [RIVETS / FPS, 0.8], [BURST / FPS, 1.7], [WAVE_WIDE / FPS, 0.9], [BURST / FPS + 2.6, 0.7], [SHOOK / FPS, 0.7],
  ...HITS.map((h) => [h / FPS, 0.45] as [number, number]),
];
export const kickAt = (t: number) => {
  let a = 0;
  for (const [t0, g] of kickPairs) {
    const n = Math.floor((t - t0) * FPS + 1e-6);
    if (n >= 0 && n < 7) a += g * (n % 2 ? -1 : 1) * (1 - n / 7) ** 1.5;
  }
  return a;
};
export const camAt = (id: number, f: number): Cam => {
  const c = run(CAMS[id], f), a = kickAt(T(f));
  if (!a) return c;
  const d: V3 = [c.look[0] - c.pos[0], c.look[1] - c.pos[1], c.look[2] - c.pos[2]];
  const L = Math.hypot(...d), h = Math.hypot(d[0], d[2]) || 1;
  const m = (3 / 640) * Math.tan((c.fov * Math.PI) / 360) * L * a;
  return { ...c, look: [c.look[0] - (d[2] / h) * m, c.look[1] + 0.6 * m, c.look[2] + (d[0] / h) * m], roll: c.roll + a * 0.004 };
};
/** frame at which the current key's move has finished (for picking billboard views per key, not per frame) */
export const keyEnd = (id: number, f: number) => {
  let e = 0;
  for (const k of CAMS[id]) if (f >= k.f) e = k.f + (k.cut ? 0 : k.dur ?? 24);
  return Math.max(f, e);
};

// ---------------- lens: depth of field + foreground framing ----------------
export type Dof = { f: number; dur?: number; cInf: number; focus?: (f: number) => V3 };
const at = (p: V3) => (_f: number): V3 => p;
export const DOF: Dof[] = [
  { f: 0, cInf: 15, focus: at([44, 1.2, -11]) },            // hook: flood front sharp, street soft
  { f: 34, dur: 37, cInf: 15, focus: at([30, 1.0, -11]) },
  { f: 74, dur: 33, cInf: 15, focus: at([22, 0.8, -10]) },
  { f: SHOT_F(2), cInf: 0 },                                 // aerial (establishing)
  { f: SHOT_F(3), cInf: 11, focus: at(LEAK) },               // leak + buckets
  { f: wf(3, 15), dur: 20, cInf: 12, focus: at(LEAK) },
  { f: SHOT_F(4), cInf: 0 },                                 // tank in full: sharp
  { f: SHOT_F(5), cInf: 14, focus: at([50, 5.7, -14]) },     // seam CU
  { f: wf(5, 5), dur: 20, cInf: 14, focus: at([50, 5.7, -14]) },
  { f: SHOT_F(6), cInf: 12, focus: at([49.5, 3.2, -14]) },   // listening ear
  { f: SHOT_F(7), cInf: 14, focus: at([48.5, 3.6, -14.5]) }, // seam + rivets
  { f: SHOT_F(8), cInf: 0 },                                 // wave wide: kept readable
  { f: SHOT_F(9), cInf: 12, focus: at([-10, 2.0, 9]) },      // runners' faces
  { f: SHOT_F(10), cInf: 16, focus: at([-20, 1.5, 2]) },     // stuck row: faces sharp, far soft
  { f: SHOT_F(11), cInf: 5 },                                // golden wide: mild (facade ink must hold)
  { f: SHOT_F(12), cInf: 10, focus: at([-9, 1.75, 26]) },    // kid + bottle
  { f: SHOT_F(13), cInf: 0 },                                // opened tank wide
  { f: SHOT_F(14), cInf: 12, focus: at([41.5, 2.2, -24]) },  // sign MS
  { f: SHOT_F(15), cInf: 0 },                                // stoop + crane out
];
export const dofAt = (f: number) => {
  let i = 0; while (i + 1 < DOF.length && f >= DOF[i + 1].f) i++;
  const d = DOF[i], p = DOF[Math.max(0, i - 1)];
  const k = d.dur ? Math.min(1, (f - d.f) / d.dur) : 1;
  return { cInf: p.cInf + (d.cInf - p.cInf) * k, focus: d.focus };
};
export const focusAt = (id: number, f: number): V3 => {
  const d = dofAt(f);
  return d.focus ? d.focus(f) : camAt(id, f).look;
};

/** near framing objects: visible while a <= f < b; kit = a GLB name accepted by build.ts prop() */
export type Fg = { a: number; b: number; kit: string; pos: V3; s?: number; yaw?: number };
export const FOREGROUND: Fg[] = [
  { a: SHOT_F(3), b: SHOT_F(4), kit: "cart", pos: [30.5, D0, -24], s: 0.9, yaw: 0.7 },
  { a: SHOT_F(12), b: SHOT_F(13), kit: "plant_bushDetailed", pos: [-1.2, D0, 21.5], s: 1.15, yaw: 0.4 },
  { a: SHOT_F(14), b: SHOT_F(15), kit: "cart", pos: [34.5, D0, -27], s: 0.85, yaw: 0.5 },
];
