# V8.2 floor-drag painting

Measured October 2, 2026 in headless Chrome at 1920 x 1080, on Trent's RTX 5070 Ti through ANGLE Direct3D 11. Each preset runs the same 600 rendered drag frames with two fixed physics ticks per frame after a 90-frame warmup. The torso presses into the floor along a fast repeated curve; all starting body faces are wet. Diagnostic state snapshots are excluded from the timed loop.

## Results

| Preset | Mean simulation + render work, V8.1 | V8.2 | Work p99, before | After | Canvas upload volume, before | After |
|---|---:|---:|---:|---:|---:|---:|
| Default | 6.34 ms | 4.24 ms | 11.5 ms | 7.4 ms | 1798.9 MiB | 703.7 MiB |
| Wet | 6.01 ms | 4.07 ms | 10.2 ms | 6.0 ms | 1763.3 MiB | 678.4 MiB |

Sampled `patchUV` CPU fell from 2054.3 to 1108.3 ms across the Default run (46%) and from 1965.8 to 1023.2 ms across Wet (48%). Canvas upload payload fell by about 61% in both presets. These count skin atlas uploads as well as surface pigment. Upload calls still cost about 0.4-0.5 ms per frame; the main CPU gain is in the bristle loop. The new upload path reduces payload and avoids intermediary canvas copies.

The maximum timed frame work fell from 55.7 to 9.6 ms in Default and 55.1 to 12.8 ms in Wet. No timed frame exceeded 25 ms after the change. Chrome frame presentation p99 was 16.8 ms, with no intervals over 25 ms in either final run. Presentation includes browser/GPU scheduling beyond the measured JavaScript work. GPU duration was not measured with timer queries. These are paired local runs at a 60 Hz presentation limit, not a guarantee for other hardware or machine load.

[Before receipt](v8.2/paint-before.json) and [after receipt](v8.2/paint-after.json). Raw CPU profiles are generated under `tools/out/paint-*/`.

## Changes

Deterministic bristle seeds, offsets, colors, and fringes are cached in a bounded map. The hot loop uses scalar points and numeric canvas opacity. It retains every bristle, stroke, gap, and spatter; opacity is restored before subsequent patch layers.

Surface marks accumulate conservative dirty rectangles covering round caps, spatter, and the pixel aspect ratio of wall faces. Existing WebGL 2 paint textures receive direct subrectangle updates with correct flipped source rows, then source skip parameters are reset. New textures and clear operations retain complete uploads. WebGL 1 uses reusable, bounded crop canvases and the existing renderer copy API. The wet-supply channel and skin atlases retain their existing behavior.

## Verification

The [preservation receipt](v8.2/paint-preservation.json) confirms exact Default and Wet simulation states compared to V8.1, excluding renderer caches, CPU/frame clocks, and upload counters. Body motion, seeds, contacts, injuries, supply, transfer, and smear statistics match. Mean reference-image channel delta is below 0.02 on a 0-255 scale; maximum delta is 9. Those small rounding differences result from applying numeric opacity instead of parsing it into the source color.

GPU pixel audits cover smears across tile seams, wall flow, rotated faces, repainting, and complete clearing. [Direct upload receipt](v8.2/paint-pixels.json) and [fallback receipt](v8.2/paint-fallback-pixels.json) each contain nine passing checks, including WebGL state and browser errors. The fallback audit selects the compatibility upload branch on the same WebGL 2 device; it does not establish performance on a WebGL 1-only device.

The [full gameplay receipt](v8.2/gameplay.json) contains 19 passing checks, including an actual mouse press, drag, and release. The [demo](v8.2/demo.png), [mouse drag](v8.2/mouse-drag.png), and [wall spill](v8.2/wall.png) were visually inspected. Publishing verification repeats that interaction on the served game and checks the portfolio and its social image.

## Reproduce

With Node 22+, Git, Chrome, and the repository history available:

```text
node tools/paint-profile.mjs v8.1 baseline
node tools/paint-profile.mjs index.html final
node tools/paint-compare.mjs baseline final
npm run verify:paint
node tools/paint-verify.mjs fallback
npm run verify
```

The profiler creates an instrumented HTML copy under `tools/out/` so the benchmark advances physics and rendering without a diagnostic state snapshot per frame. The shipped game's normal animation loop remains intact.
