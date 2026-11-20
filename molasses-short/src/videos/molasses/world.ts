// The whole place as one three.js scene: sky, the Commercial Street corridor lined with the painted town, the
// steel syrup tank on its pad (burst shell, lid), the molasses flood (radial-mask shader disc) and the cast.
// update(id, f, camera) poses everything for shot `id` at frame f (pure function of id + f).
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { staticFile } from "remotion";
import { Batch, boxGeo, lam, buildTown, Kit, Ray, kitClone, V } from "./build";
import { beam, ctex, rep, stoneHD, cobbleHD, grassHD, waterNear, waterFar, cloudHD } from "./paint";
import { Pen, fxSign } from "./toon";
import { LIGHTS, LOOK, LightPreset } from "./lights";
import { TONE, CHAR, LFB, twoTone, untone } from "./shade";
import { NOINK } from "./ink";
import { Pool, Actor, Fx, stage, burstFx, rivetFx, gushFx, creakFx, popFx, BURST_T } from "./cast";
import { FPS, D0, SHOTS, TANK, TANK_R, TANK_H, SIGN_AT, camAt, floodState, floodOn, tankLean, FloodState, V3, FOREGROUND, ShotDef } from "./story";

// ---------------- assets ----------------
const KENNEY = ["tree_oak", "tree_default", "tree_detailed", "tree_fat", "tree_cone", "tree-high-round", "tree", "plant_bushLarge", "plant_bushDetailed",
  "plant_bush", "hedge", "flower_redA", "flower_yellowA", "flower_purpleA", "grass_large", "grass", "lantern", "cart", "stall-red",
  "stall-green", "stall-bench", "banner-red", "banner-green", "windmill"];
export const loadKit = () => {
  if (!kitP) {
    const loader = new GLTFLoader();
    kitP = Promise.all(KENNEY.map((n) => loader.loadAsync(staticFile(`molasses/kenney/${n}.glb`)).then((g) => [n, g.scene] as const).catch(() => [n, null] as const)))
      .then((list) => Object.fromEntries(list.filter((e) => e[1]).map(([n, s]) => [n, s!])) as Kit);
  }
  return kitP;
};
let kitP: Promise<Kit> | null = null;

// shot 4 (first warm day) wants a higher west sun; golden beats 11-13 get the usual low backlight
const SUN_SHOT: Record<number, { az?: number; el?: number }> = { 2: { az: 120 }, 4: { az: -55, el: 30 }, 11: { az: -70, el: 8 }, 12: { az: -30, el: 18 }, 13: { az: -60, el: 10 } };
const smokeTex = () => ctex("smoke", 256, 256, (g) => {
  const p = new Pen(g);
  for (const [x, y, r, c] of [[90, 150, 60, "#8f8d96"], [150, 120, 70, "#a3a1aa"], [170, 165, 55, "#8f8d96"], [120, 100, 50, "#b4b2ba"]] as const) p.ell(x, y, r, r * 0.85, c, 0);
});

/** every lens position of the film looking at its subject: centre, sides and top of frame (houses there are left out) */
const sightLines = (): Ray[] => {
  const out: Ray[] = [];
  for (const s of SHOTS) for (let f = s.a - 8; f < s.b + 8; f += 2) {
    const c = camAt(s.id, Math.max(0, f)), o = V(...c.pos), look = V(...c.look);
    const fw = look.clone().sub(o), len = fw.length();
    fw.normalize();
    const rt = fw.clone().cross(V(0, 1, 0)).normalize(), up = rt.clone().cross(fw);
    const ty = Math.tan((c.fov * Math.PI) / 360), tx = ty * (9 / 16);
    for (const [sx, sy] of [[0, 0], [-0.6, 0], [0.6, 0], [0, 0.6], [0, -0.4]])
      out.push({ o, d: fw.clone().addScaledVector(rt, sx * tx).addScaledVector(up, sy * ty), len, core: sx === 0 && sy === 0 });
  }
  return out;
};

type Mats = Record<string, THREE.Material>;

