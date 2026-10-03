# Unpublished work after V8.9

The live release is still V8.9 (`998a9f8fff66f3dbe5897a8b428e5c09f57d2118dee0d2c922be088d104ba352`). These are candidate measurements, not a release receipt or completion of the performance objective. The pending Chromium recovery change must not ship while its preservation gate fails.

## Audio

The native Chromium audit measured 39.6 ms in `AudioContext` construction on first Spill input. Preparing the existing graph during loading removes that constructor call from input. Sound generation and scrape automation remain locked until a native gesture. The graph still processes audio during profiling; every owned browser independently mutes its output.

Both [Chromium](v8.10-candidate/audio-chrome.json) and [Firefox](v8.10-candidate/audio-firefox.json) pass seven lifecycle checks: one loading-time graph, silent continuous layers before input, no transient voices from pre-input simulation, native unlock of the same running graph, enabled noise/tone synthesis, five transient-node disconnections after sounds end, and no browser errors. No synthesis recipe or gameplay RNG changes.

## Transfer and queue pressure

Dispatch bounds now cover the commands in the dispatched batch rather than future queued commands. A fully clipped skin mark produces no bitmap or RGBA readback. The previous region calculation could invert its bounds and make `getImageData` throw. Adaptive small batches were rejected: they reduced individual transfers but failed throughput, reached the queue cap, and fell back to the main thread.

Chromium's default single accelerated worker is the transfer reference. Merely starting its bitmap promises concurrently did not help: the tested transfer mean was 58.8 ms versus 31.7 ms sequentially. A candidate packs changed regions into reusable, bounded atlases and creates one bitmap per atlas. WebGL uploads original regions using source-row selection, resetting skip and row-length state afterward. Shared bitmaps close only after every patch has been presented or discarded.

On the same fixed Chaos workload, the [sequential transfer](v8.10-candidate/bitmap-sequential.json) averaged 31.75 ms per job, with 3,657 peak queued events. The [atlas candidate](v8.10-candidate/bitmap-atlas.json) averaged 10.24 ms, with 1,201 peak queued events. Main-thread means were 7.05 and 7.19 ms; this is a transfer/queue improvement, not an isolated total-CPU speedup. Physics, wet transfer, droplet state and particle matrices matched exactly. Five persistent surface pixels changed by at most two premultiplied levels. Therefore the strict PNG-equality comparison failed, although the existing GPU pigment tolerance passed. Repeating the unchanged sequential reference produced identical pigment and a 233 ms overload frame, so those five pixels are not dismissed as reference nondeterminism.

The transfer-only [native atlas run](v8.10-candidate/native-atlas.json), before adding cooperative mirror recovery, kept the worker through Spill, pistol, drag and Chaos. Chaos measured 60.03 FPS, 6.82 ms mean work, 11.1 ms p99 and 28.4 ms maximum. The earlier native candidate reached synchronous fallback with a 285.7 ms Chaos frame. Host pressure differed; these are individual native traces, not a deterministic end-to-end speedup. Audio was enabled, unlocked, running and output-muted throughout.

## Recovery remains under investigation

Retaining a Canvas2D mirror permits bounded Chromium recovery without WebGL `readPixels`, and fixes failure immediately after graphics restoration. Cropped DOM-canvas uploads are required during accelerated recovery. Repeated `getImageData` uploads changed tiny-pigment accumulation in the 12,000-event burst test; that version was rejected. Hard-cap pressure now accumulates dirty bounds for the next presentation task instead of uploading after every forced command.

The current cooperative atlas version passes [84 worker lifecycle checks](v8.10-candidate/worker-atlas-lifecycle.json), including clipping, failure after partial presentation, clear/wash/removal races, graphics loss, all batches actually in flight, and a 12,000-event burst. Every case checks zero WebGL pigment readback and bounded resources. This smaller lifecycle suite passing does not override the failing complete starvation comparison below.

The [forced atlas starvation trace](v8.10-candidate/starvation-atlas-candidate.json) reduced worst main-thread work from [320.6 ms](v8.10-candidate/starvation-atlas-v8.8.json) to 35.3 ms under approximately 99% host load. This is **not a passing preservation result**: [eleven surface pixels exceed the existing two-level tolerance](v8.10-candidate/starvation-atlas-pixel-differences.json), maximum ten. Skin differences remain within two levels. The exact pigment assertions and their thresholds were not widened. Neither cooperative atlas recovery nor the older experimental Chromium RGBA recovery is ready to become the release default.

An [isolated replay probe](v8.10-candidate/recovery-raster-probe.json) captures the published reference's exact pigment prefix and 4,134 outstanding commands, then replays them in a worker. Both default and explicitly accelerated recovery canvases keep every pixel within one premultiplied level of contiguous main-thread reference replay. Forcing software rasterization produces 115,845 pixels outside tolerance and a maximum delta of 53, so that backend is rejected. The next implementation step is worker-owned backlog replay with bounded seed preparation, presentation and total outstanding events. It has not yet been integrated or proven through the complete starvation harness.

The original 120 Hz physics, nine solver passes, bristles, contact spacing, 900-drop pool and rendering resolution remain intact. Catch-up physics, adverse host scheduling and complete Chromium recovery preservation remain open. Candidate receipts retain their individual source fingerprints; no claim is made that every experiment tested the current final working-tree bytes.

## Latest Firefox evidence

The [native Firefox capture](v8.10-candidate/native-firefox.json) retains audio enabled and running throughout. With approximately 88% to 97% host CPU pressure, pistol averages 59.21 FPS and dragging 59.75 FPS, but Chaos falls to 15.69 FPS, 54.02 ms mean work and 143 ms maximum. The queue fills, 8,009 recovery events remain at the end, and catch-up physics averages 6.65 ticks per frame. This capture confirms that the broader performance objective is unfinished; it is retained rather than replaced by a lighter workload.

That native audit also catches a 24 ms clear of an empty pigment canvas. A later candidate tracks whether the retained canvas has actually received pigment and avoids clearing known-empty canvases. [All 13 Firefox GPU paint checks](v8.10-candidate/paint-firefox-clear-skip.json) pass afterward. The latest [fixed-work Chaos capture](v8.10-candidate/chaos-firefox.json) averages 9.82 ms main-thread work, with 12 ms p99/maximum, and keeps four workers. Its [four strict comparisons](v8.10-candidate/chaos-firefox-preservation.json) against the frozen V8.9 workload pass: exact simulation/wet transfer, drop motion/lifetime, particle transforms, and persistent pigment/wet supply. This is not a proof that native Chaos stays fast under heavy contention, nor an eight-millisecond bound.
