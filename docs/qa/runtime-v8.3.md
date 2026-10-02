# V8.3 live runtime profiling

Open **Perf** or **F3** while playing, or use `https://tront.xyz/smear/?perf=1`. Closing the panel keeps the capture running. A small FPS badge remains in the HUD. Visibility is saved locally; capture state resets on reload.

The panel contains an FPS histogram, a stacked CPU history with the raw frame gap overlaid, frame p50/p95/p99, CPU average/p99, and a recent-spike log. The rolling window is 15 seconds, including complete frame intervals that overlap its boundary. Storage is bounded to 8192 frames, 64 spikes, 96 browser events, and eight pending GPU queries. The live UI reads typed columns directly and refreshes at 4 Hz; per-frame objects are created for exports and inspection.

Choose a 60/120/144/240 FPS budget. A spike is a callback gap exceeding 1.5 times that budget. Changing the budget recalculates the spike log for the retained window. **Freeze capture** holds the history while gameplay continues. **Clear** erases the recorded data. **Export JSON** downloads the frame data, spikes, browser events, viewport, adapter, and tuning. The same data is available through `window.__smear.perf.report()`.

## Measurement boundaries

Frame gaps use `performance.now()` at each game animation callback's entry, before the game's simulation-time clamp. Each gap is attached to the preceding completed callback's CPU work and workload. Browser rAF timestamp intervals and callback scheduling delays are also exported: rAF timestamps can precede actual callback entry during an external stall. These are callback cadence measurements; they do not measure compositor presentation directly. Hidden-document and manual-harness intervals break the sequence and are excluded.

Exclusive main-thread phases:

| Phase | Scope |
|---|---|
| Physics | Pose updates, body integration, joint/world/body-pair solving, contact response; body-pair wet transfers occur here too |
| Paint | Contact damage, blood/contact painting, supply flow/drying, and held pistol/spill tool updates |
| Drops | Droplet simulation, collisions, and resulting landing splats |
| Prep | Surface upload scheduling and cropped canvas uploads |
| Render | Three.js render submission, including skin and wet-map uploads performed by the renderer |
| HUD | Gameplay canvas UI |
| Profiler | Capture bookkeeping, query polling, and the throttled profiling panel refresh |
| Input | Camera, grabbing, hover picking |
| Other | Remaining frame work, including mesh/tool synchronization |

Upload-call CPU and upload payload are recorded independently. Upload-call CPU is already included in prep/render and must not be added as another exclusive phase. Payload excludes texture allocations without source data. GPU time is sampled once per four frames while the panel is open, using [WebGL 2 timer queries](https://registry.khronos.org/webgl/extensions/EXT_disjoint_timer_query_webgl2/). It covers the upload/render command span, which can include GPU idle time between submissions. Results are polled asynchronously, disjoint results are discarded, and unavailable timer support is labeled explicitly. The game never waits for a result or substitutes render CPU for GPU time.

Spikes retain tick count, discarded simulation time, body/dummy/wound/drop counts, upload queues, camera, tool, grab, and pause/demo state. The table shows the largest measured CPU phase; its row tooltip includes camera, uploads, and GPU timing when sampled. Browser long-task and long-animation-frame events are retained when supported, including long-animation-frame script attribution. Heap usage is a browser-provided snapshot when available, not proof of a GC event.

## Verification

`npm run verify:runtime` checks a real 115 ms main-thread stall, histogram and percentile arithmetic, callback/work association, target budgets, native dragging with the overlay open, Chaos, capture freeze/resume, visibility gaps, exported downloads, panel scrolling, phone-width containment, unavailable GPU timers, and WebGL/browser errors. `npm run verify` covers the existing game. `npm run verify:paint` audits retained paint pixels and upload state.

`npm run profile:runtime` compares the same 240 fixed-work Chaos frames after 60 warmup frames with capture disabled, capture running with the panel closed, and the panel open. Complete simulation states must match. A fourth run spans 1080 frames with the panel open and verifies the rolling window. Diagnostic state snapshots are taken after timing; raw output goes to `tools/out/runtime-overhead/`.

This update provides visibility into the remaining hitches. It does not claim to fix all FPS dips. Local captures have shown both expensive render calls and heavy physics/paint/drop frames, with longer gaps causing multiple catch-up simulation ticks. Export immediately after a dip to preserve the surrounding evidence.

## Release receipts

Local Chrome on the RTX 5070 Ti passed [20 runtime checks](v8.3/runtime-local.json), [19 gameplay checks](v8.3/gameplay.json), and [nine paint-pixel checks](v8.3/paint-pixels.json). Inspected captures: [injected hitch](v8.3/profiler-hitch.png), [Chaos](v8.3/profiler-chaos.png), and [phone-width panel](v8.3/profiler-mobile.png).

The [overhead receipt](v8.3/runtime-overhead.json) confirms exact simulation-state preservation across the three fixed-work capture modes. In this paired run, mean work was 8.43 ms disabled, 9.23 ms recording, and 9.42 ms with the panel open. Recorded profiler bookkeeping/UI averaged 0.036 ms closed, 0.095 ms open, and 0.132 ms in the rolling window of the longer run. These measurements include machine/browser variation; the profiler phase is not a measurement of every indirect instrumentation cost. The longer run retained the rolling window after 1080 frames, with bounded queries and no browser errors.

## Public deployment

GitHub Pages built release `5633435` successfully. HTTPS served the exact release HTML SHA-256 `6bb69baafb325984841d1022ee6e4ebd9695ef32a03cf84f797806b77c0ffce6`. The [live profiler receipt](v8.3/runtime-live.json) contains 20 passing checks, including a raw hitch, native floor dragging with the panel open, exported downloads, and the unavailable-timer path. The [publishing receipt](v8.3/publish-live.json) contains 14 passing checks for the game, floor smears, WebGL state, social image and portfolio card. [Live profiler capture](v8.3/live-profiler-hitch.png).
