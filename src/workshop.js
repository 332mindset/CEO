import * as THREE from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { createHall } from './hall.js';

// Everything around the suit is built as geometry, including bearings, cables,
// fasteners and tools. The scene stays compact so light can define its edges.
export function createWorkshop(scene, { lowPower = false, small = false } = {}) {
  const stage = new THREE.Group(); scene.add(stage);
  const steel = new THREE.MeshStandardMaterial({ color: 0x353c3e, metalness: .86, roughness: .42 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x111719, metalness: .77, roughness: .5 });
  const edge = new THREE.MeshStandardMaterial({ color: 0x778083, metalness: .92, roughness: .32 });
  const brass = new THREE.MeshStandardMaterial({ color: 0x877057, metalness: .8, roughness: .47 });
  const rubber = new THREE.MeshStandardMaterial({ color: 0x090c0d, metalness: .13, roughness: .78 });
  const amber = new THREE.MeshStandardMaterial({ color: 0xe2b073, emissive: 0xffa650, emissiveIntensity: 2.1, roughness: .4 });
  const cyan = new THREE.MeshStandardMaterial({ color: 0x6dabae, emissive: 0x78d5df, emissiveIntensity: .9, roughness: .3 });
  // Fine directional scuffs affect reflections instead of drawing large scratches.
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 256;
  const ctx = canvas.getContext('2d'); ctx.fillStyle = '#ababab'; ctx.fillRect(0, 0, 256, 256);
  let seed = 812;
  const random = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  for (let i = 0; i < 1700; i++) {
    const gray = 110 + Math.floor(random() * 120);
    ctx.strokeStyle = `rgba(${gray},${gray},${gray},.22)`;
    const x = random() * 256, y = random() * 256;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + random() * 18, y + random() * .8); ctx.stroke();
  }
  const scuffs = new THREE.CanvasTexture(canvas); scuffs.wrapS = scuffs.wrapT = THREE.RepeatWrapping; scuffs.repeat.set(3, 3);
  for (const material of [steel, dark, brass]) { material.roughnessMap = scuffs; material.bumpMap = scuffs; material.bumpScale = .003; }
  function mesh(geometry, material, parent = stage, position = [0, 0, 0]) {
    const object = new THREE.Mesh(geometry, material); object.position.fromArray(position);
    object.castShadow = true; object.receiveShadow = true; parent.add(object); return object;
  }
  const box = (size, position, material = steel, parent = stage) => mesh(new THREE.BoxGeometry(...size), material, parent, position);
  const cylinder = (rt, rb, height, position, material = steel, parent = stage, segments = 40) => mesh(new THREE.CylinderGeometry(rt, rb, height, segments), material, parent, position);
  function rod(from, to, radius, material = steel, parent = stage) {
    const a = new THREE.Vector3(...from), b = new THREE.Vector3(...to), d = b.clone().sub(a);
    const object = cylinder(radius, radius, d.length(), a.clone().add(b).multiplyScalar(.5).toArray(), material, parent, 16);
    object.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()); return object;
  }
  function ring(radius, tube, position, material = edge, parent = stage, arc = Math.PI * 2) {
    const object = mesh(new THREE.TorusGeometry(radius, tube, 7, 80, arc), material, parent, position);
    object.rotation.x = -Math.PI / 2; return object;
  }
  function cable(points, radius = .023, parent = stage, material = rubber) {
    return mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p))), 45, radius, 7, false), material, parent);
  }

  // A low-reflectance floor, with a softly blurred planar reflection and a
  // separate shadow receiver. Reflection quality is bounded on small devices.
  const floor = mesh(new THREE.PlaneGeometry(70, 70), new THREE.MeshStandardMaterial({ color: 0x101517, metalness: .5, roughness: .58 }), stage, [0, -.09, 0]);
  floor.rotation.x = -Math.PI / 2; floor.castShadow = false;
  const shader = { ...Reflector.ReflectorShader, uniforms: THREE.UniformsUtils.clone(Reflector.ReflectorShader.uniforms) };
  shader.vertexShader = shader.vertexShader.replace('varying vec4 vUv;', 'varying vec4 vUv; varying vec2 vLocal;').replace('vUv = textureMatrix', 'vLocal = position.xy; vUv = textureMatrix');
  shader.fragmentShader = shader.fragmentShader.replace('varying vec4 vUv;', 'varying vec4 vUv; varying vec2 vLocal;')
    .replace('vec4 base = texture2DProj( tDiffuse, vUv );', `vec4 base = vec4(0.0);
      for(int x=-1;x<=1;x++) for(int y=-1;y<=1;y++) {
        vec4 coord = vUv; coord.xy += vec2(float(x),float(y)) * .0023 * coord.w;
        base += texture2DProj(tDiffuse,coord) / 9.0;
      }`)
    .replace('gl_FragColor = vec4( blendOverlay( base.rgb, color ), 1.0 );', 'float fade = 1.0 - smoothstep(2.0, 6.0, length(vLocal)); gl_FragColor = vec4(mix(vec3(.009,.013,.016), base.rgb, .24 * fade), 1.0);');
  const reflection = new Reflector(new THREE.PlaneGeometry(70, 70), { textureWidth: lowPower ? 384 : 768, textureHeight: lowPower ? 384 : 768, multisample: 0, clipBias: .001, shader });
  reflection.rotation.x = -Math.PI / 2; reflection.position.y = -.07; stage.add(reflection);
  const shadow = mesh(new THREE.PlaneGeometry(16, 16), new THREE.ShadowMaterial({ opacity: .55 }), stage, [0, -.065, 0]);
  shadow.rotation.x = -Math.PI / 2; shadow.castShadow = false;
  for (const x of [-3.2, 0, 3.2]) box([.012, .004, 9], [x, -.061, -.3], dark);
  for (const z of [-3.1, -.1, 2.9]) box([9, .004, .012], [0, -.061, z], dark);

  const turntable = new THREE.Group(); stage.add(turntable);
  const platform = new THREE.Group(); turntable.add(platform);
  cylinder(1.12, 1.24, .16, [0, .025, 0], dark, platform, 96);
  cylinder(1.13, 1.16, .14, [0, .17, 0], steel, platform, 96);
  cylinder(1.08, 1.08, .024, [0, .252, 0], dark, platform, 96);
  ring(1.126, .013, [0, .244, 0], edge, platform);
  ring(.93, .006, [0, .268, 0], brass, platform);
  ring(.67, .0035, [0, .267, 0], steel, platform);
  const boltGeometry = new THREE.CylinderGeometry(.018, .018, .008, 6);
  const bolts = new THREE.InstancedMesh(boltGeometry, edge, 28), matrix = new THREE.Matrix4();
  for (let i = 0; i < 28; i++) {
    const a = i / 28 * Math.PI * 2; matrix.makeTranslation(Math.sin(a) * 1.026, .269, Math.cos(a) * 1.026); bolts.setMatrixAt(i, matrix);
  }
  platform.add(bolts);
  for (let i = 0; i < 12; i++) {
    const a = i / 12 * Math.PI * 2;
    const seam = box([.012, .006, .20], [Math.sin(a) * .81, .27, Math.cos(a) * .81], steel, platform); seam.rotation.y = a;
    if (i % 3 === 0) {
      const stripe = ring(1.145, .009, [0, .14, 0], amber, platform, .36); stripe.rotation.z = a;
      const clamp = box([.18, .055, .23], [Math.sin(a) * 1.13, .065, Math.cos(a) * 1.13], steel, platform); clamp.rotation.y = a;
    }
  }
  // Recessed maintenance tracks under the armor's feet.
  for (const x of [-.28, .28]) {
    box([.17, .012, .48], [x, .268, .015], steel, platform);
    box([.13, .016, .26], [x, .277, -.07], rubber, platform);
    for (const z of [-.22, .22]) box([.19, .023, .026], [x, .283, z], brass, platform);
  }
  // The hero hangs this far above the platform on a chain-hoist rig.
  const heroLift = .26;
  ring(.52, .008, [0, .272, 0], amber, platform); ring(.40, .004, [0, .272, 0], amber, platform);
  const underGlow = new THREE.PointLight(0xffa24a, 2.2, 2.6, 2); underGlow.position.set(0, .62, .05); platform.add(underGlow);
  const suitMount = new THREE.Group(); suitMount.position.set(0, .288, 0); suitMount.rotation.y = -.26; turntable.add(suitMount);

  // The hero stage sits in front of a deep back wall; the Hall of Armor fills
  // the space behind and beside it (see hall.js).
  box([46, 16, .12], [0, 6, -4.55], new THREE.MeshStandardMaterial({ color: 0x06090b, roughness: .85, metalness: .25 }));
  const bayMetal = new THREE.MeshStandardMaterial({ color: 0x171c1e, metalness: .50, roughness: .72, envMapIntensity: .20 });
  const bayTrim = new THREE.MeshStandardMaterial({ color: 0x303638, metalness: .5, roughness: .66, envMapIntensity: .18 });
  const hall = createHall({ stage, lowPower, small, helpers: { mesh, box, cylinder, rod, ring, cable }, mats: { steel, dark, edge, brass, rubber } });
  const bayWash = new THREE.PointLight(0x99764f, lowPower ? 0 : .5, 5, 2); bayWash.position.set(2.2, 2.2, -1.8); stage.add(bayWash);
  // Fixed circular overhead track. The existing arm rides a hanging carriage,
  // preserving its placement and platform-following rotation at every angle.
  const trackRadius = Math.hypot(2.10,.92);
  ring(trackRadius,.055,[0,5.2,0],bayMetal);
  ring(trackRadius+.10,.025,[0,5.2,0],bayTrim);
  rod([2.1,5.2,-.92],[2.62,5.74,-3.3],.065,bayMetal);
  box([.34,.30,.30],[2.62,5.66,-3.3],bayMetal);
  const carriage = new THREE.Group(); carriage.position.set(2.10,0,-.92); turntable.add(carriage);
  box([.32,.16,.29],[0,5.12,0],steel,carriage);
  for (const x of [-.11,.11]) cylinder(.075,.075,.035,[x,5.22,0],rubber,carriage,16).rotation.z=Math.PI/2;
  box([.105,2.52,.12],[0,3.83,-.02],bayMetal,carriage);
  rod([.08,2.65,.035],[.08,5.04,.035],.020,edge,carriage);
  box([.28,.23,.23],[0,2.58,0],bayMetal,carriage);
  cable([[.12,5.08,-.09],[.18,4.1,-.10],[.13,3.1,-.09],[.08,2.6,.03]],.018,carriage);
  const assembly = new THREE.Group(); assembly.position.set(1.55, .02, -.88); turntable.add(assembly);
  cylinder(.24, .31, .16, [0, .04, 0], dark, assembly);
  cylinder(.16, .20, .22, [0, .20, 0], steel, assembly);
  ring(.19, .012, [0, .32, 0], brass, assembly);
  const shoulder = new THREE.Group(); shoulder.position.y = .34; assembly.add(shoulder);
  const elbowPos = [.55, 2.2, -.04];
  rod([0, 0, 0], elbowPos, .095, dark, shoulder);
  for (const offset of [-.085, .085]) rod([offset, .05, .025], [elbowPos[0] + offset, 2.12, .025], .026, edge, shoulder);
  box([.14, 1.34, .17], [.27, 1.09, 0], steel, shoulder).rotation.z = -.24;
  const elbow = new THREE.Group(); elbow.position.fromArray(elbowPos); shoulder.add(elbow);
  cylinder(.15, .15, .25, [0, 0, 0], steel, elbow).rotation.x = Math.PI / 2;
  cylinder(.078, .078, .27, [0, 0, 0], brass, elbow, 24).rotation.x = Math.PI / 2;
  const wristPos = [-1.12, .70, .54];
  rod([0, 0, 0], wristPos, .068, dark, elbow);
  rod([.065, .05, -.025], [-1.03, .65, .46], .025, edge, elbow);
  rod([-.07, .06, .06], [-1.19, .68, .60], .030, steel, elbow);
  cable([[0, .04, -.14], [-.54, .38, -.06], [-1.12, .68, .41]], .025, elbow);
  const wrist = new THREE.Group(); wrist.position.fromArray(wristPos); elbow.add(wrist);
  mesh(new THREE.SphereGeometry(.093, 20, 14), steel, wrist);
  rod([0, 0, 0], [-.18, .02, .13], .036, brass, wrist);
  for (const side of [-1, 1]) rod([-.18, .02, .13], [-.30, -.085, .18 + side * .05], .015, edge, wrist);
  const plateShape = new THREE.Shape();
  plateShape.moveTo(-.13, -.085); plateShape.lineTo(-.16, .02);
  plateShape.quadraticCurveTo(0, .16, .16, .02); plateShape.lineTo(.13, -.085);
  plateShape.quadraticCurveTo(0, -.035, -.13, -.085);
  const plate = mesh(new THREE.ExtrudeGeometry(plateShape, { depth: .028, bevelEnabled: true, bevelSize: .014, bevelThickness: .012, bevelSegments: 3, steps: 1 }), new THREE.MeshStandardMaterial({ color: 0x731b17, metalness: .88, roughness: .27 }), wrist, [-.32, -.08, .18]);
  plate.rotation.set(.72, -.3, -.28);
  mesh(new THREE.TorusGeometry(.093, .006, 6, 32, Math.PI), brass, plate, [0, -.025, .05]);
  const serviceLight = new THREE.PointLight(0x8bdfe7, .42, .65, 2);
  serviceLight.position.set(-.32, -.04, .19); wrist.add(serviceLight);
  const toolLamp = mesh(new THREE.SphereGeometry(.014, 12, 8), cyan, wrist, [-.26, .018, .15]);
  rod([1.02, .065, -.45], [1.55, .065, -.88], .065, dark, turntable);
  const scanner = new THREE.SpotLight(0x74e9ff, .9, 2, .18, .8, 1);
  scanner.position.set(-.27, .04, .18); wrist.add(scanner);
  scanner.target.position.set(.37, 3.11, .17); turntable.add(scanner.target);
  const beamMaterial = new THREE.LineBasicMaterial({ color: 0x83edfa, transparent: true, opacity: .12, depthWrite: false });
  const beamGeometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
  const beam = new THREE.Line(beamGeometry, beamMaterial); turntable.add(beam);
  const beamStart = new THREE.Vector3();
  const robots = [{ elbow, wrist, sign: 1 }];
  cable([[0, .15, -.14], [.33, .08, -.28], [.52, -.02, .42], [.22, -.02, .92]], .035, assembly);
  cable([[-.90, .015, -.4], [-1.55, -.025, -.8], [-2.25, -.025, -.3], [-2.65, -.025, -1.1], [-3.0, -.025, -3.4]], .029);
  cable([[2.25, -.025, -1.9], [2.76, -.025, -1], [2.75, -.025, .45], [2.1, -.025, .9]], .025);

  const displays = {};
  let terminal, terminalReactor;
  for (const spec of [
    { name: 'contact', position: [1.46, 1.10, 1.18], yaw: -.15, width: 1.80, height: 1.20, pixels: [600, 400] },
  ]) {
    const station = new THREE.Group(); station.position.set(spec.position[0], 0, spec.position[2]); stage.add(station);
    const object = new THREE.Group(); object.position.set(0, spec.position[1], 0); object.rotation.set(-.035, spec.yaw, 0); station.add(object);
    const hw = spec.width / 2, hh = spec.height / 2, lit = cyan.clone();
      // Communication is a small physical control, not a second monitor.
      // A compact service desk carries the terminal; the head is bolted to its top.
      box([.84, .04, .46], [0, .425, .02], steel, station);
      box([.86, .012, .48], [0, .449, .02], edge, station);
      for (const x of [-.37, .37]) for (const z of [-.18, .22]) box([.045, .41, .045], [x, .205, z], dark, station);
      box([.76, .03, .38], [0, .13, .02], dark, station);
      box([.72, .17, .012], [0, .27, -.19], dark, station);
      for (const y of [.24, .29]) box([.5, .008, .004], [0, y, -.198], edge, station);
      box([.30, .02, .24], [.30, .156, .05], rubber, station);
      const head = box([.62, .09, .31], [0, .49, .035], dark, station); head.rotation.x = -.28;
      box([.58, .007, .008], [0, -.012, .157], cyan, head);
      for (const x of [-.28, .28]) box([.06, .05, .20], [x, .465, .035], steel, station);
      // On narrow screens the left desk is out of frame; a small reactor on this terminal takes over Contact.
      terminalReactor = hall.reactor(station, [.16, .60, .10], .10, .95);
      box([.12, .012, .12], [-.17, .55, .04], lit, station).rotation.x = -.28;
      const diagnosticAnchor = new THREE.Object3D(); diagnosticAnchor.position.set(-.39, .80, .06); station.add(diagnosticAnchor);
      station.userData.diagnosticAnchor = diagnosticAnchor;
      const contactEmitter = new THREE.Object3D(); contactEmitter.position.set(.16,.554,.04); station.add(contactEmitter);
      const diagnosticEmitter = new THREE.Object3D(); diagnosticEmitter.position.set(-.17,.555,.04); station.add(diagnosticEmitter);
      station.userData.contactEmitter = contactEmitter; station.userData.diagnosticEmitter = diagnosticEmitter;
      const holoMaterial = new THREE.ShaderMaterial({ transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
        vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
        fragmentShader: 'varying vec2 vUv; void main(){ float fade = pow(1.0 - vUv.y, 2.2); gl_FragColor = vec4(vec3(.36,.86,.93) * fade * .55, fade * .30); }' });
      for (const [x, radius] of [[-.17, .06]]) {
        const cone = mesh(new THREE.CylinderGeometry(radius * .75, radius, .22, 32, 1, true), holoMaterial, station, [x, .66, .01]);
        cone.castShadow = cone.receiveShadow = false; cone.rotation.x = -.28;
      }
      const identityCanvas = document.createElement('canvas'); identityCanvas.width = 1024; identityCanvas.height = 96;
      const identityContext = identityCanvas.getContext('2d'); identityContext.fillStyle = '#bceef5'; identityContext.font = '32px monospace'; identityContext.textAlign = 'center'; identityContext.fillText('HANAGUMORI // ARMOR SYSTEMS', 512, 60);
      const identity = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(identityCanvas), transparent: true, opacity: 0, depthWrite: false }));
      identity.position.set(0, .75, .08); identity.scale.set(1.15, .108, 1); station.add(identity); station.userData.identity = identity;
      cable([[.43, .16, .0], [.5, .025, -.12], [.7, -.02, -.4]], .019, station);
    const anchor = new THREE.Object3D(); anchor.position.set(0, .86, .10); station.add(anchor);
    const light = new THREE.PointLight(0x63d5ea, .9, 3, 2); light.position.set(0, -.5, .2); object.add(light);
    terminal = { ...spec, station, object, anchor, light, material: lit, energy: 0 };
  }
  displays.contact = hall.contactDisplay;
  hall.mountHero(suitMount, heroLift);
  const warmPool = new THREE.PointLight(0xff8f3d, 18, 4, 2); warmPool.position.set(-.5, .35, .6); stage.add(warmPool);
  return { stage, suitMount, turntable, displays, terminal, reflection, heroLift, mountSuits: hall.mountSuits, serviceHit: hall.serviceHit, runService: hall.runService, setServiceHover: hall.setHover,
    contactHit: hall.contactHit, terminalContactHit: terminalReactor.hit, setReactorHover: hall.setReactorHover, setContact: hall.setContact,
    setViewport(aspect, phone, tablet) {
      const compact = aspect < 1.25;
      terminalReactor.group.visible = terminalReactor.hit.visible = compact;
      hall.setViewport(aspect, phone, tablet);
    }, update(time, idle, power = 1, speed = 0, exploded = 0) {
    hall.update(time, idle, power, speed);
    amber.emissiveIntensity = (2.1 + Math.sin(time * .7) * .10 * idle) * power;
    warmPool.intensity = 18 * power;
    serviceLight.intensity = (.42 + Math.sin(time * .9) * .025 * idle) * power;
    scanner.intensity = .9 * power * (1 - exploded * .6);
    scanner.target.position.y = 3.11 + Math.sin(time * .45) * .08 * idle;
    scanner.getWorldPosition(beamStart); turntable.worldToLocal(beamStart);
    beamGeometry.attributes.position.setXYZ(0, beamStart.x, beamStart.y, beamStart.z);
    beamGeometry.attributes.position.setXYZ(1, scanner.target.position.x, scanner.target.position.y, scanner.target.position.z);
    beamGeometry.attributes.position.needsUpdate = true; beamMaterial.opacity = .12 * power;
    terminal.station.userData.identity.material.opacity = exploded * .8;
    for (const { elbow, wrist, sign } of robots) {
      elbow.rotation.z = Math.sin(time * .28 + sign) * .006 * idle + speed * .02;
      wrist.rotation.y = Math.sin(time * .42 + sign) * .012 * idle - speed * .025;
      wrist.position.x = -1.12 - Math.sin(time * .38) * .018 * idle;
    }
  } };
}