export class World {
  root = new THREE.Group();
  private pool = new Pool();
  private actors: Actor[] = [];
  private fxs: Fx[] = [];
  private hemi: THREE.HemisphereLight; private sun: THREE.DirectionalLight; private fill: THREE.DirectionalLight;
  private sky: THREE.Mesh; private skyMat: THREE.ShaderMaterial;
  private fog = new THREE.Fog("#bccbec", 25, 420);
  private WU: Record<string, THREE.IUniform>;
  private sunDisc: THREE.Sprite; private sunHalo: THREE.Sprite;
  private sunCache = new Map<number, THREE.Vector3>();
  private cloudMaps: Record<"day" | "golden", THREE.Texture[]>;
  private fgs: { o: THREE.Object3D; a: number; b: number }[] = [];
  private flood: THREE.Mesh;
  private tankG = new THREE.Group();        // everything that leans pre-burst
  private shellBack: THREE.Mesh;
  private shellFront = new THREE.Group();   // hinge at the street-side bottom edge; falls on BURST
  private lid = new THREE.Group();
  private smoke: { m: THREE.Mesh; mat: THREE.MeshLambertMaterial; top: V3; k: number }[] = [];
  private clouds: THREE.Mesh[] = [];
  private sign = new THREE.Group();
  private frustum = new THREE.Frustum();
  private m4 = new THREE.Matrix4(); private v = new THREE.Vector3(); private sph = new THREE.Sphere();

