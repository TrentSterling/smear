# V8.9: retain shaders and bound paint presentation

Release source SHA-256: `998a9f8fff66f3dbe5897a8b428e5c09f57d2118dee0d2c922be088d104ba352`. The performance goal remains active. V8.9 is live at https://tront.xyz/smear/. The normal public URL serves the exact tested bytes.

Resets previously disposed the final skin/eye material references and evicted their compiled programs. Native Chromium audits found 30 to 38 ms waits in program/shader-info queries after reset and first pistol use. V8.9 owns one extra reference per compiled program (bounded to 64) and draws pistol/flash variants during loading without firing, consuming RNG or advancing physics. References clear on graphics loss. Both final native browser captures link zero programs after boot in Spill, pistol, dragging and Chaos.

Worker texture initialization retains the pinned Three.js r140 allocation/cache ownership but skips the initial copy of a blank canvas after immutable zeroed storage is allocated. Recovery after graphics loss restores canonical pigment explicitly. Normal worker presentation shares a two-millisecond deadline across workers, checked between records. An individual GL call can exceed this deadline. Applied records are removed from the outstanding command log, preventing duplicate pigment after failure midway through a worker reply.

Firefox/Zen retains its four-worker RGBA transport. Chromium retains its published single ImageBitmap worker. The new four-worker Chromium RGBA implementation is opt-in (`?paintRGBA=1`): its separate starvation comparison still finds nine pixels outside the existing two-level premultiplied tolerance. It is not the release default. See [candidate history and failed Chromium preservation evidence](performance-v8.9-candidate.md).

## Verification

All [17 sequential release harnesses](v8.9-release/release-harnesses.json) pass on this exact source. Both RGBA worker suites pass 79 lifecycle checks, including failure after exactly one record of a multi-record reply is presented. The [default Chromium transport](v8.9-release/worker-chrome-bitmap-partial.json) separately passes that partial-presentation failure case. No fidelity tolerance was widened.

The [six fixed-work Firefox workloads](v8.9-release/paired-firefox.json) also pass all 24 exact comparisons against V8.8: simulation/wet transfer, particle motion/lifetime, particle matrices and persistent pigment/wet supply. Both actual-scene pigment comparisons pass all seven cases with maximum rendered channel delta zero. Context restoration passes two native cycles in each browser and resumes the actual frame loop. Original V7 remains byte-identical (`4dfe17e606b18ce7471f176b4c2afa0229b2f32e60b5b88c2971ebc6a75bc41f`).

The [complete Firefox starvation test](v8.9-release/starvation-firefox.json) passes all original gates: both versions reach the 4096-event cap, exact normalized simulation/wet state, every surface PNG, every skin PNG, no browser errors, and a worst-frame reduction greater than threefold. Worst main-thread frame is 536 ms in V8.6 versus 30 ms in the release. Mean work is 14.12 versus 11.70 ms, while mean host CPU pressure is 71% versus 63%; this is not an isolated estimate of the code's average speedup. Recovery remains bounded to 8192 pending events and restarts four workers once.

The starvation fixture now extends its capture window to 120 seconds, preserving all 419 frame intervals if host pressure stretches the run beyond 15 seconds. Production F3 retains its existing 15-second window. Earlier truncated captures were not accepted as timing passes.

## Native profiling and remaining limits

The final [Chromium](v8.9-release/native-chrome.json) and [Firefox](v8.9-release/native-firefox.json) traces use native input at 3000 x 1800 with F3 open. Each stage explicitly checks `soundOn === true` and a running AudioContext, with master gain approximately 0.48. Browser output is muted independently, so synthesis stays exercised without audible tests.

These final captures encounter 95% to 100% host CPU pressure. Shader recompilation remains absent, but other hitches remain. Final Chromium pistol is 59.95 FPS with 2.60 ms mean work; dragging is 54.94 FPS with 2.62 ms mean work and 6.4 ms maximum, showing substantial callback delays outside measured game work. Chromium Chaos eventually falls back after its existing 4096-event worker cap and peaks at 99.5 ms frame work. Final Firefox Chaos under 99.5% host pressure averages 10.95 FPS, falls back to cooperative recovery and peaks at 219 ms. These results are retained, not discarded.

An earlier Firefox capture with the same shader/initialization/presentation implementation, before the Chromium default was restricted, has approximately 26% to 31% host pressure: Spill 59.86 FPS, pistol 60.04, coated drag 60.02 and Chaos 59.49. Maximum Chaos prep falls from 27 ms before the presentation deadline to 4 ms after it; maximum total work falls from 36 to 20 ms. Those are native captures with different timing, not a deterministic paired speedup. Their exact source fingerprints are in [candidate evidence](performance-v8.9-candidate.md).

Remaining work: heavy-host worker backpressure, main-thread catch-up physics, driver/scheduling stalls and the experimental Chromium RGBA preservation gate. This release does not establish an eight-millisecond bound for every frame or finish the broader performance objective.

## Public deployment

GitHub Pages built code commit `2677c26f68cb169c58401959ec1226cf531d3689` at 2026-10-03 02:37:43 UTC. The [public source receipt](v8.9-release/public-source.json) asserts byte equality with the release file. All 45 public checks pass: [14 game/card/OG checks](v8.9-release/public-game-card-og.json), [11 Firefox gameplay checks](v8.9-release/public-firefox.json), and [20 live profiler checks](v8.9-release/public-runtime.json).

Live Firefox at 3000 x 1800 records Spill 58.14 FPS (4.20 ms mean work), pistol 60.17 FPS (4.66 ms mean, 7 ms CPU p99, 8 ms maximum), and coated dragging 60.02 FPS (4.36 ms mean, 9 ms p99/maximum). Worker painting remains active for all three. These are individual native captures, not guarantees for all scenes or host loads. The broader performance objective remains open.
