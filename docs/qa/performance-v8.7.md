# V8.7 bounded paint recovery on Firefox/Zen

V8.6 moved normal paint rasterization to a worker, but its overload path reconstructed every painted canvas from the GPU and replayed all outstanding events synchronously. A stalled worker could therefore freeze the gameplay thread for hundreds of milliseconds or longer. The final V8.6 floor capture recorded a 1929 ms frame.

V8.7 uses cropped RGBA buffers on Gecko, preserving canonical CPU pigment alongside the GPU texture. Recovery reads those pixels without a GPU round trip and replays original ordered commands in short tasks. Normal worker batches contain at most 1024 events; the normal queue remains capped at 4096 and recovery at 8192. Conservative command bounds limit recovery uploads to changed pixels. CPU-backed brushes avoid mixing accelerated brush sources into CPU recovery canvases. After the first overload, a replacement worker receives existing pigment as its seed; repeated overload or explicit failure uses cooperative CPU recovery. Chromium retains ImageBitmap transport and its compatibility path.

Epoch rejection after clearing/washing, removed bodies, persistent stains, bristles, screen and pigment resolution, the 900-drop cap, 120 Hz simulation and nine solver passes remain intact. Recovery during graphics loss preserves surface and skin pigment. `?paintBitmap=1` exposes the earlier Gecko transport; `?paintSync=1` selects the original synchronous backend.

## Measurements and limits

The [native-input capture](v8.7/native-input-performance.json) uses muted, isolated Firefox on Windows with hardware WebGL at 3000 x 1800, pixel ratio 1, F3 open, and gameplay sound settings enabled. It profiles the actual game animation loop and native pointer input. The source SHA-256 is `4f2e17ebb3353eb9996c0dc397b9df90f2f32d22dd3c2ee1d1a47fd7ec350608`.

| Native workload | Average FPS | Mean main-thread work | CPU p99 | Worst CPU frame | Callback interval p99 / worst |
|---|---:|---:|---:|---:|---:|
| Sustained pistol, 595 frames | 60.0 | 4.26 ms | 6 ms | 6 ms | 18 / 18 ms |
| Coated dummy dragged, 493 frames | 60.0 | 3.98 ms | 6 ms | 12 ms | 18 / 18 ms |
| Ten-dummy Chaos, 295 frames | 58.6 | 10.92 ms | 24 ms | 35 ms | 32 / 39 ms |

Mean host CPU busy fractions across 24 logical CPUs were 26.1%, 26.4% and 34.1% respectively. These are single captures, not a guarantee for every desktop load. The first-pistol capture has a 19 ms worst CPU frame and a 24 ms worst callback interval. Initial loading also records longer texture-upload calls. GPU timer queries were unavailable on this Firefox context; CPU call duration is not GPU duration.

Chaos still needs work: mean physics is 4.36 ms and rendering 3.43 ms per frame, with 90.2 MiB/s of recorded texture uploads. Worker transfer preparation and queue latency are separate off-thread costs. The [six-workload preservation/performance capture](v8.7/preservation-and-performance.json) also retains worse tails: floor drag reaches 59 ms and the hidden-particle control reaches 82 ms. Its exact comparisons pass, but the timings do not establish an 8 ms bound. The broader performance goal remains active.

## Forced worker starvation

The [controlled starvation comparison](v8.7/forced-worker-starvation.json) delays worker messages by three seconds while both versions execute the same 420 frames with two physics ticks per frame. Both actually reach their 4096-event queue cap. It compares the published V8.6 code with the V8.7 source above.

| Measurement | V8.6 | V8.7 |
|---|---:|---:|
| Mean main-thread work | 12.73 ms | 9.47 ms |
| Main-thread p99 | 50 ms | 21 ms |
| Worst main-thread frame | 453 ms | 21 ms |
| Worst callback interval | 460 ms | 30 ms |
| Mean host CPU busy fraction | 34.5% | 26.6% |

Every simulation field and wet-transfer value, every persistent surface PNG, and every skin PNG matches exactly after draining. The receipt retains independent hashes for all pigment images and the normalized simulation state. V8.7 reaches the 8192-event recovery cap, records an 8 ms maximum recovery task, restarts one worker, and ends with no pending events. The host load differs, so mean CPU improvement is not isolated solely to the code. Removal of the old synchronous reconstruction path and its long hitch is directly exercised.

An intermediate implementation marked complete canvases for upload after each recovery task. Native Chaos then fell to roughly 23 FPS with 299 MiB/s of uploads. The cropped RGBA recovery path replaces that regression; the final capture above remains on the worker and records no recovery overload. The forced-stall capture separately exercises cropped recovery under real overload.

## Verification

Run `npm run verify:release` for the 15 sequential harnesses. The [suite receipt](v8.7/release-harnesses.json) covers gameplay, all paint/GPU cases in both browsers, synchronous compatibility, worker lifecycle, particle ordering, retained HUD, detail instances, native graphics restoration, native Firefox input, F3/export and profiler overhead.

The [Firefox worker receipt](v8.7/worker-firefox.json) passes 56 checks, including a 12000-event burst, worker restart, repeated overload, clear during recovery and graphics loss during recovery. It asserts zero synchronous GPU pigment readbacks throughout. The [Chromium worker receipt](v8.7/worker-chrome.json) passes 45 checks. The lifecycle pigment checks compare every premultiplied pixel against synchronous rasterization with a maximum permitted channel difference of two levels; they do not claim byte-identical raster output across different Canvas backends.

The [six-workload preservation receipt](v8.7/preservation-and-performance.json) passes 24 exact comparisons against the final V8.6 capture: simulation/wet transfer, droplet motion/lifetime, instance transforms and every persistent surface PNG with wet supply. This includes 900-drop air, hidden-particle control, pistol, air drag, floor drag and Chaos. `npm run profile:recovery` reproduces the forced-starvation comparison and exact surface/skin checks.

All GPU-owning harnesses run sequentially. Chrome output is muted with `--mute-audio`; Firefox uses a silent destination gain plus profile-level volume zero. Native sound code and settings remain enabled. No unrelated browser or benchmark process is stopped.