  constructor(kit: Kit) {
    const R = this.root, M: Mats = {};
    // ---- sky + light ----
    this.skyMat = new THREE.ShaderMaterial({
      uniforms: { c0: { value: new THREE.Color() }, c1: { value: new THREE.Color() }, c2: { value: new THREE.Color() },
        c3: { value: new THREE.Color() }, c4: { value: new THREE.Color() }, e: { value: new THREE.Vector4() } },
      vertexShader: "varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
      fragmentShader: `uniform vec3 c0, c1, c2, c3, c4; uniform vec4 e; varying vec3 vP;
        void main(){ float el = asin(clamp(normalize(vP).y, -1.0, 1.0));
          vec3 c = mix(c0, c1, smoothstep(0.0, e.x, el));
          c = mix(c, c2, smoothstep(e.x, e.y, el));
          c = mix(c, c3, smoothstep(e.y, e.z, el));
          c = mix(c, c4, smoothstep(e.z, e.w, el));
          gl_FragColor = vec4(c, 1.0); }`,
      side: THREE.BackSide, depthWrite: false, fog: false,
    });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(1100, 48, 24), this.skyMat);
    this.sky.renderOrder = -1; this.sky.frustumCulled = false; this.sky.layers.set(NOINK);
    R.add(this.sky);
    this.sunDisc = new THREE.Sprite(new THREE.SpriteMaterial({ map: discTex(), color: new THREE.Color(6.0, 4.4, 2.4), fog: false, depthWrite: false }));
    this.sunHalo = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex(), color: new THREE.Color(1, 1, 1), fog: false, depthWrite: false, depthTest: true,
      transparent: true, blending: THREE.AdditiveBlending }));
    this.sunDisc.renderOrder = -0.5; this.sunHalo.renderOrder = 5;
    for (const m of [this.sunDisc, this.sunHalo]) { m.frustumCulled = false; m.layers.set(NOINK); R.add(m); }
    this.hemi = new THREE.HemisphereLight("#cfe6ff", "#6c5c8c", 1.1);
    this.sun = new THREE.DirectionalLight("#fff0d6", 2.6);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(4096, 4096);
    this.fill = new THREE.DirectionalLight("#9fb8ff", 0.35);
    R.add(this.hemi, this.sun, this.sun.target, this.fill, this.fill.target);
    this.cloudMaps = { day: [0, 1, 2, 3].map((k) => cloudHD(k, LOOK.day.cloud)), golden: [0, 1, 2, 3].map((k) => cloudHD(k, LOOK.golden.cloud)) };
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2 + 0.3, d = 620 + (i % 3) * 60;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: this.cloudMaps.day[i % 4], color: new THREE.Color(1.1, 1.1, 1.1), transparent: true, depthWrite: false, fog: false }));
      const w = 130 + (i % 4) * 30;
      m.position.set(Math.cos(a) * d, 120 + (i % 4) * 38, Math.sin(a) * d); m.scale.set(w, w / 2, 1);
      m.layers.set(NOINK);
      this.clouds.push(m); R.add(m);
    }

    // ---- ground, street (static batch) ----
    const b = new Batch();
    M.grass = lam("grassHD", () => ({ map: grassHD() }));
    M.cobble = lam("cobbleHD", () => ({ map: cobbleHD() }));
    M.lane = lam("laneHD", () => ({ map: stoneHD("laneHD", ["#b2a58f", "#a89b84", "#bcae96", "#9f9280"], "#8a7d6b") }));
    M.wall = lam("wallHD", () => ({ map: stoneHD("wallHD", ["#c9bcaa", "#bfb19f", "#d1c5b4", "#b8aa97"], "#958776") }));
    M.cope = lam("copeHD", () => ({ map: stoneHD("copeHD", ["#e6dccd", "#ddd3c3", "#ece4d6", "#d6cbba"], "#aea293") }));
    M.tank = lam("tankHD", () => ({ map: stoneHD("tankHD", ["#8b8578", "#807a6e", "#948e81", "#77705f"], "#5f584d") }));
    M.iron = twoTone(new THREE.MeshPhongMaterial({ color: "#3d414c", specular: "#8a8a8a", shininess: 60 }), 0.15);
    M.steel = twoTone(new THREE.MeshPhongMaterial({ color: "#7d8088", specular: "#b0b0b0", shininess: 45 }), 0.15);
    M.wood = lam("wood", () => ({ map: beam() }));
    M.grime = lam("grime", () => ({ color: "#2e2318" }));
    // fields beyond the street corridor
    for (const s of [-1, 1]) {
      const zn = s * 36.5, zf = s * 900;
      b.add(s < 0 ? quadUp(-900, 900, zf, zn, 450, 217.5) : quadUp(-900, 900, zn, zf, 450, 217.5), M.grass);
      b.add(s < 0 ? quadUp(-160, 160, -44.5, -36.5, 80, 2, 0.012) : quadUp(-160, 160, 36.5, 44.5, 80, 2, 0.012), M.cobble);
      b.add(s < 0 ? quadUp(-6, 6, -170, -36.5, 3, 33.375, 0.012) : quadUp(-6, 6, 36.5, 170, 3, 33.375, 0.012), M.cobble);
    }
    // Commercial Street: cobbled corridor + paved lane
    b.add(quadUp(-450, 450, -36.5, 36.5, 225, 9, 0.012), M.cobble);
    b.add(quadUp(-450, 450, -9, 9, 225, 4.5, 0.02), M.lane);
    // the tank pad + base ring
    b.add(boxGeo(V(TANK[0] - 16, D0, TANK[2] - 16), V(TANK[0] + 16, D0 + 1.05, TANK[2] + 16), 2), M.cope);
    b.add(boxGeo(V(TANK[0] - TANK_R - 0.5, D0 + 1.05, TANK[2] - TANK_R - 0.5), V(TANK[0] + TANK_R + 0.5, D0 + 1.22, TANK[2] + TANK_R + 0.5), 2), M.grime);
    b.build(R);
    buildTown(R, kit, sightLines());

    // ---- the flood: a flat molasses disc revealed by radius, marks drift slowly ----
    const wNear = waterNear(), wFar = waterFar();
    for (const t of [wNear, wFar]) { t.colorSpace = THREE.NoColorSpace; t.anisotropy = 16; t.needsUpdate = true; }
    this.WU = {
      wNearC: { value: new THREE.Color() }, wMidC: { value: new THREE.Color() }, wFarC: { value: new THREE.Color() },
      wCrest: { value: new THREE.Color() }, wTrough: { value: new THREE.Color() }, wGlint: { value: new THREE.Color() },
      wShade: { value: new THREE.Vector3(0.5, 0.56, 0.72) }, wNearTex: { value: wNear }, wFarTex: { value: wFar }, wTime: { value: 0 },
      fC: { value: new THREE.Vector2(TANK[0], TANK[2]) }, fR: { value: 0 },
    };
    const floodM = new THREE.MeshLambertMaterial({ color: 0xffffff });
    floodM.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, this.WU);
      sh.vertexShader = sh.vertexShader
        .replace("#include <common>", "#include <common>\nvarying vec3 vWP;")
        .replace("#include <project_vertex>", "#include <project_vertex>\nvWP = (modelMatrix * vec4(transformed, 1.0)).xyz;");
      sh.fragmentShader = sh.fragmentShader
        .replace("#include <common>", FLOOD_DECL)
        .replace("#include <map_fragment>", FLOOD_COL)
        .replace("#include <lights_fragment_begin>", "float sunVis = 1.0;\n" + LFB)
        .replace("#include <lights_fragment_end>", "#include <lights_fragment_end>\n  reflectedLight.directDiffuse = diffuseColor.rgb * mix(wShade, vec3(1.0), sunVis);\n  reflectedLight.indirectDiffuse = vec3(0.0);\n  diffuseColor.rgb = vec3(0.0);");
    };
    floodM.customProgramCacheKey = () => "molass1";
    const fg = new THREE.CircleGeometry(900, 48); fg.rotateX(-Math.PI / 2);
    this.flood = new THREE.Mesh(fg, floodM);
    this.flood.position.set(TANK[0], D0 + 0.16, TANK[2]);
    this.flood.receiveShadow = true; this.flood.frustumCulled = false; this.flood.visible = false;
    R.add(this.flood);

    // ---- the tank (half-shells so the street side can fall open) ----
    const cyl = (a0: number, len: number) => {
      const g = new THREE.CylinderGeometry(TANK_R, TANK_R, TANK_H, 48, 1, true, a0, len);
      g.translate(0, TANK_H / 2, 0);
      return g;
    };
    // street side of the shell looks toward -x: centre angle 1.5 pi
    const shellFrontG = cyl(1.2 * Math.PI, 0.6 * Math.PI);
    const shellBackG = cyl(1.8 * Math.PI, 1.4 * Math.PI);
    const hoop = (a0: number, len: number, y: number) => {
      const g = new THREE.TorusGeometry(TANK_R + 0.14, 0.09, 8, 40, len);
      g.rotateX(Math.PI / 2); g.rotateY(a0 - Math.PI / 2); g.translate(0, y, 0);
      return g;
    };
    this.shellBack = new THREE.Mesh(shellBackG, M.tank);
    this.shellBack.castShadow = true; this.shellBack.receiveShadow = true;
    for (const y of [1.8, 5.4, 9.0, 12.6]) this.shellBack.add(new THREE.Mesh(hoop(1.8 * Math.PI, 1.4 * Math.PI, y), M.iron));
    // roof + vent stay with the back half (the lid itself flies)
    const roof = new THREE.Mesh(new THREE.CylinderGeometry(0.6, TANK_R + 0.4, 1.3, 48), M.tank);
    roof.position.y = TANK_H + 0.65; roof.castShadow = true;
    const vent = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 2.6, 10), M.iron);
    vent.position.y = TANK_H + 2.2; vent.castShadow = true;
    this.shellBack.add(roof, vent);
    this.tankG.add(this.shellBack);
    // falling group: hinge on the street-side bottom edge (x = TANK[0] - R)
    const shellFrontMesh = new THREE.Mesh(shellFrontG, M.tank);
    shellFrontMesh.position.set(TANK_R, 0, 0);
    shellFrontMesh.castShadow = true; shellFrontMesh.receiveShadow = true;
    for (const y of [1.8, 5.4, 9.0, 12.6]) {
      const h = new THREE.Mesh(hoop(1.2 * Math.PI, 0.6 * Math.PI, y), M.iron);
      h.position.set(TANK_R, 0, 0);
      this.shellFront.add(h);
    }
    this.shellFront.add(shellFrontMesh);
    this.shellFront.position.set(TANK[0] - TANK_R, TANK[1], TANK[2]);
    this.tankG.add(this.shellFront);
    // lid group (cork + cone): flies on BURST, lands pinned on the street
    const lidC = new THREE.Mesh(new THREE.CylinderGeometry(0.5, TANK_R * 0.98, 1.1, 40), M.tank);
    lidC.position.y = 0.55; lidC.castShadow = true;
    const cork = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.9, 10), M.iron);
    cork.position.y = 1.5; cork.castShadow = true;
    this.lid.add(lidC, cork);
    this.lid.visible = false;
    this.tankG.add(this.lid);
    // filler pipe + valve on the back side
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, TANK_H * 0.72, 10), M.iron);
    pipe.position.set(4.5, TANK[1] + TANK_H * 0.36, TANK[2] + TANK_R); pipe.castShadow = true;
    const valve = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.09, 8, 16), M.steel);
    valve.position.set(4.5, TANK[1] + TANK_H * 0.4, TANK[2] + TANK_R + 0.5); valve.rotation.x = Math.PI / 2; valve.castShadow = true;
    R.add(this.tankG, pipe, valve);
    // chimney smoke (the mill behind the tank end of the street)
    const smokeT = smokeTex();
    for (const [top, n] of [[[-22, D0 + 30.6, -77], 7], [[-80, D0 + 24.6, 93], 6]] as const)
      for (let k = 0; k < n; k++) {
        const mat = new THREE.MeshLambertMaterial({ map: smokeT, transparent: true, depthWrite: false });
        const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
        m.layers.set(NOINK);
        this.smoke.push({ m, mat, top: top as unknown as V3, k: k / n }); R.add(m);
      }
    // the new rule's sign (shots 14-15): unlit painted face so the pictogram stays readable
    const board = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.04), new THREE.MeshBasicMaterial({ map: ctex("sign", 700, 520, (g) => fxSign(new Pen(g))), alphaTest: 0.5, color: 0xe6e6e6 }));
    board.layers.set(NOINK);
    board.position.set(SIGN_AT[0] - 0.04, D0 + 1.62, SIGN_AT[2]); board.rotation.y = -Math.PI / 2;
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.1, 1.46), M.wood);
    back.position.set(SIGN_AT[0], D0 + 1.62, SIGN_AT[2]);
    this.sign.add(board, back);
    for (const s of [-1, 1]) {
      const p = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.15, 0.12), M.wood);
      p.position.set(SIGN_AT[0] + 0.07, D0 + 1.07, SIGN_AT[2] + s * 0.52);
      this.sign.add(p);
    }
    this.sign.traverse((o) => { o.castShadow = true; o.receiveShadow = true; });
    R.add(this.sign);
    // the CAM agent's near framing objects: built once, never passed through the sight-line filter, toggled per frame
    for (const fg2 of FOREGROUND) {
      const o = kitClone(kit, fg2.kit, fg2.s ?? 1);
      if (!o) continue;
      o.position.set(...fg2.pos); o.rotation.y = fg2.yaw ?? 0; o.visible = false;
      this.fgs.push({ o, a: fg2.a, b: fg2.b }); R.add(o);
    }
  }

  /** camera-relative sun, frozen per shot: the shot's mean view direction turned by az toward screen right, lifted by el */
  private shotSun(id: number, s: ShotDef, L: LightPreset) {
    let v = this.sunCache.get(id);
    if (v) return v;
    let fx = 0, fz = 0;
    for (let f = s.a; f < s.b; f += 3) {
      const c = camAt(id, f), x = c.look[0] - c.pos[0], z = c.look[2] - c.pos[2], n = Math.hypot(x, z) || 1;
      fx += x / n; fz += z / n;
    }
    const n = Math.hypot(fx, fz) || 1; fx /= n; fz /= n;
    const ss = s as ShotDef & { sunAz?: number; sunEl?: number };
    const az = THREE.MathUtils.degToRad(ss.sunAz ?? SUN_SHOT[id]?.az ?? L.az), el = THREE.MathUtils.degToRad(ss.sunEl ?? SUN_SHOT[id]?.el ?? L.el);
    const hx = fx * Math.cos(az) - fz * Math.sin(az), hz = fz * Math.cos(az) + fx * Math.sin(az);
    v = new THREE.Vector3(hx * Math.cos(el), Math.sin(el), hz * Math.cos(el)).normalize();
    this.sunCache.set(id, v);
    return v;
  }

  private actor(i: number) { while (this.actors.length <= i) this.actors.push(new Actor(this.root)); return this.actors[i]; }
  private fx(i: number) { while (this.fxs.length <= i) this.fxs.push(new Fx(this.root)); return this.fxs[i]; }

  update(id: number, f: number, cam: THREE.PerspectiveCamera, scene: THREE.Scene) {
    const t = f / FPS, s = SHOTS[id - 1], tau = s.tau(t), b = floodState(tau), L = LIGHTS[s.light];
    // ---- camera ----
    const c = camAt(id, f);
    cam.position.set(...c.pos); cam.up.set(0, 1, 0); cam.lookAt(...c.look); cam.rotateZ(c.roll);
    cam.fov = c.fov; cam.near = 0.2; cam.far = 1500; cam.updateProjectionMatrix(); cam.updateMatrixWorld();
    const focus = V(...c.look), dist = cam.position.distanceTo(focus);
    cam.layers.enable(NOINK);
    // ---- light rig: camera-relative sun frozen per shot, two-tone uniforms, shadow fit ----
    const sunDir = this.shotSun(id, s, L);
    this.hemi.color.set(L.sky); this.hemi.groundColor.set(L.ground); this.hemi.intensity = L.hemiI;
    this.sun.color.set(L.sunCol); this.sun.intensity = L.sunI;
    let Rr = THREE.MathUtils.clamp(dist * 1.15 + 7, 12, 95);
    if (s.light === "golden") Rr = Math.max(Rr, 30);
    this.sun.position.copy(focus).addScaledVector(sunDir, 220); this.sun.target.position.copy(focus);
    const sc = this.sun.shadow.camera;
    sc.left = -Rr; sc.right = Rr; sc.top = Rr; sc.bottom = -Rr; sc.near = 20; sc.far = 480; sc.updateProjectionMatrix();
    this.sun.shadow.bias = L.bias; this.sun.shadow.normalBias = L.normalBias * (Rr / 12);
    this.fill.intensity = 0;
    TONE.uLitCol.value.set(...L.lit); TONE.uShadeCol.value.set(...L.shade); TONE.uShadeLift.value.set(...L.lift);
    TONE.uLambert.value = L.lambert; TONE.uSideK.value = L.sideK; TONE.uTerm.value = L.term; TONE.uBounce.value.set(...LOOK[s.light].bounce); TONE.uSat.value = LOOK[s.light].sat;
    CHAR.uCharTint.value.set(...L.charTint); CHAR.uCharShade.value = L.charShade; CHAR.uGrad.value = L.charGrad;
    CHAR.uBodyGrad.value = L.bodyGrad; CHAR.uSideTint.value.set(...L.sideTint);
    // ---- sky, fog, sun disc + halo, clouds ----
    const su = this.skyMat.uniforms;
    LOOK[s.light].sky.c.forEach((h, i) => untone(h, su["c" + i].value));
    const e = LOOK[s.light].sky.e.map((deg) => THREE.MathUtils.degToRad(deg));
    su.e.value.set(e[1], e[2], e[3], e[4]);
    this.sky.position.copy(cam.position);
    untone(L.fog, this.fog.color); this.fog.near = L.fogNear; this.fog.far = L.fogFar;
    scene.fog = this.fog; scene.background = null;
    const showSun = s.light === "golden";
    this.sunDisc.visible = this.sunHalo.visible = showSun;
    if (showSun) {
      this.sunDisc.position.copy(cam.position).addScaledVector(sunDir, 900);
      this.sunDisc.scale.setScalar(2 * 900 * Math.tan(THREE.MathUtils.degToRad(1.7)));
      this.sunHalo.position.copy(this.sunDisc.position); this.sunHalo.scale.setScalar(2 * 900 * Math.tan(THREE.MathUtils.degToRad(24)));
      (this.sunHalo.material as THREE.SpriteMaterial).color.set(L.sunDisc).multiplyScalar(1.3);
    }
    for (let i = 0; i < this.clouds.length; i++) {
      const m = this.clouds[i], mat = m.material as THREE.MeshBasicMaterial;
      m.lookAt(cam.position.x, m.position.y, cam.position.z);
      mat.map = this.cloudMaps[s.light][i % 4];
    }
    // ---- flood + tank ----
    const K = LOOK[s.light], wc = K.water;
    untone(wc.near, this.WU.wNearC.value); untone(wc.mid, this.WU.wMidC.value); untone(wc.far, this.WU.wFarC.value);
    untone(wc.crest, this.WU.wCrest.value); untone(wc.trough, this.WU.wTrough.value); untone(wc.glint, this.WU.wGlint.value);
    this.WU.wShade.value.set(...wc.shade); this.WU.wTime.value = tau * 0.3;
    this.flood.visible = floodOn(f) || id === 1;
    this.WU.fR.value = b.r;
    this.poseTank(b, t, id);
    this.sign.visible = id >= 14;
    for (const sm of this.smoke) {
      const u = (t * 0.11 + sm.k) % 1, sz = 3 + u * 9;
      sm.m.position.set(sm.top[0] - u * 18, sm.top[1] + u * 13 + u * u * 4, sm.top[2] + u * 3);
      sm.m.scale.set(sz, sz, 1); sm.m.quaternion.copy(cam.quaternion);
      sm.mat.opacity = 0.85 * (1 - u) ** 1.2;
    }
    // ---- foreground framing objects: inside their frames AND their own shot ----
    for (const g of this.fgs) g.o.visible = f >= g.a && f < g.b && g.a < s.b && g.b > s.a;
    // ---- cast + effects ----
    const right = V(0, 0, 0).setFromMatrixColumn(cam.matrixWorld, 0);
    const st = stage(id, tau, b, { pos: cam.position, right });
    if (id === 7) {
      rivetFx(t, st);
      if (t > BURST_T - 0.9 && t < BURST_T) creakFx(t, [[46.4, TANK[1] + 1.4, -16.4], [45.6, TANK[1] + 2.6, -19.2], [47.2, TANK[1] + 3.8, -15.6]], st, 0.34);
    }
    if (id === 8) burstFx(tau, st), gushFx(tau, st);
    if (id === 3 || id === 5 || id === 6) creakFx(t, [[46.4, TANK[1] + 1.4, -16.4], [45.8, TANK[1] + 4.9, -19.6], [47.4, TANK[1] + 8.2, -16.2]], st, id === 6 ? 0.5 : 0.34);
    if (id === 12) popFx(t, st);
    this.frustum.setFromProjectionMatrix(this.m4.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse));
    const tint = s.light === "golden" ? "#ffcf9e" : "#ffffff";
    let ai = 0;
    for (const p of st.places) {
      const sc2 = p.scale ?? 1;
      if (!this.frustum.intersectsSphere(this.sph.set(this.v.set(p.x, p.y + 1.1 * sc2, p.z), 3.5))) continue;
      const a = this.actor(ai++);
      const [w, h, k] = p.size ?? [300, 500, 0.5];
      a.r = this.pool.req(p.key, w, h, k, p.draw);
      a.mesh.visible = true;
      a.mesh.position.set(p.x, p.y, p.z);
      a.mesh.rotation.set(0, p.yaw ?? Math.atan2(cam.position.x - p.x, cam.position.z - p.z), p.roll ?? 0);
      a.mesh.scale.set(p.mirror ? -sc2 : sc2, sc2, sc2);
      if (a.mat.emissiveMap) a.mat.emissive.set(tint);
      a.mesh.castShadow = L.actorShadow;
    }
    for (let i = ai; i < this.actors.length; i++) this.actors[i].mesh.visible = false;
    let fi = 0;
    for (const p of st.fx) {
      if (!this.frustum.intersectsSphere(this.sph.set(this.v.set(p.x, p.y, p.z), Math.max(p.w, p.h)))) continue;
      const ef = this.fx(fi++);
      ef.r = this.pool.req(p.key, p.cw, p.ch, 1, p.draw);
      ef.use(!!p.soft);
      ef.mesh.visible = true;
      ef.mesh.position.set(p.x, p.y, p.z);
      if (p.flat) ef.mesh.rotation.set(-Math.PI / 2, 0, p.rot ?? 0);
      else { ef.mesh.quaternion.copy(cam.quaternion); ef.mesh.rotateZ(p.rot ?? 0); }
      ef.mesh.scale.set(p.w, p.h, 1);
    }
    for (let i = fi; i < this.fxs.length; i++) this.fxs[i].mesh.visible = false;
    this.pool.flush();
    for (let i = 0; i < ai; i++) this.actors[i].bind();
    for (let i = 0; i < fi; i++) this.fxs[i].bind();
    return focus;
  }

  /** the shell leans pre-burst; the street-side half swings down and out on BURST; the lid flies and lands */
  private poseTank(b: FloodState, t: number, id: number) {
    const lean = tankLean(t);
    const post = b.u > 0;
    this.tankG.rotation.z = post ? 0 : lean;
    this.tankG.rotation.x = post ? 0 : lean * 0.35;
    this.shellFront.rotation.z = 1.78 * b.u;
    this.shellFront.rotation.y = 0.12 * b.u;
    if (b.u >= 1) { this.lid.visible = id !== 1 && id !== 2; }
    else this.lid.visible = b.lid > 0.001;
    if (b.lid <= 0) return;
    const LAND = 2.6;
    if (b.lid < LAND) {
      const fl = b.lid;
      this.lid.position.set(TANK[0] - 6.5 * fl + 1.44, TANK[1] + TANK_H + 13 * fl - 4.9 * fl * fl, TANK[2] - 1.4 * fl);
      this.lid.rotation.set(-0.4 * fl, 0.3 * fl, 1.1 * fl);
      this.lid.scale.setScalar(1);
    } else {
      this.lid.position.set(TANK[0] - 6.5 * LAND + 1.44, D0 + 1.35, TANK[2] - 1.4 * 2.6);
      this.lid.rotation.set(-0.28, 0.78, 2.86);
      const k = Math.min(1, (b.lid - LAND) * 2);
      this.lid.scale.set(1, 1, 1); this.lid.rotateX(-0.06 * k);
    }
  }
}

