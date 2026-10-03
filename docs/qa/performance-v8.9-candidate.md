# V8.9 candidate: shared RGBA transport

This records pre-release candidates and rejected probes. The verified default transport scope and final-source receipts are in [V8.9 release notes](performance-v8.9.md). The broader performance goal remains active.

The initial shared-transport candidate source SHA-256 is `ea9b2d9a223b85208f8c32cf4ea0ea1cef9517f6d3cd395b5dea01adfb92c222`. Chromium now uses four RGBA workers with canonical CPU pigment and cooperative recovery, matching Gecko's transport. Chromium keeps its accelerated rasterizer; forcing its worker rasterization into software failed preservation and was rejected. Gecko retains its CPU rasterizer. `?paintBitmap=1` retains the previous transport for profiling.

The [17-harness release suite](v8.9-candidate/release-harnesses.json) passed on this exact source. Both [Chromium](v8.9-candidate/worker-chrome.json) and [Firefox](v8.9-candidate/worker-firefox.json) pass 73 lifecycle checks. These include clear/wash/removal, overload/restart, repeated overload, every worker actually in flight and failure immediately after graphics restoration. Both browsers record zero WebGL pigment readbacks on recovery. Lifecycle comparisons retain their existing two-level premultiplied-pixel tolerance.

The actual scene comparisons against frozen V8.7 pass all seven cases in [Chromium](v8.9-candidate/pigment-view-chrome.json) and [Firefox](v8.9-candidate/pigment-view-firefox.json), with maximum channel difference zero in the final suite. Existing tolerances were not loosened.

## Native Chromium trace

The [muted native-input capture](v8.9-candidate/native-chrome.json) uses hardware WebGL at 3000 x 1800, F3 open and native sound settings enabled. Mean host CPU pressure is 26% to 32% across 24 logical CPUs. All stages retain four workers without overload or recovery.

| Stage | FPS | Mean CPU work | CPU p99 | Worst CPU frame |
|---|---:|---:|---:|---:|
| Spill | 60.1 | 1.69 ms | 3.3 ms | 3.3 ms |
| Pistol | 60.0 | 2.59 ms | 4.3 ms | 34.2 ms |
| Coated dummy drag | 59.8 | 2.25 ms | 3.8 ms | 4.9 ms |
| Chaos | 59.1 | 6.17 ms | 11.5 ms | 36.4 ms |

Pistol's worst frame spends 30.9 ms in render. The native CPU profile samples 195.3 ms total in `getProgramInfoLog` during this capture; program-log queries need explicit audit/warmup before claiming the cold spike is fixed. Chaos's worst frame initializes 66,926,032 bytes of pigment texture data and spends 27.4 ms in prep, including 17.2 ms nested upload CPU. This identifies initial blank texture transfer as the next optimization target. GPU samples average 1.03 ms in Chaos, but CPU API duration is not GPU duration.

## Outstanding preservation check

The Chromium starvation comparison forces both versions to their 4096-event queue cap. In the first capture, worst main-thread work falls from 297.8 ms to 20.8 ms. Normalized simulation/wet state and every skin PNG match exactly. The raw surface-PNG equality gate fails: three surfaces contain 112 changed decoded pixels, ten exceeding two premultiplied channel levels, with maximum difference ten. This has not been signed off as equivalent.

An identical-source V8.8 control also fails PNG byte equality, but its decoded premultiplied pixels stay within two levels (maximum 1.40). Therefore PNG byte equality alone is too strong for that Chromium control, while the candidate's larger sparse differences still need investigation. A heavily instrumented recovery audit records zero pixels differing by more than two levels outside uploaded dirty regions. That diagnostic changes timing and must not be used as a performance measurement. A probe using an unspecified Chromium recovery context changes many pixels and is rejected; retain the tested explicit rasterizer options.

