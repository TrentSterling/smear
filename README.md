# SMEAR

A blood-and-contact ragdoll playground by Trent Sterling / Tront. Grab a dummy, slam it into the room, and drag it through persistent blood. Walls catch splashes and develop downward drips.

**V8.7 / 0.8.7** continues the DRAGMARK prototype under the name SMEAR.

**Play:** https://tront.xyz/smear/ · **Source:** https://github.com/TrentSterling/smear

## Run

Open `index.html` in desktop Firefox, Zen, Chrome, or Edge with hardware acceleration enabled. It is one offline HTML file with Three.js r140, procedural models, textures, audio, and custom rigid-body physics embedded. No install, build, server, or runtime downloads.

- Left mouse: grab, fire, or spill with the selected tool.
- Right drag: look. WASD: move. Shift: sprint. Space: jump. Ctrl: crouch.
- 1 / 2 / 3: Grab / Pistol / Spill.
- Wheel: push or pull a held body. Q / E: twist it.
- L / Esc: lock or free the mouse. F: toggle Walk / Fly.
- Tab: controls. T: slow motion. P: pause. H: hide the HUD.
- F3 / Perf: live FPS histogram, frame history, CPU/GPU timings, and spike capture.
- Controls or About: run the built-in smear demo.

Stains last for the session. Tuning saves in browser storage; V8 migrates available settings from `dragmark.tune.v7` into `smear.tune.v8` on the same browser origin.

V8.7 transfers cropped RGBA buffers from the paint worker on Firefox/Zen. If that worker stalls, recovery replays bounded chunks from retained CPU pigment without GPU readback, uploads only changed pixels, and restarts the worker once. A forced-stall comparison reduced the worst main-thread frame from 453 ms to 21 ms while preserving exact simulation and every surface and skin PNG. Native Firefox pistol and drag captures average 60 FPS; ten-dummy Chaos still has slower tail frames. See [V8.7 measurements and limits](docs/qa/performance-v8.7.md).

V8.6 retains pistol tracer programs, uses dynamic collision broad phases and GPU-instanced ragdoll details, and separates animated HUD elements into small canvases. It also resumes automatically after graphics-context restoration. See [V8.6 measurements and verification](docs/qa/performance-v8.6.md).

V8.5 moves brush rasterization into an embedded OffscreenCanvas worker and transfers only changed regions to WebGL as ImageBitmaps. Gameplay sends contact events; the worker expands the original bristles. Persistent pigment stays off the main thread during play, while wet transfer and physics remain deterministic. The synchronous backend handles unsupported browsers and bounded worker overload. See [worker painting measurements and verification](docs/qa/performance-v8.5.md). The [V8.4 fixes](docs/qa/performance-v8.4.md) include floor Spill, particle pooling, collision caching, and retained HUD drawing.

## Live runtime profiling

Use **Perf** or **F3** while playing. A small FPS badge remains visible with the panel closed, and telemetry records in the background. The panel shows the last 15 seconds: raw FPS distribution, callback-entry frame intervals, p50/p95/p99, and exclusive CPU phases for physics, paint/transfer, droplets, upload preparation, rendering, HUD, and profiler overhead. Exports also retain browser rAF timestamp intervals and callback scheduling delay. GPU timing uses asynchronous WebGL 2 timer queries when available.

The spike log retains the latest 64 hitches with simulation ticks, workload, camera, uploads, and drag context. Browser long tasks and long animation frames are retained where supported. **Freeze capture** keeps the history while gameplay continues; **Export JSON** downloads raw frames, spikes, events, and environment details. Choose a 60/120/144/240 FPS budget to adjust the spike threshold. `?perf=1` opens the panel on load. Hidden-tab gaps are excluded.

Upload-call CPU overlaps prep/render. GPU time and rAF intervals measure different things from main-thread work. Worker raster time, transfer preparation, paint latency, and pending events are reported separately; they are not extra exclusive main-thread phases. Recovery details include pending events, last and maximum task duration, worker restarts, and retained CPU pigment bytes. Recovery tasks scheduled outside rAF can affect callback intervals without belonging to the preceding frame's exclusive phases. See [runtime profiling notes](docs/qa/runtime-v8.3.md) for measurement boundaries and verification. `window.__smear.perf.report()` returns the same capture from the console. For inspection, `await window.__smear.paintReady()` drains pending paint and refreshes retained canvases; `paintStatus()` identifies the active backend. `?paintSync=1` selects the compatibility backend; `?paintBitmap=1` selects the earlier Firefox transport for comparison.

## Files

- `index.html`: current SMEAR V8.
- `versions/dragmark_v7.html`: Trent's original V7, preserved byte for byte.
- `tools/verify.mjs`: Chrome runtime, reset, and spawn visibility checks.
- `tools/firefox-verify.mjs`: native Firefox Spill, held pistol and floor drag checks.
- `tools/particles-profile.mjs`: fixed-work Firefox/Chrome particle and paint benchmarks.
- `tools/particles-compare.mjs`: exact motion, transforms, pigment and supply comparison.
- `tools/worker-verify.mjs`: worker clear/wash/removal races, failure recovery and bounded overload against synchronous pigment.
- `tools/recovery-profile.mjs`: forced worker starvation compared with V8.6, including exact simulation, surface pigment and skin pigment checks.
- `tools/hud-verify.mjs`: retained HUD versus complete redraw pixel checks.
- `tools/profile.mjs`: CPU profiles and frame distributions on the real GPU.
- `tools/runtime-verify.mjs`: live profiler, native drag, hitch, export and UI checks.
- `tools/runtime-profile.mjs`: fixed-work instrumentation overhead and state comparison.
- `tools/og-shot.mjs`: repeatable 1200 x 630 social image rendered from the game.
- `og-image.png`: social sharing and portfolio card image.
- `docs/qa/`: recovery and verification receipts.

Painting performance and preservation receipts are in [V8.2 floor-drag notes](docs/qa/painting-v8.2.md). Use `npm run profile:paint` and `npm run verify:paint` for the focused workload.

Run `npm run verify` with Node 22+ and Chrome installed. `CHROME` can override the executable path. `npm run verify:firefox` uses its own Firefox profile and browser process; `FIREFOX` can override that executable. Browser captures and JSON receipts go in `tools/out/`.

`npm run serve` previews the game at `http://127.0.0.1:8198/`. `npm run profile` records the room, smear demo, and 10-dummy Chaos preset. `npm run og` regenerates the social image. See [PERFORMANCE.md](PERFORMANCE.md) for measurements and remaining costs.

GitHub Pages serves the repository root from `main`. `.nojekyll` keeps the HTML and image assets intact; the portfolio's custom domain supplies `tront.xyz/smear/`.

Three.js retains its embedded copyright and MIT license header; the full license is in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). SMEAR's source includes the original procedural content and AI-assisted implementation from the DRAGMARK thread.
