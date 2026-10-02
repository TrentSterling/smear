# Performance

V8.5 removes brush expansion and rasterization from the gameplay thread. An embedded worker owns persistent paint, sends cropped ImageBitmaps to WebGL, and reports its costs and backlog separately in F3. Main-thread paint no longer performs Canvas strokes or pigment readbacks during gameplay. See [worker painting measurements and verification](docs/qa/performance-v8.5.md). The earlier particle, upload, HUD, and floor Spill changes are documented in [V8.4](docs/qa/performance-v8.4.md).

V8.3 adds a live runtime profiler. Open **F3 / Perf** in the game and export a capture immediately after a hitch. See [runtime profiling and verification](docs/qa/runtime-v8.3.md). It preserves raw frame gaps, records CPU phases and workload, and samples GPU render/upload duration asynchronously when the extension is available.

Earlier Canvas painting measurements: [V8.2 floor-drag profiling and verification](docs/qa/painting-v8.2.md).

Measured October 1, 2026 in Chrome, headless, WebGL 2 through ANGLE Direct3D 11 on Trent's RTX 5070 Ti. Viewport: 1920 x 1080. CPU profiles use 1 ms samples; frames use `requestAnimationFrame` timestamps. These are paired local measurements with Chrome's 60 Hz presentation limit.

## Collision optimization in the same arena

The original V8 arena was profiled before and after the collision changes. Body simulation, blood transfer, and surface supply matched V7 exactly in a separate deterministic check before the arena was rearranged.

| Scenario | Sampled physics CPU per frame, before | After | Frame p99, before | After |
|---|---:|---:|---:|---:|
| Starting room, 3 dummies, 8 s | 0.98 ms | 0.59 ms | 16.8 ms | 16.8 ms |
| Smear demo, 3 dummies, 14 s | 2.18 ms | 1.65 ms | 16.8 ms | 16.8 ms |
| Chaos, 10 dummies, 10 s | 5.96 ms | 4.71 ms | 33.3 ms | 16.8 ms |

Chaos had six frames over 25 ms before and zero in the optimized run. Its sampled physics CPU per frame dropped about 21%. This is one paired run per scenario; the tail-frame counts will vary with machine load. Raw sampled profiles and captures are generated under `tools/out/profile-*/`.

## Fixed

`solveWorld` repeatedly calculated each static box's diagonal and sent distant samples through quaternion transforms. Static world-axis extents are now cached once and used on all three axes. `sphereBox` rejects misses using squared distance. Droplet segments are rejected against the same cached bounds before the exact ray test. Contact order, tick rate, solver passes, and painting behavior were preserved in the focused comparison.

The arena layout now keeps the initial sightlines and drag area clear. Wet-cell timestamps and flow clocks also reset with clean surfaces, fixing history-dependent wet pickup after a reset.

## Remaining measured costs

In the optimized Chaos run, rendering occupied about 2.3 ms of sampled main-thread time per frame; `updateBlood` about 1.2 ms, body-pair collision work about 0.6 ms, and texture upload work about 0.5 ms. These samples are nested, so they should not be added together.

- V8.5 runs the original layered brush rasterization in the paint worker. Wet supply and contact physics stay authoritative on the main thread. Worker event queues and paint latency remain visible when a machine is overloaded.
- Body-pair work becomes more relevant toward the twelve-dummy limit. Its all-pairs scan remains in this release.
- GPU duration was not measured with timer queries. The adapter was verified, and observed frame presentation and main-thread CPU costs are recorded separately.

The final rearranged release has a separate [runtime profile receipt](docs/qa/profile-release.json). Baseline and optimized receipts are [before](docs/qa/profile-before.json) and [after](docs/qa/profile-optimized.json). Spawn captures and publishing checks are documented in [release verification](docs/qa/release-v8.1.md).
