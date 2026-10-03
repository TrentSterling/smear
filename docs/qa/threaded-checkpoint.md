# Threaded performance checkpoint

This is a stopping point on `perf/v8-10-runtime`, not a production release. The
live site remains V8.9. The generated threaded preview is separate from
`index.html`; no build, CDN or network resource is needed to play that preview.
The user requested a remote checkpoint followed by a halt and harness cleanup.

The coupled simulation runs in one worker and sends ordered paint commands to
four Firefox pigment workers. WebGL presentation, camera input, HUD and WebAudio
stay on the foreground thread. Original solver passes, 120 Hz tick rate,
bristles, contact spacing, pigment density, 900-drop cap and resolution remain.
This is worker threading; compute shaders have not been implemented.

The checkpoint adds canonical foreground and simulation-worker paint mirrors,
authoritative inspection state, serialized asynchronous gameplay commands,
correct reset/demo camera setup, grab input propagation and epoch rejection.
Awaited commands resolve after foreground state application. The synchronous
`trace` helper explicitly rejects in the preview because its worker equivalent
is unfinished; use `await __smear.step(n)` for inspection.

## Verification at this checkpoint

- [Firefox coupled-kernel audit](v8.10-candidate/threaded-kernel-firefox.json):
  `COMPLETE coupled simulation worker checks passed (24 checks / 7200 ticks)`.
  Six paired scenarios retain exact simulation, every ordered paint command,
  every audio recipe, and all surface/skin PNGs within the original tolerance.
- [Firefox actual foreground/worker bridge](v8.10-candidate/threaded-bridge-firefox.json):
  `COMPLETE foreground/worker bridge checks passed (22 checks)`.
  Public APIs exercise Spill, skin paint, wounds, dragging, wash, clear, repaint,
  drying, add, Chaos, reset and demo. Gameplay state matches exactly, excluding
  clock timings, renderer accounting and paint-upload counts. Camera, resolution,
  caps and all foreground canonical surface/skin pigment are also checked.
- [Chrome bridge failure](v8.10-candidate/threaded-bridge-chrome-failure.json):
  retained rather than waived. A drag-scenario surface has one pixel above the
  existing two-level premultiplied tolerance (maximum 2.247). Earlier boundary
  failures remain recorded in the candidate performance notes.
- All changed JavaScript modules pass `node --check`; `git diff --check` passes.

The [final native Firefox capture](v8.10-candidate/threaded-checkpoint-native-firefox.json)
uses a 3000 by 1800 viewport and real input. Audio is enabled, unlocked and
running throughout, while the owned test browser's output is muted separately.
All browser/GPU harnesses ran sequentially.

| Workload | FPS | Simulation ticks/sec | Foreground mean | Foreground p99 / max |
|---|---:|---:|---:|---:|
| Spill | 57.33 | 120.00 | 2.67 ms | 32 / 32 ms |
| Pistol | 60.00 | 119.85 | 2.97 ms | 5 / 7 ms |
| Soaked drag | 57.66 | 119.87 | 3.57 ms | 16 / 28 ms |
| Chaos | 60.00 | 119.74 | 5.14 ms | 8 / 10 ms |

No foreground paint replay or discarded simulation time occurs in this capture.
Peak outstanding pigment is 780 commands. Spill and drag still have hitches;
this does not establish an eight-millisecond ceiling or consistent smoothness.
Earlier worse Chaos traces are retained. Headless hardware WebGL results do not
establish accelerated Firefox Canvas2D or measure every Zen desktop condition.

## Resume and release work

Run `npm run preview:threaded` and open the printed generated HTML path locally.
Run `npm run verify:threaded`, then
`node tools/simulation-worker-verify.mjs pool firefox`, and
`npm run profile:threaded` sequentially. Chrome's strict bridge audit is
`node tools/simulation-runtime-verify.mjs` and currently fails as recorded.

Before deployment: repair Chromium pigment differences; verify actual bound
shader pixels; implement and prove worker failure and graphics-restoration
recovery; finish API/input integration; resolve foreground and scheduling tail
spikes; integrate the entry point; bump release labels together; run the full
17-harness release suite and public-site checks. Existing release harnesses must
exercise worker-owned behavior rather than the dormant foreground solver.

Compact evidence stays in `docs/qa/`. Generated `tools/out/` captures and owned
temporary browser profiles are disposable; verification recreates them. Harness
source files remain for repeatable tests. Pushing this branch does not deploy
GitHub Pages, which serves `main`.
