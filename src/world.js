// A low-poly 3D Mpumalanga for the website, in the same flat-shaded style as the fish eagle:
// a savanna plain below the escarpment, a waterfall feeding a river, the Panorama Route with a
// game drive vehicle, acacias, jacarandas, proteas and aloes, and the Big Five (plus giraffe,
// zebra and impala) walking through it. `night` renders the same place by moonlight.
// three.js is only downloaded when this runs. Returns a cleanup function.
import { buildEagle } from './eagle.js';

const WATER = -0.2;
const smooth = (a, b, v) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
// The river comes over the escarpment at z = -68 and meanders out to the front right.
const riverX = (z) => { const q = Math.max(z, -68); return 9 + 5 * Math.sin(q * 0.07 + 0.4) - 0.03 * q; };
function height(x, z) {
  let y = 1.2 + 0.55 * Math.sin(x * 0.13 + 1.3) * Math.cos(z * 0.11) + 0.35 * Math.sin(x * 0.31 + z * 0.23) + 0.18 * Math.sin(x * 0.9 - z * 0.6);
  const d = Math.abs(x - riverX(z));
  const cliff = smooth(-69, -76, z);
  y += cliff * (12 + 2.5 * Math.sin(x * 0.19) + 1.6 * Math.sin(x * 0.47 + 1)) * (1 - 0.3 * Math.max(0, 1 - d / 3));
  y += smooth(-85, -140, z) * (3 * Math.sin(x * 0.045 + 0.5) + 2.5 * Math.sin(x * 0.09 + z * 0.05) + 3);
  y -= (2.3 * Math.max(0, 1 - (d / 3.4) ** 2) + 1.4 * smooth(-60, -68, z) * Math.max(0, 1 - (d / 6.5) ** 2)) * (1 - cliff);
  return y;
}
function rng(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const hash = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };

const DUSK = {
  skyTop: 0x2b3352, skyMid: 0x9c7a86, horizon: 0xe6b38f, fog: 0xd9ab8e, sun: 0xffe2b8, sunDir: [0.42, 0.25, -1],
  hemiSky: 0xf4d6bb, hemiGround: 0x3b3326, hemi: 2.3, key: 0xffc690, keyI: 3.3, keyDir: [0.5, 0.42, -1], fill: 0x9db0d4, fillI: 0.45,
  water: 0x6f8f98, fall: 0xf3ece4, far: [0xa98a8f, 0xc69f93], camera: [0, 6.2, 22], target: [2, 6.6, -30],
};
const NIGHT = {
  skyTop: 0x04060c, skyMid: 0x0c1322, horizon: 0x1f2a40, fog: 0x1a2336, sun: 0xf3ecd9, sunDir: [-0.38, 0.3, -1],
  hemiSky: 0x6d82b0, hemiGround: 0x07080b, hemi: 0.75, key: 0xb3c6ee, keyI: 1.1, keyDir: [-0.45, 0.6, -1], fill: 0x2c3a5c, fillI: 0.25,
  water: 0x2a3b52, fall: 0xb9c6d8, far: [0x161e2e, 0x1d2639], camera: [-3, 5.5, 19], target: [7, 7, -40],
};
const GRASS = [0xa8955a, 0x96894f, 0xb39f62, 0x8a8650, 0x9f9858];
const ROCK = [0x9c6b4d, 0xab7a5b, 0x8b5f46, 0xa27354];
const HIGH = [0x4b5734, 0x56603a, 0x46502f];

