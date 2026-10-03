# hanagumori — Armor systems

A compact interactive Iron Man workshop. The scene itself is the portfolio: a powered service platform, articulated armor, one maintenance arm, component inspection, and an exploded diagnostic presentation. Contact is the only navigation destination. There are no project cards or case studies.

## Run

Requires Node.js 20.19+ or 22.12+.

```sh
npm install
npm run dev
```

Open the local address printed by Vite, normally http://127.0.0.1:5173.

## Experience

- No intro, boot sequence, loading indicator or reveal. A matching inline desktop/mobile hero frame paints with the page; it is replaced without animation only after the fully lit 3D scene has rendered. Asset download is still required before live interaction becomes available.
- The hero armor hangs about 14 cm above the service platform on a chain-hoist rig: shoulder collar, two lug chains, a spreader bar and an on-axis chain to the overhead crane rail. Drag with a mouse or finger to turn the platform, the suspended armor with its rig, and the mounted service arm. Turning is limited to about ±86° so the chains never wind up; the spreader twists and tilts slightly with turn speed.
- The left service desk has an amber button (click, or the hidden "Run service scan" button for keyboard users). A second articulated arm hung from the crane beam swings out, a soft cyan scan sweeps the armor, and the tool dock and diagnostic module light up, then everything returns to rest. The camera stays in its cinematic composition. Rotation accelerates gently and is limited to 0.85 radians/second; the arm responds to turn velocity.
- Hover or tap the helmet, reactor, shoulder or gauntlet for a restrained outline, local cyan light and part label.
- Exploded view on the physical terminal separates eight real armor groups: helmet, chest, both shoulder plates, both gauntlets and both thigh plates. The inner structure stays in place. After a five-second hold, the panels reassemble. Assemble or Back returns early.
- Contact is an arc-reactor device on the left service desk. Pressing it flies the camera to the desk, a ceiling projector hung from the crane beam lights up and a translucent cyan hologram with three full-row links assembles over the desk; × or Back returns. On portrait screens, where the desk is out of frame, a small reactor on the armor terminal takes over. Under the hero there is only Exploded view.
- Sound starts OFF on every load. Explicit opt-in creates a quiet local Web Audio hum, servo sounds and short interaction signals. There are no external audio requests. Audio and rendering suspend when the page is hidden.

## Accessibility and performance

- Tab reaches Contact, Exploded view, component inspection buttons, Back and sound.
- Focus the scene to use Left/Right to turn, Home to reset, and E for diagnostics. Escape returns from Contact/diagnostics.
- Reduced motion disables idle motion and contact assembly animation, and changes camera/diagnostics immediately. The exploded view remains static until manually assembled. Direct manipulation is still available.
- `?motion=reduce` enables the same static experience for verification.
- Low-power devices use a capped 30 fps render loop, 1× pixel ratio, smaller shadow/reflection buffers and fewer particles. `?quality=low` forces this path. Phone rendering also uses smaller buffers.
- If WebGL or the model fails, Contact remains usable with a Retry action.

## Files

- `src/scene.js`: camera, immediate fully lit scene, drag control, diagnostics, inspection and rendering.
- `src/rig.js`: rigid armor plates, closed joint details, weighted leg pose and reversible panel separation.
- `src/hall.js`: Hall of Armor. Three service bays with suspended suit clones (shared geometry, material variants, chain hoists, harnesses), the left-side crane beam with chains, hook and cable bundle, and wall depth. The black suit hangs in the first bay; the second bay holds an empty harness. Narrow viewports (aspect < 1.25) hide the hall and the left desk; the hero rig always stays.
- `src/workshop.js`: original turntable and service arm, overhead track and carriage, recessed maintenance bay, scanning light, cables, floor reflections and terminal.
- `public/hero-desktop.webp` and `public/hero-mobile.webp`: matching renderer exports, inlined in `index.html` for first paint. Refresh these when changing the hero composition.
- Terminal labels retain their existing handlers and are tethered to the physical emitter positions.
- `src/audio.js`: opt-in ambient synthesis.
- `src/main.js`: contact links, focus, navigation and controls.
- `src/config.js`: contact destinations.

## Production

```sh
npm run build
npm run preview
```

Deploy `dist/` to a static host supporting `.glb` and `.wasm`. No backend or API keys are needed. The main renderer bundle produces Vite’s advisory chunk-size warning. Model, fonts and decoder are all local.

## Model and attribution

Iron Man Mark 85, modeled by HarlowFX and published by LLIypuk:
https://sketchfab.com/3d-models/iron-man-mark-85-8da781aa74024366844c650d69

License: CC BY 4.0 — https://creativecommons.org/licenses/by/4.0/

Changes include geometry simplification, Draco compression, WebP textures, material adjustments, precise centering and articulation. In `src/rig.js`, connected armor plates are rigidly attached to bones. A closed inner frame connects the shoulders, elbows and wrists as the plates move. The service pose uses restrained articulated idle motion. Poses and camera paths live in `src/scene.js`.

The original model was reduced from 68.15 MB to 1.71 MB. Keep the public attribution page at `public/credits.html` when publishing.

Three.js: MIT. GSAP: Standard License. Manrope and Unbounded: SIL Open Font License. This is an independent fan-made project, unaffiliated with Marvel.
