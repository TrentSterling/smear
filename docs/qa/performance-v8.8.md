# V8.8 worker throughput, pigment allocation and HUD costs

V8.8 addresses three measured Firefox/Zen costs: one paint worker falling behind, full blank pigment uploads during reset/clean, and full-screen HUD canvas clears. It retains original pigment resolution, bristles, wet transfer, particle count, 120 Hz simulation and solver passes. This release improves those paths but does not finish the performance goal.

The tested source SHA-256 is `9fed255eb070b9a03f4e4517340b7d6d715c827ff65721a7b4d0adadba384098`. All owned browsers have muted output while native sound settings remain enabled. GPU harnesses run sequentially; unrelated browsers and benchmarks remain running.

## Implementation and preservation

Gecko uses four CPU raster workers with fixed per-canvas affinity. Each worker has at most one 1024-event batch in flight; the global normal queue remains capped at 4096. Outstanding worker and queued events therefore fit within the 8192-event recovery cap. Failure replay restores global event order. Replies from terminated generations, old epochs and removed bodies are rejected. Chromium retains its single accelerated ImageBitmap worker. `?paintSingle=1` selects the one-worker reference.

Unpainted surfaces and skin shaders bind one transparent texture. First pigment presentation allocates the complete original-resolution texture; clear/wash detaches and disposes that GPU allocation. Unknown worker clears do not allocate empty canvases. The room uses 102 GPU textures instead of 153. The [actual scene comparison](v8.8/pigment-view-firefox.json) checks paint, smear, clear, wash, repaint and reset against frozen V8.7. Both Firefox and [Chromium](v8.8/pigment-view-chrome.json) match every rendered pixel exactly in all seven cases. GPU paint audits inspect the texture bound to the actual shader.

Static gameplay HUD backing canvases occupy top/footer strips of approximately 116 CSS pixels each. Panels retain the full overlay. Integral physical origins preserve fractional-DPR rendering, and short viewports retain original overlap order. Both [Firefox](v8.8/hud-firefox.json) and [Chromium](v8.8/hud-chrome.json) pass 28 comparisons against the original HUD, including fractional DPR and short viewports. The final native Firefox trace records no HUD clear taking 2 ms or more; earlier full-canvas clears took 8 to 14 ms.

## Native input captures

`npm run profile:cold` records real animation callbacks and pointer input at 3000 x 1800 with F3 open. It audits GL/Canvas calls and host CPU pressure across 24 logical CPUs. The baseline, intermediate and final receipts retain their own source fingerprints and raw frames. Intermediate captures are diagnostic evidence, not final-release timings.

| Firefox capture | Pistol FPS / CPU p99 | Drag FPS / CPU p99 | Chaos FPS / CPU p99 | Mean host CPU busy fraction |
|---|---:|---:|---:|---:|
| [V8.7 baseline](v8.8/cold-baseline.json) | 58.6 / 26 ms | 60.1 / 8 ms | 30.4 / 89 ms | 50% to 66% |
| [Four workers plus lazy pigment, before physical HUD strips](v8.8/cold-four-worker-lazy.json) | 59.8 / 7 ms | 60.1 / 8 ms | 56.7 / 26 ms | 41% to 45% |
| [Final V8.8, busy host](v8.8/cold-final-busy-host.json) | 59.8 / 10 ms | 51.8 / 50 ms | 50.4 / 34 ms | 81% to 95% |

These captures have different host loads and are not an isolated timing comparison. The final Firefox capture retains four workers throughout, without overload or fallback; maximum queued events are 1172 during dragging and 1618 during Chaos. Slow calls still include 19 to 21 ms texture uploads and a 16 ms draw call. Dragging reaches a 224 ms CPU frame. Shader links during first material use do not explain those stalls in the recorded audit. No stable 60 FPS or 8 ms bound under this host load is established.

The [final Chromium trace](v8.8/cold-chrome.json) averages 60.0 FPS for pistol with 3.07 ms mean CPU work. Dragging averages 54.0 FPS despite 2.82 ms mean CPU work; callback p99 reaches 79.5 ms. Chaos overloads the single worker and enters the legacy synchronous recovery path, reaching a 344.2 ms CPU frame. Its host CPU busy fraction is 56% to 70%. Bounded Chromium recovery is an outstanding implementation task. The local CPU profile is retained at `tools/out/cold-v88-release-chrome/runtime.cpuprofile`; it identifies synchronous pigment readback among the sampled costs.

## Forced starvation and fixed-work tests

The [forced starvation receipt](v8.8/forced-worker-starvation.json) delays worker messages by three seconds. Both versions actually reach the 4096-event queue cap and execute identical simulation ticks.

| Measurement | V8.6 | V8.8 |
|---|---:|---:|
| Mean main-thread work | 12.69 ms | 11.11 ms |
| Main-thread p99 | 19 ms | 27 ms |
| Worst main-thread frame | 481 ms | 37 ms |
| Worst callback interval | 489 ms | 76 ms |
| Mean host CPU busy fraction | 48.9% | 47.5% |

Normalized simulation/wet state and every surface/skin PNG match exactly. Independent hashes are retained in the receipt. V8.8 reaches the bounded 8192-event recovery cap, records a 7 ms maximum recovery task, restarts the four-worker pool once and drains completely. The long synchronous hitch is removed; p99 and callback tails are not uniformly improved in this capture.

The [six-workload paired comparison](v8.8/preservation-and-performance.json) passes 24 exact checks against the final V8.7 capture: simulation/wet transfer, droplet motion/lifetime, instance transforms and every persistent surface PNG with wet supply. It covers air particles, hidden-particle control, pistol, air drag, floor drag and Chaos. All six final captures retain four workers without recovery. Mean main-thread work ranges from 3.88 to 10.55 ms; Chaos CPU p99 is 17 ms and its mean physics/render costs are 4.31/3.10 ms. Fixed-work captures yield native frames but execute exactly two simulation ticks per frame, so they complement the native-loop captures rather than establish gameplay FPS for every load.

## Release verification

`npm run verify:release` reports `COMPLETE release checks passed (17 harnesses)` on this exact source. The [suite receipt](v8.8/release-harnesses.json) covers gameplay, pigment/GPU presentation, compatibility paint, worker lifecycle, particle ordering, HUD, detail instances, graphics restoration, native Firefox input and F3/overhead checks.

The [Firefox worker suite](v8.8/worker-firefox.json) passes 68 checks; the [Chromium suite](v8.8/worker-chrome.json) passes 55. New overload/graphics-loss cases first prove every configured worker is actually in flight, then compare every surface and skin atlas with the synchronous reference. Firefox recovery records zero GPU pigment readbacks. Premultiplied raster comparisons permit at most two channel levels across Canvas backends; the separate actual-scene and paired PNG tests above pass exactly.

Remaining work: remove Chromium's synchronous overload recovery, reduce Chaos physics/render main-thread costs, and investigate driver/callback stalls under desktop contention. Passing functional and preservation checks does not close these performance issues.
