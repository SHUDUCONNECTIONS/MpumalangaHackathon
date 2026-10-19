// Low-poly African fish eagle, built from a handful of flat-shaded shapes.
// buildEagle returns the bird (facing +z) and pose(time, flap) to beat its wings.
export function buildEagle(THREE) {
  const mat = (color) => new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.8, side: THREE.DoubleSide });
  const brown = mat(0x5a3a26), dark = mat(0x241812), white = mat(0xece6d8), yellow = mat(0xd9a43a);
  const mesh = (geo, m, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = true; return o; };
  // Flat 2D outline (x = span, y = chord) laid into the wing plane, leading edge towards +z.
  const flat = (pts) => { const g = new THREE.ShapeGeometry(new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)))); g.rotateX(Math.PI / 2); return g; };

  // rig carries roll so lookAt on the outer group stays clean.
  const bird = new THREE.Group();
  const rig = new THREE.Group();
  bird.add(rig);
  const body = new THREE.SphereGeometry(1, 7, 5); body.scale(0.52, 0.46, 1.45);
  rig.add(mesh(body, brown));
  const chest = new THREE.SphereGeometry(1, 6, 5); chest.scale(0.48, 0.46, 0.62);
  rig.add(mesh(chest, white, 0, 0.08, 0.95));
  rig.add(mesh(new THREE.IcosahedronGeometry(0.42, 0), white, 0, 0.26, 1.45));
  const beak = new THREE.ConeGeometry(0.13, 0.46, 5); beak.rotateX(Math.PI / 2);
  rig.add(mesh(beak, yellow, 0, 0.18, 1.95));
  for (const s of [1, -1]) rig.add(mesh(new THREE.IcosahedronGeometry(0.06, 0), dark, 0.25 * s, 0.36, 1.68));
  rig.add(mesh(flat([[-0.2, 0], [0.2, 0], [0.42, -1.05], [0, -1.15], [-0.42, -1.05]]), white, 0, 0.04, -1.2));
  const feet = new THREE.ConeGeometry(0.08, 0.35, 4); feet.rotateX(-Math.PI / 2);
  for (const s of [1, -1]) rig.add(mesh(feet, yellow, 0.14 * s, -0.36, -0.75));

  // Each wing: inner part flaps at the shoulder, the outer "hand" with finger feathers follows with a lag.
  const innerShape = [[0, 0.5], [1.7, 0.42], [1.65, -0.5], [0, -0.62]];
  const outerShape = [[0, 0.42], [1.25, 0.22], [2.15, -0.12], [1.85, -0.3], [1.95, -0.48], [1.55, -0.46], [1.5, -0.64], [1.1, -0.56], [0, -0.5]];
  const wings = [1, -1].map((side) => {
    const shoulder = new THREE.Group(); shoulder.position.set(0.35 * side, 0.18, 0.15); shoulder.scale.x = side;
    shoulder.add(mesh(flat(innerShape), brown));
    const hand = new THREE.Group(); hand.position.x = 1.65;
    hand.add(mesh(flat(outerShape), dark));
    shoulder.add(hand); rig.add(shoulder);
    return { shoulder, hand, side };
  });

  const pose = (time, flap) => {
    rig.rotation.z = -0.42; // bank into the turn
    const beat = Math.sin(time * 7.5);
    for (const w of wings) {
      w.shoulder.rotation.z = (0.12 + beat * 0.55 * flap) * w.side;
      w.hand.rotation.z = 0.05 + Math.sin(time * 7.5 - 0.9) * 0.45 * flap;
    }
  };
  return { bird, pose };
}
