import * as THREE from 'three';

// Keep the sculpture's armor plates rigid; a closed inner chassis connects
// them at the actual joint centers when the original resting pose opens up.
export function articulateArmor(source) {
  source.updateMatrixWorld(true);
  const group = new THREE.Group();
  const bones = [];
  function bone(name, parent, position) {
    const joint = new THREE.Bone();
    joint.name = name;
    joint.position.fromArray(position);
    (parent || group).add(joint);
    joint.userData.index = bones.length;
    bones.push(joint);
    return joint;
  }
  const root = bone('root', null, [0, 0, 0]);
  const torso = bone('torso', root, [0, 1.65, 0]);
  const chest = bone('chest', torso, [0, .85, 0]);
  const head = bone('head', chest, [0, .72, 0]);
  const arms = {};
  for (const [name, sign] of [['left', -1], ['right', 1]]) {
    const shoulder = bone(`${name}-shoulder`, chest, [sign * .49, .41, -.10]);
    const elbow = bone(`${name}-elbow`, shoulder, [sign * .07, -.46, -.02]);
    const wrist = bone(`${name}-wrist`, elbow, [sign * .15, -.47, .16]);
    const palm = new THREE.Object3D();
    palm.position.set(-sign * .01, -.14, .04);
    wrist.add(palm);
    arms[name] = { shoulder, elbow, wrist, palm, sign };
  }
  const legs = {};
  for (const [name, sign] of [['left', -1], ['right', 1]]) {
    const hip = bone(`${name}-hip`, root, [sign * .24, 1.65, -.025]);
    const knee = bone(`${name}-knee`, hip, [sign * .055, -.79, .01]);
    const ankle = bone(`${name}-ankle`, knee, [sign * .025, -.64, .035]);
    legs[name] = { hip, knee, ankle, sign };
  }
  const panelBones = {};
  const panelDefinitions = [
    ['helmet', head, [0, .32, .08]], ['reactor', chest, [0, .03, .46]],
    ['left-pauldron', arms.left.shoulder, [-.35, .12, .06]], ['right-pauldron', arms.right.shoulder, [.35, .12, .06]],
    ['left-gauntlet', arms.left.elbow, [-.25, -.02, .28]], ['right-gauntlet', arms.right.elbow, [.25, -.02, .28]],
    ['left-thigh', legs.left.hip, [-.18, .01, .24]], ['right-thigh', legs.right.hip, [.18, .01, .24]],
  ];
  for (const [name, parent, offset] of panelDefinitions) {
    const joint = bone(`panel-${name}`, parent, [0, 0, 0]);
    panelBones[name] = { joint, offset: new THREE.Vector3(...offset), vertices: 0 };
  }
  group.updateMatrixWorld(true);
  const skeleton = new THREE.Skeleton(bones);
  source.traverse(object => {
    if (!object.isMesh) return;
    const geometry = object.geometry.clone().applyMatrix4(object.matrixWorld);
    const positions = geometry.attributes.position;
    const indices = new Uint16Array(positions.count * 4);
    const weights = new Float32Array(positions.count * 4);
    // Each disconnected armor plate receives one rigid joint. Per-vertex
    // spatial weights would stretch metallic plates when arms are raised.
    const parent = new Int32Array(positions.count);
    for (let i = 0; i < parent.length; i++) parent[i] = i;
    const find = start => {
      let index = start;
      while (parent[index] !== index) { parent[index] = parent[parent[index]]; index = parent[index]; }
      return index;
    };
    const union = (a, b) => { parent[find(a)] = find(b); };
    const triangles = geometry.index;
    for (let i = 0; i < (triangles?.count || positions.count); i += 3) {
      const a = triangles ? triangles.getX(i) : i;
      const b = triangles ? triangles.getX(i + 1) : i + 1;
      const c = triangles ? triangles.getX(i + 2) : i + 2;
      union(a, b); union(a, c);
    }
    const plates = new Map();
    for (let i = 0; i < positions.count; i++) {
      const component = find(i);
      if (!plates.has(component)) plates.set(component, { vertices: [], min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] });
      const plate = plates.get(component); plate.vertices.push(i);
      for (let axis = 0; axis < 3; axis++) {
        const value = positions.getComponent(i, axis);
        plate.min[axis] = Math.min(plate.min[axis], value); plate.max[axis] = Math.max(plate.max[axis], value);
      }
    }
    for (const plate of plates.values()) {
      const x = (plate.min[0] + plate.max[0]) / 2;
      const y = (plate.min[1] + plate.max[1]) / 2;
      let joint = y > 3.2 ? head : y > 2.47 ? chest : y > 1.65 ? torso : root;
      const z = (plate.min[2] + plate.max[2]) / 2;
      // The narrow plates beside the shoulder blades belong to the chest.
      // Moving them with the arm tears the back open and leaves floating fins.
      const distance = Math.abs(x - .007);
      const innerEdge = Math.min(Math.abs(plate.min[0] - .007), Math.abs(plate.max[0] - .007));
      const isArm = distance > (y > 2.7 ? .44 : .43)
        || (y > 2.75 && z > -.16 && innerEdge > .378);
      if (isArm && y > 1.42 && y < 3.18) {
        const arm = x < 0 ? arms.left : arms.right;
        joint = y > 2.48 ? arm.shoulder : y > 1.98 ? arm.elbow : arm.wrist;
      }
      if (y < 1.57 && !isArm) {
        const leg = x < 0 ? legs.left : legs.right;
        joint = y > .88 ? leg.hip : y > .27 ? leg.knee : leg.ankle;
      }
      // Move actual disconnected armor plates, leaving the articulated chassis behind.
      let panel;
      if (joint === head) panel = 'helmet';
      else if (joint === chest && y > 2.57 && y < 3.05 && z > .055 && distance < .39) panel = 'reactor';
      else if (isArm && y > 2.76 && y < 3.18) panel = `${x < 0 ? 'left' : 'right'}-pauldron`;
      else if (isArm && y > 2.02 && y < 2.42 && z > -.06) panel = `${x < 0 ? 'left' : 'right'}-gauntlet`;
      else if (!isArm && y > 1.03 && y < 1.53 && z > .025) panel = `${x < 0 ? 'left' : 'right'}-thigh`;
      if (panel) { joint = panelBones[panel].joint; panelBones[panel].vertices += plate.vertices.length; }
      for (const vertex of plate.vertices) {
        indices[vertex * 4] = joint.userData.index; weights[vertex * 4] = 1;
      }
    }
    geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(indices, 4));
    geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(weights, 4));
    const mesh = new THREE.SkinnedMesh(geometry, object.material);
    mesh.name = object.name;
    mesh.frustumCulled = false;
    group.add(mesh);
    mesh.bind(skeleton, new THREE.Matrix4());
  });
  const chassis = new THREE.MeshStandardMaterial({ color: 0x242b30, metalness: .82, roughness: .43 });
  const bearing = new THREE.MeshStandardMaterial({ color: 0x51585b, metalness: .9, roughness: .32 });
  const shell = new THREE.SphereGeometry(1, 28, 20);
  function jointShell(name, parent, position, scale) {
    const mesh = new THREE.Mesh(shell, chassis);
    mesh.name = name;
    mesh.position.fromArray(position); mesh.scale.fromArray(scale);
    parent.add(mesh);
    return mesh;
  }
  function sleeve(name, parent, end, radiusTop, radiusBottom) {
    const length = end.length();
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radiusTop, radiusBottom, length, 24), chassis);
    mesh.name = name;
    mesh.position.copy(end).multiplyScalar(.5);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), end.clone().normalize());
    parent.add(mesh);
  }
  jointShell('chest-lining', chest, [0, .25, -.015], [.35, .32, .265]);
  for (const [name, arm] of Object.entries(arms)) {
    jointShell(`${name}-socket`, chest, [arm.sign * .39, .41, -.10], [.145, .145, .165]);
    jointShell(`${name}-shoulder-bearing`, arm.shoulder, [0, 0, 0], [.167, .163, .174]);
    sleeve(`${name}-upper-arm-lining`, arm.shoulder, arm.elbow.position, .099, .11);
    jointShell(`${name}-elbow-bearing`, arm.elbow, [0, 0, 0], [.108, .108, .108]);
    sleeve(`${name}-forearm-lining`, arm.elbow, arm.wrist.position, .073, .095);
    jointShell(`${name}-wrist-bearing`, arm.wrist, [0, 0, 0], [.074, .074, .074]);
    // Inset circular bearings read as mechanical joints in the exposed seams.
    for (const [joint, radius, depth] of [[arm.shoulder, .13, .10], [arm.elbow, .077, .07]]) {
      const geometry = new THREE.TorusGeometry(radius, .005, 6, 32);
      for (const side of [-1, 1]) {
        const ring = new THREE.Mesh(geometry, bearing);
        ring.position.z = depth * side; joint.add(ring);
      }
    }
  }
  // Closed bearings preserve depth inside the slightly flexed unloaded leg.
  for (const [name, leg] of Object.entries(legs)) {
    jointShell(`${name}-hip-lining`, leg.hip, [0, 0, -.08], [.105, .12, .11]);

    jointShell(`${name}-knee-lining`, leg.knee, [0, 0, -.09], [.065, .07, .08]);

    jointShell(`${name}-ankle-lining`, leg.ankle, [0, 0, -.10], [.055, .06, .06]);
  }
  return { group, arms, legs, torso, chest, head, panelBones,
    explode(amount) { for (const { joint, offset } of Object.values(panelBones)) joint.position.copy(offset).multiplyScalar(amount); }
  };
}