const WATER_DECL = `#include <common>
varying vec3 vWP;
uniform vec3 wNearC, wMidC, wFarC, wCrest, wTrough, wGlint, wShade;
uniform sampler2D wNearTex, wFarTex;
uniform float wTime;`;
const FLOOD_DECL = WATER_DECL + `
uniform vec2 fC;
uniform float fR;`;
const FLOOD_COL = `
  vec3 wV = vWP - cameraPosition;
  float wd = length(wV);
  float wDep = asin(clamp(-wV.y / wd, 0.0, 1.0));
  float wf = 1.0 - smoothstep(0.0, 0.42, wDep);
  vec3 wc = mix(mix(wNearC, wMidC, smoothstep(0.0, 0.55, wf)), wFarC, smoothstep(0.55, 1.0, wf));
  vec2 wp = vWP.xz + vec2(0.35 * wTime, 0.12 * wTime);
  vec4 mk = mix(texture2D(wNearTex, wp / 8.0), texture2D(wFarTex, wp / 40.0 + 0.37), smoothstep(25.0, 90.0, wd));
  wc = mix(wc, wTrough, mk.g * 0.6);
  wc = mix(wc, wCrest, mk.r * 0.7);
  wc = mix(wc, wGlint, mk.b * (0.3 + 0.5 * wf));
  float fr = length(vWP.xz - fC);
  if (fr > fR) discard;
  wc = mix(wc, wCrest, smoothstep(fR - 2.2, fR, fr) * 0.55);
  diffuseColor.rgb = wc;`;

