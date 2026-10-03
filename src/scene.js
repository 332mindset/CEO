import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { CSS3DRenderer, CSS3DObject } from 'three/addons/renderers/CSS3DRenderer.js';
import gsap from 'gsap';
import { articulateArmor } from './rig.js';
import { createWorkshop } from './workshop.js';

export function createScene(container, { onReady, onError, onExplore, onDiagnostic, onTurn, onService }) {
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const forceReduced = new URLSearchParams(location.search).get('motion') === 'reduce';
  const reduce = () => reducedMotion.matches || forceReduced;
  document.body.dataset.reducedMotion = String(reduce());
  const smallScreen = () => innerWidth <= 760;
  const lowPower = navigator.hardwareConcurrency <= 4 || navigator.deviceMemory <= 4 || new URLSearchParams(location.search).get('quality') === 'low';
  document.body.dataset.quality = lowPower ? 'low' : 'standard';
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x080a0b, 12, 27);
  const camera = new THREE.PerspectiveCamera(36, 1, .1, 65);
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setClearColor(0x080a0b, 0);
  renderer.setPixelRatio(Math.min(devicePixelRatio, lowPower ? 1 : smallScreen() ? 1.4 : 1.75));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);
  const css = new CSS3DRenderer({ element: document.querySelector('#displays') });
  const environment = new RoomEnvironment();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const environmentTarget = pmrem.fromScene(environment, .04);
  scene.environment = environmentTarget.texture; scene.environmentIntensity = .32;
  environment.dispose(); pmrem.dispose();
  scene.add(new THREE.HemisphereLight(0x9cb8c4, 0x2d201a, .6));
  const key = new THREE.SpotLight(0xffd0a0, 125, 22, .65, .8, 2);
  key.position.set(-3.8, 6.2, 4.1); key.target.position.set(0, 1.3, 0);
  key.castShadow = true; key.shadow.mapSize.setScalar(lowPower ? 512 : smallScreen() ? 1024 : 2048);
  key.shadow.bias = -.00012; key.shadow.normalBias = .025; key.shadow.radius = 4;
  key.shadow.camera.near = .4; key.shadow.camera.far = 20; scene.add(key, key.target);
  const rim = new THREE.SpotLight(0x6ecfe8, 115, 18, .6, .8, 2);
  rim.position.set(1.7, 3.6, -2.1); rim.target.position.set(0, 2, 0); scene.add(rim, rim.target);
  const overhead = new THREE.PointLight(0xffb76a, 3, 5, 2); overhead.position.set(0, 3.45, -1.25); scene.add(overhead);
  const fill = new THREE.DirectionalLight(0xd5e1e3, .48); fill.position.set(3, 3, 6); scene.add(fill);
  const workshop = createWorkshop(scene, { lowPower, small: smallScreen() });
  const hotspots = [], pickTargets = [];
  const pickMaterial = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false, side: THREE.DoubleSide });
  for (const [name, display] of Object.entries(workshop.displays)) {
    const element = document.querySelector(`#display-${name}`);
    const screen = new CSS3DObject(element); screen.scale.setScalar(.003); screen.position.z = .023;
    display.object.add(screen); display.screen = screen;
  }
  const terminal = workshop.terminal;
  // Contact lives on the left desk's reactor; on narrow screens the terminal's small reactor takes over.
  pickTargets.push(workshop.serviceHit, workshop.contactHit, workshop.terminalContactHit);
  hotspots.push({ anchor: workshop.displays.contact.anchor, contact: true, deskEmitter: workshop.displays.contact.emitter, terminalEmitter: terminal.station.userData.contactEmitter, tether: document.querySelector('#contact-tether'), element: document.querySelector('[data-anchor="contact"]'), projected: new THREE.Vector3() });
  const diagnosticHit = new THREE.Mesh(new THREE.BoxGeometry(.25, .32, .4), pickMaterial);
  diagnosticHit.position.set(-.17, .49, .035); terminal.station.add(diagnosticHit); diagnosticHit.userData.route = 'diagnostic'; pickTargets.push(diagnosticHit);
  hotspots.push({anchor: terminal.anchor, emitter: terminal.station.userData.diagnosticEmitter, tether: document.querySelector('#diagnostic-tether'), element: document.querySelector('#diagnostic-control'), projected: new THREE.Vector3(), diagnostic: true});
  const dustGeometry = new THREE.BufferGeometry();
  const particles = new Float32Array((lowPower ? 30 : smallScreen() ? 45 : 95) * 3);
  for (let i = 0; i < particles.length; i += 3) {
    particles[i] = -6.5 + Math.random() * 10.5;
    particles[i + 1] = .3 + Math.random() * 4;
    particles[i + 2] = (Math.random() - .5) * 4;
  }
  dustGeometry.setAttribute('position', new THREE.BufferAttribute(particles, 3));
  const dust = new THREE.Points(dustGeometry, new THREE.PointsMaterial({ color: 0xcbb695, size: .011, transparent: true, opacity: .30, depthWrite: false })); scene.add(dust);
  let rig, navigation, frame, currentView = 'home', hover = '', width = 1, height = 1;
  let lastTime = 0, activeTime = 0, busy = false, hidden = document.hidden, failed = false;
  // A hung suit turns within its chains; the rig never winds up past this.
  const TURN_LIMIT = 1.5, limitTurn = value => THREE.MathUtils.clamp(value, -TURN_LIMIT, TURN_LIMIT);
  const pointer = { x: 0, y: 0 }, eased = { x: 0, y: 0 };
  const state = { x: 3, y: 1.62, z: 7.65, tx: -.43, ty: 1.89, tz: 0 };
  const diagnostic = { amount: 0 };
  let diagnosticTween, diagnosticOpen = false, turnTarget = 0, turnAngle = 0, turnSpeed = 0;
  let dragging = false, dragged = false, pointerStart = 0, pointerLast = 0, tappedPart = '', activePart = '';
  const emissive = new Map(), partTargets = [], diagnostics = new THREE.Group(), inspection = [];
  let reactorLight, eyeLight;
  const partNames = { helmet: 'Helmet', reactor: 'Arc reactor', shoulder: 'Shoulder assembly', gauntlet: 'Gauntlet' };
  const label = document.querySelector('#component-label');
  const wireMaterial = new THREE.LineBasicMaterial({ color: 0x75dfed, transparent: true, opacity: 0, depthWrite: false });
  const beamLineMaterial = new THREE.LineBasicMaterial({ color: 0x75dfed, transparent: true, opacity: 0, depthWrite: false });
  const worldPosition = new THREE.Vector3(), normal = new THREE.Vector3(), quaternion = new THREE.Quaternion();
  function layout(view) {
    if (view === 'home') {
      if (smallScreen()) return { x: 1.02, y: 1.58, z: 8.4, tx: -.10, ty: 1.88, tz: 0 };
      const distance = Math.max(7.65, 5 / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect * .89));
      return { x: distance * .39, y: 1.62, z: distance, tx: -.43, ty: 1.89, tz: 0 };
    }
    const display = workshop.displays[view];
    display.object.getWorldPosition(worldPosition);
    display.object.getWorldQuaternion(quaternion);
    normal.set(0, 0, 1).applyQuaternion(quaternion);
    const scale = display.station.scale.x;
    const tangent = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const fit = smallScreen() ? .89 : tabletScreen() ? .7 : .5;
    const distance = Math.max(display.width * scale / (2 * tangent * camera.aspect * fit), display.height * scale / (2 * tangent * .64), view === 'contact' && !smallScreen() ? 5 : 0);
    // Frame the hologram together with the desk and reactor beneath it.
    const drop = view !== 'contact' ? 0 : smallScreen() ? .45 : -.3;
    return { x: worldPosition.x + normal.x * distance, y: worldPosition.y + normal.y * distance - drop, z: worldPosition.z + normal.z * distance,
      tx: worldPosition.x, ty: worldPosition.y - drop, tz: worldPosition.z };
  }

  let compact = false;
  const tabletScreen = () => innerWidth <= 1100;
  function setLayout() {
    compact = width / height < 1.25; document.body.dataset.layout = compact ? 'compact' : 'wide';
    workshop.setViewport(width / height, smallScreen(), tabletScreen());
  }
  function resize() {
    if (failed) return;
    ({ width, height } = container.getBoundingClientRect());
    renderer.setSize(width, height); css.setSize(width, height); setLayout();
    camera.aspect = width / height; camera.updateProjectionMatrix();
    // Only the armor terminal moves on small screens; the contact hologram stays over the desk.
    terminal.station.scale.setScalar(smallScreen() ? .76 : 1);
    terminal.station.position.set(smallScreen() ? .75 : terminal.position[0], 0, smallScreen() ? 1.05 : terminal.position[2]);
    scene.updateMatrixWorld(true);
    if (busy) navigation?.kill();
    Object.assign(state, layout(currentView));
  }
  const observer = new ResizeObserver(resize); observer.observe(container); resize();
  const onMove = event => {
    if (event.pointerType === 'touch') return;
    pointer.x = event.clientX / innerWidth * 2 - 1; pointer.y = 1 - event.clientY / innerHeight * 2;
  };
  window.addEventListener('pointermove', onMove, { passive: true });
  const raycaster = new THREE.Raycaster(), pickPoint = new THREE.Vector2();
  function pick(event) {
    if (currentView !== 'home' || busy || failed) return '';
    const bounds = renderer.domElement.getBoundingClientRect();
    pickPoint.set((event.clientX - bounds.left) / bounds.width * 2 - 1, 1 - (event.clientY - bounds.top) / bounds.height * 2);
    raycaster.setFromCamera(pickPoint, camera);
    const hit = raycaster.intersectObjects([...pickTargets, ...partTargets].filter(object => object.visible && object.parent?.visible !== false), false)[0];
    return hit?.object.userData.route || '';
  }
  function setHover(name) {
    hover = name || '';
    for (const [route, display] of Object.entries(workshop.displays)) display.screen.element.classList.toggle('is-hover', route === hover);
  }
  function inspect(name) {
    activePart = partNames[name] ? name : '';
    label.textContent = partNames[activePart] || ''; label.hidden = !activePart || currentView !== 'home';
  }
  const onObjectMove = event => {
    if (dragging) {
      const delta = event.clientX - pointerLast; pointerLast = event.clientX;
      if (Math.abs(event.clientX - pointerStart) > 5) dragged = true;
      if (dragged) { turnTarget = limitTurn(turnTarget + delta * .008); inspect(''); onTurn?.(); }
      return;
    }
    const route = pick(event); setHover(route); inspect(route); workshop.setServiceHover(route === 'service'); workshop.setReactorHover(route === 'contact');
    renderer.domElement.style.cursor = route ? 'pointer' : 'grab';
  };
  const onObjectLeave = event => { if (!dragging) { setHover(''); workshop.setServiceHover(false); workshop.setReactorHover(false); inspect(event.pointerType === 'touch' ? tappedPart : ''); } };
  const onDown = event => {
    if (event.button !== 0 || currentView !== 'home' || busy || !rig) return;
    dragging = true; dragged = false; pointerStart = pointerLast = event.clientX;
    renderer.domElement.setPointerCapture(event.pointerId); renderer.domElement.style.cursor = 'grabbing';
  };
  const onUp = event => {
    if (!dragging) return; dragging = false;
    if (renderer.domElement.hasPointerCapture(event.pointerId)) renderer.domElement.releasePointerCapture(event.pointerId);
    renderer.domElement.style.cursor = 'grab';
    if (dragged || event.type === 'pointercancel') return;
    const route = pick(event);
    if (partNames[route]) { tappedPart = tappedPart === route ? '' : route; inspect(tappedPart); }
    else if (route === 'diagnostic') toggleDiagnostic();
    else if (route === 'service') runService();
    else if (route) onExplore?.(route);
    else { tappedPart = ''; inspect(''); }
  };
  const onKey = event => {
    if (currentView !== 'home') return;
    if (['ArrowLeft', 'ArrowRight', 'Home'].includes(event.key)) { event.preventDefault(); turnTarget = event.key === 'Home' ? 0 : limitTurn(turnTarget + (event.key === 'ArrowLeft' ? -.25 : .25)); onTurn?.(); }
    if (event.key.toLowerCase() === 'e') { event.preventDefault(); toggleDiagnostic(); }
  };
  renderer.domElement.addEventListener('pointermove', onObjectMove);
  renderer.domElement.addEventListener('pointerleave', onObjectLeave);
  renderer.domElement.addEventListener('pointerdown', onDown);
  renderer.domElement.addEventListener('pointerup', onUp);
  renderer.domElement.addEventListener('pointercancel', onUp);
  container.addEventListener('keydown', onKey);
  function runService() { if (currentView === 'home' && !busy && workshop.runService(reduce())) onService?.(); }
  function toggleDiagnostic(force) {
    if (!rig || currentView !== 'home') return;
    diagnosticTween?.kill(); diagnosticOpen = force ?? !diagnosticOpen; onDiagnostic?.(diagnosticOpen);
    if (reduce()) { diagnostic.amount = diagnosticOpen ? 1 : 0; return; }
    diagnosticTween = gsap.timeline();
    diagnosticTween.to(diagnostic, { amount: diagnosticOpen ? 1 : 0, duration: diagnosticOpen ? 1.15 : .85, ease: 'power2.inOut' });
    if (diagnosticOpen) diagnosticTween.to(diagnostic, { amount: 0, duration: 1.1, delay: 5, ease: 'power2.inOut', onStart() { diagnosticOpen = false; onDiagnostic?.(false); } });
  }
  function buildDiagnostics() {
    rig.group.add(diagnostics);
    const boxes = [
      [rig.head, [0,.19,0], [.25,.34,.24]], [rig.chest,[0,.16,0],[.54,.47,.31]],
      [rig.arms.left.shoulder,[0,-.12,0],[.24,.33,.24]], [rig.arms.right.shoulder,[0,-.12,0],[.24,.33,.24]],
      [rig.arms.left.elbow,[0,-.20,.04],[.17,.34,.18]], [rig.arms.right.elbow,[0,-.20,.04],[.17,.34,.18]],
    ];
    for (const [parent, position, size] of boxes) {
      const lines = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(...size)), wireMaterial); lines.position.fromArray(position); parent.add(lines);
    }
    for (const {joint, offset} of Object.values(rig.panelBones)) {
      const lines = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), offset.clone()]), beamLineMaterial); joint.parent.add(lines);
    }
    const definitions = [
      ['helmet',rig.head,[0,.20,.07],[.20,.23,.18]], ['reactor',rig.chest,[0,.20,.25],[.15,.16,.12]],
      ['shoulder',rig.arms.right.shoulder,[0,.015,.04],[.20,.18,.17]], ['gauntlet',rig.arms.left.elbow,[-.05,-.24,.13],[.15,.23,.14]],
    ];
    for (const [name,parent,position,size] of definitions) {
      const hit = new THREE.Mesh(new THREE.SphereGeometry(1,12,8),pickMaterial); hit.position.fromArray(position); hit.scale.fromArray(size); hit.userData.route=name; parent.add(hit); partTargets.push(hit);
      const material = new THREE.LineBasicMaterial({color:0x99f4fa,transparent:true,opacity:0,depthWrite:false});
      const outline = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(...size.map(v=>v*1.65))),material); outline.position.fromArray(position); parent.add(outline);
      const light = new THREE.PointLight(0x76e5f4,0,.7,2); light.position.fromArray(position); light.position.z += .12; parent.add(light);
      inspection.push({name,hit,outline,light,energy:0});
    }
    reactorLight = new THREE.PointLight(0x84e8ff,.45,1.3,2); reactorLight.position.set(0,.20,.32); rig.chest.add(reactorLight);
    eyeLight = new THREE.PointLight(0xb7f6ff,.1,.5,2); eyeLight.position.set(0,.20,.18); rig.head.add(eyeLight);
  }
  const draco = new DRACOLoader(); draco.setDecoderPath('/draco/');
  const loader = new GLTFLoader(); loader.setDRACOLoader(draco);
  async function load() {
    try {
      const gltf = await loader.loadAsync('/models/iron-man.glb');
      const model = gltf.scene;
      const bounds = new THREE.Box3().setFromObject(model, true);
      const size = bounds.getSize(new THREE.Vector3()), center = bounds.getCenter(new THREE.Vector3());
      const scale = 3.65 / size.y; model.scale.setScalar(scale);
      model.position.set(-center.x * scale, -bounds.min.y * scale, -center.z * scale);
      model.traverse(object => {
        if (!object.isMesh) return;
        for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
          if (material.emissiveMap && !emissive.has(material)) emissive.set(material, material.emissiveIntensity || 1);
          if ('envMapIntensity' in material) material.envMapIntensity = .8;
          if ('roughness' in material) { material.roughness = Math.max(material.roughness, .40); material.roughnessMap = null; }
        }
      });
      rig = articulateArmor(model); workshop.mountSuits(rig.group); workshop.suitMount.add(rig.group);
      rig.group.traverse(object => { if (object.isMesh) { object.castShadow = true; object.receiveShadow = true; } });
      buildDiagnostics(); updateRig(0, 0); scene.updateMatrixWorld(true);
      renderer.render(scene, camera); css.render(scene, camera);
      container.dataset.ready = 'true'; onReady();
    } catch (error) { failed = true; cancelAnimationFrame(frame); onError(error); }
  }
  load();
  function updateRig(time, idle) {
    if (!rig) return;
    const breath = Math.sin(time * 1.1) * idle;
    rig.explode(diagnostic.amount); rig.group.position.y = workshop.heroLift + diagnostic.amount * .16;
    // Weight rests on the straight left leg; the right knee releases forward.
    rig.legs.right.hip.rotation.x = -.105;
    rig.legs.right.knee.rotation.x = .21;
    rig.legs.right.ankle.rotation.x = -.105;
    rig.legs.right.hip.position.z = .025;
    rig.legs.right.hip.position.y = 1.642;
    rig.torso.rotation.y = -.055;
    rig.torso.rotation.z = -.022 + breath * .003;
    rig.chest.rotation.x = breath * .004;
    rig.head.rotation.set(-.025 + breath * .003, .18 + eased.x * .025 * idle, .018);
    rig.arms.left.shoulder.rotation.set(.01, 0, -.075 - breath * .004);
    rig.arms.left.elbow.rotation.z = -.11;
    rig.arms.left.wrist.rotation.set(.03, 0, .045);
    rig.arms.right.shoulder.rotation.set(-.085, 0, .095 + breath * .004);
    rig.arms.right.elbow.rotation.z = .28;
    rig.arms.right.wrist.rotation.set(.13, -.045, -.025);
  }
  function render(timestamp = 0) {
    if (hidden || failed) return;
    if (lowPower && timestamp - lastTime < 30) { frame = requestAnimationFrame(render); return; }
    const dt = Math.min((timestamp - lastTime) / 1000 || .016, .05); lastTime = timestamp;
    const idle = reduce() ? 0 : 1; activeTime += dt * idle;
    eased.x = THREE.MathUtils.damp(eased.x, pointer.x, 3, dt); eased.y = THREE.MathUtils.damp(eased.y, pointer.y, 3, dt);
    const parallax = currentView === 'home' && !smallScreen() ? idle : 0;
    const extra = currentView === 'home' ? diagnostic.amount : 0;
    camera.position.set(state.x + eased.x * .045 * parallax, state.y + eased.y * .025 * parallax + extra * .12, state.z + extra * (smallScreen() ? 2.1 : .7));
    camera.lookAt(state.tx, state.ty, state.tz); camera.updateMatrixWorld();
    const step = reduce() ? turnTarget - turnAngle : THREE.MathUtils.clamp((turnTarget - turnAngle) * 5 * dt, -.85 * dt, .85 * dt);
    turnAngle += step; turnSpeed = THREE.MathUtils.damp(turnSpeed, step / dt, 4, dt);
    workshop.turntable.rotation.y = turnAngle;
    updateRig(activeTime, idle); scene.updateMatrixWorld(true);
    workshop.update(activeTime, idle, 1, turnSpeed * idle, diagnostic.amount);
    key.intensity = 125 * 1; rim.intensity = 115 * 1; fill.intensity = .48 * 1;
    overhead.intensity = 3 * 1; scene.environmentIntensity = .32 * 1;
    scene.children.find(o => o.isHemisphereLight).intensity = .6 * 1;
    for (const [material, intensity] of emissive) material.emissiveIntensity = intensity * 1;
    if (reactorLight) { reactorLight.intensity = .45 * 1; eyeLight.intensity = .10 * 1; }
    wireMaterial.opacity = diagnostic.amount * .50; beamLineMaterial.opacity = diagnostic.amount * .33;
    for (const part of inspection) {
      part.energy = reduce() ? +(activePart === part.name) : THREE.MathUtils.damp(part.energy, +(activePart === part.name), 7, dt);
      part.outline.material.opacity = part.energy * .50; part.light.intensity = part.energy * .45;
      if (activePart === part.name) {
        part.hit.getWorldPosition(worldPosition); worldPosition.project(camera);
        label.style.left = `${THREE.MathUtils.clamp((worldPosition.x * .5 + .5) * width + 25, 20, width - 145)}px`;
        label.style.top = `${THREE.MathUtils.clamp((-.5 * worldPosition.y + .5) * height - 22, 105, height - 100)}px`;
      }
    }
    if (hover === 'service' && currentView === 'home') {
      workshop.serviceHit.getWorldPosition(worldPosition); worldPosition.project(camera);
      label.textContent = 'Service scan'; label.hidden = false;
      label.style.left = `${THREE.MathUtils.clamp((worldPosition.x * .5 + .5) * width + 22, 20, width - 145)}px`;
      label.style.top = `${THREE.MathUtils.clamp((-.5 * worldPosition.y + .5) * height - 40, 105, height - 100)}px`;
    }
    if (hover === 'contact' && currentView === 'home' && !compact) {
      workshop.contactHit.getWorldPosition(worldPosition); worldPosition.project(camera);
      label.textContent = 'Contact'; label.hidden = false;
      label.style.left = `${THREE.MathUtils.clamp((worldPosition.x * .5 + .5) * width + 22, 20, width - 145)}px`;
      label.style.top = `${THREE.MathUtils.clamp((-.5 * worldPosition.y + .5) * height - 40, 105, height - 100)}px`;
    }
    dust.position.y = Math.sin(activeTime * .12) * .08; dust.rotation.y = activeTime * .003;
    for (const [name, display] of Object.entries(workshop.displays)) {
      const desired = hover === name || currentView === name ? 1 : 0;
      display.energy = idle ? THREE.MathUtils.damp(display.energy, desired, 5, dt) : desired;
      display.light.intensity = ((display.rest ?? .6) + display.energy * 1.6) * 1;
      display.material.emissiveIntensity = .8 + display.energy * .65 + Math.sin(activeTime * 1.7) * .008 * idle;
    }
    scene.updateMatrixWorld(true);
    for (const hotspot of hotspots) {
      hotspot.anchor.getWorldPosition(hotspot.projected); hotspot.projected.project(camera);
      const emitter = hotspot.contact ? (compact ? hotspot.terminalEmitter : hotspot.deskEmitter) : hotspot.emitter;
      emitter.getWorldPosition(worldPosition); worldPosition.project(camera);
      const ex = (worldPosition.x*.5+.5)*width, ey = (-worldPosition.y*.5+.5)*height;
      // The label floats beside its emitter on one straight projection line.
      const side = hotspot.diagnostic ? -1 : 1, spread = smallScreen() ? 30 : 58;
      const x = THREE.MathUtils.clamp(ex + side * spread, 66, width - 66);
      const y = THREE.MathUtils.clamp(ey - 74 - (smallScreen() && hotspot.diagnostic ? 50 : 0), 120, height - 90);
      hotspot.element.style.left = `${x}px`; hotspot.element.style.top = `${y}px`;
      hotspot.tether.setAttribute('d', hotspot.contact && !compact ? '' : `M ${x} ${y + 1} L ${ex} ${ey}`);
    }
    renderer.render(scene, camera); css.render(scene, camera);
    frame = requestAnimationFrame(render);
  }
  function visibility() {
    hidden = document.hidden;
    if (hidden) cancelAnimationFrame(frame);
    else { lastTime = performance.now(); frame = requestAnimationFrame(render); }
  }
  document.addEventListener('visibilitychange', visibility);
  renderer.domElement.addEventListener('webglcontextlost', event => {
    event.preventDefault(); failed = true; cancelAnimationFrame(frame); onError(new Error('WebGL context lost'));
  });
  frame = requestAnimationFrame(render);
  function navigate(view) {
    if (diagnosticOpen || diagnostic.amount) toggleDiagnostic(false);
    currentView = view; inspect(''); hover = ''; navigation?.kill(); workshop.setContact(view === 'contact', reduce());
    turnTarget = 0;
    const destination = layout(view);
    if (reduce()) { Object.assign(state, destination); return Promise.resolve(); }
    const start = { ...state }, flight = { t: 0 }; busy = true;
    return new Promise(resolve => {
      const finish = () => { busy = false; resolve(); };
      navigation = gsap.to(flight, { t: 1, duration: 1.25, ease: 'power2.inOut', onUpdate() {
        for (const name of Object.keys(destination)) state[name] = THREE.MathUtils.lerp(start[name], destination[name], flight.t);
        state.y += Math.sin(flight.t * Math.PI) ** 2 * .10;
      }, onComplete: finish, onInterrupt: finish });
    });
  }
  const onMotionChange = () => { document.body.dataset.reducedMotion = String(reduce()); if (reduce()) { navigation?.kill(); diagnosticTween?.kill(); diagnostic.amount = diagnosticOpen ? 1 : 0; Object.assign(state, layout(currentView)); } };
  reducedMotion.addEventListener('change', onMotionChange);
  return { navigate, setHover, inspect, toggleDiagnostic, service: runService,
    dispose() {
    navigation?.kill(); diagnosticTween?.kill(); cancelAnimationFrame(frame); observer.disconnect();
    window.removeEventListener('pointermove', onMove); document.removeEventListener('visibilitychange', visibility);
    reducedMotion.removeEventListener('change', onMotionChange);
    scene.traverse(object => { if (object.geometry) object.geometry.dispose(); });
    renderer.domElement.removeEventListener('pointermove', onObjectMove); renderer.domElement.removeEventListener('pointerleave', onObjectLeave); renderer.domElement.removeEventListener('pointerdown', onDown); renderer.domElement.removeEventListener('pointerup', onUp); renderer.domElement.removeEventListener('pointercancel', onUp); container.removeEventListener('keydown', onKey); pickMaterial.dispose();
    environmentTarget.dispose(); workshop.reflection.getRenderTarget().dispose(); draco.dispose(); renderer.dispose();
  } };
}
