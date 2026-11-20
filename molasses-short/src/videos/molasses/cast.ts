// Our cast as lit flat sprites in the 3D world (same pool/shading pipeline as the bridge short: canvas pool,
// camera-facing billboards, cardShade() lighting, contact blobs, unlit effect cards on the NOINK layer).
// Story cast: North End residents (street, buckets at the seam), runners, the stuck, the can kid, the fireman
// hammers the new rule onto a sign, and the cleanup. Effects: seam creaks, rivet sparks, the burst, the gushes,
// the cork pop and the flood rings.
import * as THREE from "three";
import {
  Pen, bodyFront, bodySide, townsfolk, KID, PARENT, fxBurst, fxCreak, fxRing, fxShadow, fxContact, fxPlank, fxHat, fxBottle, fxBucket, fxMolassRing, fxMolassPuddle, fxGush,
  Outfit, Expr, FrontOpts, SideOpts, INK,
} from "./toon";
import { FPS, D0, SHOTS, TANK, LEAK, SIGN_AT, HITS, SHOOK, S, W, BURST, V3, FloodState, clamp01, smooth } from "./story";
import { LIGHTS } from "./lights";
import { NOINK } from "./ink";
import { cardShade, blobMaterial, CARD_K } from "./cardshade";

// ---------------- canvas pool ----------------
type Entry = { cv: HTMLCanvasElement; tex: THREE.CanvasTexture; w: number; h: number };
export type Req = { key: string; w: number; h: number; k: number; draw: (p: Pen) => void; tex?: THREE.CanvasTexture };
const makeEntry = (w: number, h: number): Entry => {
  const cv = document.createElement("canvas");
  cv.width = w; cv.height = h;
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  return { cv, tex, w, h };
};
export class Pool {
  private live = new Map<string, Entry>();
  private free: Entry[] = [];
  private reqs: Req[] = [];
  req(key: string, w: number, h: number, k: number, draw: (p: Pen) => void) {
    const r: Req = { key: `${w}x${h}|${key}`, w, h, k, draw };
    this.reqs.push(r);
    return r;
  }
  flush() {
    const want = new Map<string, Req[]>();
    for (const r of this.reqs) { const l = want.get(r.key); if (l) l.push(r); else want.set(r.key, [r]); }
    for (const [key, e] of this.live) if (!want.has(key)) { this.live.delete(key); this.free.push(e); }
    for (const [key, rs] of want) {
      let e = this.live.get(key);
      if (!e) {
        const r = rs[0], i = this.free.findIndex((x) => x.w === r.w && x.h === r.h);
        e = i >= 0 ? this.free.splice(i, 1)[0] : makeEntry(r.w, r.h);
        const g = e.cv.getContext("2d")!;
        g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, e.w, e.h); g.setTransform(r.k, 0, 0, r.k, 0, 0);
        r.draw(new Pen(g));
        e.tex.needsUpdate = true;
        this.live.set(key, e);
      }
      for (const r of rs) r.tex = e.tex;
    }
    this.reqs = [];
  }
}

// ---------------- sprite meshes ----------------
const blank = (() => { const c = document.createElement("canvas"); c.width = c.height = 2; return new THREE.CanvasTexture(c); })();
export const SU = 0.00216; // metres per design unit: 1000 units = 2.16 m
const BODY = (() => { const g = new THREE.PlaneGeometry(600 * SU, 1000 * SU); g.translate(0, (975 - 500) * SU, 0); return g; })();
const CARD = new THREE.PlaneGeometry(1, 1);
/** world roots that hold actors (to find the scene's sun when world.ts does not pass it) */
const ROOTS = new Set<THREE.Object3D>();

