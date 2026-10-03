# SMEAR

Grab a dummy, slam it into the room, and drag it through persistent blood. Walls catch splashes and develop downward drips.

**V9 / 0.9.0** runs ragdolls, collisions, droplets, wet transfer and persistent paint in WebGPU compute shaders. Native WebGPU rendering reads those same buffers. Three.js r140 remains embedded for procedural model construction and camera math; it does not create a WebGL context.

[Play SMEAR](https://tront.xyz/smear/) ? [Source](https://github.com/TrentSterling/smear)

Open index.html in desktop Chrome with hardware acceleration and WebGPU enabled. It works offline with no runtime downloads, installation or build. A hardware adapter is required. The CPU version remains available as [archived V8.9](versions/smear_v8.9_cpu.html).

- Left mouse: grab, fire or spill. 1 / 2 / 3 select the tool.
- Right drag: look. WASD: move. Shift: sprint. Space: jump. Ctrl: crouch.
- Wheel: push/pull the held body. Q / E: twist.
- L / Esc: lock/free mouse. F: Walk / Fly. Tab: controls.
- T: slow motion. P: pause. H: hide HUD. F3 / Perf: live profiling.
- Tune: walking, recovery, blood, transfer and coverage settings. Heal, wash and clean operate on GPU state.

Stains last for the session. Tuning keeps the existing smear.tune.v8 storage key and migration from dragmark.tune.v7.

F3 shows the raw FPS histogram, CPU frame history, spikes, live GPU particle counts, and asynchronous compute/render timestamps. Export JSON includes separate GPU sample distributions. Inputs, camera, HUD and WebAudio remain on the CPU. Normal play never downloads ragdoll poses or pigment, and never rasterizes or uploads paint pixels. Small uniforms and weapon transforms are uploaded each frame; GPU picking and telemetry return small results asynchronously.

Run npm run build after editing gpu/ or tools/compute-build.mjs. npm run verify:release runs sequential hardware Chrome gameplay and native 3000x1800 profiles with audio active and output muted. npm run serve provides a local preview. See [GPU architecture and release evidence](docs/qa/compute-v9.md). The compute solver and brush rasterization use GPU FP32 and differ from the historical CPU/Canvas implementation; no bit-identical preservation is claimed. Historical docs and harnesses remain in docs/qa and tools/.

GitHub Pages serves main at the repository root, with the existing tront.xyz/games card and OG image. Preserve the original V7 file and embedded MIT notices; see THIRD_PARTY_NOTICES.md.
