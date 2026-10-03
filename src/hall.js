import * as THREE from 'three';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import gsap from 'gsap';

// Hall of Armor: service bays with suspended suits on the right and a framed
// crane / wall composition on the left. Suits reuse the hero's geometry and
// textures; only material colours and light separate them from the hero.
const palettes = [
  { // brushed silver over graphite
    gold: [.115, .125, .145], red: [.011, .013, .017], dark: [.007, .008, .010],
    rough: .46, clearcoat: .55, emissive: .6, light: 0xaec6d6, light$: 7, yaw: .10,
    arms: [.30, .24], head: -.10,
  },
  { // midnight blue with cyan seams
    gold: [.004, .040, .062], red: [.004, .012, .042], dark: [.010, .014, .020],
    rough: .5, clearcoat: .45, emissive: .75, light: 0x7fdcf0, light$: 5, yaw: -.02,
    arms: [.24, .31], head: .08,
  },
  { // deep burgundy with dark bronze
    gold: [.075, .052, .038], red: [.058, .004, .010], dark: [.020, .014, .014],
    rough: .5, clearcoat: .5, emissive: .5, light: 0xffc79a, light$: 5, yaw: -.12,
    arms: [.27, .27], head: -.04,
  },
];

export function createHall({ stage, helpers, mats, lowPower, small }) {
  const { mesh, box, cylinder, rod, ring, cable } = helpers;
  const { steel, dark, edge, brass, rubber } = mats;
  const hall = new THREE.Group(); stage.add(hall);
  const rightSide = new THREE.Group(), leftSide = new THREE.Group(); hall.add(rightSide, leftSide);
  const metal = new THREE.MeshStandardMaterial({ color: 0x1b2123, metalness: .62, roughness: .62, envMapIntensity: .35 });
  const inset = new THREE.MeshStandardMaterial({ color: 0x080c0f, metalness: .25, roughness: .85, envMapIntensity: .10 });
  const trim = new THREE.MeshStandardMaterial({ color: 0x3a4245, metalness: .7, roughness: .5, envMapIntensity: .35 });
  const chainMaterial = new THREE.MeshStandardMaterial({ color: 0x3b4346, metalness: .95, roughness: .36, envMapIntensity: .9 });
  const amberStrip = new THREE.MeshStandardMaterial({ color: 0x8a5a2a, emissive: 0xffa24a, emissiveIntensity: 1.5, roughness: .5 });
  const cyanStrip = new THREE.MeshStandardMaterial({ color: 0x2f6f78, emissive: 0x6fdbe8, emissiveIntensity: .5, roughness: .5 });
  const wallA = new THREE.MeshStandardMaterial({ color: 0x0e1316, metalness: .45, roughness: .8, envMapIntensity: .12 });
  const wallB = new THREE.MeshStandardMaterial({ color: 0x0a0e11, metalness: .45, roughness: .85, envMapIntensity: .10 });
  const seam = new THREE.MeshStandardMaterial({ color: 0x030507, metalness: .2, roughness: .9 });
  const animated = [];
  const V3 = THREE.Vector3;

  // Real interlocking chain: alternating links share one instanced mesh. The
  // returned setter re-stretches the same links between two moving anchors.
  const linkGeometry = new THREE.TorusGeometry(.034, .0095, 6, 14);
  const yAxis = new V3(0, 1, 0), roll = new THREE.Quaternion(), aim = new THREE.Quaternion(), spin = new THREE.Quaternion(), matrix = new THREE.Matrix4();
  function dynamicChain(from, to, { size = 1, parent = hall } = {}) {
    const a = new V3(...from), b = new V3(...to);
    const count = Math.max(2, Math.floor(a.distanceTo(b) / (.10 * size)));
    const links = new THREE.InstancedMesh(linkGeometry, chainMaterial, count);
    links.castShadow = !lowPower; links.receiveShadow = true; links.frustumCulled = false; parent.add(links);
    const direction = new V3(), position = new V3(), scale = new V3(size, size * 1.75, size);
    const set = (start, end) => {
      direction.subVectors(end, start); const length = direction.length(); direction.normalize();
      aim.setFromUnitVectors(yAxis, direction);
      for (let i = 0; i < count; i++) {
        roll.setFromAxisAngle(yAxis, i % 2 * Math.PI / 2); spin.copy(aim).multiply(roll);
        position.copy(start).addScaledVector(direction, length / count * (i + .5));
        matrix.compose(position, spin, scale); links.setMatrixAt(i, matrix);
      }
      links.instanceMatrix.needsUpdate = true;
    };
    set(a, b); return { links, set };
  }
  const chain = (from, to, options) => dynamicChain(from, to, options).links;
  function hoist(parent, x, y, z, width = .5) {
    box([width, .30, .30], [x, y, z], metal, parent);
    box([width + .06, .05, .34], [x, y + .17, z], trim, parent);
    cylinder(.095, .095, width + .04, [x, y - .02, z], steel, parent, 24).rotation.z = Math.PI / 2;
    box([.05, .024, .012], [x - width * .28, y + .02, z + .156], amberStrip, parent);
    box([.14, .09, .20], [x, y - .20, z], steel, parent);
  }

  // Chain-hoist suspension. Shoulder lugs on a collar behind the suit's upper
  // back are tied to a spreader bar above the helmet; one on-axis chain climbs
  // to the crane. The spreader twists and tilts slightly with the turn speed,
  // so the lug chains stay taut and swing only a little.
  function harness(parent, { hangY, cz = 0, topY = 0, withChain = true }) {
    const z = -.31, shoulderY = hangY + 3.16, spreaderY = hangY + 4.12;
    box([.84, .08, .13], [0, shoulderY + .07, z], metal, parent);
    box([.50, .05, .16], [0, shoulderY + .115, z], trim, parent);
    const lugs = [-1, 1].map(side => {
      box([.075, .15, .11], [side * .39, shoulderY + .16, z], steel, parent);
      cylinder(.026, .026, .13, [side * .39, shoulderY + .24, z], edge, parent, 14).rotation.x = Math.PI / 2;
      for (const dz of [-.045, .045]) cylinder(.014, .014, .02, [side * .39, shoulderY + .02, z + dz * 1.6], edge, parent, 8);
      return { side, from: new V3(side * .39, shoulderY + .25, z), end: new V3(), chain: dynamicChain([side * .39, shoulderY + .25, z], [side * .46, spreaderY, cz], { parent, size: 1.15 }) };
    });
    const spreader = new THREE.Group(); spreader.position.set(0, spreaderY, cz); parent.add(spreader);
    box([1.02, .09, .14], [0, 0, 0], metal, spreader);
    for (const side of [-1, 1]) cylinder(.045, .045, .16, [side * .46, 0, 0], steel, spreader, 16).rotation.x = Math.PI / 2;
    for (const side of [-1, 1]) chain([side * .40, .05, 0], [side * .05, .36, 0], { size: 1.1, parent: spreader });
    const master = mesh(new THREE.TorusGeometry(.05, .014, 8, 20), steel, spreader, [0, .42, 0]); master.scale.y = 1.9;
    if (withChain && topY - spreaderY > .75) chain([0, .54, 0], [0, topY - spreaderY, 0], { size: 1.5, parent: spreader });
    const place = (psi = 0, tilt = 0) => {
      spreader.rotation.set(0, psi, tilt); spreader.updateMatrix();
      for (const lug of lugs) lug.chain.set(lug.from, lug.end.set(lug.side * .46, 0, 0).applyMatrix4(spreader.matrix));
    };
    place();
    return { place, spreaderY };
  }

  // ---------- Right: service bays with the black suit and one empty hoist ----------
  const bays = [
    { x: 1.12, z: -3.0, palette: palettes[0], suit: true },
    { x: 2.32, z: -3.25, palette: palettes[1], suit: false },
  ];
  const W = 1.0, railY = 5.62, bayHang = .22;
  for (const spec of bays) {
    const bay = new THREE.Group(); bay.position.set(spec.x, 0, spec.z); bay.rotation.y = spec.palette.yaw * .6; rightSide.add(bay);
    spec.bay = bay;
    const wide = W + .30;
    box([wide, 5.5, .07], [0, 2.75, -.62], inset, bay);
    for (const y of [.9, 1.8, 2.7, 3.6, 4.5]) box([wide - .1, .012, .02], [0, y, -.585], metal, bay);
    for (const side of [-1, 1]) {
      box([.10, 5.6, .36], [side * (W / 2 + .10), 2.8, -.40], metal, bay);
      box([.024, 5.1, .03], [side * (W / 2 + .04), 2.7, -.21], trim, bay);
      box([.012, 3.4, .018], [side * (W / 2 + .025), 2.35, -.19], amberStrip, bay);
    }
    box([W + .42, .26, .50], [0, 5.40, -.38], metal, bay);
    box([W + .5, .10, .16], [0, railY, -.32], trim, bay);
    box([.012, 3.1, .01], [0, 2.7, -.576], cyanStrip, bay);
    box([W - .2, .008, .012], [0, 5.24, -.12], cyanStrip, bay);
    box([W + .14, .10, .86], [0, .05, -.12], dark, bay);
    box([W + .20, .02, .90], [0, .105, -.12], metal, bay);
    box([W - .2, .012, .012], [0, .062, .325], amberStrip, bay);
    for (const side of [-1, 1]) box([.012, .004, .6], [side * (W / 2 - .12), .118, -.1], cyanStrip, bay);
    const light = new THREE.SpotLight(spec.palette.light, spec.suit ? spec.palette.light$ : 2.2, 9, .36, .95, 2);
    light.position.set(.3, 5.1, 1.2); light.target.position.set(0, 2.5, -.15); bay.add(light, light.target);
    // Hoist, rail trolley and a suspension harness (empty in the second bay).
    box([.26, .06, .30], [0, railY - .20, -.31], trim, bay);
    box([.20, .16, .22], [0, railY - .09, -.29], steel, bay);
    hoist(bay, 0, 5.30, -.31, .62);
    const rig = harness(bay, { hangY: spec.suit ? bayHang : .5, cz: -.31, topY: 5.0, withChain: false });
    if (!spec.suit) {
      // The vacant harness hangs at working height beside its empty plinth.
      const lamp = new THREE.PointLight(0xffa24a, lowPower ? 0 : .35, 2.2, 2); lamp.position.set(0, 1.0, .35); bay.add(lamp);
    }
    if (5.12 - (rig.spreaderY + .54) > .2) chain([0, rig.spreaderY + .54, -.31], [0, 5.12, -.31], { size: 1.5, parent: bay });
  }
  // Heavy gantry beam above the bays; the arm's overhead track ties into it.
  const gantry = new THREE.Group(); gantry.position.set(2.32, 0, -3.3); rightSide.add(gantry);
  box([4.4, .22, .26], [-.35, 5.86, 0], metal, gantry);
  box([4.4, .05, .32], [-.35, 5.74, 0], trim, gantry);

  function variant(root, palette) {
    const copies = new Map();
    root.traverse(object => {
      if (!object.isMesh) return;
      const swap = material => {
        if (!copies.has(material)) {
          const copy = material.clone();
          const tint = { 'Mat.2': palette.gold, 'Mat.1': palette.red, material: palette.dark }[material.name];
          if (tint) {
            copy.color.setRGB(...tint);
            if ('roughness' in copy) copy.roughness = palette.rough;
            if ('clearcoat' in copy) copy.clearcoat = palette.clearcoat;
          } else if (material.emissiveMap) copy.emissiveIntensity = (material.emissiveIntensity || 1) * palette.emissive;
          copies.set(material, copy);
        }
        return copies.get(material);
      };
      object.material = Array.isArray(object.material) ? object.material.map(swap) : swap(object.material);
      object.castShadow = false; object.receiveShadow = true;
    });
  }
  function pose(root, palette, index) {
    const bone = name => root.getObjectByName(name);
    const [left, right] = palette.arms;
    bone('left-shoulder').rotation.set(.02, 0, left);
    bone('right-shoulder').rotation.set(-.02, 0, -right);
    bone('left-elbow').rotation.z = .06; bone('right-elbow').rotation.z = -.07;
    bone('left-wrist').rotation.set(.05, 0, .04); bone('right-wrist').rotation.set(.05, 0, -.04);
    bone('torso').rotation.set(0, .04 * (index - 1), 0);
    bone('head').rotation.set(.03, palette.head, 0);
    // Weight hangs: a straight, relaxed leg, with a small asymmetry in the knees.
    for (const side of ['left', 'right']) { bone(`${side}-hip`).rotation.x = .015; bone(`${side}-ankle`).rotation.x = .08; }
    bone('right-knee').rotation.x = .04;
  }
  function mountSuits(source) {
    const spec = bays.find(item => item.suit);
    const suit = cloneSkinned(source);
    variant(suit, spec.palette); pose(suit, spec.palette, 0);
    suit.position.set(0, bayHang, 0); spec.bay.add(suit);
    suit.traverse(object => { if (object.isMesh) object.frustumCulled = false; });
    spec.suit$ = suit;
  }
  // The hero hangs from the same kind of rig. Everything here lives in the
  // turntable frame, so suit, collar, chains and spreader turn as one body.
  let heroHarness;
  const heroRail = new THREE.Group(); heroRail.position.set(0, 0, 0); hall.add(heroRail);
  function mountHero(mount, lift) {
    const topWorld = 6.05;
    heroHarness = harness(mount, { hangY: lift, cz: 0, topY: topWorld - mount.position.y - .30 });
    box([6.4, .26, .34], [0, 6.52, 0], metal, heroRail);
    box([6.4, .05, .40], [0, 6.38, 0], trim, heroRail);
    box([.9, .22, .5], [0, 6.22, 0], trim, heroRail);
    hoist(heroRail, 0, 6.02, 0, .8);
  }

  // ---------- Left: crane beam, hook, service desk and a second arm ----------
  const crane = new THREE.Group(); leftSide.add(crane);
  const beamY = 5.25, beamZ = -2.35;
  box([13, .10, .34], [-8, beamY + .22, beamZ], metal, crane);
  box([13, .10, .34], [-8, beamY - .22, beamZ], metal, crane);
  box([13, .36, .07], [-8, beamY, beamZ], trim, crane);
  for (let x = -13; x < -1.4; x += 1.4) box([.05, .40, .36], [x, beamY, beamZ], seam, crane);
  box([.24, 1.0, .5], [-1.35, beamY - .1, beamZ], metal, crane);
  // Suspended service hook with a cable bundle and a clamp lamp.
  const hookSwing = new THREE.Group(); hookSwing.position.set(-7.0, beamY - .40, beamZ); crane.add(hookSwing);
  box([.62, .22, .46], [0, 0, 0], metal, hookSwing);
  for (const x of [-.22, .22]) cylinder(.075, .075, .38, [x, .13, 0], steel, hookSwing, 20).rotation.x = Math.PI / 2;
  box([.30, .08, .12], [0, -.15, .24], amberStrip, hookSwing);
  const dropTop = -.14, dropLength = 2.45;
  chain([0, dropTop, 0], [0, dropTop - dropLength, 0], { size: 1.35, parent: hookSwing });
  const block = new THREE.Group(); block.position.set(0, dropTop - dropLength - .03, 0); hookSwing.add(block);
  box([.22, .36, .20], [0, -.10, 0], steel, block);
  cylinder(.07, .07, .24, [0, -.10, 0], edge, block, 16).rotation.x = Math.PI / 2;
  cylinder(.03, .03, .20, [0, -.34, 0], brass, block, 12);
  const hook = new THREE.Mesh(new THREE.TorusGeometry(.13, .030, 8, 28, Math.PI * 1.45), steel);
  hook.position.set(0, -.50, 0); hook.rotation.z = Math.PI * .95; hook.castShadow = true; block.add(hook);
  mesh(new THREE.ConeGeometry(.032, .09, 10), edge, block, [.115, -.47, 0]).rotation.z = Math.PI * .15;
  const bundle = [[.0, -.58, 0], [.0, -1.05, .04], [.06, -1.55, .10], [.04, -1.88, .06]];
  for (const offset of [-.02, 0, .022]) cable(bundle.map(([x, y, z]) => [x + offset, y, z + offset * 2]), .018, block);
  const clamp = new THREE.Group(); clamp.position.set(.05, -1.98, .07); block.add(clamp);
  cylinder(.05, .05, .13, [0, 0, 0], steel, clamp, 14);
  cylinder(.07, .045, .10, [0, -.11, 0], metal, clamp, 16);
  mesh(new THREE.SphereGeometry(.028, 12, 8), cyanStrip, clamp, [0, -.17, 0]);
  // Counterweight on a short chain, further back and darker.
  const weightGroup = new THREE.Group(); weightGroup.position.set(-8.7, beamY - .40, beamZ - .5); crane.add(weightGroup);
  box([.5, .2, .4], [0, 0, 0], metal, weightGroup);
  chain([0, -.12, 0], [0, -1.95, 0], { size: 1.2, parent: weightGroup });
  cylinder(.19, .22, .56, [0, -2.30, 0], steel, weightGroup, 24);
  ring(.2, .02, [0, -2.03, 0], edge, weightGroup).rotation.x = Math.PI / 2;
  cylinder(.20, .20, .02, [0, -2.58, 0], brass, weightGroup, 24);
  for (const a of [0, 1, 2, 3, 4, 5]) cylinder(.012, .012, .5, [Math.sin(a) * .19, -2.3, Math.cos(a) * .19], edge, weightGroup, 6);
  animated.push({ group: hookSwing, phase: 0 }, { group: weightGroup, phase: 2.1 });

  // Service desk, built into a wall partition and an inset floor plate.
  const deskX = -5.25, deskZ = -2.75;
  const desk = new THREE.Group(); desk.position.set(deskX, 0, deskZ); leftSide.add(desk);
  box([5.0, 4.7, .18], [0, 2.35, -.62], wallA, desk);
  box([5.1, .14, .28], [0, 4.72, -.58], metal, desk);
  for (const x of [-2.5, 2.5]) box([.12, 4.8, .26], [x, 2.4, -.56], metal, desk);
  box([5.1, .12, .30], [0, .06, -.50], metal, desk);
  box([2.5, 1.7, .05], [0, 2.35, -.50], inset, desk);
  for (const x of [-1.27, 1.27]) box([.07, 1.76, .09], [x, 2.35, -.48], metal, desk);
  for (const y of [1.47, 3.23]) box([2.6, .07, .09], [0, y, -.48], metal, desk);
  box([2.3, .010, .010], [0, 3.17, -.455], cyanStrip, desk);
  for (const x of [-2.32, 2.32]) box([.014, 3.2, .02], [x, 2.55, -.50], amberStrip, desk);
  rod([1.75, 4.65, -.46], [1.75, 1.05, -.46], .03, metal, desk);
  rod([1.85, 4.65, -.46], [1.85, 1.05, -.46], .018, trim, desk);
  box([2.7, .03, 1.45], [0, -.075, 0], metal, desk);
  box([2.74, .008, .02], [0, -.058, .74], amberStrip, desk);
  box([1.05, .90, .74], [-.62, .45, -.20], dark, desk);
  for (const y of [.18, .45, .72]) { box([.96, .22, .02], [-.62, y, .18], metal, desk); box([.34, .018, .03], [-.62, y + .05, .20], edge, desk); }
  for (const x of [.62, 1.12]) box([.07, .90, .07], [x, .45, .14], dark, desk);
  box([.90, .04, .60], [.92, .30, -.28], metal, desk);
  box([2.3, .07, .84], [0, .975, -.18], steel, desk);
  box([2.3, .012, .012], [0, .94, .245], amberStrip, desk);
  box([2.34, .014, .86], [0, 1.017, -.18], edge, desk);
  // Diagnostic module: a small physical screen with animated bars.
  const moduleMaterial = new THREE.MeshStandardMaterial({ color: 0x2f6f78, emissive: 0x6fdbe8, emissiveIntensity: .5, roughness: .4 });
  box([.64, .40, .30], [-.78, 1.22, -.32], dark, desk);
  box([.52, .27, .012], [-.78, 1.235, -.168], inset, desk);
  const bars = [0, 1, 2, 3, 4].map(i => { const bar = box([.05, .04 + i * .015, .006], [-.94 + i * .08, 1.16 + (.04 + i * .015) / 2, -.16], moduleMaterial, desk); bar.castShadow = false; return bar; });
  // Tool dock: three hung tools, each with a status strip.
  const dockMaterial = new THREE.MeshStandardMaterial({ color: 0x4d6b70, emissive: 0x77dce8, emissiveIntensity: .15, roughness: .4 });
  box([1.0, .62, .04], [.05, 1.52, -.50], dark, desk);
  box([.92, .08, .20], [.05, 1.07, -.36], metal, desk);
  const wrench = new THREE.Group(); wrench.position.set(-.30, 1.55, -.46); desk.add(wrench);
  rod([0, -.26, 0], [0, .22, 0], .016, edge, wrench); mesh(new THREE.TorusGeometry(.05, .014, 6, 18, Math.PI * 1.5), edge, wrench, [0, .27, 0]).rotation.z = -Math.PI * .25;
  const probe = new THREE.Group(); probe.position.set(.05, 1.55, -.46); desk.add(probe);
  rod([0, -.26, 0], [0, .20, 0], .012, edge, probe); mesh(new THREE.SphereGeometry(.03, 12, 8), brass, probe, [0, .24, 0]); rod([0, -.26, 0], [0, -.05, 0], .028, rubber, probe);
  const wand = new THREE.Group(); wand.position.set(.40, 1.52, -.46); desk.add(wand);
  box([.09, .40, .06], [0, 0, 0], steel, wand); box([.12, .08, .08], [0, .22, 0], metal, wand); mesh(new THREE.SphereGeometry(.026, 12, 8), dockMaterial, wand, [0, .27, 0]);
  for (const x of [-.30, .05, .40]) box([.12, .012, .014], [x, 1.14, -.255], dockMaterial, desk).castShadow = false;
  // Amber service button on a slanted console. A hidden hit volume is exposed.
  const buttonMaterial = new THREE.MeshStandardMaterial({ color: 0xa8702f, emissive: 0xffa24a, emissiveIntensity: 1.1, roughness: .35 });
  const console_ = box([.46, .11, .34], [.84, 1.11, .0], dark, desk); console_.rotation.x = .8;
  const button = cylinder(.075, .085, .038, [0, .070, 0], buttonMaterial, console_, 32);
  const buttonRing = ring(.105, .009, [0, .056, 0], edge, console_);
  cylinder(.015, .015, .016, [.17, .06, .09], cyanStrip, console_, 8);
  const serviceHit = new THREE.Mesh(new THREE.SphereGeometry(.2, 12, 8), new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false }));
  serviceHit.position.set(.84, 1.20, .06); serviceHit.userData.route = 'service'; desk.add(serviceHit);
  // A subtle practical so the desk reads in the dark and the amber glows.
  const deskLight = new THREE.PointLight(0xffa24a, lowPower ? 0 : 1.1, 2.6, 2); deskLight.position.set(.3, 1.7, .55); desk.add(deskLight);

  // Second articulated arm: hangs from the same crane beam as the hook,
  // idles above the desk, and swings to scan the hero when the button is pressed.
  const arm2 = new THREE.Group(); arm2.position.set(-4.30, beamY - .40, beamZ); crane.add(arm2);
  box([.74, .22, .46], [0, 0, 0], metal, arm2);
  for (const x of [-.24, .24]) cylinder(.075, .075, .38, [x, .13, 0], steel, arm2, 20).rotation.x = Math.PI / 2;
  box([.26, .07, .12], [0, -.15, .24], amberStrip, arm2);
  const swivel = new THREE.Group(); swivel.position.set(0, -.12, 0); arm2.add(swivel);
  cylinder(.14, .17, .22, [0, -.04, 0], steel, swivel, 28);
  ring(.15, .012, [0, -.02, 0], brass, swivel);
  const L1 = 2.2, L2 = 2.0;
  const shoulder2 = new THREE.Group(); shoulder2.position.set(0, -.20, 0); swivel.add(shoulder2);
  cylinder(.17, .17, .26, [0, 0, 0], steel, shoulder2, 28).rotation.x = Math.PI / 2;
  box([L1, .15, .17], [L1 / 2, 0, 0], steel, shoulder2);
  box([L1 - .5, .05, .21], [L1 / 2, .095, 0], metal, shoulder2);
  for (const dz of [-.12, .12]) rod([.28, -.07, dz], [L1 - .30, .16, dz], .024, edge, shoulder2);
  rod([.25, -.14, 0], [L1 - .55, -.11, 0], .035, dark, shoulder2);
  const elbow2 = new THREE.Group(); elbow2.position.set(L1, 0, 0); shoulder2.add(elbow2);
  cylinder(.13, .13, .26, [0, 0, 0], steel, elbow2, 28).rotation.x = Math.PI / 2;
  cylinder(.065, .065, .30, [0, 0, 0], brass, elbow2, 20).rotation.x = Math.PI / 2;
  box([L2, .12, .14], [L2 / 2, 0, 0], dark, elbow2);
  box([L2 - .6, .035, .18], [L2 / 2, .075, 0], steel, elbow2);
  for (const dz of [-.10, .10]) rod([.2, -.06, dz], [L2 - .25, .04, dz], .017, edge, elbow2);
  const wrist2 = new THREE.Group(); wrist2.position.set(L2, 0, 0); elbow2.add(wrist2);
  mesh(new THREE.SphereGeometry(.09, 20, 14), steel, wrist2);
  const tool2 = new THREE.Group(); wrist2.add(tool2);
  cylinder(.055, .075, .20, [.10, 0, 0], metal, tool2, 20).rotation.z = Math.PI / 2;
  cylinder(.04, .04, .06, [.22, 0, 0], brass, tool2, 16).rotation.z = Math.PI / 2;
  const lens = mesh(new THREE.SphereGeometry(.034, 14, 10), cyanStrip, tool2, [.27, 0, 0]); lens.castShadow = false;
  const tip = new THREE.Object3D(); tip.position.set(.30, 0, 0); tool2.add(tip);
  // Cyan scan: a soft light cone, a spot and a ring sweeping over the hero.
  const scanMaterial = new THREE.ShaderMaterial({ transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, uniforms: { strength: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'varying vec2 vUv; uniform float strength; void main(){ float a = (.6 + .4 * vUv.y) * strength; gl_FragColor = vec4(vec3(.34,.88,.96) * a * .5, a * .20); }' });
  const scanCone = new THREE.Mesh(new THREE.CylinderGeometry(.012, .30, 1, 28, 1, true), scanMaterial);
  scanCone.frustumCulled = false; scanCone.visible = false; stage.add(scanCone);
  const scanSpot = new THREE.SpotLight(0x74e9ff, 0, 5, .22, .9, 1.4); stage.add(scanSpot, scanSpot.target);
  const scanRingMaterial = new THREE.MeshBasicMaterial({ color: 0x7fe9f6, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
  const scanRing = new THREE.Mesh(new THREE.TorusGeometry(.82, .006, 6, 72), scanRingMaterial);
  scanRing.rotation.x = Math.PI / 2; scanRing.visible = false; stage.add(scanRing);
  const heroChest = new V3(-.10, 3.12, .30);

  const service = { amount: 0, running: false, hover: 0, hoverTarget: 0, pressed: 0 };
 
  const idleTarget = new V3(-3.0, 1.95, -2.0), workTarget = new V3(-1.45, 3.30, .15);
  const target = new V3(), toTip = new V3(), toTarget = new V3(), basePosition = new V3(), q = new THREE.Quaternion();
  function poseArm(amount, time, idle) {
    arm2.getWorldPosition(basePosition); basePosition.y -= .32;
    const e = amount * amount * (3 - 2 * amount);
    target.lerpVectors(idleTarget, workTarget, e); target.y += Math.sin(e * Math.PI) * .45;
    target.y += Math.sin(time * .5) * .03 * idle * (1 - e); target.x += Math.sin(time * .37) * .04 * idle * (1 - e);
    const dx = target.x - basePosition.x, dz = target.z - basePosition.z, r = Math.max(.2, Math.hypot(dx, dz)), h = target.y - basePosition.y;
    const distance = Math.min(Math.hypot(r, h), L1 + L2 - .02);
    const cosElbow = THREE.MathUtils.clamp((distance * distance - L1 * L1 - L2 * L2) / (2 * L1 * L2), -1, 1);
    const q2 = -Math.acos(cosElbow), q1 = Math.atan2(h, r) - Math.atan2(L2 * Math.sin(q2), L1 + L2 * Math.cos(q2));
    swivel.rotation.y = Math.atan2(-dz, dx); shoulder2.rotation.z = q1; elbow2.rotation.z = q2;
    // The tool points down when parked and at the hero's chest while scanning.
    const aimUp = Math.atan2(heroChest.y - target.y, Math.hypot(heroChest.x - target.x, heroChest.z - target.z));
    wrist2.rotation.z = THREE.MathUtils.lerp(-Math.PI / 2, aimUp, e) - (q1 + q2);
  }
  function runService(reduced = false) {
    if (service.running) return false;
    service.running = true;
    if (reduced) { service.amount = 1; setTimeout(() => { service.amount = 0; service.running = false; }, 3800); return true; }
    gsap.timeline({ onComplete() { service.running = false; } })
      .to(service, { amount: 1, duration: 1.8, ease: 'none' })
      .to(service, { amount: 0, duration: 1.6, ease: 'none', delay: 4.2 });
    return true;
  }
  const aimWorld = new V3(), tipWorld = new V3(), axis = new V3();


  // ---------- Contact: arc-reactor control, ceiling projector, hologram volume ----------
  const coreMaterial = new THREE.MeshStandardMaterial({ color: 0x4fb9ca, emissive: 0x4fd2ea, emissiveIntensity: 1.3, roughness: .3 });
  const glowMaterial = new THREE.MeshBasicMaterial({ color: 0x7fe8ff, transparent: true, opacity: .45, blending: THREE.AdditiveBlending, depthWrite: false });
  const hitMaterial = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false });
  // A shop-floor device: bezel, recessed well, radial coils and a glowing core.
  function reactor(parent, position, radius, tilt = 0) {
    const group = new THREE.Group(); group.position.fromArray(position); group.rotation.x = tilt; parent.add(group);
    cylinder(radius * 1.38, radius * 1.50, radius * .38, [0, 0, 0], dark, group, 48);
    ring(radius * 1.24, radius * .10, [0, radius * .20, 0], edge, group);
    cylinder(radius * 1.02, radius * 1.02, radius * .20, [0, radius * .19, 0], metal, group, 48);
    ring(radius * .88, radius * .045, [0, radius * .30, 0], coreMaterial, group);
    for (let i = 0; i < 10; i++) {
      const a = i / 10 * Math.PI * 2;
      const coil = box([radius * .11, radius * .08, radius * .34], [Math.sin(a) * radius * .62, radius * .29, Math.cos(a) * radius * .62], steel, group); coil.rotation.y = a;
    }
    ring(radius * .42, radius * .07, [0, radius * .31, 0], steel, group);
    cylinder(radius * .32, radius * .32, radius * .14, [0, radius * .34, 0], coreMaterial, group, 36);
    const glow = new THREE.Mesh(new THREE.CircleGeometry(radius * .95, 40), glowMaterial);
    glow.rotation.x = -Math.PI / 2; glow.position.y = radius * .43; group.add(glow);
    const hit = new THREE.Mesh(new THREE.SphereGeometry(radius * 1.9, 12, 8), hitMaterial);
    hit.position.copy(group.position).add(new V3(0, radius * .6, 0).applyEuler(group.rotation)); hit.userData.route = 'contact'; parent.add(hit);
    return { group, hit };
  }
  // The device stands on a small plinth, its face toward the room.
  box([.64, .52, .30], [-.05, 1.26, .0], dark, desk);
  box([.66, .03, .32], [-.05, 1.53, .0], metal, desk);
  box([.5, .012, .012], [-.05, 1.01, .16], cyanStrip, desk);
  const deskReactor = reactor(desk, [-.05, 1.28, .17], .2, Math.PI / 2 - .08);
  const contactHit = deskReactor.hit;
  const deskEmitter = new THREE.Object3D(); deskEmitter.position.set(-.05, 1.58, .16); desk.add(deskEmitter);
  const contactLight = new THREE.PointLight(0x7fe8ff, 0, 3.6, 2); contactLight.position.set(deskX, 2.3, deskZ + .9); leftSide.add(contactLight);

  // The hologram plane: a CSS panel sits here; the stations expose it to scene.js.
  const panelZ = deskZ + .12, panelY = 2.38, panelW = 1.8, panelH = 1.2;
  const contactStation = new THREE.Group(); contactStation.position.set(deskX, 0, panelZ); stage.add(contactStation);
  const contactObject = new THREE.Group(); contactObject.position.set(0, panelY, 0); contactStation.add(contactObject);
  const contactAnchor = new THREE.Object3D(); contactAnchor.position.set(0, panelY - 1.2, .1); contactStation.add(contactAnchor);
  const contactDisplay = { name: 'contact', width: panelW, height: panelH, pixels: [600, 400], position: [deskX, panelY, panelZ], yaw: 0,
    station: contactStation, object: contactObject, anchor: contactAnchor, light: new THREE.PointLight(0x63d5ea, 0, 1, 2), material: new THREE.MeshBasicMaterial(), energy: 0, rest: 0, emitter: deskEmitter };
  contactObject.add(contactDisplay.light);

  // Projector: a compact housing on its own trolley on the crane beam.
  const projector = new THREE.Group(); projector.position.set(deskX, beamY - .40, beamZ); crane.add(projector);
  box([.66, .22, .46], [0, 0, 0], metal, projector);
  for (const x of [-.22, .22]) cylinder(.07, .07, .38, [x, .13, 0], steel, projector, 20).rotation.x = Math.PI / 2;
  box([.26, .07, .12], [0, -.15, .24], amberStrip, projector);
  for (const x of [-.12, .12]) rod([x, -.10, 0], [x, -.62, .0], .03, steel, projector);
  cylinder(.10, .12, .10, [0, -.14, 0], steel, projector, 24);
  cable([[.26, .0, -.2], [.42, -.4, -.3], [.36, -.8, -.12], [.12, -.98, -.04]], .016, projector);
  const housing = new THREE.Group(); housing.position.set(0, -.80, .0); projector.add(housing);
  box([.60, .26, .40], [0, 0, 0], metal, housing);
  for (let i = -2; i <= 2; i++) box([.46, .018, .03], [0, .105 + 0, i * .07], trim, housing).position.y = .14;
  box([.64, .05, .44], [0, .14, 0], trim, housing).scale.set(.9, 1, .5);
  box([.64, .02, .02], [0, -.06, .205], cyanStrip, housing);
  cylinder(.11, .13, .14, [0, -.20, 0], steel, housing, 32);
  ring(.115, .012, [0, -.275, 0], brass, housing);
  const lensMaterial = new THREE.MeshStandardMaterial({ color: 0x4fa9b5, emissive: 0x7fe8ff, emissiveIntensity: .25, roughness: .2, metalness: .4 });
  cylinder(.085, .085, .02, [0, -.285, 0], lensMaterial, housing, 32);
  const lensPoint = new THREE.Object3D(); lensPoint.position.set(0, -.30, 0); housing.add(lensPoint);
  // Light volume: a soft pyramid from the lens to the hologram rectangle.
  const volume = (() => {
    const apex = new V3(); projector.updateMatrixWorld(true); lensPoint.getWorldPosition(apex);
    const hw = panelW / 2 * 1.02, hh = panelH / 2 * 1.02, cz = panelZ + .02;
    const corners = [[-hw, panelY + hh], [hw, panelY + hh], [hw, panelY - hh], [-hw, panelY - hh]].map(([x, y]) => [deskX + x, y, cz]);
    const positions = new Float32Array([apex.x, apex.y, apex.z, ...corners.flat()]);
    const t = new Float32Array([0, 1, 1, 1, 1]);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3)); geometry.setAttribute('t', new THREE.BufferAttribute(t, 1));
    geometry.setIndex([0, 1, 2, 0, 2, 3, 0, 3, 4, 0, 4, 1]);
    return geometry;
  })();
  const volumeMaterial = new THREE.ShaderMaterial({ transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, uniforms: { strength: { value: 0 } },
    vertexShader: 'attribute float t; varying float vT; void main(){ vT = t; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'varying float vT; uniform float strength; void main(){ float a = ((1.0 - vT) * .55 + .05) * strength; gl_FragColor = vec4(vec3(.34,.88,.96) * a, a * .16); }' });
  const volumeMesh = new THREE.Mesh(volume, volumeMaterial); volumeMesh.frustumCulled = false; volumeMesh.visible = false; leftSide.add(volumeMesh);
  const contact = { amount: 0, hover: 0, hoverTarget: 0 };
  function setContact(active, instant = false) {
    gsap.killTweensOf(contact);
    if (instant) { contact.amount = active ? 1 : 0; return; }
    gsap.to(contact, { amount: active ? 1 : 0, duration: active ? 1.1 : .6, delay: active ? .45 : 0, ease: 'power2.out' });
  }

  const wall = new THREE.Group(); leftSide.add(wall);
  for (let i = 0; i < 9; i++) {
    const x = -14.3 + i * 1.8;
    box([1.74, 4.6 + (i % 3) * .3, .05], [x, 2.35 + (i % 3) * .15, -4.45], i % 2 ? wallA : wallB, wall);
    box([.02, 6, .02], [x + .9, 3, -4.4], seam, wall);
    box([1.4, .012, .02], [x, 1.35 + (i % 2) * .5, -4.42], seam, wall);
  }
  for (const y of [4.55, 4.85]) rod([-14, y, -4.28], [-.4, y, -4.28], y > 4.7 ? .035 : .07, metal, wall);
  for (let x = -13; x < -1; x += 1.7) box([.07, .5, .09], [x, 4.7, -4.32], trim, wall);
  for (let i = 0; i < 3; i++) box([2.3, .22, .08], [-9.2 + i * 2.8, 2.2, -4.4], metal, wall);
  // Low-contrast cyan contour: a rectangle on the wall and floor reflection strips.
  for (const x of [-6.4, -9.6]) box([.012, .004, 9], [x, -.061, -.3], dark, wall);
  cyanStrip.emissiveIntensity = .38;

  return { mountSuits, mountHero, serviceHit, runService, reactor, contactHit, contactDisplay, setContact,
    setHover(value) { service.hoverTarget = value ? 1 : 0; },
    setReactorHover(value) { contact.hoverTarget = value ? 1 : 0; },
    setViewport(aspect, phone, tablet) {
      // Phones and tablets keep the hero, the desk and the reactor; far set dressing is dropped.
      rightSide.visible = aspect >= 1.25 && !phone && !tablet;
      bays[1].bay.visible = aspect >= 1.5 && !tablet;
      wall.visible = weightGroup.visible = hookSwing.visible = !phone && !tablet;
    },
    update(time, idle, power = 1, speed = 0) {
      const dt = Math.min(Math.max(time - (update$.last ?? time), 0), .05) || .016; update$.last = time;
      amberStrip.emissiveIntensity = (1.5 + Math.sin(time * .6) * .08 * idle) * power;
      for (const { group, phase } of animated) group.rotation.set(Math.sin(time * .21 + phase) * .0045 * idle, 0, Math.sin(time * .17 + phase) * .006 * idle);
      heroHarness?.place(THREE.MathUtils.clamp(-speed * .07, -.06, .06) + Math.sin(time * .3) * .004 * idle, THREE.MathUtils.clamp(speed * .025, -.03, .03) + Math.sin(time * .23) * .003 * idle);
      contact.hover += (contact.hoverTarget - contact.hover) * .18;
      const hologram = THREE.MathUtils.smoothstep(contact.amount, 0, 1), pulse$ = Math.sin(time * 2.1) * .25 * idle;
      coreMaterial.emissiveIntensity = 1.25 + pulse$ * .6 + contact.hover * .9 + hologram * .9;
      glowMaterial.opacity = .35 + contact.hover * .25 + hologram * .25;
      volumeMaterial.uniforms.strength.value = hologram; volumeMesh.visible = hologram > .01;
      lensMaterial.emissiveIntensity = .25 + hologram * 2.2;
      contactLight.intensity = lowPower ? 0 : hologram * 1.6;
      const a = service.amount;
      service.hover += (service.hoverTarget - service.hover) * .18;
      service.pressed += ((a > .02 ? 1 : 0) - service.pressed) * .25;
      poseArm(a, time, idle);
      const strength = THREE.MathUtils.smoothstep(a, .55, 1);
      scanMaterial.uniforms.strength.value = strength;
      scanCone.visible = scanRing.visible = a > .03 && strength > .01;
      if (scanCone.visible) {
        arm2.updateMatrixWorld(true); tip.getWorldPosition(tipWorld);
        toTarget.subVectors(heroChest, tipWorld); const length = toTarget.length();
        scanCone.position.copy(tipWorld).addScaledVector(toTarget, .5); scanCone.scale.set(1, length, 1);
        scanCone.quaternion.setFromUnitVectors(yAxis, axis.copy(toTarget).negate().normalize());
        scanSpot.position.copy(tipWorld); scanSpot.target.position.copy(heroChest);
        const phase = (time * .55) % 1;
        scanRing.position.set(0, .55 + phase * 3.1, 0); scanRingMaterial.opacity = strength * Math.sin(phase * Math.PI) * .5;
      }
      scanSpot.intensity = 6 * strength * power;
      lens.material = strength > .05 ? cyanStrip : cyanStrip;
      const pulse = .75 + Math.sin(time * 5) * .25;
      dockMaterial.emissiveIntensity = .15 + strength * 1.3 * pulse;
      moduleMaterial.emissiveIntensity = .5 + strength * .9;
      bars.forEach((bar, i) => { bar.scale.y = 1 + strength * Math.sin(time * 4 + i * 1.3) * .45; });
      buttonMaterial.emissiveIntensity = 1.1 + service.hover * .9 + a * .7;
      button.position.y = .070 - .016 * service.pressed;
      deskLight.intensity = lowPower ? 0 : 1.1 + a * .9;
    } };
}
const update$ = {};