export class Actor {
  mesh: THREE.Mesh; mat: THREE.MeshLambertMaterial; dmat: THREE.MeshDepthMaterial; r: Req | null = null;
  constructor(parent: THREE.Object3D, geo: THREE.BufferGeometry = BODY) {
    this.mat = cardShade(new THREE.MeshLambertMaterial({ map: blank, alphaTest: 0.5, side: THREE.DoubleSide }));
    this.mat.alphaToCoverage = false;
    this.dmat = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: blank, alphaTest: 0.5, side: THREE.DoubleSide });
    this.mesh = new THREE.Mesh(geo, this.mat);
    this.mesh.customDepthMaterial = this.dmat;
    this.mesh.onBeforeRender = (r) => { const rt = r.getRenderTarget(); CARD_K.uPx.value = (rt ? rt.height : r.domElement.height) / 1920; };
    this.mesh.castShadow = false; this.mesh.receiveShadow = true; this.mesh.visible = false;
    this.mesh.rotation.order = "YXZ"; this.mesh.renderOrder = 1; this.mesh.layers.set(NOINK);
    parent.add(this.mesh);
    ROOTS.add(parent);
  }
  bind() { const t = this.r?.tex; if (t) { this.mat.map = t; this.dmat.map = t; } }
}
/** unlit effect card: hard cut-out (ink drawings), soft see-through (dust, mist) or a multiply ground blob */
export class Fx {
  mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial; soft: THREE.MeshBasicMaterial; blob: THREE.MeshBasicMaterial; r: Req | null = null;
  constructor(parent: THREE.Object3D) {
    this.mat = new THREE.MeshBasicMaterial({ map: blank, alphaTest: 0.5, side: THREE.DoubleSide });
    this.mat.alphaToCoverage = false;
    this.soft = new THREE.MeshBasicMaterial({ map: blank, transparent: true, depthWrite: false, side: THREE.DoubleSide });
    this.blob = blobMaterial(blank);
    this.mesh = new THREE.Mesh(CARD, this.mat);
    this.mesh.visible = false; this.mesh.layers.set(NOINK);
    parent.add(this.mesh);
  }
  use(soft: boolean) { this.mesh.material = soft ? this.soft : this.mat; }
  bind() {
    const t = this.r?.tex;
    if (!t) return;
    if (this.r!.key.includes("|blob|")) {
      if (t.generateMipmaps) { t.generateMipmaps = false; t.minFilter = THREE.LinearFilter; t.needsUpdate = true; }
      this.blob.map = t; this.mesh.material = this.blob; this.mesh.renderOrder = 0.5;
    }
    else { this.mat.map = t; this.soft.map = t; this.mesh.renderOrder = 0; }
  }
}

export type Place = {
  key: string; draw: (p: Pen) => void; x: number; y: number; z: number;
  scale?: number; mirror?: boolean; yaw?: number; geo?: "body"; roll?: number; size?: [number, number, number];
};
export type FxPlace = { key: string; cw: number; ch: number; draw: (p: Pen) => void; x: number; y: number; z: number; w: number; h: number; flat?: boolean; rot?: number; soft?: boolean };
/** sun = world direction TOWARD the sun (optional: when absent the scene's shadow-casting light is used) */
export type CamInfo = { pos: THREE.Vector3; right: THREE.Vector3; sun?: THREE.Vector3 };

const hh = (i: number, s = 0) => { const v = Math.sin(i * 127.1 + s * 311.7) * 43758.5453; return v - Math.floor(v); };
const q = (v: number, n = 120) => Math.round(v * n) / n;
const FOLK = [0, 1, 2, 3, 4, 5].map((v) => townsfolk(v));
const FIREMAN: Outfit = { jacket: "#4a4046", pants: "#34383f", boots: INK, hat: "cap", cap: "#b8402e", belt: "#24242c", build: "stout", moustache: "#4a3020" };
const vOf = (i: number) => (i * 7 + (i >> 2)) % 6;
/** head-shape seed */
const seedOf = (i: number) => ((i * 5 + 3) % 7) + 1;
/** drawing resolution by distance: [canvas w, h, scale from the 600 x 1000 design]; sized for the 1440 x 2560 final */
const tier = (d: number): [number, number, number] =>
  d < 3.2 ? [1800, 3000, 3.0] : d < 6.5 ? [1080, 1800, 1.8] : d < 16 ? [480, 800, 0.8] : [240, 400, 0.4];

