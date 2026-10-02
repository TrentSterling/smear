# V8.6 pistol, collisions and rendering

Pistol tracers used to dispose their only material after each shot. This evicted the shader program: the native Firefox capture recorded 45 program links during sustained firing. V8.6 pools the tracer geometry/material and warms it during loading. Sustained firing then recorded zero program links. Recoil, hit markers, hover labels and the FPS badge now draw into small canvases instead of clearing and repainting a 3000 x 1800 HUD.

The articulated solver retains its 120 Hz tick rate, nine passes and original ordered body-pair sweep. A dynamic center grid updates immediately after every pair correction. When the current body crosses a cell boundary, newly reachable later-index bodies join the remaining sweep. An overflow list handles bodies outside the grid. Static boxes use a separate conservative sample grid with the original box order. Neither grid changes the compound collision tests or solver arithmetic. The rotation-cap guard avoids unnecessary `Math.hypot` calls well below the cap, and retains the original clamp near the threshold. Step damping values and floor-contact keys are reused.

Unpainted sphere details (eyes, fingers, identifying anatomy and joint covers) render in three bounded instance groups. Picking and physics retain the original hierarchy. Skin painting, body geometry, shadows, pixel ratio, 900-drop cap, pigment resolution, bristle count and contact spacing remain intact. `?detailMeshes=1` renders the individual detail meshes for comparison.

Graphics-context restoration now recreates the procedural environment, preserves worker pigment, discards invalid GPU timer queries and resumes one animation chain. The previous game listener stopped the frame loop permanently even though the paint pipeline could restore its textures.

## Measurements and limits

Firefox on Windows, hardware WebGL, 3000 x 1800 at pixel ratio 1. Native input drives the game; F3 remains open. The following implementation capture predates only the release-label bump and the final conservative scalar guards. Both source fingerprints are retained in the receipts.

| Native workload | V8.5 mean CPU work | Optimized implementation | CPU p99 before / after |
|---|---:|---:|---:|
| Sustained pistol | 6.70 ms | 4.56 ms | 17 / 7 ms |
| Coated dummy dragged on the floor | 4.76 ms | 4.14 ms | 7 / 6 ms |
| Ten-dummy Chaos, early active window | 17.40 ms | 12.16 ms | 26 / 22 ms |

Pistol and drag averaged 60 FPS in that capture, with p99 callback intervals of 18 ms. Chaos improved from 45 to 56 FPS, with physics falling from 9.46 to 4.91 ms per frame. Chaos still has less headroom than the ordinary three-dummy scene. The [baseline](v8.6/native-baseline.json) and [implementation capture](v8.6/native-grid-native.json) include shader calls, CPU stages, intervals and worker backlog.

Detail rendering independently reduced submitted draws from 236 to 155 in the room, 486 to 256 in Chaos, and 558 to 281 with twelve dummies. The [Firefox](v8.6/details-firefox.json) and [Chrome](v8.6/details-chrome.json) receipts check exact Float32 transforms, materials and shadow flags. Render differences affect fewer than 0.002% of pixels by more than five channel levels; mean RGB error stays below 0.0004 levels. This accounts for matrix precision at raster edges rather than declaring the images byte-identical.

The desktop was concurrently running Boxel benchmarks during final captures. Process samples measured 12 to 19 CPU-seconds of Boxel work in one wall-clock second. A [subsequent capture](v8.6/native-host-pressure.json) records 98 to 100% mean CPU use across all 24 logical CPUs during boot and first firing. Phase timings use elapsed main-thread time, so preemption inflates them under saturation. The [busy-machine capture](v8.6/native-final.json) is retained, including its bad tails; it is not a clean before/after speed comparison. Shader eviction remains fixed, but unrelated scheduling and GPU-driver stalls still occur under this load.

The final [six-workload preservation receipt](v8.6/preservation-and-performance.json) passes 24 exact checks against V8.5, including simulation, wet transfer, droplets, matrices and every persistent surface PNG. Its timings were also affected by that load. In the floor case the worker queue reached its bounded 4096-event limit and correctly preserved all pigment through fallback, but reconstruction produced a 1929 ms main-thread frame. This remains a performance limitation during severe worker starvation; the capture does not establish an 8 ms bound for every path or sustained 60 FPS under desktop saturation.

## Verification

The [release suite](v8.6/release-harnesses.json) passes all 15 harnesses. [Physics preservation](v8.6/physics-firefox.json) compares 7200 ticks across six scenarios: room, Chaos, crowded twelve-dummy pile, grid-boundary crossings, out-of-grid collisions and recovery. Snapshots compare positions, quaternions, velocities, contact forces, droplets, surface pigment and skin atlases exactly.

Both HUD harnesses pass 26 retained/composited redraw comparisons against the frozen V8.5 renderer, including hover clamping, subpixel movement, recoil, panels, hide/show and resize. The native context harness forces two losses, verifies every surface and skin PNG, verifies resumed physics and rendering, and asserts that exactly one animation callback remains outstanding. The context-loss interval is excluded from live history; an overloaded machine is still allowed to report real scheduling hitches.

Other release checks cover gameplay/UTF-8/V7 preservation, GPU pigment in both browsers, synchronous compatibility, worker lifecycle/failure/overload, particle collision order, native Firefox Spill/pistol/drag, live F3/export and bounded profiler storage. Own-browser tests exercise sound code while muting output: Chrome uses `--mute-audio`; Firefox also inserts a silent gain at its audio destination. Gameplay audio settings stay enabled during native-input verification.

Reproduce with `npm run verify:release`, `node tools/physics-verify.mjs firefox`, `node tools/details-verify.mjs firefox`, and `node tools/particles-profile.mjs index.html <label> firefox`. Keep GPU-owning harnesses sequential and record desktop load before interpreting tail latency.
