# SMEAR

Grab a dummy, slam it into the room, and drag it through persistent blood. Walls catch splashes and develop downward drips.

**V20 / 0.20.0** runs ragdolls, collisions, droplets, wet transfer and persistent paint in WebGPU compute shaders. Native WebGPU rendering reads those same buffers. Three.js r140 remains embedded for procedural model construction and camera math; it does not create a WebGL context.

V20 makes wall blood cling and gather into uneven rivulets. Small deposits stay attached, heavier heads move, and dry edges resist until enough liquid builds up. The broad impact stain remains behind the flowing material. `npm run verify:rivulets` checks this behaviour; `npm run record:rivulets` records matched V19/V20 wall impacts and Spill pulses. This is a stylized partial-wetting model, not a calibrated blood simulation.

V19 restores the lively V17 wall flow while retaining the larger impact prints. More of each wall splat remains mobile, so liquid visibly drains beneath the persistent ragged mark. Floor pools and airborne motion keep their existing response. `npm run record:wall:motion` creates comparisons against both V17 and V18.

V18 gives wet wall impacts a broad body-shaped print with irregular edges and scattered flecks. The splat remains while excess liquid drains more slowly; floor pools retain their existing response. Impact strength uses incoming body motion, consumes coating and has a short cooldown. `npm run verify:wall` checks matched wall and floor impacts; `npm run record:wall` creates the V17/V18 comparison.

V17 adds visible surface gravity and momentum: blood runs down walls and ramps, drips off raised edges, and collects on the floor. Wet dummies pick up pools more readily and push a broader trail while dragging. Wound droplets inherit body and rotational motion, and fast-moving coated limbs fling finite droplets. Surface flow, pickup, runoff and flight remain GPU driven. `npm run verify:gravity` checks these cases; `npm run record:gravity` records matched V16/V17 wall flow, edge runoff, pool dragging and flinging.

V16 gives deposited blood a finite GPU liquid layer. Pools spread and merge after the source stops, move downhill on inclined receivers, and dry into lasting residue. A clean dummy can pick up this liquid and push it along its contact footprint. Thickness affects color, gloss and surface normals; dense coverage keeps the edges from reading as an airbrush. `npm run verify:film` isolates these behaviors; `npm run record:film` captures the V14-to-V16 settling, pooling and dragging comparison in `tools/out/film-pass/recordings/`.

V15 restores broad contact footprints, rotation sweeps, distance-varying bristles, a thin wet film and resting wet-contact pools. Dragging a dummy now redistributes existing wet pigment, while dry stains stay fixed. All contact transport and paint snapshots stay on the GPU. `npm run verify:wet` checks these behaviors; `npm run record:wet` creates the matched V14/V15 pooling and dragging MP4 in `tools/out/wet-pass/recordings/`.

V14 adds molded elbow, wrist and knee coverage, smoother limb ends and metal hubs, subtle chest contours, vinyl surface finish, shoe detail and antialiased calibration markings. `npm run record:dummy:finish` compares the V13 checkpoint with this model refinement.

`npm run record:dummy:full` records the original V10 mannequin against the current SDF dummy, including orbit, walking and dragging. The completed local review is collected in `tools/out/review-v14/`: `00-full-dummy-transformation.mp4` shows the model, `01-smear-whole-art-pass.mp4` shows the V9.1-to-V14 scene changes, and `02-dummy-finish.mp4` shows the final V13-to-V14 refinement. `docs/qa/dummy-v14.json` records the final verification results.

V13 reduces startup work without changing the dummy mesh: the skin and shell buffers hash identically to V12. It compiles independent shader pipelines together while generating the scene. The pistol now has beveled surfaces, working slide recoil, sights and a gloved grip; Spill has a pressure bottle. First-person tools stay visible against nearby walls. `npm run verify:presentation` exercises firing, FPS aiming and switching, and `npm run record:presentation` records the paired tool comparison.

V12 ties arm swing and torso counter-rotation to the actual alternating feet, adds toe clearance and foot pitch during swing, and adjusts hip height to the leg reach. Get-up motion follows the fallen heading, rolls face-up dummies onto their front, gathers the limbs, places the hands near the floor, and rises through a crouch. Grabbing interrupts recovery. All targets remain bounded pose motors acting on the GPU rigid-body solver.