// ---------------- light ----------------
const SUN = new THREE.Vector3(0.5, 0.75, -0.4).normalize();
const tmp = new THREE.Vector3();
let LNAME: "day" | "golden" = "day";
const sunOf = (root: THREE.Object3D) => {
  let s: THREE.DirectionalLight | null = null;
  root.traverse((o) => { if (!s && o instanceof THREE.DirectionalLight && o.castShadow) s = o; });
  return s as THREE.DirectionalLight | null;
};
const findSun = (cam: CamInfo, out: THREE.Vector3) => {
  if (cam.sun) return out.copy(cam.sun).normalize();
  let best: THREE.DirectionalLight | null = null, err = Infinity;
  for (const r of ROOTS) {
    if (!r.parent) continue;
    const s = sunOf(r);
    if (!s) continue;
    const d = tmp.copy(s.target.position).sub(cam.pos), e = Math.abs(d.dot(cam.right)) / (d.length() || 1);
    if (e < err) { err = e; best = s; }
  }
  return best ? out.copy(best.position).sub(best.target.position).normalize() : out;
};
const light2D = (cam: CamInfo, mirror: boolean) => {
  const sx = SUN.dot(cam.right) * (mirror ? -1 : 1), sy = -SUN.y;
  return Math.round(Math.atan2(sy, sx) / (Math.PI / 4)) * (Math.PI / 4);
};

/** front / side view and mirroring for someone at (x, z) walking along (dx, dz); fs = foreshortening of the walk */
const viewOf = (cam: CamInfo, x: number, z: number, dx: number, dz: number) => {
  const tx = cam.pos.x - x, tz = cam.pos.z - z, tl = Math.hypot(tx, tz) || 1;
  const c = (tx * dx + tz * dz) / tl;
  return { side: c < 0.57, mirror: dx * cam.right.x + dz * cam.right.z < 0, fs: Math.round(Math.sqrt(Math.max(0, 1 - c * c)) * 20) / 20 };
};

// ---------------- life: blinks and reaction timing ----------------
/** reference expression and action changes land 0-3 f before the word onset */
const LEAD = 2 / FPS;
const LID = [0.5, 1, 1, 0.5];
const fkey = (o: object) => JSON.stringify(o, (_k, v) => (typeof v === "number" ? q(v) : v));
const lidAt = (t: number, i: number, swaps: number[] = []) => {
  const f = Math.round(t * FPS);
  for (const ts of swaps) { const k = f - Math.round((ts - LEAD) * FPS) + 1; if (k >= 0 && k < 4) return LID[k]; }
  let s = Math.round(-60 * hh(i, 9));
  for (let n = 0; s <= f && n < 400; n++) {
    const k = f - s;
    if (k >= 0 && k < 4) return LID[k];
    s += Math.round(15 + 54 * hh(i * 31 + n, 13));
  }
  return 0;
};

type Who = { i: number; o: Outfit; okey: string };
/** one character drawing in the 600 x 1000 design space, sized by distance, lit from the scene's sun */
const person = (cam: CamInfo, who: Who, x: number, y: number, z: number, view: { side: boolean; mirror: boolean }, fo: FrontOpts, so: SideOpts, scale = 1): Place & { tierKey: string } => {
  const d = cam.pos.distanceTo(tmp.set(x, y + 1.2, z)) / scale;
  const [w, h, k] = tier(d);
  const mirror = view.side && view.mirror, light = light2D(cam, mirror), seed = seedOf(who.i);
  const f2: FrontOpts = { ...fo, light, seed }, s2: SideOpts = { ...so, light, seed };
  const key = view.side ? `S|${who.okey}|${fkey(s2)}` : `F|${who.okey}|${fkey(f2)}`;
  return {
    key, x, y, z, scale, mirror, tierKey: `${w}`,
    draw: (p) => (view.side ? bodySide(p, who.o, s2) : bodyFront(p, who.o, f2)),
    size: [w, h, k],
  };
};

/** ground shadow under a standing / sitting card (multiply, blue-violet): a tight contact pool right under the feet,
 *  plus by day a lighter soft tail stretched away from the sun. Golden: world.ts casts real card shadows. */
const CONTACT: Record<"day" | "golden", [number, number, number]> = { day: [0.2, 0.21, 0.33], golden: [0.24, 0.2, 0.33] };
const TAIL: [number, number, number] = [0.42, 0.44, 0.62];
const toSrgb = (v: number) => { const c = clamp01(v); return c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055; };
const hexOf = (c: [number, number, number], k: number) => "#" + c.map((v) => Math.round(255 * toSrgb(1 - (1 - v) * k)).toString(16).padStart(2, "0")).join("");
const blob = (out: Stage, x: number, y: number, z: number, sc = 1, k = 1) => {
  const hl = Math.hypot(SUN.x, SUN.z) || 1, ox = -SUN.x / hl, oz = -SUN.z / hl, rot = Math.atan2(-ox, -oz);
  if (LNAME === "day") {
    const el = Math.asin(Math.min(0.99, Math.max(0.1, SUN.y)));
    const len = Math.min(2.4, Math.max(0.5, 1.6 / Math.tan(el))) * sc, h = len + 0.55 * sc, c = 0.3 * h;
    const tc = hexOf(TAIL, k);
    out.fx.push({ key: `blob|shadow|${tc}`, cw: 128, ch: 256, draw: (p) => fxShadow(p, tc), x: x + ox * c, y: y + 0.018, z: z + oz * c,
      w: 0.72 * sc, h, flat: true, rot });
  }
  const cc = hexOf(CONTACT[LNAME], k);
  out.fx.push({ key: `blob|contact|${cc}`, cw: 128, ch: 128, draw: (p) => fxContact(p, cc), x: x + ox * 0.03 * sc, y: y + 0.022, z: z + oz * 0.03 * sc,
    w: 0.52 * sc, h: 0.4 * sc, flat: true, rot });
};

