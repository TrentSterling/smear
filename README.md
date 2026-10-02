# SMEAR

A blood-and-contact ragdoll playground by Trent Sterling / Tront. Grab a dummy, slam it into the room, and drag it through persistent blood. Walls catch splashes and develop downward drips.

**V8 / 0.8.0** continues the DRAGMARK prototype under the name SMEAR.

## Run

Open `index.html` in desktop Chrome or Edge with hardware acceleration enabled. It is one offline HTML file with Three.js r140, procedural models, textures, audio, and custom rigid-body physics embedded. No install, build, server, or runtime downloads.

- Left mouse: grab, fire, or spill with the selected tool.
- Right drag: look. WASD: move. Shift: sprint. Space: jump. Ctrl: crouch.
- 1 / 2 / 3: Grab / Pistol / Spill.
- Wheel: push or pull a held body. Q / E: twist it.
- L / Esc: lock or free the mouse. F: toggle Walk / Fly.
- Tab: controls. T: slow motion. P: pause. H: hide the HUD.
- Controls or About: run the built-in smear demo.

Stains last for the session. Tuning saves in browser storage; V8 migrates available settings from `dragmark.tune.v7` into `smear.tune.v8` on the same browser origin.

## Files

- `index.html`: current SMEAR V8.
- `versions/dragmark_v7.html`: Trent's original V7, preserved byte for byte.
- `tools/verify.mjs`: Chrome runtime checks and a deterministic V7/V8 smear comparison.
- `docs/qa/`: recovery and verification receipts.

Run `npm run verify` with Node 22+ and Chrome installed. `CHROME` can override the executable path. Browser captures and JSON receipts go in `tools/out/`.

Three.js retains its embedded copyright and MIT license header. SMEAR's source includes the original procedural content and AI-assisted implementation from the DRAGMARK thread.
