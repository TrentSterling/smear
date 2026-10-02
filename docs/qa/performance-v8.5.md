# V8.5 worker painting

V8.5 moves persistent brush rasterization off the gameplay thread. The original layered bristles, pigment, contact spacing, wet transfer, tick rate, drop cap and resolution remain intact. The offline HTML embeds its worker source; no runtime download or server is required.

## Firefox measurement

Firefox 157 on Windows, hardware WebGL, 3000 x 1800 canvas at pixel ratio 1. The paired workloads use 60 native animation frames of warmup followed by 240 native frames with two deterministic physics ticks each. Inspection, PNG encoding and GPU readbacks happen outside the timed loop. All five candidates retained the worker backend and drained completely.

| Workload | V8.4 mean main-thread work | V8.5 | Main work p95 before / after |
|---|---:|---:|---:|
| Crowded airborne drops (10 dummies) | 12.36 ms | 9.71 ms | 15.0 / 12.0 ms |
| Same scene, drop mesh hidden | 12.83 ms | 10.26 ms | 16.0 / 12.0 ms |
| Sustained pistol | 6.96 ms | 6.70 ms | 10.0 / 17.0 ms |
| Coated dummy dragged in air | 4.50 ms | 3.92 ms | 6.0 / 5.0 ms |
| Coated and wounded dummy scraped on floor | 14.69 ms | 5.04 ms | 23.0 / 7.0 ms |

Floor-drag main-thread paint/transfer fell from 9.03 ms to 0.50 ms. Total mean main-thread work fell from 14.69 ms to 5.04 ms. Floor-drag callback intervals were 16.67 ms mean, p95/p99 16.68 ms, versus 18.50 ms mean and p95/p99 33.34 ms before. This is one controlled capture, not a guarantee against scheduling or driver hitches. The pistol case retained isolated hitches and its tail did not uniformly improve.

The [exact paired receipt](v8.5/preservation-and-performance.json) passes 20 checks: simulation and wet transfer, droplets, instance matrices, and persistent surface PNGs match V8.4 exactly in all five workloads. CPU clocks, version, renderer caches and upload counters are excluded.

A separate accelerated Firefox worker experiment failed under substantial concurrent CPU/graphics load: driver-backed Canvas raster calls stalled, the bounded event queue filled, and the compatibility backend engaged. The final Gecko path keeps Canvas raster memory local to the worker, then transfers cropped ImageBitmaps to WebGL. Chromium uses its default accelerated worker Canvas path. The early failed experiment is not included in the release timing table. Machine load can affect all phases independently.

## Pipeline

The main thread maintains authoritative physics, wet grids, coat transfer and RNG consumption. It submits compact splat, contact-patch, drip, skin and bullet events. The worker expands the same bristles, rasterizes them in order into persistent OffscreenCanvases, and returns only changed rectangles as ImageBitmaps. Bitmap extraction preserves the source canvas; transferring the persistent canvas itself would erase prior pigment.

The existing WebGL renderer uploads those regions directly. Normal gameplay performs no pigment readback and no second main-thread raster copy. Canvas readbacks are restricted to explicit inspection and worker failure recovery. `await __smear.paintReady()` drains paint and refreshes inspection canvases; `paintReady(false)` drains without readback.

One batch may be in flight. Event storage is capped at 4096; unsupported workers and overload select the explicit synchronous compatibility backend. Clears and washes increment epochs so obsolete bitmaps cannot restore old pigment. Removed bodies release their worker records and texture resources. Received bitmaps are always closed, including obsolete results. Original source-row and Gecko bounded-copy upload paths remain available in `?paintSync=1`.

F3 and JSON exports report worker raster time, bitmap time, completion latency, oldest pending event age and pending event count separately from exclusive main-thread timings. These are CPU submission and bitmap-completion measurements, not GPU timer-query durations. Firefox's WebGPU adapter request returned null in the local probe; the release keeps its existing working WebGL renderer.

## Reproduce

Run one GPU workload at a time:

```text
node tools/particles-profile.mjs <v8.4-index.html> before firefox
node tools/particles-profile.mjs index.html after firefox
node tools/particles-compare.mjs tools/out/particles-before-firefox/summary.json tools/out/particles-after-firefox/summary.json
npm run verify
npm run verify:paint
node tools/paint-verify.mjs fallback
node tools/paint-verify.mjs firefox
npm run verify:worker
node tools/worker-verify.mjs firefox
npm run verify:particles
npm run verify:firefox
npm run verify:runtime
npm run profile:runtime
```

The lifecycle harness compares clears, body removal and washing during in-flight paint, forced worker failure after committed pigment, and queue overload against a synchronous reference. Both browsers passed all 25 checks, including an actual WebGL context loss and restoration with no prior CPU pigment readback. Final release receipts are stored alongside the paired capture.


## Release verification

- [Full gameplay](v8.5/gameplay.json): 20 checks, including preserved UTF-8 UI symbols.
- GPU pigment versus retained canvas: [Chrome worker](v8.5/paint-worker-chrome.json) and [Firefox worker](v8.5/paint-worker-firefox.json), 13 checks each; [synchronous compatibility](v8.5/paint-fallback.json), 12 checks.
- Worker lifecycle and recovery: [Chrome](v8.5/worker-chrome.json) and [Firefox](v8.5/worker-firefox.json), 25 checks each.
- [Particle collision preservation](v8.5/particle-collisions.json): four exact 180-body, overflow, ordering and fast-segment cases.
- [Native Firefox gameplay](v8.5/firefox-native.json): 11 checks; held Spill, pistol and drag all retain the worker backend.
- [Runtime profiler](v8.5/runtime.json): 20 checks.
- [Profiler overhead](v8.5/runtime-overhead.json): exact simulation equality with capture disabled, recording and the panel visible; rolling storage bounded after 1080 frames. The explicit profiler phase averaged 0.038 ms recording and 0.114 ms with the panel open. Total main-thread work averaged 11.10, 11.44 and 12.17 ms respectively in the ten-dummy Chaos scene.


## Public deployment

GitHub Pages serves V8.5 with the original UTF-8 symbols restored. HTTPS served the exact tested HTML, SHA-256 `28bab15276e9fcf9b999feacc12aaf5c7246e64d98098c7b403c972e4aa82e13`; [source receipt](v8.5/live-source.json).

The [public game and Games card receipt](v8.5/publish-live.json) passes all 14 checks, including the current version, native floor dragging, valid WebGL state, 1200 x 630 OG image and portfolio card at desktop and phone widths. [Public Firefox gameplay](v8.5/firefox-live.json) passes all 11 checks; Spill, sustained pistol and soaked dragging retain the worker backend. [Public F3 profiling](v8.5/runtime-live.json) passes all 20 checks, including native dragging, histogram, hitch capture, freezes, export and mobile containment.

The final UI encoding correction passed 22 retained-HUD pixel checks in each browser and adds a source encoding regression check to the gameplay harness.