// ---------------- crowd by shot ----------------
export type Stage = { places: Place[]; fx: FxPlace[] };

/** word-index frame -> seconds (W frames are absolute frames) */
const fp = (f: number) => f / FPS;
/** expression swaps (absolute seconds, lidAt applies the 2-frame lead): eyes move just before the hook word */
const SWAPS: Record<number, number[]> = {
  3: [fp(W[2]?.[4] ?? 0), fp(W[2]?.[6] ?? 0)],            // grins drop at "groaned" and "wept"
  6: [fp(W[5]?.[6] ?? 0), fp(W[5]?.[9] ?? 0)],            // calm -> nervous at "loud", ear back at "phone"
  7: [fp(BURST)],                                         // shock at "unzip"
  10: [fp(W[7]?.[6] ?? 0)],                               // dazed at "Unluckily"
  15: [fp(W[11]?.[9] ?? 0)],                              // relief at "candy"
};

/** residents by the tank: strollers along the street (front cards) and the bucket line at the seam.
 *  Buckets are little fx cards at hand height; the leak keeps a dark drip pool on the pad. */
const street = (id: number, t: number, cam: CamInfo, out: Stage) => {
  const strolls: [number, number, number][] = [
    [24, 0, -21.5], [27.5, 0, -17], [31, 0, -23], [34.5, 0, -18.5], [22.5, 0, -14], [28, 0, -10.5],
    [44, 0, -22.5], [49, 0, -20], [36.5, 0, -8], [40, 0, -5.5], [43.5, 0, -8.5], [30, 0, -25.5],
  ];
  strolls.forEach(([x, , z], i) => {
    const kid = i % 6 === 2, sc = kid ? 0.72 : 1;
    const o = kid ? KID : FOLK[vOf(i + 11)];
    const expr: Expr = i % 3 === 0 ? "nervous" : i % 3 === 1 ? "neutral" : "stern";
    const ph = q(((t * 0.55 + hh(i, 3)) % 1.6) / 1.6, 120);
    const fo: FrontOpts = { mode: "stroll", phase: ph, expr, blink: lidAt(t, i, SWAPS[id] ?? []) };
    const view = viewOf(cam, x, z, -1, 0);
    const so: SideOpts = { mode: "march", phase: ph, expr, stomp: 0.5, stride: 0.875 * view.fs };
    out.places.push(person(cam, { i, o, okey: kid ? "kid" : `f${vOf(i + 11)}` }, x, D0, z, view, fo, so, sc));
    blob(out, x, D0, z, sc);
  });
  // the bucket line at the seam (2 kids + 2 adults at the leak, one filling): buckets + drip pool fx
  const line: [number, number, number][] = [[45.4, LEAK[2] + 0.9, 0], [46.9, LEAK[2] + 2.3, 0.72], [44.0, LEAK[2] - 1.1, 0.72], [47.8, LEAK[2] - 0.7, 0]];
  line.forEach(([x, z, sc], i) => {
    const kid = i % 2 === 1;
    const o = kid ? KID : FOLK[vOf(i + 3)];
    const expr: Expr = id === 3 ? (SWAPS[3] ?? []).every((sw) => t < sw) ? (i % 2 ? "grin" : "smile") : "nervous" : "nervous";
    const fo: FrontOpts = { mode: "stand", expr, blink: lidAt(t, i + 30, SWAPS[id] ?? []) };
    out.places.push(person(cam, { i: i + 30, o, okey: `${kid ? "k" : "f"}${vOf(i + 3)}` }, x, D0, z, { side: false, mirror: false }, fo, {}, kid ? 0.72 : 1));
    blob(out, x, D0, z, kid ? 0.72 : 1);
    const fill = i === 1 ? Math.max(0, 0.75 + 0.25 * Math.sin(t * 2.2)) : 0;
    out.fx.push({ key: `bucket${q(fill, 20)}`, cw: 220, ch: 260, draw: (p) => fxBucket(p, fill), x: x + 0.28, y: D0 + 0.72, z: z - 0.05, w: 0.26, h: 0.31, rot: 0.06 * Math.sin(t * 3 + i) });
  });
  // the drip pool (grows over the film, before the burst it is small)
  const grow = clamp01((t - fp(S[2])) / 30);
  out.fx.push({ key: `molassPuddle${q(grow, 30)}`, cw: 400, ch: 240, draw: (p) => fxMolassPuddle(p, q(grow, 30)), x: LEAK[0] + 0.3, y: LEAK[1] + 0.02, z: LEAK[2], w: 1.1 + grow, h: 0.6 + grow * 0.5, flat: true });
};

