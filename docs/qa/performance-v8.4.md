# V8.4 Firefox performance and Spill

V8.4 fixes the floor Spill exception and reduces recurring frame costs in Firefox, the browser used in Trent's captures. Zen takes the same Gecko upload path. The offline game, 900-drop cap, shader, droplet geometry, 120 Hz physics, solver passes, bristles and stain resolution remain intact.

## Measured results

Firefox 157, headless, Windows, hardware WebGL through ANGLE D3D11. Viewport and canvas: 3000 x 1800, pixel ratio 1. Firefox masks the adapter string, so its reported GTX 980 name is not an identification of the physical card. Chrome separately reports this machine's RTX 5070 Ti. Firefox does not expose GPU timer queries here; these results measure main-thread frame work and browser frame presentation separately.

Each workload uses 60 warmup frames, then 240 native rAF frames with two fixed physics ticks per frame. Pistol shots and grab targets follow deterministic schedules. The crowded air case has ten dummies and approximately 711 drops per tick, continually replenished up to 900. The floor case scrapes a fully coated and wounded dummy through a repeated curve. State snapshots, PNG encoding and GPU pixel readbacks occur outside the timed loop.

| Workload | Mean frame work, V8.3 | V8.4 across three captures |
|---|---:|---:|
| Crowded airborne drops | 17.30 ms | 11.86 to 13.07 ms |
| Same air scene, droplet mesh hidden | 18.11 ms | 12.56 to 12.58 ms |
| Sustained pistol | 10.45 ms | 6.73 to 7.80 ms |
| Coated dummy dragged in the air | 7.35 ms | 4.43 to 5.52 ms |
| Coated dummy scraped across the floor | 17.08 ms | 14.00 to 14.59 ms |

[Paired exact comparison](v8.4/preservation-and-performance.json), [repeat captures](v8.4/repeat-profiles.json). The last capture uses the exact LF-normalized release source. Raw frame captures and all surface PNGs remain reproducible under `tools/out/particles-*/`.

Crowded droplet update work fell from approximately 2.95 to 1.22 ms per rendered frame. In a separate upload-only branch comparison, the old Firefox source-row path cost 4.39 ms of upload preparation versus 1.35 ms for reusable bounded source canvases. Hiding the particle mesh did not remove those CPU costs.

The normal animation loop was also exercised with actual Firefox mouse presses, held pistol fire, cursor movement and release at this resolution. [Native input receipt](v8.4/firefox-native.json), [floor Spill](v8.4/firefox-spill.png), [drag](v8.4/firefox-drag.png). That test checks the empty floor pixel before and after Spill so painting a dummy cannot satisfy the floor regression check.

Mean costs improved, but tail intervals did not uniformly improve in every capture. Repeat runs retain isolated 40 to 80 ms samples, including time in rendering, uploads and HUD drawing. Heavy floor brushing still consumes approximately 8.4 to 9.0 ms per two-tick frame in the fixed workload and can drop below 60 FPS. This release does not claim that every hitch has been eliminated. The live histogram, exclusive phase history and exports remain available to identify the next actual bottleneck.

## Changes

Firefox uses bounded, reusable crop canvases instead of selecting source rows directly from a large DOM canvas. Chromium keeps the direct WebGL 2 path. Both paths share initialization and complete-clear behavior.

Body paint atlases now accumulate pixel bounds and use the same upload helper. Washing invalidates and uploads the entire atlas. Tiny bullet marks invalidate their actual pixel footprint, converted back into surface coordinates, instead of an entire paint tile. Preparation timing now includes body synchronization and atlas uploads so their cost is attributed explicitly.

Droplets reuse a pool of at most 900 objects and reusable collision scratch vectors. Compound sample centers are calculated at most once per body per droplet tick. Rooms with more than 60 bodies use a bounded center grid; overflow bodies are still tested. Candidate order and exact sphere tests preserve the original nearest-hit and tie behavior. Particle instance uploads cover the active prefix and skip unchanged or empty draws.

The HUD keeps its pixels while its visible content and hover states agree. Aim, recoil, hit markers, hints, buttons, panels, tuning, modes and resizing invalidate it when needed. Pixel comparison uses one stable raster backend; native gameplay verification separately uses each browser's default HUD context.

Floor Spill now routes the raw floor tile through the shared floor receiver. The receiver also routes wet supply across tile boundaries. Walls and props retain their surface receivers.

## Verification

All of these completed successfully:

- [Full gameplay](v8.4/gameplay.json): 19 checks, including reset determinism, native dragging, spawn visibility, storage and original V7 hash.
- [Firefox native gameplay](v8.4/firefox-native.json): 10 checks, including actual floor Spill, held pistol, dragging, particle clearing and reset.
- GPU pigment versus retained canvas: 12 checks each for [direct uploads](v8.4/paint-direct.json), [compatibility copies](v8.4/paint-fallback.json) and [Firefox](v8.4/paint-firefox.json). Includes floor seams, bullet edges, body atlases, wall flow, washing and complete clearing. Zero mismatches outside the two-channel-value GPU rounding tolerance.
- [Exact paired preservation](v8.4/preservation-and-performance.json): 20 checks. All five cases match V8.3 simulation, droplets, matrices, PNGs and wet supply exactly, excluding version, renderer caches, CPU clocks and upload counters.
- [Focused particle collision cases](v8.4/particle-collisions.json): exact original results at the 180-body limit, outside-grid bodies, equal-distance hits and fast segments. Live plus pooled objects remain capped at 900.
- Retained HUD versus full redraw: 22 checks each in [Chrome](v8.4/hud-chrome.json) and [Firefox](v8.4/hud-firefox.json), with zero differing channels on the stable comparison backend.
- [Live profiler](v8.4/runtime.json): 20 checks, including a real injected stall, raw intervals, freezes, exports, native dragging, mobile containment and missing GPU timers.
- [Profiler overhead](v8.4/runtime-overhead.json): fixed-work state equality with capture off, capture on and panel visible, plus bounded storage after a long session. Mean frame work was 8.26 ms with capture disabled, 8.66 ms recording and 8.78 ms with the panel open. The explicitly measured profiler phase was approximately 0.02 ms recording and 0.09 to 0.12 ms with the panel visible; other capture work is included in total frame work.

## Reproduce

Run one GPU browser workload at a time:

```text
node tools/particles-profile.mjs v8.3 before firefox
node tools/particles-profile.mjs index.html after firefox
node tools/particles-compare.mjs tools/out/particles-before-firefox/summary.json tools/out/particles-after-firefox/summary.json
node tools/particles-verify.mjs
node tools/paint-verify.mjs firefox
npm run verify:paint
node tools/paint-verify.mjs fallback
npm run verify:firefox
node tools/hud-verify.mjs
node tools/hud-verify.mjs firefox
npm run verify
npm run verify:runtime
npm run profile:runtime
```

Each browser harness launches and terminates only its own dedicated browser process and profile. `CHROME` and `FIREFOX` override their executable paths.
