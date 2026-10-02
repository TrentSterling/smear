# SMEAR

A blood-and-contact ragdoll playground by Trent Sterling / Tront. Grab a dummy, slam it into the room, and drag it through persistent blood. Walls catch splashes and develop downward drips.

**V8.2 / 0.8.2** continues the DRAGMARK prototype under the name SMEAR.

**Play:** https://tront.xyz/smear/ · **Source:** https://github.com/TrentSterling/smear

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
- `tools/verify.mjs`: Chrome runtime, reset, and spawn visibility checks.
- `tools/profile.mjs`: CPU profiles and frame distributions on the real GPU.
- `tools/og-shot.mjs`: repeatable 1200 x 630 social image rendered from the game.
- `og-image.png`: social sharing and portfolio card image.
- `docs/qa/`: recovery and verification receipts.

Painting performance and preservation receipts are in [V8.2 floor-drag notes](docs/qa/painting-v8.2.md). Use `npm run profile:paint` and `npm run verify:paint` for the focused workload.

Run `npm run verify` with Node 22+ and Chrome installed. `CHROME` can override the executable path. Browser captures and JSON receipts go in `tools/out/`.

`npm run serve` previews the game at `http://127.0.0.1:8198/`. `npm run profile` records the room, smear demo, and 10-dummy Chaos preset. `npm run og` regenerates the social image. See [PERFORMANCE.md](PERFORMANCE.md) for measurements and remaining costs.

GitHub Pages serves the repository root from `main`. `.nojekyll` keeps the HTML and image assets intact; the portfolio's custom domain supplies `tront.xyz/smear/`.

Three.js retains its embedded copyright and MIT license header; the full license is in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). SMEAR's source includes the original procedural content and AI-assisted implementation from the DRAGMARK thread.
