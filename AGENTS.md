# SMEAR

Read the workspace `AGENTS.md` and `CLAUDE.md`. Hold the coordination lease for `C:\trontstack\smear` before writing.

Current version: V8.3 / `0.8.3`. `index.html` is the complete offline game. Preserve the original `versions/dragmark_v7.html` byte for byte; its SHA-256 is `4dfe17e606b18ce7471f176b4c2afa0229b2f32e60b5b88c2971ebc6a75bc41f`.

Keep the offline entry point usable without a build or CDN. Preserve persistent stains, contact-driven smears, wall spills, gravity-driven drips, and embedded third-party notices. Browser tuning uses `smear.tune.v8` and migrates available legacy tuning from `dragmark.tune.v7`.

Verification: `npm run verify`. It opens its own headless Chrome on the real GPU, checks repeatable smear physics after reset, validates all spawn sightlines at three desktop sizes, exercises wall spills and storage migration, and saves captures to `tools/out/`. The focused collision optimization was separately verified against the exact V7 simulation before relocating arena geometry; its receipt is in `docs/qa/collision-preservation.json`. Never claim runtime success without running it. Never terminate unrelated browsers.

Profile with `npm run profile`; regenerate the social image with `npm run og`. GitHub Pages uses `main`, repository root, and the portfolio's existing custom domain. Do not add a project-level CNAME. Validate releases and the portfolio card with `node tools/publish-check.mjs <game-url> <games-url> <label>`.

Use `window.__smear` for inspection and automation. Update `package.json`, the game-reported version, and visible version labels together when making a release. No em dashes or AI co-author trailers.

Painting changes also require `npm run verify:paint`, `node tools/paint-verify.mjs fallback`, and a before/after drag comparison. See `docs/qa/painting-v8.2.md` for repeatable commands. Keep bristle count, contact spacing, pigment density, and wet-transfer behavior. WebGL 2 cropped uploads use the pinned Three.js r140 renderer's texture handle and state cache; reset source skip parameters after each upload. Full initialization and clearing must update the complete texture.

Live profiling: F3 or Perf opens the independent overlay; it does not pause gameplay. `window.__smear.perf` provides snapshot/report, show, capture and clear. Preserve raw, unclamped callback-entry intervals (retain rAF timestamps separately) and associate each interval with the preceding completed frame. Exclude hidden-tab/manual-mode gaps, keep frame/event/query storage bounded, and never wait synchronously for GPU results. Upload CPU is nested in prep/render, not an extra exclusive phase. Verify changes with `npm run verify:runtime`, `npm run profile:runtime`, and the full gameplay harness.
