# SMEAR

Read the workspace `AGENTS.md` and `CLAUDE.md`. Hold the coordination lease for `C:\trontstack\smear` before writing.

Current version: V8 / `0.8.0`. `index.html` is the complete offline game. Preserve the original `versions/dragmark_v7.html` byte for byte; its SHA-256 is `4dfe17e606b18ce7471f176b4c2afa0229b2f32e60b5b88c2971ebc6a75bc41f`.

Keep the offline entry point usable without a build or CDN. Preserve persistent stains, contact-driven smears, wall spills, gravity-driven drips, and embedded third-party notices. Browser tuning uses `smear.tune.v8` and migrates available legacy tuning from `dragmark.tune.v7`.

Verification: `npm run verify`. It opens its own headless Chrome on the real GPU, compares the deterministic smear demo to V7, exercises wall spills and storage migration, and saves captures to `tools/out/`. Never claim runtime success without running it. Never terminate unrelated browsers.

Use `window.__smear` for inspection and automation. Update `package.json`, the game-reported version, and visible version labels together when making a release. No em dashes or AI co-author trailers.
