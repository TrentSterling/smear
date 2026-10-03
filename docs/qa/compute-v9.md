# SMEAR V9 WebGPU compute release

Version 0.9.0, verified on 2026-10-03. Trent requested a GPU compute rewrite targeting Chrome after the CPU/Canvas architecture still produced severe frame drops. This replaces the running engine. The unpublished coupled-worker prototype remains historical work on the branch, not the V9 runtime.

## Runtime

Native WebGPU, hardware NVIDIA Blackwell adapter. The 120 Hz solver, nine internal joint/world-contact iterations, body-pair collision, ray picking, pistol interaction, 900 pooled droplets, wet pickup, contact smears, wall flow, drying and persistent pigment run in WGSL compute. Rendering uses the same GPU body, particle, wet and pigment buffers. Ordered paint events bin into 16x16 tiles; compute rasterizes the original 54-bristle contact strokes and 18 embedded brushes into persistent packed RGBA8 storage. Surface and skin resolutions are retained, including 640 floor tiles and 336x224 skin atlases. Tile-list overflow scans the complete event list rather than losing those events.

CPU work is input, camera collision, HUD, audio and GPU submission. Startup builds the original procedural geometry and textures once. Foreground frames upload uniforms and changing weapon transforms. Body poses and pigment never return to CPU during normal play. GPU picking returns 64 bytes once per grab; telemetry returns 128-byte counters and 32-byte timestamps asynchronously. Explicit state()/paintHash() calls read back data for verification only.

The native renderer retains original models, room geometry, lights/shadows, 2048 shadow resolution and four-sample antialiasing. The PBR implementation and compute FP32 solver differ from the old Three.js renderer and ordered CPU solver. Brush strokes use analytic GPU coverage, so pigment is not byte-identical to Canvas. The old exact CPU/Canvas harnesses are not evidence for this rewrite. V7 remains immutable; versions/smear_v8.9_cpu.html preserves the prior candidate and supplies the build's procedural scene, UI and audio.

## Evidence

`npm run verify:release` completed two sequential Chrome harnesses:

- `COMPLETE compute game checks passed (10 checks)`
- `COMPLETE native GPU gameplay and 3000x1800 profiles passed (7 checks)`

Audio was enabled and its AudioContext running throughout native input tests; Chrome output was separately muted. No concurrent game GPU harnesses ran. The profiles use Chrome headless at 3000x1800, device scale 1 and four-sample AA. The browser schedules approximately 60 frames/sec; these results do not establish a maximum uncapped FPS. Every workload also measured 119.3 to 119.6 actual GPU simulation ticks/sec.

| Native workload | FPS | CPU p99 ms | Compute p99 ms | Render p99 ms |
| --- | ---: | ---: | ---: | ---: |
| idle | 60.00 | 1.50 | 1.18 | 1.11 |
| pistol | 60.00 | 1.60 | 1.18 | 0.66 |
| spill | 60.00 | 1.60 | 1.05 | 0.98 |
| drag | 60.01 | 1.50 | 1.38 | 0.98 |
| chaos | 60.00 | 1.60 | 2.03 | 1.25 |

The audit intercepted GPUBuffer.mapAsync, GPUQueue.writeBuffer, Canvas getImageData and WebGL context creation. All five profiles recorded zero paint/body readback, zero paint/body/particle uploads, zero Canvas pixel reads and zero WebGL contexts. Only bounded timestamps/counters were mapped. The pistol also updates foreground weapon matrices. Compute timestamps include GPU copies/counter clears, physics, particles, flow, paint binning and painting; render timestamps cover shadow and scene passes. GPU results are asynchronous and are not presented as exclusive CPU phases.

Gameplay checks cover live GPU droplets, actual painted pixels, clear/reset, repeatable poses after reset, no lost stamps, native pistol hits, native Spill, native GPU picking/dragging, wall pigment extending under gravity, complete wash/heal, and long finite simulation with recovery. Twelve-dummy testing reached 180 rigid bodies with a maximum joint gap of 0.0183 m. GPU raycasts verified all three spawn torso sightlines at 1366x768, 1920x1080 and 3000x1800. Native Chaos used 150 bodies.

The compact machine-readable receipt is compute-v9.json. The existing social image remains 1200x630. Post-deployment HTTP hashes, real hardware GPU boot, native picking/dragging, audio, and desktop/mobile portfolio cards are checked separately by tools/publish-check.mjs.

## Reproduce

Node 22+ and hardware-accelerated Chrome are required. `npm run build` regenerates the single offline index.html. `npm run verify:release` reruns both harnesses. `npm run serve` starts a local preview. F3 displays the raw frame histogram and separate asynchronous GPU distributions. GPU frame/event/sample storage and particle/stamp pools are bounded. No screen resolution, simulation rate, brush count or particle cap was reduced for the measurements.