/** workers at the wall at noon: one listens, one phones the office */
const workers = (t: number, cam: CamInfo, out: Stage) => {
  const spots: [number, number, number][] = [[49.2, D0, -15.2], [55.4, D0, -12.6]];
  spots.forEach(([x, y, z], i) => {
    const o: Outfit = i ? FIREMAN : FOLK[2];
    const listen = i === 0;
    const expr: Expr = t >= (SWAPS[6]?.[0] ?? 0) ? "nervous" : "neutral";
    const fo: FrontOpts = { mode: "stand", expr, look: listen ? 1 : -1, blink: lidAt(t, 60 + i, SWAPS[6] ?? []) };
    out.places.push(person(cam, { i: 60 + i, o, okey: i ? "wm" : "w0" }, x, y, z, { side: false, mirror: false }, fo, {}));
    blob(out, x, y, z, 1.05);
    if (i === 1) out.fx.push({ key: "bucketCall", cw: 220, ch: 260, draw: (p) => fxBucket(p, 0), x: x + 0.3, y: y + 0.74, z: z - 0.06, w: 0.24, h: 0.28, rot: -0.1 });
  });
};

/** the ones who run (shot 9): toward town, away from the surge, glancing back */
const flee = (t: number, cam: CamInfo, out: Stage) => {
  for (let i = 0; i < 12; i++) {
    const sp = 1.1 + hh(i) * 0.5, x = -6 + (i / 12) * 22 - sp * (t - (S[7] - 2) / FPS), z = 2 + (hh(i, 2) - 0.5) * 7;
    const kid = i % 5 === 3, sc = kid ? 0.7 : 1;
    const o = kid ? KID : FOLK[vOf(i)];
    const expr: Expr = i % 3 ? "shock" : "nervous";
    const ph = q(((t - (S[7] - 2) / FPS) * sp / 1.1 + hh(i, 5)) % 1, 120);
    const fo: FrontOpts = { mode: "march", phase: ph, expr, look: i % 2 ? 1 : 0, blink: lidAt(t, i) };
    const view = viewOf(cam, x, z, -1, 0);
    const so: SideOpts = { mode: "march", phase: ph, expr, stomp: 1.2, stride: 1.5 * view.fs };
    out.places.push(person(cam, { i, o, okey: `${kid ? "k" : "f"}${vOf(i)}` }, x, D0, z, view, fo, so, sc));
    blob(out, x, D0, z, sc);
  }
};