`npm run verify:motion` checks walking and five get-up cases: face up, face down, sideways, rotated and interrupted. It records arm/leg timing, joint gaps, hand support, final upright pose and heading. `npm run record:motion` compares the preserved 0.11.1 build with the current build in a walking and recovery MP4 under `tools/out/motion-pass/recordings/`, using the same camera path for both builds.

V11 replaces the primitive mannequin with an SDF-authored crash-test dummy: shaped chest and pelvis, molded face and hands, mechanical joints and fasteners, rubber shoes, flexible ribbed neck, abdominal boot, and calibration targets. The 0.11.1 refinement adds continuous facial relief, tapered chest contours, leg openings in the pelvis, covered kneecaps, rounded shoulder joints and finger creases. One shared indexed mesh uses all 15 GPU physics bodies as its skinning rig. The neck and waist blend between adjacent bones; molded fingers move with the hand body. The SDF is extracted once during startup, not raymarched per pixel or rebuilt each frame. The offset isosurface outline and smooth union approach are adapted from Trent's CRITTERS project. No runtime pose downloads or skinning uploads were added.

`npm run verify:dummy` audits closed topology, triangle winding, finite normalized skin weights and all 15 bones, then captures six model views, reach/crouch/neck-and-waist poses and a live rig view. `npm run record:dummy` records matched model orbits, walking and dragging from the preserved V10 build and current candidate, then produces a side-by-side MP4 in `tools/out/dummy-pass/`. `npm run record:dummy:refined` compares the preserved 0.11.0 checkpoint against the current refinement in `tools/out/dummy-pass/refinement/`. Visual iterations and checks are retained alongside those recordings.

The local V10 art pass adds an amber and teal test lab, world-planted alternating feet with joint-consistent leg targets, and smooth turns. Every floor, wall, obstacle and ramp paint receiver uses 160 texels per metre on both axes. Narrow wall rivulets replace the oversized horizontal paint bands. Skin atlases remain 336x224; the floor remains 640x640 per four-metre tile.

`npm run verify:art` checks 24 seconds of locomotion, all 75 receiver mappings and native Spill on the wall, bench faces and tilted ramp. `npm run record:art` records 1080p MP4 clips of walking, dragging and chaos; recording is separate from performance measurement. Before/after evidence is in `tools/out/art-pass/`, with compact results in `docs/qa/art-v10.json`.

[Play SMEAR](https://tront.xyz/smear/) ? [Source](https://github.com/TrentSterling/smear)

Open index.html in desktop Chrome or Firefox on Windows with hardware acceleration and WebGPU enabled. It works offline with no runtime downloads, installation or build. A hardware adapter is required. The CPU version remains available as [archived V8.9](versions/smear_v8.9_cpu.html).

- Left mouse: grab, fire or spill. 1 / 2 / 3 select the tool.
- Right drag: look. WASD: move. Shift: sprint. Space: jump. Ctrl: crouch.
- Wheel: push/pull the held body. Q / E: twist.
- L / Esc: lock/free mouse. F: Walk / Fly. Tab: controls.
- T: slow motion. P: pause. H: hide HUD. F3 / Perf: live profiling.
- Tune: walking, recovery, blood, transfer and coverage settings. Heal, wash and clean operate on GPU state.

Stains last for the session. Tuning keeps the existing smear.tune.v8 storage key and migration from dragmark.tune.v7.

F3 shows the raw FPS histogram, CPU frame history, spikes, live GPU particle counts, and asynchronous compute/render timestamps. Export JSON includes separate GPU sample distributions. Inputs, camera, HUD and WebAudio remain on the CPU. Normal play never downloads ragdoll poses or pigment, and never rasterizes or uploads paint pixels. Small uniforms and weapon transforms are uploaded each frame; GPU picking and telemetry return small results asynchronously.

Run npm run build after editing gpu/ or tools/compute-build.mjs. npm run verify:release runs sequential hardware Chrome gameplay and native 3000x1800 profiles, then Firefox gameplay, with audio active and output muted. npm run profile:firefox runs the native workloads through Firefox as well. npm run serve provides a local preview. See [GPU architecture and release evidence](docs/qa/compute-v9.md) and the [0.9.1 browser compatibility checks](docs/qa/compute-v9-1.md). The compute solver and brush rasterization use GPU FP32 and differ from the historical CPU/Canvas implementation; no bit-identical preservation is claimed. Historical docs and harnesses remain in docs/qa and tools/.

GitHub Pages serves main at the repository root, with the existing tront.xyz/games card and OG image. Preserve the original V7 file and embedded MIT notices; see THIRD_PARTY_NOTICES.md.