Canvas read/write conversion can lose nonopaque color precision according to the [HTML Standard](https://html.spec.whatwg.org/multipage/canvas.html#pixel-manipulation). That is relevant context, not proof of the cause of these alpha differences. No preservation threshold has been widened to accept the failing capture.

Local captures remain under `tools/out/recovery-profile-chrome`, `tools/out/recovery-v88-self-control`, `tools/out/recovery-v89-context-probe` and `tools/out/recovery-v89-bounds-audit`. The next implementation steps are zero-initialized GPU pigment allocation and cold skin-program warmup, followed by strong preservation, native-loop and paired-workload checks. Busy-host and Chaos tails remain unresolved.

## Subsequent cold-path fixes (pending final release gates)

Current source: `f0609fe107410ed9c975b605a34338ea49ee11048a478b731b91b1d188b46873`. The initial receipts above fingerprint the earlier source, not these changes.

The pinned r140 renderer now retains one additional reference per compiled program (bounded to 64). Reset no longer disposes the final skin/eye program reference. Loading also draws the pistol and flash variants without consuming a shot, physics tick, audio trigger or random number. Graphics loss drops the reference set. The cold audit covers program/shader info queries and immutable texture allocation, and records program identities before/after each reset. `?shaderCold=1` disables the added program references for comparison.

Worker pigment initialization uses r140's zeroed immutable storage and skips its initial copy from the blank canvas. This retains normal renderer texture ownership. Recovery after context loss explicitly restores canonical pixels before a cropped patch. `?paintInitCanvas=1` retains the old initialization call.

Normal worker presentation shares a two-millisecond deadline across workers, checking it between records. A single GL call can exceed that deadline. Partially applied jobs remove the applied record's commands from the recovery log, so emergency replay does not duplicate pigment. `?paintUnbounded=1` selects the old unbounded presentation. A new lifecycle case forces failure after exactly one record of a multi-record reply has been presented.

Native Firefox at 3000 x 1800, with the profiler open and browser output muted:

| Stage | FPS | Mean CPU work | CPU p99 | Worst CPU frame |
|---|---:|---:|---:|---:|
| Spill | 59.86 | 2.77 ms | 12 ms | 12 ms |
| Pistol | 60.04 | 4.20 ms | 7 ms | 8 ms |
| Coated dummy drag | 60.02 | 4.09 ms | 6 ms | 9 ms |
| Chaos | 59.49 | 10.15 ms | 16 ms | 20 ms |

No programs link after boot in any stage. Host mean CPU pressure is approximately 26% to 31%. Relative to the immediate pre-budget Firefox capture, maximum Chaos prep falls from 27 ms to 4 ms and maximum frame work falls from 36 ms to 20 ms. These are native traces, not deterministic paired captures; the remaining largest spike contains six physics catch-up ticks. Local receipts: `tools/out/cold-v89-budgeted-firefox/summary.json` and `tools/out/cold-v89-retained-programs-firefox/summary.json`.

Chrome's shader-retention capture (source `71af77d801e2097040f007404ba303e581a9a23036a43cd78bbf6095220c3ff3`, before the presentation deadline) also links zero programs after boot. Pistol's worst frame is 6.4 ms versus 34.2 ms in the earlier accelerated-RGBA capture. Its native drag callback gaps still show outside-frame scheduling delays; game work remains at most 6.8 ms. Host load is approximately 45%. Neither the shader fix nor the upload budget establishes that all game frames are below 8 ms.

The [17 release harnesses](v8.9-cold-path/release-harnesses.json) all pass on `f0609fe107410ed9c975b605a34338ea49ee11048a478b731b91b1d188b46873`. Both worker suites pass 79 checks, including failure after exactly one record of a multi-record reply has been presented. All seven actual-scene cases pass in each browser; maximum rendered channel delta is one on Chrome and zero on Firefox. Native context loss/restoration passes two cycles per browser and resumes the real frame loop. The source is still unpublished pending strict starvation and fixed-work comparisons. The [native Firefox receipt](v8.9-cold-path/native-firefox.json) retains the measured GL calls, shader identities and source fingerprint.

## Release scope after Chromium's strict gate

The latest Chromium forced-starvation capture still fails exact surface PNG equality: 101 decoded pixels change across three surfaces, with nine over the existing two-level premultiplied tolerance and maximum delta ten. Simulation/wet state and skin PNGs remain exact. Worst main-thread frame is 323 ms before versus 29.7 ms after, but mean work rises from 6.58 ms to 14.56 ms; host CPU pressure also rises from 68% to 80%. This is not an across-the-board performance win. [Failure receipt](v8.9-cold-path/starvation-chrome-failed.json).

The release default therefore retains Chromium's published single ImageBitmap worker. The four-worker Chromium RGBA implementation remains opt-in with `?paintRGBA=1`. Firefox/Zen retains its published four-worker RGBA implementation. The cold shader, blank initialization and bounded presentation changes apply to both default browser paths. The Chromium worker lifecycle suite and starvation tool explicitly select the experimental RGBA path; normal Chrome gameplay/paint/presentation/context harnesses exercise the default transport. Final-source verification is being rerun after this scope change.

Firefox fixed-work profiles on source `f0609fe107410ed9c975b605a34338ea49ee11048a478b731b91b1d188b46873` pass all 24 exact comparisons with the stored V8.8 workload: simulation/wet transfer, droplet motion/lifetime, particle matrices, and surface PNG/wet supply, across air, hidden air, pistol, air drag, floor drag and Chaos. These captures have higher frame times under later host pressure than the native Firefox trace above; they do not establish a uniform speedup.

Final-default source `998a9f8fff66f3dbe5897a8b428e5c09f57d2118dee0d2c922be088d104ba352` also retains exact simulation/wet state and every surface/skin PNG in forced Firefox worker starvation. [Preservation receipt](v8.9-cold-path/starvation-firefox-preservation.json). The timing run fails its frame-count gate: the candidate's capture lasts beyond the profiler's rolling 15-second window, so only 317 of 419 intervals remain. Mean host CPU pressure rises from 71% during the baseline to 91% during the candidate. The available timing subset cannot support the required threefold worst-frame reduction; no performance pass is claimed from it. The remaining performance objective stays open.