/** the stuck ones (shot 10): sitting in the settled flood at the lens's water level */
const wade = (t: number, b: FloodState, cam: CamInfo, out: Stage) => {
  const spots: [number, number][] = [[-19.5, 1.2], [-20.8, -0.4], [-22.5, 2.6], [-23.4, 0.8], [-21.2, 4.4], [-24.8, 2.2], [-25.6, -1.2], [-22.0, 5.6], [-26.4, 3.8]];
  const sink = Math.min(0.62, 0.35 * b.depth);
  spots.forEach(([x, z], i) => {
    const bare = i % 3 === 1, o = FOLK[vOf(i + 5)];
    const y = D0 + 0.16 + 0.55 - 0.2 * sink / 0.62;
    const ex: Expr[] = ["dazed", "pained", "relief", "dazed"];
    const sit = fp(W[7]?.[6] ?? 0);
    out.places.push(person(cam, { i: i + 80, o, okey: `f${vOf(i + 5)}` }, x, y, z, { side: false, mirror: false },
      { mode: "sit", expr: t >= sit ? ex[i % 4] : "shock", blink: lidAt(t, i + 80, SWAPS[10] ?? []) }, {}));
    if (bare) out.fx.push({ key: "hatFloat", cw: 200, ch: 200, draw: fxHat, x: x + 0.6, y: D0 + 0.14, z: z - 0.4, w: 0.4, h: 0.4, rot: -0.4 + hh(i, 6) });
    out.fx.push({ key: `molassRing${q(((t * 0.5 + hh(i, 7)) % 1.4) / 1.4, 30)}`, cw: 600, ch: 600, draw: (p) => fxMolassRing(p, q(((t * 0.5 + hh(i, 7)) % 1.4) / 1.4, 30)), x, y: D0 + 0.18, z, w: 1.9, h: 1.9, flat: true });
    out.fx.push({ key: `blob|contact|MOLC`, cw: 128, ch: 128, draw: (p) => fxContact(p, "#77614c"), x, y: D0 + 0.2, z, w: 0.8, h: 0.55, flat: true });
  });
  // two hats and a plank drifting past the lens, half sunk
  const FLOAT: { x: number; z: number; s: number; r: number; kind: "hat" | "plank" }[] = [
    { x: -18.9, z: 1.4, s: 0.45, r: 0.5, kind: "hat" }, { x: -21.6, z: 3.2, s: 0.5, r: -0.3, kind: "plank" },
  ];
  FLOAT.forEach((fl, i) => {
    const bob = 0.03 * Math.sin(t * 1.4 + i * 1.9), r = fl.r + 0.06 * Math.sin(t * 0.9 + i);
    if (fl.kind === "hat") out.fx.push({ key: "hatFloat", cw: 200, ch: 200, draw: fxHat, x: fl.x, y: D0 + 0.13 + bob, z: fl.z, w: fl.s, h: fl.s, rot: r });
    else out.fx.push({ key: "plank", cw: 320, ch: 110, draw: fxPlank, x: fl.x, y: D0 + 0.12 + bob, z: fl.z, w: fl.s, h: fl.s * 0.34, rot: r });
  });
};

/** the girl with the bottle at the stoop (shot 12): shakes it, the cork pops on "shook" */
const canKid = (t: number, cam: CamInfo, out: Stage) => {
  const KID_AT: [number, number] = [-9.4, 26.4], KID2: [number, number] = [-10.8, 27.6];
  const shake = t < SHOOK_T() ? 0.05 * Math.sin(t * 22) : 0;
  const kid2: FrontOpts = { mode: "stand", expr: t < SHOOK_T() ? "grin" : "shock", blink: lidAt(t, 90) };
  out.places.push(person(cam, { i: 90, o: KID, okey: "kid" }, KID_AT[0] + shake, D0, KID_AT[1], { side: false, mirror: false },
    { mode: "stand", expr: "grin", tilt: shake * 6, blink: lidAt(t, 89) }, {}));
  out.places.push(person(cam, { i: 91, o: PARENT, okey: "parent" }, KID2[0], D0, KID2[1], { side: false, mirror: false }, kid2, {}, 1));
  blob(out, KID_AT[0], D0, KID_AT[1], 0.72);
  blob(out, KID2[0], D0, KID2[1]);
  const pop = clamp01((t - SHOOK_T()) / 0.5);
  out.fx.push({ key: "bottle", cw: 240, ch: 430, draw: (p) => fxBottle(p, pop), x: KID_AT[0] + 0.24 + shake, y: D0 + 0.95, z: KID_AT[1] - 0.18, w: 0.22, h: 0.39, rot: shake * 8 });
};
const SHOOK_T = () => SHOOK / FPS;