const discTex = () => ctex("sunDisc", 128, 128, (g) => {
  const gr = g.createRadialGradient(64, 64, 58, 64, 64, 64); gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
});
const haloTex = () => ctex("sunHalo", 256, 256, (g) => {
  const im = g.createImageData(256, 256);
  for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) {
    const u = Math.hypot(x - 127.5, y - 127.5) / 128;
    const a = (0.55 * Math.exp(-((u / 0.25) ** 2)) + 0.35 * Math.exp(-((u / 0.6) ** 2))) * (1 - Math.min(1, Math.max(0, (u - 0.8) / 0.2)));
    const i = (y * 256 + x) * 4; im.data[i] = im.data[i + 1] = im.data[i + 2] = 255; im.data[i + 3] = Math.round(255 * Math.min(1, a));
  }
  g.putImageData(im, 0, 0);
});

/** horizontal quad facing up at height D0 + dy covering x0..x1, z0..z1 (z0 < z1) */
function quadUp(x0: number, x1: number, z0: number, z1: number, u: number, v: number, dy = 0) {
  const y = D0 + dy, g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute([x0, y, z1, x1, y, z1, x1, y, z0, x0, y, z1, x1, y, z0, x0, y, z0], 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0], 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute([0, 0, u, 0, u, v, 0, 0, u, v, 0, v], 2));
  return g;
}