export async function startWorld(canvas, { night = false, reduced = false } = {}) {
  const [THREE, { mergeGeometries }] = await Promise.all([import('three'), import('three/examples/jsm/utils/BufferGeometryUtils.js')]);
  const P = night ? NIGHT : DUSK;
  const small = canvas.clientWidth < 700;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, small ? 1.5 : 2));
  renderer.shadowMap.enabled = !small;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(P.fog, 45, 230);
  const camera = new THREE.PerspectiveCamera(40, 1, 0.5, 1500);
  const rand = rng(11);
  const pick = (list) => list[Math.floor(rand() * list.length)];
  const disposables = [];

  // ---------- helpers ----------
  const mats = new Map();
  const M = (hex, o = {}) => {
    const k = `${hex}${JSON.stringify(o)}`;
    if (!mats.has(k)) mats.set(k, new THREE.MeshStandardMaterial({ color: hex, flatShading: true, roughness: 0.92, ...o }));
    return mats.get(k);
  };
  const painted = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.92 });
  const add = (parent, geo, mat, p = [0, 0, 0], r = [0, 0, 0]) => {
    const m = new THREE.Mesh(geo, mat); m.position.set(...p); m.rotation.set(...r);
    m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
  };
  const ell = (sx, sy, sz, detail = 1) => new THREE.IcosahedronGeometry(1, detail).scale(sx, sy, sz);
  const ball = (sx, sy, sz, w = 14, h = 10) => new THREE.SphereGeometry(1, w, h).scale(sx, sy, sz);
  // Colours each triangle with fn(centroid x, y, z, face index): stripes, patches and spots.
  const paint = (geo, fn) => {
    const g = geo.index ? geo.toNonIndexed() : geo;
    const pos = g.attributes.position, col = new Float32Array(pos.count * 3), c = new THREE.Color();
    for (let i = 0; i < pos.count; i += 3) {
      c.set(fn((pos.getX(i) + pos.getX(i + 1) + pos.getX(i + 2)) / 3, (pos.getY(i) + pos.getY(i + 1) + pos.getY(i + 2)) / 3, (pos.getZ(i) + pos.getZ(i + 1) + pos.getZ(i + 2)) / 3, i / 3));
      for (let k = 0; k < 9; k += 3) { col[i * 3 + k] = c.r; col[i * 3 + k + 1] = c.g; col[i * 3 + k + 2] = c.b; }
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    return g;
  };
  const skin = (mat, fn) => (geo) => (fn ? [paint(geo, fn), painted] : [geo, mat]);
  // A leg hangs from its hip pivot; walking swings the pivot about z.
  const leg = (parent, look, x, y, z, len, r0, r1) => {
    const pivot = new THREE.Group(); pivot.position.set(x, y, z); parent.add(pivot);
    add(pivot, ...look(new THREE.CylinderGeometry(r0, r1, len, 6, 10).translate(0, -len / 2, 0)));
    return pivot;
  };
  const tailOf = (parent, mat, p, len, tuft) => {
    const pivot = new THREE.Group(); pivot.position.set(...p); parent.add(pivot);
    add(pivot, new THREE.CylinderGeometry(0.035, 0.025, len, 4).translate(0, -len / 2, 0), mat);
    if (tuft) add(pivot, ell(0.06, 0.12, 0.06, 0), tuft, [0, -len, 0]);
    pivot.rotation.z = -0.35;
    return pivot;
  };
  // Merges a static group into one mesh per material, so hundreds of shapes cost a few draw calls.
  const bake = (group) => {
    group.updateMatrixWorld(true);
    const byMat = new Map();
    group.traverse((o) => {
      if (!o.isMesh) return;
      const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
      for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
      g.applyMatrix4(o.matrixWorld);
      if (!byMat.has(o.material)) byMat.set(o.material, []);
      byMat.get(o.material).push(g);
    });
    const out = new THREE.Group();
    for (const [mat, list] of byMat) { const m = new THREE.Mesh(mergeGeometries(list), mat); m.castShadow = true; m.receiveShadow = true; out.add(m); }
    return out;
  };
  const glowTex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const g = c.getContext('2d'), r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.35, 'rgba(255,255,255,.35)'); r.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = r; g.fillRect(0, 0, 64, 64);
    const t = new THREE.CanvasTexture(c); disposables.push(t); return t;
  })();

  // ---------- sky ----------
  {
    const geo = new THREE.SphereGeometry(500, 32, 20), pos = geo.attributes.position, col = [];
    const top = new THREE.Color(P.skyTop), mid = new THREE.Color(P.skyMid), hor = new THREE.Color(P.horizon), c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const h = pos.getY(i) / 500;
      if (h < 0.02) c.copy(hor); else if (h < 0.2) c.lerpColors(hor, mid, (h - 0.02) / 0.18); else c.lerpColors(mid, top, Math.min(1, (h - 0.2) / 0.5));
      col.push(c.r, c.g, c.b);
    }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    scene.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false })));
    const dir = new THREE.Vector3(...P.sunDir).normalize();
    const disc = new THREE.Mesh(new THREE.CircleGeometry(night ? 9 : 13, 32), new THREE.MeshBasicMaterial({ color: P.sun, fog: false }));
    disc.position.copy(dir).multiplyScalar(450); disc.lookAt(0, 0, 0); scene.add(disc);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: P.sun, transparent: true, opacity: night ? 0.35 : 0.55, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    halo.position.copy(disc.position); halo.scale.setScalar(night ? 110 : 190); scene.add(halo);
    // Distant ranges fading into the haze.
    P.far.forEach((hex, i) => {
      const z = -240 - i * 60, pts = [new THREE.Vector2(-700, -20)];
      for (let x = -700; x <= 700; x += 35) pts.push(new THREE.Vector2(x, 48 + i * 14 + 22 * Math.sin(x * 0.011 + i * 2) + 12 * hash(x + i)));
      pts.push(new THREE.Vector2(700, -20));
      const m = new THREE.Mesh(new THREE.ShapeGeometry(new THREE.Shape(pts)), new THREE.MeshBasicMaterial({ color: hex, fog: false }));
      m.position.z = z; scene.add(m);
    });
    if (night) {
      const stars = [];
      for (let i = 0; i < 900; i++) {
        const u = rand() * Math.PI * 2, v = 0.06 + rand() * 0.94, r = Math.sqrt(1 - v * v);
        stars.push(Math.cos(u) * r * 480, v * 480, Math.sin(u) * r * 480);
      }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(stars, 3));
      scene.add(new THREE.Points(g, new THREE.PointsMaterial({ size: 1.7, sizeAttenuation: false, color: 0xf4f1e8, transparent: true, opacity: 0.85, fog: false, depthWrite: false })));
    }
  }
  // ---------- land and water ----------
  {
    const geo = new THREE.PlaneGeometry(280, 200, 140, 100).rotateX(-Math.PI / 2).translate(0, 0, -70).toNonIndexed();
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) pos.setY(i, height(pos.getX(i), pos.getZ(i)));
    const col = new Float32Array(pos.count * 3), c = new THREE.Color(), a = new THREE.Vector3(), b = new THREE.Vector3(), d = new THREE.Vector3();
    for (let i = 0; i < pos.count; i += 3) {
      a.fromBufferAttribute(pos, i); b.fromBufferAttribute(pos, i + 1); d.fromBufferAttribute(pos, i + 2);
      const cy = (a.y + b.y + d.y) / 3, cz = (a.z + b.z + d.z) / 3;
      const ny = Math.abs(b.clone().sub(a).cross(d.clone().sub(a)).normalize().y);
      c.set(cy < 0.15 ? 0x5a5a36 : ny < 0.8 ? pick(ROCK) : cz < -75 ? pick(HIGH) : pick(GRASS));
      c.offsetHSL(0, 0, (rand() - 0.5) * 0.035);
      for (let k = 0; k < 9; k += 3) { col[i * 3 + k] = c.r; col[i * 3 + k + 1] = c.g; col[i * 3 + k + 2] = c.b; }
    }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.computeVertexNormals();
    const land = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1 }));
    land.receiveShadow = true; scene.add(land);
  }
  const waterMat = M(P.water, { roughness: 0.2, metalness: 0.3, transparent: true, opacity: 0.93 });
  const waterGeo = new THREE.PlaneGeometry(150, 112, 75, 56).rotateX(-Math.PI / 2).translate(5, WATER, -14);
  const water = new THREE.Mesh(waterGeo, waterMat); water.receiveShadow = true; scene.add(water);
  const waterBase = Float32Array.from(waterGeo.attributes.position.array);

  // The waterfall pours down the notch in the escarpment, with a river on the plateau above it.
  const fallX = riverX(-68);
  const fallTex = (() => {
    const c = document.createElement('canvas'); c.width = 64; c.height = 256;
    const g = c.getContext('2d');
    for (let i = 0; i < 70; i++) { g.fillStyle = `rgba(255,255,255,${0.25 + Math.random() * 0.6})`; g.fillRect(Math.random() * 64, Math.random() * 256, 1 + Math.random() * 3, 20 + Math.random() * 90); }
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(2, 1.5); disposables.push(t); return t;
  })();
  {
    const pts = [], uvs = [], idx = [], n = 16;
    for (let i = 0; i <= n; i++) {
      const z = -68.4 - (i / n) * 8.4, y = Math.max(height(fallX, z), WATER) + 0.3;
      pts.push(fallX - 1.4, y, z + 0.5, fallX + 1.4, y, z + 0.5); uvs.push(0, i / n, 1, i / n);
      if (i) idx.push((i - 1) * 2, (i - 1) * 2 + 1, i * 2, (i - 1) * 2 + 1, i * 2 + 1, i * 2);
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2)); g.setIndex(idx);
    scene.add(new THREE.Mesh(g, new THREE.MeshBasicMaterial({ map: fallTex, color: P.fall, transparent: true, opacity: 0.92, side: THREE.DoubleSide, depthWrite: false })));
    const top = [], topIdx = [];
    for (let i = 0; i <= 30; i++) {
      const z = -76 - i * 1.5, y = height(fallX, z) + 0.12;
      top.push(fallX - 1.5, y, z, fallX + 1.5, y, z);
      if (i) topIdx.push((i - 1) * 2, (i - 1) * 2 + 1, i * 2, (i - 1) * 2 + 1, i * 2 + 1, i * 2);
    }
    const tg = new THREE.BufferGeometry(); tg.setAttribute('position', new THREE.Float32BufferAttribute(top, 3)); tg.setIndex(topIdx); tg.computeVertexNormals();
    scene.add(new THREE.Mesh(tg, M(P.water, { roughness: 0.2, metalness: 0.3, side: THREE.DoubleSide })));
  }
  const mist = (() => {
    const n = 46, p = new Float32Array(n * 3), seeds = [];
    for (let i = 0; i < n; i++) seeds.push([rand(), rand(), rand()]);
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    scene.add(new THREE.Points(g, new THREE.PointsMaterial({ map: glowTex, size: 2.6, color: P.fall, transparent: true, opacity: 0.32, depthWrite: false })));
    return (t) => {
      seeds.forEach(([a, b, c], i) => { const k = (t * 0.18 + a) % 1; p[i * 3] = fallX + (b - 0.5) * 6 * (0.4 + k); p[i * 3 + 1] = WATER + k * 4.5; p[i * 3 + 2] = -67.5 + (c - 0.5) * 3 + k * 2; });
      g.attributes.position.needsUpdate = true;
    };
  })();

  // ---------- the Panorama Route ----------
  const road = new THREE.CatmullRomCurve3([[-22, 32], [-12, 18], [-4, 8], [3, -2], [10, -12], [16, -20], [19, -30], [24, -42], [30, -54], [40, -64]].map(([x, z]) => new THREE.Vector3(x, 0, z)));
  const roadY = (x, z) => Math.max(height(x, z) + 0.14, WATER + 0.5);
  const roadPts = road.getSpacedPoints(420);
  const nearRoad = (x, z, r) => roadPts.some((p) => (p.x - x) ** 2 + (p.z - z) ** 2 < r * r);
  const scenery = new THREE.Group();
  {
    const ribbon = (width, lift, mat, keep = () => true) => {
      const pos = [], idx = [];
      roadPts.forEach((p, i) => {
        const t = road.getTangentAt(i / (roadPts.length - 1)), sx = -t.z, sz = t.x, l = Math.hypot(sx, sz) || 1;
        for (const s of [1, -1]) { const x = p.x + (sx / l) * s * width / 2, z = p.z + (sz / l) * s * width / 2; pos.push(x, roadY(x, z) + lift, z); }
        if (i && keep(i)) idx.push((i - 1) * 2, i * 2, (i - 1) * 2 + 1, (i - 1) * 2 + 1, i * 2, i * 2 + 1);
      });
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
      const m = new THREE.Mesh(g, mat); m.receiveShadow = true; scene.add(m);
    };
    ribbon(3.2, -0.04, M(0x7c6a50, { side: THREE.DoubleSide }));
    ribbon(2.2, 0, M(0x47423d, { side: THREE.DoubleSide }));
    ribbon(0.12, 0.02, M(0xd6c8a4, { side: THREE.DoubleSide }), (i) => Math.floor(i / 4) % 2 === 0);
    // Where the road crosses the river it becomes a low bridge with posts and rails.
    const post = new THREE.BoxGeometry(0.14, 0.7, 0.14), slab = M(0x6b625a);
    let prev = null;
    roadPts.forEach((p, i) => {
      if (height(p.x, p.z) > WATER + 0.35 || i % 3) return;
      const t = road.getTangentAt(i / (roadPts.length - 1)), s = new THREE.Vector3(-t.z, 0, t.x).normalize();
      const y = roadY(p.x, p.z);
      for (const k of [1, -1]) add(scenery, post, slab, [p.x + s.x * 1.25 * k, y + 0.3, p.z + s.z * 1.25 * k]);
      add(scenery, new THREE.BoxGeometry(0.9, 0.4, 2.8), slab, [p.x, y - 0.25, p.z], [0, Math.atan2(-t.z, t.x), 0]);
      if (prev) for (const k of [1, -1]) {
        const a = new THREE.Vector3(prev.x + prev.s.x * 1.25 * k, prev.y + 0.62, prev.z + prev.s.z * 1.25 * k), b = new THREE.Vector3(p.x + s.x * 1.25 * k, y + 0.62, p.z + s.z * 1.25 * k);
        const rail = add(scenery, new THREE.BoxGeometry(0.08, 0.08, a.distanceTo(b)), slab, [(a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2]);
        rail.lookAt(b);
      }
      prev = { x: p.x, y, z: p.z, s };
    });
  }
  // Game drive vehicle: open sides, canvas roof, spare wheel on the back.
  const jeep = (() => {
    const root = new THREE.Group(), body = M(0x5d5b42), dark = M(0x23221f), canvasTop = M(0x9a8f74), seat = M(0x3f3326);
    add(root, new THREE.BoxGeometry(4.2, 0.75, 1.9), body, [0, 0.85, 0]);
    add(root, new THREE.BoxGeometry(1.1, 0.35, 1.9), body, [1.55, 1.35, 0]);
    add(root, new THREE.BoxGeometry(0.08, 0.6, 1.8), M(0x9fb4bd, { roughness: 0.3, metalness: 0.4 }), [1.05, 1.75, 0], [0, 0, -0.25]);
    for (const x of [-0.2, -1.2]) add(root, new THREE.BoxGeometry(0.5, 0.45, 1.7), seat, [x, 1.45, 0]);
    for (const [x, z] of [[0.9, 0.9], [0.9, -0.9], [-1.95, 0.9], [-1.95, -0.9]]) add(root, new THREE.BoxGeometry(0.07, 1.25, 0.07), dark, [x, 1.85, z]);
    add(root, new THREE.BoxGeometry(3.1, 0.07, 2), canvasTop, [-0.5, 2.48, 0]);
    const wheel = new THREE.CylinderGeometry(0.44, 0.44, 0.32, 10).rotateX(Math.PI / 2);
    for (const [x, z] of [[1.35, 0.95], [1.35, -0.95], [-1.35, 0.95], [-1.35, -0.95]]) add(root, wheel, dark, [x, 0.44, z]);
    add(root, wheel, dark, [-2.2, 1.0, 0], [0, Math.PI / 2, 0]);
    const lamp = M(0xfff1c8, { emissive: 0xfff1c8, emissiveIntensity: night ? 2.5 : 0.3 });
    for (const z of [0.65, -0.65]) add(root, new THREE.BoxGeometry(0.05, 0.16, 0.26), lamp, [2.12, 0.95, z]);
    root.scale.setScalar(0.9);
    scene.add(root);
    return root;
  })();

  // ---------- plants ----------
  const acacia = (s) => {
    const g = new THREE.Group(), bark = M(0x4a3a2c), leaf = M(pick([0x4b5a2e, 0x56622f, 0x5f6634, 0x47522b]));
    add(g, new THREE.CylinderGeometry(0.13, 0.22, 2.7, 5).translate(0, 1.35, 0), bark, [0, 0, 0], [0, 0, 0.08]);
    for (const k of [1, -1]) add(g, new THREE.CylinderGeometry(0.06, 0.1, 1.5, 4).translate(0, 0.75, 0), bark, [0.1, 2.2, 0], [0.3 * k, 0, -0.75 * k]);
    add(g, ell(2.5, 0.42, 2.1, 0), leaf, [0.1, 3.35, 0]);
    add(g, ell(1.5, 0.35, 1.4, 0), leaf, [1.0, 3.05, 0.5]);
    add(g, ell(1.3, 0.3, 1.2, 0), leaf, [-0.9, 3.1, -0.4]);
    g.scale.setScalar(s); g.rotation.y = rand() * Math.PI * 2;
    return g;
  };
  const jacaranda = (s) => {
    const g = new THREE.Group(), bark = M(0x4d3c33);
    add(g, new THREE.CylinderGeometry(0.16, 0.26, 2.4, 5).translate(0, 1.2, 0), bark);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      add(g, ell(1.1 + rand() * 0.5, 0.9 + rand() * 0.3, 1.1 + rand() * 0.5, 0), M(pick([0x8a76a3, 0x7c6a97, 0x9584ad, 0x6f5f8a])), [Math.cos(a) * 1.1, 3 + rand() * 0.8, Math.sin(a) * 1.1]);
    }
    add(g, ell(1.3, 1, 1.3, 0), M(0x8a76a3), [0, 3.9, 0]);
    g.scale.setScalar(s); g.rotation.y = rand() * Math.PI * 2;
    return g;
  };
  const roundTree = (s) => {
    const g = new THREE.Group();
    add(g, new THREE.CylinderGeometry(0.15, 0.24, 2, 5).translate(0, 1, 0), M(0x463629));
    add(g, ell(1.9, 1.6, 1.9, 0), M(pick([0x3e4a2b, 0x46532f, 0x51592f])), [0, 3, 0]);
    g.scale.setScalar(s); g.rotation.y = rand() * Math.PI * 2;
    return g;
  };
  const LANES = [6, 4.5, 3.2, 2, 1, -6, -7, -10.2, -11, -11.8, -19, -19.6, -26.5, -27, -28, -35, -35.6];
  const clear = (x, z, lanes = true) => Math.abs(x - riverX(z)) > 3.8 && !nearRoad(x, z, 3) && (!lanes || LANES.every((l) => Math.abs(z - l) > 1.7));
  for (let n = 0; n < 900 && scenery.children.length < 260; n++) {
    const x = -75 + rand() * 150, z = 10 - rand() * 76;
    if (!clear(x, z) || (z > 0 && Math.abs(x) < 12) || height(x, z) > 3) continue;
    const nearWater = Math.abs(x - riverX(z)) < 9;
    const t = nearWater && rand() < 0.6 ? jacaranda(0.8 + rand() * 0.4) : rand() < 0.65 ? acacia(0.8 + rand() * 0.5) : roundTree(0.7 + rand() * 0.5);
    t.position.set(x, height(x, z) - 0.1, z); scenery.add(t);
  }
  for (let n = 0; n < 160; n++) { // the green crown of the escarpment
    const x = -90 + rand() * 180, z = -78 - rand() * 50;
    const t = roundTree(1 + rand() * 0.8); t.position.set(x, height(x, z) - 0.2, z); scenery.add(t);
  }
  scene.add(bake(scenery));
  // Bushes and grass tufts as instanced meshes.
  const scatter = (geo, colours, count, place) => {
    const mesh = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ flatShading: true, roughness: 1 }), count);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), c = new THREE.Color();
    let i = 0;
    for (let n = 0; n < count * 6 && i < count; n++) {
      const r = place(); if (!r) continue;
      const [x, z, s] = r;
      q.setFromEuler(e.set((rand() - 0.5) * 0.3, rand() * 6, (rand() - 0.5) * 0.3));
      m.compose(new THREE.Vector3(x, height(x, z), z), q, new THREE.Vector3(s, s * (0.6 + rand() * 0.6), s));
      mesh.setMatrixAt(i, m); mesh.setColorAt(i, c.set(pick(colours)).offsetHSL(0, 0, (rand() - 0.5) * 0.05)); i++;
    }
    mesh.count = i; mesh.castShadow = true; mesh.receiveShadow = true; scene.add(mesh);
  };
  scatter(ell(1, 0.7, 1, 0), [0x4f5a31, 0x5d6436, 0x6a6a3a, 0x47502c], 420, () => {
    const x = -70 + rand() * 140, z = 12 - rand() * 80;
    return clear(x, z, false) && height(x, z) > WATER + 0.3 && height(x, z) < 3 ? [x, z, 0.35 + rand() * 0.6] : null;
  });
  scatter(new THREE.ConeGeometry(0.035, 0.42, 3).translate(0, 0.21, 0), [0xc4ab6c, 0xb39d5f, 0xd2b878, 0xa49a5c], 2200, () => {
    const x = -26 + rand() * 52, z = 14 - rand() * 30;
    return height(x, z) > WATER + 0.2 && !nearRoad(x, z, 1.6) ? [x, z, 0.6 + rand() * 0.7] : null;
  });

  // King proteas and aloes in the foreground, swaying a little.
  const swayers = [];
  const protea = () => {
    const g = new THREE.Group(), stem = M(0x4f5c3a), leaf = M(0x5d6a45);
    add(g, new THREE.CylinderGeometry(0.025, 0.04, 1.1, 4).translate(0, 0.55, 0), stem);
    for (let i = 0; i < 5; i++) add(g, ell(0.07, 0.24, 0.035, 0), leaf, [0, 0.25 + i * 0.15, 0], [0.9, i * 2.2, 0.4]);
    const head = new THREE.Group(); head.position.y = 1.12; g.add(head);
    const ring = (n, len, tilt, hexes, y) => {
      for (let i = 0; i < n; i++) {
        const p = new THREE.Group(); p.rotation.set(0, (i / n) * Math.PI * 2, 0); head.add(p);
        add(p, new THREE.ConeGeometry(0.075, len, 4).translate(0, len / 2, 0), M(hexes[i % hexes.length]), [0.05, y, 0], [0, 0, -tilt]);
      }
    };
    ring(13, 0.48, 0.95, [0xb46a6e, 0xa65f64], 0);
    ring(10, 0.42, 0.55, [0xcf9790, 0xc38780], 0.04);
    add(head, ell(0.17, 0.13, 0.17, 1), M(0xe8d9c6), [0, 0.12, 0]);
    return g;
  };
  const aloe = () => {
    const g = new THREE.Group();
    for (let i = 0; i < 12; i++) {
      const p = new THREE.Group(); p.rotation.y = (i / 12) * Math.PI * 2 + rand() * 0.3; g.add(p);
      add(p, new THREE.ConeGeometry(0.09, 1 + rand() * 0.3, 3).translate(0, 0.5, 0), M(pick([0x667f6d, 0x58705f])), [0.06, 0, 0], [0, 0, -(0.45 + rand() * 0.6)]);
    }
    for (const k of [-1, 1]) {
      const s = new THREE.Group(); s.rotation.z = k * 0.12; g.add(s);
      add(s, new THREE.CylinderGeometry(0.02, 0.03, 1.4, 4).translate(0, 0.7, 0), M(0x6f6a45));
      add(s, new THREE.ConeGeometry(0.12, 0.55, 6).translate(0, 1.65, 0), M(0xc0603a));
      add(s, new THREE.ConeGeometry(0.07, 0.2, 6).translate(0, 2.0, 0), M(0xd9a35a));
    }
    return g;
  };
  for (const [kind, x, z, s] of [['p', 3.6, 10.2, 1.2], ['p', 4.7, 9.4, 0.95], ['a', 5.9, 10.6, 1.15], ['p', 2.5, 9.6, 0.8], ['a', -6.8, 9.8, 1.25], ['p', -5.4, 10.6, 1], ['p', -4.2, 9.5, 0.8], ['a', 8.6, 8.6, 1.35], ['p', 7.4, 9.8, 1]]) {
    const g = bake(kind === 'p' ? protea() : aloe());
    g.position.set(x, height(x, z) - 0.05, z); g.scale.setScalar(s); g.rotation.y = rand() * 6;
    scene.add(g); swayers.push({ g, k: rand() * 6 });
  }

  // ---------- animals (all face +x and walk along x) ----------
  const elephant = () => {
    const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
    const hide = M(0x77716a), shade = M(0x625c56), ivory = M(0xe4d8bf);
    add(body, ell(1.55, 1.15, 0.98), hide, [-0.1, 2.25, 0]);
    add(body, ell(0.95, 1.05, 0.92), hide, [0.75, 2.45, 0]);
    const head = new THREE.Group(); head.position.set(1.55, 2.6, 0); body.add(head);
    add(head, ell(0.7, 0.78, 0.66), hide);
    const ears = [1, -1].map((s) => { const p = new THREE.Group(); p.position.set(-0.15, 0.15, 0.5 * s); head.add(p); add(p, ell(0.1, 0.85, 0.62), shade, [-0.1, -0.25, 0.42 * s]); return [p, s]; });
    const trunk = []; let parent = head;
    for (let i = 0; i < 5; i++) {
      const g = new THREE.Group(); g.position.set(i ? 0 : 0.55, i ? -0.44 : -0.35, 0); parent.add(g);
      const r = 0.24 - i * 0.035; add(g, new THREE.CylinderGeometry(r, r - 0.03, 0.46, 6).translate(0, -0.23, 0), hide);
      trunk.push(g); parent = g;
    }
    for (const s of [1, -1]) add(head, new THREE.ConeGeometry(0.075, 0.8, 5).rotateZ(-Math.PI / 2), ivory, [0.55, -0.5, 0.3 * s], [0, 0, -0.55]);
    const legs = [[1, 1], [1, -1], [-1, 1], [-1, -1]].map(([f, s]) => leg(body, skin(hide), 0.95 * f, 1.7, 0.48 * s, 1.7, 0.33, 0.29));
    const tail = tailOf(body, shade, [-1.62, 2.4, 0], 0.95, shade);
    return { root, body, legs, stride: 3.4, amp: 0.3, bob: 0.06, anim: (t) => {
      trunk.forEach((g, i) => { g.rotation.z = 0.13 + Math.sin(t * 1.4 + i * 0.5) * 0.12; });
      ears.forEach(([p, s]) => { p.rotation.y = s * (0.15 + Math.sin(t * 2.1) * 0.16); });
      tail.rotation.x = Math.sin(t * 2.5) * 0.3;
    } };
  };
  const rhino = () => {
    const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
    const hide = M(0x7d766c), horn = M(0xb5a78f);
    add(body, ell(1.35, 0.78, 0.72), hide, [0, 1.25, 0]);
    add(body, ell(0.8, 0.82, 0.72), hide, [0.6, 1.35, 0]);
    const head = new THREE.Group(); head.position.set(1.35, 1.15, 0); head.rotation.z = -0.4; body.add(head);
    add(head, ell(0.62, 0.42, 0.38), hide, [0.3, 0, 0]);
    add(head, new THREE.ConeGeometry(0.14, 0.65, 5).translate(0, 0.32, 0), horn, [0.72, 0.25, 0], [0, 0, 0.35]);
    add(head, new THREE.ConeGeometry(0.1, 0.32, 5).translate(0, 0.16, 0), horn, [0.4, 0.33, 0], [0, 0, 0.3]);
    for (const s of [1, -1]) add(head, new THREE.ConeGeometry(0.07, 0.22, 4).translate(0, 0.11, 0), hide, [-0.1, 0.36, 0.18 * s], [0.3 * s, 0, 0]);
    const legs = [[1, 1], [1, -1], [-1, 1], [-1, -1]].map(([f, s]) => leg(body, skin(hide), 0.85 * f, 0.9, 0.42 * s, 0.92, 0.2, 0.17));
    const tail = tailOf(body, hide, [-1.35, 1.4, 0], 0.5, M(0x3a342e));
    return { root, body, legs, stride: 2.4, amp: 0.32, bob: 0.04, anim: (t) => { tail.rotation.x = Math.sin(t * 3) * 0.4; head.rotation.z = -0.4 + Math.sin(t * 0.9) * 0.05; } };
  };
  const buffalo = () => {
    const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
    const hide = M(0x2d2824), horn = M(0x6e6559);
    add(body, ell(1.15, 0.72, 0.6), hide, [0, 1.3, 0]);
    add(body, ell(0.72, 0.75, 0.62), hide, [0.6, 1.45, 0]);
    const head = new THREE.Group(); head.position.set(1.25, 1.25, 0); head.rotation.z = -0.55; body.add(head);
    add(head, ell(0.45, 0.36, 0.32), hide, [0.25, 0, 0]);
    add(head, ell(0.22, 0.1, 0.38, 1), horn, [0.05, 0.32, 0]);
    for (const s of [1, -1]) {
      add(head, new THREE.ConeGeometry(0.09, 0.55, 5).translate(0, 0.27, 0), horn, [0.05, 0.26, 0.3 * s], [1.75 * s, 0, 0]);
      add(head, new THREE.ConeGeometry(0.06, 0.38, 5).translate(0, 0.19, 0), horn, [0.05, 0.12, 0.8 * s], [0.25 * s, 0, 0.2]);
    }
    const legs = [[1, 1], [1, -1], [-1, 1], [-1, -1]].map(([f, s]) => leg(body, skin(hide), 0.75 * f, 0.95, 0.33 * s, 0.98, 0.14, 0.11));
    const tail = tailOf(body, hide, [-1.15, 1.5, 0], 0.7, hide);
    return { root, body, legs, stride: 2.2, amp: 0.34, bob: 0.04, anim: (t) => { tail.rotation.x = Math.sin(t * 3.2) * 0.4; } };
  };
  const lion = () => {
    const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
    const coat = M(0xb08350), mane = M(0x4e3420), light = M(0xd7b98c);
    add(body, ell(1.0, 0.42, 0.38), coat, [0, 1.0, 0]);
    add(body, ell(0.55, 0.5, 0.42), coat, [0.55, 1.05, 0]);
    const head = new THREE.Group(); head.position.set(1.0, 1.25, 0); body.add(head);
    add(head, ell(0.5, 0.58, 0.52), mane, [-0.08, 0, 0]);
    add(head, ell(0.32, 0.3, 0.28), coat, [0.24, -0.02, 0]);
    add(head, ell(0.16, 0.13, 0.15), light, [0.47, -0.13, 0]);
    const legs = [[1, 1], [1, -1], [-1, 1], [-1, -1]].map(([f, s]) => leg(body, skin(coat), f > 0 ? 0.6 : -0.7, 0.85, 0.2 * s, 0.86, 0.12, 0.09));
    const tail = tailOf(body, coat, [-1.0, 1.15, 0], 1.0, mane);
    tail.rotation.z = -0.7;
    return { root, body, legs, stride: 2.1, amp: 0.4, bob: 0.03, anim: (t) => { tail.rotation.x = Math.sin(t * 1.6) * 0.35; head.rotation.z = Math.sin(t * 0.7) * 0.06; } };
  };
  const leopard = () => {
    const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
    const coat = 0xc29852, spot = 0x2e2117;
    const spots = (x, y, z, i) => (hash(i * 3.7) < 0.3 ? spot : y < -0.18 ? 0xe2cfa6 : coat);
    add(body, paint(ball(0.88, 0.32, 0.28), spots), painted, [0, 0.8, 0]);
    const head = new THREE.Group(); head.position.set(0.95, 0.95, 0); body.add(head);
    add(head, paint(ball(0.24, 0.21, 0.21, 10, 8), spots), painted);
    add(head, ell(0.12, 0.09, 0.11), M(0xe2cfa6), [0.2, -0.07, 0]);
    for (const s of [1, -1]) add(head, new THREE.ConeGeometry(0.06, 0.12, 4).translate(0, 0.06, 0), M(coat), [-0.05, 0.17, 0.12 * s]);
    const legs = [[1, 1], [1, -1], [-1, 1], [-1, -1]].map(([f, s]) => leg(body, skin(null, (x, y, z, i) => (hash(i * 5.3) < 0.25 ? spot : coat)), 0.6 * f, 0.72, 0.15 * s, 0.74, 0.08, 0.06));
    const tail = tailOf(body, M(coat), [-0.86, 0.85, 0], 1.0, M(spot));
    tail.rotation.z = -1.0;
    return { root, body, legs, stride: 1.9, amp: 0.45, bob: 0.03, anim: (t) => { tail.rotation.z = -1.05 + Math.sin(t * 1.8) * 0.15; } };
  };
  const giraffe = () => {
    const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
    const cream = 0xddc59c, patch = 0x8c5228;
    const patches = (x, y, z) => (Math.abs(Math.sin(x * 7.3 + Math.sin(y * 5.1) * 2) * Math.sin(y * 7.9 + Math.sin(z * 4.3) * 2) * Math.sin(z * 6.1 + x * 2.3)) > 0.12 ? patch : cream);
    add(body, paint(ball(1.05, 0.68, 0.52, 28, 16), patches), painted, [0, 2.6, 0], [0, 0, 0.15]);
    const neck = new THREE.Group(); neck.position.set(0.75, 2.85, 0); neck.rotation.z = -0.48; body.add(neck);
    add(neck, paint(new THREE.CylinderGeometry(0.15, 0.3, 2.6, 10, 16).translate(0, 1.3, 0), patches), painted);
    add(neck, ell(0.05, 1.2, 0.05, 0), M(0x5e3a1c), [-0.17, 1.3, 0]);
    const head = new THREE.Group(); head.position.set(0, 2.6, 0); head.rotation.z = 0.25; neck.add(head);
    add(head, ell(0.4, 0.2, 0.18), M(0xc79a62), [0.2, 0, 0]);
    for (const s of [1, -1]) { add(head, new THREE.CylinderGeometry(0.035, 0.04, 0.28, 4).translate(0, 0.14, 0), M(0x8c5228), [-0.02, 0.15, 0.07 * s]); add(head, ell(0.05, 0.05, 0.05, 0), M(0x2e2117), [-0.02, 0.43, 0.07 * s]); }
    const legs = [[1, 1], [1, -1], [-1, 1], [-1, -1]].map(([f, s]) => leg(body, skin(M(cream)), f > 0 ? 0.65 : -0.7, f > 0 ? 2.15 : 2.05, 0.28 * s, f > 0 ? 2.15 : 2.05, 0.11, 0.07));
    const tail = tailOf(body, M(cream), [-1.0, 2.45, 0], 1.0, M(0x2e2117));
    return { root, body, legs, stride: 3.6, amp: 0.28, bob: 0.05, pace: true, anim: (t, ph) => { neck.rotation.z = -0.48 + Math.sin(ph) * 0.06; tail.rotation.x = Math.sin(t * 2) * 0.3; } };
  };
  const zebra = () => {
    const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
    const white = 0xe9e3d6, black = 0x1d1c1a;
    const stripes = (x, y) => (Math.sin(x * 11 + y * 3) > 0.1 ? black : white);
    add(body, paint(ball(0.95, 0.47, 0.4, 44, 18), stripes), painted, [0, 1.2, 0]);
    const neck = new THREE.Group(); neck.position.set(0.7, 1.35, 0); neck.rotation.z = -0.75; body.add(neck);
    add(neck, paint(new THREE.CylinderGeometry(0.13, 0.22, 0.9, 10, 12).translate(0, 0.45, 0), (x, y) => (Math.sin(y * 16) > 0 ? black : white)), painted);
    add(neck, ell(0.06, 0.45, 0.05, 0), M(black), [-0.15, 0.45, 0]);
    const head = new THREE.Group(); head.position.set(0, 0.88, 0); head.rotation.z = -0.4; neck.add(head);
    add(head, paint(ball(0.42, 0.16, 0.15, 20, 8), (x) => (x > 0.28 ? black : Math.sin(x * 20) > 0.2 ? black : white)), painted, [0.22, 0, 0]);
    for (const s of [1, -1]) add(head, new THREE.ConeGeometry(0.05, 0.18, 4).translate(0, 0.09, 0), M(white), [-0.05, 0.13, 0.08 * s]);
    const legs = [[1, 1], [1, -1], [-1, 1], [-1, -1]].map(([f, s]) => leg(body, skin(null, (x, y) => (Math.sin(y * 24) > 0.2 ? black : white)), 0.6 * f, 1.0, 0.22 * s, 1.02, 0.08, 0.06));
    const tail = tailOf(body, M(white), [-0.95, 1.3, 0], 0.7, M(black));
    return { root, body, legs, stride: 2.3, amp: 0.36, bob: 0.04, anim: (t) => { tail.rotation.x = Math.sin(t * 2.8) * 0.4; } };
  };
  const impala = () => {
    const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
    const tan = 0xa86c3e, belly = 0xe6d4b8;
    add(body, paint(ball(0.66, 0.3, 0.25, 12, 8), (x, y) => (y < -0.12 ? belly : tan)), painted, [0, 0.95, 0]);
    const neck = new THREE.Group(); neck.position.set(0.5, 1.05, 0); neck.rotation.z = -0.45; body.add(neck);
    add(neck, new THREE.CylinderGeometry(0.07, 0.12, 0.6, 5).translate(0, 0.3, 0), M(tan));
    const head = new THREE.Group(); head.position.set(0, 0.6, 0); head.rotation.z = 0.1; neck.add(head);
    add(head, ell(0.22, 0.1, 0.09), M(tan), [0.1, 0, 0]);
    for (const s of [1, -1]) add(head, new THREE.CylinderGeometry(0.015, 0.03, 0.5, 4).translate(0, 0.25, 0), M(0x2e2117), [-0.05, 0.08, 0.05 * s], [0.18 * s, 0, 0.45]);
    const legs = [[1, 1], [1, -1], [-1, 1], [-1, -1]].map(([f, s]) => leg(body, skin(M(tan)), 0.45 * f, 0.85, 0.12 * s, 0.86, 0.05, 0.035));
    return { root, body, legs, stride: 2.6, amp: 0.4, bob: 0.03 };
  };

  // Lanes run across the plain; each animal wraps around once it is well out of view.
  const walkers = [];
  const herd = (make, list) => list.forEach(([x, z, dir, speed, scale = 1, extra = {}]) => {
    const a = make(); a.root.scale.setScalar(scale); scene.add(a.root);
    walkers.push({ a, x, z, dir, speed, span: 9 + (22 - z) * 0.75, phase: rand() * 6, ...extra });
  });
  herd(elephant, [[9, 2, -1, 1.1], [11.6, 3.2, -1, 1.1, 0.5], [14.5, 1, -1, 1.1, 0.95]]);
  herd(lion, [[-6, 6, 1, 1.25]]);
  herd(leopard, [[11, 4.5, -1, 1.5]]);
  herd(rhino, [[-5, -6, 1, 0.85], [-8.5, -7, 1, 0.85, 0.9]]);
  herd(zebra, [[3, -11, -1, 1.35], [5.5, -10.2, -1, 1.35, 0.95], [8, -11.8, -1, 1.35]]);
  herd(giraffe, [[-3, -19, 1, 1.15], [2.5, -19.6, 1, 1.15, 0.9]]);
  herd(buffalo, [[10, -27, -1, 0.95], [13, -28, -1, 0.95, 0.95], [15.5, -26.5, -1, 0.95], [18, -27.6, -1, 0.95, 0.9]]);
  herd(impala, [[-9, -35, 1, 3.4, 1, { hop: true }], [-7, -34.4, 1, 3.4, 0.95, { hop: true }], [-5, -35.6, 1, 3.4, 1, { hop: true }], [-12, -35.2, 1, 3.4, 0.9, { hop: true }]]);

  const eagle = buildEagle(THREE);
  eagle.bird.scale.setScalar(0.55);
  scene.add(eagle.bird);

  // Fireflies by night.
  const fireflies = night ? (() => {
    const n = 70, p = new Float32Array(n * 3), seeds = [];
    for (let i = 0; i < n; i++) seeds.push([-25 + rand() * 50, 16 - rand() * 30, rand() * 6]);
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    scene.add(new THREE.Points(g, new THREE.PointsMaterial({ map: glowTex, size: 0.45, color: 0xffd98a, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })));
    return (t) => {
      seeds.forEach(([x, z, k], i) => { p[i * 3] = x + Math.sin(t * 0.3 + k) * 1.5; p[i * 3 + 1] = height(x, z) + 0.8 + Math.sin(t * 0.5 + k * 2) * 0.6; p[i * 3 + 2] = z + Math.cos(t * 0.25 + k) * 1.5; });
      g.attributes.position.needsUpdate = true;
    };
  })() : null;

  // ---------- light ----------
  scene.add(new THREE.HemisphereLight(P.hemiSky, P.hemiGround, P.hemi));
  const key = new THREE.DirectionalLight(P.key, P.keyI);
  const keyDir = new THREE.Vector3(...P.keyDir).normalize();
  key.target.position.set(2, 0, -8);
  key.position.copy(key.target.position).addScaledVector(keyDir, 150);
  key.castShadow = true;
  Object.assign(key.shadow.camera, { left: -55, right: 55, top: 45, bottom: -45, near: 60, far: 260 });
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.bias = -0.0004; key.shadow.normalBias = 0.03;
  scene.add(key, key.target);
  const fill = new THREE.DirectionalLight(P.fill, P.fillI); fill.position.set(-20, 15, 40); scene.add(fill);

  // ---------- camera and loop ----------
  const base = new THREE.Vector3(...P.camera), target = new THREE.Vector3(...P.target);
  const resize = () => {
    const { clientWidth: w, clientHeight: h } = canvas;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.fov = w / h < 1 ? 58 : 40;
    camera.updateProjectionMatrix();
  };
  resize();
  let mouseX = 0, mouseY = 0;
  const onMouse = (e) => { mouseX = e.clientX / window.innerWidth - 0.5; mouseY = e.clientY / window.innerHeight - 0.5; };
  window.addEventListener('mousemove', onMouse, { passive: true });

  const wrap = (v, span) => ((((v + span) % (2 * span)) + 2 * span) % (2 * span)) - span;
  let flap = 0;
  const frame = (t, dt) => {
    for (const w of walkers) {
      const { a } = w;
      const x = wrap(w.x + w.dir * w.speed * t, w.span);
      const y = Math.max(height(x, w.z), WATER - 0.75);
      a.root.position.set(x, y, w.z);
      a.root.rotation.y = w.dir > 0 ? 0 : Math.PI;
      a.root.rotation.z = Math.atan((height(x + 0.8, w.z) - height(x - 0.8, w.z)) / 1.6 * w.dir) * 0.8;
      const ph = (w.speed * t) / a.stride * Math.PI * 2 + w.phase, s = Math.sin(ph);
      const [fl, fr, bl, br] = a.legs;
      if (a.pace) { fl.rotation.z = bl.rotation.z = s * a.amp; fr.rotation.z = br.rotation.z = -s * a.amp; }
      else { fl.rotation.z = br.rotation.z = s * a.amp; fr.rotation.z = bl.rotation.z = -s * a.amp; }
      a.body.position.y = Math.abs(Math.cos(ph)) * a.bob;
      if (w.hop) { // impala bound in long arcs with their legs tucked
        const j = Math.max(0, Math.sin(t * 3.1 + w.phase));
        a.body.position.y = j * j * 1.4;
        a.body.rotation.z = Math.cos(t * 3.1 + w.phase) * 0.25 * (j > 0 ? 1 : 0);
        if (j > 0.05) { fl.rotation.z = fr.rotation.z = 0.9 * j + 0.2; bl.rotation.z = br.rotation.z = -0.9 * j - 0.2; }
      }
      a.anim?.(t, ph);
    }
    // The vehicle drives the route towards the escarpment, then starts again behind the camera.
    const u = (t * 3.2 / road.getLength() + 0.18) % 1, p = road.getPointAt(u), tan = road.getTangentAt(u);
    jeep.position.set(p.x, roadY(p.x, p.z) - 0.1, p.z);
    jeep.rotation.y = Math.atan2(-tan.z, tan.x);
    // Eagle: a slow, wobbly thermal circle.
    const e = t * 0.16, ep = (k) => new THREE.Vector3(-1 + 11 * Math.cos(k), 11 + 1.6 * Math.sin(k * 2), -14 + 8 * Math.sin(k));
    const now = ep(e), ahead = ep(e + 0.02);
    eagle.bird.position.copy(now); eagle.bird.lookAt(ahead);
    flap += ((ahead.y - now.y > 0.012 ? 1 : 0.08) - flap) * 0.04;
    eagle.pose(t, flap);
    // Water ripples, the falls, mist, sway and drifting clouds.
    const wp = waterGeo.attributes.position;
    for (let i = 0; i < wp.count; i++) wp.setY(i, WATER + 0.05 * Math.sin(waterBase[i * 3] * 0.8 + t * 1.3) + 0.05 * Math.cos(waterBase[i * 3 + 2] * 0.9 + t * 1.1));
    wp.needsUpdate = true;
    fallTex.offset.y += dt * 0.9;
    mist(t);
    fireflies?.(t);
    for (const s of swayers) s.g.rotation.z = Math.sin(t * 1.1 + s.k) * 0.035;
    camera.position.set(base.x + Math.sin(t * 0.05) * 1.2 + mouseX * 2.2, base.y - mouseY * 0.9, base.z);
    if (camera.aspect < 1) camera.position.z = base.z + 6;
    camera.lookAt(target);
    renderer.render(scene, camera);
  };

  const ro = new ResizeObserver(() => { resize(); if (reduced) frame(8, 0); });
  ro.observe(canvas);
  const cleanup = (extra = () => {}) => () => {
    extra(); ro.disconnect(); window.removeEventListener('mousemove', onMouse);
    scene.traverse((o) => { o.geometry?.dispose(); });
    mats.forEach((m) => m.dispose()); painted.dispose(); disposables.forEach((d) => d.dispose());
    renderer.dispose();
  };
  if (reduced) { frame(8, 0); return cleanup(); }

  // Only animate while on screen and the tab is visible.
  let raf = 0, visible = true, last = performance.now(), t = 0;
  const loop = () => {
    if (!visible || document.hidden) { raf = 0; return; }
    const now = performance.now(), dt = Math.min(0.05, (now - last) / 1000); last = now; t += dt;
    frame(t, dt);
    raf = requestAnimationFrame(loop);
  };
  const resume = () => { if (!raf && visible && !document.hidden) { last = performance.now(); loop(); } };
  const io = new IntersectionObserver(([en]) => { visible = en.isIntersecting; resume(); });
  io.observe(canvas);
  document.addEventListener('visibilitychange', resume);
  loop();
  return cleanup(() => { cancelAnimationFrame(raf); io.disconnect(); document.removeEventListener('visibilitychange', resume); });
}