/** the fireman hammers the new rule onto the sign (shot 14) */
const hammerK = (t: number) => {
  let k = 1;
  for (const th of HITS) {
    const n = (t - th / FPS) * FPS;
    if (n >= -11 && n < -7) k = Math.min(k, 1 - smooth((n + 11) / 4));
    else if (n >= -7 && n < 0) k = 0;
  }
  return k;
};
const signShot = (t: number, cam: CamInfo, out: Stage) => {
  const fo: FrontOpts = { mode: "stand", expr: "stern", prop: ["hammer", q(hammerK(t), 30)], blink: lidAt(t, 99) };
  out.places.push(person(cam, { i: 99, o: FIREMAN, okey: "fire" }, 40.2, D0, -23.2, { side: false, mirror: false }, fo, {}));
  blob(out, 40.2, D0, -23.2, 1.1);
  for (const th of HITS) {
    const tt = th / FPS;
    if (t >= tt && t < tt + 5 / FPS) {
      const u = (t - tt) / (5 / FPS);
      out.fx.push({ key: `burst${q(u, 30)}`, cw: 500, ch: 500, draw: (p) => fxBurst(p, q(u, 30)), x: SIGN_AT[0] - 0.2, y: D0 + 1.55, z: SIGN_AT[2], w: 0.8, h: 0.8 });
    }
  }
  onlookers(t, cam, out, 3);
};
/** two neighbours watching the sign */
const onlookers = (t: number, cam: CamInfo, out: Stage, n: number) => {
  const spots: [number, number, number][] = [[38.2, D0, -20.5], [37.0, D0, -18.6], [39.4, D0, -18.2]];
  for (let i = 0; i < n; i++) {
    const [x, y, z] = spots[i];
    out.places.push(person(cam, { i: 110 + i, o: FOLK[vOf(i)], okey: `f${vOf(i)}` }, x, y, z, { side: false, mirror: false },
      { mode: "stand", expr: i === 1 ? "relief" : "smile_closed", blink: lidAt(t, 110 + i) }, {}));
    blob(out, x, y, z);
  }
};

/** the street after (shot 15): wipers and the sweet-tooth kids at the stoop */
const cleanup = (t: number, cam: CamInfo, out: Stage) => {
  const spots: [number, number, number, number][] = [
    [-13.5, D0, 24.5, 1], [-15.2, D0, 26.2, 0.72], [-11.2, D0, 27.2, 0.72], [-14.6, D0, 22.8, 1],
    [-16.4, D0, 25.0, 1], [-12.4, D0, 29.4, 1], [-17.8, D0, 23.4, 1], [-15.8, D0, 28.6, 0.72],
  ];
  spots.forEach(([x, y, z, sc], i) => {
    const o = sc < 1 ? KID : FOLK[vOf(i + 2)];
    const expr: Expr = t >= (SWAPS[15]?.[0] ?? 0) ? (i % 2 ? "relief_open" : "laugh") : (i % 2 ? "smile" : "relief");
    out.places.push(person(cam, { i: 150 + i, o, okey: sc < 1 ? "kid" : `f${vOf(i + 2)}` }, x, y, z, { side: false, mirror: false },
      { mode: "stand", expr, blink: lidAt(t, 150 + i, SWAPS[15] ?? []) }, {}, sc));
    blob(out, x, y, z, sc, i % 2 ? 0.7 : 1);
  });
  mopup(t, out);
};
/** drying brown patches peel off the cobbles between the stoop kids */
const mopup = (t: number, out: Stage) => {
  const spots: [number, number][] = [[-14.2, 25.6], [-12.8, 28.0], [-16.4, 26.4]];
  spots.forEach(([x, z], i) => {
    const u = clamp01((t - (S[10] + 60) / FPS) / 6 - i * 0.3);
    if (u <= 0 || u >= 1) return;
    out.fx.push({ key: `molassPuddleShrunk${q(u, 30)}`, cw: 400, ch: 240, draw: (p) => fxMolassPuddle(p, 1 - q(u, 30)), x, y: D0 + 0.03, z, w: 2.4 * (1 - u) + 0.4, h: 1.4 * (1 - u) + 0.25, flat: true });
  });
};

/** everything with a face in shot `id` at time t */
export const stage = (id: number, t: number, b: FloodState, cam: CamInfo): Stage => {
  const out: Stage = { places: [], fx: [] };
  const s = SHOTS[id - 1];
  LNAME = s.light;
  findSun(cam, SUN);
  if (s.crowd === "street") street(id, t, cam, out);
  if (id === 6) workers(t, cam, out);
  if (s.crowd === "flee") flee(t, cam, out);
  if (s.crowd === "wade") wade(t, b, cam, out);
  if (id === 12) canKid(t, cam, out);
  if (s.crowd === "sign") signShot(t, cam, out);
  if (s.crowd === "cleanup") cleanup(t, cam, out);
  return out;
};

// ---------------- one-off effects ----------------
/** rivet sparks firing at the seam ("fire off like rifle shots") */
export const rivetFx = (t: number, out: Stage) => {
  const t0 = (W[6]?.[9] ?? RIV_T) / FPS, t1 = t0 + (BURST - (W[6]?.[9] ?? 0)) / FPS;
  if (t < t0 - 0.2 || t > t1 + 0.15) return;
  const u = (t - t0) / (t1 - t0);
  const pts: V3[] = [[47.6, TANK[1] + 2.2, -16.9], [45.8, TANK[1] + 3.4, -19.4], [48.2, TANK[1] + 4.6, -14.2]];
  pts.forEach((p2, i) => {
    const uu = clamp01((u - i * 0.22) / 0.5);
    if (uu <= 0 || uu >= 1) return;
    out.fx.push({ key: `rivet${q(uu, 30)}`, cw: 500, ch: 500, draw: (p) => fxBurst(p, q(uu, 30), "#fff3b0", 7, 30, 150), x: p2[0], y: p2[1], z: p2[2], w: 0.55, h: 0.55 });
  });
};
const RIV_T = (W[6]?.[9] ?? 900) / FPS;
export const BURST_T = BURST / FPS;
/** the burst itself: one big bright burst at the shell seam, plus a shockwave ring flat on the street */
export const burstFx = (tau: number, out: Stage) => {
  if (tau < 0 || tau >= 0.5) return;
  const u = tau / 0.5;
  out.fx.push({ key: `bigburst${q(u, 30)}`, cw: 500, ch: 500, draw: (p) => fxBurst(p, q(u, 30), "#ffd890", 12, 40, 240), x: TANK[0] - 9, y: TANK[1] + 6, z: TANK[2], w: 2.2, h: 2.2 });
  if (tau > 0.1 && tau < 0.8) {
    const r = (tau - 0.1) / 0.7;
    out.fx.push({ key: `molassRing${q(r, 30)}`, cw: 600, ch: 600, draw: (p) => fxMolassRing(p, q(r, 30)), x: TANK[0] - 12, y: D0 + 1.3, z: TANK[2], w: 18, h: 18, flat: true });
  }
};
/** the gush: brown lumps riding the front while it stretches down the street (shots 7-8) */
export const gushFx = (tau: number, out: Stage) => {
  if (tau <= 0 || tau >= 6) return;
  const front = tau < 0.5 ? 0 : tau;
  for (let i = 0; i < 6; i++) {
    const a = -0.5 + (i / 5) * 1.35, d = 9 + front * 8.5 + hh(i, 12) * 3;
    const x = TANK[0] - Math.cos(a) * d, z = TANK[2] + Math.sin(a) * d - 2;
    const s2 = 3.2 + hh(i, 14) * 2.6;
    const u = q((tau * 0.9 + hh(i, 16)) % 1, 30);
    out.fx.push({ key: `gush${u}`, cw: 800, ch: 800, draw: (p) => fxGush(p, u), x, y: D0 + 1.3 + s2 * 0.28, z, w: s2, h: s2 });
  }
};
export const creakFx = (t: number, pts: V3[], out: Stage, size = 0.8) =>
  pts.forEach(([x, y, z], i) => {
    const u = q((t * 1.3 + i * 0.37) % 1, 30);
    out.fx.push({ key: `creak${u}`, cw: 300, ch: 300, draw: (p) => fxCreak(p, u), x, y, z, w: size, h: size, rot: i * 0.6 - 0.6 });
  });
/** the cork pop foam (shot 12, on "shook") */
export const popFx = (t: number, out: Stage) => {
  const t0 = SHOOK_T(), u = (t - t0) / 0.45;
  if (u <= 0 || u >= 1) return;
  out.fx.push({ key: `pop${q(u, 30)}`, cw: 500, ch: 500, draw: (p) => fxBurst(p, q(u, 30), "#ffffff", 8, 30, 170), x: -9.16, y: D0 + 1.28, z: 26.2, w: 0.7, h: 0.7 });
  if (u > 0.15 && u < 1) {
    const r = (u - 0.15) / 0.85;
    out.fx.push({ key: `ring${q(r, 30)}`, cw: 600, ch: 600, draw: (p) => fxRing(p, q(r, 30)), x: -9.4, y: D0 + 0.06, z: 26.05, w: 1.3, h: 1.3, flat: true });
  }
};
export { FPS };
